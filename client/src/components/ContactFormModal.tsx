import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

const contactFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(255, "Name is too long"),
  email: z.string().email("Please enter a valid email address").max(255),
  phone: z.string().min(1, "Phone number is required").max(50),
  address: z.string().max(500, "Address is too long").optional(),
  serviceType: z.enum(
    [
      "tree_removal",
      "pruning",
      "hedge_trimming",
      "stump_grinding",
      "emergency",
      "other",
    ],
    {
      required_error: "Please select a service type",
    },
  ),
  propertyType: z.enum(["residential", "commercial", "council"]).optional(),
  urgency: z
    .enum(["immediate", "within_week", "within_month", "planning"])
    .optional(),
  message: z
    .string()
    .min(1, "Message is required")
    .max(5000, "Message is too long"),
});

type ContactFormData = z.infer<typeof contactFormSchema>;

const serviceTypeLabels: Record<string, string> = {
  tree_removal: "Tree Removal",
  pruning: "Tree Pruning",
  hedge_trimming: "Hedge Trimming",
  stump_grinding: "Stump Grinding",
  emergency: "Emergency Service",
  other: "Other",
};

const propertyTypeLabels: Record<string, string> = {
  residential: "Residential",
  commercial: "Commercial",
  council: "Council/Government",
};

const urgencyLabels: Record<string, string> = {
  immediate: "Immediate/Emergency",
  within_week: "Within a Week",
  within_month: "Within a Month",
  planning: "Planning Ahead",
};

interface ContactFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ContactFormModal({
  open,
  onOpenChange,
}: ContactFormModalProps) {
  const { toast } = useToast();
  const [isSubmitted, setIsSubmitted] = useState(false);

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      address: "",
      message: "",
    },
  });

  const contactMutation = useMutation({
    mutationFn: async (data: ContactFormData) => {
      const response = await apiRequest("POST", "/api/contact", data);
      return await response.json();
    },
    onSuccess: () => {
      if (window.gtag) {
        window.gtag("event", "generate_lead", {
          event_category: "Contact",
          event_label: "Contact Form Modal",
        });
      }
      form.reset();
      setIsSubmitted(true);
    },
    onError: (error: Error) => {
      toast({
        title: "Submission Failed",
        description:
          error.message ||
          "There was an error submitting your enquiry. Please try again or call us directly.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ContactFormData) => {
    contactMutation.mutate(data);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setIsSubmitted(false);
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="modal-contact-form">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {isSubmitted ? "Thanks — we'll be in touch" : "Send Us an Enquiry"}
          </DialogTitle>
          <DialogDescription>
            {isSubmitted
              ? "Your enquiry has been received. We'll respond within 24 hours with your free quote."
              : "Fill out the form below and we'll respond within 24 hours with a free quote"}
          </DialogDescription>
        </DialogHeader>

        {isSubmitted ? (
          <div className="flex flex-col items-center text-center py-8 gap-4">
            <CheckCircle2 className="h-14 w-14 text-primary" />
            <p className="text-foreground">
              Prefer to talk now? Call us on{" "}
              <a href="tel:0272166882" className="font-semibold underline">
                027-216-6882
              </a>
              .
            </p>
            <Button
              type="button"
              size="lg"
              onClick={() => handleOpenChange(false)}
              data-testid="button-close-success"
            >
              Close
            </Button>
          </div>
        ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Your full name"
                      data-testid="input-name"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email *</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="your.email@example.com"
                        data-testid="input-email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone *</FormLabel>
                    <FormControl>
                      <Input
                        type="tel"
                        placeholder="027-216-6882"
                        data-testid="input-phone"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Service Address</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="123 Main Street, Gisborne"
                      data-testid="input-address"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="serviceType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Service Type *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-service-type">
                          <SelectValue placeholder="Select a service" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(serviceTypeLabels).map(
                          ([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="propertyType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Property Type</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-property-type">
                          <SelectValue placeholder="Select property type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(propertyTypeLabels).map(
                          ([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="urgency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Urgency</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-urgency">
                        <SelectValue placeholder="When do you need this done?" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(urgencyLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Message *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Tell us about your tree service needs..."
                      className="min-h-[120px]"
                      data-testid="textarea-message"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex items-center justify-between pt-4">
              <p className="text-sm text-muted-foreground">* Required fields</p>
              <Button
                type="submit"
                size="lg"
                disabled={contactMutation.isPending}
                data-testid="button-submit"
                className="min-w-[140px]"
              >
                {contactMutation.isPending ? "Submitting..." : "Send Enquiry"}
              </Button>
            </div>
          </form>
        </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
