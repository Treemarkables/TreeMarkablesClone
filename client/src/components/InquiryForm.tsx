import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Leaf, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
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

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

interface InquiryFormProps {
  onCancel?: () => void;
  onSuccess?: () => void;
  showCloseIcon?: boolean;
}

const hearAboutOptions = [
  "Google",
  "Facebook",
  "Word of mouth/Referral",
  "Previous customer",
  "Local advertising",
  "Other",
];

export default function InquiryForm({
  onCancel,
  onSuccess,
  showCloseIcon = false,
}: InquiryFormProps) {
  const { toast } = useToast();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [hearAbout, setHearAbout] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/contact", {
        name: `${firstName.trim()} ${lastName.trim()}`.trim(),
        email: email.trim(),
        phone: phone.trim(),
        hearAbout,
        message: message.trim(),
      });
      return response.json();
    },
    onSuccess: () => {
      if (window.gtag) {
        window.gtag("event", "generate_lead", {
          event_category: "Contact",
          event_label: "Inquiry Form",
        });
      }
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("");
      setMessage("");
      setHearAbout("");
      setSubmitted(true);
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Submission failed",
        description:
          error.message ||
          "There was an error sending your inquiry. Please try again or call us directly.",
        variant: "destructive",
      });
    },
  });

  const validate = (): string | null => {
    if (!firstName.trim()) return "Please enter your first name";
    if (!lastName.trim()) return "Please enter your last name";
    if (!email.trim()) return "Please enter your email address";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim()))
      return "Please enter a valid email address";
    if (!message.trim()) return "Please tell us about the job";
    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const error = validate();
    if (error) {
      toast({
        title: "Check the form",
        description: error,
        variant: "destructive",
      });
      return;
    }
    mutation.mutate();
  };

  if (submitted) {
    return (
      <div
        className="bg-white rounded-2xl shadow-xl border border-border p-8 text-center"
        data-testid="inquiry-form-success"
      >
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#39FF14]/20">
          <Leaf className="h-6 w-6 text-[#1f7a1f]" />
        </div>
        <h3 className="text-xl font-semibold text-foreground mb-2">
          Inquiry sent
        </h3>
        <p className="text-muted-foreground mb-6">
          Jules will personally reply within 24 hours to confirm we've received
          your inquiry.
        </p>
        <Button
          type="button"
          onClick={() => setSubmitted(false)}
          data-testid="button-send-another"
        >
          Send another inquiry
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="relative bg-white rounded-2xl shadow-xl border border-border p-6 md:p-8"
      data-testid="inquiry-form"
    >
      <div className="flex items-center justify-center gap-2 mb-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1f7a1f]">
          <Leaf className="h-5 w-5 text-white" />
        </div>
        <h3 className="text-xl font-semibold text-foreground">Want a free quote?</h3>
      </div>
      {showCloseIcon && onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
          aria-label="Close"
          data-testid="button-close-inquiry"
        >
          <X className="h-5 w-5" />
        </button>
      )}

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="firstName"
              className="block text-sm font-medium text-foreground mb-1.5"
            >
              First name
            </label>
            <Input
              id="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder=""
              data-testid="input-first-name"
              required
            />
          </div>
          <div>
            <label
              htmlFor="lastName"
              className="block text-sm font-medium text-foreground mb-1.5"
            >
              Last name
            </label>
            <Input
              id="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder=""
              data-testid="input-last-name"
              required
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="inquiryEmail"
            className="block text-sm font-medium text-foreground mb-1.5"
          >
            Email
          </label>
          <Input
            id="inquiryEmail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder=""
            data-testid="input-inquiry-email"
            required
          />
        </div>

        <div>
          <label
            htmlFor="inquiryPhone"
            className="block text-sm font-medium text-foreground mb-1.5"
          >
            Phone
          </label>
          <Input
            id="inquiryPhone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder=""
            data-testid="input-inquiry-phone"
          />
        </div>

        <div>
          <label
            htmlFor="inquiryMessage"
            className="block text-sm font-medium text-foreground mb-1.5"
          >
            Message
          </label>
          <Textarea
            id="inquiryMessage"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Tell us about the job..."
            className="min-h-[100px]"
            data-testid="textarea-inquiry-message"
            required
          />
        </div>

        <div>
          <label
            htmlFor="hearAbout"
            className="block text-sm font-medium text-foreground mb-1.5"
          >
            How did you find us?
          </label>
          <Select value={hearAbout} onValueChange={setHearAbout}>
            <SelectTrigger
              id="hearAbout"
              data-testid="select-inquiry-hear-about"
            >
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              {hearAboutOptions.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={mutation.isPending || !onCancel}
          className={onCancel ? "" : "invisible"}
          data-testid="button-inquiry-cancel"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={mutation.isPending}
          className="bg-[#1f7a1f] hover:bg-[#196619] text-white min-w-[140px]"
          data-testid="button-inquiry-submit"
        >
          {mutation.isPending ? "Sending..." : "Send inquiry"}
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-6 pt-4 border-t border-border text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-[#1f7a1f]" />
          Fully insured
        </span>
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-[#1f7a1f]" />
          Qualified arborists
        </span>
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-[#1f7a1f]" />
          Gisborne local
        </span>
      </div>
    </form>
  );
}
