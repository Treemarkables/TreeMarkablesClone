/**
 * Titles, descriptions, H1s and FAQ copy for the Treemarkables marketing
 * pages. The server prerender and the React pages both read this so the
 * first HTML byte and the painted page say the same thing.
 *
 * No aggregateRating. "5-star rated" is plain text only.
 * Stump grinder hire is omitted: the stump page says the grinder is not a
 * hire-shop machine.
 */

export interface FaqItem {
  q: string;
  a: string;
}

export interface CopySection {
  heading: string;
  paragraphs: string[];
}

export interface ServiceLink {
  href: string;
  label: string;
}

export interface MarketingPage {
  path: string;
  title: string;
  description: string;
  h1: string;
  lede: string;
  ogImage: string;
  sections?: CopySection[];
  serviceHeading?: string;
  services?: ServiceLink[];
  faqs?: FaqItem[];
  faqHeading?: string;
}

export const SERVICE_LINKS: ServiceLink[] = [
  { href: "/tree-removal", label: "Tree removal" },
  { href: "/tree-pruning", label: "Tree pruning" },
  { href: "/stump-grinding", label: "Stump grinding" },
  { href: "/hedge-trimming", label: "Hedge trimming" },
  { href: "/emergency-tree-removal", label: "Emergency tree removal" },
];

const PHONE = "027 216 6882";

export const GISBORNE_REMOVAL_FAQS: FaqItem[] = [
  {
    q: "Do I need council consent to remove a tree in Gisborne?",
    a: "Check with Gisborne District Council for protected or notable trees before any work is booked. The rules depend on the tree and where it stands. We can help you work out what to ask.",
  },
  {
    q: "How long does tree removal in Gisborne take?",
    a: "It depends on the size of the tree, access, and how close it is to the house, lines or fences. The free on-site quote includes how long we expect to be there.",
  },
  {
    q: "Is cleanup included with tree removal?",
    a: "Yes. Branches and debris are cleared, and the site is raked and blown down before we leave.",
  },
];

export const GISBORNE_PRUNING_FAQS: FaqItem[] = [
  {
    q: "Do I need council consent to prune a tree in Gisborne?",
    a: "Check with Gisborne District Council for protected or notable trees before cutting. If you are unsure, ask us when you book the free assessment.",
  },
  {
    q: "How long does tree pruning in Gisborne take?",
    a: "It depends on the tree and the work: deadwood, crown reduction or shaping. The free assessment includes how long we expect the job to take.",
  },
  {
    q: "Is cleanup included with pruning?",
    a: "Yes. Clippings and green waste are cleared and the site is left tidy.",
  },
];

export const HOME_PAGE: MarketingPage = {
  path: "/",
  title: "Arborist Gisborne | Tree Removal & Pruning | Treemarkables",
  description:
    "5-star rated arborist in Gisborne for tree removal, pruning, stump grinding and hedge trimming. Call 027 216 6882 for a free quote.",
  h1: "Arborist Gisborne",
  lede:
    "Tree care done once, done right. Gisborne's trusted arborists for safe tree removals, expert pruning and tidy clean-ups, backed by 18+ years and 130+ five-star reviews.",
  ogImage: "/team-photo.jpg",
};

export const TREE_REMOVAL_PAGE: MarketingPage = {
  path: "/tree-removal",
  title: "Tree Removal Gisborne | 24/7 Callouts",
  description:
    "Tree removal in Gisborne for homes and farms, including storm damage. 5-star rated, 24/7. Call 027 216 6882 for a free quote.",
  h1: "Tree Removal Gisborne",
  lede:
    "Gisborne's certified arborists for hazardous, storm-damaged and unwanted trees. Fully insured, fast response, and not a branch left behind.",
  ogImage: "/hazardous-tree-removal.jpg",
  faqs: GISBORNE_REMOVAL_FAQS,
  faqHeading: "Gisborne tree removal questions",
};

