import { 
  users, clinics, contacts, appointments, analytics_metrics, clinic_settings, ai_templates,
  pipeline_stages, pipeline_opportunities, pipeline_history, pipeline_activities,
  clinic_users, clinic_invitations, calendar_integrations, medical_records, password_reset_tokens,
  appointment_tags,
  type User, type InsertUser,
  type Clinic, type InsertClinic,
  type Contact, type InsertContact,
  type Appointment, type InsertAppointment,
  type AnalyticsMetric, type InsertAnalyticsMetric,
  type ClinicSetting, type InsertClinicSetting,
  type AiTemplate, type InsertAiTemplate,
  type PipelineStage, type InsertPipelineStage,
  type PipelineOpportunity, type InsertPipelineOpportunity,
  type PipelineHistory, type InsertPipelineHistory,
  type PipelineActivity, type InsertPipelineActivity,
  type ClinicUser, type InsertClinicUser,
  type ClinicInvitation, type InsertClinicInvitation,
  type CalendarIntegration, type InsertCalendarIntegration,
  type MedicalRecord, type InsertMedicalRecord,
  type PasswordResetToken, type InsertPasswordResetToken,
  type AppointmentTag, type InsertAppointmentTag,
} from "@shared/schema";

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User | undefined>;

  // Clinic Users & Access Control
  getUserClinics(userId: number): Promise<(ClinicUser & { clinic: Clinic })[]>;
  getClinicUsers(clinicId: number): Promise<(ClinicUser & { user: User })[]>;
  addUserToClinic(clinicUser: InsertClinicUser): Promise<ClinicUser>;
  updateClinicUserRole(clinicId: number, userId: number, role: string, permissions?: any): Promise<ClinicUser | undefined>;
  removeUserFromClinic(clinicId: number, userId: number): Promise<boolean>;
  userHasClinicAccess(userId: number, clinicId: number): Promise<boolean>;

  // Clinic Invitations
  createClinicInvitation(invitation: InsertClinicInvitation): Promise<ClinicInvitation>;
  getClinicInvitation(token: string): Promise<ClinicInvitation | undefined>;
  acceptClinicInvitation(token: string, userId: number): Promise<ClinicUser | undefined>;
  getClinicInvitations(clinicId: number): Promise<ClinicInvitation[]>;

  // Clinics
  getClinic(id: number): Promise<Clinic | undefined>;
  createClinic(clinic: InsertClinic): Promise<Clinic>;
  updateClinic(id: number, clinic: Partial<InsertClinic>): Promise<Clinic | undefined>;

  // Contacts
  getContacts(clinicId: number, filters?: { status?: string; search?: string }): Promise<Contact[]>;
  getContact(id: number): Promise<Contact | undefined>;
  createContact(contact: InsertContact): Promise<Contact>;
  updateContact(id: number, contact: Partial<InsertContact>): Promise<Contact | undefined>;
  updateContactStatus(id: number, status: string): Promise<Contact | undefined>;

  // Appointments
  getAppointments(clinicId: number, filters?: { status?: string; date?: Date }): Promise<Appointment[]>;
  getAppointment(id: number): Promise<Appointment | undefined>;
  createAppointment(appointment: InsertAppointment): Promise<Appointment>;
  updateAppointment(id: number, appointment: Partial<InsertAppointment>): Promise<Appointment | undefined>;
  deleteAppointment(id: number): Promise<boolean>;
  getAppointmentsByContact(contactId: number): Promise<Appointment[]>;
  getAppointmentsByDateRange(startDate: Date, endDate: Date): Promise<Appointment[]>;

  // Analytics
  createAnalyticsMetric(metric: InsertAnalyticsMetric): Promise<AnalyticsMetric>;
  getAnalyticsMetrics(clinicId: number, metricType?: string, dateRange?: { start: Date; end: Date }): Promise<AnalyticsMetric[]>;

  // Settings
  getClinicSettings(clinicId: number): Promise<ClinicSetting[]>;
  getClinicSetting(clinicId: number, key: string): Promise<ClinicSetting | undefined>;
  setClinicSetting(setting: InsertClinicSetting): Promise<ClinicSetting>;

  // AI Templates
  getAiTemplates(clinicId: number, templateType?: string): Promise<AiTemplate[]>;
  getAiTemplate(id: number): Promise<AiTemplate | undefined>;
  createAiTemplate(template: InsertAiTemplate): Promise<AiTemplate>;
  updateAiTemplate(id: number, template: Partial<InsertAiTemplate>): Promise<AiTemplate | undefined>;

  // Pipeline Stages
  getPipelineStages(clinicId: number): Promise<PipelineStage[]>;
  getPipelineStage(id: number): Promise<PipelineStage | undefined>;
  createPipelineStage(stage: InsertPipelineStage): Promise<PipelineStage>;
  updatePipelineStage(id: number, stage: Partial<InsertPipelineStage>): Promise<PipelineStage | undefined>;
  deletePipelineStage(id: number): Promise<boolean>;

  // Pipeline Opportunities
  getPipelineOpportunities(clinicId: number, filters?: { stageId?: number; status?: string; assignedTo?: string }): Promise<PipelineOpportunity[]>;
  getPipelineOpportunity(id: number): Promise<PipelineOpportunity | undefined>;
  createPipelineOpportunity(opportunity: InsertPipelineOpportunity): Promise<PipelineOpportunity>;
  updatePipelineOpportunity(id: number, opportunity: Partial<InsertPipelineOpportunity>): Promise<PipelineOpportunity | undefined>;
  moveOpportunityToStage(opportunityId: number, newStageId: number, changedBy?: string, notes?: string): Promise<PipelineOpportunity | undefined>;

  // Pipeline History
  getPipelineHistory(opportunityId: number): Promise<PipelineHistory[]>;
  createPipelineHistory(history: InsertPipelineHistory): Promise<PipelineHistory>;

  // Pipeline Activities
  getPipelineActivities(opportunityId: number): Promise<PipelineActivity[]>;
  createPipelineActivity(activity: InsertPipelineActivity): Promise<PipelineActivity>;
  updatePipelineActivity(id: number, activity: Partial<InsertPipelineActivity>): Promise<PipelineActivity | undefined>;
  completePipelineActivity(id: number, outcome?: string): Promise<PipelineActivity | undefined>;



  // Calendar Integrations
  getCalendarIntegrations(userId: number): Promise<CalendarIntegration[]>;
  getCalendarIntegrationsForClinic(clinicId: number): Promise<CalendarIntegration[]>;
  getAllCalendarIntegrations(): Promise<CalendarIntegration[]>;
  getCalendarIntegrationsByEmail(userEmail: string): Promise<CalendarIntegration[]>;
  getCalendarIntegration(id: number): Promise<CalendarIntegration | undefined>;
  getCalendarIntegrationByUserAndProvider(userId: number, provider: string, email: string): Promise<CalendarIntegration | undefined>;
  createCalendarIntegration(integration: InsertCalendarIntegration): Promise<CalendarIntegration>;
  updateCalendarIntegration(id: number, updates: Partial<InsertCalendarIntegration>): Promise<CalendarIntegration | undefined>;
  deleteCalendarIntegration(id: number): Promise<boolean>;
  deleteGoogleCalendarEvents(userId: string | number, calendarId?: string, eventId?: string): Promise<number>;
  
  // Advanced Calendar Sync Methods
  getCalendarIntegrationsForWebhookRenewal(renewalThreshold: Date): Promise<CalendarIntegration[]>;
  getCalendarIntegrationByWebhook(channelId: string, resourceId: string): Promise<CalendarIntegration | undefined>;
  getAppointmentsByGoogleEventId(eventId: string): Promise<Appointment[]>;

  // User Management
  createUserInClinic(userData: {
    name: string;
    email: string;
    role: 'admin' | 'usuario';
    isProfessional: boolean;
    clinicId: number;
    createdBy: string;
  }): Promise<{ success: boolean; user?: any; error?: string }>;

  // Medical Records
  getMedicalRecords(contactId: number): Promise<MedicalRecord[]>;
  getMedicalRecord(id: number): Promise<MedicalRecord | undefined>;
  getMedicalRecordByAppointment(appointmentId: number): Promise<MedicalRecord | undefined>;
  createMedicalRecord(record: InsertMedicalRecord): Promise<MedicalRecord>;

  updateMedicalRecord(id: number, updates: Partial<InsertMedicalRecord>): Promise<MedicalRecord | undefined>;

  // Password Reset Tokens
  createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  markPasswordResetTokenAsUsed(id: number): Promise<void>;

  // Appointment Tags
  getAppointmentTags(clinicId: number): Promise<AppointmentTag[]>;
  getAppointmentTag(id: number): Promise<AppointmentTag | undefined>;
  createAppointmentTag(tag: InsertAppointmentTag): Promise<AppointmentTag>;
  updateAppointmentTag(id: number, updates: Partial<InsertAppointmentTag>): Promise<AppointmentTag | undefined>;
  deleteAppointmentTag(id: number): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private clinics: Map<number, Clinic>;
  private contacts: Map<number, Contact>;
  private appointments: Map<number, Appointment>;
  private analyticsMetrics: Map<number, AnalyticsMetric>;
  private clinicSettings: Map<string, ClinicSetting>; // key: `${clinicId}-${settingKey}`
  private aiTemplates: Map<number, AiTemplate>;
  private pipelineStages: Map<number, PipelineStage>;
  private pipelineOpportunities: Map<number, PipelineOpportunity>;
  private pipelineHistory: Map<number, PipelineHistory>;
  private pipelineActivities: Map<number, PipelineActivity>;
  private clinicUsers: Map<number, ClinicUser>;
  private clinicInvitations: Map<number, ClinicInvitation>;
  private passwordResetTokens: Map<number, PasswordResetToken>;
  private currentId: number;

  constructor() {
    this.users = new Map();
    this.clinics = new Map();
    this.contacts = new Map();
    this.appointments = new Map();
    this.analyticsMetrics = new Map();
    this.clinicSettings = new Map();
    this.aiTemplates = new Map();
    this.pipelineStages = new Map();
    this.pipelineOpportunities = new Map();
    this.pipelineHistory = new Map();
    this.pipelineActivities = new Map();
    this.clinicUsers = new Map();
    this.clinicInvitations = new Map();
    this.passwordResetTokens = new Map();
    this.currentId = 1;
  }

  // Users
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentId++;
    const user: User = { 
      ...insertUser, 
      id,
      created_at: new Date(),
      updated_at: new Date()
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: number, updates: Partial<InsertUser>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser: User = { 
      ...user, 
      ...updates, 
      updated_at: new Date() 
    };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  // Clinic Users & Access Control
  async getUserClinics(userId: number): Promise<(ClinicUser & { clinic: Clinic })[]> {
    const result: (ClinicUser & { clinic: Clinic })[] = [];
    for (const clinicUser of this.clinicUsers.values()) {
      if (clinicUser.user_id === userId && clinicUser.is_active) {
        const clinic = this.clinics.get(clinicUser.clinic_id);
        if (clinic) {
          result.push({ ...clinicUser, clinic });
        }
      }
    }
    return result;
  }

  async addUserToClinic(clinicUser: InsertClinicUser): Promise<ClinicUser> {
    const id = this.currentId++;
    const newClinicUser: ClinicUser = {
      ...clinicUser,
      id,
      created_at: new Date()
    };
    this.clinicUsers.set(id, newClinicUser);
    return newClinicUser;
  }

  async updateClinicUserRole(clinicId: number, userId: number, role: string, permissions?: any): Promise<ClinicUser | undefined> {
    for (const [id, clinicUser] of this.clinicUsers.entries()) {
      if (clinicUser.clinic_id === clinicId && clinicUser.user_id === userId) {
        const updatedClinicUser: ClinicUser = {
          ...clinicUser,
          role,
          permissions
        };
        this.clinicUsers.set(id, updatedClinicUser);
        return updatedClinicUser;
      }
    }
    return undefined;
  }

  async removeUserFromClinic(clinicId: number, userId: number): Promise<boolean> {
    for (const [id, clinicUser] of this.clinicUsers.entries()) {
      if (clinicUser.clinic_id === clinicId && clinicUser.user_id === userId) {
        this.clinicUsers.delete(id);
        return true;
      }
    }
    return false;
  }

  async userHasClinicAccess(userId: number, clinicId: number): Promise<boolean> {
    for (const clinicUser of this.clinicUsers.values()) {
      if (clinicUser.user_id === userId && clinicUser.clinic_id === clinicId && clinicUser.is_active) {
        return true;
      }
    }
    return false;
  }

  async getClinicUsers(clinicId: number): Promise<(ClinicUser & { user: User })[]> {
    const result: (ClinicUser & { user: User })[] = [];
    for (const clinicUser of this.clinicUsers.values()) {
      if (clinicUser.clinic_id === clinicId && clinicUser.is_active) {
        const user = this.users.get(clinicUser.user_id);
        if (user) {
          result.push({
            ...clinicUser,
            user
          });
        }
      }
    }
    return result;
  }

  // Clinic Invitations
  async createClinicInvitation(invitation: InsertClinicInvitation): Promise<ClinicInvitation> {
    const id = this.currentId++;
    const newInvitation: ClinicInvitation = {
      ...invitation,
      id,
      created_at: new Date()
    };
    this.clinicInvitations.set(id, newInvitation);
    return newInvitation;
  }

  async getClinicInvitation(token: string): Promise<ClinicInvitation | undefined> {
    for (const invitation of this.clinicInvitations.values()) {
      if (invitation.token === token) {
        return invitation;
      }
    }
    return undefined;
  }

  async acceptClinicInvitation(token: string, userId: number): Promise<ClinicUser | undefined> {
    const invitation = await this.getClinicInvitation(token);
    if (!invitation || invitation.accepted_at || invitation.expires_at < new Date()) {
      return undefined;
    }

    // Mark invitation as accepted
    const updatedInvitation: ClinicInvitation = {
      ...invitation,
      accepted_at: new Date()
    };
    this.clinicInvitations.set(invitation.id, updatedInvitation);

    // Add user to clinic
    return await this.addUserToClinic({
      clinic_id: invitation.clinic_id,
      user_id: userId,
      role: invitation.role,
      permissions: invitation.permissions,
      invited_by: invitation.invited_by,
      invited_at: invitation.created_at,
      joined_at: new Date(),
      is_active: true
    });
  }

  async getClinicInvitations(clinicId: number): Promise<ClinicInvitation[]> {
    const result: ClinicInvitation[] = [];
    for (const invitation of this.clinicInvitations.values()) {
      if (invitation.clinic_id === clinicId) {
        result.push(invitation);
      }
    }
    return result;
  }

  // Clinics
  async getClinic(id: number): Promise<Clinic | undefined> {
    return this.clinics.get(id);
  }

  async createClinic(insertClinic: InsertClinic): Promise<Clinic> {
    const id = this.currentId++;
    const clinic: Clinic = { 
      id,
      name: insertClinic.name,
      responsible: insertClinic.responsible,
      whatsapp_number: insertClinic.whatsapp_number,
      specialties: insertClinic.specialties ?? null,
      working_hours: insertClinic.working_hours || null,
      created_at: new Date()
    };
    this.clinics.set(id, clinic);
    return clinic;
  }

  async updateClinic(id: number, updates: Partial<InsertClinic>): Promise<Clinic | undefined> {
    const clinic = this.clinics.get(id);
    if (!clinic) return undefined;
    
    const updatedClinic = { ...clinic, ...updates };
    this.clinics.set(id, updatedClinic);
    return updatedClinic;
  }

  // Contacts
  async getContacts(clinicId: number, filters?: { status?: string; search?: string }): Promise<Contact[]> {
    const allContacts = Array.from(this.contacts.values())
      .filter(contact => contact.clinic_id === clinicId);

    let filteredContacts = allContacts;

    if (filters?.status) {
      filteredContacts = filteredContacts.filter(contact => contact.status === filters.status);
    }

    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      filteredContacts = filteredContacts.filter(contact => 
        contact.name.toLowerCase().includes(searchLower) ||
        contact.phone.includes(filters.search!)
      );
    }

    return filteredContacts.sort((a, b) => 
      new Date(b.last_interaction!).getTime() - new Date(a.last_interaction!).getTime()
    );
  }

  async getContact(id: number): Promise<Contact | undefined> {
    return this.contacts.get(id);
  }

  async createContact(insertContact: InsertContact): Promise<Contact> {
    const id = this.currentId++;
    const now = new Date();
    const contact: Contact = { 
      id,
      clinic_id: insertContact.clinic_id ?? null,
      name: insertContact.name,
      phone: insertContact.phone,
      email: insertContact.email || null,
      age: insertContact.age || null,
      gender: insertContact.gender || null,
      profession: insertContact.profession || null,
      address: insertContact.address || null,
      emergency_contact: insertContact.emergency_contact || null,
      medical_history: insertContact.medical_history || null,
      current_medications: insertContact.current_medications || null,
      allergies: insertContact.allergies || null,
      status: insertContact.status,
      priority: insertContact.priority || null,
      source: insertContact.source || null,
      notes: insertContact.notes || null,
      first_contact: now,
      last_interaction: now
    };
    this.contacts.set(id, contact);
    return contact;
  }

  async updateContact(id: number, updates: Partial<InsertContact>): Promise<Contact | undefined> {
    const contact = this.contacts.get(id);
    if (!contact) return undefined;
    
    const updatedContact = { 
      ...contact, 
      ...updates,
      last_interaction: new Date()
    };
    this.contacts.set(id, updatedContact);
    return updatedContact;
  }

  async updateContactStatus(id: number, status: string): Promise<Contact | undefined> {
    return this.updateContact(id, { status });
  }

  // Appointments
  async getAppointments(clinicId: number, filters?: { status?: string; date?: Date }): Promise<Appointment[]> {
    const allAppointments = Array.from(this.appointments.values())
      .filter(appointment => appointment.clinic_id === clinicId);

    let filteredAppointments = allAppointments;

    if (filters?.status) {
      filteredAppointments = filteredAppointments.filter(appointment => appointment.status === filters.status);
    }

    if (filters?.date) {
      const targetDate = filters.date;
      filteredAppointments = filteredAppointments.filter(appointment => {
        if (!appointment.scheduled_date) return false;
        const appointmentDate = new Date(appointment.scheduled_date);
        return appointmentDate.toDateString() === targetDate.toDateString();
      });
    }

    return filteredAppointments.sort((a, b) => {
      if (!a.scheduled_date || !b.scheduled_date) return 0;
      return new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime();
    });
  }

  async getAppointment(id: number): Promise<Appointment | undefined> {
    return this.appointments.get(id);
  }

  async createAppointment(insertAppointment: InsertAppointment): Promise<Appointment> {
    const id = this.currentId++;
    const now = new Date();
    const appointment: Appointment = { 
      id,
      contact_id: insertAppointment.contact_id ?? null,
      clinic_id: insertAppointment.clinic_id ?? null,
      doctor_name: insertAppointment.doctor_name || null,
      specialty: insertAppointment.specialty || null,
      appointment_type: insertAppointment.appointment_type || null,
      scheduled_date: insertAppointment.scheduled_date || null,
      duration_minutes: insertAppointment.duration_minutes || null,
      status: insertAppointment.status,
      cancellation_reason: insertAppointment.cancellation_reason || null,
      session_notes: insertAppointment.session_notes || null,
      next_appointment_suggested: insertAppointment.next_appointment_suggested || null,
      payment_status: insertAppointment.payment_status || null,
      payment_amount: insertAppointment.payment_amount || null,
      created_at: now,
      updated_at: now
    };
    this.appointments.set(id, appointment);
    return appointment;
  }

  async updateAppointment(id: number, updates: Partial<InsertAppointment>): Promise<Appointment | undefined> {
    const appointment = this.appointments.get(id);
    if (!appointment) return undefined;
    
    const updatedAppointment = { 
      ...appointment, 
      ...updates,
      updated_at: new Date()
    };
    this.appointments.set(id, updatedAppointment);
    return updatedAppointment;
  }

  async deleteAppointment(id: number): Promise<boolean> {
    const exists = this.appointments.has(id);
    if (exists) {
      this.appointments.delete(id);
    }
    return exists;
  }

  async getAppointmentsByContact(contactId: number): Promise<Appointment[]> {
    return Array.from(this.appointments.values())
      .filter(appointment => appointment.contact_id === contactId)
      .sort((a, b) => {
        if (!a.scheduled_date || !b.scheduled_date) return 0;
        return new Date(b.scheduled_date).getTime() - new Date(a.scheduled_date).getTime();
      });
  }

  // Analytics
  async createAnalyticsMetric(insertMetric: InsertAnalyticsMetric): Promise<AnalyticsMetric> {
    const id = this.currentId++;
    const metric: AnalyticsMetric = { 
      id,
      clinic_id: insertMetric.clinic_id ?? null,
      metric_type: insertMetric.metric_type,
      value: insertMetric.value,
      date: insertMetric.date,
      metadata: insertMetric.metadata || null,
      created_at: new Date()
    };
    this.analyticsMetrics.set(id, metric);
    return metric;
  }

  async getAnalyticsMetrics(
    clinicId: number, 
    metricType?: string, 
    dateRange?: { start: Date; end: Date }
  ): Promise<AnalyticsMetric[]> {
    let metrics = Array.from(this.analyticsMetrics.values())
      .filter(metric => metric.clinic_id === clinicId);

    if (metricType) {
      metrics = metrics.filter(metric => metric.metric_type === metricType);
    }

    if (dateRange) {
      metrics = metrics.filter(metric => {
        const metricDate = new Date(metric.date);
        return metricDate >= dateRange.start && metricDate <= dateRange.end;
      });
    }

    return metrics.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  // Settings
  async getClinicSettings(clinicId: number): Promise<ClinicSetting[]> {
    return Array.from(this.clinicSettings.values())
      .filter(setting => setting.clinic_id === clinicId);
  }

  async getClinicSetting(clinicId: number, key: string): Promise<ClinicSetting | undefined> {
    return this.clinicSettings.get(`${clinicId}-${key}`);
  }

  async setClinicSetting(insertSetting: InsertClinicSetting): Promise<ClinicSetting> {
    const id = this.currentId++;
    const key = `${insertSetting.clinic_id}-${insertSetting.setting_key}`;
    
    const setting: ClinicSetting = { 
      id,
      clinic_id: insertSetting.clinic_id ?? null,
      setting_key: insertSetting.setting_key,
      setting_value: insertSetting.setting_value,
      setting_type: insertSetting.setting_type,
      description: insertSetting.description || null,
      updated_at: new Date()
    };
    
    this.clinicSettings.set(key, setting);
    return setting;
  }

  // AI Templates
  async getAiTemplates(clinicId: number, templateType?: string): Promise<AiTemplate[]> {
    let templates = Array.from(this.aiTemplates.values())
      .filter(template => template.clinic_id === clinicId && template.is_active);

    if (templateType) {
      templates = templates.filter(template => template.template_type === templateType);
    }

    return templates.sort((a, b) => a.template_name.localeCompare(b.template_name));
  }

  async getAiTemplate(id: number): Promise<AiTemplate | undefined> {
    return this.aiTemplates.get(id);
  }

  async createAiTemplate(insertTemplate: InsertAiTemplate): Promise<AiTemplate> {
    const id = this.currentId++;
    const now = new Date();
    const template: AiTemplate = { 
      id,
      clinic_id: insertTemplate.clinic_id ?? null,
      template_name: insertTemplate.template_name,
      template_type: insertTemplate.template_type,
      content: insertTemplate.content,
      variables: insertTemplate.variables || null,
      is_active: insertTemplate.is_active || null,
      created_at: now,
      updated_at: now
    };
    this.aiTemplates.set(id, template);
    return template;
  }

  async updateAiTemplate(id: number, updates: Partial<InsertAiTemplate>): Promise<AiTemplate | undefined> {
    const template = this.aiTemplates.get(id);
    if (!template) return undefined;
    
    const updatedTemplate = { 
      ...template, 
      ...updates,
      updated_at: new Date()
    };
    this.aiTemplates.set(id, updatedTemplate);
    return updatedTemplate;
  }

  // ============ PIPELINE STAGES ============
  
  async getPipelineStages(clinicId: number): Promise<PipelineStage[]> {
    return Array.from(this.pipelineStages.values())
      .filter(stage => stage.clinic_id === clinicId && stage.is_active)
      .sort((a, b) => a.order_position - b.order_position);
  }

  async getPipelineStage(id: number): Promise<PipelineStage | undefined> {
    return this.pipelineStages.get(id);
  }

  async createPipelineStage(insertStage: InsertPipelineStage): Promise<PipelineStage> {
    const id = this.currentId++;
    const now = new Date();
    const stage: PipelineStage = {
      id,
      clinic_id: insertStage.clinic_id ?? null,
      name: insertStage.name,
      description: insertStage.description || null,
      order_position: insertStage.order_position,
      color: insertStage.color || null,
      is_active: insertStage.is_active ?? null,
      target_days: insertStage.target_days || null,
      created_at: now,
      updated_at: now
    };
    this.pipelineStages.set(id, stage);
    return stage;
  }

  async updatePipelineStage(id: number, updates: Partial<InsertPipelineStage>): Promise<PipelineStage | undefined> {
    const stage = this.pipelineStages.get(id);
    if (!stage) return undefined;
    
    const updatedStage = { 
      ...stage, 
      ...updates,
      updated_at: new Date()
    };
    this.pipelineStages.set(id, updatedStage);
    return updatedStage;
  }

  async deletePipelineStage(id: number): Promise<boolean> {
    return this.pipelineStages.delete(id);
  }

  // ============ PIPELINE OPPORTUNITIES ============
  
  async getPipelineOpportunities(clinicId: number, filters?: { stageId?: number; status?: string; assignedTo?: string }): Promise<PipelineOpportunity[]> {
    let opportunities = Array.from(this.pipelineOpportunities.values())
      .filter(opp => opp.clinic_id === clinicId);

    if (filters?.stageId) {
      opportunities = opportunities.filter(opp => opp.stage_id === filters.stageId);
    }

    if (filters?.status) {
      opportunities = opportunities.filter(opp => opp.status === filters.status);
    }

    if (filters?.assignedTo) {
      opportunities = opportunities.filter(opp => opp.assigned_to === filters.assignedTo);
    }

    return opportunities.sort((a, b) => 
      new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime()
    );
  }

  async getPipelineOpportunity(id: number): Promise<PipelineOpportunity | undefined> {
    return this.pipelineOpportunities.get(id);
  }

  async createPipelineOpportunity(insertOpportunity: InsertPipelineOpportunity): Promise<PipelineOpportunity> {
    const id = this.currentId++;
    const now = new Date();
    const opportunity: PipelineOpportunity = {
      id,
      clinic_id: insertOpportunity.clinic_id ?? null,
      contact_id: insertOpportunity.contact_id ?? null,
      stage_id: insertOpportunity.stage_id ?? null,
      title: insertOpportunity.title,
      description: insertOpportunity.description || null,
      value: insertOpportunity.value || null,
      probability: insertOpportunity.probability || null,
      expected_close_date: insertOpportunity.expected_close_date || null,
      actual_close_date: insertOpportunity.actual_close_date || null,
      status: insertOpportunity.status || "active",
      lost_reason: insertOpportunity.lost_reason || null,
      source: insertOpportunity.source || null,
      assigned_to: insertOpportunity.assigned_to || null,
      tags: insertOpportunity.tags || null,
      priority: insertOpportunity.priority || null,
      next_action: insertOpportunity.next_action || null,
      next_action_date: insertOpportunity.next_action_date || null,
      stage_entered_at: now,
      created_at: now,
      updated_at: now
    };
    this.pipelineOpportunities.set(id, opportunity);
    return opportunity;
  }

  async updatePipelineOpportunity(id: number, updates: Partial<InsertPipelineOpportunity>): Promise<PipelineOpportunity | undefined> {
    const opportunity = this.pipelineOpportunities.get(id);
    if (!opportunity) return undefined;
    
    const updatedOpportunity = { 
      ...opportunity, 
      ...updates,
      updated_at: new Date()
    };
    this.pipelineOpportunities.set(id, updatedOpportunity);
    return updatedOpportunity;
  }

  async moveOpportunityToStage(opportunityId: number, newStageId: number, changedBy?: string, notes?: string): Promise<PipelineOpportunity | undefined> {
    const opportunity = this.pipelineOpportunities.get(opportunityId);
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
    const updatedOpportunity = {
      ...opportunity,
      stage_id: newStageId,
      stage_entered_at: now,
      updated_at: now
    };
    
    this.pipelineOpportunities.set(opportunityId, updatedOpportunity);
    return updatedOpportunity;
  }

  // ============ PIPELINE HISTORY ============
  
  async getPipelineHistory(opportunityId: number): Promise<PipelineHistory[]> {
    return Array.from(this.pipelineHistory.values())
      .filter(history => history.opportunity_id === opportunityId)
      .sort((a, b) => new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime());
  }

  async createPipelineHistory(insertHistory: InsertPipelineHistory): Promise<PipelineHistory> {
    const id = this.currentId++;
    const history: PipelineHistory = {
      id,
      opportunity_id: insertHistory.opportunity_id ?? null,
      from_stage_id: insertHistory.from_stage_id ?? null,
      to_stage_id: insertHistory.to_stage_id ?? null,
      changed_by: insertHistory.changed_by || null,
      notes: insertHistory.notes || null,
      duration_in_stage: insertHistory.duration_in_stage || null,
      created_at: new Date()
    };
    this.pipelineHistory.set(id, history);
    return history;
  }

  // ============ PIPELINE ACTIVITIES ============
  
  async getPipelineActivities(opportunityId: number): Promise<PipelineActivity[]> {
    return Array.from(this.pipelineActivities.values())
      .filter(activity => activity.opportunity_id === opportunityId)
      .sort((a, b) => new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime());
  }

  async createPipelineActivity(insertActivity: InsertPipelineActivity): Promise<PipelineActivity> {
    const id = this.currentId++;
    const now = new Date();
    const activity: PipelineActivity = {
      id,
      opportunity_id: insertActivity.opportunity_id ?? null,
      activity_type: insertActivity.activity_type,
      title: insertActivity.title,
      description: insertActivity.description || null,
      scheduled_date: insertActivity.scheduled_date || null,
      completed_date: insertActivity.completed_date || null,
      status: insertActivity.status || "pending",
      outcome: insertActivity.outcome || null,
      next_activity_suggested: insertActivity.next_activity_suggested || null,
      created_by: insertActivity.created_by || null,
      created_at: now,
      updated_at: now
    };
    this.pipelineActivities.set(id, activity);
    return activity;
  }

  async updatePipelineActivity(id: number, updates: Partial<InsertPipelineActivity>): Promise<PipelineActivity | undefined> {
    const activity = this.pipelineActivities.get(id);
    if (!activity) return undefined;
    
    const updatedActivity = { 
      ...activity, 
      ...updates,
      updated_at: new Date()
    };
    this.pipelineActivities.set(id, updatedActivity);
    return updatedActivity;
  }

  async completePipelineActivity(id: number, outcome?: string): Promise<PipelineActivity | undefined> {
    return this.updatePipelineActivity(id, {
      status: "completed",
      completed_date: new Date(),
      outcome: outcome
    });
  }

  // Medical Records (stub implementations for MemStorage)
  async getMedicalRecords(contactId: number): Promise<MedicalRecord[]> {
    return [];
  }

  async getMedicalRecord(id: number): Promise<MedicalRecord | undefined> {
    return undefined;
  }

  async getMedicalRecordByAppointment(appointmentId: number): Promise<MedicalRecord | undefined> {
    return undefined;
  }

  async createMedicalRecord(record: InsertMedicalRecord): Promise<MedicalRecord> {
    const id = this.currentId++;
    const newRecord: MedicalRecord = {
      id,
      ...record,
      created_at: new Date(),
      updated_at: new Date(),
    };
    return newRecord;
  }

  async updateMedicalRecord(id: number, updates: Partial<InsertMedicalRecord>): Promise<MedicalRecord | undefined> {
    return undefined;
  }

  // Password Reset Tokens
  async createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken> {
    const id = this.currentId++;
    const newToken: PasswordResetToken = {
      id,
      ...token,
      created_at: new Date(),
    };
    this.passwordResetTokens.set(id, newToken);
    return newToken;
  }

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    return Array.from(this.passwordResetTokens.values()).find(
      (resetToken) => resetToken.token === token
    );
  }

  async markPasswordResetTokenAsUsed(id: number): Promise<void> {
    const token = this.passwordResetTokens.get(id);
    if (token) {
      this.passwordResetTokens.set(id, { ...token, used: true });
    }
  }



  async getCalendarIntegrations(userId: number): Promise<CalendarIntegration[]> {
    return [];
  }

  async getCalendarIntegrationsForClinic(clinicId: number): Promise<CalendarIntegration[]> {
    return [];
  }

  async getCalendarIntegrationsByEmail(userEmail: string): Promise<CalendarIntegration[]> {
    return [];
  }
  
  async getCalendarIntegration(id: number): Promise<CalendarIntegration | undefined> {
    return undefined;
  }
  
  async getCalendarIntegrationByUserAndProvider(userId: number, provider: string, email: string): Promise<CalendarIntegration | undefined> {
    return undefined;
  }
  
  async createCalendarIntegration(integration: InsertCalendarIntegration): Promise<CalendarIntegration> {
    throw new Error("MemStorage does not support calendar integrations");
  }
  
  async updateCalendarIntegration(id: number, updates: Partial<InsertCalendarIntegration>): Promise<CalendarIntegration | undefined> {
    return undefined;
  }
  
  async deleteCalendarIntegration(id: number): Promise<boolean> {
    return false;
  }

  async deleteGoogleCalendarEvents(userId: string | number, calendarId?: string): Promise<number> {
    return 0;
  }
}

