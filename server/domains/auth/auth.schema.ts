
import { pgTable, text, varchar, boolean, timestamp, index, unique, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enhanced users table for email/password authentication
export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  email: varchar("email").notNull().unique(),
  password: varchar("password").notNull(),
  name: varchar("name").notNull(),
  role: varchar("role").notNull().default("admin"), // super_admin, admin, manager, user
  is_active: boolean("is_active").notNull().default(true),
  last_login: timestamp("last_login"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// Password reset tokens table
export const password_reset_tokens = pgTable("password_reset_tokens", {
  id: text("id").primaryKey(),
  user_id: uuid("user_id").notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expires_at: timestamp("expires_at").notNull(),
  used: boolean("used").notNull().default(false),
  created_at: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_password_reset_tokens_user").on(table.user_id),
  index("idx_password_reset_tokens_token").on(table.token),
]);

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const insertPasswordResetTokenSchema = createInsertSchema(password_reset_tokens).omit({
  id: true,
  created_at: true,
});

// User profile update schema
export const updateUserProfileSchema = createInsertSchema(users).omit({
  id: true,
  password: true,
  role: true,
  is_active: true,
  last_login: true,
  created_at: true,
  updated_at: true,
}).extend({
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6).optional(),
  confirmPassword: z.string().optional(),
}).refine((data) => {
  if (data.newPassword && !data.currentPassword) {
    return false;
  }
  if (data.newPassword && data.newPassword !== data.confirmPassword) {
    return false;
  }
  return true;
}, {
  message: "Para alterar a senha, forneça a senha atual e confirme a nova senha",
  path: ["newPassword"],
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type PasswordResetToken = typeof password_reset_tokens.$inferSelect;
export type InsertPasswordResetToken = z.infer<typeof insertPasswordResetTokenSchema>;
export type UpdateUserProfile = z.infer<typeof updateUserProfileSchema>;
