import React, { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, List, Clock, User, Stethoscope, CalendarDays, ChevronLeft, ChevronRight, Phone, MessageCircle, MapPin, Plus, Check, ChevronsUpDown, Edit, Trash2, X, Eye, MoreVertical, AlertTriangle, Search, Mail, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAvailabilityCheck, formatConflictMessage, createTimeSlots } from "@/hooks/useAvailability";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { mockAppointments, mockContacts } from "@/lib/mock-data";
import { format, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, addMonths, subMonths, startOfWeek, endOfWeek, addWeeks, subWeeks, addDays, subDays, startOfDay, endOfDay, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { EventTooltip } from "@/components/EventTooltip";
import { AppointmentEditor } from "@/components/AppointmentEditor";
import { FindTimeSlots } from "@/components/FindTimeSlots";
import type { Appointment, Contact } from "@/../../shared/schema";

// Schema for appointment creation form
const appointmentSchema = z.object({
  appointment_name: z.string().min(1, "Nome do compromisso é obrigatório"),
  contact_id: z.string().min(1, "Contato é obrigatório"),
  user_id: z.string().min(1, "Profissional é obrigatório"),
  scheduled_date: z.string().min(1, "Data é obrigatória"),
  scheduled_time: z.string().min(1, "Horário é obrigatório"),
  duration: z.string().min(1, "Duração é obrigatória"),
  type: z.string().min(1, "Tipo é obrigatório"),
  notes: z.string().optional(),
  contact_whatsapp: z.string().optional(),
  contact_email: z.string().optional(),
});

type AppointmentForm = z.infer<typeof appointmentSchema>;

// Schema for patient registration form
const patientSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  phone: z.string().min(1, "Telefone é obrigatório"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  cpf: z.string().optional(),
  rg: z.string().optional(),
  birth_date: z.string().optional(),
  gender: z.string().optional(),
  profession: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip_code: z.string().optional(),
  notes: z.string().optional(),
  // Additional fields for complete form
  landline_phone: z.string().optional(),
  address_complement: z.string().optional(),
  neighborhood: z.string().optional(),
  responsible_name: z.string().optional(),
  responsible_cpf: z.string().optional(),
  responsible_birth_date: z.string().optional(),
  insurance_type: z.string().optional(),
  insurance_holder: z.string().optional(),
  insurance_number: z.string().optional(),
  insurance_responsible_cpf: z.string().optional(),
  emergency_contact_name: z.string().optional(),
  emergency_contact_phone: z.string().optional(),
  reminder_preference: z.string().optional(),
  how_found_clinic: z.string().optional(),
});

type PatientForm = z.infer<typeof patientSchema>;

// Status configuration with proper colors and ordering
const statusConfig = {
  pendente: { 
    label: "Pendente", 
    color: "bg-yellow-100 text-yellow-800 border-yellow-200",
    badgeColor: "bg-yellow-500",
    order: 0
  },
  agendada: { 
    label: "Agendado", 
    color: "bg-blue-100 text-blue-800 border-blue-200",
    badgeColor: "bg-blue-500",
    order: 1
  },
  confirmada: { 
    label: "Confirmado", 
    color: "bg-green-100 text-green-800 border-green-200",
    badgeColor: "bg-green-500",
    order: 2
  },
  realizada: { 
    label: "Realizado", 
    color: "bg-purple-100 text-purple-800 border-purple-200",
    badgeColor: "bg-purple-500",
    order: 3
  },
  faltou: { 
    label: "Faltou", 
    color: "bg-orange-100 text-orange-800 border-orange-200",
    badgeColor: "bg-orange-500",
    order: 4
  },
  cancelada: { 
    label: "Cancelado", 
    color: "bg-red-100 text-red-800 border-red-200",
    badgeColor: "bg-red-500",
    order: 5
  }
} as const;

// Legacy status mapping - only for display purposes
const legacyStatusMapping: Record<string, keyof typeof statusConfig> = {
  scheduled: "agendada",
  agendado: "agendada", // Portuguese variant
  confirmed: "confirmada", 
  completed: "realizada",
  cancelled: "cancelada",
  no_show: "faltou",
  pending: "pendente"
};

// Main status list for dropdowns (no duplicates)
const mainStatusList = [
  'pendente',
  'agendada', 
  'confirmada',
  'realizada',
  'faltou',
  'cancelada'
] as const;

// Helper function to get status config (including legacy mapping)
const getStatusConfig = (status: string) => {
  const mappedStatus = legacyStatusMapping[status] || status;
  return statusConfig[mappedStatus as keyof typeof statusConfig];
};

// Support legacy status names for display
const statusLabels: Record<string, { label: string; color: string }> = {
  ...Object.fromEntries(
    Object.entries(statusConfig).map(([key, value]) => [key, { label: value.label, color: value.color }])
  ),
  // Legacy status labels
  scheduled: { label: "Agendado", color: "bg-blue-100 text-blue-800" },
  agendado: { label: "Agendado", color: "bg-blue-100 text-blue-800" }, // Portuguese variant
  confirmed: { label: "Confirmado", color: "bg-green-100 text-green-800" },
  completed: { label: "Realizado", color: "bg-purple-100 text-purple-800" },
  cancelled: { label: "Cancelado", color: "bg-red-100 text-red-800" },
  no_show: { label: "Faltou", color: "bg-orange-100 text-orange-800" },
  pending: { label: "Pendente", color: "bg-yellow-100 text-yellow-800" },
};