import { postgresStorage } from "./postgres-storage";
import { testConnection } from "./db";

// Use PostgreSQL in production, MemStorage for development
let storage: IStorage | undefined;

async function initializeStorage() {
  if (storage) return storage; // Already initialized
  
  try {
    // Force PostgreSQL/Supabase usage - no fallback to memory
    const { postgresStorage } = await import('./postgres-storage');
    console.log("💾 Using PostgreSQL storage (forced)");
    storage = postgresStorage;
    
    // Test connection but don't fail if it's just a temporary issue
    try {
      await postgresStorage.testConnection();
      console.log("✅ PostgreSQL connection verified");
    } catch (connectionError) {
      console.warn("⚠️ PostgreSQL connection test failed, but continuing:", connectionError.message);
    }
  } catch (error) {
    console.error("❌ Failed to initialize PostgreSQL storage:", error);
    throw new Error("PostgreSQL storage initialization failed - no fallback allowed");
  }
  
  return storage;
}

async function getStorage(): Promise<IStorage> {
  if (!storage) {
    await initializeStorage();
  }
  if (!storage) {
    throw new Error('Failed to initialize storage');
  }
  return storage;
}

// Initialize PostgreSQL with sample data if tables are empty
async function initializePostgreSQLData() {
  try {
    // Check if we already have data
    const existingClinics = await postgresStorage.getClinic(1);
    if (existingClinics) {
      console.log("✅ PostgreSQL already has data");
      return;
    }

    console.log("📝 Initializing PostgreSQL with sample data...");
    
    // Create sample clinic
    const clinic = await postgresStorage.createClinic({
      name: "Centro de Psicologia Dr. Amanda Costa",
      responsible: "Dra. Amanda Costa",
      whatsapp_number: "(11) 99876-5432",
      specialties: ["Psicologia Clínica", "TDAH em Adultos", "TDAH Infantil", "Terapia Cognitivo-Comportamental"],
      working_hours: "Seg-Sex: 9h-19h | Sáb: 9h-13h"
    });

    // Create sample contacts
    const contacts = await Promise.all([
      postgresStorage.createContact({
        clinic_id: clinic.id,
        name: "Lucas Ferreira",
        phone: "(11) 99123-4567",
        status: "agendado",
        age: 28,
        profession: "Analista de Sistemas"
      }),
      postgresStorage.createContact({
        clinic_id: clinic.id,
        name: "Carla Mendes",
        phone: "(11) 98765-4321",
        status: "em_conversa",
        age: 35,
        profession: "Professora"
      }),
      postgresStorage.createContact({
        clinic_id: clinic.id,
        name: "Pedro Oliveira",
        phone: "(11) 97654-3210",
        status: "pos_atendimento",
        age: 42,
        profession: "Engenheiro"
      }),
      postgresStorage.createContact({
        clinic_id: clinic.id,
        name: "Sofia Almeida",
        phone: "(11) 96543-2109",
        status: "novo",
        age: 22,
        profession: "Estudante"
      })
    ]);

    // Create sample appointment
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(15, 0, 0, 0);

    await postgresStorage.createAppointment({
      contact_id: contacts[0].id,
      clinic_id: clinic.id,
      doctor_name: "Dra. Amanda Costa",
      specialty: "Psicologia Clínica",
      appointment_type: "primeira_consulta",
      scheduled_date: tomorrow,
      status: "agendado",
      duration_minutes: 60,
      payment_status: "pendente",
      payment_amount: 15000
    });

    // Create initial settings
    await Promise.all([
      postgresStorage.setClinicSetting({
        clinic_id: clinic.id,
        setting_key: "ai_enabled",
        setting_value: "true",
        setting_type: "boolean",
        description: "Habilitar assistente de IA"
      }),
      postgresStorage.setClinicSetting({
        clinic_id: clinic.id,
        setting_key: "session_duration",
        setting_value: "60",
        setting_type: "number",
        description: "Duração padrão da sessão em minutos"
      })
    ]);

    // Create AI templates
    await Promise.all([
      postgresStorage.createAiTemplate({
        clinic_id: clinic.id,
        template_name: "Boas-vindas",
        template_type: "greeting",
        content: "Olá {{nome}}! Sou a assistente virtual da {{clinica}}. Como posso ajudá-lo hoje?",
        variables: ["nome", "clinica"],
        is_active: true
      }),
      postgresStorage.createAiTemplate({
        clinic_id: clinic.id,
        template_name: "Confirmação de Agendamento",
        template_type: "appointment_confirmation",
        content: "Perfeito, {{nome}}! Agendei sua consulta com {{doutor}} para {{data}} às {{hora}}. Você receberá uma confirmação em breve.",
        variables: ["nome", "doutor", "data", "hora"],
        is_active: true
      })
    ]);

    // Create sample analytics metrics
    const today = new Date();
    const metrics = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);

      metrics.push(
        postgresStorage.createAnalyticsMetric({
          clinic_id: clinic.id,
          metric_type: "daily_messages",
          value: Math.floor(Math.random() * 100) + 50,
          date: date,
          metadata: JSON.stringify({ source: "whatsapp" })
        }),
        postgresStorage.createAnalyticsMetric({
          clinic_id: clinic.id,
          metric_type: "daily_appointments",
          value: Math.floor(Math.random() * 15) + 5,
          date: date
        }),
        postgresStorage.createAnalyticsMetric({
          clinic_id: clinic.id,
          metric_type: "conversion_rate",
          value: Math.floor(Math.random() * 30) + 60,
          date: date
        })
      );
    }

    await Promise.all(metrics);

    // Create pipeline stages
    const stages = await Promise.all([
      postgresStorage.createPipelineStage({
        clinic_id: clinic.id,
        name: "Lead",
        description: "Primeiro contato interessado",
        order_position: 1,
        color: "#3B82F6",
        is_active: true,
        target_days: 3
      }),
      postgresStorage.createPipelineStage({
        clinic_id: clinic.id,
        name: "Qualificação",
        description: "Avaliação de necessidades",
        order_position: 2,
        color: "#F59E0B",
        is_active: true,
        target_days: 5
      }),
      postgresStorage.createPipelineStage({
        clinic_id: clinic.id,
        name: "Proposta",
        description: "Apresentação de plano de tratamento",
        order_position: 3,
        color: "#8B5CF6",
        is_active: true,
        target_days: 7
      }),
      postgresStorage.createPipelineStage({
        clinic_id: clinic.id,
        name: "Negociação",
        description: "Discussão de valores e agenda",
        order_position: 4,
        color: "#EC4899",
        is_active: true,
        target_days: 3
      }),
      postgresStorage.createPipelineStage({
        clinic_id: clinic.id,
        name: "Fechamento",
        description: "Agendamento confirmado",
        order_position: 5,
        color: "#10B981",
        is_active: true,
        target_days: 2
      })
    ]);

    // Create pipeline opportunities
    const opportunities = await Promise.all([
      postgresStorage.createPipelineOpportunity({
        clinic_id: clinic.id,
        contact_id: contacts[0].id,
        stage_id: stages[2].id,
        title: "Tratamento TDAH - Lucas Ferreira",
        description: "Jovem profissional buscando tratamento para TDAH",
        value: 2400.00,
        probability: 75,
        expected_close_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: "active",
        source: "whatsapp",
        assigned_to: "Dra. Amanda Costa",
        priority: "alta",
        next_action: "Enviar proposta de tratamento",
        next_action_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
      }),
      postgresStorage.createPipelineOpportunity({
        clinic_id: clinic.id,
        contact_id: contacts[1].id,
        stage_id: stages[1].id,
        title: "Terapia Familiar - Carla Mendes",
        description: "Professora interessada em terapia para filhos",
        value: 1800.00,
        probability: 60,
        expected_close_date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        status: "active",
        source: "indicacao",
        assigned_to: "Dra. Amanda Costa",
        priority: "media",
        next_action: "Agendar consulta de avaliação",
        next_action_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
      }),
      postgresStorage.createPipelineOpportunity({
        clinic_id: clinic.id,
        contact_id: contacts[2].id,
        stage_id: stages[4].id,
        title: "Acompanhamento Psicológico - Pedro Oliveira",
        description: "Retorno após alta para acompanhamento",
        value: 1200.00,
        probability: 90,
        expected_close_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        status: "active",
        source: "retorno",
        assigned_to: "Dra. Amanda Costa",
        priority: "baixa",
        next_action: "Confirmar disponibilidade de horários",
        next_action_date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000)
      })
    ]);

    // Create pipeline activities
    await Promise.all([
      postgresStorage.createPipelineActivity({
        opportunity_id: opportunities[0].id,
        activity_type: "call",
        title: "Ligação inicial de qualificação",
        description: "Conversa para entender necessidades específicas de tratamento TDAH",
        scheduled_date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
        status: "pending",
        created_by: "Dra. Amanda Costa"
      }),
      postgresStorage.createPipelineActivity({
        opportunity_id: opportunities[1].id,
        activity_type: "meeting",
        title: "Reunião de apresentação",
        description: "Apresentar metodologia de terapia familiar",
        scheduled_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        status: "pending",
        created_by: "Dra. Amanda Costa"
      }),
      postgresStorage.createPipelineActivity({
        opportunity_id: opportunities[2].id,
        activity_type: "email",
        title: "Envio de proposta de retorno",
        description: "Enviar opcões de horários para acompanhamento",
        scheduled_date: new Date(),
        completed_date: new Date(Date.now() - 2 * 60 * 60 * 1000),
        status: "completed",
        outcome: "Proposta enviada com sucesso",
        created_by: "Dra. Amanda Costa"
      })
    ]);

    console.log("✅ PostgreSQL sample data initialized successfully");
  } catch (error) {
    console.error("❌ Error initializing PostgreSQL data:", error);
  }
}

