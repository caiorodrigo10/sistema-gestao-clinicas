
import { pgTable, text, serial, integer, boolean, timestamp, varchar, jsonb, index, unique, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const clinics = pgTable("clinics", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  responsible: text("responsible").notNull(),
  phone: text("phone"),
  phone_country_code: text("phone_country_code").default("+55"),
  celular: text("celular").notNull(),
  celular_country_code: text("celular_country_code").default("+55"),
  email: text("email"),
  specialties: text("specialties").array(),
  
  // Address fields
  address_street: text("address_street"),
  address_number: text("address_number"),
  address_complement: text("address_complement"),
  address_neighborhood: text("address_neighborhood"),
  address_city: text("address_city"),
  address_state: text("address_state"),
  address_zip: text("address_zip"),
  address_country: text("address_country").default("BR"),
  
  // Operational information
  total_professionals: integer("total_professionals").default(1),
  working_days: text("working_days").array().default(['monday','tuesday','wednesday','thursday','friday']),
  work_start: text("work_start").default("08:00"),
  work_end: text("work_end").default("18:00"),
  has_lunch_break: boolean("has_lunch_break").default(true),
  lunch_start: text("lunch_start").default("12:00"),
  lunch_end: text("lunch_end").default("13:00"),
  timezone: text("timezone").default("America/Sao_Paulo"),
  
  // Business information
  cnpj: text("cnpj"),
  website: text("website"),
  description: text("description"),
  
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// Clinic-User relationship table for multi-tenant access
export const clinic_users = pgTable("clinic_users", {
  id: serial("id").primaryKey(),
  clinic_id: integer("clinic_id").notNull(),
  user_id: uuid("user_id").notNull(),
  role: varchar("role").notNull().default("usuario"), // admin, usuario
  is_professional: boolean("is_professional").notNull().default(false), // Controlled only by admins
  permissions: jsonb("permissions"), // Specific permissions for this clinic
  is_active: boolean("is_active").notNull().default(true),
  invited_by: uuid("invited_by"),
  invited_at: timestamp("invited_at"),
  joined_at: timestamp("joined_at"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique().on(table.clinic_id, table.user_id),
  index("idx_clinic_users_clinic").on(table.clinic_id),
  index("idx_clinic_users_user").on(table.user_id),
  index("idx_clinic_users_professional").on(table.is_professional),
]);

// Professional status audit log
export const professional_status_audit = pgTable("professional_status_audit", {
  id: serial("id").primaryKey(),
  clinic_id: integer("clinic_id").notNull(),
  target_user_id: integer("target_user_id").notNull(), // User whose status was changed
  changed_by_user_id: integer("changed_by_user_id").notNull(), // Admin who made the change
  action: varchar("action").notNull(), // 'activated' or 'deactivated'
  previous_status: boolean("previous_status").notNull(),
  new_status: boolean("new_status").notNull(),
  ip_address: varchar("ip_address"),
  user_agent: text("user_agent"),
  notes: text("notes"), // Optional reason for the change
  created_at: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_professional_audit_clinic").on(table.clinic_id),
  index("idx_professional_audit_target").on(table.target_user_id),
  index("idx_professional_audit_changed_by").on(table.changed_by_user_id),
  index("idx_professional_audit_created").on(table.created_at),
]);

// Clinic invitations for onboarding new team members
export const clinic_invitations = pgTable("clinic_invitations", {
  id: serial("id").primaryKey(),
  clinic_id: integer("clinic_id").notNull(),
  email: varchar("email").notNull(),
  role: varchar("role").notNull(),
  permissions: jsonb("permissions"),
  token: varchar("token").notNull().unique(),
  invited_by: integer("invited_by").notNull(),
  expires_at: timestamp("expires_at").notNull(),
  accepted_at: timestamp("accepted_at"),
  created_at: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_invitations_email").on(table.email),
  index("idx_invitations_token").on(table.token),
]);

export const insertClinicSchema = createInsertSchema(clinics).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const insertClinicUserSchema = createInsertSchema(clinic_users).omit({
  id: true,
  created_at: true,
});

export const insertClinicInvitationSchema = createInsertSchema(clinic_invitations).omit({
  id: true,
  created_at: true,
});

export const insertProfessionalStatusAuditSchema = createInsertSchema(professional_status_audit).omit({
  id: true,
  created_at: true,
});

export type Clinic = typeof clinics.$inferSelect;
export type InsertClinic = z.infer<typeof insertClinicSchema>;
export type ClinicUser = typeof clinic_users.$inferSelect;
export type InsertClinicUser = z.infer<typeof insertClinicUserSchema>;
export type ProfessionalStatusAudit = typeof professional_status_audit.$inferSelect;
export type InsertProfessionalStatusAudit = z.infer<typeof insertProfessionalStatusAuditSchema>;
export type ClinicInvitation = typeof clinic_invitations.$inferSelect;
export type InsertClinicInvitation = z.infer<typeof insertClinicInvitationSchema>;
