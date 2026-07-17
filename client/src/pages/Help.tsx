// Subscriber-facing help & training hub. Shows a sequenced "Getting started"
// path at the top, then the how-to video library grouped into category
// sections, then a reference article library grouped the same way. Clicking an
// article opens it in-place — body HTML is sanitized with DOMPurify, related
// videos render with the same player markup used on the Videos page.
// Knowledge videos are global platform content (one library, every tenant).
// See INFLOW_HELP_PLAN.md for the design.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import DOMPurify from "dompurify";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen, ChevronRight, ArrowLeft, PlayCircle } from "lucide-react";
import { helpCategoryRank } from "@/lib/helpCategories";

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

type KnowledgeVideo = HelpVideo & {
  description: string | null;
  category: string | null;
  captionsStatus: string | null;
  sequenceOrder: number | null;
  createdAt: string | null;
};

type HelpArticleDetail = HelpArticleSummary & {
  bodyHtml: string;
  relatedVideos?: HelpVideo[];
};

const GETTING_STARTED = "Getting started";
const UNCATEGORISED = "More videos";

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

  // Global how-to video library (videos.kind='knowledge', same set for every
  // tenant), grouped into category sections below.
  const videosQuery = useQuery({
    queryKey: ["/api/videos", { kind: "knowledge" }],
    queryFn: async () => {
      const r = await fetch("/api/videos?kind=knowledge", { credentials: "include" });
      if (!r.ok) return { success: false, data: [] };
      return r.json();
    },
  });
  const videos: KnowledgeVideo[] = Array.isArray(videosQuery.data?.data)
    ? videosQuery.data.data
    : [];

  // Group videos by category, sections in HELP_CATEGORIES order (unknown
  // categories after, uncategorised last). Within a section: explicit
  // sequenceOrder first, then upload order — so a numbered series plays in
  // the order it was recorded.
  const videosByCategory = videos.reduce<Record<string, KnowledgeVideo[]>>((acc, v) => {
    (acc[v.category || UNCATEGORISED] ??= []).push(v);
    return acc;
  }, {});
  const videoCategories = Object.keys(videosByCategory).sort((a, b) => {
    const rank = helpCategoryRank(a === UNCATEGORISED ? null : a)
      - helpCategoryRank(b === UNCATEGORISED ? null : b);
    return rank !== 0 ? rank : a.localeCompare(b);
  });
  for (const cat of videoCategories) {
    videosByCategory[cat].sort(
      (a, b) =>
        (a.sequenceOrder ?? 0) - (b.sequenceOrder ?? 0) ||
        (a.createdAt ?? "").localeCompare(b.createdAt ?? ""),
    );
  }

  // Group articles by category. 'Getting started' first (sequenced), then alpha.
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

      {(listQuery.isLoading || videosQuery.isLoading) && (
        <p className="text-muted-foreground">Loading…</p>
      )}

      {!listQuery.isLoading &&
        !videosQuery.isLoading &&
        articles.length === 0 &&
        videos.length === 0 && (
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

      {videoCategories.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3">How-to videos</h2>
          {videoCategories.map((cat) => (
            <div key={cat} className="mb-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">{cat}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {videosByCategory[cat].map((v) => (
                  <VideoCard key={v.id} video={v} />
                ))}
              </div>
            </div>
          ))}
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

function VideoCard({ video }: { video: KnowledgeVideo }) {
  return (
    <Card data-testid={`help-video-${video.id}`}>
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-2 text-sm">
          <PlayCircle className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          <span className="font-medium truncate">{video.title || "Video"}</span>
        </div>
        {/* preload="none": the library can hold many videos — the poster frame
            is enough until the user presses play. No captions track here
            (owner call): the auto-generated cues render as one huge block
            covering the video on how-to content, where the narration is the
            point anyway. Job-video players keep theirs. */}
        <video
          src={video.url}
          poster={video.thumbnailUrl ?? undefined}
          controls
          preload="none"
          playsInline
          className="w-full rounded bg-black aspect-video object-contain"
        />
        {video.description && (
          <p className="text-sm text-muted-foreground mt-2">{video.description}</p>
        )}
      </CardContent>
    </Card>
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
