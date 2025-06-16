import { pgTable, text, serial, integer, boolean, timestamp, varchar, decimal, date, jsonb, index, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Enhanced users table for email/password authentication
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
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
  id: serial("id").primaryKey(),
  user_id: integer("user_id").notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expires_at: timestamp("expires_at").notNull(),
  used: boolean("used").notNull().default(false),
  created_at: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_password_reset_tokens_user").on(table.user_id),
  index("idx_password_reset_tokens_token").on(table.token),
]);

// Clinic-User relationship table for multi-tenant access
export const clinic_users = pgTable("clinic_users", {
  id: serial("id").primaryKey(),
  clinic_id: integer("clinic_id").notNull(),
  user_id: integer("user_id").notNull(),
  role: varchar("role").notNull().default("user"), // admin, manager, user, readonly
  permissions: jsonb("permissions"), // Specific permissions for this clinic
  is_active: boolean("is_active").notNull().default(true),
  invited_by: integer("invited_by"),
  invited_at: timestamp("invited_at"),
  joined_at: timestamp("joined_at"),
  created_at: timestamp("created_at").defaultNow(),
}, (table) => [
  unique().on(table.clinic_id, table.user_id),
  index("idx_clinic_users_clinic").on(table.clinic_id),
  index("idx_clinic_users_user").on(table.user_id),
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

export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  clinic_id: integer("clinic_id").references(() => clinics.id),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  age: integer("age"),
  gender: text("gender"),
  profession: text("profession"),
  address: text("address"),
  emergency_contact: text("emergency_contact"),
  medical_history: text("medical_history"),
  current_medications: text("current_medications").array(),
  allergies: text("allergies").array(),
  status: text("status").notNull(), // novo, em_conversa, agendado, realizado, pos_atendimento
  priority: text("priority").default("normal"), // baixa, normal, alta, urgente
  source: text("source").default("whatsapp"), // whatsapp, site, indicacao, outros
  notes: text("notes"),
  first_contact: timestamp("first_contact").defaultNow(),
  last_interaction: timestamp("last_interaction").defaultNow(),
});

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  contact_id: integer("contact_id").references(() => contacts.id),
  clinic_id: integer("clinic_id").references(() => clinics.id),
  status: text("status").notNull(),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversation_id: integer("conversation_id").references(() => conversations.id),
  sender_type: text("sender_type").notNull(), // patient, ai
  content: text("content").notNull(),
  ai_action: text("ai_action"), // agendou_consulta, enviou_followup, etc
  timestamp: timestamp("timestamp").defaultNow(),
});

export const appointments = pgTable("appointments", {
  id: serial("id").primaryKey(),
  contact_id: integer("contact_id").references(() => contacts.id).notNull(),
  clinic_id: integer("clinic_id").references(() => clinics.id).notNull(),
  user_id: integer("user_id").references(() => users.id).notNull(), // Required: user who created/owns the appointment
  doctor_name: text("doctor_name"),
  specialty: text("specialty"),
  appointment_type: text("appointment_type"), // primeira_consulta, retorno, avaliacao, emergencia
  scheduled_date: timestamp("scheduled_date"),
  duration_minutes: integer("duration_minutes").default(60),
  status: text("status").notNull(), // agendada, confirmada, paciente_aguardando, paciente_em_atendimento, finalizada, faltou, cancelada_paciente, cancelada_dentista
  cancellation_reason: text("cancellation_reason"),
  session_notes: text("session_notes"),
  observations: text("observations"), // Campo de observações livre
  next_appointment_suggested: timestamp("next_appointment_suggested"),
  return_period: text("return_period"), // sem_retorno, 15_dias, 1_mes, 6_meses, 12_meses, outro
  how_found_clinic: text("how_found_clinic"), // instagram, facebook, google, indicacao_familiar, indicacao_amigo, indicacao_dentista, marketing
  tags: text("tags").array(), // Etiquetas da consulta
  receive_reminders: boolean("receive_reminders").default(true), // Se o paciente recebe lembretes
  payment_status: text("payment_status").default("pendente"), // pendente, pago, isento
  payment_amount: integer("payment_amount"), // valor em centavos
  google_calendar_event_id: text("google_calendar_event_id"), // Link to Google Calendar event
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_appointments_user").on(table.user_id),
  index("idx_appointments_contact").on(table.contact_id),
  index("idx_appointments_clinic").on(table.clinic_id),
]);

