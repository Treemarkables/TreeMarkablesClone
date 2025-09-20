import { useState, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Plus, Clock, Users, MapPin, Wrench, Cloud, Sun, CloudRain, AlertTriangle, Wind, Thermometer } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks, isSameDay, parseISO, isToday, startOfDay } from 'date-fns';
import { ScheduleEventModal } from './ScheduleEventModal';

interface WeatherData {
  temperature: number;
  condition: string;
  humidity: number;
  windSpeed: number;
  precipitation: number;
  alerts: string[];
}

interface CalendarEvent {
  id: string;
  title: string;
  type: 'job' | 'meeting' | 'maintenance' | 'break';
  startTime: string;
  endTime: string;
  date: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  location?: string;
  assignedTeam?: string[];
  customer?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  color?: string;
  weatherDependent?: boolean;
  weather?: WeatherData;
}

interface CalendarViewProps {
  view?: 'week' | 'day';
  onEventClick?: (event: CalendarEvent) => void;
  onAddEvent?: (date: Date) => void;
}

const eventTypeConfig = {
  job: {
    color: 'bg-brand',
    icon: Wrench,
    label: 'Job',
  },
  meeting: {
    color: 'bg-brand', 
    icon: Users,
    label: 'Meeting',
  },
  maintenance: {
    color: 'bg-brand',
    icon: Calendar,
    label: 'Maintenance',
  },
  break: {
    color: 'bg-muted',
    icon: Clock,
    label: 'Break',
  },
};

const priorityColors = {
  low: 'border-l-muted-foreground',
  medium: 'border-l-brand',
  high: 'border-l-brand border-l-2', 
  urgent: 'border-l-brand border-l-4',
};