export const TREE_PRUNING_PAGE: MarketingPage = {
  path: "/tree-pruning",
  title: "Tree Pruning Gisborne | Treemarkables",
  description:
    "Tree pruning in Gisborne: crown reduction, shaping and deadwood by a 5-star rated arborist. Call 027 216 6882 for a free quote.",
  h1: "Tree Pruning Gisborne",
  lede:
    "Expert pruning to keep your trees healthy, safe and beautifully shaped. Qualified arborists across Gisborne and the East Coast.",
  ogImage: "/tree-pruning.jpg",
  faqs: GISBORNE_PRUNING_FAQS,
  faqHeading: "Gisborne tree pruning questions",
};

export const HEDGE_PAGE: MarketingPage = {
  path: "/hedge-trimming",
  title: "Hedge Trimming Gisborne | Treemarkables",
  description:
    "Hedge trimming in Gisborne for homes and coastal properties. 5-star rated. Call 027 216 6882 for a free quote.",
  h1: "Hedge Trimming Gisborne",
  lede:
    "Privacy, windbreaks and clean lines, kept in shape year-round. Gisborne's coastal winds grow hedges fast; we keep them tidy.",
  ogImage: "/hedge-trimming.jpg",
};

export const STUMP_PAGE: MarketingPage = {
  path: "/stump-grinding",
  title: "Stump Grinding & Stump Removal Gisborne",
  description:
    "Stump grinding and stump removal in Gisborne, including tight-access jobs. 5-star rated. Call 027 216 6882 for a free quote.",
  h1: "Stump Grinding & Stump Removal Gisborne",
  lede:
    "Remove unsightly stumps safely and fast. Two grinders: a narrow-access machine for tight spots and the biggest in Gisborne for the heavy stuff.",
  ogImage: "/stump-grinding.jpg",
};

export const SUMMER_PAGE: MarketingPage = {
  path: "/summer-offer",
  title: "Win up to $1000 Back | Gisborne Tree Care",
  description:
    "Book tree care before 30 November for a 1-in-90 chance to win up to $1000 back. Call 027 216 6882 for a free quote.",
  h1: "Win up to $1000 back on your tree care",
  lede:
    "Book any tree care service before 30 November and stand a 1-in-90 chance to win up to $1000 off your job. Our way of saying thanks to our Gisborne community.",
  ogImage: "/team-photo.jpg",
};

export const EMERGENCY_PAGE: MarketingPage = {
  path: "/emergency-tree-removal",
  title: "Emergency Tree Removal Gisborne | 24/7",
  description:
    "Storm damage and fallen trees in Gisborne. 24/7 emergency tree removal. Call 027 216 6882 for a free quote.",
  h1: "Emergency Tree Removal Gisborne",
  lede:
    "A tree on the house, a limb hanging over the drive, or the section blocked after wind. Treemarkables' qualified arborists answer 24/7. Call " +
    PHONE +
    ".",
  ogImage: "/emergency-tree-removal.jpg",
  serviceHeading: "Tree care once the site is safe",
  services: SERVICE_LINKS,
  faqHeading: "Emergency tree removal questions",
  sections: [
    {
      heading: "What to do before we arrive",
      paragraphs: [
        "Keep people and pets clear of the tree, any hanging limb, and anything that looks like a power line.",
        "Do not climb the tree, and do not chainsaw a stem that is under tension or lying on a roof. A failed tree can move when it is cut.",
        "If a line is down, or the tree is sitting in the lines, stay back and call your electricity company as well as us on " + PHONE + ".",
      ],
    },
    {
      heading: "What an emergency visit covers",
      paragraphs: [
        "We take the weight off a roof, open a drive, or dismantle a tree that has come down or is about to. If a standing tree can be made safe by pruning, we say so. Removal is for trees that have failed or cannot be left.",
        "You still get a clear quote before we start. Branches and debris are cleared, and the site is raked and blown down, the same finish as a booked removal. The crew is fully insured.",
        "The yard is 26 Cochrane Street, Gisborne. We cover Gisborne and the wider Tairāwhiti, including storm jobs in Wairoa and along the East Coast.",
      ],
    },
    {
      heading: "A booked removal is a different call",
      paragraphs: [
        "A tree you have been meaning to deal with is a booked visit. We look at access, the house and the lines, then quote.",
        "Use the 24/7 number when something has already failed, or when it is threatening the house, a car, or the way in. We answer day or night.",
      ],
    },
  ],
  faqs: [
    {
      q: "Do you come out at night?",
      a: "Yes. Emergency tree removal is 24/7 across Tairāwhiti. Call 027 216 6882.",
    },
    {
      q: "A branch is hanging over the roof. Should I call?",
      a: "If it could fall on people or the house, call. We would rather assess a failed limb than leave it up.",
    },
    {
      q: "Is cleanup included after a fallen tree?",
      a: "Yes. Branches and debris are cleared, and the site is raked and blown down before we leave.",
    },
    {
      q: "Can pruning make a standing tree safe?",
      a: "Often, if the tree is still sound. If it has split, lifted at the roots, or is too damaged to keep, we remove it and tell you why.",
    },
    {
      q: "Do I need council consent after a storm?",
      a: "Check with Gisborne District Council for protected or notable trees. Tell us if you already know the tree is listed.",
    },
  ],
};

