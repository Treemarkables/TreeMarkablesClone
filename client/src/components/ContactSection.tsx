import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
// No icons needed for this simplified contact section

export default function ContactSection() {
  const handleQuoteRequest = () => {
    console.log('Quote request submitted');
    // In a real app, this would handle form submission
    alert('Thank you! We will contact you within 24 hours for your free quote.');
  };

  return (
    <section id="contact" className="py-16 bg-background">
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
                    className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="Your full name"
                    data-testid="input-name"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    id="email"
                    className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="your.email@example.com"
                    data-testid="input-email"
                  />
                </div>
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-foreground mb-2">
                    Phone
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="Your phone number"
                    data-testid="input-phone"
                  />
                </div>
                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-foreground mb-2">
                    Message *
                  </label>
                  <textarea
                    id="message"
                    rows={4}
                    className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                    placeholder="Tell us about your tree removal needs..."
                    data-testid="textarea-message"
                  />
                </div>
                <Button
                  size="lg"
                  className="w-full"
                  onClick={handleQuoteRequest}
                  data-testid="button-submit-quote"
                >
                  Get Free Quote
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