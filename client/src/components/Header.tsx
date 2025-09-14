import { Button } from "@/components/ui/button";
import { Phone, Menu, X, Mail } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import logoImage from "@assets/new logo png_1757829817784.png";

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  const handleGetQuote = () => {
    document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
    closeMenu();
  };

  const navigationLinks = [
    { href: "/tree-removal", label: "Tree Removal" },
    { href: "/tree-pruning", label: "Tree Pruning" },
    { href: "/stump-grinding", label: "Stump Grinding" },
    { href: "/hedge-trimming", label: "Hedge Trimming" }
  ];

  return (
    <header className="bg-background/95 backdrop-blur-sm border-b border-border sticky top-0 z-50 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-18 sm:h-20">
          
          {/* Logo and Brand */}
          <Link href="/" className="flex items-center space-x-2 sm:space-x-3 hover-elevate group flex-shrink-0" data-testid="link-home">
            <img 
              src={logoImage} 
              alt="Treemarkables" 
              className="h-14 w-auto sm:h-16 object-contain transition-all duration-200"
              data-testid="logo-image"
            />
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center space-x-3 lg:space-x-6 flex-shrink-0">
            {navigationLinks.map((link) => (
              <Link 
                key={link.href}
                href={link.href} 
                className="text-foreground hover:text-primary transition-colors font-medium text-sm relative group whitespace-nowrap" 
                data-testid={`link-${link.label.toLowerCase().replace(' ', '-')}`}
              >
                {link.label}
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all duration-200 group-hover:w-full"></span>
              </Link>
            ))}
          </nav>

          {/* Action Buttons */}
          <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
            {/* Phone Button - Always visible */}
            <a 
              href="tel:0272166882" 
              className="flex items-center space-x-1 text-xs sm:text-sm text-white bg-orange-500 px-2 py-2 rounded-lg border border-orange-600 hover:bg-orange-600 transition-all duration-200 font-medium shadow-sm hover:shadow-md whitespace-nowrap"
              data-testid="link-phone-header"
            >
              <Phone className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
              <span className="hidden sm:inline">027-216-6882</span>
              <span className="sm:hidden">Call</span>
            </a>

            {/* Email Button - Always visible */}
            <a 
              href="mailto:quotes@treemarkables.nz" 
              className="flex items-center space-x-1 text-xs sm:text-sm text-white bg-blue px-2 py-2 rounded-lg border border-blue hover:bg-blue/90 transition-all duration-200 font-medium shadow-sm hover:shadow-md whitespace-nowrap"
              data-testid="link-email-header"
            >
              <Mail className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
              <span className="hidden lg:inline">quotes@treemarkables.nz</span>
              <span className="lg:hidden">Email</span>
            </a>

            {/* Get Quote Button - Desktop */}
            <Button 
              onClick={handleGetQuote} 
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-sm hover:shadow-md transition-all duration-200 hidden xl:inline-flex text-sm px-3 py-2"
              data-testid="button-get-quote"
            >
              Get Quote
            </Button>
            
            {/* Mobile Menu Button - Only show on very small screens */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden relative"
              onClick={toggleMenu}
              data-testid="button-mobile-menu"
              aria-label={isMenuOpen ? "Close menu" : "Open menu"}
            >
              <div className="relative w-5 h-5">
                <span className={`absolute top-0 left-0 w-5 h-0.5 bg-current transition-all duration-200 ${isMenuOpen ? 'rotate-45 translate-y-2' : ''}`}></span>
                <span className={`absolute top-2 left-0 w-5 h-0.5 bg-current transition-all duration-200 ${isMenuOpen ? 'opacity-0' : ''}`}></span>
                <span className={`absolute top-4 left-0 w-5 h-0.5 bg-current transition-all duration-200 ${isMenuOpen ? '-rotate-45 -translate-y-2' : ''}`}></span>
              </div>
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${isMenuOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
          <nav className="border-t border-border/50 py-4">
            <div className="flex flex-col space-y-1">
              {navigationLinks.map((link) => (
                <Link 
                  key={`mobile-${link.href}`}
                  href={link.href} 
                  className="text-foreground hover:text-primary hover:bg-muted/50 transition-all duration-200 font-medium text-base px-4 py-3 rounded-md" 
                  data-testid={`link-${link.label.toLowerCase().replace(' ', '-')}-mobile`}
                  onClick={closeMenu}
                >
                  {link.label}
                </Link>
              ))}
              
              {/* Mobile Actions */}
              <div className="flex flex-col space-y-3 pt-4 px-4 border-t border-border/50 mt-4">
                <a 
                  href="tel:0272166882" 
                  className="flex items-center justify-center space-x-2 text-sm text-white bg-orange-500 px-4 py-3 rounded-lg border border-orange-600 hover:bg-orange-600 transition-all duration-200 font-medium"
                  data-testid="link-phone-mobile"
                  onClick={closeMenu}
                >
                  <Phone className="h-4 w-4" />
                  <span>Call: 027-216-6882</span>
                </a>
                
                <a 
                  href="mailto:quotes@treemarkables.nz" 
                  className="flex items-center justify-center space-x-2 text-sm text-white bg-blue px-4 py-3 rounded-lg border border-blue hover:bg-blue/90 transition-all duration-200 font-medium"
                  data-testid="link-email-mobile"
                  onClick={closeMenu}
                >
                  <Mail className="h-4 w-4" />
                  <span>Email: quotes@treemarkables.nz</span>
                </a>
                
                <Button 
                  onClick={handleGetQuote} 
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium w-full" 
                  data-testid="button-get-quote-mobile"
                >
                  Get Free Quote
                </Button>
              </div>
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}