export const WAIROA_PAGE: MarketingPage = {
  path: "/wairoa",
  title: "Arborist Wairoa | Tree Removal & Pruning",
  description:
    "Arborist in Wairoa for tree removal, pruning, stump grinding and hedge trimming. Call 027 216 6882 for a free quote.",
  h1: "Arborist Wairoa",
  lede:
    "Treemarkables is based at 26 Cochrane Street, Gisborne, and travels to Wairoa for homes and farms. Tree removal, pruning, stump grinding and hedge trimming, with a free on-site quote before any work starts.",
  ogImage: "/hazardous-tree-removal.jpg",
  serviceHeading: "Arborist services in Wairoa",
  services: SERVICE_LINKS,
  faqHeading: "Wairoa arborist questions",
  sections: [
    {
      heading: "What to send before we drive up",
      paragraphs: [
        "Send the street address, a photo of the whole tree, and a second photo of whatever it is close to: house, shed, tank, fence or lines.",
        "Say whether you want the stump ground out, and whether the chip can stay on site. That lets us plan the gear for the trip.",
        "The price is set on site, once we can see the access and how the tree leans. Call " +
          PHONE +
          " or use the quote form and include those photos.",
      ],
    },
    {
      heading: "Town sections and farm trees",
      paragraphs: [
        "A tree over a house in Wairoa is usually a climbing and rigging job, so the wood comes down in pieces.",
        "Shelter belts, old gums and paddock trees are often a chipper job, plus the stump grinder if you want the stump gone. Say which it is so the right machine comes up from Gisborne.",
        "When we leave, the site is raked and blown down. Chips from stump grinding can stay as mulch or be taken away.",
      ],
    },
    {
      heading: "Storm damage and protected trees",
      paragraphs: [
        "Fallen trees and hanging limbs are the same 24/7 call as in Gisborne: " + PHONE + ".",
        "If the tree might be protected, check with Wairoa District Council before it is cut. We can help you work out what to ask, and we wait until that is clear.",
      ],
    },
  ],
  faqs: [
    {
      q: "Do you come to Wairoa?",
      a: "Yes. The crew travels from Gisborne for tree removal, pruning, stump grinding and hedge trimming on homes and farms. Call 027 216 6882.",
    },
    {
      q: "Can you price a Wairoa job from photos?",
      a: "Photos and the address let us plan the visit. The quote is confirmed on site, the same as a Gisborne job.",
    },
    {
      q: "Do you grind stumps in Wairoa?",
      a: "Yes, with a removal or on its own. Chips can stay as mulch or be taken away.",
    },
    {
      q: "Who do I ask about a protected tree in Wairoa?",
      a: "Check with Wairoa District Council for protected or notable trees before work is booked.",
    },
  ],
};

