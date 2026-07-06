import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Phone, Mail, MapPin, TreeDeciduous } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";
import TurnstileCaptcha, {
  useCaptchaConfig,
} from "@/components/TurnstileCaptcha";

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

const contactFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(255, "Name is too long"),
  email: z.string().email("Please enter a valid email address").max(255),
  phone: z.string().max(50).optional(),
  address: z
    .string()
    .min(1, "Service address is required")
    .max(500, "Address is too long"),
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
  propertyType: z.enum(["residential", "commercial", "council"], {
    required_error: "Please select a property type",
  }),
  urgency: z.enum(["immediate", "within_week", "within_month", "planning"], {
    required_error: "Please select an urgency",
  }),
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

export default function Contact() {
  const { toast } = useToast();
  const [website, setWebsite] = useState(""); // honeypot — humans never fill this
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const { enabled: captchaEnabled } = useCaptchaConfig();

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
      const response = await apiRequest("POST", "/api/contact", {
        ...data,
        website,
        captchaToken,
      });
      return await response.json();
    },
    onSuccess: (response) => {
      if (window.gtag) {
        window.gtag("event", "generate_lead", {
          event_category: "Contact",
          event_label: "Contact Form",
        });
      }
      form.reset();
      // Turnstile tokens are single-use — get a fresh one for the next submit.
      setCaptchaReset((c) => c + 1);
    },
    onError: (error: Error) => {
      setCaptchaReset((c) => c + 1);
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
    if (captchaEnabled && !captchaToken) {
      toast({
        title: "Check the form",
        description: "Please complete the security check",
        variant: "destructive",
      });
      return;
    }
    contactMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO
        title="Contact Us – Get a Free Quote | Treemarkables"
        description="Contact Treemarkables for professional tree removal, pruning, stump grinding and hedge trimming services in Gisborne. Get a free quote within 24 hours."
        keywords="tree service quote Gisborne, contact arborist, tree removal enquiry, Gisborne tree service contact"
      />
      <Header />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-12 bg-gradient-to-br from-primary/10 to-primary/5">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div className="rounded-full bg-primary/10 p-3">
                  <TreeDeciduous className="h-8 w-8 text-primary" />
                </div>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Get in Touch
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Ready to transform your outdoor space? Contact our qualified
                arborists for a free, no-obligation quote
              </p>
            </div>
          </div>
        </section>

        {/* Contact Form & Info Section */}
        <section className="py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Contact Information Cards */}
              <div className="lg:col-span-1 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl">
                      Contact Information
                    </CardTitle>
                    <CardDescription>
                      Get in touch with our team
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="rounded-full bg-primary/10 p-2 mt-1">
                        <Phone className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Phone</p>
                        <a
                          href="tel:027-216-6882"
                          className="text-muted-foreground hover:text-primary transition-colors"
                          data-testid="link-phone"
                          onClick={() => {
                            if (window.gtag)
                              window.gtag("event", "phone_call_click", {
                                event_category: "Contact",
                                event_label: "Phone Number Click",
                              });
                          }}
                        >
                          027-216-6882
                        </a>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="rounded-full bg-primary/10 p-2 mt-1">
                        <Mail className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Email</p>
                        <a
                          href="mailto:quotes@treemarkables.nz"
                          className="text-muted-foreground hover:text-primary transition-colors"
                          data-testid="link-email"
                        >
                          quotes@treemarkables.nz
                        </a>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="rounded-full bg-primary/10 p-2 mt-1">
                        <MapPin className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          Service Area
                        </p>
                        <p className="text-muted-foreground">
                          Gisborne, Wairoa & East Coast
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-primary/5 border-primary/20">
                  <CardHeader>
                    <CardTitle className="text-xl">Why Choose Us?</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                      <p className="text-muted-foreground">
                        Qualified & Experienced Arborists
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                      <p className="text-muted-foreground">
                        Fully Insured & Certified
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                      <p className="text-muted-foreground">
                        Free Quote Within 24 Hours
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                      <p className="text-muted-foreground">
                        Competitive Pricing
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                      <p className="text-muted-foreground">
                        Professional Equipment
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Contact Form */}
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-2xl">
                      Send Us an Enquiry
                    </CardTitle>
                    <CardDescription>
                      Fill out the form below and we'll respond within 24 hours
                      with a free quote
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Form {...form}>
                      <form
                        onSubmit={form.handleSubmit(onSubmit)}
                        className="space-y-6"
                      >
                        {/* Name Field */}
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
                          {/* Email Field */}
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

                          {/* Phone Field */}
                          <FormField
                            control={form.control}
                            name="phone"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Phone</FormLabel>
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

                        {/* Address Field */}
                        <FormField
                          control={form.control}
                          name="address"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Service Address *</FormLabel>
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
                          {/* Service Type Field */}
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

                          {/* Property Type Field */}
                          <FormField
                            control={form.control}
                            name="propertyType"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Property Type *</FormLabel>
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

                        {/* Urgency Field */}
                        <FormField
                          control={form.control}
                          name="urgency"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Urgency *</FormLabel>
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
                                  {Object.entries(urgencyLabels).map(
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

                        {/* Message Field */}
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

                        <div
                          className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden"
                          aria-hidden="true"
                        >
                          <label htmlFor="contactWebsite">Website</label>
                          <input
                            id="contactWebsite"
                            name="website"
                            type="text"
                            tabIndex={-1}
                            autoComplete="off"
                            value={website}
                            onChange={(e) => setWebsite(e.target.value)}
                          />
                        </div>

                        <TurnstileCaptcha
                          onToken={setCaptchaToken}
                          resetSignal={captchaReset}
                        />

                        {/* Submit Button */}
                        <div className="flex items-center justify-between pt-4">
                          <p className="text-sm text-muted-foreground">
                            * Required fields
                          </p>
                          <Button
                            type="submit"
                            size="lg"
                            disabled={contactMutation.isPending}
                            data-testid="button-submit"
                            className="min-w-[140px]"
                          >
                            {contactMutation.isPending
                              ? "Submitting..."
                              : "Send Enquiry"}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
