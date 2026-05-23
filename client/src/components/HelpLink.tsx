// Contextual help icon. Renders a small `?` button next to any UI element;
// clicking opens a side drawer with the linked help article inline (sanitized
// HTML + embedded knowledge videos) so the user never leaves their current page.
//
// The icon ONLY renders if the linked article exists AND is published — this
// way a `<HelpLink slug="x" />` baked into a page never shows a dead "?" if
// the article hasn't been authored yet.
//
// Drop it next to any section header:
//   <Label>Company Logo <HelpLink slug="upload-your-logo" /></Label>
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import DOMPurify from "dompurify";
import { HelpCircle, PlayCircle } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type HelpVideo = {
  id: string;
  url: string;
  title: string | null;
  thumbnailUrl: string | null;
};

type HelpArticle = {
  id: string;
  slug: string;
  title: string;
  category: string;
  bodyHtml: string;
  published: boolean;
  relatedVideos?: HelpVideo[];
};

export function HelpLink({
  slug,
  label,
}: {
  slug: string;
  /** Optional accessible label, e.g. "Help for company logo". Defaults to "Help: <article title>" once loaded. */
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  // Cheap existence check — only fetches when the article isn't already cached.
  // staleTime is generous since published articles change rarely.
  const probe = useQuery({
    queryKey: ["/api/help/articles", slug],
    queryFn: async () => {
      const r = await fetch(`/api/help/articles/${slug}`, { credentials: "include" });
      if (!r.ok) return { success: false, data: null };
      return r.json();
    },
    staleTime: 5 * 60 * 1000,
  });
  const article: HelpArticle | null = probe.data?.data ?? null;

  // Don't render anything if the article is missing or unpublished.
  // This is the "no dead icons" guarantee.
  if (!article || !article.published) return null;

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className="inline-flex items-center justify-center w-5 h-5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        aria-label={label || `Help: ${article.title}`}
        data-testid={`help-link-${slug}`}
      >
        <HelpCircle className="w-4 h-4" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="text-left">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="secondary">{article.category}</Badge>
            </div>
            <SheetTitle>{article.title}</SheetTitle>
          </SheetHeader>

          <div className="mt-4 space-y-4">
            {article.relatedVideos && article.relatedVideos.length > 0 && (
              <div className="space-y-3">
                {article.relatedVideos.map((v) => (
                  <Card key={v.id}>
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
                        <PlayCircle className="h-4 w-4" />
                        <span>{v.title || "Video"}</span>
                      </div>
                      <video
                        src={v.url}
                        controls
                        playsInline
                        poster={v.thumbnailUrl ?? undefined}
                        className="w-full rounded"
                      />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <article
              className="prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(article.bodyHtml) }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
