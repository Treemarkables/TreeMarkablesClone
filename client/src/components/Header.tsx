import { Button } from "@/components/ui/button";
import { Phone, Menu, X, Mail } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import logoImage from "@assets/0fe124b7-cd27-4bb5-a914-65ef9de39b28_1757721055730.png";

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
        <div className="flex items-center justify-between h-20">
          
          {/* Logo and Brand */}
          <Link href="/" className="flex items-center space-x-3 hover-elevate group" data-testid="link-home">
            <img 
              src={logoImage} 
              alt="Treemarkables Logo" 
              className="h-12 w-12 sm:h-14 sm:w-14 rounded-full object-cover ring-2 ring-primary/20 group-hover:ring-primary/40 transition-all duration-200"
              data-testid="logo-image"
            />
            <div className="hidden sm:flex flex-col">
              <span className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                Treemarkables
              </span>
              <span className="text-xs text-muted-foreground">
                Gisborne Tree Experts
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center space-x-8">
            {navigationLinks.map((link) => (
              <Link 
                key={link.href}
                href={link.href} 
                className="text-foreground hover:text-primary transition-colors font-medium text-sm relative group" 
                data-testid={`link-${link.label.toLowerCase().replace(' ', '-')}`}
              >
                {link.label}
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all duration-200 group-hover:w-full"></span>
              </Link>
            ))}
          </nav>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Phone Button - Desktop */}
            <a 
              href="tel:0272166882" 
              className="hidden lg:flex items-center space-x-2 text-sm text-white bg-orange-500 px-3 py-2 rounded-lg border border-orange-600 hover:bg-orange-600 transition-all duration-200 font-medium shadow-sm hover:shadow-md"
              data-testid="link-phone-header"
            >
              <Phone className="h-4 w-4" />
              <span>027-216-6882</span>
            </a>

            {/* Email Button - Desktop */}
            <a 
              href="mailto:quotes@treemarkables.nz" 
              className="hidden lg:flex items-center space-x-2 text-sm text-white bg-blue px-3 py-2 rounded-lg border border-blue hover:bg-blue/90 transition-all duration-200 font-medium shadow-sm hover:shadow-md"
              data-testid="link-email-header"
            >
              <Mail className="h-4 w-4" />
              <span>quotes@treemarkables.nz</span>
            </a>

            {/* Get Quote Button - Desktop */}
            <Button 
              onClick={handleGetQuote} 
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-sm hover:shadow-md transition-all duration-200 hidden lg:inline-flex" 
              data-testid="button-get-quote"
            >
              Get Quote
            </Button>
            
            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden relative"
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
        <div className={`lg:hidden overflow-hidden transition-all duration-300 ease-in-out ${isMenuOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
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