// Tabela para etiquetas de consultas (appointment tags)
export const appointment_tags = pgTable("appointment_tags", {
  id: serial("id").primaryKey(),
  clinic_id: integer("clinic_id").references(() => clinics.id).notNull(),
  name: text("name").notNull(),
  color: text("color").notNull(), // Cor da etiqueta em hexadecimal
  is_active: boolean("is_active").default(true),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_appointment_tags_clinic").on(table.clinic_id),
]);

// Tabela para métricas e analytics
export const analytics_metrics = pgTable("analytics_metrics", {
  id: serial("id").primaryKey(),
  clinic_id: integer("clinic_id").references(() => clinics.id),
  metric_type: text("metric_type").notNull(), // daily_messages, appointments_scheduled, conversion_rate, etc
  value: integer("value").notNull(),
  date: timestamp("date").notNull(),
  metadata: text("metadata"), // JSON string para dados adicionais
  created_at: timestamp("created_at").defaultNow(),
});

// Tabela para configurações da clínica
export const clinic_settings = pgTable("clinic_settings", {
  id: serial("id").primaryKey(),
  clinic_id: integer("clinic_id").references(() => clinics.id),
  setting_key: text("setting_key").notNull(),
  setting_value: text("setting_value").notNull(),
  setting_type: text("setting_type").notNull(), // string, number, boolean, json
  description: text("description"),
  updated_at: timestamp("updated_at").defaultNow(),
});

