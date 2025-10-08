import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { GlobalJobCard } from "@/components/GlobalJobCard";
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  User,
  Plus,
  Grid3x3,
  List,
  MessageSquare
} from "lucide-react";
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths,
  startOfWeek,
  endOfWeek,
  parseISO,
  isToday
} from "date-fns";
import type { Job, Customer } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface ApiResponse<T> {
  success: boolean;
  data: T[];
  message?: string;
}

type ViewMode = 'month' | 'week';

interface JobWithCustomer extends Job {
  customer?: Customer;
}

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<JobWithCustomer | null>(null);
  const [smsMessage, setSmsMessage] = useState("");
  const [showJobEditDialog, setShowJobEditDialog] = useState(false);
  const [jobToEdit, setJobToEdit] = useState<JobWithCustomer | null>(null);
  const { toast } = useToast();

  // Fetch jobs/appointments
  const { data: jobsResponse, isLoading } = useQuery<ApiResponse<Job>>({
    queryKey: ['/api/jobs'],
  });

  // Fetch customers
  const { data: customersResponse } = useQuery<ApiResponse<Customer>>({
    queryKey: ['/api/customers'],
  });

  const jobs = jobsResponse?.data || [];
  const customers = customersResponse?.data || [];

  // Merge jobs with customer data
  const jobsWithCustomers: JobWithCustomer[] = useMemo(() => {
    return jobs.map(job => {
      const customer = customers.find(c => c.id === job.customerId);
      return { ...job, customer };
    });
  }, [jobs, customers]);

  // Filter jobs that have a scheduled date
  const scheduledJobs = useMemo(() => {
    return jobsWithCustomers.filter(job => job.scheduledDate && job.status !== 'unsuccessful');
  }, [jobsWithCustomers]);

  // Get appointments for a specific date
  const getAppointmentsForDate = (date: Date) => {
    return scheduledJobs.filter(job => {
      if (!job.scheduledDate) return false;
      const jobDate = typeof job.scheduledDate === 'string' 
        ? parseISO(job.scheduledDate) 
        : job.scheduledDate;
      return isSameDay(jobDate, date);
    });
  };

  // Send SMS mutation
  const sendSmsMutation = useMutation({
    mutationFn: async (data: { phone: string; message: string; jobId?: string; customerId?: string }) => {
      return apiRequest('/api/sms/send', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({
        title: "SMS Sent",
        description: "Your message has been sent successfully.",
      });
      setSmsDialogOpen(false);
      setSmsMessage("");
      setSelectedJob(null);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Send SMS",
        description: error.message || "There was an error sending the SMS.",
        variant: "destructive",
      });
    },
  });

  // Handle job edit click
  const handleEditJob = (job: JobWithCustomer, e?: React.MouseEvent) => {
    // Prevent event bubbling if triggered from a button
    e?.stopPropagation();
    setJobToEdit(job);
    setShowJobEditDialog(true);
  };

  // Handle SMS button click
  const handleSendSms = (job: JobWithCustomer, e?: React.MouseEvent) => {
    // Prevent event bubbling if triggered from a button
    e?.stopPropagation();
    setSelectedJob(job);
    const customerName = job.customer?.name || "Customer";
    const jobTitle = job.title || "your appointment";
    const scheduledTime = job.scheduledDate 
      ? format(
          typeof job.scheduledDate === 'string' ? parseISO(job.scheduledDate) : job.scheduledDate,
          'MMMM d, yyyy \'at\' h:mm a'
        )
      : "soon";
    
    setSmsMessage(`Hi ${customerName}, this is a reminder about ${jobTitle} scheduled for ${scheduledTime}. - Treemarkables`);
    setSmsDialogOpen(true);
  };

  // Handle SMS send
  const handleSendSmsConfirm = () => {
    if (!selectedJob || !selectedJob.customer?.phone) {
      toast({
        title: "No Phone Number",
        description: "This customer doesn't have a phone number on file.",
        variant: "destructive",
      });
      return;
    }

    if (smsMessage.length > 160) {
      toast({
        title: "Message Too Long",
        description: "SMS messages must be 160 characters or less.",
        variant: "destructive",
      });
      return;
    }

    sendSmsMutation.mutate({
      phone: selectedJob.customer.phone,
      message: smsMessage,
      jobId: selectedJob.id,
      customerId: selectedJob.customerId || undefined,
    });
  };

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [currentDate]);

  // Week days
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Navigation functions
  const goToPreviousMonth = () => setCurrentDate(prev => subMonths(prev, 1));
  const goToNextMonth = () => setCurrentDate(prev => addMonths(prev, 1));
  const goToToday = () => setCurrentDate(new Date());

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'bg-blue-500';
      case 'work_order':
        return 'bg-purple-500';
      case 'completed':
        return 'bg-green-500';
      case 'quote':
        return 'bg-amber-500';
      default:
        return 'bg-gray-500';
    }
  };

  // Get priority badge variant
  const getPriorityVariant = (priority: string | null) => {
    switch (priority) {
      case 'urgent':
        return 'destructive';
      case 'high':
        return 'default';
      case 'medium':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  // Selected date appointments
  const selectedDateAppointments = selectedDate ? getAppointmentsForDate(selectedDate) : [];

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-4 border-b">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-xl sm:text-2xl font-bold" data-testid="text-calendar-title">
            Calendar
          </h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* View Mode Toggle */}
          <div className="flex items-center border rounded-md">
            <Button
              variant={viewMode === 'month' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('month')}
              className="rounded-r-none"
              data-testid="button-view-month"
            >
              <Grid3x3 className="h-4 w-4 mr-1" />
              Month
            </Button>
            <Button
              variant={viewMode === 'week' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('week')}
              className="rounded-l-none"
              data-testid="button-view-week"
            >
              <List className="h-4 w-4 mr-1" />
              Week
            </Button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={goToToday}
            data-testid="button-today"
          >
            Today
          </Button>

          <Button
            variant="outline"
            size="sm"
            data-testid="button-new-appointment"
          >
            <Plus className="h-4 w-4 mr-1" />
            New
          </Button>
        </div>
      </div>

      {/* Calendar Navigation */}
      <div className="flex items-center justify-between p-3 sm:p-4 border-b">
        <Button
          variant="ghost"
          size="icon"
          onClick={goToPreviousMonth}
          data-testid="button-previous-month"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>

        <h2 className="text-lg sm:text-xl font-semibold" data-testid="text-current-month">
          {format(currentDate, 'MMMM yyyy')}
        </h2>

        <Button
          variant="ghost"
          size="icon"
          onClick={goToNextMonth}
          data-testid="button-next-month"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Calendar Grid */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="p-4 space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : (
            <div className="p-2 sm:p-4">
              {/* Week day headers */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {weekDays.map(day => (
                  <div
                    key={day}
                    className="text-center text-sm font-medium text-muted-foreground py-2"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar days grid */}
              <div className="grid grid-cols-7 gap-1 pb-8">
                {calendarDays.map((day, index) => {
                  const dayAppointments = getAppointmentsForDate(day);
                  const isCurrentMonth = isSameMonth(day, currentDate);
                  const isSelected = selectedDate && isSameDay(day, selectedDate);
                  const isTodayDate = isToday(day);

                  return (
                    <Card
                      key={index}
                      className={`min-h-[80px] sm:min-h-[120px] cursor-pointer transition-colors ${
                        !isCurrentMonth ? 'opacity-40' : ''
                      } ${
                        isSelected ? 'ring-2 ring-primary' : ''
                      }`}
                      onClick={() => setSelectedDate(day)}
                      data-testid={`calendar-day-${format(day, 'yyyy-MM-dd')}`}
                    >
                      <CardContent className="p-1 sm:p-2 h-full flex flex-col">
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className={`text-xs sm:text-sm font-medium ${
                              isTodayDate
                                ? 'bg-primary text-primary-foreground rounded-full h-6 w-6 flex items-center justify-center'
                                : ''
                            }`}
                            data-testid={`text-day-${format(day, 'yyyy-MM-dd')}`}
                          >
                            {format(day, 'd')}
                          </span>
                          {dayAppointments.length > 0 && (
                            <Badge
                              variant="secondary"
                              className="h-5 px-1 text-[10px]"
                              data-testid={`badge-count-${format(day, 'yyyy-MM-dd')}`}
                            >
                              {dayAppointments.length}
                            </Badge>
                          )}
                        </div>

                        {/* Appointment indicators */}
                        <div className="flex-1 space-y-0.5 overflow-hidden">
                          {dayAppointments.slice(0, 3).map(appointment => (
                            <div
                              key={appointment.id}
                              className={`text-[10px] sm:text-xs p-1 rounded ${getStatusColor(
                                appointment.status
                              )} text-white`}
                              data-testid={`appointment-indicator-${appointment.id}`}
                            >
                              <div className="font-semibold truncate">
                                {appointment.customer?.name || appointment.title || 'Untitled'}
                              </div>
                              {appointment.address && (
                                <div className="text-[9px] sm:text-[10px] truncate opacity-90">
                                  {appointment.address}
                                </div>
                              )}
                            </div>
                          ))}
                          {dayAppointments.length > 3 && (
                            <div className="text-[10px] text-muted-foreground text-center">
                              +{dayAppointments.length - 3} more
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Appointment Details Sidebar - Desktop only */}
        <div className="hidden lg:block w-80 border-l">
          <ScrollArea className="h-full">
            <div className="p-4">
              {selectedDate ? (
                <>
                  <h3 className="font-semibold text-lg mb-3" data-testid="text-selected-date">
                    {format(selectedDate, 'EEEE, MMMM d, yyyy')}
                  </h3>

                  {selectedDateAppointments.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground text-sm">
                        No appointments scheduled
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        data-testid="button-add-appointment"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Appointment
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedDateAppointments.map(appointment => (
                        <Card
                          key={appointment.id}
                          className="hover-elevate cursor-pointer"
                          onClick={() => handleEditJob(appointment)}
                          data-testid={`appointment-card-${appointment.id}`}
                        >
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between gap-2">
                              <CardTitle className="text-base">
                                {appointment.title || appointment.customer?.name || 'Untitled Appointment'}
                              </CardTitle>
                              {appointment.priority && (
                                <Badge
                                  variant={getPriorityVariant(appointment.priority)}
                                  className="capitalize"
                                  data-testid={`badge-priority-${appointment.id}`}
                                >
                                  {appointment.priority}
                                </Badge>
                              )}
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-2 text-sm">
                            {appointment.scheduledDate && (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Clock className="h-4 w-4" />
                                <span data-testid={`text-time-${appointment.id}`}>
                                  {format(
                                    typeof appointment.scheduledDate === 'string'
                                      ? parseISO(appointment.scheduledDate)
                                      : appointment.scheduledDate,
                                    'h:mm a'
                                  )}
                                </span>
                              </div>
                            )}
                            {appointment.address && (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <MapPin className="h-4 w-4 flex-shrink-0" />
                                <span className="truncate" data-testid={`text-location-${appointment.id}`}>
                                  {appointment.address}
                                </span>
                              </div>
                            )}
                            {appointment.customer && (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <User className="h-4 w-4" />
                                <span data-testid={`text-customer-${appointment.id}`}>
                                  {appointment.customer.name}
                                </span>
                              </div>
                            )}
                            <div className="pt-2 flex items-center justify-between gap-2">
                              <Badge variant="outline" className="capitalize">
                                {appointment.status.replace('_', ' ')}
                              </Badge>
                              {appointment.customer?.phone && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => handleSendSms(appointment, e)}
                                  data-testid={`button-send-sms-${appointment.id}`}
                                >
                                  <MessageSquare className="h-4 w-4 mr-1" />
                                  SMS
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8">
                  <CalendarIcon className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground text-sm">
                    Select a date to view appointments
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Mobile Appointment Sheet */}
      {selectedDate && selectedDateAppointments.length > 0 && (
        <div className="lg:hidden border-t bg-card">
          <ScrollArea className="h-48">
            <div className="p-3 space-y-2">
              <h3 className="font-semibold text-sm mb-2" data-testid="text-mobile-selected-date">
                {format(selectedDate, 'EEE, MMM d')}
              </h3>
              {selectedDateAppointments.map(appointment => (
                <Card
                  key={appointment.id}
                  className="hover-elevate cursor-pointer"
                  onClick={() => handleEditJob(appointment)}
                  data-testid={`mobile-appointment-${appointment.id}`}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {appointment.title || appointment.customer?.name || 'Untitled'}
                        </p>
                        {appointment.scheduledDate && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(
                              typeof appointment.scheduledDate === 'string'
                                ? parseISO(appointment.scheduledDate)
                                : appointment.scheduledDate,
                              'h:mm a'
                            )}
                          </p>
                        )}
                        {appointment.customer?.name && (
                          <p className="text-xs text-muted-foreground">
                            {appointment.customer.name}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col gap-1 items-end">
                        <Badge variant="outline" className="capitalize text-[10px]">
                          {appointment.status.replace('_', ' ')}
                        </Badge>
                        {appointment.customer?.phone && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => handleSendSms(appointment, e)}
                            data-testid={`button-send-sms-mobile-${appointment.id}`}
                          >
                            <MessageSquare className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* SMS Dialog */}
      <Dialog open={smsDialogOpen} onOpenChange={setSmsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]" data-testid="dialog-send-sms">
          <DialogHeader>
            <DialogTitle>Send SMS to Customer</DialogTitle>
            <DialogDescription>
              Send a text message to {selectedJob?.customer?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="customer-phone">Phone Number</Label>
              <div className="text-sm text-muted-foreground" data-testid="text-customer-phone">
                {selectedJob?.customer?.phone || 'No phone number'}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sms-message">Message ({smsMessage.length}/160)</Label>
              <Textarea
                id="sms-message"
                placeholder="Enter your message..."
                value={smsMessage}
                onChange={(e) => setSmsMessage(e.target.value)}
                maxLength={160}
                rows={4}
                data-testid="textarea-sms-message"
              />
              <p className="text-xs text-muted-foreground">
                SMS messages are limited to 160 characters
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSmsDialogOpen(false)}
              data-testid="button-cancel-sms"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendSmsConfirm}
              disabled={!smsMessage || smsMessage.length === 0 || sendSmsMutation.isPending}
              data-testid="button-confirm-send-sms"
            >
              {sendSmsMutation.isPending ? 'Sending...' : 'Send SMS'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Job Edit Dialog */}
      {jobToEdit && (
        <GlobalJobCard
          isOpen={showJobEditDialog}
          onClose={() => {
            setShowJobEditDialog(false);
            setJobToEdit(null);
          }}
          mode="edit"
          job={jobToEdit}
          onJobCreated={() => {
            queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
            setShowJobEditDialog(false);
            setJobToEdit(null);
          }}
          onJobUpdated={() => {
            queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
            setShowJobEditDialog(false);
            setJobToEdit(null);
            toast({
              title: "Job Updated",
              description: "The job has been updated successfully.",
            });
          }}
        />
      )}
    </div>
  );
}
