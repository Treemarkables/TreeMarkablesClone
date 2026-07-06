// Selected-date appointment details — desktop sidebar + mobile bottom sheet,
// extracted from the original Calendar page. Keeps the SMS shortcut and the
// confirmation badge states.
import { format } from "date-fns";
import {
  Calendar as CalendarIcon,
  Check,
  Clock,
  MapPin,
  MessageSquare,
  Plus,
  Reply,
  User,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatNZTime } from "@shared/dateUtils";
import type { CalendarCustomer, CalendarJob } from "./calendarMath";

export interface JobWithCustomerInfo extends CalendarJob {
  customer?: CalendarCustomer;
}

interface DayDetailPanelProps {
  selectedDate: Date | null;
  appointments: JobWithCustomerInfo[];
  onEditJob: (job: JobWithCustomerInfo) => void;
  onSendSms: (job: JobWithCustomerInfo, e?: React.MouseEvent) => void;
  onAddAppointment: () => void;
  // "sidebar" renders inside the main flex row (desktop, lg+); "sheet" renders
  // BELOW the row as the mobile bottom drawer. Render one of each — putting the
  // sheet inside the row would turn it into a side column on small screens.
  variant: "sidebar" | "sheet";
}

const getPriorityVariant = (priority: string | null | undefined) => {
  switch (priority) {
    case "urgent":
      return "destructive" as const;
    case "high":
      return "default" as const;
    case "medium":
      return "secondary" as const;
    default:
      return "outline" as const;
  }
};

const jobTime = (job: JobWithCustomerInfo): string | null => {
  if (!job.scheduledDate) return null;
  return formatNZTime(
    typeof job.scheduledDate === "string"
      ? job.scheduledDate
      : (job.scheduledDate as Date).toISOString(),
    "time",
  );
};

export function DayDetailPanel({
  selectedDate,
  appointments,
  onEditJob,
  onSendSms,
  onAddAppointment,
  variant,
}: DayDetailPanelProps) {
  if (variant === "sheet") {
    return (
      <>
        {/* Mobile Appointment Sheet */}
        {selectedDate && appointments.length > 0 && (
          <div className="lg:hidden border-t bg-card">
            <ScrollArea className="h-48">
              <div className="p-3 space-y-2">
                <h3
                  className="font-semibold text-sm mb-2"
                  data-testid="text-mobile-selected-date"
                >
                  {format(selectedDate, "EEE, MMM d")}
                </h3>
                {appointments.map((appointment) => {
                  const time = jobTime(appointment);
                  return (
                    <Card
                      key={appointment.id}
                      className="hover-elevate cursor-pointer"
                      onClick={() => onEditJob(appointment)}
                      data-testid={`mobile-appointment-${appointment.id}`}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">
                              {appointment.title ||
                                appointment.customer?.name ||
                                "Untitled"}
                            </p>
                            {time && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {time}
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
                              {appointment.status.replace("_", " ")}
                            </Badge>
                            {appointment.customer?.phone && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => onSendSms(appointment, e)}
                                data-testid={`button-send-sms-mobile-${appointment.id}`}
                              >
                                <MessageSquare className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {/* Appointment Details Sidebar - Desktop only */}
      <div className="hidden lg:block w-80 border-l">
        <ScrollArea className="h-full">
          <div className="p-4">
            {selectedDate ? (
              <>
                <h3
                  className="font-semibold text-lg mb-3"
                  data-testid="text-selected-date"
                >
                  {format(selectedDate, "EEEE, MMMM d, yyyy")}
                </h3>

                {appointments.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground text-sm">
                      No appointments scheduled
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={onAddAppointment}
                      data-testid="button-add-appointment"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Appointment
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {appointments.map((appointment) => {
                      const awaitingConfirm =
                        appointment.status === "work_order" &&
                        !appointment.customerConfirmed;
                      const time = jobTime(appointment);
                      return (
                        <Card
                          key={appointment.id}
                          className={`hover-elevate cursor-pointer ${
                            awaitingConfirm ? "border-dashed opacity-80" : ""
                          }`}
                          onClick={() => onEditJob(appointment)}
                          data-testid={`appointment-card-${appointment.id}`}
                        >
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between gap-2">
                              <CardTitle className="text-base">
                                {appointment.title ||
                                  appointment.customer?.name ||
                                  "Untitled Appointment"}
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
                            {time && (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Clock className="h-4 w-4" />
                                <span data-testid={`text-time-${appointment.id}`}>
                                  {time}
                                </span>
                              </div>
                            )}
                            {appointment.address && (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <MapPin className="h-4 w-4 flex-shrink-0" />
                                <span
                                  className="truncate"
                                  data-testid={`text-location-${appointment.id}`}
                                >
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
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <Badge variant="outline" className="capitalize">
                                  {appointment.status.replace("_", " ")}
                                </Badge>
                                {appointment.customerConfirmed ? (
                                  <Badge
                                    className="bg-green-100 text-green-700 border-0 text-xs"
                                    data-testid={`badge-confirmed-${appointment.id}`}
                                  >
                                    <Check className="h-3 w-3 mr-1" />
                                    Confirmed
                                  </Badge>
                                ) : appointment.customerReplyReceivedAt ? (
                                  <Badge
                                    className="bg-amber-100 text-amber-700 border-0 text-xs"
                                    data-testid={`badge-customer-replied-${appointment.id}`}
                                  >
                                    <MessageSquare className="h-3 w-3 mr-1" />
                                    Customer replied
                                  </Badge>
                                ) : awaitingConfirm ? (
                                  <Badge
                                    variant="outline"
                                    className="border-dashed text-xs text-muted-foreground"
                                    data-testid={`badge-awaiting-${appointment.id}`}
                                  >
                                    Awaiting confirmation
                                  </Badge>
                                ) : null}
                                {appointment.confirmationReplySentAt && (
                                  <Badge
                                    className="bg-blue-100 text-blue-700 border-0 text-xs"
                                    data-testid={`badge-reply-sent-${appointment.id}`}
                                  >
                                    <Reply className="h-3 w-3 mr-1" />
                                    Reply sent
                                  </Badge>
                                )}
                              </div>
                              {appointment.customer?.phone && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => onSendSms(appointment, e)}
                                  data-testid={`button-send-sms-${appointment.id}`}
                                >
                                  <MessageSquare className="h-4 w-4 mr-1" />
                                  SMS
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
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

    </>
  );
}
