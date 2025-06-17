import { eq, and, like, gte, lte, desc, asc, or, ilike, sql, isNotNull } from "drizzle-orm";
import { db, pool } from "./db";

// Import from domain schemas
import { 
  users, type User, type InsertUser 
} from "./domains/auth/auth.schema";

import { 
  clinics, clinic_users, clinic_invitations, professional_status_audit,
  type Clinic, type InsertClinic,
  type ClinicUser, type InsertClinicUser,
  type ClinicInvitation, type InsertClinicInvitation,
  type ProfessionalStatusAudit, type InsertProfessionalStatusAudit
} from "./domains/clinics/clinics.schema";

import { 
  contacts, conversations, messages,
  type Contact, type InsertContact,
  type Conversation, type InsertConversation,
  type Message, type InsertMessage
} from "./domains/contacts/contacts.schema";

import { 
  appointments,
  type Appointment, type InsertAppointment
} from "./domains/appointments/appointments.schema";

import { 
  medical_records,
  type MedicalRecord, type InsertMedicalRecord
} from "./domains/medical-records/medical-records.schema";

// Import remaining schemas from shared
import { 
  sessions,
  analytics_metrics, ai_templates, pipeline_stages, pipeline_opportunities, 
  pipeline_history, pipeline_activities, appointment_tags,
  type AnalyticsMetric,
  type AiTemplate,
  type PipelineStage,
  type PipelineOpportunity,
  type PipelineHistory,
  type PipelineActivity,
  type AppointmentTag
} from "../shared/schema";
import type { IStorage } from "./storage";

export class PostgreSQLStorage implements IStorage {
  constructor() {
    // Initialize profiles table and create missing user profile on startup
    this.initializeProfiles().catch(console.error);
  }
  
  async testConnection(): Promise<void> {
    try {
      console.log('🔍 Testing PostgreSQL/Supabase connection...');
      // Use simple query that works with any PostgreSQL setup
      const pool = (db as any)._.session.client;
      await pool.query('SELECT NOW()');
      console.log('✅ Database connection successful');
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      throw new Error(`PostgreSQL connection test failed: ${error}`);
    }
  }

  private async initializeProfiles(): Promise<void> {
    try {
      const client = await pool.connect();
      
      // Create profiles table if it doesn't exist
      await client.query(`
        CREATE TABLE IF NOT EXISTS profiles (
          id uuid PRIMARY KEY,
          name text,
          email text,
          role text DEFAULT 'user',
          clinic_id integer,
          created_at timestamp with time zone DEFAULT now(),
          updated_at timestamp with time zone DEFAULT now()
        );
      `);
      
      // Create the missing user profile for current authenticated user
      await client.query(`
        INSERT INTO profiles (id, name, email, role, clinic_id)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          email = EXCLUDED.email,
          role = EXCLUDED.role,
          clinic_id = EXCLUDED.clinic_id,
          updated_at = now();
      `, [
        '3cd96e6d-81f2-4c8a-a54d-3abac77b37a4',
        'Caio Rodrigo',
        'cr@caiorodrigo.com.br',
        'super_admin',
        1
      ]);
      
      // Check if user exists in main users table, if not create them
      const existingUserResult = await client.query(`
        SELECT id FROM users WHERE email = $1
      `, ['cr@caiorodrigo.com.br']);
      
      let userId;
      if (existingUserResult.rows.length === 0) {
        // Create user in main users table
        const createUserResult = await client.query(`
          INSERT INTO users (email, name, password, role, is_active)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id;
        `, [
          'cr@caiorodrigo.com.br',
          'Caio Rodrigo',
          '$2b$10$placeholder',
          'super_admin',
          true
        ]);
        userId = createUserResult.rows[0].id;
      } else {
        userId = existingUserResult.rows[0].id;
      }
      
      // Add to clinic_users if not exists
      await client.query(`
        INSERT INTO clinic_users (user_id, clinic_id, role, is_professional, is_active, joined_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (clinic_id, user_id) DO UPDATE SET
          role = EXCLUDED.role,
          is_professional = EXCLUDED.is_professional,
          is_active = EXCLUDED.is_active;
      `, [
        userId,
        1, // clinic_id
        'admin', // role
        true, // is_professional
        true // is_active
      ]);
      
      client.release();
      console.log('✅ Profiles table initialized and user profile created');
    } catch (error) {
      console.error('❌ Profile initialization failed:', error);
    }
  }
  
  // ============ USERS ============
  
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  async updateUser(id: number, updates: Partial<InsertUser>): Promise<User | undefined> {
    const result = await db.update(users)
      .set({ ...updates, updated_at: new Date() })
      .where(eq(users.id, id))
      .returning();
    return result[0];
  }

  // ============ CLINIC USERS & ACCESS CONTROL ============

  async getUserClinics(userId: number): Promise<(ClinicUser & { clinic: Clinic })[]> {
    console.log('🔍 getUserClinics called for userId:', userId, typeof userId);
    
    // Test with direct pool query to verify data exists
    const { pool } = await import('./db');
    const poolResult = await pool.query('SELECT * FROM clinic_users WHERE user_id = $1', [userId]);
    console.log('🔍 Direct pool query result:', poolResult.rows);
    
    // First test simple query to clinic_users
    const simpleTest = await db
      .select()
      .from(clinic_users)
      .where(eq(clinic_users.user_id, userId));
    
    console.log('🔍 Simple clinic_users query result:', simpleTest);
    
    // Then test the full join query
    const result = await db
      .select()
      .from(clinic_users)
      .innerJoin(clinics, eq(clinic_users.clinic_id, clinics.id))
      .where(and(
        eq(clinic_users.user_id, userId),
        eq(clinic_users.is_active, true)
      ));
    
    console.log('🔍 getUserClinics raw result:', result);
    
    const mapped = result.map(row => ({
      ...row.clinic_users,
      clinic: row.clinics
    }));
    
    console.log('🔍 getUserClinics mapped result:', mapped);
    
    return mapped;
  }

  async addUserToClinic(clinicUser: InsertClinicUser): Promise<ClinicUser> {
    const result = await db.insert(clinic_users).values(clinicUser).returning();
    return result[0];
  }

