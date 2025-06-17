import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import bcrypt from "bcryptjs";
import type { IStorage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import connectPg from "connect-pg-simple";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

async function comparePasswords(supplied: string, stored: string) {
  try {
    // Check if it's a bcrypt hash (starts with $2b$)
    if (stored.startsWith('$2b$') || stored.startsWith('$2a$') || stored.startsWith('$2y$')) {
      return await bcrypt.compare(supplied, stored);
    }
    
    // Fallback to scrypt for legacy passwords
    if (stored.includes('.')) {
      const [hashed, salt] = stored.split(".");
      if (!hashed || !salt) return false;
      
      const hashedBuf = Buffer.from(hashed, "hex");
      const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
      return timingSafeEqual(hashedBuf, suppliedBuf);
    }
    
    return false;
  } catch (error) {
    console.error("Password comparison error:", error);
    return false;
  }
}

export function setupAuth(app: Express, storage: IStorage) {
  // Use memory store instead of PostgreSQL due to connection issues
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || 'default-session-secret-for-dev',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week
    },
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(
      { usernameField: 'email' },
      async (email, password, done) => {
        try {
          const user = await storage.getUserByEmail(email);
          
          if (!user || !user.password || !(await comparePasswords(password, user.password))) {
            return done(null, false, { message: 'Email ou senha incorretos' });
          }
          
          if (!user.is_active) {
            return done(null, false, { message: 'Conta desativada' });
          }
          
          // Update last login
          await storage.updateUser(user.id, { last_login: new Date() });
          
          return done(null, user);
        } catch (error) {
          console.error('Auth error:', error);
          return done(error);
        }
      }
    ),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });

  // Register endpoint
  app.post("/api/register", async (req, res, next) => {
    try {
      const { email, password, name, clinic_name } = req.body;
      
      if (!email || !password || !name || !clinic_name) {
        return res.status(400).json({ error: "Todos os campos são obrigatórios" });
      }

      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: "Email já está em uso" });
      }

      // Create clinic first
      const clinic = await storage.createClinic({
        name: clinic_name,
        responsible: name,
        whatsapp_number: '',
        specialties: [],
        working_hours: '09:00-17:00'
      });

      // Create user
      const user = await storage.createUser({
        email,
        password: await hashPassword(password),
        name,
        role: "admin",
        is_active: true,
      });

      // Add user to clinic as admin
      await storage.addUserToClinic({
        clinic_id: clinic.id,
        user_id: user.id,
        role: "admin",
        is_active: true,
        joined_at: new Date()
      });

      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json({ 
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role
          },
          clinic
        });
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ error: "Erro interno do servidor" });
    }
  });

  // Login endpoint
  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        return res.status(401).json({ error: info?.message || "Credenciais inválidas" });
      }
      req.login(user, (err) => {
        if (err) {
          return next(err);
        }
        res.json({
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role
          }
        });
      });
    })(req, res, next);
  });

  // Logout endpoint
  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.json({ message: "Logout realizado com sucesso" });
    });
  });

  // Get current user
  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: "Não autenticado" });
    }
    
    const user = req.user as SelectUser;
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    });
  });
}

// Middleware to check if user is authenticated
export const isAuthenticated = (req: any, res: any, next: any) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: "Acesso negado" });
};

// Middleware to check if user has access to specific clinic
export const hasClinicAccess = (paramName: string = 'clinicId') => {
  return async (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    const user = req.user as SelectUser;
    const clinicId = parseInt(req.params[paramName]);
    
    if (!clinicId || isNaN(clinicId)) {
      return res.status(400).json({ error: "ID da clínica inválido" });
    }

    // Super admin can access all clinics
    if (user.role === 'super_admin') {
      return next();
    }

    // Check if user has access to this clinic
    const hasAccess = await storage.userHasClinicAccess(user.id, clinicId);
    if (!hasAccess) {
      return res.status(403).json({ error: "Acesso negado a esta clínica" });
    }

    next();
  };
};