import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ContactSection from "@/components/ContactSection";
import SEO from "@/components/SEO";
import { Shield, Award, Clock, CheckCircle, Star, Scissors, TreePine, Users, MapPin, Phone, AlertTriangle, Heart, Leaf, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import heroBackground from "@assets/stump_grinding_hero.jpg";

const reviews = [
  {
    id: "1",
    name: "James Mitchell",
    location: "Makaraka, Gisborne",
    rating: 5,
    comment: "Outstanding stump grinding service! They removed three large stumps from our property quickly and efficiently. The cleanup was thorough and the price was very reasonable. Highly recommend Treemarkables for any stump removal needs.",
    service: "Stump Grinding"
  },
  {
    id: "2",
    name: "Linda Thompson",
    location: "Te Hapara, Gisborne",
    rating: 5,
    comment: "Professional and reliable service. The team arrived on time, worked efficiently, and left our yard clean. We can finally use that corner of our garden for planting. Great job!",
    service: "Stump Removal"
  },
  {
    id: "3",
    name: "Peter Wilson",
    location: "Kaiti, Gisborne",
    rating: 5,
    comment: "Excellent workmanship and fair pricing. They ground down a massive pohutukawa stump that other companies said was too difficult. The Treemarkables team made it look easy.",
    service: "Large Stump Grinding"
  },
  {
    id: "4",
    name: "Michelle Brown",
    location: "Wainui, Gisborne",
    rating: 5,
    comment: "Very happy with the stump grinding service. Quick quote, professional work, and complete cleanup. Would definitely use Treemarkables again for any tree or stump work.",
    service: "Stump Grinding"
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

export default function StumpGrinding() {
  const handleGetQuote = () => {
    document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleCallNow = () => {
    window.location.href = 'tel:0272166882';
  };

  // Local business structured data for Stump Grinding SEO
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": "https://www.treemarkables.nz/stump-grinding#business",
    "name": "Treemarkables Stump Grinding Services",
    "description": "Professional stump grinding and removal services in Gisborne, New Zealand. Complete stump removal for residential and commercial properties with advanced grinding equipment.",
    "url": "https://www.treemarkables.nz/stump-grinding",
    "telephone": "+64272166882",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Gisborne",
      "addressRegion": "Gisborne Region",
      "addressCountry": "NZ"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": -38.6623,
      "longitude": 178.0176
    },
    "areaServed": [
      "Gisborne",
      "Kaiti",
      "Te Hapara",
      "Mangapapa", 
      "Wainui Beach",
      "Makaraka",
      "Elgin"
    ],
    "serviceType": "Stump Grinding Service",
    "priceRange": "$$",
    "openingHours": "Mo-Su 07:00-18:00"
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title="Stump Grinding Gisborne – Fast & Tidy Stump Removal"
        description="Eliminate unsightly stumps with our powerful stump grinding service. Serving Gisborne, Wairoa and rural properties. Book your stump removal today."
        keywords="stump grinding Gisborne, fast stump removal, tidy stump grinding, Wairoa stump removal, rural stump grinding, powerful stump grinder, book stump removal"
        ogTitle="Stump Grinding Gisborne – Fast & Tidy Stump Removal"
        ogDescription="Eliminate unsightly stumps with our powerful stump grinding service. Serving Gisborne, Wairoa and rural properties. Book your stump removal today."
        ogImage="https://www.treemarkables.co.nz/stump-grinding.jpg"
        canonicalUrl="https://www.treemarkables.co.nz/stump-grinding"
        structuredData={structuredData}
      />
      <Header />
      {/* Hero Section */}
      <section 
        className="relative min-h-screen bg-gradient-to-br from-primary/10 to-orange-500/10 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${heroBackground})` }}
      >
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative max-w-6xl mx-auto px-6 pt-32">
          <div className="text-center">
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6" data-testid="text-hero-title">
              Stump Grinding Gisborne
            </h1>
            <p className="text-xl text-white/90 mb-8 max-w-3xl mx-auto leading-relaxed" data-testid="text-hero-description">
              Professional stump grinding in Gisborne. We remove stumps completely, 
              leaving your property clean and ready for new landscaping.
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

      {/* Stump Grinding Philosophy */}
      <section className="py-20 bg-background">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
                <Settings className="h-10 w-10 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
              Complete Stump Removal
            </h2>
            <div className="max-w-4xl mx-auto space-y-4 text-lg text-muted-foreground">
              <p>
                At Treemarkables, we believe in leaving your property completely clean and ready for the next chapter. 
                <span className="font-semibold text-foreground"> Professional stump grinding removes all traces of the old tree</span> after <a href="/tree-removal" className="text-primary hover:text-primary/80 underline">tree removal</a>.
              </p>
              <p>
                Our powerful grinding equipment can handle any size stump, from small garden trees to massive 
                native specimens, leaving you with a level surface ready for replanting or landscaping.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* When to Remove Stumps */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-6">
              Why Remove Tree Stumps?
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Tree stumps aren't just an eyesore - they can create ongoing problems 
              for your property and future landscaping plans.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="hover-elevate">
              <CardContent className="pt-6 pb-6">
                <div className="flex justify-center mb-4">
                  <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                    <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
                  </div>
                </div>
                <h4 className="text-lg font-semibold text-foreground mb-3 text-center">
                  Safety Hazards
                </h4>
                <p className="text-muted-foreground text-sm leading-relaxed text-center">
                  Trip hazards for children and visitors, lawn mower damage, 
                  and obstacles for emergency vehicles.
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardContent className="pt-6 pb-6">
                <div className="flex justify-center mb-4">
                  <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                    <Leaf className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                </div>
                <h4 className="text-lg font-semibold text-foreground mb-3 text-center">
                  Pest Problems
                </h4>
                <p className="text-muted-foreground text-sm leading-relaxed text-center">
                  Rotting stumps attract insects, termites, and other pests that 
                  can spread to healthy plants and your home.
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardContent className="pt-6 pb-6">
                <div className="flex justify-center mb-4">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                    <TreePine className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
                <h4 className="text-lg font-semibold text-foreground mb-3 text-center">
                  New Growth
                </h4>
                <p className="text-muted-foreground text-sm leading-relaxed text-center">
                  Stumps can sprout new shoots, stealing nutrients from surrounding 
                  plants and creating maintenance headaches.
                </p>
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
            We understand that stump removal is often the final step in a bigger project. 
            Whether you're preparing for new landscaping, building, or just want a clean, 
            safe yard, we make the process simple and stress-free.
          </p>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Our powerful equipment can access tight spaces while our experienced team 
            ensures minimal disruption to your existing landscape and property.
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
              <Settings className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Professional Equipment</h3>
              <p className="text-muted-foreground">Powerful machinery for any size stump</p>
            </div>
            <div>
              <Clock className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Efficient Service</h3>
              <p className="text-muted-foreground">Quick removal with thorough cleanup</p>
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