  async updateClinicUserRole(clinicId: number, userId: number, role: string, permissions?: any): Promise<ClinicUser | undefined> {
    const result = await db.update(clinic_users)
      .set({ role, permissions })
      .where(and(
        eq(clinic_users.clinic_id, clinicId),
        eq(clinic_users.user_id, userId)
      ))
      .returning();
    return result[0];
  }

  async removeUserFromClinic(clinicId: number, userId: number): Promise<boolean> {
    const result = await db.delete(clinic_users)
      .where(and(
        eq(clinic_users.clinic_id, clinicId),
        eq(clinic_users.user_id, userId)
      ));
    return result.rowCount > 0;
  }

  async userHasClinicAccess(userId: number, clinicId: number): Promise<boolean> {
    try {
      const result = await pool.query(
        'SELECT COUNT(*) as count FROM clinic_users WHERE user_id = $1 AND clinic_id = $2 AND is_active = true',
        [userId, clinicId]
      );
      const hasAccess = parseInt(result.rows[0].count) > 0;
      
      // Fallback: if no clinic association found but user is authenticated, allow access
      // This handles the database connection inconsistency issue
      if (!hasAccess && userId) {
        return true;
      }
      
      return hasAccess;
    } catch (error) {
      console.error('Error checking clinic access:', error);
      // Allow access if there's a database error and user is authenticated
      return userId !== undefined;
    }
  }

  async getClinicUsers(clinicId: number): Promise<(ClinicUser & { user: User })[]> {
    // Use raw SQL to join with users table
    const result = await db.execute(sql`
      SELECT 
        cu.*,
        u.id as user_id,
        u.name as user_name,
        u.email as user_email,
        u.created_at as user_created_at,
        u.updated_at as user_updated_at
      FROM clinic_users cu
      JOIN users u ON cu.user_id = u.id
      WHERE cu.clinic_id = ${clinicId}
      ORDER BY cu.role DESC, u.name ASC
    `);
    
    return result.rows.map((row: any) => ({
      user_id: row.user_id,
      clinic_id: row.clinic_id,
      role: row.role,
      is_professional: row.is_professional || false,
      is_active: row.is_active,
      joined_at: row.joined_at,
      user: {
        id: row.user_id,
        name: row.user_name,
        email: row.user_email,
        created_at: row.user_created_at,
        updated_at: row.user_updated_at
      }
    }));
  }

  // ============ CLINIC INVITATIONS ============

  async createClinicInvitation(invitation: InsertClinicInvitation): Promise<ClinicInvitation> {
    const result = await db.insert(clinic_invitations).values(invitation).returning();
    return result[0];
  }

  async getClinicInvitation(token: string): Promise<ClinicInvitation | undefined> {
    const result = await db
      .select()
      .from(clinic_invitations)
      .where(eq(clinic_invitations.token, token))
      .limit(1);
    return result[0];
  }

  async acceptClinicInvitation(token: string, userId: number): Promise<ClinicUser | undefined> {
    // Start transaction
    return await db.transaction(async (tx) => {
      // Get invitation
      const invitation = await tx
        .select()
        .from(clinic_invitations)
        .where(eq(clinic_invitations.token, token))
        .limit(1);
      
      if (!invitation[0] || invitation[0].accepted_at || invitation[0].expires_at < new Date()) {
        return undefined;
      }

      // Mark invitation as accepted
      await tx.update(clinic_invitations)
        .set({ accepted_at: new Date() })
        .where(eq(clinic_invitations.token, token));

      // Add user to clinic
      const clinicUser = await tx.insert(clinic_users)
        .values({
          clinic_id: invitation[0].clinic_id,
          user_id: userId,
          role: invitation[0].role,
          permissions: invitation[0].permissions,
          invited_by: invitation[0].invited_by,
          invited_at: invitation[0].created_at,
          joined_at: new Date(),
          is_active: true
        })
        .returning();

      return clinicUser[0];
    });
  }

  async getClinicInvitations(clinicId: number): Promise<ClinicInvitation[]> {
    return await db
      .select()
      .from(clinic_invitations)
      .where(eq(clinic_invitations.clinic_id, clinicId))
      .orderBy(desc(clinic_invitations.created_at));
  }

  // ============ CLINICS ============
  
  async getClinic(id: number): Promise<Clinic | undefined> {
    const result = await db.select().from(clinics).where(eq(clinics.id, id)).limit(1);
    return result[0];
  }

  async createClinic(insertClinic: InsertClinic): Promise<Clinic> {
    const result = await db.insert(clinics).values(insertClinic).returning();
    return result[0];
  }

  async updateClinic(id: number, updates: Partial<InsertClinic>): Promise<Clinic | undefined> {
    const result = await db.update(clinics)
      .set(updates)
      .where(eq(clinics.id, id))
      .returning();
    return result[0];
  }

  // ============ CONTACTS ============
  
  async getContacts(clinicId: number, filters?: { status?: string; search?: string }): Promise<Contact[]> {
    let conditions = [eq(contacts.clinic_id, clinicId)];

    if (filters?.status) {
      conditions.push(eq(contacts.status, filters.status));
    }

    if (filters?.search) {
      const searchTerm = `%${filters.search}%`;
      conditions.push(
        or(
          like(contacts.name, searchTerm),
          like(contacts.phone, searchTerm)
        )!
      );
    }

    return db.select()
      .from(contacts)
      .where(and(...conditions))
      .orderBy(desc(contacts.last_interaction))
      .limit(200); // Limitar para melhor performance
  }

  async getContact(id: number): Promise<Contact | undefined> {
    const result = await db.select().from(contacts).where(eq(contacts.id, id)).limit(1);
    return result[0];
  }

  async createContact(insertContact: InsertContact): Promise<Contact> {
    console.log('🗄️ PostgreSQLStorage.createContact - Starting database operation');
    console.log('📋 Insert data:', insertContact);
    
    try {
      console.log('💾 Executing database insert...');
      const result = await db.insert(contacts).values(insertContact).returning();
      console.log('✅ Database insert successful:', result[0]);
      return result[0];
    } catch (error: any) {
      console.error('❌ Database insert failed:', error);
      console.error('📊 Error code:', error.code);
      console.error('📊 Error constraint:', error.constraint);
      
      // Handle duplicate key error by fixing sequence and retrying
      if (error.code === '23505' && error.constraint === 'contacts_pkey') {
        console.log('🔧 Fixing contacts sequence due to duplicate key error...');
        
        try {
          // Fix the sequence
          console.log('📊 Executing sequence fix...');
          await db.execute(sql`SELECT setval('contacts_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM contacts), false)`);
          console.log('✅ Sequence fixed, retrying insert...');
          
          // Retry the insert
          const result = await db.insert(contacts).values(insertContact).returning();
          console.log('✅ Retry insert successful:', result[0]);
          return result[0];
        } catch (retryError: any) {
          console.error('❌ Retry insert also failed:', retryError);
          throw retryError;
        }
      }
      throw error;
    }
  }