export function CalendarView({ view = 'week', onEventClick, onAddEvent }: CalendarViewProps) {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Fetch jobs data to create calendar events
  const { data: jobsData } = useQuery({
    queryKey: ['/api/jobs'],
  });

  // Fetch schedule events data
  const { data: scheduleEventsData } = useQuery({
    queryKey: ['/api/schedule-events'],
  });

  // Fetch employees data for crew assignments
  const { data: employeesData } = useQuery({
    queryKey: ['/api/employees', 'active'],
  });

  // Helper function to get job status colors - defined before use
  const getJobStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'hsl(var(--primary))';
      case 'in_progress': return 'hsl(var(--primary))';
      case 'completed': return 'hsl(var(--muted-foreground))';
      case 'cancelled': return 'hsl(var(--muted-foreground))';
      default: return 'hsl(var(--primary))';
    }
  };

  // Transform jobs into calendar events
  const calendarEvents = useMemo(() => {
    const jobs = (jobsData as any)?.data || [];
    const events: CalendarEvent[] = [];

    jobs.forEach((job: any) => {
      if (job.scheduledDate) {
        const startDate = parseISO(job.scheduledDate);
        const endDate = new Date(startDate.getTime() + (job.estimatedHours || 4) * 60 * 60 * 1000);
        
        events.push({
          id: job.id,
          title: job.title,
          type: 'job',
          startTime: format(startDate, 'HH:mm'),
          endTime: format(endDate, 'HH:mm'),
          date: format(startDate, 'yyyy-MM-dd'),
          status: job.status as any,
          location: job.address,
          customer: job.customerName,
          priority: job.priority || 'medium',
          color: getJobStatusColor(job.status),
        });
      }
    });

    // Add real schedule events from API
    const scheduleEvents = (scheduleEventsData as any)?.data || [];
    scheduleEvents.forEach((scheduleEvent: any) => {
      if (scheduleEvent.startDate) {
        const startDate = parseISO(scheduleEvent.startDate);
        const endDate = scheduleEvent.endDate ? parseISO(scheduleEvent.endDate) : new Date(startDate.getTime() + (scheduleEvent.estimatedDuration || 240) * 60 * 1000);
        
        events.push({
          id: scheduleEvent.id,
          title: scheduleEvent.title,
          type: scheduleEvent.type || 'job',
          startTime: format(startDate, 'HH:mm'),
          endTime: format(endDate, 'HH:mm'),
          date: format(startDate, 'yyyy-MM-dd'),
          status: scheduleEvent.status || 'scheduled',
          location: scheduleEvent.location || scheduleEvent.address,
          customer: scheduleEvent.customer,
          assignedTeam: scheduleEvent.assignedEmployees || [],
          priority: scheduleEvent.priority || 'medium',
          color: scheduleEvent.color || getJobStatusColor(scheduleEvent.status || 'scheduled'),
        });
      }
    });

    // Add sample events only in development mode if no real schedule events exist
    if (import.meta.env.DEV && scheduleEvents.length === 0) {
      const today = new Date();
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
      const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

      events.push(
        {
          id: 'meeting-1',
          title: 'Team Safety Meeting',
          type: 'meeting',
          startTime: '09:00',
          endTime: '11:00',
          date: format(nextWeek, 'yyyy-MM-dd'),
          status: 'scheduled',
          location: 'Main Office',
          assignedTeam: ['Jake Morrison', 'Maria Silva', 'Tom Bradley'],
          priority: 'medium',
        },
        {
          id: 'maintenance-1',
          title: 'Bucket Truck Maintenance',
          type: 'maintenance',
          startTime: '13:00',
          endTime: '17:00',
          date: format(tomorrow, 'yyyy-MM-dd'),
          status: 'scheduled',
          location: 'Service Center',
          priority: 'high',
        }
      );
    }

    return events;
  }, [jobsData, scheduleEventsData]);

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 }); // Start on Monday
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const getEventsForDay = (date: Date) => {
    const dayString = format(date, 'yyyy-MM-dd');
    return calendarEvents.filter(event => event.date === dayString);
  };

  const handleAddEvent = (date: Date) => {
    setSelectedDate(date);
    setSelectedEvent(null);
    setIsEventModalOpen(true);
    if (onAddEvent) {
      onAddEvent(date);
    }
  };

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setSelectedDate(null);
    setIsEventModalOpen(true);
    if (onEventClick) {
      onEventClick(event);
    }
  };

  const handleCloseModal = () => {
    setIsEventModalOpen(false);
    setSelectedEvent(null);
    setSelectedDate(null);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-brand">
            <Calendar className="h-5 w-5 text-brand" />
            Schedule Calendar
          </CardTitle>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}
              data-testid="button-prev-week"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <div className="text-sm font-medium min-w-[140px] text-center" data-testid="text-current-week">
              {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}
              data-testid="button-next-week"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentWeek(new Date())}
              data-testid="button-today"
            >
              Today
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="grid grid-cols-7 border-b bg-muted/30">
          {weekDays.map((day, index) => (
            <div
              key={index}
              className={`p-3 text-center border-r last:border-r-0 ${
                isToday(day) ? 'bg-brand-soft' : ''
              }`}
            >
              <div className="text-xs text-muted-foreground font-medium">
                {format(day, 'EEE')}
              </div>
              <div className={`text-lg font-semibold ${isToday(day) ? 'text-brand' : ''}`}>
                {format(day, 'd')}
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 min-h-[400px]">
          {weekDays.map((day, dayIndex) => {
            const dayEvents = getEventsForDay(day);
            
            return (
              <div
                key={dayIndex}
                className={`border-r last:border-r-0 p-2 min-h-[400px] relative ${
                  isToday(day) ? 'bg-brand-soft' : ''
                }`}
              >
                <div className="mb-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full h-6 text-xs hover-elevate"
                    onClick={() => handleAddEvent(day)}
                    data-testid={`button-add-event-${format(day, 'yyyy-MM-dd')}`}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>

                <div className="space-y-1">
                  {dayEvents.map((event) => {
                    const EventIcon = eventTypeConfig[event.type].icon;
                    
                    return (
                      <div
                        key={event.id}
                        className={`p-2 rounded-md cursor-pointer transition-colors border-l-4 ${priorityColors[event.priority]} bg-gradient-to-r hover-elevate active-elevate-2`}
                        style={{
                          backgroundColor: 'hsl(var(--primary) / 0.08)',
                          borderColor: 'hsl(var(--primary))',
                        }}
                        onClick={() => handleEventClick(event)}
                        data-testid={`event-${event.id}`}
                      >
                        <div className="flex items-start gap-2">
                          <EventIcon className="h-3 w-3 mt-0.5 flex-shrink-0 text-brand" />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium truncate" data-testid={`event-title-${event.id}`}>
                              {event.title}
                            </div>
                            <div className="text-xs text-muted-foreground" data-testid={`event-time-${event.id}`}>
                              {event.startTime} - {event.endTime}
                            </div>
                            {event.location && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                <MapPin className="h-2.5 w-2.5" />
                                <span className="truncate">{event.location}</span>
                              </div>
                            )}
                            {event.customer && (
                              <div className="text-xs text-muted-foreground mt-1 truncate">
                                {event.customer}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between mt-1">
                          <Badge
                            className={`text-xs px-1 py-0 ${eventTypeConfig[event.type].color} text-white`}
                            data-testid={`event-type-${event.id}`}
                          >
                            {eventTypeConfig[event.type].label}
                          </Badge>
                          
                          <Badge
                            variant={event.status === 'completed' ? 'default' : 'outline'}
                            className="text-xs px-1 py-0"
                            data-testid={`event-status-${event.id}`}
                          >
                            {event.status}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Event Type Legend */}
        <div className="border-t p-3 bg-muted/10">
          <div className="flex flex-wrap gap-4 text-xs">
            {Object.entries(eventTypeConfig).map(([type, config]) => (
              <div key={type} className="flex items-center gap-1">
                <div className={`w-3 h-3 rounded ${config.color}`} />
                <span>{config.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Priority: 
            <span className="ml-2 inline-flex items-center gap-1">
              <div className="w-3 h-1 bg-muted" /> Low
            </span>
            <span className="ml-2 inline-flex items-center gap-1">
              <div className="w-3 h-1 bg-brand opacity-60" /> Medium
            </span>
            <span className="ml-2 inline-flex items-center gap-1">
              <div className="w-3 h-1 bg-brand opacity-80" /> High
            </span>
            <span className="ml-2 inline-flex items-center gap-1">
              <div className="w-3 h-1 bg-brand" /> Urgent
            </span>
          </div>
        </div>
      </CardContent>

      {/* Schedule Event Modal */}
      <ScheduleEventModal
        isOpen={isEventModalOpen}
        onClose={handleCloseModal}
        event={selectedEvent}
        selectedDate={selectedDate}
        onEventCreated={() => {
          // Refresh calendar data
        }}
        onEventUpdated={() => {
          // Refresh calendar data
        }}
        onEventDeleted={() => {
          // Refresh calendar data
        }}
      />
    </Card>
  );
}