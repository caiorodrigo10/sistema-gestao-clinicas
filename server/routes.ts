import type { Express } from "express";
import { createServer, type Server } from "http";
// Storage will be imported dynamically to ensure initialization
import { setupAuth, isAuthenticated, hasClinicAccess } from "./auth";
import { flexibleAuth, supabaseAuth } from "./supabase-auth";
import { nanoid } from "nanoid";
import { 
  insertClinicSchema, insertContactSchema, insertAppointmentSchema,
  insertAnalyticsMetricSchema, insertClinicSettingSchema, insertAiTemplateSchema,
  insertPipelineStageSchema, insertPipelineOpportunitySchema, insertPipelineActivitySchema,
  insertClinicInvitationSchema, insertMedicalRecordSchema
} from "@shared/schema";
import {
  initGoogleCalendarAuth,
  handleGoogleCalendarCallback,
  getUserCalendarIntegrations,
  updateCalendarSyncPreferences,
  deleteCalendarIntegration,
  syncAppointmentToCalendar,
  removeAppointmentFromCalendar,
  getUserCalendars,
  updateLinkedCalendarSettings
} from "./calendar-routes";
import { googleCalendarService } from "./google-calendar-service";

export async function registerRoutes(app: Express): Promise<Server> {
  // Import storage dynamically to ensure initialization is complete
  const { getStorage } = await import('./storage');
  const storage = await getStorage();
  
  // ============ AUTHENTICATION ============
  
  // Setup traditional email/password auth (legacy)
  setupAuth(app, storage);
  
  // Supabase auth routes are handled by frontend

  // Get user's accessible clinics
  app.get('/api/user/clinics', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const userClinics = await storage.getUserClinics(userId);
      res.json(userClinics);
    } catch (error) {
      console.error("Error fetching user clinics:", error);
      res.status(500).json({ error: "Failed to fetch clinics" });
    }
  });

  // Invite user to clinic
  app.post('/api/clinics/:clinicId/invitations', isAuthenticated, hasClinicAccess(), async (req: any, res) => {
    try {
      const clinicId = parseInt(req.params.clinicId);
      const inviterId = req.user.dbUser.id;
      
      const validatedData = insertClinicInvitationSchema.parse({
        ...req.body,
        clinic_id: clinicId,
        invited_by: inviterId,
        token: nanoid(32),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      });

      const invitation = await storage.createClinicInvitation(validatedData);
      res.status(201).json(invitation);
    } catch (error) {
      console.error("Error creating invitation:", error);
      res.status(500).json({ error: "Failed to create invitation" });
    }
  });

  // Accept clinic invitation
  app.post('/api/invitations/:token/accept', isAuthenticated, async (req: any, res) => {
    try {
      const token = req.params.token;
      const userId = req.user.dbUser.id;
      
      const clinicUser = await storage.acceptClinicInvitation(token, userId);
      if (!clinicUser) {
        return res.status(400).json({ error: "Invalid or expired invitation" });
      }
      
      res.json(clinicUser);
    } catch (error) {
      console.error("Error accepting invitation:", error);
      res.status(500).json({ error: "Failed to accept invitation" });
    }
  });
  
  // ============ CLINICS ============
  
  // Get clinic by ID
  app.get("/api/clinics/:id", async (req, res) => {
    try {
      const clinicId = parseInt(req.params.id);
      if (isNaN(clinicId)) {
        return res.status(400).json({ error: "Invalid clinic ID" });
      }
      
      const clinic = await storage.getClinic(clinicId);
      if (!clinic) {
        return res.status(404).json({ error: "Clinic not found" });
      }
      
      res.json(clinic);
    } catch (error) {
      console.error("Error fetching clinic:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Create clinic
  app.post("/api/clinics", async (req, res) => {
    try {
      const validatedData = insertClinicSchema.parse(req.body);
      const clinic = await storage.createClinic(validatedData);
      res.status(201).json(clinic);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error creating clinic:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update clinic
  app.put("/api/clinics/:id", async (req, res) => {
    try {
      const clinicId = parseInt(req.params.id);
      if (isNaN(clinicId)) {
        return res.status(400).json({ error: "Invalid clinic ID" });
      }
      
      const validatedData = insertClinicSchema.partial().parse(req.body);
      const clinic = await storage.updateClinic(clinicId, validatedData);
      
      if (!clinic) {
        return res.status(404).json({ error: "Clinic not found" });
      }
      
      res.json(clinic);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error updating clinic:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get clinic users
  app.get("/api/clinic/:id/users", async (req, res) => {
    try {
      const clinicId = parseInt(req.params.id);
      if (isNaN(clinicId)) {
        return res.status(400).json({ error: "Invalid clinic ID" });
      }
      
      const clinicUsers = await storage.getClinicUsers(clinicId);
      res.json(clinicUsers);
    } catch (error) {
      console.error("Error fetching clinic users:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get clinic configuration
  app.get("/api/clinic/:id/config", async (req, res) => {
    try {
      const clinicId = parseInt(req.params.id);
      if (isNaN(clinicId)) {
        return res.status(400).json({ error: "Invalid clinic ID" });
      }
      
      const clinic = await storage.getClinic(clinicId);
      if (!clinic) {
        return res.status(404).json({ error: "Clinic not found" });
      }
      
      res.json(clinic);
    } catch (error) {
      console.error("Error fetching clinic configuration:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update clinic configuration
  app.put("/api/clinic/:id/config", async (req, res) => {
    try {
      const clinicId = parseInt(req.params.id);
      if (isNaN(clinicId)) {
        return res.status(400).json({ error: "Invalid clinic ID" });
      }
      
      const validatedData = insertClinicSchema.partial().parse(req.body);
      const clinic = await storage.updateClinic(clinicId, validatedData);
      
      if (!clinic) {
        return res.status(404).json({ error: "Clinic not found" });
      }
      
      res.json(clinic);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error updating clinic configuration:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ============ CONTACTS ============
  
  // Get contacts with filters
  app.get("/api/contacts", async (req, res) => {
    try {
      const { clinic_id, status, search } = req.query;
      
      if (!clinic_id) {
        return res.status(400).json({ error: "clinic_id is required" });
      }
      
      const clinicId = parseInt(clinic_id as string);
      if (isNaN(clinicId)) {
        return res.status(400).json({ error: "Invalid clinic ID" });
      }
      
      const filters: any = {};
      if (status) filters.status = status as string;
      if (search) filters.search = search as string;
      
      const contacts = await storage.getContacts(clinicId, filters);
      res.json(contacts);
    } catch (error) {
      console.error("Error fetching contacts:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get contact by ID
  app.get("/api/contacts/:id", async (req, res) => {
    try {
      const contactId = parseInt(req.params.id);
      if (isNaN(contactId)) {
        return res.status(400).json({ error: "Invalid contact ID" });
      }
      
      const contact = await storage.getContact(contactId);
      if (!contact) {
        return res.status(404).json({ error: "Contact not found" });
      }
      
      res.json(contact);
    } catch (error) {
      console.error("Error fetching contact:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Create contact
  app.post("/api/contacts", async (req, res) => {
    try {
      console.log('🚀 POST /api/contacts - Starting contact creation');
      console.log('📥 Raw request body:', req.body);
      
      console.log('🔍 Validating data with insertContactSchema...');
      const validatedData = insertContactSchema.parse(req.body);
      console.log('✅ Data validation successful:', validatedData);
      
      console.log('💾 Calling storage.createContact...');
      const contact = await storage.createContact(validatedData);
      console.log('✅ Contact created successfully in database:', contact);
      
      console.log('📤 Sending 201 response with contact data');
      res.status(201).json(contact);
    } catch (error: any) {
      console.error('❌ Error in POST /api/contacts:', error);
      
      if (error.name === 'ZodError') {
        console.error('📋 Zod validation errors:', error.errors);
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      
      console.error("💥 Database/Server error creating contact:", error);
      console.error("📊 Error stack:", error.stack);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update contact
  app.put("/api/contacts/:id", async (req, res) => {
    try {
      const contactId = parseInt(req.params.id);
      if (isNaN(contactId)) {
        return res.status(400).json({ error: "Invalid contact ID" });
      }
      
      const validatedData = insertContactSchema.partial().parse(req.body);
      const contact = await storage.updateContact(contactId, validatedData);
      
      if (!contact) {
        return res.status(404).json({ error: "Contact not found" });
      }
      
      res.json(contact);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error updating contact:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update contact status
  app.patch("/api/contacts/:id/status", async (req, res) => {
    try {
      const contactId = parseInt(req.params.id);
      if (isNaN(contactId)) {
        return res.status(400).json({ error: "Invalid contact ID" });
      }
      
      const { status } = req.body;
      if (!status || typeof status !== 'string') {
        return res.status(400).json({ error: "Valid status is required" });
      }
      
      const contact = await storage.updateContactStatus(contactId, status);
      
      if (!contact) {
        return res.status(404).json({ error: "Contact not found" });
      }
      
      res.json(contact);
    } catch (error) {
      console.error("Error updating contact status:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ============ APPOINTMENTS ============
  
  // Simple in-memory cache for Google Calendar events
  const calendarCache = new Map<string, { events: any[], timestamp: number }>();
  const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes
  
  // Get appointments with filters (including Google Calendar events)
  app.get("/api/appointments", async (req, res) => {
    try {
      console.log('🚀 Appointments API called');
      const { clinic_id, status, date } = req.query;
      
      if (!clinic_id) {
        return res.status(400).json({ error: "clinic_id is required" });
      }
      
      const clinicId = parseInt(clinic_id as string);
      if (isNaN(clinicId)) {
        return res.status(400).json({ error: "Invalid clinic ID" });
      }
      
      const filters: any = {};
      if (status) filters.status = status as string;
      if (date) filters.date = new Date(date as string);
      
      // Get appointments from database
      const appointments = await storage.getAppointments(clinicId, filters);
      console.log('📊 DB appointments found:', appointments.length);
      
      // Try to get Google Calendar events if user has integrations
      let allAppointments = [...appointments];
      
      try {
        // Get calendar integrations for this clinic
        const integrations = await storage.getCalendarIntegrationsForClinic(clinicId);
        console.log('📅 Calendar integrations found:', integrations.length);
        
        if (integrations.length > 0) {
          const { googleCalendarService } = await import('./google-calendar-service');
          
          // Process all integrations in parallel for better performance
          const calendarPromises = integrations.map(async (integration) => {
            if (integration.is_active && integration.sync_enabled && integration.calendar_id) {
              try {
                // Get date range for events - optimize to only fetch 7 days instead of 30
                const timeMin = filters.date 
                  ? new Date(filters.date.getFullYear(), filters.date.getMonth(), filters.date.getDate()).toISOString()
                  : new Date().toISOString();
                const timeMax = filters.date
                  ? new Date(filters.date.getFullYear(), filters.date.getMonth(), filters.date.getDate() + 1).toISOString()
                  : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
                
                // Create cache key for this integration and date range
                const cacheKey = `${integration.id}_${timeMin}_${timeMax}`;
                const now = Date.now();
                
                // Check cache first
                const cached = calendarCache.get(cacheKey);
                let events;
                
                if (cached && (now - cached.timestamp) < CACHE_DURATION) {
                  events = cached.events;
                  console.log('📊 Using cached Google Calendar events:', events.length);
                } else {
                  // Set credentials
                  googleCalendarService.setCredentials(
                    integration.access_token!,
                    integration.refresh_token || undefined,
                    integration.token_expires_at ? new Date(integration.token_expires_at).getTime() : undefined
                  );
                  
                  events = await googleCalendarService.listEvents(
                    integration.calendar_id,
                    timeMin,
                    timeMax
                  );
                  
                  // Cache the results
                  calendarCache.set(cacheKey, { events, timestamp: now });
                  console.log('📊 Fetched and cached Google Calendar events:', events.length);
                }
                
                console.log('📅 Google Calendar events found:', events.length);
                
                // Convert Google Calendar events to appointment format
                for (const event of events) {
                  if (event.start?.dateTime && event.summary) {
                    const startDate = new Date(event.start.dateTime);
                    const endDate = new Date(event.end?.dateTime || event.start.dateTime);
                    const durationMinutes = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60));
                    
                    // Check if this event is already in our database
                    const existsInDb = appointments.some(apt => apt.google_calendar_event_id === event.id);
                    
                    if (!existsInDb) {
                      allAppointments.push({
                        id: `gc_${event.id}`, // Prefix to distinguish from DB appointments
                        contact_id: null,
                        user_id: integration.user_id,
                        clinic_id: clinicId,
                        doctor_name: event.summary,
                        specialty: 'Evento do Google Calendar',
                        appointment_type: 'google_calendar',
                        scheduled_date: startDate,
                        duration_minutes: durationMinutes,
                        status: 'scheduled',
                        payment_status: 'pending',
                        payment_amount: 0,
                        session_notes: event.description || null,
                        created_at: new Date(),
                        updated_at: new Date(),
                        google_calendar_event_id: event.id,
                        is_google_calendar_event: true
                      } as any);
                    }
                  }
                }
              } catch (calError: any) {
                console.warn(`Google Calendar integration ${integration.id} failed:`, calError.message || 'Unknown error');
                
                // If token is expired/invalid, disable the integration
                if (calError.code === 401 || calError.status === 401 || 
                    (calError.message && calError.message.includes('authentication credentials'))) {
                  try {
                    await storage.updateCalendarIntegration(integration.id, {
                      sync_enabled: false,
                      sync_errors: 'Token expired - re-authentication required'
                    });
                    console.warn(`Disabled integration ${integration.id} due to authentication failure`);
                  } catch (updateError) {
                    console.error('Failed to update integration status:', updateError);
                  }
                }
              }
            }
            return null; // Return null for failed integrations
          });

          // Wait for all calendar integrations to complete in parallel
          await Promise.allSettled(calendarPromises);
        }
      } catch (integrationError) {
        console.warn('Error fetching calendar integrations:', integrationError);
      }
      
      console.log('📊 Total appointments (DB + Google):', allAppointments.length);
      res.json(allAppointments);
    } catch (error) {
      console.error('Error fetching appointments:', error);
      res.status(500).json({ error: 'Failed to fetch appointments' });
    }
  });

  // Get appointment by ID
  app.get("/api/appointments/:id", async (req, res) => {
    try {
      const appointmentId = parseInt(req.params.id);
      if (isNaN(appointmentId)) {
        return res.status(400).json({ error: "Invalid appointment ID" });
      }
      
      const appointment = await storage.getAppointment(appointmentId);
      if (!appointment) {
        return res.status(404).json({ error: "Appointment not found" });
      }
      
      res.json(appointment);
    } catch (error) {
      console.error("Error fetching appointment:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get appointments by contact
  app.get("/api/contacts/:contactId/appointments", async (req, res) => {
    try {
      const contactId = parseInt(req.params.contactId);
      if (isNaN(contactId)) {
        return res.status(400).json({ error: "Invalid contact ID" });
      }
      
      const appointments = await storage.getAppointmentsByContact(contactId);
      res.json(appointments);
    } catch (error) {
      console.error("Error fetching appointments by contact:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Create appointment
  app.post("/api/appointments", async (req, res) => {
    try {
      // Convert scheduled_date string to Date object if it's a string
      const requestData = {
        ...req.body,
        scheduled_date: typeof req.body.scheduled_date === 'string' 
          ? new Date(req.body.scheduled_date) 
          : req.body.scheduled_date
      };
      
      const validatedData = insertAppointmentSchema.parse(requestData);
      const appointment = await storage.createAppointment(validatedData);

      // Sync with Google Calendar if user has active integration
      try {
        const { syncAppointmentToGoogleCalendar } = await import('./calendar-routes');
        await syncAppointmentToGoogleCalendar(appointment);
      } catch (syncError) {
        console.error("Error syncing appointment to Google Calendar:", syncError);
        // Don't fail the appointment creation if sync fails
      }

      res.status(201).json(appointment);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error creating appointment:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update appointment
  app.put("/api/appointments/:id", async (req, res) => {
    try {
      const appointmentId = parseInt(req.params.id);
      if (isNaN(appointmentId)) {
        return res.status(400).json({ error: "Invalid appointment ID" });
      }
      
      const validatedData = insertAppointmentSchema.partial().parse(req.body);
      const appointment = await storage.updateAppointment(appointmentId, validatedData);
      
      if (!appointment) {
        return res.status(404).json({ error: "Appointment not found" });
      }
      
      res.json(appointment);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error updating appointment:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update appointment status (PATCH)
  app.patch("/api/appointments/:id", async (req, res) => {
    try {
      const appointmentId = parseInt(req.params.id);
      if (isNaN(appointmentId)) {
        return res.status(400).json({ error: "Invalid appointment ID" });
      }
      
      // Only allow status updates via PATCH
      const { status } = req.body;
      if (!status) {
        return res.status(400).json({ error: "Status is required" });
      }
      
      const validatedData = { status: status.toString() };
      const appointment = await storage.updateAppointment(appointmentId, validatedData);
      
      if (!appointment) {
        return res.status(404).json({ error: "Appointment not found" });
      }
      
      res.json(appointment);
    } catch (error: any) {
      console.error("Error updating appointment status:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Delete appointment
  app.delete("/api/appointments/:id", async (req, res) => {
    try {
      const appointmentId = parseInt(req.params.id);
      if (isNaN(appointmentId)) {
        return res.status(400).json({ error: "Invalid appointment ID" });
      }
      
      // Get appointment before deletion to check if it exists and for Google Calendar sync
      const appointment = await storage.getAppointment(appointmentId);
      if (!appointment) {
        return res.status(404).json({ error: "Appointment not found" });
      }

      // Remove from Google Calendar if synced
      if (appointment.google_calendar_event_id) {
        try {
          const { removeAppointmentFromCalendar } = await import('./calendar-routes');
          await removeAppointmentFromCalendar(appointmentId, appointment.user_id);
        } catch (syncError) {
          console.error("Error removing appointment from Google Calendar:", syncError);
          // Continue with deletion even if Google Calendar sync fails
        }
      }
      
      const success = await storage.deleteAppointment(appointmentId);
      
      if (!success) {
        return res.status(404).json({ error: "Appointment not found" });
      }
      
      res.json({ success: true, message: "Appointment deleted successfully" });
    } catch (error) {
      console.error("Error deleting appointment:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ============ ANALYTICS ============
  
  // Get analytics metrics
  app.get("/api/analytics", async (req, res) => {
    try {
      const { clinic_id, metric_type, start_date, end_date } = req.query;
      
      if (!clinic_id) {
        return res.status(400).json({ error: "clinic_id is required" });
      }
      
      const clinicId = parseInt(clinic_id as string);
      if (isNaN(clinicId)) {
        return res.status(400).json({ error: "Invalid clinic ID" });
      }
      
      let dateRange: { start: Date; end: Date } | undefined;
      if (start_date && end_date) {
        dateRange = {
          start: new Date(start_date as string),
          end: new Date(end_date as string)
        };
      }
      
      const metrics = await storage.getAnalyticsMetrics(
        clinicId, 
        metric_type as string, 
        dateRange
      );
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching analytics:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Create analytics metric
  app.post("/api/analytics", async (req, res) => {
    try {
      const validatedData = insertAnalyticsMetricSchema.parse(req.body);
      const metric = await storage.createAnalyticsMetric(validatedData);
      res.status(201).json(metric);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error creating analytics metric:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ============ SETTINGS ============
  
  // Get clinic settings
  app.get("/api/clinics/:clinicId/settings", async (req, res) => {
    try {
      const clinicId = parseInt(req.params.clinicId);
      if (isNaN(clinicId)) {
        return res.status(400).json({ error: "Invalid clinic ID" });
      }
      
      const settings = await storage.getClinicSettings(clinicId);
      res.json(settings);
    } catch (error) {
      console.error("Error fetching clinic settings:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get specific clinic setting
  app.get("/api/clinics/:clinicId/settings/:key", async (req, res) => {
    try {
      const clinicId = parseInt(req.params.clinicId);
      if (isNaN(clinicId)) {
        return res.status(400).json({ error: "Invalid clinic ID" });
      }
      
      const { key } = req.params;
      const setting = await storage.getClinicSetting(clinicId, key);
      
      if (!setting) {
        return res.status(404).json({ error: "Setting not found" });
      }
      
      res.json(setting);
    } catch (error) {
      console.error("Error fetching clinic setting:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Set clinic setting
  app.post("/api/clinics/:clinicId/settings", async (req, res) => {
    try {
      const clinicId = parseInt(req.params.clinicId);
      if (isNaN(clinicId)) {
        return res.status(400).json({ error: "Invalid clinic ID" });
      }
      
      const validatedData = insertClinicSettingSchema.parse({
        ...req.body,
        clinic_id: clinicId
      });
      
      const setting = await storage.setClinicSetting(validatedData);
      res.status(201).json(setting);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error setting clinic setting:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ============ AI TEMPLATES ============
  
  // Get AI templates
  app.get("/api/clinics/:clinicId/ai-templates", async (req, res) => {
    try {
      const clinicId = parseInt(req.params.clinicId);
      if (isNaN(clinicId)) {
        return res.status(400).json({ error: "Invalid clinic ID" });
      }
      
      const { template_type } = req.query;
      const templates = await storage.getAiTemplates(clinicId, template_type as string);
      res.json(templates);
    } catch (error) {
      console.error("Error fetching AI templates:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get AI template by ID
  app.get("/api/ai-templates/:id", async (req, res) => {
    try {
      const templateId = parseInt(req.params.id);
      if (isNaN(templateId)) {
        return res.status(400).json({ error: "Invalid template ID" });
      }
      
      const template = await storage.getAiTemplate(templateId);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      
      res.json(template);
    } catch (error) {
      console.error("Error fetching AI template:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Create AI template
  app.post("/api/clinics/:clinicId/ai-templates", async (req, res) => {
    try {
      const clinicId = parseInt(req.params.clinicId);
      if (isNaN(clinicId)) {
        return res.status(400).json({ error: "Invalid clinic ID" });
      }
      
      const validatedData = insertAiTemplateSchema.parse({
        ...req.body,
        clinic_id: clinicId
      });
      
      const template = await storage.createAiTemplate(validatedData);
      res.status(201).json(template);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error creating AI template:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update AI template
  app.put("/api/ai-templates/:id", async (req, res) => {
    try {
      const templateId = parseInt(req.params.id);
      if (isNaN(templateId)) {
        return res.status(400).json({ error: "Invalid template ID" });
      }
      
      const validatedData = insertAiTemplateSchema.partial().parse(req.body);
      const template = await storage.updateAiTemplate(templateId, validatedData);
      
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      
      res.json(template);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error updating AI template:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ============ PIPELINE STAGES ============
  
  // Get pipeline stages
  app.get("/api/clinics/:clinicId/pipeline-stages", async (req, res) => {
    try {
      const clinicId = parseInt(req.params.clinicId);
      if (isNaN(clinicId)) {
        return res.status(400).json({ error: "Invalid clinic ID" });
      }
      
      const stages = await storage.getPipelineStages(clinicId);
      res.json(stages);
    } catch (error) {
      console.error("Error fetching pipeline stages:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Create pipeline stage
  app.post("/api/clinics/:clinicId/pipeline-stages", async (req, res) => {
    try {
      const clinicId = parseInt(req.params.clinicId);
      if (isNaN(clinicId)) {
        return res.status(400).json({ error: "Invalid clinic ID" });
      }
      
      const validatedData = insertPipelineStageSchema.parse({
        ...req.body,
        clinic_id: clinicId
      });
      
      const stage = await storage.createPipelineStage(validatedData);
      res.status(201).json(stage);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error creating pipeline stage:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update pipeline stage
  app.put("/api/pipeline-stages/:id", async (req, res) => {
    try {
      const stageId = parseInt(req.params.id);
      if (isNaN(stageId)) {
        return res.status(400).json({ error: "Invalid stage ID" });
      }
      
      const validatedData = insertPipelineStageSchema.partial().parse(req.body);
      const stage = await storage.updatePipelineStage(stageId, validatedData);
      
      if (!stage) {
        return res.status(404).json({ error: "Stage not found" });
      }
      
      res.json(stage);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error updating pipeline stage:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Delete pipeline stage
  app.delete("/api/pipeline-stages/:id", async (req, res) => {
    try {
      const stageId = parseInt(req.params.id);
      if (isNaN(stageId)) {
        return res.status(400).json({ error: "Invalid stage ID" });
      }
      
      const success = await storage.deletePipelineStage(stageId);
      
      if (!success) {
        return res.status(404).json({ error: "Stage not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting pipeline stage:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ============ PIPELINE OPPORTUNITIES ============
  
  // Get pipeline opportunities
  app.get("/api/pipeline-opportunities", async (req, res) => {
    try {
      const { clinic_id, stage_id, status, assigned_to } = req.query;
      
      if (!clinic_id) {
        return res.status(400).json({ error: "clinic_id is required" });
      }
      
      const clinicId = parseInt(clinic_id as string);
      if (isNaN(clinicId)) {
        return res.status(400).json({ error: "Invalid clinic ID" });
      }
      
      const filters: any = {};
      if (stage_id) filters.stageId = parseInt(stage_id as string);
      if (status) filters.status = status as string;
      if (assigned_to) filters.assignedTo = assigned_to as string;
      
      const opportunities = await storage.getPipelineOpportunities(clinicId, filters);
      res.json(opportunities);
    } catch (error) {
      console.error("Error fetching pipeline opportunities:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get opportunity by ID
  app.get("/api/pipeline-opportunities/:id", async (req, res) => {
    try {
      const opportunityId = parseInt(req.params.id);
      if (isNaN(opportunityId)) {
        return res.status(400).json({ error: "Invalid opportunity ID" });
      }
      
      const opportunity = await storage.getPipelineOpportunity(opportunityId);
      if (!opportunity) {
        return res.status(404).json({ error: "Opportunity not found" });
      }
      
      res.json(opportunity);
    } catch (error) {
      console.error("Error fetching pipeline opportunity:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Create pipeline opportunity
  app.post("/api/pipeline-opportunities", async (req, res) => {
    try {
      const validatedData = insertPipelineOpportunitySchema.parse(req.body);
      const opportunity = await storage.createPipelineOpportunity(validatedData);
      res.status(201).json(opportunity);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error creating pipeline opportunity:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update pipeline opportunity
  app.put("/api/pipeline-opportunities/:id", async (req, res) => {
    try {
      const opportunityId = parseInt(req.params.id);
      if (isNaN(opportunityId)) {
        return res.status(400).json({ error: "Invalid opportunity ID" });
      }
      
      const validatedData = insertPipelineOpportunitySchema.partial().parse(req.body);
      const opportunity = await storage.updatePipelineOpportunity(opportunityId, validatedData);
      
      if (!opportunity) {
        return res.status(404).json({ error: "Opportunity not found" });
      }
      
      res.json(opportunity);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error updating pipeline opportunity:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Move opportunity to stage
  app.patch("/api/pipeline-opportunities/:id/move", async (req, res) => {
    try {
      const opportunityId = parseInt(req.params.id);
      if (isNaN(opportunityId)) {
        return res.status(400).json({ error: "Invalid opportunity ID" });
      }
      
      const { stage_id, changed_by, notes } = req.body;
      if (!stage_id || isNaN(stage_id)) {
        return res.status(400).json({ error: "Valid stage_id is required" });
      }
      
      const opportunity = await storage.moveOpportunityToStage(
        opportunityId, 
        parseInt(stage_id), 
        changed_by, 
        notes
      );
      
      if (!opportunity) {
        return res.status(404).json({ error: "Opportunity not found" });
      }
      
      res.json(opportunity);
    } catch (error) {
      console.error("Error moving opportunity:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get opportunity history
  app.get("/api/pipeline-opportunities/:id/history", async (req, res) => {
    try {
      const opportunityId = parseInt(req.params.id);
      if (isNaN(opportunityId)) {
        return res.status(400).json({ error: "Invalid opportunity ID" });
      }
      
      const history = await storage.getPipelineHistory(opportunityId);
      res.json(history);
    } catch (error) {
      console.error("Error fetching opportunity history:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ============ PIPELINE ACTIVITIES ============
  
  // Get opportunity activities
  app.get("/api/pipeline-opportunities/:id/activities", async (req, res) => {
    try {
      const opportunityId = parseInt(req.params.id);
      if (isNaN(opportunityId)) {
        return res.status(400).json({ error: "Invalid opportunity ID" });
      }
      
      const activities = await storage.getPipelineActivities(opportunityId);
      res.json(activities);
    } catch (error) {
      console.error("Error fetching pipeline activities:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Create pipeline activity
  app.post("/api/pipeline-activities", async (req, res) => {
    try {
      const validatedData = insertPipelineActivitySchema.parse(req.body);
      const activity = await storage.createPipelineActivity(validatedData);
      res.status(201).json(activity);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error creating pipeline activity:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update pipeline activity
  app.put("/api/pipeline-activities/:id", async (req, res) => {
    try {
      const activityId = parseInt(req.params.id);
      if (isNaN(activityId)) {
        return res.status(400).json({ error: "Invalid activity ID" });
      }
      
      const validatedData = insertPipelineActivitySchema.partial().parse(req.body);
      const activity = await storage.updatePipelineActivity(activityId, validatedData);
      
      if (!activity) {
        return res.status(404).json({ error: "Activity not found" });
      }
      
      res.json(activity);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error updating pipeline activity:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Complete pipeline activity
  app.patch("/api/pipeline-activities/:id/complete", async (req, res) => {
    try {
      const activityId = parseInt(req.params.id);
      if (isNaN(activityId)) {
        return res.status(400).json({ error: "Invalid activity ID" });
      }
      
      const { outcome } = req.body;
      const activity = await storage.completePipelineActivity(activityId, outcome);
      
      if (!activity) {
        return res.status(404).json({ error: "Activity not found" });
      }
      
      res.json(activity);
    } catch (error) {
      console.error("Error completing pipeline activity:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ============ MARA AI INTEGRATION ============
  
  const { MaraAIService } = await import('./mara-ai-service.js');
  const maraService = new MaraAIService(storage);
  
  // Chat com Mara AI sobre um contato específico
  app.post('/api/contacts/:contactId/mara/chat', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const contactId = parseInt(req.params.contactId);
      const { question } = req.body;
      
      console.log('🤖 Mara AI - Request received:', {
        contactId,
        userId: req.user?.id,
        hasQuestion: !!question
      });

      if (!question || question.trim().length === 0) {
        return res.status(400).json({ error: 'Pergunta é obrigatória' });
      }

      // Verificar se o contato existe e pertence ao usuário
      const contact = await storage.getContact(contactId);
      console.log('🔍 Mara AI - Contact found:', {
        contactExists: !!contact,
        contactClinicId: contact?.clinic_id
      });
      
      if (!contact) {
        return res.status(404).json({ error: 'Contato não encontrado' });
      }

      // Verificar permissão do usuário para acessar este contato
      const hasAccess = await storage.userHasClinicAccess(req.user.id, contact.clinic_id);
      
      console.log('🔍 Mara AI - Access check:', {
        userId: req.user.id,
        clinicId: contact.clinic_id,
        hasAccess
      });
      
      if (!hasAccess) {
        console.log('Acesso negado - usuário não tem permissão para esta clínica');
        return res.status(403).json({ error: 'Acesso negado a este contato' });
      }

      // Analisar com Mara AI
      const result = await maraService.analyzeContact(contactId, question, req.user.id);
      
      res.json({
        response: result.response
      });
      
    } catch (error) {
      console.error('Erro no chat com Mara AI:', error);
      res.status(500).json({ 
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });

  // Gerar resumo do paciente com Mara AI
  app.get('/api/contacts/:contactId/mara/summary', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const contactId = parseInt(req.params.contactId);

      // Verificar se o contato existe e pertence ao usuário
      const contact = await storage.getContact(contactId);
      if (!contact) {
        return res.status(404).json({ error: 'Contato não encontrado' });
      }

      // Verificar permissão do usuário para acessar este contato
      const userClinics = await storage.getUserClinics(req.user.id);
      const hasAccess = userClinics.some(clinicUser => clinicUser.clinic.id === contact.clinic_id);
      
      if (!hasAccess) {
        return res.status(403).json({ error: 'Acesso negado a este contato' });
      }

      // Gerar resumo com Mara AI
      const summary = await maraService.generatePatientSummary(contactId);
      
      res.json({ summary });
      
    } catch (error) {
      console.error('Erro ao gerar resumo com Mara AI:', error);
      res.status(500).json({ 
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });



  // ============ USER PROFILE AND PASSWORD RESET ============
  
  // Update user profile
  app.put('/api/user/profile', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { name, email, currentPassword, newPassword } = req.body;
      const userId = req.user.id;

      // Validar dados básicos
      if (!name || !email) {
        return res.status(400).json({ error: 'Nome e email são obrigatórios' });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }

      // Se está alterando senha, validar senha atual
      if (newPassword && newPassword.trim()) {
        if (!currentPassword || !currentPassword.trim()) {
          return res.status(400).json({ error: 'Senha atual é obrigatória para alterar a senha' });
        }

        const bcrypt = require('bcryptjs');
        const isValidPassword = await bcrypt.compare(currentPassword, user.password);
        if (!isValidPassword) {
          return res.status(400).json({ error: 'Senha atual incorreta' });
        }

        // Hash da nova senha
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await storage.updateUser(userId, {
          name,
          email,
          password: hashedPassword,
          updated_at: new Date(),
        });
      } else {
        // Apenas atualizar nome e email (sem alterar senha)
        await storage.updateUser(userId, {
          name,
          email,
          updated_at: new Date(),
        });
      }

      const updatedUser = await storage.getUser(userId);
      res.json({
        message: 'Perfil atualizado com sucesso',
        user: {
          id: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.role,
        }
      });

    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
      res.status(500).json({ 
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });

  // Request password reset
  app.post('/api/auth/request-password-reset', async (req: Request, res: Response) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: 'Email é obrigatório' });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        // Não revelar se o email existe ou não por segurança
        return res.json({ message: 'Se o email estiver registrado, você receberá as instruções' });
      }

      // Gerar token único
      const crypto = require('crypto');
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

      // Salvar token no banco
      await storage.createPasswordResetToken({
        user_id: user.id,
        token,
        expires_at: expiresAt,
        used: false,
      });

      // Em um ambiente real, aqui enviaria o email
      // Por enquanto, vamos apenas retornar o token no console para teste
      console.log(`\n🔑 TOKEN DE RECUPERAÇÃO DE SENHA:`);
      console.log(`Email: ${email}`);
      console.log(`Token: ${token}`);
      console.log(`Expira em: ${expiresAt.toLocaleString('pt-BR')}`);
      console.log(`Link de recuperação: http://localhost:5000/recuperar-senha?token=${token}\n`);

      res.json({ 
        message: 'Se o email estiver registrado, você receberá as instruções',
        // REMOVER EM PRODUÇÃO - apenas para desenvolvimento
        token: process.env.NODE_ENV === 'development' ? token : undefined
      });

    } catch (error) {
      console.error('Erro ao solicitar reset de senha:', error);
      res.status(500).json({ 
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });

  // Reset password with token
  app.post('/api/auth/reset-password', async (req: Request, res: Response) => {
    try {
      const { token, password } = req.body;

      if (!token || !password) {
        return res.status(400).json({ error: 'Token e nova senha são obrigatórios' });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: 'Nova senha deve ter pelo menos 6 caracteres' });
      }

      // Buscar token válido
      const resetToken = await storage.getPasswordResetToken(token);
      if (!resetToken) {
        return res.status(400).json({ error: 'Token inválido ou expirado' });
      }

      if (resetToken.used) {
        return res.status(400).json({ error: 'Token já foi utilizado' });
      }

      if (new Date() > new Date(resetToken.expires_at)) {
        return res.status(400).json({ error: 'Token expirado' });
      }

      // Hash da nova senha
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash(password, 10);

      // Atualizar senha do usuário
      await storage.updateUser(resetToken.user_id, {
        password: hashedPassword,
        updated_at: new Date(),
      });

      // Marcar token como usado
      await storage.markPasswordResetTokenAsUsed(resetToken.id);

      res.json({ message: 'Senha alterada com sucesso' });

    } catch (error) {
      console.error('Erro ao resetar senha:', error);
      res.status(500).json({ 
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });

  // ============ GOOGLE CALENDAR INTEGRATION ============
  
  // Custom auth middleware for calendar routes that works with Supabase
  const calendarAuth = async (req: any, res: any, next: any) => {
    try {
      let accessToken = null;
      
      // Try Authorization header first (Bearer token)
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        accessToken = authHeader.split(' ')[1];
        console.log('🔑 Calendar auth: Using Bearer token from header');
      } else {
        // Fallback to cookies (Supabase session)
        const cookies = req.headers.cookie;
        if (cookies) {
          const accessTokenMatch = cookies.match(/sb-[^=]+-auth-token=([^;]+)/);
          if (accessTokenMatch) {
            try {
              const tokenData = JSON.parse(decodeURIComponent(accessTokenMatch[1]));
              accessToken = tokenData.access_token;
              console.log('🔑 Calendar auth: Using token from cookies');
            } catch (parseError) {
              console.log('⚠️ Calendar auth: Failed to parse cookie token');
            }
          }
        }
      }
      
      if (!accessToken) {
        console.log('❌ Calendar auth: No access token found');
        return res.status(401).json({ error: "Acesso negado" });
      }
      
      // Verify token with Supabase
      const { supabaseAdmin } = await import('./supabase-client');
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(accessToken);
      
      if (error || !user) {
        console.log('❌ Calendar auth: Token validation failed:', error?.message);
        return res.status(401).json({ error: "Acesso negado" });
      }

      console.log('✅ Calendar auth: User authenticated:', user.email);
      
      // Get user profile
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      // Set user in request
      req.user = {
        id: user.id,
        email: user.email,
        name: profile?.name || user.user_metadata?.name || '',
        role: profile?.role || 'user',
        clinic_id: profile?.clinic_id
      };
      
      console.log('👤 Calendar auth: User data set for', req.user.email);
      next();
    } catch (error) {
      console.error('❌ Calendar auth error:', error);
      res.status(401).json({ error: "Acesso negado" });
    }
  };
  
  // Initialize Google Calendar OAuth
  app.get('/api/calendar/auth/google', calendarAuth, initGoogleCalendarAuth);
  
  // Google Calendar OAuth callback
  app.get('/api/calendar/callback/google', handleGoogleCalendarCallback);
  
  // Get user's calendar integrations
  app.get('/api/calendar/integrations', calendarAuth, getUserCalendarIntegrations);
  
  // Update calendar sync preferences
  app.put('/api/calendar/integrations/:integrationId/sync', calendarAuth, updateCalendarSyncPreferences);
  
  // Delete calendar integration
  app.delete('/api/calendar/integrations/:integrationId', calendarAuth, deleteCalendarIntegration);
  
  // Get user calendars from Google Calendar
  app.get('/api/calendar/integrations/:integrationId/calendars', calendarAuth, getUserCalendars);
  
  // Update linked calendar settings
  app.put('/api/calendar/integrations/:integrationId/linked-calendar', calendarAuth, updateLinkedCalendarSettings);

  // Check availability for appointment scheduling
  app.post('/api/availability/check', async (req, res) => {
    try {
      const { startDateTime, endDateTime, excludeAppointmentId } = req.body;
      
      if (!startDateTime || !endDateTime) {
        return res.status(400).json({ error: "Start and end datetime are required" });
      }

      const startDate = new Date(startDateTime);
      const endDate = new Date(endDateTime);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({ error: "Invalid datetime format" });
      }

      // Check for conflicts with existing appointments
      const existingAppointments = await storage.getAppointmentsByDateRange(startDate, endDate);
      
      let conflictingAppointment = null;
      if (excludeAppointmentId) {
        conflictingAppointment = existingAppointments.find(apt => 
          apt.id !== excludeAppointmentId && 
          new Date(apt.scheduled_date!) < endDate &&
          new Date(apt.scheduled_date!).getTime() + ((apt.duration_minutes || 60) * 60000) > startDate.getTime()
        );
      } else {
        conflictingAppointment = existingAppointments.find(apt => 
          new Date(apt.scheduled_date!) < endDate &&
          new Date(apt.scheduled_date!).getTime() + ((apt.duration_minutes || 60) * 60000) > startDate.getTime()
        );
      }

      if (conflictingAppointment) {
        // Get contact name for the conflicting appointment
        const contact = await storage.getContact(conflictingAppointment.contact_id);
        return res.json({
          available: false,
          conflict: true,
          conflictType: 'appointment',
          conflictDetails: {
            id: conflictingAppointment.id.toString(),
            title: `${conflictingAppointment.doctor_name} - ${contact?.name || 'Paciente'}`,
            startTime: conflictingAppointment.scheduled_date,
            endTime: new Date(new Date(conflictingAppointment.scheduled_date!).getTime() + 
                             (conflictingAppointment.duration_minutes || 60) * 60000).toISOString()
          }
        });
      }

      // Check for conflicts with Google Calendar events
      try {
        // Get all active calendar integrations
        const integrations = await storage.getAllCalendarIntegrations();
        
        for (const integration of integrations) {
          if (!integration.sync_enabled || !integration.access_token) continue;
          
          try {
            const events = await googleCalendarService.getEvents(
              integration.access_token,
              integration.refresh_token || '',
              startDate,
              endDate,
              integration.linked_calendar_id || 'primary'
            );

            const conflictingEvent = events.find(event => {
              if (!event.start?.dateTime || !event.end?.dateTime) return false;
              
              const eventStart = new Date(event.start.dateTime);
              const eventEnd = new Date(event.end.dateTime);
              
              return eventStart < endDate && eventEnd > startDate;
            });

            if (conflictingEvent) {
              return res.json({
                available: false,
                conflict: true,
                conflictType: 'google_calendar',
                conflictDetails: {
                  id: conflictingEvent.id || 'unknown',
                  title: conflictingEvent.summary || 'Evento sem título',
                  startTime: conflictingEvent.start?.dateTime || startDateTime,
                  endTime: conflictingEvent.end?.dateTime || endDateTime,
                  location: conflictingEvent.location || ''
                }
              });
            }
          } catch (calendarError) {
            console.error('Error checking calendar events:', calendarError);
            // Continue checking other integrations even if one fails
          }
        }
      } catch (error) {
        console.error('Error checking Google Calendar conflicts:', error);
        // Don't fail the availability check if Google Calendar check fails
      }

      res.json({
        available: true,
        conflict: false
      });

    } catch (error) {
      console.error('Error checking availability:', error);
      res.status(500).json({ error: 'Failed to check availability' });
    }
  });

  // Find available time slots
  app.post('/api/availability/find-slots', async (req, res) => {
    try {
      const { date, duration = 60, workingHours = { start: '08:00', end: '18:00' } } = req.body;
      
      if (!date) {
        return res.status(400).json({ error: "Date is required" });
      }

      const targetDate = new Date(date);
      if (isNaN(targetDate.getTime())) {
        return res.status(400).json({ error: "Invalid date format" });
      }

      // Set up start and end of day
      const dayStart = new Date(targetDate);
      const [startHour, startMinute] = workingHours.start.split(':').map(Number);
      dayStart.setHours(startHour, startMinute, 0, 0);

      const dayEnd = new Date(targetDate);
      const [endHour, endMinute] = workingHours.end.split(':').map(Number);
      dayEnd.setHours(endHour, endMinute, 0, 0);

      // Get all appointments for the day
      const appointments = await storage.getAppointmentsByDateRange(dayStart, dayEnd);
      
      // Get Google Calendar events for the day
      let calendarEvents: any[] = [];
      try {
        const integrations = await storage.getAllCalendarIntegrations();
        
        for (const integration of integrations) {
          if (!integration.sync_enabled || !integration.access_token) continue;
          
          try {
            const events = await googleCalendarService.getEvents(
              integration.access_token,
              integration.refresh_token || '',
              dayStart,
              dayEnd,
              integration.linked_calendar_id || 'primary'
            );
            calendarEvents.push(...events);
          } catch (error: any) {
            console.warn(`Google Calendar token expired or invalid for integration ${integration.id}. Continuing without calendar events.`);
            
            // If token is expired/invalid, mark integration as needing re-authentication
            if (error.code === 401 || error.status === 401) {
              try {
                await storage.updateCalendarIntegration(integration.id, {
                  sync_enabled: false,
                  sync_errors: 'Token expired - re-authentication required'
                });
              } catch (updateError) {
                console.error('Failed to update integration status:', updateError);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error fetching Google Calendar events:', error);
      }

      // Convert appointments to time blocks
      const busyBlocks: { start: Date; end: Date; type: string; title: string }[] = [];
      
      // Add appointment blocks
      appointments.forEach(apt => {
        if (apt.scheduled_date && apt.status !== 'cancelled') {
          const start = new Date(apt.scheduled_date);
          const end = new Date(start.getTime() + (apt.duration_minutes || 60) * 60000);
          busyBlocks.push({
            start,
            end,
            type: 'appointment',
            title: `${apt.doctor_name} - Consulta`
          });
        }
      });

      // Add calendar event blocks
      calendarEvents.forEach(event => {
        if (event.start?.dateTime && event.end?.dateTime) {
          busyBlocks.push({
            start: new Date(event.start.dateTime),
            end: new Date(event.end.dateTime),
            type: 'calendar_event',
            title: event.summary || 'Evento'
          });
        }
      });

      // Sort busy blocks by start time
      busyBlocks.sort((a, b) => a.start.getTime() - b.start.getTime());

      // Find available slots
      const availableSlots: { startTime: string; endTime: string; duration: number }[] = [];
      const slotDuration = duration * 60000; // Convert to milliseconds

      let currentTime = new Date(dayStart);

      for (const block of busyBlocks) {
        // Check if there's a gap before this block
        if (currentTime < block.start) {
          const gapDuration = block.start.getTime() - currentTime.getTime();
          
          // Create slots in this gap
          let slotStart = new Date(currentTime);
          while (slotStart.getTime() + slotDuration <= block.start.getTime()) {
            const slotEnd = new Date(slotStart.getTime() + slotDuration);
            availableSlots.push({
              startTime: slotStart.toISOString(),
              endTime: slotEnd.toISOString(),
              duration
            });
            slotStart = new Date(slotStart.getTime() + slotDuration);
          }
        }
        
        // Update current time to after this block
        currentTime = new Date(Math.max(currentTime.getTime(), block.end.getTime()));
      }

      // Check for slots after the last block until end of day
      if (currentTime < dayEnd) {
        let slotStart = new Date(currentTime);
        while (slotStart.getTime() + slotDuration <= dayEnd.getTime()) {
          const slotEnd = new Date(slotStart.getTime() + slotDuration);
          availableSlots.push({
            startTime: slotStart.toISOString(),
            endTime: slotEnd.toISOString(),
            duration
          });
          slotStart = new Date(slotStart.getTime() + slotDuration);
        }
      }

      res.json({
        date: targetDate.toISOString().split('T')[0],
        duration,
        workingHours,
        availableSlots,
        busyBlocks: busyBlocks.map(block => ({
          startTime: block.start.toISOString(),
          endTime: block.end.toISOString(),
          type: block.type,
          title: block.title
        }))
      });

    } catch (error) {
      console.error('Error finding available slots:', error);
      res.status(500).json({ error: 'Failed to find available slots' });
    }
  });
  
  // Manual sync from Google Calendar to system
  app.post("/api/calendar/sync-from-google", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Não autenticado" });
      }

      const { syncCalendarEventsToSystem } = await import('./calendar-routes');
      
      // Get user's calendar integrations
      const integrations = await storage.getCalendarIntegrations(userId);
      const googleIntegration = integrations.find(i => i.provider === 'google' && i.is_active);
      
      if (!googleIntegration) {
        return res.status(404).json({ error: "Nenhuma integração do Google Calendar encontrada" });
      }

      await syncCalendarEventsToSystem(userId, googleIntegration.id);
      
      res.json({ success: true, message: "Sincronização concluída com sucesso" });
    } catch (error: any) {
      console.error("Error syncing from Google Calendar:", error);
      res.status(500).json({ error: "Erro na sincronização", details: error.message });
    }
  });

  // Check time slot availability
  app.post("/api/calendar/check-availability", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const { startDateTime, endDateTime, excludeAppointmentId } = req.body;
      
      if (!startDateTime || !endDateTime) {
        return res.status(400).json({ error: "Data e hora de início e fim são obrigatórias" });
      }

      const startDate = new Date(startDateTime);
      const endDate = new Date(endDateTime);

      // Get all appointments for the clinic in the time range
      const appointments = await storage.getAppointments(1, { 
        startDate: startDate, 
        endDate: endDate 
      });

      // Filter out the appointment being edited (if any)
      const conflictingAppointments = appointments.filter(apt => 
        apt.id !== excludeAppointmentId && 
        apt.status !== 'cancelled' &&
        apt.scheduled_date
      );

      // Check for conflicts with existing appointments
      const hasConflict = conflictingAppointments.some(apt => {
        const aptStart = new Date(apt.scheduled_date!);
        const aptDuration = apt.duration_minutes || 60;
        const aptEnd = new Date(aptStart.getTime() + aptDuration * 60000);

        // Check if there's any overlap
        return (startDate < aptEnd && endDate > aptStart);
      });

      if (hasConflict) {
        const conflictingApt = conflictingAppointments.find(apt => {
          const aptStart = new Date(apt.scheduled_date!);
          const aptDuration = apt.duration_minutes || 60;
          const aptEnd = new Date(aptStart.getTime() + aptDuration * 60000);
          return (startDate < aptEnd && endDate > aptStart);
        });

        return res.json({
          available: false,
          conflict: true,
          conflictType: 'appointment',
          conflictDetails: {
            id: conflictingApt?.id,
            title: `${conflictingApt?.appointment_type} - ${conflictingApt?.doctor_name}`,
            startTime: conflictingApt?.scheduled_date,
            endTime: new Date(new Date(conflictingApt?.scheduled_date!).getTime() + (conflictingApt?.duration_minutes || 60) * 60000)
          }
        });
      }

      // Check Google Calendar conflicts
      try {
        const integrations = await storage.getCalendarIntegrations(userId);
        const googleIntegration = integrations.find(i => i.provider === 'google' && i.is_active);
        
        if (googleIntegration) {
          const { google } = await import('googleapis');
          
          // Set up OAuth2 client
          const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
          );

          oauth2Client.setCredentials({
            access_token: googleIntegration.access_token,
            refresh_token: googleIntegration.refresh_token,
            expiry_date: new Date(googleIntegration.token_expires_at || Date.now()).getTime()
          });

          // Refresh token if needed
          const now = new Date();
          const expiryDate = new Date(googleIntegration.token_expires_at || Date.now());
          const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

          if (expiryDate <= fiveMinutesFromNow) {
            try {
              const { credentials } = await oauth2Client.refreshAccessToken();
              await storage.updateCalendarIntegration(googleIntegration.id, {
                access_token: credentials.access_token!,
                refresh_token: credentials.refresh_token || googleIntegration.refresh_token,
                token_expires_at: new Date(credentials.expiry_date!)
              });
            } catch (refreshError) {
              console.error('Error refreshing token for availability check:', refreshError);
            }
          }

          const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

          // Get events from Google Calendar for the time range
          const calendarResponse = await calendar.events.list({
            calendarId: googleIntegration.calendar_id || 'primary',
            timeMin: startDate.toISOString(),
            timeMax: endDate.toISOString(),
            singleEvents: true,
            orderBy: 'startTime',
          });

          const googleEvents = calendarResponse.data.items || [];
          
          // Check for conflicts with Google Calendar events
          const googleConflict = googleEvents.find(event => {
            if (!event.start?.dateTime || !event.end?.dateTime) {
              return false; // Skip all-day events
            }

            const eventStart = new Date(event.start.dateTime);
            const eventEnd = new Date(event.end.dateTime);

            // Check if this event is already synced to our system
            const isSyncedEvent = conflictingAppointments.some(apt => 
              apt.google_calendar_event_id === event.id
            );

            if (isSyncedEvent) {
              return false; // Skip events that are already in our system
            }

            // Check for overlap
            return (startDate < eventEnd && endDate > eventStart);
          });

          if (googleConflict) {
            return res.json({
              available: false,
              conflict: true,
              conflictType: 'google_calendar',
              conflictDetails: {
                id: googleConflict.id,
                title: googleConflict.summary || 'Evento do Google Calendar',
                startTime: googleConflict.start?.dateTime,
                endTime: googleConflict.end?.dateTime,
                location: googleConflict.location
              }
            });
          }
        }
      } catch (googleError) {
        console.error('Error checking Google Calendar availability:', googleError);
        // Continue without Google Calendar check if there's an error
      }

      res.json({
        available: true,
        conflict: false
      });

    } catch (error: any) {
      console.error("Error checking availability:", error);
      res.status(500).json({ error: "Erro ao verificar disponibilidade" });
    }
  });

  // ============ MEDICAL RECORDS ============

  // Get medical records for a contact
  app.get("/api/contacts/:contactId/medical-records", isAuthenticated, async (req, res) => {
    try {
      const contactId = parseInt(req.params.contactId);
      if (isNaN(contactId)) {
        return res.status(400).json({ error: "Invalid contact ID" });
      }
      
      const records = await storage.getMedicalRecords(contactId);
      console.log(`📋 Retrieved ${records.length} medical records for contact ${contactId}`);
      res.json(records);
    } catch (error) {
      console.error("Error fetching medical records:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Create medical record for a contact
  app.post("/api/contacts/:contactId/medical-records", isAuthenticated, async (req, res) => {
    try {
      const contactId = parseInt(req.params.contactId);
      if (isNaN(contactId)) {
        return res.status(400).json({ error: "Invalid contact ID" });
      }

      // Use clinic_id 1 as default (main clinic) since there's a data sync issue
      const clinicId = 1;

      const userId = (req as any).user?.id;
      const dataToValidate = {
        ...req.body,
        contact_id: contactId,
        clinic_id: clinicId,
        created_by: userId,
        updated_by: userId
      };
      
      console.log('🔍 Data before validation:', dataToValidate);
      const validatedData = insertMedicalRecordSchema.parse(dataToValidate);
      
      console.log('💾 Creating medical record:', validatedData);
      const record = await storage.createMedicalRecord(validatedData);
      console.log('✅ Medical record created successfully:', record);
      res.status(201).json(record);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        console.error('❌ Validation error creating medical record:', error.errors);
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error creating medical record:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get medical record by appointment
  app.get("/api/appointments/:appointmentId/medical-record", isAuthenticated, async (req, res) => {
    try {
      const appointmentId = parseInt(req.params.appointmentId);
      if (isNaN(appointmentId)) {
        return res.status(400).json({ error: "Invalid appointment ID" });
      }
      
      const record = await storage.getMedicalRecordByAppointment(appointmentId);
      if (!record) {
        return res.status(404).json({ error: "Medical record not found" });
      }
      
      res.json(record);
    } catch (error) {
      console.error("Error fetching medical record:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Create medical record
  app.post("/api/medical-records", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const validatedData = insertMedicalRecordSchema.parse({
        ...req.body,
        created_by: userId,
        updated_by: userId
      });
      
      const record = await storage.createMedicalRecord(validatedData);
      res.status(201).json(record);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error creating medical record:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update medical record
  app.put("/api/medical-records/:id", isAuthenticated, async (req, res) => {
    try {
      const recordId = parseInt(req.params.id);
      if (isNaN(recordId)) {
        return res.status(400).json({ error: "Invalid medical record ID" });
      }
      
      const userId = (req as any).user?.id;
      const validatedData = insertMedicalRecordSchema.partial().parse({
        ...req.body,
        updated_by: userId
      });
      
      const record = await storage.updateMedicalRecord(recordId, validatedData);
      if (!record) {
        return res.status(404).json({ error: "Medical record not found" });
      }
      
      res.json(record);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error updating medical record:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get specific medical record
  app.get("/api/medical-records/:id", isAuthenticated, async (req, res) => {
    try {
      const recordId = parseInt(req.params.id);
      if (isNaN(recordId)) {
        return res.status(400).json({ error: "Invalid medical record ID" });
      }
      
      const record = await storage.getMedicalRecord(recordId);
      if (!record) {
        return res.status(404).json({ error: "Medical record not found" });
      }
      
      res.json(record);
    } catch (error) {
      console.error("Error fetching medical record:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
