import MarketingLanding from "@/components/MarketingLanding";
import { WAIROA_PAGE } from "@shared/treemarkablesPageCopy";

export default function Wairoa() {
  return (
    <MarketingLanding
      page={WAIROA_PAGE}
      eyebrow="Arborist · Wairoa"
      imageAlt="Tree work for homes and farms, travelling from Gisborne to Wairoa"
    />
  );
}
