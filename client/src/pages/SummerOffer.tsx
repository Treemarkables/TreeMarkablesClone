import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ContactSection from "@/components/ContactSection";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check, Star, Users, Clock, Shield, Award, Phone, Mail, Target, Plus, Minus } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import heroBackground from "@assets/p-4dcb7482-d484-e155-ba2d0fc3232ca844-2544003-v3__FitWzkwMCw0NTBd_1758052397900.jpg";
import teamPhoto from "@assets/team-photo.jpg";

export default function SummerOffer() {
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setExpandedFaq(expandedFaq === index ? null : index);
  };

  const faqs = [
    {
      question: "How does the $1000 offer work?",
      answer: "Any job booked between September 1st and November 30th, 2025 automatically enters you to win. We'll draw one lucky winner on December 5th, 2025 for up to a $1000 rebate - you get back your full job cost up to $1000 maximum."
    },
    {
      question: "What are the odds of winning?",
      answer: "With an estimated 90 jobs during the promotion period, you have a 1-in-90 chance of winning the $1000 rebate - much better odds than any lottery!"
    },
    {
      question: "What services are included?",
      answer: "All our tree care services qualify: tree removal, pruning, stump grinding, emergency tree services, and property clearance. Every job automatically enters."
    },
    {
      question: "When will the winner be announced?",
      answer: "The winner will be drawn and announced on December 5th, 2025. We'll contact the winner directly and announce it on our Facebook page and website."
    },
    {
      question: "Is there a minimum job value?",
      answer: "No minimum job value required. All tree care services automatically qualify for the draw."
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
      <section className="pt-32 pb-20 relative overflow-hidden">
        {/* Background Image */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url(${heroBackground})`,
            imageRendering: 'crisp-edges' as any, // Cross-browser crisp rendering
            transform: 'translateZ(0)', // Hardware acceleration
            willChange: 'transform', // GPU optimization
            backgroundSize: 'cover',
            backgroundPosition: 'center center',
            backgroundRepeat: 'no-repeat'
          }}
        />
        {/* Light overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-br from-black/40 via-black/30 to-black/40" />
        
        <div className="max-w-6xl mx-auto px-6 text-center relative z-10">
          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm font-medium mb-6" data-testid="badge-offer-alert">
            <Star className="w-4 h-4" />
            Limited Time Summer Offer
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6" data-testid="text-hero-title">
            Road to Summer:<br />
            <span className="text-yellow-400">Win Up to $1000 Back</span><br />
            on Your Tree Care!
          </h1>
          
          <p className="text-xl text-white/90 mb-8 max-w-3xl mx-auto" data-testid="text-hero-subtitle">
            Book any tree care service before November 30th and stand a <strong>1-in-90 chance</strong> to win up to $1000 off your job. 
            Our way of saying thanks to our amazing Gisborne community!
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Button size="lg" className="text-lg px-8 py-6" asChild data-testid="button-primary-cta">
              <a href="#contact-form">
                Book Now & Enter to Win
              </a>
            </Button>
            <Button variant="outline" size="lg" className="text-lg px-8 py-6" asChild data-testid="button-secondary-cta">
              <a href="tel:0272166882">
                Call (027) 216-6882
              </a>
            </Button>
          </div>
          
          <div className="bg-white/15 backdrop-blur-sm border border-white/20 rounded-lg p-6 max-w-2xl mx-auto" data-testid="card-offer-details">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-5 h-5 text-yellow-400" />
              <h3 className="text-lg font-semibold text-white">How It Works:</h3>
            </div>
            <p className="text-white/90">
              Any job booked between September 1st and November 30th automatically enters you. 
              Winner drawn December 5th, 2025. No hidden terms - just our way of celebrating summer with you!
            </p>
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

      {/* Meet the Team Section */}
      <section className="py-20 bg-background">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4" data-testid="text-team-title">
              Meet Your Local Gisborne Team
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              The skilled arborists behind Treemarkables - born and raised in Gisborne, 
              passionate about keeping our community's trees healthy and properties safe.
            </p>
          </div>
          
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1">
              <div className="space-y-6">
                <div>
                  <h3 className="text-2xl font-bold text-foreground mb-4">Your Trusted Local Experts</h3>
                  <p className="text-muted-foreground text-lg leading-relaxed mb-6">
                    Every member of our team calls Gisborne home. We understand the unique challenges 
                    of coastal weather, local tree species, and the specific needs of East Coast properties. 
                    When you choose Treemarkables, you're not just hiring arborists - you're partnering 
                    with neighbors who genuinely care about your property and our community.
                  </p>
                </div>
                
                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <Shield className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground mb-1">Fully Certified</h4>
                      <p className="text-sm text-muted-foreground">Licensed arborists with comprehensive safety training and insurance</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <Users className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground mb-1">Community Focused</h4>
                      <p className="text-sm text-muted-foreground">Local knowledge and genuine commitment to Gisborne properties</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <Award className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground mb-1">Proven Track Record</h4>
                      <p className="text-sm text-muted-foreground">50% business growth this year through quality workmanship</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <Clock className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground mb-1">Reliable Service</h4>
                      <p className="text-sm text-muted-foreground">On-time, professional service with complete cleanup included</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="order-1 lg:order-2">
              <div className="relative">
                <img 
                  src={teamPhoto} 
                  alt="Treemarkables team - local Gisborne arborists"
                  className="w-full h-auto rounded-lg shadow-lg object-cover"
                  data-testid="img-team-photo"
                />
                <div className="absolute inset-0 rounded-lg bg-gradient-to-t from-black/20 to-transparent"></div>
                <div className="absolute bottom-4 left-4 right-4 text-white">
                  <p className="text-sm font-medium bg-black/50 backdrop-blur-sm rounded px-3 py-2">
                    The Treemarkables team ready to serve Gisborne and surrounding areas
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="text-center mt-12">
            <p className="text-muted-foreground mb-6">
              Ready to work with Gisborne's most trusted tree care professionals?
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="text-lg px-8 py-6" asChild data-testid="button-team-cta">
                <a href="#contact-form">
                  Get Your Free Quote
                </a>
              </Button>
              <Button variant="outline" size="lg" className="text-lg px-8 py-6" asChild data-testid="button-team-call">
                <a href="tel:0272166882">
                  <Phone className="w-5 h-5 mr-2" />
                  Call the Team
                </a>
              </Button>
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
            Don't wait - this offer ends November 30th! Book your tree care service today and automatically enter to win.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <Button size="lg" className="text-lg px-8 py-6" asChild data-testid="button-final-cta">
              <a href="#contact-form">
                Get Your Free Quote Now
              </a>
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
              <span>quotes@treemarkables.nz</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>Offer ends Nov 30th</span>
            </div>
          </div>
          
          <p className="text-xs text-muted-foreground mt-4 max-w-2xl mx-auto">
            Terms: One entry per customer. Winner drawn December 5th, 2025. 
            Rebate up to $1000 applied to winning customer's invoice (full job cost or $1000, whichever is less). Local Gisborne area only.
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
}