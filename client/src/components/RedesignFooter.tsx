import { Link } from "wouter";
import { Clock } from "lucide-react";
import logoImage from "@assets/logo-11_1775755479888.png";

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    gtag_report_conversion?: (url?: string) => boolean;
  }
}

const PHONE = "0272166882";

export default function RedesignFooter() {
  const handlePhoneClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (window.gtag) {
      window.gtag("event", "phone_call_click", { event_category: "Contact", event_label: "Phone Number Click" });
    }
    if (window.gtag_report_conversion) {
      window.gtag_report_conversion(`tel:${PHONE}`);
    }
    setTimeout(() => { window.location.href = `tel:${PHONE}`; }, 100);
  };

  return (
    <footer className="bg-ink border-t border-white/10 py-14">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <div className="grid md:grid-cols-4 gap-10">
          <div className="md:col-span-2 max-w-sm">
            <img src={logoImage} alt="Treemarkables" className="h-16 w-auto object-contain mb-4" />
            <p className="text-white/55 leading-relaxed">
              Qualified Gisborne arborists for safe tree removal, pruning, stump grinding and hedge trimming across Tairāwhiti and the East Coast.
            </p>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4">Services</h4>
            <ul className="space-y-2.5 text-white/55 text-sm">
              <li><Link href="/tree-removal" className="hover:text-neon transition-colors">Tree Removal</Link></li>
              <li><Link href="/tree-pruning" className="hover:text-neon transition-colors">Tree Pruning</Link></li>
              <li><Link href="/stump-grinding" className="hover:text-neon transition-colors">Stump Grinding</Link></li>
              <li><Link href="/hedge-trimming" className="hover:text-neon transition-colors">Hedge Trimming</Link></li>
              <li><Link href="/blog" className="hover:text-neon transition-colors">Tree Care Blog</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4">Contact</h4>
            <ul className="space-y-2.5 text-white/55 text-sm">
              <li><a href={`tel:${PHONE}`} onClick={handlePhoneClick} className="hover:text-neon transition-colors">027 216 6882</a></li>
              <li><a href="mailto:quotes@treemarkables.nz" className="hover:text-neon transition-colors">quotes@treemarkables.nz</a></li>
              <li>Gisborne &amp; surrounds</li>
              <li className="flex items-center gap-1.5 pt-1 text-neon/90"><Clock className="h-3.5 w-3.5" />24/7 emergency</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10 mt-12 pt-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-white/40 text-sm">
          <span>© {new Date().getFullYear()} Treemarkables. All rights reserved.</span>
          <Link href="/privacy-policy" className="hover:text-neon transition-colors">Privacy Policy</Link>
        </div>
      </div>
    </footer>
  );
}