export function Consultas() {
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [calendarView, setCalendarView] = useState<"month" | "week" | "day">("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Create a stable reference for "today" to avoid timezone issues
  const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [appointmentEditorOpen, setAppointmentEditorOpen] = useState(false);
  const [editingAppointmentId, setEditingAppointmentId] = useState<number | undefined>(undefined);
  const [contactComboboxOpen, setContactComboboxOpen] = useState(false);
  const [dayEventsDialog, setDayEventsDialog] = useState<{ open: boolean; date: Date; events: Appointment[] }>({
    open: false,
    date: new Date(),
    events: []
  });
  const [availabilityConflict, setAvailabilityConflict] = useState<{
    hasConflict: boolean;
    message: string;
    conflictType?: string;
  } | null>(null);
  const [workingHoursWarning, setWorkingHoursWarning] = useState<{
    hasWarning: boolean;
    message: string;
    type: 'non_working_day' | 'outside_hours' | 'lunch_time' | null;
    details?: string;
  } | null>(null);
  const [suggestedSlots, setSuggestedSlots] = useState<Array<{
    date: string;
    time: string;
    datetime: Date;
  }>>([]);
  const [findTimeSlotsOpen, setFindTimeSlotsOpen] = useState(false);
  const [showNewPatientDialog, setShowNewPatientDialog] = useState(false);
  const [patientSearchQuery, setPatientSearchQuery] = useState("");
  const [isCreatingPatient, setIsCreatingPatient] = useState(false);
  const [patientFormTab, setPatientFormTab] = useState("basic");
  const [quickCreateHover, setQuickCreateHover] = useState<{
    show: boolean;
    date: Date | null;
    hour: number | null;
    x: number;
    y: number;
  }>({
    show: false,
    date: null,
    hour: null,
    x: 0,
    y: 0
  });
  
  const { toast } = useToast();
  const availabilityCheck = useAvailabilityCheck();

  // Form for creating appointments
  const form = useForm<AppointmentForm>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      appointment_name: "",
      contact_id: "",
      user_id: "",
      scheduled_date: "",
      scheduled_time: "",
      duration: "30",
      type: "consulta",
      notes: "",
      contact_whatsapp: "",
      contact_email: "",
    },
  });

  // Form for patient registration
  const patientForm = useForm<PatientForm>({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      cpf: "",
      rg: "",
      birth_date: "",
      gender: "",
      profession: "",
      address: "",
      city: "",
      state: "",
      zip_code: "",
      notes: "",
      landline_phone: "",
      address_complement: "",
      neighborhood: "",
      responsible_name: "",
      responsible_cpf: "",
      responsible_birth_date: "",
      insurance_type: "particular",
      insurance_holder: "",
      insurance_number: "",
      insurance_responsible_cpf: "",
      emergency_contact_name: "",
      emergency_contact_phone: "",
      reminder_preference: "whatsapp",
      how_found_clinic: "",
    },
  });

  // Mutation for creating patient
  const createPatientMutation = useMutation({
    mutationFn: async (data: PatientForm) => {
      console.log('🚀 Starting patient creation with data:', data);
      
      // Only send fields that exist in the contacts table schema
      const contactData = {
        clinic_id: 1,
        name: data.name,
        phone: data.phone,
        email: data.email || '',
        status: 'novo',
        source: 'cadastro',
        gender: data.gender || null,
        profession: data.profession || null,
        address: data.address || null,
        notes: data.notes || null,
        // Combine emergency contact info into notes if provided
        emergency_contact: data.emergency_contact_name && data.emergency_contact_phone 
          ? `${data.emergency_contact_name} - ${data.emergency_contact_phone}` 
          : null,
      };
      
      console.log('📤 Sending contact data to API:', contactData);
      
      try {
        const response = await apiRequest("POST", "/api/contacts", contactData);
        console.log('📥 Response status:', response.status);
        console.log('📥 Response headers:', response.headers);
        
        // Check if response has content
        const contentLength = response.headers.get('content-length');
        console.log('📏 Content length:', contentLength);
        
        if (contentLength === '0' || contentLength === null) {
          console.warn('⚠️ Empty response received, checking response body...');
        }
        
        const result = await response.json();
        console.log('✅ Patient created successfully:', result);
        console.log('🔍 Result type:', typeof result);
        console.log('🔍 Result keys:', Object.keys(result || {}));
        
        return result;
      } catch (error) {
        console.error('❌ Failed to create patient:', error);
        throw error;
      }
    },
    onSuccess: (newPatient: any) => {
      console.log('🎉 Patient creation SUCCESS callback triggered');
      console.log('📋 New patient data received:', newPatient);
      
      try {
        console.log('🔄 Invalidating contacts cache...');
        queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
        
        console.log('❌ Closing patient dialog...');
        setShowNewPatientDialog(false);
        
        console.log('🧹 Resetting patient form...');
        patientForm.reset();
        
        console.log('🎯 Auto-selecting newly created patient...');
        if (newPatient && newPatient.id) {
          form.setValue("contact_id", newPatient.id.toString());
          form.setValue("contact_whatsapp", newPatient.phone || "");
          form.setValue("contact_email", newPatient.email || "");
          console.log('✅ Patient auto-selected with ID:', newPatient.id);
        } else {
          console.warn('⚠️ Unable to auto-select patient - no ID received, will attempt fallback');
          // Refresh contacts and try to select the most recently created patient
          queryClient.invalidateQueries({ queryKey: ['/api/contacts'] }).then(() => {
            // After cache invalidation, try to find the newly created patient by name
            const patientName = patientForm.getValues('name');
            console.log('🔍 Looking for patient with name:', patientName);
            
            setTimeout(() => {
              // Get the latest contacts data
              const contactsQuery = queryClient.getQueryData(['/api/contacts']) as Contact[] | undefined;
              if (contactsQuery) {
                const newlyCreated = contactsQuery.find(contact => 
                  contact.name === patientName && 
                  contact.phone === patientForm.getValues('phone')
                );
                
                if (newlyCreated) {
                  form.setValue("contact_id", newlyCreated.id.toString());
                  form.setValue("contact_whatsapp", newlyCreated.phone || "");
                  form.setValue("contact_email", newlyCreated.email || "");
                  console.log('✅ Fallback patient selection successful with ID:', newlyCreated.id);
                } else {
                  console.warn('⚠️ Fallback patient selection failed - patient not found in contacts list');
                }
              }
            }, 500); // Small delay to allow cache refresh
          });
        }
        
        // Patient successfully created and auto-selected - no notification needed
        // The auto-selection in the patient field clearly shows success
        
        console.log('🏁 Patient creation process completed successfully');
      } catch (successError) {
        console.error('❌ Error in success callback:', successError);
      }
    },
    onError: (error: any) => {
      console.error('💥 Patient creation ERROR callback triggered');
      console.error('📊 Error details:', error);
      console.error('📊 Error type:', typeof error);
      console.error('📊 Error properties:', Object.keys(error || {}));
      
      if (error?.response) {
        console.error('📡 HTTP Response error:', error.response);
        console.error('📡 Response status:', error.response.status);
        console.error('📡 Response data:', error.response.data);
      }
      
      if (error?.message) {
        console.error('💬 Error message:', error.message);
      }
      
      toast({
        title: "Erro",
        description: `Não foi possível cadastrar o paciente. ${error?.message || 'Erro desconhecido'}`,
        variant: "destructive",
      });
    },
  });

  // Mutation for updating appointment status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ appointmentId, status }: { appointmentId: number; status: string }) => {
      const response = await fetch(`/api/appointments/${appointmentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error('Failed to update status');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
      toast({
        title: "Status atualizado",
        description: "O status da consulta foi atualizado com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status da consulta.",
        variant: "destructive",
      });
    },
  });

  // Create appointment mutation
  const createAppointmentMutation = useMutation({
    mutationFn: async (data: AppointmentForm) => {
      // Update contact data if modified
      if (data.contact_whatsapp || data.contact_email) {
        const contactUpdates: any = {};
        if (data.contact_whatsapp) contactUpdates.phone = data.contact_whatsapp;
        if (data.contact_email) contactUpdates.email = data.contact_email;
        
        if (Object.keys(contactUpdates).length > 0) {
          await apiRequest("PUT", `/api/contacts/${data.contact_id}`, contactUpdates);
        }
      }

      const appointmentData = {
        contact_id: parseInt(data.contact_id),
        user_id: parseInt(data.user_id),
        clinic_id: 1,
        doctor_name: data.appointment_name,
        specialty: data.type,
        appointment_type: data.type,
        scheduled_date: new Date(`${data.scheduled_date}T${data.scheduled_time}`),
        duration_minutes: parseInt(data.duration),
        status: "agendada",
        payment_status: "pendente",
        payment_amount: 0,
        session_notes: data.notes || null,
      };
      const res = await apiRequest("POST", "/api/appointments", appointmentData);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments", { clinic_id: 1 }] });
      toast({
        title: "Consulta criada",
        description: "A consulta foi agendada com sucesso.",
      });
      setIsCreateDialogOpen(false);
      form.reset();
      setAvailabilityConflict(null);
      setSuggestedSlots([]);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar consulta",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Fetch appointments
  const { data: appointments = [], isLoading: appointmentsLoading } = useQuery({
    queryKey: ['/api/appointments', { clinic_id: 1 }],
    queryFn: async () => {
      const response = await fetch('/api/appointments?clinic_id=1');
      if (!response.ok) throw new Error('Failed to fetch appointments');
      return response.json();
    },
  });

  // Fetch contacts for patient names
  const { data: contacts = [] } = useQuery({
    queryKey: ['/api/contacts', { clinic_id: 1 }],
    queryFn: async () => {
      const response = await fetch('/api/contacts?clinic_id=1');
      if (!response.ok) throw new Error('Failed to fetch contacts');
      return response.json();
    },
  });

  // Fetch users for doctor names
  const { data: clinicUsers = [] } = useQuery({
    queryKey: ['/api/clinic/1/users'],
    queryFn: async () => {
      const response = await fetch('/api/clinic/1/users');
      if (!response.ok) throw new Error('Failed to fetch clinic users');
      return response.json();
    },
  });

  // Fetch clinic configuration for working hours validation
  const { data: clinicConfig } = useQuery({
    queryKey: ["/api/clinic/1/config"],
    queryFn: async () => {
      const response = await fetch('/api/clinic/1/config');
      if (!response.ok) throw new Error('Failed to fetch clinic config');
      return response.json();
    },
    select: (data: any) => ({
      working_days: data.working_days || ['monday','tuesday','wednesday','thursday','friday'],
      work_start: data.work_start || "08:00",
      work_end: data.work_end || "18:00", 
      lunch_start: data.lunch_start || "12:00",
      lunch_end: data.lunch_end || "13:00",
      has_lunch_break: data.has_lunch_break
    })
  });

  // Helper functions for working hours validation
  const getDayOfWeekKey = (date: Date): string => {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[date.getDay()];
  };

  const isWorkingDay = (date: Date, config: any): boolean => {
    if (!config?.working_days) return true;
    const dayKey = getDayOfWeekKey(date);
    return config.working_days.includes(dayKey);
  };

  const isWorkingHour = (time: string, config: any): boolean => {
    if (!config?.work_start || !config?.work_end) return true;
    return time >= config.work_start && time <= config.work_end;
  };

  const isLunchTime = (time: string, config: any): boolean => {
    // If lunch break is disabled, never block lunch time
    if (!config?.has_lunch_break) {
      return false;
    }
    if (!config?.lunch_start || !config?.lunch_end) return false;
    return time >= config.lunch_start && time < config.lunch_end;
  };

  const checkWorkingHours = (date: string, time: string) => {
    if (!date || !time || !clinicConfig) {
      setWorkingHoursWarning(null);
      return;
    }

    // Create date in local timezone to avoid UTC offset issues
    const [year, month, day] = date.split('-').map(Number);
    const selectedDate = new Date(year, month - 1, day);
    const selectedDateTime = new Date(`${date}T${time}`);
    
    // Use enhanced analysis to get detailed warning information
    const dayOfWeek = format(selectedDate, 'EEEE', { locale: ptBR });
    
    if (!isWorkingDay(selectedDate, clinicConfig)) {
      const workingDaysNames = clinicConfig.working_days?.map((day: string) => {
        const dayNames: { [key: string]: string } = {
          'monday': 'Segunda', 'tuesday': 'Terça', 'wednesday': 'Quarta',
          'thursday': 'Quinta', 'friday': 'Sexta', 'saturday': 'Sábado', 'sunday': 'Domingo'
        };
        return dayNames[day];
      }).join(', ') || 'Dias úteis não configurados';

      setWorkingHoursWarning({
        hasWarning: true,
        message: `é ${dayOfWeek.toLowerCase()}`,
        type: 'non_working_day',
        details: `Funcionamento: ${workingDaysNames}`
      });
      return;
    }
    
    if (!isWorkingHour(time, clinicConfig)) {
      setWorkingHoursWarning({
        hasWarning: true,
        message: `é fora do horário`,
        type: 'outside_hours',
        details: `Funcionamento: ${clinicConfig.work_start} às ${clinicConfig.work_end}`
      });
      return;
    }
    
    if (isLunchTime(time, clinicConfig)) {
      setWorkingHoursWarning({
        hasWarning: true,
        message: `é horário de almoço`,
        type: 'lunch_time',
        details: `Almoço: ${clinicConfig.lunch_start} às ${clinicConfig.lunch_end}`
      });
      return;
    }

    // Clear warnings for normal working hours
    setWorkingHoursWarning(null);
  };

  // Helper functions for calendar background colors
  const isUnavailableDay = (date: Date): boolean => {
    if (!clinicConfig) return false;
    return !isWorkingDay(date, clinicConfig);
  };

  const isUnavailableHour = (hour: number): boolean => {
    if (!clinicConfig) return false;
    const timeString = `${hour.toString().padStart(2, '0')}:00`;
    return !isWorkingHour(timeString, clinicConfig) || isLunchTime(timeString, clinicConfig);
  };

  // Enhanced function: Allow booking in any slot, but analyze availability status
  const analyzeTimeSlot = (date: Date, hour: number, minute: number = 0) => {
    if (!clinicConfig) return {
      isClickable: true,
      hasWarning: false,
      warningType: null,
      isOptimal: true
    };
    
    const slotDateTime = new Date(date);
    slotDateTime.setHours(hour, minute, 0, 0);
    
    // Check for appointment conflicts first
    const dayAppointments = getAppointmentsForDate(date);
    const hasConflict = dayAppointments.some((apt: Appointment) => {
      if (!apt.scheduled_date) return false;
      const aptDate = new Date(apt.scheduled_date);
      const aptEndDate = new Date(aptDate.getTime() + (getAppointmentDuration(apt) * 60000));
      
      const slotEnd = new Date(slotDateTime.getTime() + (15 * 60000));
      return (slotDateTime < aptEndDate && slotEnd > aptDate);
    });
    
    // If there's a conflict, slot is not clickable
    if (hasConflict) {
      return {
        isClickable: false,
        hasWarning: false,
        warningType: null,
        isOptimal: false
      };
    }
    
    // All slots are clickable, but check for warnings
    const isWorkingDay = !isUnavailableDay(date);
    const isWorkingHour = !isUnavailableHour(hour);
    const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    const isLunchHour = clinicConfig.has_lunch_break && isLunchTime(timeString, clinicConfig);
    
    // Determine warning type
    let warningType = null;
    let hasWarning = false;
    
    if (!isWorkingDay) {
      warningType = 'non-working-day';
      hasWarning = true;
    } else if (!isWorkingHour && !isLunchHour) {
      warningType = 'outside-hours';
      hasWarning = true;
    } else if (isLunchHour) {
      warningType = 'lunch-time';
      hasWarning = true;
    }
    
    return {
      isClickable: true, // Always allow clicking
      hasWarning,
      warningType,
      isOptimal: !hasWarning // Optimal means no warnings
    };
  };

  // Legacy function for backward compatibility - now allows all non-conflicting slots
  const isTimeSlotAvailable = (date: Date, hour: number, minute: number = 0): boolean => {
    const analysis = analyzeTimeSlot(date, hour, minute);
    return analysis.isClickable;
  };

  // Handle quick create appointment
  const handleQuickCreateAppointment = (date: Date, hour: number, minute: number = 0) => {
    const formattedDate = format(date, 'yyyy-MM-dd');
    const formattedTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    
    // Pre-fill the form with selected date and time
    form.setValue("scheduled_date", formattedDate);
    form.setValue("scheduled_time", formattedTime);
    form.setValue("duration", "30"); // Default duration
    form.setValue("type", "consulta"); // Default type
    
    setIsCreateDialogOpen(true);
  };

  const getCalendarCellBackgroundClass = (date: Date, hour?: number): string => {
    if (!clinicConfig) return "bg-white";
    
    // For monthly view - check if entire day is unavailable
    if (hour === undefined) {
      return isUnavailableDay(date) ? "bg-gray-100" : "bg-white";
    }
    
    // For weekly/daily view - check both day and hour
    if (isUnavailableDay(date) || isUnavailableHour(hour)) {
      return "bg-gray-100";
    }
    
    return "bg-white";
  };

  // Function to check availability when date/time changes
  const checkAvailability = async (date: string, time: string, duration: string) => {
    if (!date || !time || !duration) {
      setAvailabilityConflict(null);
      return;
    }

    const startDateTime = new Date(`${date}T${time}`);
    const durationMinutes = parseInt(duration);
    const endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60000);

    try {
      const result = await availabilityCheck.mutateAsync({
        startDateTime: startDateTime.toISOString(),
        endDateTime: endDateTime.toISOString()
      });

      if (result.conflict) {
        setAvailabilityConflict({
          hasConflict: true,
          message: formatConflictMessage(result.conflictType!, result.conflictDetails!),
          conflictType: result.conflictType
        });
      } else {
        setAvailabilityConflict({
          hasConflict: false,
          message: "Horário disponível",
          conflictType: undefined
        });
      }
    } catch (error) {
      console.error('Erro ao verificar disponibilidade:', error);
      setAvailabilityConflict(null);
    }
  };

  // Find available time slots
  const findAvailableSlots = async (date: string, duration: string) => {
    if (!date || !duration) return;

    const selectedDate = new Date(date);
    const slots = createTimeSlots(selectedDate, 8, 18, 30);
    const availableSlots = [];

    for (const slot of slots) {
      try {
        const startDateTime = slot.datetime;
        const durationMinutes = parseInt(duration);
        const endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60000);

        const result = await availabilityCheck.mutateAsync({
          startDateTime: startDateTime.toISOString(),
          endDateTime: endDateTime.toISOString()
        });

        if (!result.conflict) {
          availableSlots.push({
            date: date,
            time: slot.value,
            datetime: slot.datetime
          });
        }
      } catch (error) {
        console.error('Erro ao verificar slot:', error);
      }

      if (availableSlots.length >= 6) break; // Limit to 6 suggestions
    }

    setSuggestedSlots(availableSlots);
  };

  // Watch form fields for availability checking
  const watchedDate = form.watch("scheduled_date");
  const watchedTime = form.watch("scheduled_time");
  const watchedDuration = form.watch("duration");

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (watchedDate && watchedTime && watchedDuration) {
        checkAvailability(watchedDate, watchedTime, watchedDuration);
        checkWorkingHours(watchedDate, watchedTime);
      }
    }, 500); // Debounce

    return () => clearTimeout(timeoutId);
  }, [watchedDate, watchedTime, watchedDuration]);

  useEffect(() => {
    if (!appointmentsLoading) {
      setIsLoading(false);
    }
  }, [appointmentsLoading]);

  // Helper functions
  const getPatientName = (contactId: number, appointment?: Appointment) => {
    // Para eventos do Google Calendar, mostrar o título do evento
    if (appointment?.google_calendar_event_id) {
      return appointment.doctor_name || 'Evento do Google Calendar';
    }
    const contact = contacts.find((c: any) => c.id === contactId);
    return contact ? contact.name : 'Paciente não encontrado';
  };

  // Calendar height and positioning helpers
  const PIXELS_PER_HOUR = 120; // Base height for 1 hour slot (doubled for better visibility)
  const PIXELS_PER_MINUTE = PIXELS_PER_HOUR / 60; // 2 pixels per minute
  const PIXELS_PER_QUARTER = PIXELS_PER_HOUR / 4; // 30 pixels for 15-minute segments

  // Calculate appointment height based on duration
  const getAppointmentHeight = (durationMinutes: number): number => {
    return Math.max(durationMinutes * PIXELS_PER_MINUTE, 20); // Minimum 20px height
  };

  // Calculate appointment top position based on start time within the hour
  const getAppointmentTopPosition = (scheduledDate: string | Date | null): number => {
    if (!scheduledDate) return 0;
    const date = new Date(scheduledDate);
    const minutes = date.getMinutes();
    return minutes * PIXELS_PER_MINUTE; // Position based on minutes past the hour
  };

  // Get appointment duration in minutes
  const getAppointmentDuration = (appointment: Appointment): number => {
    return appointment.duration_minutes || 60; // Default to 60 minutes if not specified
  };

  // Check if appointment spans multiple hours
  const getAppointmentEndHour = (appointment: Appointment): number => {
    if (!appointment.scheduled_date) return 0;
    const startDate = new Date(appointment.scheduled_date);
    const duration = getAppointmentDuration(appointment);
    const endDate = new Date(startDate.getTime() + duration * 60000);
    return endDate.getHours();
  };

  const getPatientInfo = (contactId: number) => {
    return contacts.find((c: any) => c.id === contactId);
  };

  const getEventColor = (status: string, isGoogleCalendarEvent?: boolean) => {
    // Para eventos do Google Calendar, sempre usar fundo cinza
    if (isGoogleCalendarEvent) {
      return { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300', dot: 'bg-gray-500' };
    }

    // Para compromissos do sistema, usar fundo branco com borda colorida
    const config = getStatusConfig(status);
    if (!config) {
      return { bg: 'bg-white', text: 'text-gray-700', border: 'border-gray-300', dot: 'bg-gray-500' };
    }

    // Convert config colors to event colors - white background with colored borders
    const colorMap: Record<string, { bg: string; text: string; border: string; dot: string }> = {
      'bg-yellow-100 text-yellow-800 border-yellow-200': { bg: 'bg-white', text: 'text-yellow-700', border: 'border-yellow-400', dot: 'bg-yellow-500' },
      'bg-blue-100 text-blue-800 border-blue-200': { bg: 'bg-white', text: 'text-blue-700', border: 'border-blue-400', dot: 'bg-blue-500' },
      'bg-green-100 text-green-800 border-green-200': { bg: 'bg-white', text: 'text-green-700', border: 'border-green-400', dot: 'bg-green-500' },
      'bg-purple-100 text-purple-800 border-purple-200': { bg: 'bg-white', text: 'text-purple-700', border: 'border-purple-400', dot: 'bg-purple-500' },
      'bg-orange-100 text-orange-800 border-orange-200': { bg: 'bg-white', text: 'text-orange-700', border: 'border-orange-400', dot: 'bg-orange-500' },
      'bg-red-100 text-red-800 border-red-200': { bg: 'bg-white', text: 'text-red-700', border: 'border-red-400', dot: 'bg-red-500' },
    };

    return colorMap[config.color] || { bg: 'bg-white', text: 'text-gray-700', border: 'border-gray-300', dot: 'bg-gray-500' };
  };

  const handleAppointmentClick = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setIsDialogOpen(true);
  };

  const handleEditAppointment = (appointmentId: number) => {
    setEditingAppointmentId(appointmentId);
    setAppointmentEditorOpen(true);
  };

  const navigateCalendar = (direction: 'prev' | 'next') => {
    if (calendarView === 'month') {
      setCurrentDate(direction === 'prev' ? subMonths(currentDate, 1) : addMonths(currentDate, 1));
    } else if (calendarView === 'week') {
      setCurrentDate(direction === 'prev' ? subWeeks(currentDate, 1) : addWeeks(currentDate, 1));
    } else {
      setCurrentDate(direction === 'prev' ? subDays(currentDate, 1) : addDays(currentDate, 1));
    }
  };

  const getCalendarDays = () => {
    if (calendarView === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 0 });
      const end = endOfWeek(currentDate, { weekStartsOn: 0 });
      return eachDayOfInterval({ start, end });
    } else if (calendarView === 'day') {
      return [currentDate];
    } else {
      // Month view
      const start = startOfWeek(startOfMonth(currentDate));
      const end = endOfWeek(endOfMonth(currentDate));
      return eachDayOfInterval({ start, end });
    }
  };

  const getAppointmentsForDate = (date: Date) => {
    return appointments.filter((appointment: Appointment) => {
      if (!appointment.scheduled_date) return false;
      const appointmentDate = new Date(appointment.scheduled_date);
      return isSameDay(appointmentDate, date);
    });
  };

  const showDayEvents = (date: Date, events: Appointment[]) => {
    setDayEventsDialog({
      open: true,
      date,
      events
    });
  };

  if (isLoading) {
    return (
      <div className="p-4 lg:p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-1/4"></div>
          <div className="h-64 bg-slate-200 rounded"></div>
        </div>
      </div>
    );
  }

  const calendarDays = getCalendarDays();

  return (
    <div className="p-4 lg:p-6">
      {/* Header Section */}
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Consultas</h1>
          <p className="text-slate-600">Gerencie e visualize todas as sessões agendadas</p>
        </div>
        <Button 
          className="flex items-center gap-2"
          onClick={() => setIsCreateDialogOpen(true)}
        >
          <Plus className="w-4 h-4" />
          Nova Consulta
        </Button>
      </div>

      {/* Comprehensive Appointment Editor */}
      <AppointmentEditor
        appointmentId={editingAppointmentId}
        isOpen={appointmentEditorOpen}
        onClose={() => {
          setAppointmentEditorOpen(false);
          setEditingAppointmentId(undefined);
        }}
        onSave={() => {
          // Refresh appointments list
          queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
        }}
      />

      {/* Create Appointment Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Agendar Nova Consulta</DialogTitle>
            <DialogDescription>
              Preencha os dados para agendar uma nova consulta. O sistema verificará automaticamente a disponibilidade.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => createAppointmentMutation.mutate(data))} className="space-y-4">
              {/* Appointment Name */}
              <FormField
                control={form.control}
                name="appointment_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Compromisso *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ex: Consulta Dr. Silva, Retorno Cardiologia..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Contact Selection with Cadastrar button inline */}
              <FormField
                control={form.control}
                name="contact_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm text-gray-700">Paciente *</FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <Popover open={contactComboboxOpen} onOpenChange={setContactComboboxOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={contactComboboxOpen}
                              className="flex-1 justify-between h-11 text-left font-normal px-3"
                            >
                              {field.value ? (
                                <span className="truncate">
                                  {contacts.find((contact: Contact) => contact.id.toString() === field.value)?.name}
                                </span>
                              ) : (
                                <span className="text-gray-500">Buscar paciente...</span>
                              )}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                        <PopoverContent className="w-[400px] p-0" align="start">
                          <Command>
                            <CommandInput 
                              placeholder="Digite pelo menos 2 caracteres..." 
                              className="border-b"
                              value={patientSearchQuery}
                              onValueChange={setPatientSearchQuery}
                            />
                            {patientSearchQuery.length === 0 && (
                              <div className="py-6 text-center text-sm text-gray-500">
                                <div>Digite pelo menos 2 caracteres</div>
                              </div>
                            )}
                            {patientSearchQuery.length === 1 && (
                              <div className="py-6 text-center text-sm text-gray-500">
                                <div>Digite pelo menos 2 caracteres</div>
                              </div>
                            )}
                            {patientSearchQuery.length >= 2 && (
                              <>
                                <CommandEmpty className="py-6 text-center text-sm text-gray-500">
                                  <div>Nenhum paciente encontrado com "{patientSearchQuery}"</div>
                                  <Button 
                                    variant="link" 
                                    size="sm" 
                                    className="mt-2 text-blue-600"
                                    onClick={() => {
                                      setContactComboboxOpen(false);
                                      setPatientSearchQuery("");
                                      setShowNewPatientDialog(true);
                                      patientForm.setValue("name", patientSearchQuery);
                                    }}
                                  >
                                    <Plus className="mr-1 h-4 w-4" />
                                    Cadastrar paciente
                                  </Button>
                                </CommandEmpty>
                                <CommandGroup className="max-h-64 overflow-y-auto">
                                  {contacts
                                    .filter((contact: Contact) => 
                                      contact.name.toLowerCase().includes(patientSearchQuery.toLowerCase())
                                    )
                                    .map((contact: Contact) => (
                                    <CommandItem
                                      key={contact.id}
                                      value={contact.name}
                                      onSelect={() => {
                                        field.onChange(contact.id.toString());
                                        form.setValue("contact_whatsapp", contact.phone || "");
                                        form.setValue("contact_email", contact.email || "");
                                        setContactComboboxOpen(false);
                                        setPatientSearchQuery("");
                                      }}
                                      className="flex items-center gap-3 p-3 cursor-pointer"
                                    >
                                      <div className="flex items-center justify-center w-8 h-8 bg-gray-500 text-white rounded-full text-sm font-medium flex-shrink-0">
                                        {contact.name.charAt(0).toUpperCase()}
                                      </div>
                                      <div className="flex flex-col min-w-0 flex-1">
                                        <span className="font-medium text-gray-900 truncate">{contact.name}</span>
                                        {contact.phone && (
                                          <span className="text-sm text-gray-500">{contact.phone}</span>
                                        )}
                                      </div>
                                      {field.value === contact.id.toString() && (
                                        <Check className="h-4 w-4 text-blue-600 flex-shrink-0" />
                                      )}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </>
                            )}
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </FormControl>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 text-blue-500 hover:text-white hover:bg-blue-500 border-blue-500 font-normal px-4"
                      onClick={() => setShowNewPatientDialog(true)}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Cadastrar
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

              {/* Professional and Consultation Type */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="user_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm text-gray-700">Profissional *</FormLabel>
                      <FormControl>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder="Selecione o profissional" />
                          </SelectTrigger>
                          <SelectContent>
                            {clinicUsers.map((user: any) => (
                              <SelectItem key={user.user_id} value={user.user_id.toString()}>
                                {user.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm text-gray-700">Tipo de Consulta *</FormLabel>
                      <FormControl>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder="Consulta" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="consulta">Consulta</SelectItem>
                            <SelectItem value="retorno">Retorno</SelectItem>
                            <SelectItem value="avaliacao">Avaliação</SelectItem>
                            <SelectItem value="procedimento">Procedimento</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Date, Time, Duration and Find Time Button */}
              <div className="space-y-2">
                <div className="grid grid-cols-12 gap-3 items-start">
                  <div className="col-span-3">
                    <FormField
                      control={form.control}
                      name="scheduled_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm text-gray-700">Data da consulta</FormLabel>
                          <FormControl>
                            <Input
                              type="date"
                              {...field}
                              className="h-11"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="col-span-3">
                    <FormField
                      control={form.control}
                      name="scheduled_time"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm text-gray-700">Horário</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                type="time"
                                {...field}
                                className="h-11 pr-8"
                              />
                              <Clock className="absolute right-3 top-3.5 h-4 w-4 text-gray-400" />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="col-span-2">
                    <FormField
                      control={form.control}
                      name="duration"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm text-gray-700">Duração</FormLabel>
                          <FormControl>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <SelectTrigger className="h-11">
                                <SelectValue placeholder="60" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="30">30</SelectItem>
                                <SelectItem value="60">60</SelectItem>
                                <SelectItem value="90">90</SelectItem>
                                <SelectItem value="120">120</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="col-span-4">
                    <FormItem>
                      <FormLabel className="text-sm text-gray-700 invisible">Ação</FormLabel>
                      <FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full h-11 text-blue-500 hover:text-white hover:bg-blue-500 border-blue-500 font-normal px-6"
                          onClick={() => {
                            const targetDate = watchedDate || format(new Date(), 'yyyy-MM-dd');
                            const targetDuration = watchedDuration || '30';
                            setFindTimeSlotsOpen(true);
                          }}
                        >
                          <Clock className="mr-2 h-4 w-4" />
                          Encontrar horário
                        </Button>
                      </FormControl>
                    </FormItem>
                  </div>
                </div>
              </div>

              {/* Smart Availability Status - Combined availability + context */}
              {availabilityConflict && (
                <div className={`p-3 rounded-lg border ${
                  availabilityConflict.hasConflict
                    ? "bg-red-50 border-red-200 text-red-800"
                    : workingHoursWarning && workingHoursWarning.hasWarning
                      ? "bg-orange-50 border-orange-200 text-orange-800"
                      : "bg-green-50 border-green-200 text-green-800"
                }`}>
                  <div className="flex items-start gap-3">
                    {availabilityConflict.hasConflict ? (
                      <Clock className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    ) : workingHoursWarning && workingHoursWarning.hasWarning ? (
                      <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    ) : (
                      <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <div className="text-sm font-medium">
                        {availabilityConflict.hasConflict ? (
                          availabilityConflict.message
                        ) : workingHoursWarning && workingHoursWarning.hasWarning ? (
                          <>Horário livre, mas {workingHoursWarning.message.toLowerCase()}</>
                        ) : (
                          'Horário disponível'
                        )}
                      </div>
                      {!availabilityConflict.hasConflict && workingHoursWarning && workingHoursWarning.hasWarning && workingHoursWarning.details && (
                        <div className="text-xs text-orange-700 mt-1">
                          {workingHoursWarning.details}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}



              {/* Contact Information */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="contact_whatsapp"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>WhatsApp</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="(11) 99999-9999"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="contact_email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-mail</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="paciente@email.com"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Notes */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Observações sobre a consulta..."
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createAppointmentMutation.isPending || (availabilityConflict?.hasConflict === true)}
                >
                  {createAppointmentMutation.isPending ? "Agendando..." : "Agendar Consulta"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <div className="bg-white rounded-lg shadow-sm border">
        {/* View Mode Toggle */}
        <div className="p-4 border-b border-slate-200 flex justify-between items-center">
          <div className="flex space-x-1 bg-slate-100 rounded-lg p-1">
            <Button
              variant={viewMode === "list" ? "default" : "outline"}
              onClick={() => setViewMode("list")}
              className="flex items-center gap-2"
            >
              <List className="w-4 h-4" />
              Lista
            </Button>
            <Button
              variant={viewMode === "calendar" ? "default" : "outline"}
              onClick={() => setViewMode("calendar")}
              className="flex items-center gap-2"
            >
              <CalendarDays className="w-4 h-4" />
              Calendário
            </Button>
          </div>

          {viewMode === "calendar" && (
            <div className="flex items-center space-x-4">
              {/* Calendar View Selector */}
              <div className="flex space-x-1 bg-slate-100 rounded-lg p-1">
                <Button
                  variant={calendarView === "day" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => {
                    setCalendarView("day");
                    setCurrentDate(new Date());
                  }}
                  className="text-xs"
                >
                  Dia
                </Button>
                <Button
                  variant={calendarView === "week" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setCalendarView("week")}
                  className="text-xs"
                >
                  Semana
                </Button>
                <Button
                  variant={calendarView === "month" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setCalendarView("month")}
                  className="text-xs"
                >
                  Mês
                </Button>
              </div>

              {/* Calendar Navigation */}
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm" onClick={() => navigateCalendar('prev')}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm font-medium min-w-32 text-center">
                  {calendarView === 'month' && format(currentDate, "MMMM yyyy", { locale: ptBR })}
                  {calendarView === 'week' && `${format(startOfWeek(currentDate), "dd MMM", { locale: ptBR })} - ${format(endOfWeek(currentDate), "dd MMM yyyy", { locale: ptBR })}`}
                  {calendarView === 'day' && format(currentDate, "dd 'de' MMMM yyyy", { locale: ptBR })}
                </span>
                <Button variant="outline" size="sm" onClick={() => navigateCalendar('next')}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>

              <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
                Hoje
              </Button>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          {viewMode === "list" ? (
            /* List View */
            <div className="space-y-4">
              {appointments.filter((app: Appointment) => !app.google_calendar_event_id).length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  Nenhuma consulta encontrada
                </div>
              ) : (
                appointments
                  .filter((app: Appointment) => !app.google_calendar_event_id)
                  .sort((a: Appointment, b: Appointment) => {
                    return new Date(a.scheduled_date || 0).getTime() - new Date(b.scheduled_date || 0).getTime();
                  })
                  .map((appointment: Appointment) => {
                    const patientName = getPatientName(appointment.contact_id, appointment);
                    const colors = getEventColor(appointment.status, !!appointment.google_calendar_event_id);
                    
                    return (
                      <Card key={appointment.id} className="border border-slate-200 bg-white cursor-pointer hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                              <div className={`w-3 h-3 ${colors.dot} rounded-full`}></div>
                              <div>
                                <h3 className="font-semibold text-slate-900">{patientName}</h3>
                                <div className="flex items-center space-x-4 text-sm text-slate-600">
                                  <span className="flex items-center">
                                    <Clock className="w-4 h-4 mr-1" />
                                    {appointment.scheduled_date ? format(new Date(appointment.scheduled_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : 'Data não definida'}
                                  </span>
                                  {appointment.doctor_name && !appointment.google_calendar_event_id && (
                                    <span className="flex items-center">
                                      <Stethoscope className="w-4 h-4 mr-1" />
                                      {appointment.doctor_name}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              {/* Clickable Status Badge with Dropdown */}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <div onClick={(e) => e.stopPropagation()}>
                                    <Badge 
                                      className={`${statusLabels[appointment.status]?.color || 'bg-gray-100 text-gray-800'} cursor-pointer hover:opacity-80 hover:shadow-sm transition-all duration-200 border border-opacity-20`}
                                    >
                                      {statusLabels[appointment.status]?.label || appointment.status}
                                      <span className="ml-1 text-xs opacity-60">▼</span>
                                    </Badge>
                                  </div>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  {/* Status Change Options */}
                                  {mainStatusList
                                    .filter((status) => status !== appointment.status)
                                    .map((status) => {
                                      const config = statusConfig[status];
                                      return (
                                        <DropdownMenuItem
                                          key={status}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            updateStatusMutation.mutate({
                                              appointmentId: appointment.id,
                                              status: status
                                            });
                                          }}
                                          disabled={updateStatusMutation.isPending}
                                        >
                                          <div className={`w-3 h-3 ${config.badgeColor} rounded-full mr-2`}></div>
                                          Alterar para {config.label}
                                        </DropdownMenuItem>
                                      );
                                    })}
                                </DropdownMenuContent>
                              </DropdownMenu>
                              
                              {/* Actions Menu */}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <MoreVertical className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-40">
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAppointmentClick(appointment);
                                    }}
                                  >
                                    <Eye className="w-4 h-4 mr-2" />
                                    Ver detalhes
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEditAppointment(appointment.id);
                                    }}
                                  >
                                    <Edit className="w-4 h-4 mr-2" />
                                    Editar consulta
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
              )}
            </div>
          ) : (
            /* Calendar View */
            <div>
              {calendarView === "month" && (
                <div className="grid grid-cols-7 gap-px bg-slate-200 rounded-lg overflow-hidden">
                  {/* Calendar headers */}
                  {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => (
                    <div key={day} className="bg-slate-50 p-2 text-center text-sm font-medium text-slate-600">
                      {day}
                    </div>
                  ))}
                  
                  {/* Calendar days */}
                  {calendarDays.map((day) => {
                    const dayAppointments = getAppointmentsForDate(day);
                    const isCurrentMonth = isSameMonth(day, currentDate);
                    const backgroundClass = getCalendarCellBackgroundClass(day);
                    const isToday = isSameDay(day, today);
                    
                    return (
                      <div
                        key={day.toISOString()}
                        className={`${backgroundClass} p-2 min-h-24 ${!isCurrentMonth ? 'text-slate-400' : ''} ${isToday ? 'bg-blue-50' : ''}`}
                      >
                        <div className="text-sm font-medium mb-1">
                          {format(day, 'd')}
                        </div>
                        <div className="space-y-1">
                          {dayAppointments.slice(0, 2).map((appointment: Appointment) => {
                            const displayName = appointment.google_calendar_event_id 
                              ? (appointment.doctor_name || 'Evento do Google Calendar')
                              : getPatientName(appointment.contact_id, appointment);
                            const time = appointment.scheduled_date ? format(new Date(appointment.scheduled_date), 'HH:mm') : '';
                            const colors = getEventColor(appointment.status, !!appointment.google_calendar_event_id);

                            return (
                              <EventTooltip key={appointment.id} appointment={appointment} patientName={displayName}>
                                <div
                                  className={`text-xs p-1 ${colors.bg} ${colors.text} rounded truncate cursor-pointer ${colors.border} border hover:opacity-90`}
                                  onClick={() => handleAppointmentClick(appointment)}
                                >
                                  <div className="flex items-center gap-1">
                                    <div className={`w-2 h-2 ${colors.dot} rounded-full flex-shrink-0`}></div>
                                    <span className="truncate">{time} {displayName.split(' ')[0]}</span>
                                  </div>
                                </div>
                              </EventTooltip>
                            );
                          })}
                          {dayAppointments.length > 2 && (
                            <div
                              className="text-xs text-slate-600 cursor-pointer hover:text-blue-600"
                              onClick={() => showDayEvents(day, dayAppointments)}
                            >
                              +{dayAppointments.length - 2} mais
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {calendarView === "week" && (
                <div className="bg-slate-200 rounded-lg overflow-hidden">
                  {/* Headers */}
                  <div className="grid grid-cols-8 gap-px">
                    {/* Time column header */}
                    <div className="bg-slate-50 p-2 text-center font-medium">Hora</div>
                    
                    {/* Day headers */}
                    {calendarDays.slice(0, 7).map((day) => (
                      <div key={day.toISOString()} className="bg-slate-50 p-2 text-center">
                        <div className="text-sm font-medium">{format(day, 'EEE', { locale: ptBR })}</div>
                        <div className={`text-lg ${isSameDay(day, today) ? 'text-blue-600 font-bold' : ''}`}>
                          {format(day, 'd')}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Time slots grid */}
                  <div className="grid grid-cols-8 gap-px">
                    {Array.from({ length: 15 }, (_, i) => i + 7).map((hour) => (
                      <div key={hour} className="contents">
                        {/* Time label with improved formatting */}
                        <div className="bg-white p-2 text-sm text-slate-600 border-r flex items-start justify-center relative" style={{ height: `${PIXELS_PER_HOUR}px` }}>
                          <span className="font-medium">{hour.toString().padStart(2, '0')}h</span>
                          
                          {/* 15-minute grid lines */}
                          <div className="absolute inset-x-0 top-0 h-full">
                            {[1, 2, 3].map((quarter) => (
                              <div 
                                key={quarter}
                                className="absolute left-0 right-0 border-t border-slate-100"
                                style={{ top: `${quarter * PIXELS_PER_QUARTER}px` }}
                              />
                            ))}
                          </div>
                        </div>
                        
                        {/* Day columns */}
                        {calendarDays.slice(0, 7).map((day) => {
                          const allDayAppointments = getAppointmentsForDate(day);
                          
                          // Get appointments that start in this hour slot
                          const slotAppointments = allDayAppointments.filter((apt: Appointment) => {
                            if (!apt.scheduled_date) return false;
                            const aptStartHour = new Date(apt.scheduled_date).getHours();
                            return aptStartHour === hour;
                          });
                          
                          return (
                            <div 
                              key={`${day.toISOString()}-${hour}`} 
                              className={`${getCalendarCellBackgroundClass(day, hour)} border-r relative overflow-hidden`}
                              style={{ height: `${PIXELS_PER_HOUR}px` }}
                            >
                              {/* 15-minute clickable slots */}
                              {[0, 15, 30, 45].map((minute) => {
                                const isSlotAvailable = isTimeSlotAvailable(day, hour, minute);
                                const slotDateTime = new Date(day);
                                slotDateTime.setHours(hour, minute, 0, 0);
                                const timeLabel = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                                
                                return (
                                  <div
                                    key={`${minute}`}
                                    className={`absolute left-0 right-0 group ${isSlotAvailable ? 'cursor-crosshair hover:bg-blue-50' : ''}`}
                                    style={{ 
                                      top: `${(minute / 60) * PIXELS_PER_HOUR}px`, 
                                      height: `${PIXELS_PER_QUARTER}px` 
                                    }}
                                    onClick={() => {
                                      if (isSlotAvailable) {
                                        handleQuickCreateAppointment(day, hour, minute);
                                      }
                                    }}
                                  >
                                    {/* Quarter hour border */}
                                    <div className="absolute top-0 left-0 right-0 border-t border-slate-100" />
                                    
                                    {/* Time indicator on hover */}
                                    {isSlotAvailable && (
                                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                                        <div className="bg-blue-100 border border-blue-300 rounded px-1 py-0.5 text-xs font-medium text-blue-800">
                                          {timeLabel}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                              
                              {/* Hour boundary line */}
                              <div className="absolute top-0 left-0 right-0 border-t-2 border-slate-200" />
                              
                              {/* Lunch time highlighting */}
                              {hour === 12 && clinicConfig?.has_lunch_break && (
                                <div className="absolute inset-0 bg-slate-50 opacity-30 pointer-events-none" />
                              )}
                              
                              {slotAppointments.map((appointment: Appointment) => {
                                const colors = getEventColor(appointment.status, !!appointment.google_calendar_event_id);
                                const patientName = getPatientName(appointment.contact_id, appointment);
                                const time = appointment.scheduled_date ? format(new Date(appointment.scheduled_date), 'HH:mm') : '';
                                const duration = getAppointmentDuration(appointment);
                                const height = getAppointmentHeight(duration);
                                const topPosition = getAppointmentTopPosition(appointment.scheduled_date);

                                return (
                                  <EventTooltip key={appointment.id} appointment={appointment} patientName={patientName}>
                                    <div
                                      className={`absolute left-1 right-1 text-xs p-1 ${colors.bg} ${colors.text} rounded cursor-pointer ${colors.border} border hover:opacity-90 transition-colors overflow-hidden`}
                                      style={{ 
                                        top: `${topPosition}px`,
                                        height: `${height}px`,
                                        zIndex: 10
                                      }}
                                      onClick={() => handleAppointmentClick(appointment)}
                                    >
                                      <div className="flex items-start gap-1 h-full">
                                        <div className={`w-2 h-2 ${colors.dot} rounded-full flex-shrink-0 mt-0.5`}></div>
                                        <div className="flex-1 overflow-hidden">
                                          <div className="truncate">{patientName}</div>
                                        </div>
                                      </div>
                                    </div>
                                  </EventTooltip>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {calendarView === "day" && (
                <div className="space-y-4">
                  <div className="text-center text-lg font-semibold">
                    {format(currentDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                  </div>
                  
                  <div className="bg-slate-200 rounded-lg overflow-hidden">
                    <div className="flex">
                      {/* Time column */}
                      <div className="w-24 bg-slate-50">
                        <div className="p-2 text-center font-medium border-b">Hora</div>
                        {Array.from({ length: 15 }, (_, i) => i + 7).map((hour) => (
                          <div 
                            key={hour} 
                            className="p-2 text-sm text-slate-600 border-b flex items-start justify-center relative"
                            style={{ height: `${PIXELS_PER_HOUR}px` }}
                          >
                            <span className="font-medium">{hour.toString().padStart(2, '0')}h</span>
                            
                            {/* 15-minute grid lines for time column */}
                            <div className="absolute inset-x-0 top-0 h-full">
                              {[1, 2, 3].map((quarter) => (
                                <div 
                                  key={quarter}
                                  className="absolute left-0 right-0 border-t border-slate-200"
                                  style={{ top: `${quarter * PIXELS_PER_QUARTER}px` }}
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {/* Appointments column */}
                      <div className="flex-1 bg-white">
                        <div className="p-2 text-center font-medium border-b bg-slate-50">Compromissos</div>
                        <div className="relative">
                          {Array.from({ length: 15 }, (_, i) => i + 7).map((hour) => (
                            <div 
                              key={hour} 
                              className={`border-b border-slate-100 relative ${getCalendarCellBackgroundClass(currentDate, hour)}`}
                              style={{ height: `${PIXELS_PER_HOUR}px` }}
                            >
                              {/* 15-minute clickable slots */}
                              {[0, 15, 30, 45].map((minute) => {
                                const isSlotAvailable = isTimeSlotAvailable(currentDate, hour, minute);
                                const timeLabel = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                                
                                return (
                                  <div
                                    key={`${minute}`}
                                    className={`absolute left-0 right-0 group ${isSlotAvailable ? 'cursor-crosshair hover:bg-blue-50' : ''}`}
                                    style={{ 
                                      top: `${(minute / 60) * PIXELS_PER_HOUR}px`, 
                                      height: `${PIXELS_PER_QUARTER}px` 
                                    }}
                                    onClick={() => {
                                      if (isSlotAvailable) {
                                        handleQuickCreateAppointment(currentDate, hour, minute);
                                      }
                                    }}
                                  >
                                    {/* Quarter hour border */}
                                    <div className="absolute top-0 left-0 right-0 border-t border-slate-100" />
                                    
                                    {/* Time indicator on hover */}
                                    {isSlotAvailable && (
                                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                                        <div className="bg-blue-100 border border-blue-300 rounded px-2 py-1 text-xs font-medium text-blue-800">
                                          {timeLabel}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                              
                              {/* Hour boundary line */}
                              <div className="absolute top-0 left-0 right-0 border-t-2 border-slate-200"></div>
                              
                              {/* Lunch time highlighting */}
                              {hour === 12 && clinicConfig?.has_lunch_break && (
                                <div className="absolute inset-0 bg-slate-50 opacity-30 pointer-events-none" />
                              )}
                            </div>
                          ))}
                          
                          {/* Appointments positioned absolutely */}
                          {getAppointmentsForDate(currentDate).map((appointment: Appointment) => {
                            if (!appointment.scheduled_date) return null;
                            
                            const colors = getEventColor(appointment.status, !!appointment.google_calendar_event_id);
                            const patientName = getPatientName(appointment.contact_id, appointment);
                            const time = appointment.scheduled_date ? format(new Date(appointment.scheduled_date), 'HH:mm') : '';
                            const duration = getAppointmentDuration(appointment);
                            const height = getAppointmentHeight(duration);
                            
                            const startDate = new Date(appointment.scheduled_date);
                            const startHour = startDate.getHours();
                            const startMinutes = startDate.getMinutes();
                            
                            // Calculate position from 8 AM start
                            const hourOffset = startHour - 8;
                            const totalMinutesFromStart = (hourOffset * 60) + startMinutes;
                            const topPosition = totalMinutesFromStart * PIXELS_PER_MINUTE;

                            return (
                              <EventTooltip key={appointment.id} appointment={appointment} patientName={patientName}>
                                <div
                                  className={`absolute left-2 right-2 text-sm p-3 ${colors.bg} ${colors.text} rounded cursor-pointer ${colors.border} border hover:opacity-90 transition-colors overflow-hidden shadow-sm`}
                                  style={{ 
                                    top: `${topPosition}px`,
                                    height: `${height}px`,
                                    zIndex: 10
                                  }}
                                  onClick={() => handleAppointmentClick(appointment)}
                                >
                                  <div className="flex items-start gap-2 h-full">
                                    <div className={`w-3 h-3 ${colors.dot} rounded-full flex-shrink-0 mt-1`}></div>
                                    <div className="flex-1 overflow-hidden">
                                      <div className="font-semibold truncate">{patientName}</div>
                                      {appointment.doctor_name && !appointment.google_calendar_event_id && (
                                        <div className="text-xs mt-1 opacity-90">Dr. {appointment.doctor_name}</div>
                                      )}
                                      {appointment.appointment_type && (
                                        <div className="text-xs mt-1 opacity-90 truncate">{appointment.appointment_type}</div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </EventTooltip>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Appointment Details Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              Detalhes da Consulta
              <div className="flex space-x-2">
                {selectedAppointment && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditAppointment(selectedAppointment.id)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsDialogOpen(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          {selectedAppointment && (
            <div className="space-y-6">
              {/* Google Calendar Event Layout */}
              {selectedAppointment.google_calendar_event_id ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
                    <span className="text-sm font-medium text-gray-800">Evento do Google Calendar</span>
                  </div>

                  {/* Event Information */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Informações do Evento
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Título do Evento</p>
                        <p className="font-medium">{selectedAppointment.doctor_name || 'Evento do Google Calendar'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Data e Hora</p>
                        <p className="font-medium flex items-center gap-2">
                          <Clock className="w-3 h-3" />
                          {selectedAppointment.scheduled_date ? format(new Date(selectedAppointment.scheduled_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : 'Data não definida'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Duração</p>
                        <p className="font-medium">{selectedAppointment.duration_minutes || 60} minutos</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Status</p>
                        <p className="text-gray-500 italic">-</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Especialidade</p>
                        <p className="text-gray-500 italic">-</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Paciente</p>
                        <p className="text-gray-500 italic">-</p>
                      </div>
                    </div>
                    {selectedAppointment.session_notes && (
                      <div className="mt-4">
                        <p className="text-sm text-gray-600">Observações</p>
                        <p className="font-medium">{selectedAppointment.session_notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Regular Appointment Layout */
                <div className="space-y-6">
                  {/* Patient Information */}
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Informações do Paciente
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-slate-600">Nome</p>
                        <p className="font-medium">{getPatientName(selectedAppointment.contact_id, selectedAppointment)}</p>
                      </div>
                      {getPatientInfo(selectedAppointment.contact_id) && (
                        <>
                          <div>
                            <p className="text-sm text-slate-600">Telefone</p>
                            <p className="font-medium flex items-center gap-2">
                              <Phone className="w-3 h-3" />
                              {getPatientInfo(selectedAppointment.contact_id)?.phone}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-slate-600">Email</p>
                            <p className="font-medium">{getPatientInfo(selectedAppointment.contact_id)?.email || 'Não informado'}</p>
                          </div>
                          <div>
                            <p className="text-sm text-slate-600">Idade</p>
                            <p className="font-medium">{getPatientInfo(selectedAppointment.contact_id)?.age || 'Não informado'} anos</p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Appointment Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <p className="text-sm text-slate-600">Data e Hora</p>
                      <p className="font-medium flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        {selectedAppointment.scheduled_date 
                          ? format(new Date(selectedAppointment.scheduled_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                          : 'Não definido'
                        }
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">Status</p>
                      <span className="font-medium">{statusLabels[selectedAppointment.status]?.label || selectedAppointment.status}</span>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">Duração</p>
                      <p className="font-medium">{selectedAppointment.duration_minutes || 60} minutos</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">Especialidade</p>
                      <p className="font-medium">{selectedAppointment.specialty || 'Não especificado'}</p>
                    </div>
                  </div>

                  {/* Notes */}
                  {selectedAppointment.session_notes && (
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h3 className="font-semibold text-slate-800 mb-3">Observações</h3>
                      <p className="text-slate-700">{selectedAppointment.session_notes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Day Events Dialog */}
      <Dialog open={dayEventsDialog.open} onOpenChange={(open) => setDayEventsDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              Consultas - {format(dayEventsDialog.date, "dd 'de' MMMM", { locale: ptBR })}
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-4 top-4"
              onClick={() => setDayEventsDialog(prev => ({ ...prev, open: false }))}
            >
              <X className="w-4 h-4" />
            </Button>
          </DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {dayEventsDialog.events.map((appointment: any) => {
              const colors = getEventColor(appointment.status, !!appointment.google_calendar_event_id);
              const displayName = appointment.google_calendar_event_id 
                ? (appointment.doctor_name || 'Evento do Google Calendar')
                : getPatientName(appointment.contact_id, appointment);
              const time = appointment.scheduled_date ? format(new Date(appointment.scheduled_date), 'HH:mm') : '';
              
              return (
                <div
                  key={appointment.id}
                  className={`p-3 rounded-lg ${colors.border} border ${colors.bg} cursor-pointer hover:shadow-sm hover:opacity-90`}
                  onClick={() => {
                    handleAppointmentClick(appointment);
                    setDayEventsDialog(prev => ({ ...prev, open: false }));
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 ${colors.dot} rounded-full`}></div>
                      <div>
                        <p className="font-medium">{time} - {displayName}</p>
                        {appointment.google_calendar_event_id ? (
                          <p className="text-sm text-gray-600">Evento do Google Calendar</p>
                        ) : (
                          appointment.doctor_name && (
                            <p className="text-sm text-slate-600">Dr. {appointment.doctor_name}</p>
                          )
                        )}
                      </div>
                    </div>
                    {appointment.google_calendar_event_id ? (
                      <Badge className="bg-gray-100 text-gray-800">
                        -
                      </Badge>
                    ) : (
                      <Badge className={statusLabels[appointment.status]?.color || 'bg-gray-100 text-gray-800'}>
                        {statusLabels[appointment.status]?.label || appointment.status}
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
            
            {dayEventsDialog.events.length === 0 && (
              <div className="text-center py-8 text-slate-500">
                Nenhum compromisso encontrado para este dia.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Find Time Slots Modal */}
      <Dialog open={findTimeSlotsOpen} onOpenChange={setFindTimeSlotsOpen}>
        <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto z-[60]">
          <FindTimeSlots
            selectedDate={watchedDate || ''}
            duration={parseInt(watchedDuration) || 30}
            onTimeSelect={(time, date) => {
              form.setValue("scheduled_time", time);
              form.setValue("scheduled_date", date);
              setFindTimeSlotsOpen(false);
            }}
            onClose={() => setFindTimeSlotsOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Patient Registration Dialog */}
      <Dialog open={showNewPatientDialog} onOpenChange={setShowNewPatientDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cadastrar novo paciente</DialogTitle>
          </DialogHeader>
          
          <Form {...patientForm}>
            <form onSubmit={patientForm.handleSubmit((data) => {
              console.log('📝 Patient form submitted!');
              console.log('📋 Form data received:', data);
              console.log('🔍 Form validation state:', patientForm.formState);
              console.log('🔍 Form errors:', patientForm.formState.errors);
              console.log('🚀 Triggering createPatientMutation...');
              createPatientMutation.mutate(data);
            })} className="space-y-6">
              <Tabs value={patientFormTab} onValueChange={setPatientFormTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="basic">Informações básicas</TabsTrigger>
                  <TabsTrigger value="additional">Informações complementares</TabsTrigger>
                  <TabsTrigger value="insurance">Convênio</TabsTrigger>
                </TabsList>

                {/* Tab 1: Basic Information */}
                <TabsContent value="basic" className="space-y-4 mt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={patientForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>* Nome completo</FormLabel>
                          <FormControl>
                            <Input placeholder="Digite o nome completo" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={patientForm.control}
                      name="gender"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Gênero</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="masculino">Masculino</SelectItem>
                              <SelectItem value="feminino">Feminino</SelectItem>
                              <SelectItem value="outro">Outro</SelectItem>
                              <SelectItem value="nao_informado">Não informado</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={patientForm.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Celular</FormLabel>
                          <FormControl>
                            <Input placeholder="(11) 99999-9999" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={patientForm.control}
                      name="reminder_preference"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Lembretes automáticos</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue="whatsapp">
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="WhatsApp" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="whatsapp">WhatsApp</SelectItem>
                              <SelectItem value="sms">SMS</SelectItem>
                              <SelectItem value="email">Email</SelectItem>
                              <SelectItem value="none">Nenhum</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={patientForm.control}
                      name="cpf"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CPF</FormLabel>
                          <FormControl>
                            <Input placeholder="000.000.000-00" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={patientForm.control}
                      name="rg"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>RG</FormLabel>
                          <FormControl>
                            <Input placeholder="00.000.000-0" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={patientForm.control}
                      name="birth_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data de nascimento</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={patientForm.control}
                      name="profession"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Profissão</FormLabel>
                          <FormControl>
                            <Input placeholder="Digite a profissão" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={patientForm.control}
                      name="how_found_clinic"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Como conheceu a clínica</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="indicacao">Indicação</SelectItem>
                              <SelectItem value="internet">Internet</SelectItem>
                              <SelectItem value="redes_sociais">Redes sociais</SelectItem>
                              <SelectItem value="outros">Outros</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={patientForm.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Adicionar observações</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Adicione observações sobre o paciente"
                            className="resize-none"
                            rows={3}
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Contato de emergência</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={patientForm.control}
                        name="emergency_contact_name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nome</FormLabel>
                            <FormControl>
                              <Input placeholder="Nome do contato de emergência" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={patientForm.control}
                        name="emergency_contact_phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Telefone</FormLabel>
                            <FormControl>
                              <Input placeholder="(11) 99999-9999" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </TabsContent>

                {/* Tab 2: Additional Information */}
                <TabsContent value="additional" className="space-y-4 mt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={patientForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input placeholder="email@exemplo.com" type="email" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={patientForm.control}
                      name="landline_phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Telefone fixo</FormLabel>
                          <FormControl>
                            <Input placeholder="(11) 3333-4444" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={patientForm.control}
                      name="zip_code"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CEP</FormLabel>
                          <FormControl>
                            <Input placeholder="00000-000" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={patientForm.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Endereço com número</FormLabel>
                          <FormControl>
                            <Input placeholder="Rua, Avenida, número" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={patientForm.control}
                      name="address_complement"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Complemento</FormLabel>
                          <FormControl>
                            <Input placeholder="Apartamento, casa, etc." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={patientForm.control}
                      name="neighborhood"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bairro</FormLabel>
                          <FormControl>
                            <Input placeholder="Nome do bairro" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={patientForm.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cidade</FormLabel>
                          <FormControl>
                            <Input placeholder="Cidade" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={patientForm.control}
                      name="state"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Estado</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="SP">São Paulo</SelectItem>
                              <SelectItem value="RJ">Rio de Janeiro</SelectItem>
                              <SelectItem value="MG">Minas Gerais</SelectItem>
                              <SelectItem value="RS">Rio Grande do Sul</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Responsável</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={patientForm.control}
                        name="responsible_name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nome</FormLabel>
                            <FormControl>
                              <Input placeholder="Nome do responsável" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={patientForm.control}
                        name="responsible_cpf"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>CPF</FormLabel>
                            <FormControl>
                              <Input placeholder="000.000.000-00" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={patientForm.control}
                        name="responsible_birth_date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Data de nascimento</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </TabsContent>

                {/* Tab 3: Insurance */}
                <TabsContent value="insurance" className="space-y-4 mt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={patientForm.control}
                      name="insurance_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Convênio</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue="particular">
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Particular" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="particular">Particular</SelectItem>
                              <SelectItem value="unimed">Unimed</SelectItem>
                              <SelectItem value="bradesco">Bradesco Saúde</SelectItem>
                              <SelectItem value="amil">Amil</SelectItem>
                              <SelectItem value="sul_america">SulAmérica</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={patientForm.control}
                      name="insurance_holder"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Titular do convênio</FormLabel>
                          <FormControl>
                            <Input placeholder="Nome do titular" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={patientForm.control}
                      name="insurance_number"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Número da carteirinha</FormLabel>
                          <FormControl>
                            <Input placeholder="Número da carteirinha" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={patientForm.control}
                      name="insurance_responsible_cpf"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CPF do Responsável</FormLabel>
                          <FormControl>
                            <Input placeholder="000.000.000-00" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowNewPatientDialog(false);
                    patientForm.reset();
                    setPatientFormTab("basic");
                  }}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={createPatientMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {createPatientMutation.isPending ? "Cadastrando..." : "Cadastrar paciente"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}