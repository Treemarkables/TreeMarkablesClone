#!/bin/bash
# Run this from inside your treemarkables folder on your Mac
# It fixes all missing @assets/ image imports

cd "$(dirname "$0")" 2>/dev/null || true

echo "Fixing missing image imports..."

python3 - <<'PYEOF'
import re, os

fixes = [
    ("client/src/pages/HedgeTrimming.tsx",
     r'import heroBackground from "@assets/hedge_trimming_hero\.jpg";',
     'const heroBackground = "/hedge-trimming.jpg";'),

    ("client/src/pages/StumpGrinding.tsx",
     r'import heroBackground from "@assets/stump_grinding_hero\.jpg";',
     'const heroBackground = "/stump-grinding.jpg";'),

    ("client/src/pages/TreePruning.tsx",
     r'import heroImage from "@assets/tree_pruning_hero\.jpg";',
     'const heroImage = "/tree-pruning.jpg";'),

    ("client/src/pages/TreeRemoval.tsx",
     r'import heroImage from "@assets/tree_pruning_hero\.jpg";',
     'const heroImage = "/tree-removal-real.png";'),

    ("client/src/pages/TreeRemoval.tsx",
     r'import philosophyVideo from "@assets/tree_philosophy_video\.mov";',
     'const philosophyVideo = "";'),

    ("client/src/pages/SummerOffer.tsx",
     r'import heroBackground from "@assets/[^"]+";',
     'const heroBackground = "/arborist-drone.jpg";'),

    ("client/src/pages/SummerOffer.tsx",
     r'import teamPhoto from "@assets/team-photo\.jpg";',
     'const teamPhoto = "/team-photo.jpg";'),

    ("client/src/components/Header.tsx",
     r'import logoImage from "@assets/[^"]+";',
     'const logoImage = "/treemarkables-logo.png";'),

    ("client/src/pages/ProposalViewer.tsx",
     r'import logoUrl from "@assets/[^"]+";',
     'const logoUrl = "/treemarkables-logo.webp";'),

    ("client/src/pages/QuoteViewer.tsx",
     r'import logoUrl from "@assets/[^"]+";',
     'const logoUrl = "/treemarkables-logo.png";'),

    ("client/src/pages/InvoiceViewer.tsx",
     r'import logoUrl from "@assets/[^"]+";',
     'const logoUrl = "/treemarkables-logo.png";'),

    ("client/src/components/ProposalTemplate.tsx",
     r"import logoUrl from '@assets/[^']+';",
     "const logoUrl = '/treemarkables-logo.webp';"),

    ("client/src/pages/JHAAssessment.tsx",
     r'import jhaHeaderImage from "@assets/[^"]+";',
     'const jhaHeaderImage = "/treemarkables-logo.png";'),
]

for filepath, pattern, replacement in fixes:
    if not os.path.exists(filepath):
        print(f"  SKIP (not found): {filepath}")
        continue
    with open(filepath, "r") as f:
        content = f.read()
    new_content = re.sub(pattern, replacement, content)
    if new_content != content:
        with open(filepath, "w") as f:
            f.write(new_content)
        print(f"  FIXED: {filepath}")
    else:
        print(f"  OK (already fixed): {filepath}")

print("\nAll done!")
PYEOF