export { storage, getStorage };

// Initialize with sample data for in-memory storage only
async function initializeSampleData() {
  try {
    // Create admin user
    const adminUser = await storage.createUser({
      name: "Administrador",
      email: "admin@teste.com",
      password: "$2b$10$GgXKO626wv8pBBqW10JGfO4VZBvfWauvTpEBawvwKua8suxAwap6i", // Password: 123456
      role: "admin",
      is_active: true
    });

    // Create sample clinic
    const clinic = await storage.createClinic({
      name: "Centro de Psicologia Dr. Amanda Costa",
      responsible: "Dra. Amanda Costa",
      whatsapp_number: "(11) 99876-5432",
      specialties: ["Psicologia Clínica", "TDAH em Adultos", "TDAH Infantil", "Terapia Cognitivo-Comportamental"],
      working_hours: "Seg-Sex: 9h-19h | Sáb: 9h-13h"
    });

    // Associate admin user with clinic
    await storage.addUserToClinic({
      user_id: adminUser.id,
      clinic_id: clinic.id,
      role: "admin",
      is_active: true,
      permissions: {},
      invited_by: null
    });

    // Create sample contacts
    console.log("Creating contacts for clinic ID:", clinic.id);
    
    const contact1 = await storage.createContact({
      clinic_id: clinic.id,
      name: "Lucas Ferreira",
      phone: "(11) 99123-4567",
      status: "agendado",
      age: 28,
      profession: "Analista de Sistemas"
    });
    console.log("Created contact 1:", contact1);

    const contact2 = await storage.createContact({
      clinic_id: clinic.id,
      name: "Carla Mendes",
      phone: "(11) 98765-4321",
      status: "em_conversa",
      age: 35,
      profession: "Professora"
    });
    console.log("Created contact 2:", contact2);

    const contact3 = await storage.createContact({
      clinic_id: clinic.id,
      name: "Pedro Oliveira",
      phone: "(11) 97654-3210",
      status: "pos_atendimento",
      age: 42,
      profession: "Engenheiro"
    });
    console.log("Created contact 3:", contact3);

    const contact4 = await storage.createContact({
      clinic_id: clinic.id,
      name: "Sofia Almeida",
      phone: "(11) 96543-2109",
      status: "novo",
      age: 22,
      profession: "Estudante"
    });
    console.log("Created contact 4:", contact4);
    
    // Test retrieval immediately
    const allContacts = await storage.getContacts(clinic.id);
    console.log("All contacts for clinic", clinic.id, ":", allContacts);

    console.log("In-memory storage initialized successfully");
  } catch (error) {
    console.error("Error initializing in-memory storage:", error);
  }
}

// Initialize additional sample data for analytics (in-memory only)
async function initializeAnalyticsData() {
  try {
    const today = new Date();
    const clinicId = 1;

    // Create sample analytics metrics for the last 7 days
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);

      // Daily messages metrics
      await storage.createAnalyticsMetric({
        clinic_id: clinicId,
        metric_type: "daily_messages",
        value: Math.floor(Math.random() * 100) + 50,
        date: date,
        metadata: JSON.stringify({ source: "whatsapp" })
      });

      // Daily appointments metrics
      await storage.createAnalyticsMetric({
        clinic_id: clinicId,
        metric_type: "daily_appointments",
        value: Math.floor(Math.random() * 15) + 5,
        date: date
      });

      // Conversion rate metrics
      await storage.createAnalyticsMetric({
        clinic_id: clinicId,
        metric_type: "conversion_rate",
        value: Math.floor(Math.random() * 30) + 60, // 60-90%
        date: date
      });
    }

    console.log("In-memory analytics data initialized successfully");
  } catch (error) {
    console.error("Error initializing in-memory analytics:", error);
  }
}
