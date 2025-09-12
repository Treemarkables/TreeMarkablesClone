import { Mail, Phone, MapPin } from "lucide-react";

export default function ContactMap() {
  return (
    <section className="py-16">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-0 rounded-lg overflow-hidden shadow-lg">
          {/* Map Section */}
          <div className="bg-muted h-96 lg:h-auto flex items-center justify-center">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d387190.2800040743!2d-74.25987368715491!3d40.697670063419785!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zNDDCsDQxJzUxLjYiTiA3NMKwMTUnNTAuNCJX!5e0!3m2!1sen!2sus!4v1620000000000!5m2!1sen!2sus"
              width="100%"
              height="100%"
              style={{ border: 0, minHeight: '384px' }}
              allowFullScreen={true}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Treemarkables Location"
              data-testid="map-location"
            />
          </div>

          {/* Contact Information */}
          <div className="bg-primary text-white p-8 lg:p-12 flex flex-col justify-center">
            <h2 className="text-3xl lg:text-4xl font-bold mb-6" data-testid="text-contact-title">
              Get in Touch for a Green Transformation!
            </h2>
            <p className="text-white/90 mb-8 text-lg leading-relaxed" data-testid="text-contact-description">
              Ready to give your landscape a fresh, polished look? Contact today for a 
              consultation. Our friendly team will assess your hedge trimming needs and 
              provide a customized plan to bring out the best in your greenery.
            </p>

            <div className="space-y-6">
              <div className="flex items-center space-x-4" data-testid="contact-email">
                <div className="bg-white/20 p-3 rounded-lg">
                  <Mail className="h-6 w-6" />
                </div>
                <div>
                  <a 
                    href="mailto:quotes@treemarkables.nz" 
                    className="text-lg font-medium hover:text-white/80 transition-colors"
                    data-testid="link-email"
                  >
                    quotes@treemarkables.nz
                  </a>
                </div>
              </div>

              <div className="flex items-center space-x-4" data-testid="contact-phone">
                <div className="bg-white/20 p-3 rounded-lg">
                  <Phone className="h-6 w-6" />
                </div>
                <div>
                  <a 
                    href="tel:0272166882" 
                    className="text-lg font-medium hover:text-white/80 transition-colors"
                    data-testid="link-phone"
                  >
                    0272166882
                  </a>
                </div>
              </div>

              <div className="flex items-center space-x-4" data-testid="contact-service">
                <div className="bg-white/20 p-3 rounded-lg">
                  <MapPin className="h-6 w-6" />
                </div>
                <div>
                  <span className="text-lg font-medium" data-testid="text-service">
                    Tree Cutting Service
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}