import { Button } from "@/components/ui/button";
import { Phone, Menu, X } from "lucide-react";
import { useState } from "react";
// Logo served from public directory
const logoImage = "/logo.jpg";

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
      <div className="max-w-6xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img 
              src={logoImage} 
              alt="Treemarkables Logo" 
              className="h-60 w-auto"
              data-testid="img-logo"
            />
            <div className="text-sm text-muted-foreground hidden sm:block">Professional Tree Services</div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <a href="#services" className="text-foreground hover:text-primary transition-colors" data-testid="link-services">
              Services
            </a>
            <a href="#process" className="text-foreground hover:text-primary transition-colors" data-testid="link-process">
              Our Process
            </a>
            <a href="#contact" className="text-foreground hover:text-primary transition-colors" data-testid="link-contact">
              Contact
            </a>
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
              <a href="#services" className="text-foreground hover:text-primary transition-colors" data-testid="link-services-mobile">
                Services
              </a>
              <a href="#process" className="text-foreground hover:text-primary transition-colors" data-testid="link-process-mobile">
                Our Process
              </a>
              <a href="#contact" className="text-foreground hover:text-primary transition-colors" data-testid="link-contact-mobile">
                Contact
              </a>
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