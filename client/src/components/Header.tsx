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
import logoImage from "@assets/logo-11_1775755479888.png";
import ContactFormModal from "@/components/ContactFormModal";

// Declare gtag and gtag_report_conversion for TypeScript
declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    gtag_report_conversion?: (url?: string) => boolean;
  }
}

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(prev => !prev);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };


  const handlePhoneClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (window.gtag) {
      window.gtag('event', 'phone_call_click', { event_category: 'Contact', event_label: 'Phone Number Click' });
    }
    if (window.gtag_report_conversion) {
      window.gtag_report_conversion('tel:0272166882');
    }
    setTimeout(() => {
      window.location.href = 'tel:0272166882';
    }, 100);
  };

  const handleEmailClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (window.gtag) {
      window.gtag('event', 'click', {
        'event_category': 'Lead Generation',
        'event_label': 'Email Click - Header',
        'value': 1
      });
    }
    setIsContactModalOpen(true);
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
    { href: "/hedge-trimming", label: "Hedge Trimming" }
  ];

  return (
    <header className="bg-black fixed top-0 left-0 right-0 z-[100] shadow-sm" style={{ position: 'fixed', WebkitTransform: 'translateZ(0)', backfaceVisibility: 'hidden' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-20 overflow-hidden">

          {/* Logo and Brand */}
          <Link href="/" className="flex items-center hover-elevate h-full" data-testid="link-home">
            <img 
              src={logoImage} 
              alt="Treemarkables" 
              className="h-40 w-auto object-contain"
              data-testid="logo-image"
            />
          </Link>

          {/* Navigation - Centered */}
          <nav className="hidden md:flex items-center gap-6 lg:gap-8">
            {mainNavLinks.map((link) => (
              <Link 
                key={link.href}
                href={link.href} 
                className="text-[#39FF14] hover:text-[#32CD32] transition-colors font-medium text-sm lg:text-base relative group whitespace-nowrap tracking-wide uppercase" 
                data-testid={`link-${link.label.toLowerCase().replace(' ', '-')}`}
              >
                {link.label}
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[#39FF14] transition-all duration-200 group-hover:w-full"></span>
              </Link>
            ))}
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost"
                  className="text-[#39FF14] hover:text-[#32CD32] hover:bg-transparent transition-colors font-medium text-sm lg:text-base whitespace-nowrap tracking-wide uppercase flex items-center space-x-1 px-0" 
                  data-testid="button-services-dropdown"
                >
                  <span>Services</span>
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 pt-4 pb-2 px-2 bg-black border-gray-800">
                {serviceLinks.map((link) => (
                  <DropdownMenuItem key={link.href} asChild className="text-[#39FF14] hover:text-[#32CD32] hover:bg-gray-900 focus:bg-gray-900 focus:text-[#32CD32]">
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

          {/* Action Buttons - Rounded Green */}
          <div className="flex items-center space-x-2 md:space-x-3">
            {/* Phone Button - Rounded Green */}
            <a 
              href="tel:0272166882" 
              onClick={handlePhoneClick}
              className="flex items-center justify-center w-11 h-11 md:w-12 md:h-12 lg:w-14 lg:h-14 bg-[#39FF14] hover:bg-[#32CD32] rounded-full transition-all duration-200 shadow-lg hover:shadow-xl"
              data-testid="link-phone-header"
            >
              <Phone className="h-5 w-5 lg:h-6 lg:w-6 text-black" />
            </a>

            {/* Email Button - Rounded Green */}
            <button
              type="button"
              onClick={handleEmailClick}
              className="flex items-center justify-center w-11 h-11 md:w-12 md:h-12 lg:w-14 lg:h-14 bg-[#39FF14] hover:bg-[#32CD32] rounded-full transition-all duration-200 shadow-lg hover:shadow-xl"
              data-testid="link-email-header"
              aria-label="Open contact form"
            >
              <Mail className="h-5 w-5 lg:h-6 lg:w-6 text-black" />
            </button>

            
            {/* Mobile Menu Button - Only show on very small screens */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden relative text-[#39FF14] hover:text-[#32CD32] hover:bg-transparent w-11 h-11"
              onClick={toggleMenu}
              data-testid="button-mobile-menu"
              aria-label={isMenuOpen ? "Close menu" : "Open menu"}
              type="button"
            >
              <div className="relative w-5 h-5 pointer-events-none">
                <span className={`absolute top-0 left-0 w-5 h-0.5 bg-current transition-all duration-200 pointer-events-none ${isMenuOpen ? 'rotate-45 translate-y-2' : ''}`}></span>
                <span className={`absolute top-2 left-0 w-5 h-0.5 bg-current transition-all duration-200 pointer-events-none ${isMenuOpen ? 'opacity-0' : ''}`}></span>
                <span className={`absolute top-4 left-0 w-5 h-0.5 bg-current transition-all duration-200 pointer-events-none ${isMenuOpen ? '-rotate-45 -translate-y-2' : ''}`}></span>
              </div>
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div 
          data-testid="mobile-menu"
          className={`md:hidden overflow-y-auto transition-all duration-300 ease-in-out ${
            isMenuOpen 
              ? 'max-h-[calc(100vh-5rem)] opacity-100' 
              : 'max-h-0 opacity-0 pointer-events-none'
          }`}
          aria-hidden={!isMenuOpen}
        >
          <nav className="border-t border-gray-800 py-4 bg-black">
            <div className="flex flex-col space-y-1">
              {mainNavLinks.map((link) => (
                <Link 
                  key={`mobile-${link.href}`}
                  href={link.href} 
                  className="text-[#39FF14] hover:text-[#32CD32] hover:bg-gray-900 transition-all duration-200 font-medium text-base px-4 py-3 rounded-md" 
                  data-testid={`link-${link.label.toLowerCase().replace(' ', '-')}-mobile`}
                  onClick={closeMenu}
                >
                  {link.label}
                </Link>
              ))}
              
              <div className="px-4 py-2 text-sm font-semibold text-gray-400 uppercase tracking-wide">Services</div>
              {serviceLinks.map((link) => (
                <Link 
                  key={`mobile-${link.href}`}
                  href={link.href} 
                  className="text-[#39FF14] hover:text-[#32CD32] hover:bg-gray-900 transition-all duration-200 font-medium text-base px-4 py-3 rounded-md ml-4" 
                  data-testid={`link-${link.label.toLowerCase().replace(' ', '-')}-mobile`}
                  onClick={closeMenu}
                >
                  {link.label}
                </Link>
              ))}
              
              {/* Mobile Actions */}
              <div className="flex flex-col space-y-3 pt-4 px-4 border-t border-gray-800 mt-4">
                <a 
                  href="tel:0272166882" 
                  className="flex items-center justify-center space-x-3 text-base text-black bg-[#39FF14] px-4 py-4 rounded-full border-2 border-[#32CD32] hover:bg-[#32CD32] hover:border-[#2EB82E] transition-all duration-200 font-bold shadow-md tracking-tight"
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
                
                <button
                  type="button"
                  className="flex items-center justify-center space-x-3 text-base text-black bg-[#39FF14] px-4 py-4 rounded-full border-2 border-[#32CD32] hover:bg-[#32CD32] hover:border-[#2EB82E] transition-all duration-200 font-bold shadow-md tracking-tight"
                  data-testid="link-email-mobile"
                  onClick={() => {
                    closeMenu();
                    if (window.gtag) {
                      window.gtag('event', 'click', {
                        'event_category': 'Lead Generation',
                        'event_label': 'Email Click - Header Mobile',
                        'value': 1,
                      });
                    }
                    setIsContactModalOpen(true);
                  }}
                >
                  <Mail className="h-5 w-5" />
                  <span className="font-mono text-sm">Get a Quote</span>
                </button>
              </div>
            </div>
          </nav>
        </div>
      </div>
      <ContactFormModal
        open={isContactModalOpen}
        onOpenChange={setIsContactModalOpen}
      />
    </header>
  );
}