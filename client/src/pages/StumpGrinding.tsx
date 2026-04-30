import { useEffect } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ContactSection from "@/components/ContactSection";
import FAQSection from "@/components/FAQSection";
import SEO from "@/components/SEO";
import { Shield, Clock, Scissors, TreePine, Phone, AlertTriangle, Settings, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import InquiryForm from "@/components/InquiryForm";
import GoogleReviewsGrid from "@/components/GoogleReviewsGrid";
const heroBackground = "/stump-grinding-hero.jpg";

export default function StumpGrinding() {
  // Add Google tag event script for form submission tracking
  useEffect(() => {
    const script = document.createElement('script');
    script.innerHTML = `
      gtag('event', 'Formsubmission', {
        // <event_parameters>
      });
    `;
    document.head.appendChild(script);
    
    return () => {
      // Cleanup on unmount
      const scripts = document.head.querySelectorAll('script');
      scripts.forEach(s => {
        if (s.innerHTML.includes('Formsubmission')) {
          document.head.removeChild(s);
        }
      });
    };
  }, []);

  const handleGetQuote = () => {
    document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleCallNow = () => {
    if ((window as any).gtag) {
      (window as any).gtag('event', 'phone_call_click', { event_category: 'Contact', event_label: 'Phone Number Click' });
    }
    if ((window as any).gtag_report_conversion) {
      (window as any).gtag_report_conversion('tel:0272166882');
    }
    setTimeout(() => {
      window.location.href = 'tel:0272166882';
    }, 100);
  };

  // Local business structured data for Stump Grinding SEO
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": "https://app.treemarkables.co.nz/stump-grinding#business",
    "name": "Treemarkables Stump Grinding Services",
    "description": "Professional stump grinding and removal services in Gisborne, New Zealand. Complete stump removal for residential and commercial properties with advanced grinding equipment.",
    "url": "https://app.treemarkables.co.nz/stump-grinding",
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
    <div className="min-h-screen bg-background pt-20">
      <SEO 
        title="Stump Grinding Gisborne – Complete Stump Removal"
        description="Eliminate unsightly stumps with our powerful stump grinding service. Serving Gisborne, Wairoa and rural properties. Book your stump removal today."
        keywords="stump grinding Gisborne, fast stump removal, tidy stump grinding, Wairoa stump removal, rural stump grinding, powerful stump grinder, book stump removal"
        ogTitle="Stump Grinding Gisborne – Fast & Tidy Stump Removal"
        ogDescription="Eliminate unsightly stumps with our powerful stump grinding service. Serving Gisborne, Wairoa and rural properties. Book your stump removal today."
        ogImage="https://app.treemarkables.co.nz/stump-grinding.jpg"
        canonicalUrl="https://app.treemarkables.co.nz/stump-grinding"
        structuredData={structuredData}
      />
      <Header />
      {/* Hero Section */}
      <section 
        className="relative min-h-screen bg-gradient-to-br from-primary/10 to-orange-500/10 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${heroBackground})` }}
      >
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative max-w-6xl mx-auto px-6 pt-20">
          <div className="text-center">
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6" data-testid="text-hero-title">
              Stump Grinding Gisborne
            </h1>
            <p className="text-xl text-white/90 mb-8 max-w-3xl mx-auto leading-relaxed" data-testid="text-hero-description">
              Remove unsightly stumps safely and efficiently. After a tree is cut down, the remaining stump can become an eyesore, hazard and pest haven.
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

      <section className="py-10 md:py-14 bg-muted/30">
        <div className="max-w-2xl mx-auto px-6">
          <InquiryForm />
        </div>
      </section>

      <section className="w-full" data-testid="section-stump-grinding-gisborne">
        <div className="grid grid-cols-1 md:grid-cols-2 items-stretch">
          <div className="relative min-h-[280px] md:min-h-[560px] bg-black">
            <video
              className="absolute inset-0 w-full h-full object-cover"
              muted
              autoPlay
              loop
              playsInline
              data-testid="video-stump-grinding-timelapse"
            >
              <source src="/stump-video.mov" type="video/quicktime" />
              <source src="/stump-video.mov" type="video/mp4" />
            </video>
          </div>
          <div className="bg-white px-6 py-12 md:px-12 md:py-16 flex flex-col justify-center">
            <div className="max-w-xl">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
                Tree stump grinding Gisborne
              </h2>
              <div className="space-y-5 text-[15px] leading-relaxed text-gray-700">
                <p>
                  Got a stump that needs gone? We've got two stump grinders to handle any job in Gisborne — one compact narrow-access machine that fits through standard side gates and tight spots most operators can't reach, and the biggest stump grinder in Gisborne for taking on massive shelter belts, old gum stumps and rural clearing work.
                </p>
                <p>
                  Whether it's one fruit tree stump down the side of the house or a paddock full of pine stumps on a lifestyle block, we'll grind it flush, tidy up the mulch, and leave your section ready to mow, plant or build on. Free quotes, fully insured, locally owned.
                </p>
              </div>
              <div className="mt-7">
                <Button
                  onClick={handleGetQuote}
                  size="lg"
                  className="rounded-full px-6"
                  data-testid="button-stump-grinding-quote"
                >
                  Get a free quote
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stump grinding Gisborne — long-form article */}
      <section className="w-full py-14 md:py-20 px-5 md:px-6 bg-white text-[#1a1a1a]" data-testid="section-stump-article">
        <article className="max-w-[820px] mx-auto">
          <h2 className="text-3xl md:text-[38px] font-bold leading-tight text-black mb-4">
            Stump grinding Gisborne — fast, tidy, done right
          </h2>
          <p className="text-[17px] md:text-[19px] leading-relaxed text-[#444] mb-10">
            Got an old tree stump sitting in your lawn, paddock or driveway? Treemarkables provides professional stump grinding across Gisborne and Tairāwhiti — with the right gear for any job, big or small.
          </p>
          <p className="text-[16px] md:text-[17px] leading-[1.7] text-[#333] mb-[18px]">
            After a tree comes down — whether from a storm, a removal job, or just clearing a section — the stump is usually the bit that gets left behind. And in Gisborne, where lifestyle blocks, coastal sections and big back lawns are the norm, leftover stumps are everywhere. Some have been sitting there for decades, slowly rotting, attracting pests, sprouting fresh shoots, and quietly costing the owner money every time the mower hits one.
          </p>
          <p className="text-[16px] md:text-[17px] leading-[1.7] text-[#333] mb-[18px]">
            That's where we come in. Whether it's a single stump in your front yard or a whole row of old shelter belt remnants on a rural block, we've got the gear and the experience to grind them flush, fast, and tidy.
          </p>

          <h3 className="text-[22px] md:text-[26px] font-bold leading-snug text-black mt-9 md:mt-12 mb-4">
            Two stump grinders. Any job, any access.
          </h3>
          <p className="text-[16px] md:text-[17px] leading-[1.7] text-[#333] mb-[18px]">
            This is where most Gisborne tree companies fall short — they've got one machine, and if it doesn't fit through your gate or it can't handle the size, you're stuck. We've solved that problem by running two stump grinders, each built for a completely different job.
          </p>

          <h4 className="text-[18px] md:text-[19px] font-semibold text-black mt-8 mb-2.5">Compact narrow-access grinder</h4>
          <p className="text-[16px] md:text-[17px] leading-[1.7] text-[#333] mb-[18px]">
            Our smaller machine is purpose-built for tight spots. It fits through standard side gates, narrow paths between houses, awkward courtyards, sloped backyards, and any of those hard-to-reach spots where bigger machines simply can't go. If your stump is tucked behind the shed, down the side of the house, or up a steep section, this is the machine for the job.
          </p>

          <h4 className="text-[18px] md:text-[19px] font-semibold text-black mt-8 mb-2.5">The biggest stump grinder in Gisborne</h4>
          <p className="text-[16px] md:text-[17px] leading-[1.7] text-[#333] mb-[18px]">
            When you've got massive shelter belt stumps, old gum or macrocarpa trunks a metre or more across, or a paddock full of pine stumps to clear, we bring in the heavy gear. Our largest grinder is the biggest stump grinder operating in Gisborne — and it gets through serious work in a fraction of the time other operators can manage. For rural blocks, lifestyle properties and large-scale clearing, this is the machine that earns its keep.
          </p>

          <div className="bg-[#f6fff3] border-l-4 border-[#39FF14] px-7 py-6 rounded-sm my-8">
            <p className="text-[16px] md:text-[17px] leading-[1.7] text-[#333]">
              Whatever your stump situation, we've got the right grinder for it — no compromises, no "sorry, we can't reach that one", no quoting you for half a job because the gear can't handle the rest.
            </p>
          </div>

          <h3 className="text-[22px] md:text-[26px] font-bold leading-snug text-black mt-9 md:mt-12 mb-4">
            Why grind a stump instead of leaving it?
          </h3>
          <p className="text-[16px] md:text-[17px] leading-[1.7] text-[#333] mb-[18px]">
            Plenty of Gisborne homeowners think "she'll be right" and just leave the stump where it is. Fair enough — but here's why most regret it within a year or two:
          </p>
          <ul className="text-[16px] md:text-[17px] leading-[1.7] text-[#333] list-disc pl-[22px] space-y-2.5 mb-6">
            <li><strong className="text-black">They're a trip hazard.</strong> Especially for kids running around the lawn or guests at a backyard barbecue.</li>
            <li><strong className="text-black">They damage mowers and ride-ons.</strong> One forgotten stump hidden in long grass can cost you hundreds in repairs.</li>
            <li><strong className="text-black">They attract pests.</strong> Borer, termites and wood-rot fungi love a damp Gisborne stump — and they don't always stay in the stump.</li>
            <li><strong className="text-black">They sucker and regrow.</strong> Willow, poplar, gum and wattle will throw up new shoots from a stump for years if it's not ground out properly.</li>
            <li><strong className="text-black">They look terrible.</strong> A tidy lawn or paddock is worth real money come resale time.</li>
            <li><strong className="text-black">They take up usable space.</strong> Want to build a deck, lay turf, plant a garden or pour concrete? The stump has to go first.</li>
          </ul>
          <p className="text-[16px] md:text-[17px] leading-[1.7] text-[#333] mb-[18px]">
            Stump grinding solves all of it in one job — usually in less than a day.
          </p>

          <h3 className="text-[22px] md:text-[26px] font-bold leading-snug text-black mt-9 md:mt-12 mb-4">
            How tree stump grinding actually works
          </h3>
          <p className="text-[16px] md:text-[17px] leading-[1.7] text-[#333] mb-[18px]">
            A stump grinder is a heavy-duty machine with a rotating cutting wheel that chews the stump down below ground level — typically 150 to 300mm under the surface, depending on what you're planning to do with the area. The wheel works through the stump and the surface roots, turning the whole lot into a pile of fine wood mulch.
          </p>
          <p className="text-[16px] md:text-[17px] leading-[1.7] text-[#333] mb-[18px]">
            Once we're done, the mulch can either be raked back into the hole as backfill, or carted off-site — your call. From there, you can lay topsoil and seed grass over the area within a day or two, or get straight on with paving, planting or building. No chemicals, no waiting, no months of digging out roots by hand.
          </p>
          <p className="text-[16px] md:text-[17px] leading-[1.7] text-[#333] mb-[18px]">
            Compared to the alternatives — chemical stump killers (slow, messy, environmentally questionable) or excavation (expensive, destructive, leaves a massive hole) — grinding is faster, cleaner and cheaper for almost every job.
          </p>

          <h3 className="text-[22px] md:text-[26px] font-bold leading-snug text-black mt-9 md:mt-12 mb-4">
            Stumps we grind in Gisborne and Tairāwhiti
          </h3>
          <p className="text-[16px] md:text-[17px] leading-[1.7] text-[#333] mb-[18px]">
            We grind every species you'll find on a Gisborne section, including:
          </p>
          <ul className="text-[16px] md:text-[17px] leading-[1.7] text-[#333] list-disc pl-[22px] space-y-2.5 mb-6">
            <li><strong className="text-black">Pine, macrocarpa and gum</strong> — common shelter belt species across rural Gisborne and the East Coast</li>
            <li><strong className="text-black">Willow and poplar</strong> — frequent along riverbanks and farm boundaries, notorious for resprouting if not ground properly</li>
            <li><strong className="text-black">Liquidambar, oak and plane</strong> — established residential trees with deep, awkward root flares</li>
            <li><strong className="text-black">Pohutukawa and native species</strong> — handled with care, and with council consent where required</li>
            <li><strong className="text-black">Fruit trees</strong> — old apples, plums, pears and citrus that have outlived their use</li>
            <li><strong className="text-black">Stumps left by other contractors</strong> — happens all the time; we'll grind out what someone else couldn't finish</li>
          </ul>
          <p className="text-[16px] md:text-[17px] leading-[1.7] text-[#333] mb-[18px]">
            No stump is too big and no spot is too tight. Between our two machines, we've got it covered.
          </p>

          <h3 className="text-[22px] md:text-[26px] font-bold leading-snug text-black mt-9 md:mt-12 mb-4">
            Why choose Treemarkables for stump grinding in Gisborne?
          </h3>
          <p className="text-[16px] md:text-[17px] leading-[1.7] text-[#333] mb-[18px]">
            We're a locally owned and operated tree care company based right here in Gisborne. Stump grinding isn't a sideline for us — it's a core part of what we do, every week, across Tairāwhiti.
          </p>
          <ul className="text-[16px] md:text-[17px] leading-[1.7] text-[#333] list-disc pl-[22px] space-y-2.5 mb-6">
            <li><strong className="text-black">Two stump grinders</strong> — narrow-access for tight spots, plus the biggest grinder in Gisborne for the heavy stuff</li>
            <li><strong className="text-black">Free, no-obligation quotes</strong> — we come to your property, eyeball the job, and give you a fair price up front</li>
            <li><strong className="text-black">Qualified arborists and trained operators</strong> — not a bloke with a hire-shop grinder</li>
            <li><strong className="text-black">Full insurance</strong> — public liability cover on every job</li>
            <li><strong className="text-black">Tidy site at the end</strong> — mulch raked back into the hole or carted away, your choice</li>
            <li><strong className="text-black">The Treemarkables guarantee</strong> — if we haven't delivered on what we agreed, we'll come back and sort it. No questions, no fuss.</li>
          </ul>

          <h3 className="text-[22px] md:text-[26px] font-bold leading-snug text-black mt-9 md:mt-12 mb-4">
            How much does stump grinding cost in Gisborne?
          </h3>
          <p className="text-[16px] md:text-[17px] leading-[1.7] text-[#333] mb-[18px]">
            Stump grinding pricing depends on a few things: the diameter of the stump, how deep you need it ground, how accessible the site is, and how many stumps need doing. Single residential stumps are usually a flat-rate job, while multiple stumps or rural work is priced as a package. We don't do over-the-phone guesses — they're never accurate, and they tend to either undersell the customer or oversell us.
          </p>
          <p className="text-[16px] md:text-[17px] leading-[1.7] text-[#333] mb-[18px]">
            Send us a photo or two and we'll give you a real number, fast. Or we'll come out and have a look — no charge, no pressure.
          </p>

          <h3 className="text-[22px] md:text-[26px] font-bold leading-snug text-black mt-9 md:mt-12 mb-4">
            Areas we cover
          </h3>
          <p className="text-[16px] md:text-[17px] leading-[1.7] text-[#333] mb-[18px]">
            We provide stump grinding services across all of Gisborne and Tairāwhiti, including Gisborne city, Kaiti, Mangapapa, Elgin, Te Hapara, Wainui, Makaraka, Patutahi, Manutūkē, Te Karaka, Tolaga Bay, Tokomaru Bay, Ruatoria and surrounding rural and coastal areas. Not sure if you're in our patch? Give us a call — chances are we've worked nearby.
          </p>

          <div className="bg-[#fafafa] rounded-xl text-center px-6 py-10 mt-12">
            <h4 className="text-[22px] md:text-2xl font-bold text-black mb-4">
              Ready to get rid of that stump?
            </h4>
            <p className="text-[16px] md:text-[17px] leading-[1.7] text-[#333] mb-3">
              Stop tripping over it. Stop dodging it with the mower. Get a free quote from the Gisborne stump grinding specialists.
            </p>
            <Button
              onClick={handleGetQuote}
              size="lg"
              className="rounded-lg px-8"
              data-testid="button-stump-article-cta"
            >
              Get a free quote
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </article>
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

      <GoogleReviewsGrid
        heading="What Gisborne homeowners say"
        ctaLabel="Talk to us today"
        onCtaClick={handleGetQuote}
      />

      {/* Service Areas Section */}
      <section className="py-8 md:py-16 bg-muted/30">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h3 className="text-2xl font-bold text-foreground mb-6">
              Stump Grinding Service Areas
            </h3>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto mb-8">
              Professional stump grinding throughout Gisborne and surrounding regions.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-6 text-center">
            <div className="bg-background rounded-lg p-4 hover-elevate">
              <h4 className="font-semibold text-foreground mb-2">Gisborne Central</h4>
              <p className="text-sm text-muted-foreground">Urban stump removal</p>
            </div>
            <div className="bg-background rounded-lg p-4 hover-elevate">
              <h4 className="font-semibold text-foreground mb-2">Kaiti</h4>
              <p className="text-sm text-muted-foreground">Coastal property cleanup</p>
            </div>
            <div className="bg-background rounded-lg p-4 hover-elevate">
              <h4 className="font-semibold text-foreground mb-2">Te Hapara</h4>
              <p className="text-sm text-muted-foreground">Residential stump grinding</p>
            </div>
            <div className="bg-background rounded-lg p-4 hover-elevate">
              <h4 className="font-semibold text-foreground mb-2">Mangapapa</h4>
              <p className="text-sm text-muted-foreground">Rural property cleanup</p>
            </div>
            <div className="bg-background rounded-lg p-4 hover-elevate">
              <h4 className="font-semibold text-foreground mb-2">Wainui Beach</h4>
              <p className="text-sm text-muted-foreground">Beach property services</p>
            </div>
            <div className="bg-background rounded-lg p-4 hover-elevate">
              <h4 className="font-semibold text-foreground mb-2">Makaraka</h4>
              <p className="text-sm text-muted-foreground">Semi-rural stump removal</p>
            </div>
            <div className="bg-background rounded-lg p-4 hover-elevate">
              <h4 className="font-semibold text-foreground mb-2">Elgin</h4>
              <p className="text-sm text-muted-foreground">Farm and estate cleanup</p>
            </div>
            <div className="bg-background rounded-lg p-4 hover-elevate">
              <h4 className="font-semibold text-foreground mb-2">Wairoa</h4>
              <p className="text-sm text-muted-foreground">Extended service region</p>
            </div>
          </div>
        </div>
      </section>

      {/* Related Services Section */}
      <section className="py-8 md:py-16 bg-background">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h3 className="text-2xl font-bold text-foreground mb-6">
              Complete Property Solutions
            </h3>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Stump grinding often follows tree removal and may be combined with other landscaping services.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="hover-elevate">
              <CardContent className="pt-6 pb-6 text-center">
                <div className="flex justify-center mb-4">
                  <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                    <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
                  </div>
                </div>
                <h4 className="text-lg font-semibold text-foreground mb-3">
                  <Link href="/tree-removal" className="hover:text-primary transition-colors">
                    Tree Removal
                  </Link>
                </h4>
                <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                  Professional tree removal often requires follow-up stump grinding for complete property cleanup.
                </p>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/tree-removal">Learn More</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardContent className="pt-6 pb-6 text-center">
                <div className="flex justify-center mb-4">
                  <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                    <TreePine className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                </div>
                <h4 className="text-lg font-semibold text-foreground mb-3">
                  <Link href="/tree-pruning" className="hover:text-primary transition-colors">
                    Tree Pruning
                  </Link>
                </h4>
                <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                  Maintain your remaining trees with professional pruning and health care services.
                </p>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/tree-pruning">Learn More</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardContent className="pt-6 pb-6 text-center">
                <div className="flex justify-center mb-4">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                    <Scissors className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
                <h4 className="text-lg font-semibold text-foreground mb-3">
                  <Link href="/hedge-trimming" className="hover:text-primary transition-colors">
                    Hedge Trimming
                  </Link>
                </h4>
                <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                  Complete your landscape project with professional hedge care and boundary maintenance.
                </p>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/hedge-trimming">Learn More</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <FAQSection />

      {/* Contact Section */}
      <ContactSection />

      <Footer />
    </div>
  );
}