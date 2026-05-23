// Subscriber-facing help & training hub. Shows a sequenced "Getting started"
// path at the top, then a reference library grouped by category. Clicking an
// article opens it in-place — body HTML is sanitized with DOMPurify, related
// videos render with the same player markup used on the Videos page.
// See INFLOW_HELP_PLAN.md for the design.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import DOMPurify from "dompurify";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen, ChevronRight, ArrowLeft, PlayCircle } from "lucide-react";

type HelpArticleSummary = {
  id: string;
  slug: string;
  title: string;
  category: string;
  sequenceOrder: number | null;
  published: boolean;
};

type HelpVideo = {
  id: string;
  url: string;
  title: string | null;
  thumbnailUrl: string | null;
};

type HelpArticleDetail = HelpArticleSummary & {
  bodyHtml: string;
  relatedVideos?: HelpVideo[];
};

const GETTING_STARTED = "Getting started";

export default function Help() {
  const [openSlug, setOpenSlug] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ["/api/help/articles"],
    queryFn: async () => {
      const r = await fetch("/api/help/articles", { credentials: "include" });
      if (!r.ok) return { success: false, data: [] };
      return r.json();
    },
  });
  const articles: HelpArticleSummary[] = listQuery.data?.data ?? [];

  const detailQuery = useQuery({
    queryKey: ["/api/help/articles", openSlug],
    enabled: !!openSlug,
    queryFn: async () => {
      const r = await fetch(`/api/help/articles/${openSlug}`, { credentials: "include" });
      if (!r.ok) return { success: false, data: null };
      return r.json();
    },
  });
  const detail: HelpArticleDetail | null = detailQuery.data?.data ?? null;

  // Group by category. 'Getting started' first (sequenced), then alpha.
  const byCategory = articles.reduce<Record<string, HelpArticleSummary[]>>((acc, a) => {
    (acc[a.category] ??= []).push(a);
    return acc;
  }, {});
  const otherCategories = Object.keys(byCategory)
    .filter((c) => c !== GETTING_STARTED)
    .sort((a, b) => a.localeCompare(b));

  if (openSlug && detail) {
    return <ArticleView article={detail} onBack={() => setOpenSlug(null)} />;
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <BookOpen className="h-7 w-7 text-foreground" />
        <h1 className="text-2xl font-semibold">Help &amp; Training</h1>
      </div>

      {listQuery.isLoading && (
        <p className="text-muted-foreground">Loading…</p>
      )}

      {!listQuery.isLoading && articles.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No help content has been published yet.
          </CardContent>
        </Card>
      )}

      {byCategory[GETTING_STARTED]?.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Getting started</h2>
          <Card>
            <CardContent className="p-0">
              {byCategory[GETTING_STARTED].map((a, idx) => (
                <ArticleRow
                  key={a.id}
                  article={a}
                  step={idx + 1}
                  onOpen={() => setOpenSlug(a.slug)}
                />
              ))}
            </CardContent>
          </Card>
        </section>
      )}

      {otherCategories.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Reference</h2>
          {otherCategories.map((cat) => (
            <div key={cat} className="mb-4">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">{cat}</h3>
              <Card>
                <CardContent className="p-0">
                  {byCategory[cat].map((a) => (
                    <ArticleRow key={a.id} article={a} onOpen={() => setOpenSlug(a.slug)} />
                  ))}
                </CardContent>
              </Card>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function ArticleRow({
  article,
  step,
  onOpen,
}: {
  article: HelpArticleSummary;
  step?: number;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full flex items-center gap-3 px-4 py-3 text-left border-b border-border last:border-b-0 hover:bg-muted/40"
      data-testid={`help-article-${article.slug}`}
    >
      {step !== undefined && (
        <span className="flex-shrink-0 w-7 h-7 rounded-full bg-foreground text-background text-sm font-medium flex items-center justify-center">
          {step}
        </span>
      )}
      <span className="flex-1">{article.title}</span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}

function ArticleView({
  article,
  onBack,
}: {
  article: HelpArticleDetail;
  onBack: () => void;
}) {
  const safeHtml = DOMPurify.sanitize(article.bodyHtml);
  return (
    <div className="container mx-auto px-4 py-6 max-w-3xl">
      <Button variant="ghost" onClick={onBack} className="mb-4" data-testid="button-help-back">
        <ArrowLeft className="h-4 w-4 mr-2" /> Back to help
      </Button>
      <div className="flex items-center gap-2 mb-2">
        <Badge variant="secondary">{article.category}</Badge>
      </div>
      <h1 className="text-2xl font-semibold mb-6">{article.title}</h1>

      {article.relatedVideos && article.relatedVideos.length > 0 && (
        <div className="space-y-4 mb-6">
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
        dangerouslySetInnerHTML={{ __html: safeHtml }}
      />
    </div>
  );
}
