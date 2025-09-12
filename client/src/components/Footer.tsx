import { Shield, Award, Clock } from "lucide-react";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-muted/50 border-t border-border py-12">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid lg:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="lg:col-span-2">
            <div className="flex items-center mb-4">
              <img 
                src="/treemarkables-logo.png" 
                alt="Treemarkables Logo" 
                className="h-40 w-40 rounded-full object-cover"
                data-testid="logo-image-footer"
              />
            </div>
            <p className="text-muted-foreground mb-6 leading-relaxed">
              Professional tree removal services in New Zealand. Our certified arborists 
              are dedicated to ensuring the well-being of your property and the safety 
              of its occupants.
            </p>
            
            {/* Key Features */}
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center text-sm">
                <Shield className="h-4 w-4 mr-2 text-primary" />
                <span className="text-muted-foreground">Insured</span>
              </div>
              <div className="flex items-center text-sm">
                <Award className="h-4 w-4 mr-2 text-primary" />
                <span className="text-muted-foreground">Qualified Arborists</span>
              </div>
              <div className="flex items-center text-sm">
                <Clock className="h-4 w-4 mr-2 text-primary" />
                <span className="text-muted-foreground">24/7 Emergency</span>
              </div>
            </div>
          </div>

          {/* Services */}
          <div>
            <h3 className="font-semibold text-foreground mb-4">Services</h3>
            <ul className="space-y-2">
              <li>
                <a href="#services" className="text-muted-foreground hover:text-primary transition-colors" data-testid="link-footer-hazardous">
                  Hazardous Tree Removal
                </a>
              </li>
              <li>
                <a href="#services" className="text-muted-foreground hover:text-primary transition-colors" data-testid="link-footer-emergency">
                  Emergency Services
                </a>
              </li>
              <li>
                <a href="#services" className="text-muted-foreground hover:text-primary transition-colors" data-testid="link-footer-precision">
                  Precision Removal
                </a>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-semibold text-foreground mb-4">Contact</h3>
            <div className="space-y-2">
              <p className="text-muted-foreground text-sm" data-testid="text-footer-email">
                quotes@treemarkables.nz
              </p>
              <p className="text-muted-foreground text-sm" data-testid="text-footer-phone">
                0272166882
              </p>
              <p className="text-muted-foreground text-sm" data-testid="text-footer-location">
                New Zealand Wide Service
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-border mt-8 pt-8 text-center">
          <p className="text-muted-foreground text-sm" data-testid="text-copyright">
            © {currentYear} Treemarkables. All rights reserved. Professional tree removal services.
          </p>
        </div>
      </div>
    </footer>
  );
}