import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  X,
  MessageSquare,
  Smartphone,
  Send,
  Link,
  FileText,
  Calendar as CalendarIcon,
} from "lucide-react";
import { format as formatDate } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { CalendarAvailabilityModal } from "./CalendarAvailabilityModal";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { MicrophoneButton } from "@/components/MicrophoneButton";

const smsFormSchema = z.object({
  phone: z.string().min(1, "Phone number is required"),
  message: z
    .string()
    .min(1, "Message is required")
    .max(459, "SMS message must be 459 characters or less (3 SMS segments)"),
});

type SMSFormData = z.infer<typeof smsFormSchema>;

interface SMSComposerModalProps {
  isOpen: boolean;
  onClose: () => void;
  job?: any;
  customer?: any;
  invoiceData?: any;
}

export function SMSComposerModal({
  isOpen,
  onClose,
  job,
  customer,
  invoiceData,
}: SMSComposerModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [characterCount, setCharacterCount] = useState(0);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("custom");
  const [isAvailabilityOpen, setIsAvailabilityOpen] = useState(false);

  // Fetch SMS templates
  const { data: smsTemplatesData } = useQuery({
    queryKey: ["/api/sms-templates"],
    enabled: isOpen,
  });

  const smsTemplates = (smsTemplatesData as any)?.data || [];

  const form = useForm<SMSFormData>({
    resolver: zodResolver(smsFormSchema),
    defaultValues: {
      phone: "",
      message: "",
    },
  });

  // Auto-populate phone number when modal opens
  useEffect(() => {
    if (isOpen) {
      // Get best available phone number - prefer mobile for SMS
      const phone =
        job?.jobContactMobile ||
        job?.jobContactPhone ||
        job?.billingContactMobile ||
        customer?.mobile ||
        customer?.phone ||
        "";
      if (phone) {
        form.setValue("phone", phone);
        console.log("📱 Auto-populated SMS phone number:", phone);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, job?.id, customer?.id]);

  // Only auto-generate message for invoice context
  useEffect(() => {
    if (isOpen && invoiceData && customer) {
      // Prefer job contact first name, fall back to customer name
      const recipientFirstName =
        job?.jobContactFirstName ||
        customer.firstName ||
        customer.name?.split(" ")[0] ||
        "there";
      const defaultMessage = `Hi ${recipientFirstName}, invoice ${invoiceData.invoiceNumber || "#" + (job?.jobNumber || "")} for $${invoiceData.amount || "0.00"} ready. View: ${window.location.origin}/invoice/${invoiceData.id || "preview"}`;
      form.setValue("message", defaultMessage);
      setCharacterCount(defaultMessage.length);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer, invoiceData, isOpen]);

  // Helper function to fill in customer's saved phone number (prefer mobile for SMS)
  const useCustomerPhone = () => {
    const phone =
      job?.jobContactMobile ||
      job?.jobContactPhone ||
      job?.billingContactMobile ||
      customer?.mobile ||
      customer?.phone ||
      "";
    if (phone) {
      form.setValue("phone", phone);
    } else {
      toast({
        description: "No saved phone number found",
        variant: "destructive",
      });
    }
  };

  // Handle template selection
  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);

    // If "No Template" is selected (custom), clear the message
    if (templateId === "custom") {
      form.setValue("message", "");
      setCharacterCount(0);
      return;
    }

    const template = smsTemplates.find((t: any) => t.id === templateId);

    if (template) {
      let message = template.message || "";

      // Get contact name — prefer job contact fields, fall back to customer record
      let contactName = "";
      if (job?.jobContactFirstName && job?.jobContactLastName) {
        contactName = `${job.jobContactFirstName} ${job.jobContactLastName}`;
      } else if (job?.jobContactFirstName) {
        contactName = job.jobContactFirstName;
      } else if (customer?.firstName && customer?.lastName) {
        contactName = `${customer.firstName} ${customer.lastName}`;
      } else if (customer?.name) {
        contactName = customer.name;
      }
      const firstName =
        job?.jobContactFirstName ||
        customer?.firstName ||
        customer?.name?.split(" ")[0] ||
        "";

      // Replace placeholders with actual values (support both snake_case and camelCase formats)
      message = message.replace(/\{customer_name\}/gi, contactName);
      message = message.replace(/\{customerName\}/g, contactName);
      message = message.replace(/\{customer_first_name\}/gi, firstName);
      message = message.replace(/\{firstName\}/g, firstName);
      message = message.replace(/\{name\}/gi, contactName);

      if (job) {
        message = message.replace(/\{job_number\}/gi, job.jobNumber || "");
        message = message.replace(/\{jobNumber\}/g, job.jobNumber || "");
        message = message.replace(/\{job_address\}/gi, job.address || "");
        message = message.replace(/\{address\}/g, job.address || "");
        message = message.replace(
          /\{job_date\}/gi,
          job.scheduledDate
            ? new Date(job.scheduledDate).toLocaleDateString()
            : "",
        );
        message = message.replace(
          /\{scheduledDate\}/g,
          job.scheduledDate
            ? new Date(job.scheduledDate).toLocaleDateString()
            : "",
        );
      }

      form.setValue("message", message);
      setCharacterCount(message.length);
    }
  };

  // Watch message field to update character count
  const watchedMessage = form.watch("message");
  useEffect(() => {
    setCharacterCount(watchedMessage?.length || 0);
  }, [watchedMessage]);

  // Insert a time phrase from the availability modal at the current caret position,
  // falling back to appending if the textarea isn't mounted.
  const handleSlotPick = (slotStart: Date) => {
    const nz = toZonedTime(slotStart, "Pacific/Auckland");
    // Compact form to preserve SMS segment count: "Tue 25 Nov 2 PM"
    const phrase = formatDate(nz, "EEE d MMM h a");
    const ta = document.querySelector(
      '[data-testid="textarea-message"]',
    ) as HTMLTextAreaElement | null;
    const current = form.getValues("message") || "";

    if (ta) {
      const start = ta.selectionStart ?? current.length;
      const end = ta.selectionEnd ?? current.length;
      const next = current.slice(0, start) + phrase + current.slice(end);
      form.setValue("message", next, { shouldDirty: true, shouldValidate: true });
      requestAnimationFrame(() => {
        ta.focus();
        const pos = start + phrase.length;
        ta.setSelectionRange(pos, pos);
      });
    } else {
      const next = current ? `${current} ${phrase}` : phrase;
      form.setValue("message", next, { shouldDirty: true, shouldValidate: true });
    }
  };

  const sendSMSMutation = useMutation({
    mutationFn: async (data: SMSFormData) => {
      return apiRequest("POST", "/api/sms/send", {
        phone: data.phone,
        message: data.message,
        jobId: job?.id,
        customerId: customer?.id,
        invoiceId: invoiceData?.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      onClose();
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "SMS Failed",
        description: error.message || "Failed to send SMS",
        variant: "destructive",
      });
    },
  });

  const handleSend = async (data: SMSFormData) => {
    sendSMSMutation.mutate(data);
  };

  const handleClose = () => {
    onClose();
    form.reset();
    setCharacterCount(0);
  };

  return (
    <>
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg p-0">
        <DialogHeader className="bg-gradient-to-r from-purple-500 to-pink-500 text-white p-4 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              <DialogTitle className="text-white">
                {invoiceData ? "Send SMS Invoice" : "Send SMS"}
              </DialogTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="text-white hover:bg-white/20 p-1 h-auto"
              data-testid="button-close-sms"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSend)}
            className="space-y-4 p-6"
          >
            {/* Phone Number Field */}
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel className="flex items-center gap-2">
                      <Smartphone
                        className="w-4 h-4"
                        style={{ color: "hsl(var(--purple))" }}
                      />
                      Phone Number
                    </FormLabel>
                    {(job?.jobContactPhone ||
                      job?.billingContactMobile ||
                      customer?.phone ||
                      customer?.mobile) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={useCustomerPhone}
                        className="h-auto py-1 px-2 text-xs"
                        data-testid="button-use-customer-phone"
                      >
                        Use saved number
                      </Button>
                    )}
                  </div>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Enter phone number or use saved number"
                      data-testid="input-phone"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* SMS Template Selector - Only show if NOT invoice context */}
            {!invoiceData && smsTemplates.length > 0 && (
              <div className="space-y-2">
                <FormLabel>SMS Template (optional)</FormLabel>
                <Select
                  value={selectedTemplate}
                  onValueChange={handleTemplateSelect}
                >
                  <SelectTrigger data-testid="select-sms-template">
                    <SelectValue placeholder="Select a template..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom">
                      No Template (Custom Message)
                    </SelectItem>
                    {smsTemplates.map((template: any) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Invoice Attachment Preview */}
            {invoiceData && (
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-3 rounded-md border border-purple-200 dark:border-purple-700">
                <div className="flex items-center gap-2 mb-2">
                  <FileText
                    className="w-4 h-4"
                    style={{ color: "hsl(var(--purple))" }}
                  />
                  <span className="font-medium text-sm">
                    Invoice Attachment
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>
                    Invoice{" "}
                    {invoiceData.invoiceNumber || "#" + (job?.jobNumber || "")}
                  </span>
                  <span
                    className="font-semibold"
                    style={{ color: "hsl(var(--purple))" }}
                  >
                    ${invoiceData.amount || "0.00"}
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                  <Link className="w-3 h-3" />
                  <span>Invoice link will be included in SMS</span>
                </div>
              </div>
            )}

            {/* Message Field */}
            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Message</FormLabel>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => setIsAvailabilityOpen(true)}
                        title="Check your Google Calendar availability"
                        data-testid="button-sms-check-availability"
                      >
                        <CalendarIcon className="h-4 w-4" />
                      </Button>
                      <MicrophoneButton
                        onTranscript={(transcript) => {
                          const currentValue = form.getValues("message");
                          const newValue = currentValue
                            ? `${currentValue} ${transcript}`
                            : transcript;
                          form.setValue("message", newValue);
                        }}
                        size="sm"
                        variant="ghost"
                      />
                    </div>
                  </div>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Enter your SMS message..."
                      className="min-h-[100px] resize-none"
                      data-testid="textarea-message"
                    />
                  </FormControl>
                  <div className="flex justify-between items-center text-xs text-muted-foreground">
                    <FormMessage />
                    <span
                      className={
                        characterCount > 459
                          ? "text-destructive"
                          : characterCount > 160
                            ? "text-orange-500"
                            : ""
                      }
                    >
                      {characterCount}/459 characters
                      {characterCount > 160
                        ? ` (${Math.ceil(characterCount / 153)} SMS segments)`
                        : ""}
                    </span>
                  </div>
                </FormItem>
              )}
            />

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className="flex-1"
                data-testid="button-cancel-sms"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={sendSMSMutation.isPending}
                className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                data-testid="button-send-sms"
              >
                {sendSMSMutation.isPending ? (
                  "Sending..."
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send SMS
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
    <CalendarAvailabilityModal
      isOpen={isAvailabilityOpen}
      onClose={() => setIsAvailabilityOpen(false)}
      onSlotPick={handleSlotPick}
    />
    </>
  );
}
