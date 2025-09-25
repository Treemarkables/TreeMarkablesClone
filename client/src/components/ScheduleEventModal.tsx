import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Calendar, Clock, Users, MapPin, Wrench, Trash2, Save, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { AddressAutocomplete } from '@/components/AddressAutocomplete';
import * as z from 'zod';

const scheduleEventFormSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  type: z.enum(['job', 'meeting', 'maintenance', 'break']),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  location: z.string().optional(),
  address: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  jobId: z.string().optional(),
  customerId: z.string().optional(),
  assignedEmployees: z.array(z.string()).optional(),
  equipment: z.array(z.string()).optional(),
  requiredSkills: z.array(z.string()).optional(),
  estimatedDuration: z.number().min(1, 'Duration must be at least 1 minute').optional(),
  weatherDependent: z.boolean().optional(),
  color: z.string().optional(),
});

type ScheduleEventFormData = z.infer<typeof scheduleEventFormSchema>;

interface ScheduleEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  event?: any; // Existing event for editing
  selectedDate?: Date; // Pre-selected date for new events
  onEventCreated?: () => void;
  onEventUpdated?: () => void;
  onEventDeleted?: () => void;
}

const eventTypeConfig = {
  job: { label: 'Job', color: '#EF4444', icon: Wrench },
  meeting: { label: 'Meeting', color: '#3B82F6', icon: Users },
  maintenance: { label: 'Maintenance', color: '#F59E0B', icon: Wrench },
  break: { label: 'Break', color: '#6B7280', icon: Clock },
};

const priorityConfig = {
  low: { label: 'Low', color: '#6B7280' },
  medium: { label: 'Medium', color: '#3B82F6' },
  high: { label: 'High', color: '#F59E0B' },
  urgent: { label: 'Urgent', color: '#EF4444' },
};

const skillsOptions = [
  'chainsaw', 'climbing', 'bucket_truck', 'pruning', 'safety_management',
  'emergency_response', 'chipper_operation', 'cleanup', 'ground_work'
];

