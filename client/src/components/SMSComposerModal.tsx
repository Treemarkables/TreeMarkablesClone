import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X, MessageSquare, Smartphone, Send, Link, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const smsFormSchema = z.object({
  phone: z.string().min(1, "Phone number is required"),
  message: z.string().min(1, "Message is required").max(160, "SMS message must be 160 characters or less"),
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
  invoiceData
}: SMSComposerModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [characterCount, setCharacterCount] = useState(0);

  const form = useForm<SMSFormData>({
    resolver: zodResolver(smsFormSchema),
    defaultValues: {
      phone: "",
      message: "",
    },
  });

  // Pre-populate phone number from customer data
  useEffect(() => {
    if (customer && isOpen) {
      const phone = customer.phone || customer.mobile || "";
      form.setValue("phone", phone);
      
      // Generate default SMS message with invoice link
      if (invoiceData) {
        const defaultMessage = `Hi ${customer.name || 'there'}, your invoice ${invoiceData.invoiceNumber || '#' + (job?.jobNumber || '')} for $${invoiceData.totalAmount || '0.00'} is ready. View: ${window.location.origin}/invoice/${invoiceData.id || 'preview'}`;
        form.setValue("message", defaultMessage);
        setCharacterCount(defaultMessage.length);
      }
    }
  }, [customer, job, invoiceData, isOpen, form]);

  // Watch message field to update character count
  const watchedMessage = form.watch("message");
  useEffect(() => {
    setCharacterCount(watchedMessage?.length || 0);
  }, [watchedMessage]);

  const sendSMSMutation = useMutation({
    mutationFn: async (data: SMSFormData) => {
      return apiRequest('POST', '/api/sms/send', {
        phone: data.phone,
        message: data.message,
        jobId: job?.id,
        customerId: customer?.id,
        invoiceId: invoiceData?.id
      });
    },
    onSuccess: () => {
      toast({
        title: "SMS Sent",
        description: "Invoice SMS has been sent successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
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
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="bg-gradient-to-r from-purple-500 to-pink-500 text-white p-4 rounded-t-lg -m-6 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              <DialogTitle className="text-white">Send SMS Invoice</DialogTitle>
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
          <form onSubmit={form.handleSubmit(handleSend)} className="space-y-4">
            {/* Phone Number Field */}
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4" style={{color: 'hsl(var(--purple))'}} />
                    Phone Number
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="+64 21 123 4567"
                      data-testid="input-phone"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Invoice Attachment Preview */}
            {invoiceData && (
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-3 rounded-md border border-purple-200 dark:border-purple-700">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4" style={{color: 'hsl(var(--purple))'}} />
                  <span className="font-medium text-sm">Invoice Attachment</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Invoice {invoiceData.invoiceNumber || '#' + (job?.jobNumber || '')}</span>
                  <span className="font-semibold" style={{color: 'hsl(var(--purple))'}}>
                    ${invoiceData.totalAmount || '0.00'}
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
                  <FormLabel>Message</FormLabel>
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
                    <span className={characterCount > 160 ? "text-destructive" : ""}>
                      {characterCount}/160 characters
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
  );
}