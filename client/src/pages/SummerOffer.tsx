import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ContactSection from "@/components/ContactSection";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check, Star, Users, Clock, Shield, Award, Phone, Mail, Target, Plus, Minus } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";

export default function SummerOffer() {
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setExpandedFaq(expandedFaq === index ? null : index);
  };

  const faqs = [
    {
      question: "How does the $1000 offer work?",
      answer: "Any job booked between October 1st and December 31st, 2025 automatically enters you to win. We'll draw one lucky winner on January 5th, 2026 for a $1000 rebate on their tree care service."
    },
    {
      question: "What are the odds of winning?",
      answer: "With an estimated 90 jobs during the promotion period, you have a 1-in-90 chance of winning the $1000 rebate - much better odds than any lottery!"
    },
    {
      question: "What services are included?",
      answer: "All our tree care services qualify: tree removal, pruning, stump grinding, emergency tree services, and property clearance. Any job over $200 automatically enters."
    },
    {
      question: "When will the winner be announced?",
      answer: "The winner will be drawn and announced on January 5th, 2026. We'll contact the winner directly and announce it on our Facebook page and website."
    },
    {
      question: "Is there a minimum job value?",
      answer: "Yes, jobs must be at least $200 to qualify for the draw. This ensures fairness and covers our standard service threshold."
    }
  ];

  const services = [
    {
      icon: <Shield className="w-8 h-8 text-primary" />,
      title: "Hazardous Tree Removal",
      description: "Safe removal of dangerous trees threatening your property"
    },
    {
      icon: <Clock className="w-8 h-8 text-primary" />,
      title: "Emergency Tree Services",
      description: "24/7 emergency response for storm damage and fallen trees"
    },
    {
      icon: <Award className="w-8 h-8 text-primary" />,
      title: "Professional Pruning",
      description: "Expert tree pruning to improve health and appearance"
    }
  ];

  const testimonials = [
    {
      name: "Sarah Mitchell",
      location: "Kaiti, Gisborne",
      text: "Treemarkables removed three large pine trees from my backyard. Professional, efficient, and cleaned up everything perfectly!",
      rating: 5
    },
    {
      name: "Mike Thompson", 
      location: "Elgin, Gisborne",
      text: "Called them for emergency tree removal after the storm. They were there the same day and sorted everything out quickly.",
      rating: 5
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title="Win $1000 Back - Summer Tree Care Offer | Treemarkables Gisborne"
        description="Book any tree care service this summer and win up to $1000 back! 1-in-90 chance to win. Professional tree removal, pruning & emergency services in Gisborne."
        keywords="tree removal offer, Gisborne tree care discount, win money back tree service, summer tree removal special, $1000 tree care rebate"
        ogTitle="Win $1000 Back on Tree Care - Summer Offer"
        ogDescription="Book any tree service this summer for your chance to win $1000 back! Professional arborists serving Gisborne and surrounding areas."
        canonicalUrl="https://www.treemarkables.co.nz/summer-offer"
      />
      <Header />
      
      {/* Hero Section */}
      <section className="pt-32 pb-20 bg-gradient-to-br from-primary/20 to-green-600/20 relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 text-center relative z-10">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6" data-testid="badge-offer-alert">
            <Star className="w-4 h-4" />
            Limited Time Summer Offer
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6" data-testid="text-hero-title">
            Road to Summer:<br />
            <span className="text-primary">Win Up to $1000 Back</span><br />
            on Your Tree Care!
          </h1>
          
          <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto" data-testid="text-hero-subtitle">
            Book any tree care service before December 31st and stand a <strong>1-in-90 chance</strong> to win $1000 off your job. 
            Our way of saying thanks to our amazing Gisborne community!
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Button size="lg" className="text-lg px-8 py-6" asChild data-testid="button-primary-cta">
              <Link href="#contact-form">
                Book Now & Enter to Win
              </Link>
            </Button>
            <Button variant="outline" size="lg" className="text-lg px-8 py-6" asChild data-testid="button-secondary-cta">
              <a href="tel:0272166882">
                Call (027) 216-6882
              </a>
            </Button>
          </div>
          
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6 max-w-2xl mx-auto" data-testid="card-offer-details">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-5 h-5 text-green-800 dark:text-green-300" />
              <h3 className="text-lg font-semibold text-green-800 dark:text-green-300">How It Works:</h3>
            </div>
            <p className="text-green-700 dark:text-green-400">
              Any job over $200 booked between now and December 31st automatically enters you. 
              Winner drawn January 5th, 2026. No hidden terms - just our way of celebrating summer with you!
            </p>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-20 bg-background">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4" data-testid="text-services-title">
              All Services Included in This Offer
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              From emergency removals to routine maintenance - every tree care service qualifies for your chance to win!
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 mb-12">
            {services.map((service, index) => (
              <Card key={index} className="hover-elevate text-center">
                <CardContent className="p-8">
                  <div className="mb-4 flex justify-center">
                    {service.icon}
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-3" data-testid={`text-service-title-${index}`}>
                    {service.title}
                  </h3>
                  <p className="text-muted-foreground" data-testid={`text-service-description-${index}`}>
                    {service.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid md:grid-cols-4 gap-6 text-center">
            <div className="bg-primary/5 rounded-lg p-6" data-testid="card-stat-1">
              <div className="text-2xl font-bold text-primary mb-2">7+</div>
              <div className="text-sm text-muted-foreground">Years Experience</div>
            </div>
            <div className="bg-primary/5 rounded-lg p-6" data-testid="card-stat-2">
              <div className="text-2xl font-bold text-primary mb-2">500+</div>
              <div className="text-sm text-muted-foreground">Trees Removed</div>
            </div>
            <div className="bg-primary/5 rounded-lg p-6" data-testid="card-stat-3">
              <div className="text-2xl font-bold text-primary mb-2">50%</div>
              <div className="text-sm text-muted-foreground">Growth This Year</div>
            </div>
            <div className="bg-primary/5 rounded-lg p-6" data-testid="card-stat-4">
              <div className="text-2xl font-bold text-primary mb-2">1:90</div>
              <div className="text-sm text-muted-foreground">Winning Odds</div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4" data-testid="text-why-choose-title">
              Why Treemarkables?
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              We're not just another tree service - we're your local Gisborne experts who care about your property and community.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <Check className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-foreground">Local Gisborne Team:</strong>
                    <span className="text-muted-foreground"> Born and raised in "Gizzy" - we know every tree species and local conditions.</span>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-foreground">Certified Arborists:</strong>
                    <span className="text-muted-foreground"> Fully qualified with modern equipment and safety protocols.</span>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-foreground">Growing Business:</strong>
                    <span className="text-muted-foreground"> 50% growth this year means we're doing something right!</span>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-foreground">Fair Pricing:</strong>
                    <span className="text-muted-foreground"> Competitive rates with transparent quotes - no hidden surprises.</span>
                  </div>
                </li>
              </ul>
            </div>
            
            <div className="space-y-6">
              {testimonials.map((testimonial, index) => (
                <Card key={index} className="hover-elevate">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                        <Users className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-1 mb-2">
                          {[...Array(testimonial.rating)].map((_, i) => (
                            <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                          ))}
                        </div>
                        <p className="text-muted-foreground mb-3" data-testid={`text-testimonial-${index}`}>
                          "{testimonial.text}"
                        </p>
                        <div className="text-sm">
                          <span className="font-medium text-foreground">{testimonial.name}</span>
                          <span className="text-muted-foreground"> - {testimonial.location}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-background">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4" data-testid="text-faq-title">
              Frequently Asked Questions
            </h2>
            <p className="text-xl text-muted-foreground">
              Everything you need to know about our $1000 summer offer.
            </p>
          </div>
          
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <Card key={index} className="hover-elevate">
                <CardContent className="p-0">
                  <button
                    onClick={() => toggleFaq(index)}
                    className="w-full text-left p-6 flex items-center justify-between hover:bg-muted/50 transition-colors"
                    data-testid={`button-faq-${index}`}
                  >
                    <h3 className="text-lg font-semibold text-foreground pr-4">
                      {faq.question}
                    </h3>
                    <div className={`transform transition-transform ${expandedFaq === index ? 'rotate-180' : ''}`}>
                      {expandedFaq === index ? (
                        <Minus className="w-5 h-5" />
                      ) : (
                        <Plus className="w-5 h-5" />
                      )}
                    </div>
                  </button>
                  {expandedFaq === index && (
                    <div className="px-6 pb-6 border-t" data-testid={`text-faq-answer-${index}`}>
                      <p className="text-muted-foreground pt-4">
                        {faq.answer}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Form Section */}
      <section id="contact-form" className="py-20 bg-background">
        <ContactSection />
      </section>

      {/* Final CTA Section */}
      <section className="py-20 bg-gradient-to-br from-primary/10 to-green-600/10">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6" data-testid="text-final-cta-title">
            Ready to Win $1000 Back?
          </h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Don't wait - this offer ends December 31st! Book your tree care service today and automatically enter to win.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <Button size="lg" className="text-lg px-8 py-6" asChild data-testid="button-final-cta">
              <Link href="#contact-form">
                Get Your Free Quote Now
              </Link>
            </Button>
            <Button variant="outline" size="lg" className="text-lg px-8 py-6" asChild data-testid="button-final-call">
              <a href="tel:0272166882">
                <Phone className="w-5 h-5 mr-2" />
                Call (027) 216-6882
              </a>
            </Button>
          </div>
          
          <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              <span>info@treemarkables.co.nz</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>Offer ends Dec 31st</span>
            </div>
          </div>
          
          <p className="text-xs text-muted-foreground mt-4 max-w-2xl mx-auto">
            Terms: Minimum job value $200. One entry per customer. Winner drawn January 5th, 2026. 
            $1000 rebate applied to winning customer's invoice. Local Gisborne area only.
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
}