export const EAST_COAST_PAGE: MarketingPage = {
  path: "/east-coast",
  title: "East Coast Arborist | Tairāwhiti",
  description:
    "Arborist for the Tairāwhiti East Coast: tree removal, pruning, stump grinding and hedge trimming. Call 027 216 6882 for a free quote.",
  h1: "East Coast Arborist",
  lede:
    "Treemarkables works the Tairāwhiti East Coast from Gisborne. Tree removal, pruning, stump grinding and hedge trimming for homes and farms along the coast.",
  ogImage: "/tree-pruning.jpg",
  serviceHeading: "Tree care along the East Coast",
  services: SERVICE_LINKS,
  faqHeading: "East Coast arborist questions",
  sections: [
    {
      heading: "The Tairāwhiti East Coast",
      paragraphs: [
        "Homes and farms along the Tairāwhiti East Coast are part of the round we do from 26 Cochrane Street, Gisborne.",
        "If you are further up the coast, call " +
          PHONE +
          " and we will tell you whether we can take the job before you wait on a visit.",
        "The crew comes from Gisborne with the gear that the site needs. Tell us where the property is when you ask for a quote.",
      ],
    },
    {
      heading: "Wind, salt and a heavy canopy",
      paragraphs: [
        "Coastal wind is hard on a thick canopy. The same nor'easter that hits Gisborne loads limbs over baches, roofs and driveways up the coast.",
        "Where the tree is sound, pruning is the job: deadwood out, and the crown reduced so there is less sail. We prune to keep the tree. Removal is for trees that are unsafe to leave.",
        "Hedges and shelter belts on exposed sections grow fast and lean. A trim keeps the height and the windbreak.",
      ],
    },
    {
      heading: "Access on a coast property",
      paragraphs: [
        "Many places up the coast are down a long drive, a narrow track, or a gate a large truck will not fit. Tell us about the drive, where a vehicle can turn, and whether there is a bridge or a ford.",
        "Tight access is a normal job. We have a narrow-access stump grinder for gates and side paths, and larger gear when the site is open.",
        "For protected or notable trees along the East Coast, check with Gisborne District Council before any cutting.",
      ],
    },
  ],
  faqs: [
    {
      q: "Do you work the Tairāwhiti East Coast?",
      a: "Yes. Tree removal, pruning, stump grinding and hedge trimming for homes and farms along the coast, travelling from Gisborne. Call 027 216 6882 if you are further north and we will say whether we can come.",
    },
    {
      q: "Can you prune a wind-loaded tree instead of removing it?",
      a: "Yes, when the tree is sound. We take out deadwood and reduce the crown. If it is unsafe to keep, we say so and quote the removal.",
    },
    {
      q: "Will the truck fit down a coast drive?",
      a: "Tell us about gates, the drive and turning space. Tight spots use the narrow-access grinder and climbing gear. Open farm work can take the larger machines.",
    },
    {
      q: "Who do I ask about a protected tree on the East Coast?",
      a: "Check with Gisborne District Council for protected or notable trees on the Tairāwhiti East Coast.",
    },
    {
      q: "Who do I call after a coastal storm?",
      a: "Call 027 216 6882 any time. Emergency tree removal is 24/7.",
    },
  ],
};

export const MARKETING_PAGES: Record<string, MarketingPage> = {
  "/": HOME_PAGE,
  "/tree-removal": TREE_REMOVAL_PAGE,
  "/tree-pruning": TREE_PRUNING_PAGE,
  "/hedge-trimming": HEDGE_PAGE,
  "/stump-grinding": STUMP_PAGE,
  "/summer-offer": SUMMER_PAGE,
  "/emergency-tree-removal": EMERGENCY_PAGE,
  "/wairoa": WAIROA_PAGE,
  "/east-coast": EAST_COAST_PAGE,
};
