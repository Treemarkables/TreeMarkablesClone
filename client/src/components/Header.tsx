import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Phone, Mail, ChevronDown } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import logoImage from "@assets/treelogo_1758218149788.webp";

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

  const mainNavLinks = [
    { href: "/", label: "Home" },
    { href: "/blog", label: "Blog" }
  ];

  const serviceLinks = [
    { href: "/tree-removal", label: "Tree Removal" },
    { href: "/summer-offer", label: "Summer Offer" },
    { href: "/tree-pruning", label: "Tree Pruning" },
    { href: "/stump-grinding", label: "Stump Grinding" },
    { href: "/hedge-trimming", label: "Hedge Trimming" },
    { href: "/job-dashboard", label: "Job Manager Demo" }
  ];

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-[auto_1fr_auto] items-center min-h-16 md:min-h-20 lg:min-h-24 py-2">
          
          {/* Logo and Brand */}
          <Link href="/" className="flex items-center hover-elevate group col-start-1" data-testid="link-home">
            <img 
              src={logoImage} 
              alt="Treemarkables" 
              className="max-h-12 md:max-h-16 lg:max-h-20 w-auto max-w-[50vw] md:max-w-[40vw] object-contain transition-all duration-200"
              data-testid="logo-image"
            />
          </Link>

          {/* Navigation - Centered */}
          <nav className="hidden md:flex justify-center items-center gap-8 lg:gap-12 col-start-2">
            {mainNavLinks.map((link) => (
              <Link 
                key={link.href}
                href={link.href} 
                className="text-gray-700 hover:text-primary transition-colors font-medium text-sm lg:text-base relative group whitespace-nowrap tracking-wide uppercase" 
                data-testid={`link-${link.label.toLowerCase().replace(' ', '-')}`}
              >
                {link.label}
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all duration-200 group-hover:w-full"></span>
              </Link>
            ))}
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost"
                  className="text-gray-700 hover:text-primary transition-colors font-medium text-sm lg:text-base whitespace-nowrap tracking-wide uppercase flex items-center space-x-1 px-0" 
                  data-testid="button-services-dropdown"
                >
                  <span>Services</span>
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56">
                {serviceLinks.map((link) => (
                  <DropdownMenuItem key={link.href} asChild>
                    <Link 
                      href={link.href} 
                      className="w-full" 
                      data-testid={`link-${link.label.toLowerCase().replace(' ', '-')}`}
                    >
                      {link.label}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>

          {/* Action Buttons - Rounded Orange */}
          <div className="flex items-center space-x-2 md:space-x-3 col-start-3">
            {/* Phone Button - Rounded Orange */}
            <a 
              href="tel:0272166882" 
              onClick={handlePhoneClick}
              className="flex items-center justify-center w-11 h-11 md:w-12 md:h-12 lg:w-14 lg:h-14 bg-orange-500 hover:bg-orange-600 rounded-full transition-all duration-200 shadow-lg hover:shadow-xl"
              data-testid="link-phone-header"
            >
              <Phone className="h-5 w-5 lg:h-6 lg:w-6 text-white" />
            </a>

            {/* Email Button - Rounded Orange */}
            <a 
              href="mailto:quotes@treemarkables.nz" 
              onClick={handleEmailClick}
              className="flex items-center justify-center w-11 h-11 md:w-12 md:h-12 lg:w-14 lg:h-14 bg-orange-500 hover:bg-orange-600 rounded-full transition-all duration-200 shadow-lg hover:shadow-xl"
              data-testid="link-email-header"
            >
              <Mail className="h-5 w-5 lg:h-6 lg:w-6 text-white" />
            </a>

            
            {/* Mobile Menu Button - Only show on very small screens */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden relative text-gray-700 hover:text-primary w-11 h-11"
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
          <nav className="border-t border-gray-200 py-4 bg-white">
            <div className="flex flex-col space-y-1">
              {mainNavLinks.map((link) => (
                <Link 
                  key={`mobile-${link.href}`}
                  href={link.href} 
                  className="text-gray-700 hover:text-primary hover:bg-gray-50 transition-all duration-200 font-medium text-base px-4 py-3 rounded-md" 
                  data-testid={`link-${link.label.toLowerCase().replace(' ', '-')}-mobile`}
                  onClick={closeMenu}
                >
                  {link.label}
                </Link>
              ))}
              
              <div className="px-4 py-2 text-sm font-semibold text-gray-500 uppercase tracking-wide">Services</div>
              {serviceLinks.map((link) => (
                <Link 
                  key={`mobile-${link.href}`}
                  href={link.href} 
                  className="text-gray-700 hover:text-primary hover:bg-gray-50 transition-all duration-200 font-medium text-base px-4 py-3 rounded-md ml-4" 
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
                  className="flex items-center justify-center space-x-3 text-base text-white bg-orange-500 px-4 py-4 rounded-full border-2 border-orange-600 hover:bg-orange-600 hover:border-orange-700 transition-all duration-200 font-bold shadow-md tracking-tight"
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
                  className="flex items-center justify-center space-x-3 text-base text-white bg-orange-500 px-4 py-4 rounded-full border-2 border-orange-600 hover:bg-orange-600 hover:border-orange-700 transition-all duration-200 font-bold shadow-md tracking-tight"
                  data-testid="link-email-mobile"
                  onClick={closeMenu}
                >
                  <Mail className="h-5 w-5" />
                  <span className="font-mono text-sm">quotes@treemarkables.nz</span>
                </a>
              </div>
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}