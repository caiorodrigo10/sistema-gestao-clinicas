import { Request, Response, NextFunction } from 'express';
import { storage } from './storage-factory';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string | number;
    email: string;
    name: string;
    role: string;
  };
}

interface ClinicPermissions {
  clinicId: number;
  role: 'admin' | 'usuario';
  isProfessional: boolean;
  isActive: boolean;
}

// Extend request to include clinic permissions
interface PermissionRequest extends AuthenticatedRequest {
  clinicPermissions?: ClinicPermissions;
}

/**
 * Middleware to check if user has admin role in a specific clinic
 */
export const requireClinicAdmin = (clinicIdParam: string = 'clinicId') => {
  return async (req: PermissionRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ 
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      const clinicId = parseInt(req.params[clinicIdParam] || req.body.clinic_id);
      if (!clinicId || isNaN(clinicId)) {
        return res.status(400).json({ 
          error: 'Valid clinic ID required',
          code: 'INVALID_CLINIC_ID'
        });
      }

      // Get user's role in this clinic
      const clinicUsers = await storage.getClinicUsers(clinicId);
      const userInClinic = clinicUsers.find(cu => cu.user.id.toString() === user.id.toString());

      if (!userInClinic) {
        return res.status(403).json({ 
          error: 'Access denied: User not found in clinic',
          code: 'CLINIC_ACCESS_DENIED'
        });
      }

      if (userInClinic.role !== 'admin') {
        return res.status(403).json({ 
          error: 'Access denied: Admin role required',
          code: 'ADMIN_ROLE_REQUIRED'
        });
      }

      if (!userInClinic.is_active) {
        return res.status(403).json({ 
          error: 'Access denied: User inactive in clinic',
          code: 'USER_INACTIVE'
        });
      }

      // Attach clinic permissions to request
      req.clinicPermissions = {
        clinicId,
        role: userInClinic.role as 'admin' | 'usuario',
        isProfessional: userInClinic.is_professional || false,
        isActive: userInClinic.is_active
      };

      next();
    } catch (error) {
      console.error('Error in requireClinicAdmin middleware:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  };
};

/**
 * Middleware to check if user has professional status in a specific clinic
 * For now, this is disabled until we implement the Google Calendar features
 */
export const requireProfessionalStatus = (clinicIdParam: string = 'clinicId') => {
  return async (req: PermissionRequest, res: Response, next: NextFunction) => {
    // For now, just pass through - we'll implement this when we add Google Calendar back
    next();
  };
};

/**
 * Middleware to check general clinic access (any active user)
 */
export const requireClinicAccess = (clinicIdParam: string = 'clinicId') => {
  return async (req: PermissionRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ 
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      const clinicId = parseInt(req.params[clinicIdParam] || req.body.clinic_id);
      if (!clinicId || isNaN(clinicId)) {
        return res.status(400).json({ 
          error: 'Valid clinic ID required',
          code: 'INVALID_CLINIC_ID'
        });
      }

      // Check if user has access to this clinic
      const hasAccess = await storage.userHasClinicAccess(user.id, clinicId);
      if (!hasAccess) {
        return res.status(403).json({ 
          error: 'Access denied: No access to this clinic',
          code: 'CLINIC_ACCESS_DENIED'
        });
      }

      // Get user's permissions in this clinic
      const clinicUsers = await storage.getClinicUsers(clinicId);
      const userInClinic = clinicUsers.find(cu => cu.user.id === user.id);

      if (!userInClinic || !userInClinic.is_active) {
        return res.status(403).json({ 
          error: 'Access denied: User inactive in clinic',
          code: 'USER_INACTIVE'
        });
      }

      // Attach clinic permissions to request
      req.clinicPermissions = {
        clinicId,
        role: userInClinic.role as 'admin' | 'usuario',
        isProfessional: userInClinic.is_professional || false,
        isActive: userInClinic.is_active
      };

      next();
    } catch (error) {
      console.error('Error in requireClinicAccess middleware:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  };
};

/**
 * Utility function to get client IP address
 */
export const getClientIp = (req: Request): string => {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
         req.connection.remoteAddress ||
         req.socket.remoteAddress ||
         'unknown';
};

/**
 * Utility function to check if user can manage another user
 */
export const canManageUser = async (
  adminUserId: number, 
  targetUserId: number, 
  clinicId: number
): Promise<boolean> => {
  try {
    // Get both users' roles in the clinic
    const clinicUsers = await storage.getClinicUsers(clinicId);
    const adminUser = clinicUsers.find(cu => cu.user.id === adminUserId);
    const targetUser = clinicUsers.find(cu => cu.user.id === targetUserId);

    if (!adminUser || !targetUser) {
      return false;
    }

    // Only admins can manage users
    if (adminUser.role !== 'admin') {
      return false;
    }

    // Admins can't change their own professional status
    if (adminUserId === targetUserId) {
      return false;
    }

    // Both users must be in the same clinic and active
    return adminUser.is_active && targetUser.is_active;
  } catch (error) {
    console.error('Error in canManageUser:', error);
    return false;
  }
};

export type { PermissionRequest, ClinicPermissions };