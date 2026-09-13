import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ContactSection from "@/components/ContactSection";
import SEO from "@/components/SEO";
import { Calendar, ArrowRight, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";

const blogPosts = [
  {
    slug: "hazardous-tree-removal-gisborne-5-signs-dangerous-tree",
    title: "5 Signs Your Tree Is a Hazard and Needs Removing",
    excerpt: "Worried a tree on your Gisborne property is a hazard? Learn 5 critical signs of a dangerous tree, from dead branches to root decay. Contact Treemarkables for a free assessment.",
    date: "February 25, 2026",
    author: "Treemarkables Team",
    readTime: "9 min read",
    image: "/hazardous-tree-gisborne.jpg"
  },
  {
    slug: "why-regular-tree-pruning-protects-your-home-gisborne",
    title: "Why Regular Tree Pruning Protects Your Home in Gisborne",
    excerpt: "Gisborne's mild climate and coastal winds create conditions where branches can grow quickly and pose risks to homes. Learn why regular pruning is essential preventive maintenance.",
    date: "September 14, 2025",
    author: "Treemarkables Team",
    readTime: "8 min read",
    image: "/tree-pruning.jpg"
  }
];

export default function Blog() {
  return (
    <div className="min-h-screen bg-background pt-20">
      <SEO 
        title="Tree Care Blog – Gisborne Arborist Tips | Treemarkables"
        description="Expert tree care advice from Gisborne's professional arborists. Get tips on tree pruning, removal, and maintenance for your property's safety and health."
        keywords="tree care blog, arborist tips, Gisborne tree care, tree pruning advice, tree removal tips, professional tree care"
        ogTitle="Tree Care Blog - Expert Tips from Gisborne Arborists"
        ogDescription="Expert tree care advice from Gisborne's professional arborists. Get tips on tree pruning, removal, and maintenance for your property's safety and health."
        canonicalUrl="https://www.treemarkables.co.nz/blog"
      />
      <Header />
      
      {/* Blog Header */}
      <section className="pt-32 pb-16 bg-gradient-to-br from-primary/10 to-green-600/10">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-6" data-testid="text-blog-title">
            Tree Care Insights
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto" data-testid="text-blog-description">
            Expert advice and tips from Gisborne's professional arborists. 
            Learn how to keep your trees healthy and your property safe.
          </p>
        </div>
      </section>

      {/* Blog Posts */}
      <section className="py-20 bg-background">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-8">
            {blogPosts.map((post) => (
              <Card key={post.slug} className="hover-elevate group">
                <div className="aspect-video bg-muted rounded-t-lg overflow-hidden">
                  <img 
                    src={post.image} 
                    alt={post.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    data-testid={`img-blog-${post.slug}`}
                  />
                </div>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span data-testid={`text-date-${post.slug}`}>{post.date}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <User className="w-4 h-4" />
                      <span data-testid={`text-author-${post.slug}`}>{post.author}</span>
                    </div>
                  </div>
                  
                  <h2 className="text-xl font-semibold text-foreground mb-3 line-clamp-2" data-testid={`text-title-${post.slug}`}>
                    <Link href={`/blog/${post.slug}`} className="hover:text-primary transition-colors">
                      {post.title}
                    </Link>
                  </h2>
                  
                  <p className="text-muted-foreground mb-4 line-clamp-3" data-testid={`text-excerpt-${post.slug}`}>
                    {post.excerpt}
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground" data-testid={`text-read-time-${post.slug}`}>
                      {post.readTime}
                    </span>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/blog/${post.slug}`} data-testid={`button-read-more-${post.slug}`}>
                        Read More
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <ContactSection />

      <Footer />
    </div>
  );
}