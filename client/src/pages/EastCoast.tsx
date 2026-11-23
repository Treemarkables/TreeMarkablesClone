import MarketingLanding from "@/components/MarketingLanding";
import { EAST_COAST_PAGE } from "@shared/treemarkablesPageCopy";

export default function EastCoast() {
  return (
    <MarketingLanding
      page={EAST_COAST_PAGE}
      eyebrow="Tairāwhiti East Coast"
      imageAlt="Tree pruning on a coastal Tairāwhiti property"
    />
  );
}