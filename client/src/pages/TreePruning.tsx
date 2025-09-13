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
              Trees Beautiful
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto leading-relaxed" data-testid="text-hero-description">
              Professional tree pruning and care in Gisborne. We help your trees stay healthy, 
              safe, and beautiful through expert pruning techniques.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" onClick={handleGetQuote} className="text-lg px-6" data-testid="button-get-quote">
                Talk to us today
              </Button>
              <Button size="lg" variant="outline" onClick={handleCallNow} className="text-lg px-6" data-testid="button-call-now">
                <Phone className="w-4 h-4 mr-2" />
                027-216-6882
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-20 bg-background">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-foreground mb-6">
              Our Services
            </h2>
          </div>
          <div className="grid lg:grid-cols-3 gap-8">
            <Card className="hover-elevate">
              <CardContent className="p-8">
                <TreePine className="h-12 w-12 text-primary mb-6" />
                <h3 className="text-xl font-semibold text-foreground mb-4">Tree Pruning</h3>
                <p className="text-muted-foreground mb-6">
                  Professional pruning to improve tree health, safety, and appearance. We understand 
                  Gisborne's coastal conditions and work with the natural growth of your trees.
                </p>
                <Button variant="outline" onClick={handleGetQuote} size="sm">
                  Find out more
                </Button>
              </CardContent>
            </Card>
            <Card className="hover-elevate">
              <CardContent className="p-8">
                <Scissors className="h-12 w-12 text-primary mb-6" />
                <h3 className="text-xl font-semibold text-foreground mb-4">Crown Management</h3>
                <p className="text-muted-foreground mb-6">
                  Expert crown thinning and reduction to manage tree size while maintaining 
                  natural shape. Perfect for trees near buildings or power lines.
                </p>
                <Button variant="outline" onClick={handleGetQuote} size="sm">
                  Find out more
                </Button>
              </CardContent>
            </Card>
            <Card className="hover-elevate">
              <CardContent className="p-8">
                <Shield className="h-12 w-12 text-primary mb-6" />
                <h3 className="text-xl font-semibold text-foreground mb-4">Safety Pruning</h3>
                <p className="text-muted-foreground mb-6">
                  Removal of dead, diseased, or dangerous branches to keep your property safe. 
                  We spot potential hazards before they become problems.
                </p>
                <Button variant="outline" onClick={handleGetQuote} size="sm">
                  Find out more
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Welcome Section */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold text-foreground mb-8">
            A warm welcome from the team
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed mb-8">
            We're passionate about trees and helping them thrive in Gisborne's unique coastal environment. 
            Whether it's a quick safety prune or caring for your heritage trees, we bring the same 
            attention to detail and local knowledge to every job.
          </p>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Our team understands how salt winds, summer heat, and winter storms affect your trees. 
            We work with nature, not against it, to keep your trees healthy and your property safe.
          </p>
        </div>
      </section>

      {/* Simple Credentials */}
      <section className="py-20 bg-background">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div>
              <Shield className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Fully Insured</h3>
              <p className="text-muted-foreground">Complete coverage for your peace of mind</p>
            </div>
            <div>
              <Award className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Qualified Team</h3>
              <p className="text-muted-foreground">Certified arborists with local knowledge</p>
            </div>
            <div>
              <MapPin className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Local Experts</h3>
              <p className="text-muted-foreground">Understanding Gisborne's unique conditions</p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-foreground mb-6">
              Testimonials
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-12">
            {reviews.slice(0, 4).map((review) => (
              <div key={review.id} className="bg-white p-6 rounded-lg shadow-sm" data-testid={`review-card-${review.id}`}>
                <p className="text-muted-foreground mb-4 italic leading-relaxed" data-testid={`review-comment-${review.id}`}>
                  {review.comment}
                </p>
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-semibold text-foreground" data-testid={`review-name-${review.id}`}>
                      {review.name}
                    </h3>
                    <p className="text-sm text-muted-foreground" data-testid={`review-location-${review.id}`}>
                      {review.location}
                    </p>
                  </div>
                  <StarRating rating={review.rating} />
                </div>
              </div>
            ))}
          </div>

          <div className="text-center">
            <Button size="lg" onClick={handleGetQuote}>
              Talk to us today
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