export function ScheduleEventModal({
  isOpen,
  onClose,
  event,
  selectedDate,
  onEventCreated,
  onEventUpdated,
  onEventDeleted
}: ScheduleEventModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch data for form options
  const { data: employeesData } = useQuery({
    queryKey: ['/api/employees', 'active'],
    enabled: isOpen,
  });

  const { data: equipmentData } = useQuery({
    queryKey: ['/api/equipment'],
    enabled: isOpen,
  });

  const { data: customersData } = useQuery({
    queryKey: ['/api/customers'],
    enabled: isOpen,
  });

  const { data: jobTemplatesData } = useQuery({
    queryKey: ['/api/job-templates'],
    enabled: isOpen,
  });

  const employees = (employeesData as any)?.data || [];
  const equipment = (equipmentData as any)?.data || [];
  const customers = (customersData as any)?.data || [];
  const jobTemplates = (jobTemplatesData as any)?.data || [];

  const form = useForm<ScheduleEventFormData>({
    resolver: zodResolver(scheduleEventFormSchema),
    defaultValues: {
      title: '',
      description: '',
      type: 'job',
      startDate: selectedDate ? format(selectedDate, "yyyy-MM-dd'T'HH:mm") : '',
      endDate: selectedDate ? format(new Date(selectedDate.getTime() + 4 * 60 * 60 * 1000), "yyyy-MM-dd'T'HH:mm") : '',
      location: '',
      address: '',
      priority: 'medium',
      assignedEmployees: [],
      equipment: [],
      requiredSkills: [],
      estimatedDuration: 240, // 4 hours default
      weatherDependent: false,
      color: '#3B82F6',
    },
  });

  // Load existing event data when editing
  useEffect(() => {
    if (event && isOpen) {
      // Handle both CalendarEvent format and ScheduleEvent format
      let startDateStr = '';
      let endDateStr = '';
      
      if (event.startDate && event.endDate) {
        // Schedule event format (from API)
        startDateStr = format(new Date(event.startDate), "yyyy-MM-dd'T'HH:mm");
        endDateStr = format(new Date(event.endDate), "yyyy-MM-dd'T'HH:mm");
      } else if (event.date && event.startTime && event.endTime) {
        // Calendar event format (from CalendarView)
        startDateStr = `${event.date}T${event.startTime}`;
        endDateStr = `${event.date}T${event.endTime}`;
      }

      form.reset({
        title: event.title || '',
        description: event.description || '',
        type: event.type || 'job',
        startDate: startDateStr,
        endDate: endDateStr,
        location: event.location || '',
        address: event.address || '',
        priority: event.priority || 'medium',
        jobId: event.jobId || '',
        customerId: event.customerId || '',
        assignedEmployees: event.assignedEmployees || [],
        equipment: event.equipment || [],
        requiredSkills: event.requiredSkills || [],
        estimatedDuration: event.estimatedDuration || 240,
        weatherDependent: event.weatherDependent || false,
        color: event.color || '#3B82F6',
      });
    }
  }, [event, isOpen, form]);

  // Create event mutation
  const createEventMutation = useMutation({
    mutationFn: (data: ScheduleEventFormData) => apiRequest('POST', '/api/schedule-events', data),
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Schedule event created successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/schedule-events'] });
      onEventCreated?.();
      onClose();
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to create schedule event',
        variant: 'destructive',
      });
    },
  });

  // Update event mutation
  const updateEventMutation = useMutation({
    mutationFn: (data: ScheduleEventFormData) => apiRequest('PUT', `/api/schedule-events/${event?.id}`, data),
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Schedule event updated successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/schedule-events'] });
      onEventUpdated?.();
      onClose();
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update schedule event',
        variant: 'destructive',
      });
    },
  });

  // Delete event mutation
  const deleteEventMutation = useMutation({
    mutationFn: () => apiRequest('DELETE', `/api/schedule-events/${event?.id}`),
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Schedule event deleted successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/schedule-events'] });
      onEventDeleted?.();
      onClose();
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete schedule event',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: ScheduleEventFormData) => {
    if (event) {
      updateEventMutation.mutate(data);
    } else {
      createEventMutation.mutate(data);
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this event?')) {
      setIsDeleting(true);
      deleteEventMutation.mutate();
    }
  };

  const handleClose = () => {
    form.reset();
    setIsDeleting(false);
    onClose();
  };

  const selectedType = form.watch('type');
  const typeConfig = eventTypeConfig[selectedType];

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {typeConfig && <typeConfig.icon className="h-5 w-5" />}
            {event ? 'Edit Schedule Event' : 'Create Schedule Event'}
          </DialogTitle>
          <DialogDescription>
            {event ? 'Update the details of this schedule event' : 'Create a new event in the schedule'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                {...form.register('title')}
                placeholder="Event title..."
                data-testid="input-event-title"
              />
              {form.formState.errors.title && (
                <p className="text-sm text-red-500">{form.formState.errors.title.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Event Type *</Label>
              <Controller
                control={form.control}
                name="type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} data-testid="select-event-type">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(eventTypeConfig).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          <div className="flex items-center gap-2">
                            <config.icon className="h-4 w-4" />
                            {config.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...form.register('description')}
              placeholder="Event description..."
              rows={3}
              data-testid="textarea-event-description"
            />
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date & Time *</Label>
              <Input
                id="startDate"
                type="datetime-local"
                {...form.register('startDate')}
                data-testid="input-start-date"
              />
              {form.formState.errors.startDate && (
                <p className="text-sm text-red-500">{form.formState.errors.startDate.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">End Date & Time *</Label>
              <Input
                id="endDate"
                type="datetime-local"
                {...form.register('endDate')}
                data-testid="input-end-date"
              />
              {form.formState.errors.endDate && (
                <p className="text-sm text-red-500">{form.formState.errors.endDate.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="estimatedDuration">Duration (minutes)</Label>
              <Input
                id="estimatedDuration"
                type="number"
                min="1"
                {...form.register('estimatedDuration', { valueAsNumber: true })}
                placeholder="240"
                data-testid="input-duration"
              />
            </div>
          </div>

          {/* Location & Priority */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                {...form.register('location')}
                placeholder="Location name..."
                data-testid="input-location"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <AddressAutocomplete
                value={form.getValues('address') || ''}
                onChange={(value) => form.setValue('address', value)}
                placeholder="Full address..."
                mode="full"
                data-testid="input-address"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority *</Label>
              <Controller
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} data-testid="select-priority">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(priorityConfig).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: config.color }}
                            />
                            {config.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          {/* Assignment Section */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Users className="h-5 w-5" />
              Team & Resource Assignment
            </h3>

            {/* Employee Assignment */}
            <div className="space-y-2">
              <Label>Assigned Employees</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                {employees.map((employee: any) => (
                  <div key={employee.id} className="flex items-center space-x-2">
                    <Controller
                      control={form.control}
                      name="assignedEmployees"
                      render={({ field }) => (
                        <Checkbox
                          checked={field.value?.includes(employee.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              field.onChange([...(field.value || []), employee.id]);
                            } else {
                              field.onChange(field.value?.filter((id: string) => id !== employee.id));
                            }
                          }}
                          data-testid={`checkbox-employee-${employee.id}`}
                        />
                      )}
                    />
                    <Label className="text-sm">{employee.firstName} {employee.lastName}</Label>
                    <Badge variant="outline" className="text-xs">
                      {employee.position}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Equipment Assignment */}
            <div className="space-y-2">
              <Label>Required Equipment</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                {equipment.map((item: any) => (
                  <div key={item.id} className="flex items-center space-x-2">
                    <Controller
                      control={form.control}
                      name="equipment"
                      render={({ field }) => (
                        <Checkbox
                          checked={field.value?.includes(item.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              field.onChange([...(field.value || []), item.id]);
                            } else {
                              field.onChange(field.value?.filter((id: string) => id !== item.id));
                            }
                          }}
                          disabled={item.status !== 'available'}
                          data-testid={`checkbox-equipment-${item.id}`}
                        />
                      )}
                    />
                    <Label className="text-sm">{item.name}</Label>
                    <Badge 
                      variant={item.status === 'available' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {item.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Required Skills */}
            <div className="space-y-2">
              <Label>Required Skills</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {skillsOptions.map((skill) => (
                  <div key={skill} className="flex items-center space-x-2">
                    <Controller
                      control={form.control}
                      name="requiredSkills"
                      render={({ field }) => (
                        <Checkbox
                          checked={field.value?.includes(skill)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              field.onChange([...(field.value || []), skill]);
                            } else {
                              field.onChange(field.value?.filter((s: string) => s !== skill));
                            }
                          }}
                          data-testid={`checkbox-skill-${skill}`}
                        />
                      )}
                    />
                    <Label className="text-sm capitalize">{skill.replace('_', ' ')}</Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Additional Options */}
            <div className="flex items-center space-x-4">
              <Controller
                control={form.control}
                name="weatherDependent"
                render={({ field }) => (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="checkbox-weather-dependent"
                    />
                    <Label>Weather Dependent</Label>
                  </div>
                )}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between pt-4 border-t">
            <div>
              {event && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleteEventMutation.isPending || isDeleting}
                  data-testid="button-delete-event"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Event
                </Button>
              )}
            </div>
            
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                data-testid="button-cancel"
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createEventMutation.isPending || updateEventMutation.isPending}
                data-testid="button-save-event"
              >
                <Save className="h-4 w-4 mr-2" />
                {event ? 'Update Event' : 'Create Event'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}