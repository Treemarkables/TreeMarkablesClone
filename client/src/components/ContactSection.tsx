import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import ReCAPTCHA from "react-google-recaptcha";

// Declare gtag for TypeScript
declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

interface ContactFormData {
  name: string;
  email: string;
  phone: string;
  hearAbout: string;
  message: string;
}

export default function ContactSection() {
  const [formData, setFormData] = useState<ContactFormData>({
    name: '',
    email: '',
    phone: '',
    hearAbout: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const recaptchaRef = useRef<ReCAPTCHA>(null);
  const { toast } = useToast();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateForm = (): string | null => {
    if (!formData.name.trim()) {
      return 'Please enter your name';
    }
    if (!formData.email.trim()) {
      return 'Please enter your email address';
    }
    if (!formData.message.trim()) {
      return 'Please enter a message';
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      return 'Please enter a valid email address';
    }

    return null;
  };

  const handleCaptchaChange = (token: string | null) => {
    setCaptchaToken(token);
  };

  const handleQuoteRequest = async () => {
    // Validate form
    const validationError = validateForm();
    if (validationError) {
      toast({
        title: "Validation Error",
        description: validationError,
        variant: "destructive",
      });
      return;
    }

    // Skip CAPTCHA validation in development mode
    const isDevelopment = import.meta.env.MODE === 'development' || import.meta.env.DEV === true;
    if (!isDevelopment && !captchaToken) {
      toast({
        title: "CAPTCHA Required",
        description: "Please complete the CAPTCHA verification to prevent spam.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim(),
          hearAbout: formData.hearAbout,
          message: formData.message.trim(),
          captchaToken: captchaToken
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Track successful form submission in Google Analytics
        if (window.gtag) {
          window.gtag('event', 'form_submit', {
            'event_category': 'Lead Generation',
            'event_label': 'Contact Form',
            'value': 1
          });
          
          // Track as conversion
          window.gtag('event', 'conversion', {
            'send_to': 'G-V7RHX2EL6B',
            'event_category': 'Lead Generation',
            'event_label': 'Quote Request'
          });
          
          console.log('Google Analytics: Form submission tracked');
        }
        
        toast({
          title: "Quote Request Sent!",
          description: result.message,
        });
        
        // Reset form and CAPTCHA
        setFormData({
          name: '',
          email: '',
          phone: '',
          hearAbout: '',
          message: ''
        });
        setCaptchaToken(null);
        recaptchaRef.current?.reset();
      } else {
        toast({
          title: "Error",
          description: result.message || 'Failed to send your request. Please try again.',
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Form submission error:', error);
      toast({
        title: "Error",
        description: 'Sorry, there was an error sending your message. Please try again or call us directly.',
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="contact" className="py-16 bg-blue-50 dark:bg-blue-950/20">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Get in touch for a free quote
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Ready to get started? Contact us today for a free consultation and quote
          </p>
        </div>

        <div className="max-w-2xl mx-auto">
          {/* Quick Quote Form */}
          <Card>
            <CardContent className="p-8">
              <h3 className="text-2xl font-semibold text-foreground mb-6">Request Free Quote</h3>
              <div className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-foreground mb-2">
                    Name *
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="Your full name"
                    data-testid="input-name"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="your.email@example.com"
                    data-testid="input-email"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-foreground mb-2">
                    Phone
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="Your phone number"
                    data-testid="input-phone"
                  />
                </div>
                <div>
                  <label htmlFor="hearAbout" className="block text-sm font-medium text-foreground mb-2">
                    How did you hear about us?
                  </label>
                  <select
                    id="hearAbout"
                    name="hearAbout"
                    value={formData.hearAbout}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    data-testid="select-hear-about"
                  >
                    <option value="">Please select...</option>
                    <option value="Google Search">Google Search</option>
                    <option value="Facebook">Facebook</option>
                    <option value="Word of mouth/Referral">Word of mouth/Referral</option>
                    <option value="Previous customer">Previous customer</option>
                    <option value="Local advertising">Local advertising</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-foreground mb-2">
                    Message *
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleInputChange}
                    rows={4}
                    className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                    placeholder="Tell us about your tree removal needs..."
                    data-testid="textarea-message"
                    required
                  />
                </div>
                
                {/* Development mode notice - CAPTCHA disabled in dev */}
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-blue-800 text-sm text-center" data-testid="dev-notice">
                  🔧 Development mode: CAPTCHA disabled for testing
                </div>
                
                <Button
                  size="lg"
                  className="w-full"
                  onClick={handleQuoteRequest}
                  disabled={isSubmitting}
                  data-testid="button-submit-quote"
                >
                  {isSubmitting ? 'Sending...' : 'Get Free Quote'}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  We'll respond within 24 hours with your personalized quote
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}