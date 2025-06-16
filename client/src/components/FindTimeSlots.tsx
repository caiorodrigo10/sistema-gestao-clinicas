import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Clock, AlertTriangle } from "lucide-react";
import { format, addDays, subDays, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";

interface FindTimeSlotsProps {
  selectedDate?: string;
  duration: number;
  onTimeSelect: (time: string, date: string) => void;
  onClose: () => void;
}

interface TimeSlot {
  startTime: string;
  endTime: string;
  label: string;
  available: boolean;
  reason?: string; // Reason for unavailability
}

interface ClinicConfig {
  working_days: string[];
  work_start: string;
  work_end: string;
  has_lunch_break: boolean;
  lunch_start: string;
  lunch_end: string;
}

export function FindTimeSlots({ selectedDate, duration, onTimeSelect, onClose }: FindTimeSlotsProps) {
  const [currentDate, setCurrentDate] = useState(() => {
    if (selectedDate && selectedDate !== '') {
      // Create date from string and ensure it's at local midnight to avoid timezone issues
      const date = new Date(selectedDate + 'T00:00:00');
      return date;
    }
    return new Date();
  });
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [timeSlots, setTimeSlots] = useState<{
    morning: TimeSlot[];
    afternoon: TimeSlot[];
    evening: TimeSlot[];
  }>({
    morning: [],
    afternoon: [],
    evening: []
  });

  // Fetch clinic configuration
  const { data: clinicConfig } = useQuery({
    queryKey: ["/api/clinic/1/config"],
    select: (data: any): ClinicConfig => ({
      working_days: data.working_days || ['monday','tuesday','wednesday','thursday','friday'],
      work_start: data.work_start || "08:00",
      work_end: data.work_end || "18:00",
      has_lunch_break: data.has_lunch_break !== false,
      lunch_start: data.lunch_start || "12:00",
      lunch_end: data.lunch_end || "13:00"
    })
  });

  const navigateDate = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => direction === 'prev' ? subDays(prev, 1) : addDays(prev, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const formatDateHeader = (date: Date) => {
    const dayName = format(date, "EEEE", { locale: ptBR });
    const formattedDate = format(date, "dd 'de' MMMM yyyy", { locale: ptBR });
    return `${dayName.charAt(0).toUpperCase() + dayName.slice(1)}, ${formattedDate}`;
  };

  const handleTimeSelect = (startTime: string) => {
    setSelectedTime(startTime);
  };

  const handleConfirm = () => {
    if (selectedTime) {
      const dateString = currentDate.toISOString().split('T')[0]; // Format as YYYY-MM-DD
      onTimeSelect(selectedTime, dateString);
      onClose();
    }
  };

  // Helper functions for working hours validation
  const getDayOfWeekKey = (date: Date): string => {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[getDay(date)];
  };

  const isWorkingDay = (date: Date, config: ClinicConfig): boolean => {
    const dayKey = getDayOfWeekKey(date);
    return config.working_days.includes(dayKey);
  };

  const isWorkingHour = (time: string, config: ClinicConfig): boolean => {
    return time >= config.work_start && time <= config.work_end;
  };

  const isLunchTime = (time: string, config: ClinicConfig): boolean => {
    // If lunch break is disabled, never block lunch time
    if (!config.has_lunch_break) {
      return false;
    }
    return time >= config.lunch_start && time < config.lunch_end;
  };

  const getUnavailabilityReason = (date: Date, time: string, config: ClinicConfig): string | undefined => {
    if (!isWorkingDay(date, config)) {
      return "Dia não útil";
    }
    if (!isWorkingHour(time, config)) {
      return "Fora do horário de funcionamento";
    }
    if (isLunchTime(time, config)) {
      return "Horário de almoço";
    }
    return undefined;
  };

  // Fetch existing appointments for conflict checking
  const { data: existingAppointments = [] } = useQuery({
    queryKey: ['/api/appointments', { clinic_id: 1 }],
    queryFn: async () => {
      const response = await fetch('/api/appointments?clinic_id=1');
      if (!response.ok) throw new Error('Failed to fetch appointments');
      return response.json();
    },
  });

  // Helper function to convert time string to minutes
  const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // Helper function to convert minutes to time string
  const minutesToTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  // Check if a time slot conflicts with existing appointments
  const hasConflict = (startTime: string, endTime: string): boolean => {
    const slotStart = timeToMinutes(startTime);
    const slotEnd = timeToMinutes(endTime);
    const currentDateStr = currentDate.toISOString().split('T')[0];

    return existingAppointments.some((appointment: any) => {
      const appointmentDate = new Date(appointment.scheduled_date).toISOString().split('T')[0];
      if (appointmentDate !== currentDateStr) return false;

      const appointmentTime = new Date(appointment.scheduled_date).toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
      const appointmentStart = timeToMinutes(appointmentTime);
      const appointmentEnd = appointmentStart + appointment.duration_minutes;

      // Check if time slots overlap
      return (slotStart < appointmentEnd && slotEnd > appointmentStart);
    });
  };

  // Generate time slots based on clinic configuration
  useEffect(() => {
    if (!clinicConfig) return;

    const generateTimeSlots = () => {
      const morning: TimeSlot[] = [];
      const afternoon: TimeSlot[] = [];
      const evening: TimeSlot[] = [];

      // Parse work hours
      const workStartMinutes = timeToMinutes(clinicConfig.work_start);
      const workEndMinutes = timeToMinutes(clinicConfig.work_end);
      const lunchStartMinutes = timeToMinutes(clinicConfig.lunch_start);
      const lunchEndMinutes = timeToMinutes(clinicConfig.lunch_end);
      
      // Generate slots in 30-minute intervals, but check for full duration availability
      for (let currentMinutes = workStartMinutes; currentMinutes < workEndMinutes; currentMinutes += 30) {
        const slotEndMinutes = currentMinutes + duration;
        
        // Skip if slot would exceed work hours
        if (slotEndMinutes > workEndMinutes) continue;
        
        const startTime = minutesToTime(currentMinutes);
        const endTime = minutesToTime(slotEndMinutes);
        
        // Check availability for the entire duration
        let isAvailable = true;
        let unavailabilityReason: string | undefined;

        // Check if it's a working day
        if (!isWorkingDay(currentDate, clinicConfig)) {
          unavailabilityReason = "Dia não útil";
          isAvailable = false;
        }

        // Check lunch break conflicts (only if lunch break is enabled)
        if (isAvailable && clinicConfig.has_lunch_break) {
          // Check if any part of the appointment overlaps with lunch time
          if (currentMinutes < lunchEndMinutes && slotEndMinutes > lunchStartMinutes) {
            unavailabilityReason = "Conflito com horário de almoço";
            isAvailable = false;
          }
        }

        // Check conflicts with existing appointments
        if (isAvailable && hasConflict(startTime, endTime)) {
          unavailabilityReason = "Horário ocupado";
          isAvailable = false;
        }
        
        const timeSlot: TimeSlot = {
          startTime,
          endTime,
          label: `${startTime} - ${endTime}`,
          available: isAvailable,
          reason: unavailabilityReason
        };

        // Categorize time slots
        const hour = Math.floor(currentMinutes / 60);
        if (hour < 12) {
          morning.push(timeSlot);
        } else if (hour < 18) {
          afternoon.push(timeSlot);
        } else {
          evening.push(timeSlot);
        }
      }

      setTimeSlots({ morning, afternoon, evening });
    };

    generateTimeSlots();
  }, [currentDate, clinicConfig, duration, existingAppointments]);

  const renderTimeSlots = (slots: TimeSlot[], title: string) => {
    // Only show available slots
    const availableSlots = slots.filter(slot => slot.available);
    
    if (availableSlots.length === 0) {
      return null;
    }

    return (
      <div className="space-y-3">
        <h3 className="text-base font-medium text-slate-700">{title}</h3>
        <div className="grid grid-cols-3 gap-2">
          {availableSlots.map((slot) => (
            <Button
              key={slot.startTime}
              variant={selectedTime === slot.startTime ? "default" : "outline"}
              className={`h-auto p-2 flex flex-col items-center justify-center text-center relative transition-all ${
                selectedTime === slot.startTime
                  ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700' 
                  : 'border-green-200 bg-green-50 hover:bg-green-100 text-green-800 hover:border-green-300'
              }`}
              onClick={() => handleTimeSelect(slot.startTime)}
            >
              <div className="flex items-center space-x-1">
                <Clock className="w-3 h-3" />
                <span className="font-medium text-sm">{slot.label}</span>
              </div>
              <Badge 
                variant="secondary" 
                className={`text-xs mt-1 ${
                  selectedTime === slot.startTime 
                    ? 'bg-blue-700 text-blue-100 border-blue-600' 
                    : 'bg-green-100 text-green-700 border-green-200'
                }`}
              >
                Disponível
              </Badge>
            </Button>
          ))}
        </div>
      </div>
    );
  };

  // Check if selected date is a working day
  const isSelectedDateWorkingDay = clinicConfig ? isWorkingDay(currentDate, clinicConfig) : true;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <DialogHeader className="mb-6">
        <DialogTitle className="text-2xl">Procurar Horários Disponíveis</DialogTitle>
        <p className="text-slate-600">
          Selecione um horário para a consulta de {duration} minutos
        </p>
      </DialogHeader>

      {/* Date Navigation */}
      <div className="flex items-center justify-between mb-6 p-4 bg-slate-50 rounded-lg">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigateDate('prev')}
          className="flex items-center space-x-2"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Anterior</span>
        </Button>
        
        <div className="text-center">
          <h2 className="text-lg font-semibold text-slate-800">
            {formatDateHeader(currentDate)}
          </h2>
          {!isSelectedDateWorkingDay && (
            <div className="flex items-center justify-center space-x-2 mt-2">
              <AlertTriangle className="w-4 h-4 text-orange-600" />
              <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200">
                Dia não útil - Agendamento possível mas não recomendado
              </Badge>
            </div>
          )}
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigateDate('next')}
          className="flex items-center space-x-2"
        >
          <span>Próximo</span>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      <div className="mb-4">
        <Button
          variant="outline"
          size="sm"
          onClick={goToToday}
          className="text-blue-600 border-blue-200 hover:bg-blue-50"
        >
          Ir para Hoje
        </Button>
      </div>

      {/* Time Slots */}
      <div className="space-y-6 mb-8">
        {(() => {
          const hasAvailableSlots = 
            timeSlots.morning.some(slot => slot.available) ||
            timeSlots.afternoon.some(slot => slot.available) ||
            timeSlots.evening.some(slot => slot.available);

          if (!hasAvailableSlots) {
            return (
              <div className="text-center py-12 bg-slate-50 rounded-lg border">
                <AlertTriangle className="w-12 h-12 text-orange-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-700 mb-2">
                  Nenhum horário disponível
                </h3>
                <p className="text-slate-600 mb-4">
                  Não há horários disponíveis para consultas de {duration} minutos neste dia.
                </p>
                <p className="text-sm text-slate-500">
                  Tente selecionar outro dia ou ajustar a duração da consulta.
                </p>
              </div>
            );
          }

          return (
            <>
              {renderTimeSlots(timeSlots.morning, "Manhã")}
              {renderTimeSlots(timeSlots.afternoon, "Tarde")}
              {renderTimeSlots(timeSlots.evening, "Noite")}
            </>
          );
        })()}
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end space-x-3 pt-4 border-t">
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button 
          onClick={handleConfirm}
          disabled={!selectedTime}
          className="bg-blue-600 hover:bg-blue-700"
        >
          Confirmar Horário
        </Button>
      </div>

      {/* Working Hours Info */}
      {clinicConfig && (
        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="font-medium text-blue-900 mb-2">Informações da Clínica</h4>
          <div className="text-sm text-blue-800 space-y-1">
            <p><strong>Funcionamento:</strong> {clinicConfig.work_start} às {clinicConfig.work_end}</p>
            <p><strong>Almoço:</strong> {clinicConfig.lunch_start} às {clinicConfig.lunch_end}</p>
            <p><strong>Dias úteis:</strong> {clinicConfig.working_days.map(day => {
              const dayNames: { [key: string]: string } = {
                'monday': 'Segunda',
                'tuesday': 'Terça', 
                'wednesday': 'Quarta',
                'thursday': 'Quinta',
                'friday': 'Sexta',
                'saturday': 'Sábado',
                'sunday': 'Domingo'
              };
              return dayNames[day];
            }).join(', ')}</p>
          </div>
        </div>
      )}
    </div>
  );
}