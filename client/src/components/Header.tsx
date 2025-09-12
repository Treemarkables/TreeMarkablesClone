import { Button } from "@/components/ui/button";
import { Phone, Menu, X } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
    console.log('Menu toggled:', !isMenuOpen);
  };

  const handleGetQuote = () => {
    console.log('Get quote clicked');
    // Scroll to contact section
    document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <header className="bg-background border-b border-border sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img 
              src="/treemarkables-logo.png" 
              alt="Treemarkables Logo" 
              className="h-16 w-16 rounded-full object-cover"
              data-testid="logo-image"
            />
            <div className="text-sm text-muted-foreground hidden sm:block">Professional Tree Services</div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-4 flex-nowrap">
            <Link href="/tree-removal" className="text-foreground hover:text-primary transition-colors" data-testid="link-tree-removal">
              Tree Removal
            </Link>
            <Link href="/tree-pruning" className="text-foreground hover:text-primary transition-colors" data-testid="link-tree-pruning">
              Tree Pruning
            </Link>
            <Link href="/stump-grinding" className="text-foreground hover:text-primary transition-colors" data-testid="link-stump-grinding">
              Stump Grinding
            </Link>
            <Link href="/hedge-trimming" className="text-foreground hover:text-primary transition-colors" data-testid="link-hedge-trimming">
              Hedge Trimming
            </Link>
            <Link href="/" className="text-foreground hover:text-primary transition-colors" data-testid="link-home">
              Home
            </Link>
          </nav>

          <div className="flex items-center space-x-4">
            <div className="hidden lg:flex items-center space-x-2 text-sm text-muted-foreground">
              <Phone className="h-4 w-4" />
              <span>0272166882</span>
            </div>
            <Button onClick={handleGetQuote} data-testid="button-get-quote">
              Get Quote
            </Button>
            
            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={toggleMenu}
              data-testid="button-mobile-menu"
            >
              {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <nav className="md:hidden mt-4 pb-4 border-t border-border">
            <div className="flex flex-col space-y-4 pt-4">
              <Link href="/tree-removal" className="text-foreground hover:text-primary transition-colors" data-testid="link-tree-removal-mobile">
                Tree Removal
              </Link>
              <Link href="/tree-pruning" className="text-foreground hover:text-primary transition-colors" data-testid="link-tree-pruning-mobile">
                Tree Pruning
              </Link>
              <Link href="/stump-grinding" className="text-foreground hover:text-primary transition-colors" data-testid="link-stump-grinding-mobile">
                Stump Grinding
              </Link>
              <Link href="/hedge-trimming" className="text-foreground hover:text-primary transition-colors" data-testid="link-hedge-trimming-mobile">
                Hedge Trimming
              </Link>
              <Link href="/" className="text-foreground hover:text-primary transition-colors" data-testid="link-home-mobile">
                Home
              </Link>
              <div className="flex items-center space-x-2 text-sm text-muted-foreground pt-2 border-t border-border">
                <Phone className="h-4 w-4" />
                <span>0272166882</span>
              </div>
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}