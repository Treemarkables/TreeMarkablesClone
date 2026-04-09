import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <SEO
        title="Privacy Policy | Treemarkables - Tree Removal Gisborne"
        description="Privacy Policy for Treemarkables tree removal services. Learn how we collect, use, and protect your personal information under the New Zealand Privacy Act 2020."
      />
      <Header />
      <main className="flex-1 pt-72 pb-12">
        <div className="max-w-3xl mx-auto px-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
          <p className="text-sm text-gray-500 mb-8">Effective Date: 11 February 2026</p>

          <div className="prose prose-gray max-w-none space-y-8">
            <p className="text-gray-700 leading-relaxed">
              Treemarkables LTD ("we", "us", or "our") is committed to protecting your privacy in accordance with the New Zealand Privacy Act 2020. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website.
            </p>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Information We Collect</h2>
              <p className="text-gray-700 mb-3">We may collect the following types of personal information from you:</p>
              <ul className="list-disc pl-6 space-y-1 text-gray-700">
                <li>Name</li>
                <li>Email address</li>
                <li>Phone number</li>
                <li>Billing and shipping address</li>
                <li>Payment details (processed securely via third-party providers)</li>
                <li>Any other information you provide voluntarily via forms or communications</li>
              </ul>
              <p className="text-gray-700 mt-4 mb-3">We also automatically collect certain technical data:</p>
              <ul className="list-disc pl-6 space-y-1 text-gray-700">
                <li>IP address</li>
                <li>Browser type and version</li>
                <li>Time zone and location</li>
                <li>Pages you visit on our website</li>
                <li>Referral source (e.g., Google, social media)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">2. How We Use Your Information</h2>
              <p className="text-gray-700 mb-3">We may use your information to:</p>
              <ul className="list-disc pl-6 space-y-1 text-gray-700">
                <li>Process transactions and deliver products or services</li>
                <li>Communicate with you (e.g., order updates, newsletters)</li>
                <li>Improve our website and user experience</li>
                <li>Respond to enquiries or customer service requests</li>
                <li>Comply with legal obligations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Sharing Your Information</h2>
              <p className="text-gray-700 mb-3">
                We do <strong>not</strong> sell your personal information. However, we may share your data with:
              </p>
              <ul className="list-disc pl-6 space-y-1 text-gray-700">
                <li>Third-party service providers (e.g., payment processors, email platforms)</li>
                <li>Legal authorities when required by law</li>
                <li>Partners or contractors as necessary for business functions</li>
              </ul>
              <p className="text-gray-700 mt-3">
                These third parties are required to handle your information securely and only for authorized purposes.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Your Rights</h2>
              <p className="text-gray-700 mb-3">Under the New Zealand Privacy Act, you have the right to:</p>
              <ul className="list-disc pl-6 space-y-1 text-gray-700">
                <li>Access your personal information</li>
                <li>Correct any inaccuracies</li>
                <li>Request deletion of your data (subject to legal obligations)</li>
              </ul>
              <p className="text-gray-700 mt-3">
                To exercise these rights, please contact us at: <a href="mailto:quotes@treemarkables.nz" className="text-orange-600 hover:text-orange-700 underline">quotes@treemarkables.nz</a>
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Data Storage & Security</h2>
              <p className="text-gray-700">
                We take reasonable steps to protect your personal data from loss, misuse, unauthorized access, or disclosure. However, no method of transmission over the internet is 100% secure.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Cookies</h2>
              <p className="text-gray-700">
                Our website uses cookies to enhance user experience and gather anonymous traffic data. You may choose to disable cookies through your browser settings, though this may affect site functionality.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Changes to This Policy</h2>
              <p className="text-gray-700">
                We may update this policy from time to time. Changes will be posted on this page with an updated revision date.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Contact Us</h2>
              <p className="text-gray-700 mb-2">
                If you have questions or concerns about this Privacy Policy or how we handle your data, please contact us at:
              </p>
              <div className="text-gray-700 space-y-1">
                <p className="font-semibold">Treemarkables LTD</p>
                <p>213 Stanley Road, Gisborne</p>
                <p>Email: <a href="mailto:quotes@treemarkables.nz" className="text-orange-600 hover:text-orange-700 underline">quotes@treemarkables.nz</a></p>
                <p>Phone: <a href="tel:0272166882" className="text-orange-600 hover:text-orange-700 underline">027-216-6882</a></p>
              </div>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}