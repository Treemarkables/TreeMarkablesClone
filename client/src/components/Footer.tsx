import { Shield, Award, Clock } from "lucide-react";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-black border-t border-gray-800 py-12">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid lg:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="lg:col-span-2">
            <p className="text-gray-300 mb-6 leading-relaxed">
              Professional tree removal services in Gisborne. Our certified arborists 
              are dedicated to ensuring the well-being of your property and the safety 
              of its occupants.
            </p>
            
            {/* Key Features */}
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center text-sm">
                <Shield className="h-4 w-4 mr-2 text-primary" />
                <span className="text-gray-300">Insured</span>
              </div>
              <div className="flex items-center text-sm">
                <Award className="h-4 w-4 mr-2 text-primary" />
                <span className="text-gray-300">Qualified Arborists</span>
              </div>
              <div className="flex items-center text-sm">
                <Clock className="h-4 w-4 mr-2 text-primary" />
                <span className="text-gray-300">24/7 Emergency</span>
              </div>
            </div>
          </div>

          {/* Services */}
          <div>
            <h3 className="font-semibold text-white mb-4">Services</h3>
            <ul className="space-y-2">
              <li>
                <a href="#services" className="text-gray-300 hover:text-orange-400 transition-colors" data-testid="link-footer-hazardous">
                  Hazardous Tree Removal
                </a>
              </li>
              <li>
                <a href="#services" className="text-gray-300 hover:text-orange-400 transition-colors" data-testid="link-footer-emergency">
                  Emergency Services
                </a>
              </li>
              <li>
                <a href="#services" className="text-gray-300 hover:text-orange-400 transition-colors" data-testid="link-footer-precision">
                  Precision Removal
                </a>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-semibold text-white mb-4">Contact</h3>
            <div className="space-y-2">
              <p className="text-gray-300 text-sm" data-testid="text-footer-email">
                quotes@treemarkables.nz
              </p>
              <a 
                href="tel:0272166882" 
                className="text-gray-300 text-sm hover:text-orange-400 transition-colors cursor-pointer" 
                data-testid="link-footer-phone"
              >
                027-216-6882
              </a>
              <p className="text-gray-300 text-sm" data-testid="text-footer-location">
                Gisborne & Surrounding Areas
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-700 mt-8 pt-8 text-center">
          <p className="text-gray-400 text-sm" data-testid="text-copyright">
            © {currentYear} Treemarkables. All rights reserved. Professional tree removal services.
          </p>
        </div>
      </div>
    </footer>
  );
}