// Tabela para templates de mensagens da IA
export const ai_templates = pgTable("ai_templates", {
  id: serial("id").primaryKey(),
  clinic_id: integer("clinic_id").references(() => clinics.id),
  template_name: text("template_name").notNull(),
  template_type: text("template_type").notNull(), // greeting, appointment_confirmation, follow_up, etc
  content: text("content").notNull(),
  variables: text("variables").array(), // variáveis disponíveis no template
  is_active: boolean("is_active").default(true),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// Tabela para estágios do pipeline
export const pipeline_stages = pgTable("pipeline_stages", {
  id: serial("id").primaryKey(),
  clinic_id: integer("clinic_id").references(() => clinics.id),
  name: text("name").notNull(), // "Novos Contatos", "Qualificação", "Proposta", etc
  description: text("description"),
  order_position: integer("order_position").notNull(),
  color: text("color").default("#3b82f6"), // cor para exibição visual
  is_active: boolean("is_active").default(true),
  target_days: integer("target_days"), // dias esperados neste estágio
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// Tabela para oportunidades do pipeline
export const pipeline_opportunities = pgTable("pipeline_opportunities", {
  id: serial("id").primaryKey(),
  clinic_id: integer("clinic_id").references(() => clinics.id),
  contact_id: integer("contact_id").references(() => contacts.id),
  stage_id: integer("stage_id").references(() => pipeline_stages.id),
  title: text("title").notNull(),
  description: text("description"),
  value: integer("value"), // valor estimado em centavos
  probability: integer("probability").default(50), // % de chance de conversão
  expected_close_date: timestamp("expected_close_date"),
  actual_close_date: timestamp("actual_close_date"),
  status: text("status").notNull().default("active"), // active, won, lost, postponed
  lost_reason: text("lost_reason"),
  source: text("source"), // whatsapp, site, indicacao, marketing, etc
  assigned_to: text("assigned_to"), // responsável pela oportunidade
  tags: text("tags").array(), // tags personalizáveis
  priority: text("priority").default("medium"), // low, medium, high, urgent
  next_action: text("next_action"), // próxima ação a ser realizada
  next_action_date: timestamp("next_action_date"),
  stage_entered_at: timestamp("stage_entered_at").defaultNow(),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// Tabela para histórico de movimentações no pipeline
export const pipeline_history = pgTable("pipeline_history", {
  id: serial("id").primaryKey(),
  opportunity_id: integer("opportunity_id").references(() => pipeline_opportunities.id),
  from_stage_id: integer("from_stage_id").references(() => pipeline_stages.id),
  to_stage_id: integer("to_stage_id").references(() => pipeline_stages.id),
  changed_by: text("changed_by"),
  notes: text("notes"),
  duration_in_stage: integer("duration_in_stage"), // tempo em dias no estágio anterior
  created_at: timestamp("created_at").defaultNow(),
});

// Tabela para atividades relacionadas às oportunidades
export const pipeline_activities = pgTable("pipeline_activities", {
  id: serial("id").primaryKey(),
  opportunity_id: integer("opportunity_id").references(() => pipeline_opportunities.id),
  activity_type: text("activity_type").notNull(), // call, email, meeting, whatsapp, note, task
  title: text("title").notNull(),
  description: text("description"),
  scheduled_date: timestamp("scheduled_date"),
  completed_date: timestamp("completed_date"),
  status: text("status").notNull().default("pending"), // pending, completed, cancelled
  outcome: text("outcome"), // resultado da atividade
  next_activity_suggested: text("next_activity_suggested"),
  created_by: text("created_by"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
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

export const insertClinicSchema = createInsertSchema(clinics).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const insertContactSchema = createInsertSchema(contacts).omit({
  id: true,
  first_contact: true,
  last_interaction: true,
});

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  timestamp: true,
});

export const insertAppointmentSchema = createInsertSchema(appointments).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const insertAppointmentTagSchema = createInsertSchema(appointment_tags).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const insertAnalyticsMetricSchema = createInsertSchema(analytics_metrics).omit({
  id: true,
  created_at: true,
});

export const insertClinicSettingSchema = createInsertSchema(clinic_settings).omit({
  id: true,
  updated_at: true,
});

export const insertAiTemplateSchema = createInsertSchema(ai_templates).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const insertPipelineStageSchema = createInsertSchema(pipeline_stages).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const insertPipelineOpportunitySchema = createInsertSchema(pipeline_opportunities).omit({
  id: true,
  stage_entered_at: true,
  created_at: true,
  updated_at: true,
});

export const insertPipelineHistorySchema = createInsertSchema(pipeline_history).omit({
  id: true,
  created_at: true,
});

export const insertPipelineActivitySchema = createInsertSchema(pipeline_activities).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type ClinicUser = typeof clinic_users.$inferSelect;
export type InsertClinicUser = z.infer<typeof insertClinicUserSchema>;
export type ClinicInvitation = typeof clinic_invitations.$inferSelect;
export type InsertClinicInvitation = z.infer<typeof insertClinicInvitationSchema>;
export type Clinic = typeof clinics.$inferSelect;
export type InsertClinic = z.infer<typeof insertClinicSchema>;
export type Contact = typeof contacts.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;
export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Appointment = typeof appointments.$inferSelect;
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type AppointmentTag = typeof appointment_tags.$inferSelect;
export type InsertAppointmentTag = z.infer<typeof insertAppointmentTagSchema>;
export type AnalyticsMetric = typeof analytics_metrics.$inferSelect;
export type InsertAnalyticsMetric = z.infer<typeof insertAnalyticsMetricSchema>;
export type ClinicSetting = typeof clinic_settings.$inferSelect;
export type InsertClinicSetting = z.infer<typeof insertClinicSettingSchema>;
export type AiTemplate = typeof ai_templates.$inferSelect;
export type InsertAiTemplate = z.infer<typeof insertAiTemplateSchema>;
export type PipelineStage = typeof pipeline_stages.$inferSelect;
export type InsertPipelineStage = z.infer<typeof insertPipelineStageSchema>;
export type PipelineOpportunity = typeof pipeline_opportunities.$inferSelect;
export type InsertPipelineOpportunity = z.infer<typeof insertPipelineOpportunitySchema>;
export type PipelineHistory = typeof pipeline_history.$inferSelect;
export type InsertPipelineHistory = z.infer<typeof insertPipelineHistorySchema>;
export type PipelineActivity = typeof pipeline_activities.$inferSelect;
export type InsertPipelineActivity = z.infer<typeof insertPipelineActivitySchema>;



// Google Calendar integrations table - aligned with Supabase structure
export const calendar_integrations = pgTable("calendar_integrations", {
  id: serial("id").primaryKey(),
  user_id: text("user_id").notNull(), // Changed to TEXT for Supabase UUIDs
  clinic_id: integer("clinic_id").references(() => clinics.id).notNull(),
  provider: text("provider").notNull(),
  provider_user_id: text("provider_user_id"),
  email: text("email"),
  calendar_id: text("calendar_id"),
  calendar_name: text("calendar_name"),
  access_token: text("access_token"),
  refresh_token: text("refresh_token"),
  token_expires_at: timestamp("token_expires_at"),
  is_active: boolean("is_active").default(true),
  sync_enabled: boolean("sync_enabled").default(true),
  last_sync_at: timestamp("last_sync_at"),
  sync_errors: text("sync_errors"), // Changed from text to match actual structure
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_calendar_user").on(table.user_id),
  index("idx_calendar_clinic").on(table.clinic_id),
  unique().on(table.user_id, table.email, table.provider),
]);

export const insertCalendarIntegrationSchema = createInsertSchema(calendar_integrations).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export type CalendarIntegration = typeof calendar_integrations.$inferSelect;
export type InsertCalendarIntegration = z.infer<typeof insertCalendarIntegrationSchema>;

// Tabela para prontuários médicos vinculados às consultas
export const medical_records = pgTable("medical_records", {
  id: serial("id").primaryKey(),
  appointment_id: integer("appointment_id").references(() => appointments.id),
  contact_id: integer("contact_id").references(() => contacts.id).notNull(),
  clinic_id: integer("clinic_id").references(() => clinics.id).notNull(),
  record_type: text("record_type").notNull().default("consultation"), // consultation, exam, prescription, note
  content: text("content"), // nota livre em formato markdown
  chief_complaint: text("chief_complaint"), // queixa principal
  history_present_illness: text("history_present_illness"), // história da doença atual
  physical_examination: text("physical_examination"), // exame físico
  diagnosis: text("diagnosis"), // diagnóstico
  treatment_plan: text("treatment_plan"), // plano de tratamento
  prescriptions: jsonb("prescriptions"), // receitas médicas
  exam_requests: jsonb("exam_requests"), // solicitações de exames
  follow_up_instructions: text("follow_up_instructions"), // instruções de retorno
  observations: text("observations"), // observações gerais
  vital_signs: jsonb("vital_signs"), // sinais vitais (pressão, temperatura, etc)
  attachments: text("attachments").array(), // URLs de anexos (imagens, PDFs, etc)
  voice_transcription: text("voice_transcription"), // transcrição de áudio
  ai_summary: text("ai_summary"), // resumo gerado por IA
  templates_used: text("templates_used").array(), // templates médicos utilizados
  version: integer("version").default(1), // controle de versão
  is_active: boolean("is_active").default(true),
  created_by: integer("created_by").references(() => users.id),
  updated_by: integer("updated_by").references(() => users.id),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_medical_records_appointment").on(table.appointment_id),
  index("idx_medical_records_contact").on(table.contact_id),
  index("idx_medical_records_clinic").on(table.clinic_id),
]);

export const insertMedicalRecordSchema = createInsertSchema(medical_records).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export type MedicalRecord = typeof medical_records.$inferSelect;
export type InsertMedicalRecord = z.infer<typeof insertMedicalRecordSchema>;

// Password reset token schemas
export const insertPasswordResetTokenSchema = createInsertSchema(password_reset_tokens).omit({
  id: true,
  created_at: true,
});

export type PasswordResetToken = typeof password_reset_tokens.$inferSelect;
export type InsertPasswordResetToken = z.infer<typeof insertPasswordResetTokenSchema>;

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
  // Se está tentando alterar senha, deve fornecer senha atual
  if (data.newPassword && !data.currentPassword) {
    return false;
  }
  // Se forneceu nova senha, deve confirmar
  if (data.newPassword && data.newPassword !== data.confirmPassword) {
    return false;
  }
  return true;
}, {
  message: "Para alterar a senha, forneça a senha atual e confirme a nova senha",
  path: ["newPassword"],
});

export type UpdateUserProfile = z.infer<typeof updateUserProfileSchema>;
