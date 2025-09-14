import { useRoute } from "wouter";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ContactSection from "@/components/ContactSection";
import SEO from "@/components/SEO";
import { Calendar, User, ArrowLeft, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

// Blog post data - in a real app this would come from a CMS or database
const blogPosts = {
  "why-regular-tree-pruning-protects-your-home-gisborne": {
    title: "Why Regular Tree Pruning Protects Your Home in Gisborne",
    excerpt: "Gisborne's mild climate and coastal winds create conditions where branches can grow quickly and pose risks to homes. Learn why regular pruning is essential preventive maintenance.",
    date: "September 14, 2025",
    author: "Treemarkables Team",
    readTime: "8 min read",
    image: "/tree-pruning.jpg",
    content: `
      <p>Gisborne's mild climate and coastal winds help our trees thrive, but they also create conditions where branches can grow quickly, become heavy and, in storm season, pose a real risk to homes and people. As arborists serving Gisborne, Wairoa and the East Coast, we're often called out after high winds or heavy rain to deal with broken limbs that could have been prevented with regular pruning.</p>

      <p>Pruning isn't just about aesthetics; it's a vital part of tree maintenance. The University of Minnesota Extension notes that pruning is preventive maintenance for insect and disease damage and helps remove dead or dying branches, while professional sources like Angi explain that proper trimming promotes tree health, prevents pest problems, increases sunlight and protects your home. Let's look at why pruning matters so much in our region.</p>

      <h2>1. Promote Tree Health and Vigorous Growth</h2>

      <p>Removing dead, diseased or crossing branches allows a tree to direct its energy toward healthy limbs. Research from Angi notes that pruning prolongs a tree's life by removing weak, insect-infested or diseased limbs before they start to rot. By eliminating "energy-draining" branches, the desirable parts of the tree can flourish; you may even see more leaves, flowers and fruit.</p>

      <p>Regular pruning also reduces the risk of insect and disease problems. The UMN Extension explains that pruning can prevent insect and disease damage by maintaining good air circulation and sunlight penetration. In Gisborne's humid summers, good airflow around branches helps reduce fungal issues and allows the tree canopy to dry out quickly after rain.</p>

      <h2>2. Protect Your Home and Property</h2>

      <p>Overgrown branches can cause significant damage if they fall onto roofs or smash into windows during one of Gisborne's nor'easters. Angi highlights that tree branches hanging over your home can damage shingles and lead to roof leaks. Branches that grow into power lines or rub against house exteriors can also create fire hazards and utility interruptions. The UMN Extension advises pruning or removing branches that overhang homes and parking areas and eliminating limbs that interfere with street lights or overhead wires.</p>

      <p>By pruning back overhanging limbs, you reduce wind resistance and weight, making trees less likely to lose branches in storms. Preventive pruning is particularly important for large specimen trees like Norfolk pines and eucalyptus, which are common around Gisborne but can drop heavy limbs without warning.</p>

      <h2>3. Keep Your Family Safe</h2>

      <p>Safety is another major reason to schedule regular pruning. According to Angi, trimming cracked or low‑hanging branches prevents injuries and helps reduce the overall weight of the tree, making it less likely to fall during storms. The UMN Extension further advises removing weak or narrow‑angled tree branches that hang over sidewalks and any place falling limbs could injure people. In children's play areas and around outdoor entertaining spaces, pruning reduces the risk of dangerous limbs falling on people or damaging vehicles.</p>

      <h2>4. Improve Light, Airflow and Curb Appeal</h2>

      <p>Pruning helps more sunlight reach your lawn and garden beds, which encourages healthier growth of grass and shrubs. Angi notes that trimming trees exposes more leaves to sunlight and increases photosynthesis. It can also increase the amount of natural light that filters into your home.</p>

      <p>A well‑maintained tree canopy enhances the overall look of your property. Proper pruning controls plant size and shape, keeps shrubs dense and removes unwanted growth. That tidy appearance can boost curb appeal and potentially increase property value—important if you're planning to sell or rent your home.</p>

      <h2>5. Encourage Flowering, Fruiting and Hedge Density</h2>

      <p>If you have ornamental or fruit trees, pruning helps them perform at their best. The UMN Extension notes that pruning can encourage flower and fruit development and maintain dense hedges. Cutting back over‑grown branches allows more energy to be directed into blossom and fruit production. For formal hedges, trimming creates a neat, uniform shape while promoting new growth from within, keeping your hedge dense and healthy.</p>

      <h2>6. When Is the Best Time to Prune?</h2>

      <p>Timing matters. The UMN Extension recommends pruning most trees during the late dormant season—in Gisborne, that's late winter to early spring (August to September) before new growth begins. Angi similarly notes that early spring is an ideal time to inspect and prune trees. Pruning in this window minimises stress on the tree and reduces the risk of disease transmission. Some trees, such as stone fruit and certain flowering species, have specific timing requirements; always check local guidelines or consult a professional arborist.</p>

      <h2>7. Why Hire a Professional?</h2>

      <p>While small shrubs and young trees can be pruned by knowledgeable homeowners using sharp hand tools, large trees require specialised equipment and expertise. The UMN Extension advises leaving the pruning of large trees to qualified tree care professionals because it can be dangerous and improper cuts may harm the tree. Professionals understand how to make the right cuts to encourage growth without causing damage and know how to work safely around power lines and structures.</p>

      <h2>8. Tree Pruning in Gisborne: Local Considerations</h2>

      <p>Our coastal climate means trees here often experience strong winds and salt exposure, which can weaken limbs. After events like Cyclone Gabrielle and recent spring storms, many Gisborne residents have seen trees topple or shed large branches. Scheduling regular inspections and pruning reduces the risk of unexpected failures.</p>

      <p>Additionally, local councils have regulations about pruning or removing protected tree species. If you're unsure whether you need consent to prune a tree, check with Gisborne District Council before starting work. We can help you navigate these rules.</p>

      <h2>Conclusion</h2>

      <p>Regular tree pruning is one of the best investments you can make to protect your home, keep your family safe and ensure your trees thrive. By removing dead or over‑extended branches, you reduce the risk of storm damage, improve tree health and enhance the beauty of your property. For homeowners in Gisborne, Wairoa and the East Coast, Treemarkables offers professional pruning services using industry‑approved techniques and safety practices.</p>

      <p>If you'd like advice on how often to prune your trees or need an assessment after a storm, give our team a call or request a free quote. We're your local arborists committed to keeping Gisborne's trees healthy and your property safe.</p>
    `
  }
};

export default function BlogPost() {
  const [, params] = useRoute("/blog/:slug");
  const slug = params?.slug || "";
  const post = blogPosts[slug as keyof typeof blogPosts];

  if (!post) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="pt-32 pb-16 text-center">
          <h1 className="text-4xl font-bold text-foreground mb-4">Post Not Found</h1>
          <p className="text-muted-foreground mb-8">The blog post you're looking for doesn't exist.</p>
          <Button asChild>
            <Link href="/blog">Back to Blog</Link>
          </Button>
        </div>
        <Footer />
      </div>
    );
  }

  // Structured data for blog post
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": `https://www.treemarkables.co.nz/blog/${slug}#article`,
    "headline": post.title,
    "description": post.excerpt,
    "image": `https://www.treemarkables.co.nz${post.image}`,
    "author": {
      "@type": "Organization",
      "name": "Treemarkables",
      "url": "https://www.treemarkables.co.nz"
    },
    "publisher": {
      "@type": "Organization",
      "name": "Treemarkables",
      "url": "https://www.treemarkables.co.nz"
    },
    "datePublished": "2025-09-14",
    "dateModified": "2025-09-14",
    "mainEntityOfPage": `https://www.treemarkables.co.nz/blog/${slug}`,
    "url": `https://www.treemarkables.co.nz/blog/${slug}`,
    "articleSection": "Tree Care",
    "keywords": ["tree pruning", "Gisborne", "arborist", "tree care", "property maintenance"],
    "about": {
      "@type": "Thing",
      "name": "Tree Pruning"
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title={`${post.title} | Treemarkables Blog`}
        description={post.excerpt}
        keywords="tree pruning Gisborne, arborist advice, tree care tips, property maintenance, storm protection"
        ogTitle={post.title}
        ogDescription={post.excerpt}
        ogImage={`https://www.treemarkables.co.nz${post.image}`}
        canonicalUrl={`https://www.treemarkables.co.nz/blog/${slug}`}
        structuredData={structuredData}
      />
      <Header />
      
      {/* Back to Blog */}
      <div className="pt-32 pb-8">
        <div className="max-w-4xl mx-auto px-6">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/blog" data-testid="button-back-to-blog">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Blog
            </Link>
          </Button>
        </div>
      </div>

      {/* Blog Post Header */}
      <article className="pb-16">
        <div className="max-w-4xl mx-auto px-6">
          {/* Post Meta */}
          <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground mb-6">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span data-testid="text-post-date">{post.date}</span>
            </div>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4" />
              <span data-testid="text-post-author">{post.author}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span data-testid="text-post-read-time">{post.readTime}</span>
            </div>
          </div>

          {/* Post Title */}
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-8 leading-tight" data-testid="text-post-title">
            {post.title}
          </h1>

          {/* Featured Image */}
          <div className="aspect-video bg-muted rounded-lg overflow-hidden mb-12">
            <img 
              src={post.image} 
              alt={post.title}
              className="w-full h-full object-cover"
              data-testid="img-post-featured"
            />
          </div>

          {/* Post Content */}
          <div 
            className="prose prose-lg max-w-none prose-headings:font-bold prose-headings:text-foreground prose-p:text-muted-foreground prose-p:leading-relaxed prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-6 prose-p:mb-6"
            dangerouslySetInnerHTML={{ __html: post.content }}
            data-testid="content-post-body"
          />
        </div>
      </article>

      {/* Contact Section */}
      <ContactSection />
      <Footer />
    </div>
  );
}