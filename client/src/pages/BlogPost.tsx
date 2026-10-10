import { useRoute } from "wouter";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ContactSection from "@/components/ContactSection";
import SEO from "@/components/SEO";
import { Calendar, User, ArrowLeft, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

interface MarketingBlogPost {
  title: string;
  seoTitle?: string;
  excerpt: string;
  date: string;
  datePublished?: string;
  author: string;
  readTime: string;
  image?: string;
  seoKeywords?: string;
  schemaKeywords?: string[];
  about?: string;
  content: string;
}

// Blog post data - in a real app this would come from a CMS or database
const blogPosts: Record<string, MarketingBlogPost> = {
  "flying-fox-branch-lowering-gisborne": {
    title: "How We Lower Big Branches Over Tight Spaces with a Flying Fox",
    seoTitle: "Flying Fox Branch Lowering in Gisborne | Treemarkables",
    excerpt: "Need a big branch lowered past a house, fence or garden in Gisborne? See how a flying fox keeps the drop controlled. Call 027 216 6882 for a free quote.",
    date: "October 11, 2026",
    datePublished: "2026-10-11",
    author: "Treemarkables",
    readTime: "5 min read",
    seoKeywords: "flying fox branch lowering, Gisborne arborist, zip-line tree work, tree pruning Gisborne, tree removal",
    schemaKeywords: ["flying fox", "branch lowering", "Gisborne", "arborist", "tree pruning", "tree removal"],
    about: "Flying fox branch lowering",
    content: `
      <p>Some branches cannot be dropped straight down. They sit over a house, a fence, a garden, a driveway, or power lines. When that happens, we lower the wood with a flying fox.</p>

      <p>A flying fox is a tensioned line from the tree to a safe landing zone. The branch is rigged to that line, cut free, and sent along it under control. People also call this a zip-line. The wood travels to the landing zone, clear of whatever sits underneath. That spot might be the berm, an open piece of lawn, or another place we agree with you before the saw starts.</p>

      <h2>When we use a flying fox</h2>

      <p>We set one up when the ground under the branch is not a safe drop zone. Around Gisborne homes that usually means one of these:</p>
      <ul>
        <li>The limb hangs over a house, garage, or deck.</li>
        <li>A fence is hard against the tree, or the wood would land in a neighbour's place.</li>
        <li>A garden, veggie beds, or a glasshouse sit underneath.</li>
        <li>The driveway is in use, or cars are parked below.</li>
        <li>Power lines run through the canopy, or close beside it.</li>
        <li>There is no open ground under the tree at all.</li>
      </ul>

      <p>An open lawn under the tree usually does not need a line. A flying fox suits the job where the only clear ground is off to the side, so the branch has to travel sideways as well as down.</p>

      <p>Keeping the tree, and only taking limbs, sits with our <a href="/tree-pruning">tree pruning</a>. Taking the whole tree out of a tight section is a <a href="/tree-removal">tree removal</a>, and the same line sends pieces to a landing zone instead of through the garden. If wind has already put a tree on a roof or across a drive, that is <a href="/emergency-tree-removal">emergency tree removal</a>.</p>

      <h2>Why it looks after your property</h2>

      <p>A branch that looks light from the lawn can still crack tiles, bend a fence, or flatten a garden. The line carries that weight to the landing zone. The branch is tied in before the cut, so on a tree you are keeping, the wood comes away without tearing bark on the way down.</p>

      <h2>Why it keeps the crew safe</h2>

      <p>People on the ground should not stand where the wood will fall. The crew receiving the branch are at the landing zone, off to the side of the trunk. The climber stays tied in. The wood arrives on the line, so nobody has to catch it. If a person, a pet, or a vehicle moves into the path, the cut waits.</p>

      <h2>What to expect on the day</h2>

      <p>We visit, look at the tree, and agree where the wood can land. You get a free quote before the job is booked. On the day, a good part of the time is setup. If the line has to cross a boundary, we talk it through with you and the neighbour before we tension anything. The line runs from the tree to a solid anchor at the far end.</p>

      <p>Crew roles stay simple. One person is in the tree, rigging each piece and making the cut. Another manages the line. Another receives the wood at the landing zone and helps break it down. Branches come down one at a time. We then cut the wood up there, move it out as agreed, and rake and blow the work area so the site is left tidy. If gear has to come through the garden, we protect that path before the first cut.</p>

      <h2>Video of a flying fox lower</h2>
      <div id="flying-fox-video" data-video-embed="pending">
        <!-- TODO: Jullian, add the Facebook video URL for the flying fox branch-lowering clip here. Do not embed a guessed or example URL. -->
        <p>This slot is for a Facebook video of a branch coming down on a flying fox. The clip is not on the page yet.</p>
      </div>

      <h2>Questions we get asked</h2>

      <h3>Is a flying fox more expensive?</h3>
      <p>It depends on the job. The line, the anchor, and the extra setup can take longer than dropping wood onto an open lawn, so some jobs cost more. On a tight section it can also be the only sensible way to do the work. We price the tree in front of us. The quote is free. Call <a href="tel:+64272166882">027 216 6882</a> or <a href="/contact">ask for a quote</a> and we will tell you what this tree needs.</p>

      <h3>Will my garden be damaged?</h3>
      <p>Avoiding that is the point of a flying fox. The branch should land in the zone we set. We still need access for people and gear, and a solid place to anchor the line. We walk that with you first. The aim is to finish with the garden as we found it, apart from the limb that had to come off.</p>

      <h3>Do you do this in Wairoa and on the East Coast?</h3>
      <p>Yes. We are based at 26 Cochrane Street, Gisborne, and we travel for this work. See our <a href="/wairoa">Wairoa</a> page and our <a href="/east-coast">East Coast</a> page. If the drop zone is wrong, we look at a flying fox there too.</p>

      <h2>Talk to us before that branch comes down</h2>
      <p>If a limb is over the house, the fence, or the garden you want to keep, leave it until we have looked. A ladder is the wrong tool for a cut over a roof. Phone <a href="tel:+64272166882">027 216 6882</a> or <a href="/contact">request a free quote</a>. We will say whether a flying fox is the right way to lower it, or whether a simpler prune or a removal will do.</p>
    `
  },
  "hazardous-tree-removal-gisborne-5-signs-dangerous-tree": {
    title: "5 Signs Your Tree Is a Hazard and Needs Removing",
    excerpt: "Worried a tree on your Gisborne property is a hazard? Learn 5 critical signs of a dangerous tree, from dead branches to root decay. Contact Treemarkables for a free hazardous tree removal assessment.",
    date: "February 25, 2026",
    author: "Treemarkables Team",
    readTime: "9 min read",
    image: "/hazardous-tree-gisborne.jpg",
    content: `
      <p>As a homeowner in Gisborne, your trees are a beautiful and valuable asset. They provide shade in the summer, enhance your property's appeal, and connect you with the natural beauty of the Tairāwhiti region. However, there comes a time when a beloved tree can become a significant liability. A hazardous tree is one with structural defects that make it likely to fail, in whole or in part, posing a risk to people or property.</p>

      <p>Recognising the warning signs early is crucial. Ignoring them can lead to catastrophic damage to your home, vehicle, or even cause serious injury. This guide will walk you through five critical signs that indicate you may need hazardous tree removal in Gisborne.</p>

      <h2>1. Large, Dead or Hanging Branches (Widow-Makers)</h2>

      <p>One of the most obvious signs of a hazardous tree is the presence of large, dead branches, often called "widow-makers." These are branches that have died off but remain attached to the tree. They are incredibly dangerous because they can break and fall at any moment, without any warning from wind or rain.</p>

      <p>What to look for:</p>
      <ul>
        <li>Branches with no leaves or buds during the growing season.</li>
        <li>Branches that have lost their bark.</li>
        <li>Large, heavy branches that are cracked or appear weakly attached.</li>
      </ul>

      <p>If you spot widow-makers in the canopy, it is a clear signal that the tree requires immediate attention from a qualified arborist for safe, professional hazardous tree removal in Gisborne.</p>

      <h2>2. Trunk Damage and Cavities</h2>

      <p>The trunk is the backbone of the tree. Any sign of significant damage or decay compromises its entire structure. Look for deep cracks, splits, or large cavities in the trunk. While some surface-level damage may be harmless, deep wounds can allow rot and disease to penetrate the core of the tree, weakening it from the inside out.</p>

      <p>What to look for:</p>
      <ul>
        <li><strong>Vertical Cracks:</strong> Deep splits that run down the length of the trunk.</li>
        <li><strong>Cavities or Hollows:</strong> Large holes in the trunk where wood has decayed.</li>
        <li><strong>Missing Bark:</strong> Large patches of missing bark can indicate a dead section of the tree.</li>
      </ul>

      <p>If more than 30% of the trunk is damaged or hollow, the tree is generally considered a significant hazard and a professional assessment is essential.</p>

      <h2>3. Leaning and Root Problems</h2>

      <p>A sudden or significant lean is a major red flag. While many trees have a natural lean towards sunlight, a change in the angle of the trunk indicates root failure or ground instability. This is particularly dangerous after heavy rain or storms when the ground is saturated.</p>

      <p>What to look for:</p>
      <ul>
        <li>A noticeable new lean that wasn't there before.</li>
        <li>Heaving soil or exposed roots on the side of the tree opposite the lean.</li>
        <li>Fungi, such as mushrooms, growing around the base of the tree, which is a strong indicator of root rot.</li>
      </ul>

      <p>A tree with compromised roots can fall without warning. If you notice any of these signs, it is critical to call for an expert in hazardous tree removal in Gisborne immediately.</p>

      <h2>4. Included Bark at Branch Unions</h2>

      <p>Included bark is one of the most commonly overlooked — yet most dangerous — structural defects in trees. It occurs when bark becomes trapped between two co-dominant stems or branches as they grow together, rather than forming a strong, interlocking wood union. The result is a V-shaped crotch that looks solid from the outside but is fundamentally weak and prone to splitting, often with catastrophic force.</p>

      <p>This is a defect that an untrained eye will almost always miss, which is exactly why it is so dangerous. Many homeowners in Gisborne have trees with included bark that appear perfectly healthy right up until the moment they fail — often during summer storms or under the weight of heavy autumn foliage.</p>

      <p>What to look for:</p>
      <ul>
        <li>A tight, V-shaped fork between two major stems or branches, rather than a wide, U-shaped union.</li>
        <li>A visible ridge of bark running down into the crotch between the two stems, rather than a raised bark ridge running across it.</li>
        <li>Cracks or splits forming at the base of the fork, particularly after wind or rain.</li>
      </ul>

      <p>If your tree has included bark at a major union — especially one overhanging your home, driveway, or outdoor living area — it is a serious structural hazard. A qualified arborist can assess whether the defect can be managed with cabling and bracing, or whether hazardous tree removal in Gisborne is the safest course of action.</p>

      <h2>5. Proximity to Targets</h2>

      <p>Finally, a tree's risk is also determined by its location. A decaying tree in the middle of a large, empty field is not nearly as hazardous as a healthy tree looming over your house, your driveway, or your children's play area. This is what arborists call the "target."</p>

      <p>Assess the risk:</p>
      <ul>
        <li>Is the tree within falling distance of your home, garage, or power lines?</li>
        <li>Are there large branches overhanging your deck, patio, or a neighbour's property?</li>
      </ul>

      <p>If a tree has any of the warning signs listed above AND it is located near a high-value target, the risk is significantly elevated. In these situations, proactive removal is not just a precaution — it is a necessary safety measure.</p>

      <h2>Your Trusted Partner for Hazardous Tree Removal in Gisborne</h2>

      <p>At Treemarkables, we are your local experts in identifying and safely removing hazardous trees. Our qualified arborists have the training, experience, and equipment to handle even the most challenging tree removals in the Gisborne and East Coast region.</p>

      <p>Don't wait for a storm to find out if your tree is a hazard. If you have noticed any of these five signs, or if you simply have a gut feeling that something is not right, it is always best to get a professional opinion.</p>

      <p>Contact Treemarkables today for a free, no-obligation assessment of your trees. We will provide you with an honest evaluation and a clear plan to ensure the safety of your property and family. Call us on 027 216 6882 or contact us online to schedule your consultation.</p>
    `
  },
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
  const post = blogPosts[slug];

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
    ...(post.image ? { image: `https://www.treemarkables.co.nz${post.image}` } : {}),
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
    "datePublished": post.datePublished ?? "2025-09-14",
    "dateModified": post.datePublished ?? "2025-09-14",
    "mainEntityOfPage": `https://www.treemarkables.co.nz/blog/${slug}`,
    "url": `https://www.treemarkables.co.nz/blog/${slug}`,
    "articleSection": "Tree Care",
    "keywords": post.schemaKeywords ?? ["tree pruning", "Gisborne", "arborist", "tree care", "property maintenance"],
    "about": {
      "@type": "Thing",
      "name": post.about ?? "Tree Pruning"
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title={post.seoTitle ?? `${post.title} | Treemarkables Blog`}
        description={post.excerpt}
        keywords={post.seoKeywords ?? "tree pruning Gisborne, arborist advice, tree care tips, property maintenance, storm protection"}
        ogTitle={post.title}
        ogDescription={post.excerpt}
        ogImage={post.image ? `https://www.treemarkables.co.nz${post.image}` : "https://www.treemarkables.co.nz/team-photo.jpg"}
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

          {post.image ? (
            <div className="aspect-video bg-muted rounded-lg overflow-hidden mb-12">
              <img 
                src={post.image} 
                alt={post.title}
                className="w-full h-full object-cover"
                data-testid="img-post-featured"
              />
            </div>
          ) : null}

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