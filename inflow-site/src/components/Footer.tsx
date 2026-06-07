import { Link } from "wouter";
import Wordmark from "./Wordmark";
import { Container } from "./Container";
import { BRAND, NAV } from "@/lib/brand";

export default function Footer() {
  return (
    <footer className="bg-ink-900 text-paper">
      <Container className="py-16 md:py-20">
        <div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Wordmark variant="dark" />
            <p className="mt-4 max-w-xs text-sm text-ink-300 leading-relaxed">
              {BRAND.tagline}
            </p>
            <p className="mt-6 text-xs text-ink-400">
              Built in Gisborne, New Zealand.
            </p>
          </div>

          <FooterCol title="Product">
            {NAV.slice(1, 3).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-ink-300 hover:text-paper transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </FooterCol>

          <FooterCol title="Company">
            <Link href="/about" className="text-ink-300 hover:text-paper">
              About
            </Link>
            <Link href="/contact" className="text-ink-300 hover:text-paper">
              Contact
            </Link>
          </FooterCol>

          <FooterCol title="Get in touch">
            <Link href="/support" className="text-ink-300 hover:text-paper">
              Support
            </Link>
            <a
              href={`mailto:${BRAND.contactEmail}`}
              className="text-ink-300 hover:text-paper"
            >
              {BRAND.contactEmail}
            </a>
          </FooterCol>
        </div>

        <div className="mt-16 pt-8 border-t border-ink-800 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <p className="text-xs text-ink-400">
            © {new Date().getFullYear()} Inflow. All rights reserved.
          </p>
          <div className="flex gap-6 text-xs text-ink-400">
            <Link href="/privacy" className="hover:text-paper">Privacy</Link>
            <Link href="/terms" className="hover:text-paper">Terms</Link>
            <Link href="/support" className="hover:text-paper">Support</Link>
          </div>
        </div>
      </Container>
    </footer>
  );
}

function FooterCol({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h4 className="text-xs font-medium uppercase tracking-[0.18em] text-ink-400 mb-4">
        {title}
      </h4>
      <div className="flex flex-col gap-2.5 text-sm">{children}</div>
    </div>
  );
}
