
import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  clinic_id: integer("clinic_id").notNull(),
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
  contact_id: integer("contact_id").notNull(),
  clinic_id: integer("clinic_id").notNull(),
  status: text("status").notNull(),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversation_id: integer("conversation_id").notNull(),
  sender_type: text("sender_type").notNull(), // patient, ai
  content: text("content").notNull(),
  ai_action: text("ai_action"), // agendou_consulta, enviou_followup, etc
  timestamp: timestamp("timestamp").defaultNow(),
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

export type Contact = typeof contacts.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;
export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