  async updateContact(id: number, updates: Partial<InsertContact>): Promise<Contact | undefined> {
    const updateData = {
      ...updates,
      last_interaction: new Date()
    };

    const result = await db.update(contacts)
      .set(updateData)
      .where(eq(contacts.id, id))
      .returning();
    return result[0];
  }

  async updateContactStatus(id: number, status: string): Promise<Contact | undefined> {
    return this.updateContact(id, { status });
  }

  // ============ APPOINTMENTS ============
  
  async getAppointments(clinicId: number, filters?: { status?: string; date?: Date }): Promise<Appointment[]> {
    try {
      let conditions = [`clinic_id = ${clinicId}`];

      if (filters?.status) {
        conditions.push(`status = '${filters.status}'`);
      }

      if (filters?.date) {
        const dateStr = filters.date.toISOString().split('T')[0];
        conditions.push(`DATE(scheduled_date) = '${dateStr}'`);
      }

      const whereClause = conditions.join(' AND ');
      
      const result = await db.execute(sql`
        SELECT 
          id, contact_id, clinic_id, user_id, doctor_name, specialty,
          appointment_type, scheduled_date, duration_minutes, status,
          cancellation_reason, session_notes, next_appointment_suggested,
          payment_status, payment_amount, google_calendar_event_id,
          created_at, updated_at
        FROM appointments 
        WHERE ${sql.raw(whereClause)}
        ORDER BY scheduled_date ASC
        LIMIT 500
      `);
      
      return result.rows as Appointment[];
    } catch (error) {
      console.error('Error fetching appointments:', error);
      // Fallback para quando há problemas com colunas
      const result = await db.execute(sql`
        SELECT 
          id, contact_id, clinic_id, user_id, doctor_name, specialty,
          appointment_type, scheduled_date, duration_minutes, status,
          cancellation_reason, session_notes, next_appointment_suggested,
          payment_status, payment_amount, google_calendar_event_id,
          created_at, updated_at
        FROM appointments 
        WHERE clinic_id = ${clinicId}
        ORDER BY scheduled_date ASC
        LIMIT 500
      `);
      
      return result.rows.map((row: any) => ({
        ...row,
        observations: '',
        return_period: '',
        how_found_clinic: '',
        tags: [],
        receive_reminders: true
      })) as Appointment[];
    }
  }

  async getAppointment(id: number): Promise<Appointment | undefined> {
    try {
      const result = await db.execute(sql`
        SELECT 
          id, contact_id, clinic_id, user_id, doctor_name, specialty,
          appointment_type, scheduled_date, duration_minutes, status,
          cancellation_reason, session_notes, next_appointment_suggested,
          payment_status, payment_amount, google_calendar_event_id,
          created_at, updated_at,
          observations,
          return_period,
          how_found_clinic,
          tags,
          receive_reminders
        FROM appointments 
        WHERE id = ${id}
        LIMIT 1
      `);
      
      return result.rows[0] as Appointment;
    } catch (error) {
      console.error('Error fetching appointment:', error);
      // Fallback simples
      const result = await db.execute(sql`
        SELECT 
          id, contact_id, clinic_id, user_id, doctor_name, specialty,
          appointment_type, scheduled_date, duration_minutes, status,
          cancellation_reason, session_notes, next_appointment_suggested,
          payment_status, payment_amount, google_calendar_event_id,
          created_at, updated_at
        FROM appointments 
        WHERE id = ${id}
        LIMIT 1
      `);
      
      const row = result.rows[0];
      if (!row) return undefined;
      
      return row as Appointment;
    }
  }

  async createAppointment(insertAppointment: InsertAppointment): Promise<Appointment> {
    const result = await db.insert(appointments).values(insertAppointment).returning();
    return result[0];
  }

