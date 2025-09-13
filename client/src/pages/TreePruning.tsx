import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ContactSection from "@/components/ContactSection";
import { Shield, Award, Clock, CheckCircle, Star, Scissors, TreePine, Users, MapPin, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface Review {
  id: string;
  name: string;
  location: string;
  rating: number;
  comment: string;
  service: string;
}

const reviews: Review[] = [
  {
    id: "1",
    name: "Margaret Harrison",
    location: "Kaiti Heights, Gisborne",
    rating: 5,
    comment: "Treemarkables transformed our overgrown fruit trees into healthy, productive specimens. Their attention to detail and knowledge of local growing conditions is exceptional. The crew was punctual, professional, and cleaned up meticulously. Highly recommended for anyone seeking quality tree care in Gisborne.",
    service: "Fruit Tree Pruning"
  },
  {
    id: "2",
    name: "David Chen",
    location: "Te Hapara, Gisborne",
    rating: 5,
    comment: "Outstanding service from start to finish. The arborist provided detailed explanations of the pruning process and demonstrated extensive knowledge of native New Zealand species. The results exceeded our expectations, and our pohutukawa has never looked healthier.",
    service: "Native Tree Pruning"
  },
  {
    id: "3",
    name: "Sarah Thompson",
    location: "Wainui Beach, Gisborne",
    rating: 5,
    comment: "Professional, reliable, and expertly executed. Treemarkables pruned our coastal property trees with precision, considering both wind exposure and aesthetic appeal. Their understanding of Gisborne's unique climate conditions is evident in their work quality.",
    service: "Coastal Tree Pruning"
  },
  {
    id: "4",
    name: "Robert Williams",
    location: "Makaraka, Gisborne",
    rating: 5,
    comment: "Exceptional craftsmanship and attention to detail. The team demonstrated superior technical skills while maintaining the natural beauty of our mature oak trees. Their professional approach and comprehensive clean-up service sets them apart from competitors.",
    service: "Mature Tree Pruning"
  }
];

const StarRating = ({ rating }: { rating: number }) => {
  return (
    <div className="flex gap-1">
      {[...Array(5)].map((_, i) => (
        <Star
          key={i}
          className={`w-4 h-4 ${
            i < rating ? 'fill-primary text-primary' : 'text-muted-foreground'
          }`}
        />
      ))}
    </div>
  );
};

export default function TreePruning() {
  const handleGetQuote = () => {
    document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleCallNow = () => {
    window.location.href = 'tel:0272166882';
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero Section */}
      <section className="py-24 bg-gradient-to-br from-primary/10 to-blue-600/10">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center">
            <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-6" data-testid="text-hero-title">
              Expert Tree Pruning Services in Gisborne
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-4xl mx-auto leading-relaxed" data-testid="text-hero-description">
              Treemarkables delivers professional arboricultural services with unmatched expertise in 
              Gisborne's unique climate conditions. Our qualified arborists enhance tree health, safety, 
              and aesthetic appeal through precision pruning techniques tailored to local species and conditions.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" onClick={handleGetQuote} className="text-lg px-8" data-testid="button-get-quote">
                Request Professional Assessment
              </Button>
              <Button size="lg" variant="outline" onClick={handleCallNow} className="text-lg px-8" data-testid="button-call-now">
                <Phone className="w-5 h-5 mr-2" />
                Call 027-216-6882
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Local Expertise Section */}
      <section className="py-20 bg-background">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-foreground mb-6">
              Gisborne's Premier Tree Care Specialists
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              With extensive experience in Gisborne's coastal environment, we understand the unique challenges 
              facing local tree species, from salt exposure to wind damage and seasonal growth patterns.
            </p>
          </div>
          <div className="grid lg:grid-cols-3 gap-8">
            <Card className="hover-elevate">
              <CardContent className="p-8 text-center">
                <MapPin className="h-12 w-12 text-primary mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-foreground mb-4">Local Climate Expertise</h3>
                <p className="text-muted-foreground">
                  Specialised knowledge of Gisborne's coastal climate, prevailing winds, and seasonal 
                  patterns ensures optimal pruning timing and techniques for lasting results.
                </p>
              </CardContent>
            </Card>
            <Card className="hover-elevate">
              <CardContent className="p-8 text-center">
                <TreePine className="h-12 w-12 text-primary mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-foreground mb-4">Native Species Knowledge</h3>
                <p className="text-muted-foreground">
                  Comprehensive understanding of New Zealand native species including pohutukawa, 
                  totara, and kauri, with species-specific pruning protocols.
                </p>
              </CardContent>
            </Card>
            <Card className="hover-elevate">
              <CardContent className="p-8 text-center">
                <Users className="h-12 w-12 text-primary mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-foreground mb-4">Community Trust</h3>
                <p className="text-muted-foreground">
                  Established reputation throughout Gisborne with hundreds of satisfied residential 
                  and commercial clients who trust us with their valuable tree assets.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Professional Services Section */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl font-bold text-foreground mb-8" data-testid="text-service-title">
                Comprehensive Tree Pruning Solutions
              </h2>
              <div className="space-y-6">
                <div className="flex items-start space-x-4">
                  <CheckCircle className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-foreground text-lg mb-2">Structural Integrity Enhancement</h3>
                    <p className="text-muted-foreground">
                      Professional assessment and selective removal of structurally compromised branches 
                      to prevent property damage and ensure public safety.
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <CheckCircle className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-foreground text-lg mb-2">Health & Disease Management</h3>
                    <p className="text-muted-foreground">
                      Expert identification and removal of diseased, damaged, or pest-affected branches 
                      to promote optimal tree health and longevity.
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <CheckCircle className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-foreground text-lg mb-2">Aesthetic & Landscape Integration</h3>
                    <p className="text-muted-foreground">
                      Precision shaping and crown management to enhance visual appeal while maintaining 
                      natural tree architecture and landscape harmony.
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <CheckCircle className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-foreground text-lg mb-2">Growth Optimisation</h3>
                    <p className="text-muted-foreground">
                      Strategic pruning to direct growth patterns, improve air circulation, and maximise 
                      light penetration for enhanced tree vitality.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-card border border-card-border p-8 rounded-xl shadow-sm">
              <h3 className="text-2xl font-bold text-foreground mb-6">Specialised Pruning Techniques</h3>
              <div className="space-y-6">
                <div className="flex items-center space-x-4">
                  <div className="bg-primary text-white rounded-full w-10 h-10 flex items-center justify-center font-bold text-lg">1</div>
                  <div>
                    <h4 className="font-semibold text-foreground">Crown Reduction & Thinning</h4>
                    <p className="text-sm text-muted-foreground">Professional canopy management</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="bg-primary text-white rounded-full w-10 h-10 flex items-center justify-center font-bold text-lg">2</div>
                  <div>
                    <h4 className="font-semibold text-foreground">Deadwood & Hazard Removal</h4>
                    <p className="text-sm text-muted-foreground">Safety-focused branch elimination</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="bg-primary text-white rounded-full w-10 h-10 flex items-center justify-center font-bold text-lg">3</div>
                  <div>
                    <h4 className="font-semibold text-foreground">Formative & Young Tree Pruning</h4>
                    <p className="text-sm text-muted-foreground">Establishing strong tree structure</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="bg-primary text-white rounded-full w-10 h-10 flex items-center justify-center font-bold text-lg">4</div>
                  <div>
                    <h4 className="font-semibold text-foreground">Fruit Tree Specialisation</h4>
                    <p className="text-sm text-muted-foreground">Maximising yield and tree health</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Professional Credentials Section */}
      <section className="py-20 bg-background">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-foreground mb-6">
              Uncompromising Professional Standards
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Our commitment to excellence is reflected in our qualifications, insurance coverage, 
              and adherence to industry best practices.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="hover-elevate text-center">
              <CardContent className="p-8">
                <Shield className="h-16 w-16 text-primary mx-auto mb-6" />
                <h3 className="text-xl font-semibold text-foreground mb-4">Comprehensive Insurance</h3>
                <p className="text-muted-foreground mb-4">
                  Full public liability and professional indemnity coverage ensuring complete 
                  protection for your property and peace of mind.
                </p>
                <div className="text-sm text-primary font-medium bg-primary/10 px-3 py-1 rounded-md inline-block">
                  $2M Coverage
                </div>
              </CardContent>
            </Card>
            <Card className="hover-elevate text-center">
              <CardContent className="p-8">
                <Award className="h-16 w-16 text-primary mx-auto mb-6" />
                <h3 className="text-xl font-semibold text-foreground mb-4">Qualified Arborists</h3>
                <p className="text-muted-foreground mb-4">
                  NZQA certified arborists with ongoing professional development and specialised 
                  training in modern pruning techniques.
                </p>
                <div className="text-sm text-primary font-medium bg-primary/10 px-3 py-1 rounded-md inline-block">
                  NZQA Certified
                </div>
              </CardContent>
            </Card>
            <Card className="hover-elevate text-center">
              <CardContent className="p-8">
                <Scissors className="h-16 w-16 text-primary mx-auto mb-6" />
                <h3 className="text-xl font-semibold text-foreground mb-4">Precision Equipment</h3>
                <p className="text-muted-foreground mb-4">
                  State-of-the-art pruning equipment and safety gear ensuring precise cuts 
                  and minimal impact on surrounding landscape.
                </p>
                <div className="text-sm text-primary font-medium bg-primary/10 px-3 py-1 rounded-md inline-block">
                  Professional Grade
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Customer Reviews Section */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-foreground mb-6">
              Client Testimonials
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Discover why Gisborne property owners consistently choose Treemarkables for 
              their professional tree pruning requirements.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-12">
            {reviews.map((review) => (
              <Card key={review.id} className="hover-elevate" data-testid={`review-card-${review.id}`}>
                <CardContent className="p-8">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="font-semibold text-foreground text-lg" data-testid={`review-name-${review.id}`}>
                        {review.name}
                      </h3>
                      <p className="text-muted-foreground" data-testid={`review-location-${review.id}`}>
                        {review.location}
                      </p>
                    </div>
                    <StarRating rating={review.rating} />
                  </div>
                  
                  <p className="text-muted-foreground mb-6 italic leading-relaxed" data-testid={`review-comment-${review.id}`}>
                    "{review.comment}"
                  </p>
                  
                  <div className="text-sm text-primary font-medium bg-primary/10 px-3 py-1 rounded-md inline-block" data-testid={`review-service-${review.id}`}>
                    {review.service}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="text-center">
            <p className="text-muted-foreground text-lg mb-6">
              Join over 200 satisfied customers throughout the Gisborne region
            </p>
            <Button size="lg" onClick={handleGetQuote} className="text-lg px-8">
              Experience Professional Tree Care
            </Button>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <ContactSection />

      <Footer />
    </div>
  );
}