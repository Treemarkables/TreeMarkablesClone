import { Button } from "@/components/ui/button";
import { Phone, Menu, X, Mail } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import logoImage from "@assets/new logo png_1757829817784.png";

// Declare gtag and gtag_report_conversion for TypeScript
declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    gtag_report_conversion?: (url?: string) => boolean;
  }
}

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(prev => !prev);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  const handleGetQuote = () => {
    closeMenu();
    
    // Track quote button click
    if (window.gtag) {
      window.gtag('event', 'click', {
        'event_category': 'Lead Generation',
        'event_label': 'Get Quote Button - Header',
        'value': 1
      });
    }
    
    // Use requestAnimationFrame for better timing with DOM updates
    requestAnimationFrame(() => {
      const contactElement = document.getElementById('contact');
      if (contactElement) {
        contactElement.scrollIntoView({ behavior: 'smooth' });
      }
    });
  };
  
  const handlePhoneClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (window.gtag_report_conversion) {
      window.gtag_report_conversion('tel:0272166882');
    } else {
      // Fallback if conversion tracking not available
      window.location.href = 'tel:0272166882';
    }
  };
  
  const handleEmailClick = (e: React.MouseEvent) => {
    // Prevent immediate navigation
    e.preventDefault();
    
    if (window.gtag) {
      window.gtag('event', 'click', {
        'event_category': 'Lead Generation', 
        'event_label': 'Email Click - Header',
        'value': 1
      });
      
      console.log('Google Analytics: Header email click tracked');
    }
    
    // Small delay to allow analytics event to fire, then navigate
    setTimeout(() => {
      window.location.href = 'mailto:quotes@treemarkables.nz';
    }, 100);
  };

  const navigationLinks = [
    { href: "/tree-removal", label: "Tree Removal" },
    { href: "/summer-offer", label: "Offer" },
    { href: "/tree-pruning", label: "Tree Pruning" },
    { href: "/stump-grinding", label: "Stump Grinding" },
    { href: "/hedge-trimming", label: "Hedge Trimming" },
    { href: "/blog", label: "Blog" }
  ];

  return (
    <header className="bg-white/98 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16 sm:h-24">
          
          {/* Logo and Brand */}
          <Link href="/" className="flex items-center space-x-2 sm:space-x-3 hover-elevate group flex-shrink-0" data-testid="link-home">
            <img 
              src={logoImage} 
              alt="Treemarkables" 
              className="h-[192px] w-auto sm:h-[216px] object-contain transition-all duration-200 mt-12"
              data-testid="logo-image"
            />
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center space-x-4 lg:space-x-8 flex-shrink-0">
            {navigationLinks.map((link) => (
              <Link 
                key={link.href}
                href={link.href} 
                className="text-gray-700 hover:text-primary transition-colors font-semibold text-sm lg:text-base relative group whitespace-nowrap tracking-tight" 
                data-testid={`link-${link.label.toLowerCase().replace(' ', '-')}`}
              >
                {link.label}
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all duration-200 group-hover:w-full"></span>
              </Link>
            ))}
          </nav>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
            {/* Phone Button - Rectangle box */}
            <a 
              href="tel:0272166882" 
              onClick={handlePhoneClick}
              className="flex items-center space-x-2 text-xs sm:text-sm lg:text-base text-white bg-orange-500 px-3 py-2.5 sm:px-4 sm:py-3 rounded-sm border-2 border-orange-600 hover:bg-orange-600 hover:border-orange-700 transition-all duration-200 font-bold shadow-md hover:shadow-lg whitespace-nowrap tracking-tight"
              data-testid="link-phone-header"
            >
              <Phone className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
              <span className="hidden sm:inline font-mono">027-216-6882</span>
              <span className="sm:hidden font-bold">Call</span>
            </a>

            {/* Email Button - Rectangle box */}
            <a 
              href="mailto:quotes@treemarkables.nz" 
              onClick={handleEmailClick}
              className="flex items-center space-x-2 text-xs sm:text-sm lg:text-base text-white bg-blue-600 px-3 py-2.5 sm:px-4 sm:py-3 rounded-sm border-2 border-blue-700 hover:bg-blue-700 hover:border-blue-800 transition-all duration-200 font-bold shadow-md hover:shadow-lg whitespace-nowrap tracking-tight"
              data-testid="link-email-header"
            >
              <Mail className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
              <span className="hidden lg:inline font-mono text-xs">quotes@treemarkables.nz</span>
              <span className="lg:hidden font-bold">Email</span>
            </a>

            {/* Get Quote Button - Desktop */}
            <Button 
              onClick={handleGetQuote} 
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-md hover:shadow-lg transition-all duration-200 hidden lg:inline-flex text-base px-5 py-3 tracking-tight"
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
        <div 
          data-testid="mobile-menu"
          className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${
            isMenuOpen 
              ? 'max-h-96 opacity-100' 
              : 'max-h-0 opacity-0 pointer-events-none'
          }`}
          aria-hidden={!isMenuOpen}
        >
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
              <div className="flex flex-col space-y-3 pt-4 px-4 border-t border-gray-200 mt-4">
                <a 
                  href="tel:0272166882" 
                  className="flex items-center justify-center space-x-3 text-base text-white bg-orange-500 px-4 py-4 rounded-sm border-2 border-orange-600 hover:bg-orange-600 hover:border-orange-700 transition-all duration-200 font-bold shadow-md tracking-tight"
                  data-testid="link-phone-mobile"
                  onClick={(e) => {
                    e.preventDefault();
                    closeMenu();
                    if (window.gtag_report_conversion) {
                      window.gtag_report_conversion('tel:0272166882');
                    } else {
                      window.location.href = 'tel:0272166882';
                    }
                  }}
                >
                  <Phone className="h-5 w-5" />
                  <span className="font-mono">Call: 027-216-6882</span>
                </a>
                
                <a 
                  href="mailto:quotes@treemarkables.nz" 
                  className="flex items-center justify-center space-x-3 text-base text-white bg-blue-600 px-4 py-4 rounded-sm border-2 border-blue-700 hover:bg-blue-700 hover:border-blue-800 transition-all duration-200 font-bold shadow-md tracking-tight"
                  data-testid="link-email-mobile"
                  onClick={closeMenu}
                >
                  <Mail className="h-5 w-5" />
                  <span className="font-mono text-sm">quotes@treemarkables.nz</span>
                </a>
                
                <Button 
                  onClick={handleGetQuote} 
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold w-full py-4 text-base shadow-md tracking-tight" 
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