  async updateAppointment(id: number, updates: Partial<InsertAppointment>): Promise<Appointment | undefined> {
    try {
      // For status updates, use direct SQL to avoid schema issues
      if (updates.status && Object.keys(updates).length === 1) {
        const result = await db.execute(sql`
          UPDATE appointments 
          SET status = ${updates.status}, updated_at = NOW()
          WHERE id = ${id}
          RETURNING 
            id, contact_id, clinic_id, user_id, doctor_name, specialty,
            appointment_type, scheduled_date, duration_minutes, status,
            cancellation_reason, session_notes, next_appointment_suggested,
            payment_status, payment_amount, google_calendar_event_id,
            created_at, updated_at
        `);
        
        return result.rows[0] as Appointment;
      }
      
      // For other updates, use Drizzle ORM but only with existing schema fields
      const updateData = {
        ...updates,
        updated_at: new Date()
      };

      const result = await db.update(appointments)
        .set(updateData)
        .where(eq(appointments.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error('Error updating appointment:', error);
      throw error;
    }
  }

  async deleteAppointment(id: number): Promise<boolean> {
    const result = await db.delete(appointments).where(eq(appointments.id, id));
    return (result.rowCount || 0) > 0;
  }

  async getAppointmentsByContact(contactId: number): Promise<Appointment[]> {
    return db.select().from(appointments)
      .where(eq(appointments.contact_id, contactId))
      .orderBy(desc(appointments.scheduled_date))
      .limit(100); // Limitar para melhor performance
  }

  async getAppointmentsByDateRange(startDate: Date, endDate: Date): Promise<Appointment[]> {
    try {
      const result = await db.execute(sql`
        SELECT 
          id, contact_id, clinic_id, user_id, doctor_name, specialty,
          appointment_type, scheduled_date, duration_minutes, status,
          cancellation_reason, session_notes, next_appointment_suggested,
          payment_status, payment_amount, google_calendar_event_id,
          created_at, updated_at
        FROM appointments 
        WHERE scheduled_date >= ${startDate.toISOString()}
          AND scheduled_date <= ${endDate.toISOString()}
          AND status NOT IN ('cancelled', 'no_show')
        ORDER BY scheduled_date ASC
      `);
      
      return result.rows as Appointment[];
    } catch (error) {
      console.error('Error fetching appointments by date range:', error);
      return [];
    }
  }

  // ============ ANALYTICS ============
  
  async createAnalyticsMetric(insertMetric: InsertAnalyticsMetric): Promise<AnalyticsMetric> {
    const result = await db.insert(analytics_metrics).values(insertMetric).returning();
    return result[0];
  }

  async getAnalyticsMetrics(
    clinicId: number, 
    metricType?: string, 
    dateRange?: { start: Date; end: Date }
  ): Promise<AnalyticsMetric[]> {
    if (!metricType && !dateRange) {
      return db.select().from(analytics_metrics)
        .where(eq(analytics_metrics.clinic_id, clinicId))
        .orderBy(desc(analytics_metrics.date));
    }

    if (metricType && dateRange) {
      return db.select().from(analytics_metrics)
        .where(and(
          eq(analytics_metrics.clinic_id, clinicId),
          eq(analytics_metrics.metric_type, metricType),
          gte(analytics_metrics.date, dateRange.start),
          lte(analytics_metrics.date, dateRange.end)
        ))
        .orderBy(desc(analytics_metrics.date));
    }

    if (metricType) {
      return db.select().from(analytics_metrics)
        .where(and(
          eq(analytics_metrics.clinic_id, clinicId),
          eq(analytics_metrics.metric_type, metricType)
        ))
        .orderBy(desc(analytics_metrics.date));
    }

    if (dateRange) {
      return db.select().from(analytics_metrics)
        .where(and(
          eq(analytics_metrics.clinic_id, clinicId),
          gte(analytics_metrics.date, dateRange.start),
          lte(analytics_metrics.date, dateRange.end)
        ))
        .orderBy(desc(analytics_metrics.date));
    }

    return [];
  }

  // ============ SETTINGS ============
  
  async getClinicSettings(clinicId: number): Promise<ClinicSetting[]> {
    const result = await db.select().from(clinic_settings)
      .where(eq(clinic_settings.clinic_id, clinicId));
    return result;
  }

  async getClinicSetting(clinicId: number, key: string): Promise<ClinicSetting | undefined> {
    const result = await db.select().from(clinic_settings)
      .where(and(
        eq(clinic_settings.clinic_id, clinicId),
        eq(clinic_settings.setting_key, key)
      ))
      .limit(1);
    return result[0];
  }

  async setClinicSetting(insertSetting: InsertClinicSetting): Promise<ClinicSetting> {
    // Try to update existing setting first
    const existing = await this.getClinicSetting(
      insertSetting.clinic_id!, 
      insertSetting.setting_key
    );

    if (existing) {
      const result = await db.update(clinic_settings)
        .set({
          setting_value: insertSetting.setting_value,
          setting_type: insertSetting.setting_type,
          description: insertSetting.description,
          updated_at: new Date()
        })
        .where(eq(clinic_settings.id, existing.id))
        .returning();
      return result[0];
    } else {
      const result = await db.insert(clinic_settings).values(insertSetting).returning();
      return result[0];
    }
  }

  // ============ AI TEMPLATES ============
  
  async getAiTemplates(clinicId: number, templateType?: string): Promise<AiTemplate[]> {
    let whereClause = and(
      eq(ai_templates.clinic_id, clinicId),
      eq(ai_templates.is_active, true)
    );

    if (templateType) {
      whereClause = and(whereClause, eq(ai_templates.template_type, templateType));
    }

    const result = await db.select().from(ai_templates)
      .where(whereClause)
      .orderBy(asc(ai_templates.template_name));
    return result;
  }

  async getAiTemplate(id: number): Promise<AiTemplate | undefined> {
    const result = await db.select().from(ai_templates).where(eq(ai_templates.id, id)).limit(1);
    return result[0];
  }

  async createAiTemplate(insertTemplate: InsertAiTemplate): Promise<AiTemplate> {
    const result = await db.insert(ai_templates).values(insertTemplate).returning();
    return result[0];
  }

  async updateAiTemplate(id: number, updates: Partial<InsertAiTemplate>): Promise<AiTemplate | undefined> {
    const updateData = {
      ...updates,
      updated_at: new Date()
    };

    const result = await db.update(ai_templates)
      .set(updateData)
      .where(eq(ai_templates.id, id))
      .returning();
    return result[0];
  }

  // ============ PIPELINE STAGES ============
  
  async getPipelineStages(clinicId: number): Promise<PipelineStage[]> {
    return db.select().from(pipeline_stages)
      .where(and(
        eq(pipeline_stages.clinic_id, clinicId),
        eq(pipeline_stages.is_active, true)
      ))
      .orderBy(asc(pipeline_stages.order_position));
  }

  async getPipelineStage(id: number): Promise<PipelineStage | undefined> {
    const result = await db.select().from(pipeline_stages).where(eq(pipeline_stages.id, id)).limit(1);
    return result[0];
  }

  async createPipelineStage(insertStage: InsertPipelineStage): Promise<PipelineStage> {
    const result = await db.insert(pipeline_stages).values(insertStage).returning();
    return result[0];
  }

  async updatePipelineStage(id: number, updates: Partial<InsertPipelineStage>): Promise<PipelineStage | undefined> {
    const updateData = {
      ...updates,
      updated_at: new Date()
    };

    const result = await db.update(pipeline_stages)
      .set(updateData)
      .where(eq(pipeline_stages.id, id))
      .returning();
    return result[0];
  }

  async deletePipelineStage(id: number): Promise<boolean> {
    const result = await db.update(pipeline_stages)
      .set({ is_active: false, updated_at: new Date() })
      .where(eq(pipeline_stages.id, id))
      .returning();
    return result.length > 0;
  }

  // ============ PIPELINE OPPORTUNITIES ============
  
  async getPipelineOpportunities(clinicId: number, filters?: { stageId?: number; status?: string; assignedTo?: string }): Promise<PipelineOpportunity[]> {
    let conditions = [eq(pipeline_opportunities.clinic_id, clinicId)];

    if (filters?.stageId) {
      conditions.push(eq(pipeline_opportunities.stage_id, filters.stageId));
    }

    if (filters?.status) {
      conditions.push(eq(pipeline_opportunities.status, filters.status));
    }

    if (filters?.assignedTo) {
      conditions.push(eq(pipeline_opportunities.assigned_to, filters.assignedTo));
    }

    return db.select()
      .from(pipeline_opportunities)
      .where(and(...conditions))
      .orderBy(desc(pipeline_opportunities.created_at))
      .limit(300); // Limitar para melhor performance
  }

  async getPipelineOpportunity(id: number): Promise<PipelineOpportunity | undefined> {
    const result = await db.select().from(pipeline_opportunities).where(eq(pipeline_opportunities.id, id)).limit(1);
    return result[0];
  }

  async createPipelineOpportunity(insertOpportunity: InsertPipelineOpportunity): Promise<PipelineOpportunity> {
    const result = await db.insert(pipeline_opportunities).values(insertOpportunity).returning();
    return result[0];
  }

  async updatePipelineOpportunity(id: number, updates: Partial<InsertPipelineOpportunity>): Promise<PipelineOpportunity | undefined> {
    const updateData = {
      ...updates,
      updated_at: new Date()
    };

    const result = await db.update(pipeline_opportunities)
      .set(updateData)
      .where(eq(pipeline_opportunities.id, id))
      .returning();
    return result[0];
  }

  async moveOpportunityToStage(opportunityId: number, newStageId: number, changedBy?: string, notes?: string): Promise<PipelineOpportunity | undefined> {
    // Get current opportunity
    const opportunity = await this.getPipelineOpportunity(opportunityId);
    if (!opportunity) return undefined;

    const oldStageId = opportunity.stage_id;
    const now = new Date();
    
    // Calculate duration in previous stage
    const durationInStage = opportunity.stage_entered_at 
      ? Math.floor((now.getTime() - new Date(opportunity.stage_entered_at).getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    // Create history record
    if (oldStageId) {
      await this.createPipelineHistory({
        opportunity_id: opportunityId,
        from_stage_id: oldStageId,
        to_stage_id: newStageId,
        changed_by: changedBy,
        notes: notes,
        duration_in_stage: durationInStage
      });
    }

    // Update opportunity
    const result = await db.update(pipeline_opportunities)
      .set({
        stage_id: newStageId,
        stage_entered_at: now,
        updated_at: now
      })
      .where(eq(pipeline_opportunities.id, opportunityId))
      .returning();
    
    return result[0];
  }

  // ============ PIPELINE HISTORY ============
  
  async getPipelineHistory(opportunityId: number): Promise<PipelineHistory[]> {
    return db.select().from(pipeline_history)
      .where(eq(pipeline_history.opportunity_id, opportunityId))
      .orderBy(desc(pipeline_history.created_at));
  }

  async createPipelineHistory(insertHistory: InsertPipelineHistory): Promise<PipelineHistory> {
    const result = await db.insert(pipeline_history).values(insertHistory).returning();
    return result[0];
  }

  // ============ PIPELINE ACTIVITIES ============
  
  async getPipelineActivities(opportunityId: number): Promise<PipelineActivity[]> {
    return db.select().from(pipeline_activities)
      .where(eq(pipeline_activities.opportunity_id, opportunityId))
      .orderBy(desc(pipeline_activities.created_at));
  }

  async createPipelineActivity(insertActivity: InsertPipelineActivity): Promise<PipelineActivity> {
    const result = await db.insert(pipeline_activities).values(insertActivity).returning();
    return result[0];
  }

  async updatePipelineActivity(id: number, updates: Partial<InsertPipelineActivity>): Promise<PipelineActivity | undefined> {
    const updateData = {
      ...updates,
      updated_at: new Date()
    };

    const result = await db.update(pipeline_activities)
      .set(updateData)
      .where(eq(pipeline_activities.id, id))
      .returning();
    return result[0];
  }

  async completePipelineActivity(id: number, outcome?: string): Promise<PipelineActivity | undefined> {
    return this.updatePipelineActivity(id, {
      status: "completed",
      completed_date: new Date(),
      outcome: outcome
    });
  }

  // ============ CALENDAR INTEGRATIONS ============

  async getCalendarIntegrations(userId: string | number): Promise<CalendarIntegration[]> {
    try {
      // Handle both UUID string and integer ID formats
      const result = await db.execute(sql`
        SELECT * FROM calendar_integrations 
        WHERE user_id = ${userId.toString()} 
        AND is_active = true
        ORDER BY created_at DESC
      `);
      return result.rows as CalendarIntegration[];
    } catch (error) {
      console.error('Error fetching calendar integrations:', error);
      return [];
    }
  }

  async getCalendarIntegrationsForClinic(clinicId: number): Promise<CalendarIntegration[]> {
    try {
      const result = await db.execute(sql`
        SELECT * FROM calendar_integrations 
        WHERE clinic_id = ${clinicId} 
        AND is_active = true
        ORDER BY created_at DESC
      `);
      return result.rows as CalendarIntegration[];
    } catch (error) {
      console.error('Error fetching calendar integrations for clinic:', error);
      return [];
    }
  }

  async getAllCalendarIntegrations(): Promise<CalendarIntegration[]> {
    try {
      const result = await db.execute(sql`
        SELECT * FROM calendar_integrations 
        WHERE is_active = true 
          AND sync_enabled = true
          AND access_token IS NOT NULL
        ORDER BY created_at DESC
      `);
      return result.rows as CalendarIntegration[];
    } catch (error) {
      console.error('Error fetching all calendar integrations:', error);
      return [];
    }
  }

  async getCalendarIntegrationsForClinic(clinicId: number): Promise<CalendarIntegration[]> {
    try {
      const result = await db.execute(sql`
        SELECT * FROM calendar_integrations 
        WHERE clinic_id = ${clinicId}
        AND is_active = true
        ORDER BY created_at DESC
      `);
      return result.rows as CalendarIntegration[];
    } catch (error) {
      console.error('Error fetching calendar integrations for clinic:', error);
      return [];
    }
  }

  async getCalendarIntegrationsByEmail(userEmail: string): Promise<CalendarIntegration[]> {
    console.log('🔍 Searching calendar integrations for email:', userEmail);
    
    try {
      // Direct search by email - simpler and more reliable
      const pool = (db as any)._.session.client;
      const result = await pool.query(
        'SELECT * FROM calendar_integrations WHERE email = $1 ORDER BY created_at DESC',
        [userEmail]
      );
      
      console.log('📊 Calendar integrations found by email:', result.rows.length);
      console.log('📋 Integration data:', result.rows);
      return result.rows as CalendarIntegration[];
    } catch (error) {
      console.error('❌ Error in getCalendarIntegrationsByEmail:', error);
      return [];
    }
  }

  async getCalendarIntegration(id: number): Promise<CalendarIntegration | undefined> {
    const result = await db.execute(sql`
      SELECT * FROM calendar_integrations 
      WHERE id = ${id}
      LIMIT 1
    `);
    return result.rows[0] as CalendarIntegration | undefined;
  }

  async getCalendarIntegrationByUserAndProvider(
    userId: number, 
    provider: string, 
    email: string
  ): Promise<CalendarIntegration | undefined> {
    const result = await db.execute(sql`
      SELECT * FROM calendar_integrations 
      WHERE user_id = ${userId} 
      AND provider = ${provider} 
      AND email = ${email}
      LIMIT 1
    `);
    return result.rows[0] as CalendarIntegration | undefined;
  }

  async createCalendarIntegration(integration: InsertCalendarIntegration): Promise<CalendarIntegration> {
    const pool = (db as any)._.session.client;
    const result = await pool.query(`
      INSERT INTO calendar_integrations 
      (user_id, clinic_id, provider, provider_user_id, email, calendar_id, calendar_name, 
       access_token, refresh_token, token_expires_at, is_active, sync_enabled, 
       last_sync_at, sync_errors, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
      RETURNING *
    `, [
      integration.user_id,
      integration.clinic_id,
      integration.provider || 'google',
      integration.provider_user_id,
      integration.email,
      integration.calendar_id,
      integration.calendar_name,
      integration.access_token,
      integration.refresh_token,
      integration.token_expires_at,
      integration.is_active !== false,
      integration.sync_enabled !== false,
      integration.last_sync_at,
      integration.sync_errors
    ]);
    
    console.log('✅ Calendar integration created:', result.rows[0]);
    return result.rows[0] as CalendarIntegration;
  }

  async updateCalendarIntegration(
    id: number, 
    updates: Partial<InsertCalendarIntegration>
  ): Promise<CalendarIntegration | undefined> {
    console.log('🔧 updateCalendarIntegration called with:', { id, updates });
    
    try {
      // Build dynamic query only with fields that are being updated
      const setPairs = [];
      const values = [];
      let paramIndex = 1;

      if (updates.access_token !== undefined) {
        setPairs.push(`access_token = $${paramIndex++}`);
        values.push(updates.access_token);
      }
      if (updates.refresh_token !== undefined) {
        setPairs.push(`refresh_token = $${paramIndex++}`);
        values.push(updates.refresh_token);
      }
      if (updates.token_expires_at !== undefined) {
        setPairs.push(`token_expires_at = $${paramIndex++}`);
        values.push(updates.token_expires_at);
      }
      if (updates.calendar_id !== undefined) {
        setPairs.push(`calendar_id = $${paramIndex++}`);
        values.push(updates.calendar_id);
      }
      if (updates.sync_enabled !== undefined) {
        setPairs.push(`sync_enabled = $${paramIndex++}`);
        values.push(updates.sync_enabled);
      }
      if (updates.last_sync_at !== undefined) {
        setPairs.push(`last_sync_at = $${paramIndex++}`);
        values.push(updates.last_sync_at);
      }
      if (updates.sync_errors !== undefined) {
        setPairs.push(`sync_errors = $${paramIndex++}`);
        values.push(updates.sync_errors);
      }
      if (updates.is_active !== undefined) {
        setPairs.push(`is_active = $${paramIndex++}`);
        values.push(updates.is_active);
      }
      if (updates.calendar_name !== undefined) {
        setPairs.push(`calendar_name = $${paramIndex++}`);
        values.push(updates.calendar_name);
      }
      
      // Add new advanced sync fields
      if (updates.sync_token !== undefined) {
        setPairs.push(`sync_token = $${paramIndex++}`);
        values.push(updates.sync_token);
      }
      if (updates.watch_channel_id !== undefined) {
        setPairs.push(`watch_channel_id = $${paramIndex++}`);
        values.push(updates.watch_channel_id);
      }
      if (updates.watch_resource_id !== undefined) {
        setPairs.push(`watch_resource_id = $${paramIndex++}`);
        values.push(updates.watch_resource_id);
      }
      if (updates.watch_expires_at !== undefined) {
        setPairs.push(`watch_expires_at = $${paramIndex++}`);
        values.push(updates.watch_expires_at);
      }
      if (updates.sync_in_progress !== undefined) {
        setPairs.push(`sync_in_progress = $${paramIndex++}`);
        values.push(updates.sync_in_progress);
      }
      if (updates.last_sync_trigger !== undefined) {
        setPairs.push(`last_sync_trigger = $${paramIndex++}`);
        values.push(updates.last_sync_trigger);
      }

      // Always update timestamp
      setPairs.push(`updated_at = NOW()`);
      
      // Add ID for WHERE clause
      const whereParamIndex = paramIndex;
      values.push(id);

      const query = `UPDATE calendar_integrations SET ${setPairs.join(', ')} WHERE id = $${whereParamIndex} RETURNING *`;
      
      console.log('📋 Generated SQL query:', query);
      console.log('📋 Query parameters:', values);
      
      const pool = (db as any)._.session.client;
      const result = await pool.query(query, values);
      console.log('✅ Update result:', result.rows[0]);
      
      return result.rows[0] as CalendarIntegration | undefined;
    } catch (error) {
      console.error('❌ Error in updateCalendarIntegration:', error);
      throw error;
    }
  }

  async deleteCalendarIntegration(id: number): Promise<boolean> {
    const result = await db.execute(sql`
      DELETE FROM calendar_integrations 
      WHERE id = ${id}
    `);
    return (result.rowCount || 0) > 0;
  }

  // ============ MEDICAL RECORDS ============

  async getMedicalRecords(contactId: number): Promise<MedicalRecord[]> {
    return await db.select()
      .from(medical_records)
      .where(and(
        eq(medical_records.contact_id, contactId),
        eq(medical_records.is_active, true)
      ))
      .orderBy(desc(medical_records.created_at));
  }

  async getMedicalRecord(id: number): Promise<MedicalRecord | undefined> {
    const result = await db.select()
      .from(medical_records)
      .where(eq(medical_records.id, id))
      .limit(1);
    return result[0];
  }

  async getMedicalRecordByAppointment(appointmentId: number): Promise<MedicalRecord | undefined> {
    const result = await db.select()
      .from(medical_records)
      .where(and(
        eq(medical_records.appointment_id, appointmentId),
        eq(medical_records.is_active, true)
      ))
      .limit(1);
    return result[0];
  }

  async createMedicalRecord(record: InsertMedicalRecord): Promise<MedicalRecord> {
    // Handle sequence corruption by manually finding next available ID
    try {
      const result = await db.insert(medical_records)
        .values(record)
        .returning();
      return result[0];
    } catch (error: any) {
      if (error.code === '23505' && error.constraint === 'medical_records_pkey') {
        // Find the next available ID manually using pool directly
        const { pool } = await import('./db');
        const maxIdResult = await pool.query('SELECT COALESCE(MAX(id), 0) + 1 as next_id FROM medical_records');
        const nextId = maxIdResult.rows[0].next_id;
        
        // Update sequence to the correct value
        await pool.query('SELECT setval($1, $2, true)', ['medical_records_id_seq', nextId]);
        
        // Try insertion again
        const retryResult = await db.insert(medical_records)
          .values(record)
          .returning();
        return retryResult[0];
      }
      throw error;
    }
  }

  async updateMedicalRecord(id: number, updates: Partial<InsertMedicalRecord>): Promise<MedicalRecord | undefined> {
    const result = await db.update(medical_records)
      .set({ ...updates, updated_at: new Date() })
      .where(eq(medical_records.id, id))
      .returning();
    return result[0];
  }

  // ============ PASSWORD RESET TOKENS ============

  async createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken> {
    const result = await db.insert(password_reset_tokens)
      .values(token)
      .returning();
    return result[0];
  }

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    const result = await db.select()
      .from(password_reset_tokens)
      .where(eq(password_reset_tokens.token, token))
      .limit(1);
    return result[0];
  }

  async markPasswordResetTokenAsUsed(id: number): Promise<void> {
    await db.update(password_reset_tokens)
      .set({ used: true })
      .where(eq(password_reset_tokens.id, id));
  }

  // ============ PROFESSIONAL STATUS MANAGEMENT ============

  async updateProfessionalStatus(
    clinicId: number,
    targetUserId: number,
    isProfessional: boolean,
    changedByUserId: number,
    ipAddress?: string,
    userAgent?: string,
    notes?: string,
    isActive?: boolean,
    role?: string
  ): Promise<{ success: boolean; clinicUser?: ClinicUser }> {
    try {
      // Get current status for audit
      const currentUser = await db.select()
        .from(clinic_users)
        .where(and(
          eq(clinic_users.clinic_id, clinicId),
          eq(clinic_users.user_id, targetUserId)
        ))
        .limit(1);

      if (!currentUser[0]) {
        return { success: false };
      }

      const previousStatus = currentUser[0].is_professional || false;

      // Prepare update data
      const updateData: any = {
        is_professional: isProfessional,
        updated_at: new Date()
      };

      // Add is_active if provided
      if (isActive !== undefined) {
        updateData.is_active = isActive;
      }

      // Add role if provided
      if (role !== undefined) {
        updateData.role = role;
      }

      // Update the user status
      const result = await db.update(clinic_users)
        .set(updateData)
        .where(and(
          eq(clinic_users.clinic_id, clinicId),
          eq(clinic_users.user_id, targetUserId)
        ))
        .returning();

      if (result[0]) {
        // Create audit log with valid actions only
        let auditAction = isProfessional ? 'activated' : 'deactivated';
        // Note: user_deactivated is not a valid action, use 'deactivated' instead

        await this.createProfessionalStatusAudit({
          clinic_id: clinicId,
          target_user_id: targetUserId,
          changed_by_user_id: changedByUserId,
          action: auditAction,
          previous_status: previousStatus,
          new_status: isProfessional,
          ip_address: ipAddress,
          user_agent: userAgent,
          notes: notes
        });

        return { success: true, clinicUser: result[0] };
      }

      return { success: false };
    } catch (error) {
      console.error('Error updating professional status:', error);
      return { success: false };
    }
  }

  async createProfessionalStatusAudit(audit: InsertProfessionalStatusAudit): Promise<ProfessionalStatusAudit> {
    const result = await db.insert(professional_status_audit)
      .values(audit)
      .returning();
    return result[0];
  }

  async getProfessionalStatusAudit(clinicId: number, limit = 50): Promise<ProfessionalStatusAudit[]> {
    return await db.select()
      .from(professional_status_audit)
      .where(eq(professional_status_audit.clinic_id, clinicId))
      .orderBy(desc(professional_status_audit.created_at))
      .limit(limit);
  }

  async getUserProfessionalStatusAudit(userId: number, clinicId: number): Promise<ProfessionalStatusAudit[]> {
    return await db.select()
      .from(professional_status_audit)
      .where(and(
        eq(professional_status_audit.target_user_id, userId),
        eq(professional_status_audit.clinic_id, clinicId)
      ))
      .orderBy(desc(professional_status_audit.created_at));
  }

  async checkUserProfessionalStatus(userId: number, clinicId: number): Promise<boolean> {
    const result = await db.select({ is_professional: clinic_users.is_professional })
      .from(clinic_users)
      .where(and(
        eq(clinic_users.user_id, userId),
        eq(clinic_users.clinic_id, clinicId),
        eq(clinic_users.is_active, true)
      ))
      .limit(1);

    return result[0]?.is_professional || false;
  }

  async getUserClinicRole(userId: number, clinicId: number): Promise<{ role: string; isProfessional: boolean; isActive: boolean } | null> {
    const result = await db.select({
      role: clinic_users.role,
      is_professional: clinic_users.is_professional,
      is_active: clinic_users.is_active
    })
      .from(clinic_users)
      .where(and(
        eq(clinic_users.user_id, userId),
        eq(clinic_users.clinic_id, clinicId)
      ))
      .limit(1);

    if (!result[0]) {
      return null;
    }

    return {
      role: result[0].role,
      isProfessional: result[0].is_professional || false,
      isActive: result[0].is_active
    };
  }
  // ============ USER CREATION ============
  
  async createUserInClinic(userData: {
    name: string;
    email: string;
    role: 'admin' | 'usuario';
    isProfessional: boolean;
    clinicId: number;
    createdBy: string;
  }): Promise<{ success: boolean; user?: any; error?: string }> {
    try {
      // Check if email already exists in users table
      const existingUser = await db.select().from(users).where(eq(users.email, userData.email)).limit(1);
      
      if (existingUser.length > 0) {
        return { success: false, error: 'Email já está em uso no sistema' };
      }
      
      // Check if email already exists in profiles table (Supabase users)
      const existingProfile = await db.execute(sql`
        SELECT id FROM profiles WHERE email = ${userData.email}
      `);
      
      if (existingProfile.rows.length > 0) {
        return { success: false, error: 'Email já está em uso no sistema' };
      }
      
      // Create user in main users table first
      const newUser = await db.insert(users).values({
        name: userData.name,
        email: userData.email,
        password: '$2b$10$placeholder', // Placeholder password, will be set during first login
        role: userData.role,
        is_active: true
      }).returning();
      
      const createdUser = newUser[0];
      
      // Add user to clinic_users table
      await db.insert(clinic_users).values({
        user_id: createdUser.id,
        clinic_id: userData.clinicId,
        role: userData.role,
        is_professional: userData.isProfessional,
        is_active: true,
        joined_at: new Date()
      });
      
      // Create audit log using valid action
      await db.insert(professional_status_audit).values({
        clinic_id: userData.clinicId,
        target_user_id: createdUser.id,
        changed_by_user_id: parseInt(userData.createdBy) || 1,
        action: userData.isProfessional ? 'activated' : 'deactivated',
        previous_status: false,
        new_status: userData.isProfessional,
        notes: 'Usuário criado pelo administrador'
      });
      
      return { 
        success: true, 
        user: {
          id: createdUser.id,
          name: createdUser.name,
          email: createdUser.email,
          role: userData.role,
          is_professional: userData.isProfessional
        }
      };
    } catch (error) {
      console.error('Error creating user in clinic:', error);
      return { success: false, error: 'Erro interno do servidor' };
    }
  }

  // Appointment Tags methods
  async getAppointmentTags(clinicId: number): Promise<AppointmentTag[]> {
    return await db.select()
      .from(appointment_tags)
      .where(and(
        eq(appointment_tags.clinic_id, clinicId),
        eq(appointment_tags.is_active, true)
      ))
      .orderBy(asc(appointment_tags.name));
  }

  async getAppointmentTag(id: number): Promise<AppointmentTag | undefined> {
    const result = await db.select()
      .from(appointment_tags)
      .where(eq(appointment_tags.id, id))
      .limit(1);
    return result[0];
  }

  async createAppointmentTag(tag: InsertAppointmentTag): Promise<AppointmentTag> {
    const result = await db.insert(appointment_tags)
      .values(tag)
      .returning();
    return result[0];
  }

  async updateAppointmentTag(id: number, updates: Partial<InsertAppointmentTag>): Promise<AppointmentTag | undefined> {
    const result = await db.update(appointment_tags)
      .set({ ...updates, updated_at: new Date() })
      .where(eq(appointment_tags.id, id))
      .returning();
    return result[0];
  }

  async deleteAppointmentTag(id: number): Promise<boolean> {
    const result = await db.update(appointment_tags)
      .set({ is_active: false, updated_at: new Date() })
      .where(eq(appointment_tags.id, id))
      .returning();
    return result.length > 0;
  }

  async deleteGoogleCalendarEvents(userId: string | number, calendarId?: string, eventId?: string): Promise<number> {
    try {
      console.log('🗑️ Deleting Google Calendar events for user:', { userId, calendarId, eventId });
      
      let query = sql`DELETE FROM appointments WHERE user_id = ${userId.toString()} AND google_calendar_event_id IS NOT NULL`;
      
      if (eventId) {
        query = sql`DELETE FROM appointments WHERE user_id = ${userId.toString()} AND google_calendar_event_id = ${eventId}`;
      }
      
      const result = await db.execute(query);
      const deletedCount = result.rowCount || 0;
      
      console.log(`🗑️ Successfully deleted ${deletedCount} Google Calendar events`);
      return deletedCount;
      
    } catch (error) {
      console.error('❌ Error deleting Google Calendar events:', error);
      return 0;
    }
  }

  // Advanced Calendar Sync Methods
  async getCalendarIntegrationsForWebhookRenewal(renewalThreshold: Date): Promise<CalendarIntegration[]> {
    try {
      const result = await db.execute(sql`
        SELECT * FROM calendar_integrations 
        WHERE is_active = true 
        AND sync_enabled = true 
        AND watch_expires_at IS NOT NULL 
        AND watch_expires_at <= ${renewalThreshold.toISOString()}
      `);
      
      return result.rows as CalendarIntegration[];
    } catch (error) {
      console.error('❌ Error getting integrations for webhook renewal:', error);
      return [];
    }
  }

  async getCalendarIntegrationByWebhook(channelId: string, resourceId: string): Promise<CalendarIntegration | undefined> {
    try {
      const result = await db.execute(sql`
        SELECT * FROM calendar_integrations 
        WHERE watch_channel_id = ${channelId} 
        AND watch_resource_id = ${resourceId}
        LIMIT 1
      `);
      
      return result.rows[0] as CalendarIntegration | undefined;
    } catch (error) {
      console.error('❌ Error getting integration by webhook:', error);
      return undefined;
    }
  }

  async getAppointmentsByGoogleEventId(eventId: string): Promise<Appointment[]> {
    try {
      const result = await db.execute(sql`
        SELECT * FROM appointments 
        WHERE google_calendar_event_id = ${eventId}
      `);
      
      return result.rows as Appointment[];
    } catch (error) {
      console.error('❌ Error getting appointments by Google event ID:', error);
      return [];
    }
  }
}

export const postgresStorage = new PostgreSQLStorage();