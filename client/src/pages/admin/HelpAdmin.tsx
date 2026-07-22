// Owner-only authoring UI for help articles.
// - TipTap (StarterKit) WYSIWYG → HTML stored in helpArticles.bodyHtml
// - Knowledge video upload reuses POST /api/videos?kind=knowledge
// - Articles can be linked to one or more knowledge videos via relatedVideoIds
// See INFLOW_HELP_PLAN.md §2.3.
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useAuth } from "@/contexts/AuthContext";
import { Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bold, Italic, Heading2, List, ListOrdered, Link as LinkIcon, Trash2, Upload, Plus, Pencil } from "lucide-react";
import { HELP_CATEGORIES as CATEGORIES, helpCategoryRank } from "@/lib/helpCategories";

type HelpArticle = {
  id: string;
  slug: string;
  title: string;
  category: string;
  bodyHtml: string;
  sequenceOrder: number | null;
  relatedVideoIds: string[] | null;
  published: boolean;
};

type KnowledgeVideo = {
  id: string;
  title: string | null;
  url: string;
  filename: string;
  category: string | null;
  thumbnailUrl: string | null;
  sequenceOrder: number | null;
  createdAt: string | null;
};

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export default function HelpAdmin() {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Redirect to="/help" />;
  return <HelpAdminInner />;
}

function HelpAdminInner() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Pull all articles (drafts + published) for the admin view.
  const articlesQuery = useQuery({
    queryKey: ["/api/help/articles", { admin: true }],
    queryFn: async () => {
      const r = await fetch("/api/help/articles?includeUnpublished=true", {
        credentials: "include",
      });
      return r.json();
    },
  });
  const articles: HelpArticle[] = articlesQuery.data?.data ?? [];

  const videosQuery = useQuery({
    queryKey: ["/api/videos", { kind: "knowledge" }],
    queryFn: async () => {
      const r = await fetch("/api/videos?kind=knowledge", { credentials: "include" });
      return r.json();
    },
  });
  const knowledgeVideos: KnowledgeVideo[] = videosQuery.data?.data ?? [];

  const selected = articles.find((a) => a.id === selectedId) ?? null;

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <Tabs defaultValue="articles">
        <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
          <h1 className="text-2xl font-semibold">Help authoring</h1>
          <TabsList data-testid="tabs-help-admin">
            <TabsTrigger value="articles">Articles</TabsTrigger>
            <TabsTrigger value="videos">
              How-to videos{knowledgeVideos.length > 0 ? ` (${knowledgeVideos.length})` : ""}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="articles">
          <div className="flex justify-end mb-4">
            <Button
              onClick={() => setSelectedId("__new__")}
              data-testid="button-new-article"
            >
              <Plus className="h-4 w-4 mr-2" /> New article
            </Button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
            {/* Article list */}
            <div>
              <Card>
                <CardContent className="p-0">
                  {articlesQuery.isLoading && (
                    <div className="p-4 text-sm text-muted-foreground">Loading…</div>
                  )}
                  {!articlesQuery.isLoading && articles.length === 0 && (
                    <div className="p-4 text-sm text-muted-foreground">
                      No articles yet — click "New article" to start.
                    </div>
                  )}
                  {articles.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setSelectedId(a.id)}
                      className={`w-full text-left px-4 py-3 border-b border-border last:border-b-0 hover:bg-muted/40 ${
                        selectedId === a.id ? "bg-muted/60" : ""
                      }`}
                      data-testid={`admin-help-row-${a.slug}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium truncate">{a.title}</span>
                        {!a.published && (
                          <Badge variant="outline" className="text-xs">Draft</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">{a.category}</div>
                    </button>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Editor */}
            <div>
              {!selected && selectedId !== "__new__" && (
                <Card>
                  <CardContent className="py-10 text-center text-muted-foreground">
                    Select an article on the left, or click "New article".
                  </CardContent>
                </Card>
              )}
              {(selected || selectedId === "__new__") && (
                <ArticleEditor
                  key={selected?.id ?? "__new__"}
                  article={selected}
                  knowledgeVideos={knowledgeVideos}
                  onSaved={(saved) => {
                    qc.invalidateQueries({ queryKey: ["/api/help/articles"] });
                    setSelectedId(saved.id);
                  }}
                  onDeleted={() => {
                    qc.invalidateQueries({ queryKey: ["/api/help/articles"] });
                    setSelectedId(null);
                  }}
                  onError={(msg) =>
                    toast({ title: "Save failed", description: msg, variant: "destructive" })
                  }
                />
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="videos">
          <VideoLibrary
            videos={knowledgeVideos}
            loading={videosQuery.isLoading}
            onChange={() => qc.invalidateQueries({ queryKey: ["/api/videos", { kind: "knowledge" }] })}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ArticleEditor({
  article,
  knowledgeVideos,
  onSaved,
  onDeleted,
  onError,
}: {
  article: HelpArticle | null;
  knowledgeVideos: KnowledgeVideo[];
  onSaved: (a: HelpArticle) => void;
  onDeleted: () => void;
  onError: (msg: string) => void;
}) {
  const isNew = !article;
  const [title, setTitle] = useState(article?.title ?? "");
  const [slug, setSlug] = useState(article?.slug ?? "");
  const [slugDirty, setSlugDirty] = useState(!!article);
  const [category, setCategory] = useState(article?.category ?? CATEGORIES[0]);
  const [sequenceOrder, setSequenceOrder] = useState<number>(article?.sequenceOrder ?? 0);
  const [published, setPublished] = useState(article?.published ?? false);
  const [relatedVideoIds, setRelatedVideoIds] = useState<string[]>(article?.relatedVideoIds ?? []);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Write the SOP body here…" }),
    ],
    content: article?.bodyHtml ?? "",
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none dark:prose-invert min-h-[280px] focus:outline-none px-3 py-2",
      },
    },
  });

  // Auto-derive slug from title until the author touches the slug field.
  useEffect(() => {
    if (!slugDirty) setSlug(slugify(title));
  }, [title, slugDirty]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        title: title.trim(),
        slug: slug.trim() || slugify(title),
        category,
        bodyHtml: editor?.getHTML() ?? "",
        sequenceOrder: category === "Getting started" ? sequenceOrder : 0,
        relatedVideoIds: relatedVideoIds.length ? relatedVideoIds : null,
        published,
      };
      const url = isNew ? "/api/help/articles" : `/api/help/articles/${article!.id}`;
      const method = isNew ? "POST" : "PATCH";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok || !data.success) throw new Error(data.message || "Save failed");
      return data.data as HelpArticle;
    },
    onSuccess: onSaved,
    onError: (e: any) => onError(e?.message ?? "Save failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!article) return;
      const r = await fetch(`/api/help/articles/${article.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) throw new Error("Delete failed");
    },
    onSuccess: onDeleted,
    onError: (e: any) => onError(e?.message ?? "Delete failed"),
  });

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div>
          <Label htmlFor="article-title">Title</Label>
          <Input
            id="article-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Set up your business details"
            data-testid="input-article-title"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="article-slug">URL slug</Label>
            <Input
              id="article-slug"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugDirty(true);
              }}
              placeholder="set-up-your-business-details"
              data-testid="input-article-slug"
            />
          </div>
          <div>
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger data-testid="select-article-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {category === "Getting started" && (
          <div>
            <Label htmlFor="article-order">Step number (1 = first)</Label>
            <Input
              id="article-order"
              type="number"
              min={0}
              value={sequenceOrder}
              onChange={(e) => setSequenceOrder(Number(e.target.value) || 0)}
              data-testid="input-article-order"
            />
          </div>
        )}

        <div>
          <Label>Body</Label>
          <div className="border border-border rounded-md">
            <EditorToolbar editor={editor} />
            <EditorContent editor={editor} />
          </div>
        </div>

        <div>
          <Label>Related videos</Label>
          {knowledgeVideos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No knowledge videos uploaded yet. Use the panel on the left to upload one.
            </p>
          ) : (
            <div className="space-y-1 max-h-40 overflow-y-auto border border-border rounded-md p-2">
              {knowledgeVideos.map((v) => (
                <label key={v.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={relatedVideoIds.includes(v.id)}
                    onChange={(e) => {
                      setRelatedVideoIds((prev) =>
                        e.target.checked
                          ? [...prev, v.id]
                          : prev.filter((x) => x !== v.id),
                      );
                    }}
                    data-testid={`checkbox-video-${v.id}`}
                  />
                  <span className="truncate">{v.title || v.filename}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Switch
            checked={published}
            onCheckedChange={setPublished}
            id="article-published"
            data-testid="switch-article-published"
          />
          <Label htmlFor="article-published">Published (visible to subscribers)</Label>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div>
            {!isNew && (
              <Button
                variant="ghost"
                onClick={() => {
                  if (confirm("Delete this article?")) deleteMutation.mutate();
                }}
                data-testid="button-delete-article"
              >
                <Trash2 className="h-4 w-4 mr-2" /> Delete
              </Button>
            )}
          </div>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !title.trim()}
            data-testid="button-save-article"
          >
            {saveMutation.isPending ? "Saving…" : isNew ? "Create" : "Save"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function EditorToolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null;
  const btn = "p-1.5 rounded hover:bg-muted text-sm";
  return (
    <div className="flex items-center gap-1 border-b border-border px-2 py-1">
      <button type="button" className={btn} onClick={() => editor.chain().focus().toggleBold().run()} data-testid="editor-bold">
        <Bold className="h-4 w-4" />
      </button>
      <button type="button" className={btn} onClick={() => editor.chain().focus().toggleItalic().run()} data-testid="editor-italic">
        <Italic className="h-4 w-4" />
      </button>
      <button type="button" className={btn} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} data-testid="editor-h2">
        <Heading2 className="h-4 w-4" />
      </button>
      <button type="button" className={btn} onClick={() => editor.chain().focus().toggleBulletList().run()} data-testid="editor-ul">
        <List className="h-4 w-4" />
      </button>
      <button type="button" className={btn} onClick={() => editor.chain().focus().toggleOrderedList().run()} data-testid="editor-ol">
        <ListOrdered className="h-4 w-4" />
      </button>
      <button
        type="button"
        className={btn}
        data-testid="editor-link"
        onClick={() => {
          const url = prompt("Enter URL");
          if (!url) return;
          editor.chain().focus().extendMarkRange("link" as any).setMark("link" as any, { href: url }).run();
        }}
      >
        <LinkIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

const UNCATEGORISED = "No section yet";

// Full-width how-to video library: an upload row on top, then the published
// videos as thumbnail cards grouped into the same sections subscribers see
// on /help. Rename, re-file, and delete happen on the card.
function VideoLibrary({
  videos,
  loading,
  onChange,
}: {
  videos: KnowledgeVideo[];
  loading: boolean;
  onChange: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  async function upload(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("kind", "knowledge");
      form.append("category", category);
      if (title.trim()) form.append("title", title.trim());
      form.append("video", file);
      const r = await fetch("/api/videos", { method: "POST", body: form, credentials: "include" });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.message || "Upload failed");
      }
      setTitle("");
      onChange();
      // Success feedback is deliberate on this panel (owner request) — the
      // list refresh alone is too subtle to confirm a publish that every
      // subscriber sees instantly.
      toast({
        title: "Video published",
        description: `"${title.trim() || file.name}" is live in ${category} on every subscriber's Help page.`,
      });
    } catch (e: any) {
      toast({ title: "Video upload failed", description: e?.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function patchVideo(id: string, body: Record<string, unknown>): Promise<boolean> {
    const r = await fetch(`/api/videos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    return r.ok;
  }

  async function setVideoCategory(id: string, newCategory: string) {
    if (!(await patchVideo(id, { category: newCategory }))) {
      toast({ title: "Couldn't update section", variant: "destructive" });
      return;
    }
    onChange();
    toast({ title: "Section updated", description: `Moved to ${newCategory}.` });
  }

  async function setVideoTitle(id: string, newTitle: string) {
    if (!(await patchVideo(id, { title: newTitle }))) {
      toast({ title: "Couldn't rename video", variant: "destructive" });
      return;
    }
    onChange();
    toast({
      title: "Video renamed",
      description: newTitle ? `Now showing as "${newTitle}".` : "Title cleared.",
    });
  }

  async function deleteVideo(id: string) {
    const r = await fetch(`/api/videos/${id}`, { method: "DELETE", credentials: "include" });
    if (!r.ok) {
      toast({ title: "Couldn't delete video", variant: "destructive" });
      return;
    }
    onChange();
    toast({ title: "Video deleted", description: "Removed from every subscriber's Help page." });
  }

  // Same grouping/order the subscriber /help page uses, so the admin view
  // mirrors what subscribers actually see: sections in HELP_CATEGORIES order,
  // uncategorised last; within a section sequenceOrder then upload order.
  const byCategory = videos.reduce<Record<string, KnowledgeVideo[]>>((acc, v) => {
    (acc[v.category || UNCATEGORISED] ??= []).push(v);
    return acc;
  }, {});
  const sections = Object.keys(byCategory).sort((a, b) => {
    const rank = helpCategoryRank(a === UNCATEGORISED ? null : a)
      - helpCategoryRank(b === UNCATEGORISED ? null : b);
    return rank !== 0 ? rank : a.localeCompare(b);
  });
  for (const cat of sections) {
    byCategory[cat].sort(
      (a, b) =>
        (a.sequenceOrder ?? 0) - (b.sequenceOrder ?? 0) ||
        (a.createdAt ?? "").localeCompare(b.createdAt ?? ""),
    );
  }

  return (
    <div className="space-y-6">
      {/* Upload row */}
      <div className="border border-dashed border-border rounded-lg p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <Upload className="h-5 w-5 text-muted-foreground flex-shrink-0 hidden sm:block" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Upload a video</p>
          <p className="text-xs text-muted-foreground">
            Give it a title and section first — it goes live for every subscriber the moment it uploads.
          </p>
        </div>
        <Input
          placeholder="Send a quote"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="sm:w-48"
          data-testid="input-knowledge-video-title"
        />
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="sm:w-48" data-testid="select-knowledge-video-category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input
          ref={fileRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
          }}
          data-testid="input-knowledge-video-file"
        />
        <Button
          variant="outline"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          data-testid="button-choose-video-file"
        >
          {uploading ? "Uploading…" : "Choose file"}
        </Button>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {!loading && videos.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No how-to videos yet — upload the first one above.
          </CardContent>
        </Card>
      )}

      {sections.map((cat) => (
        <div key={cat}>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">{cat}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {byCategory[cat].map((v) => (
              <AdminVideoCard
                key={v.id}
                video={v}
                onRename={(t) => setVideoTitle(v.id, t)}
                onRecategorise={(c) => setVideoCategory(v.id, c)}
                onDelete={() => {
                  if (confirm("Delete this video for all subscribers?")) deleteVideo(v.id);
                }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function AdminVideoCard({
  video,
  onRename,
  onRecategorise,
  onDelete,
}: {
  video: KnowledgeVideo;
  onRename: (title: string) => void;
  onRecategorise: (category: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <Card className="overflow-hidden" data-testid={`admin-knowledge-video-${video.id}`}>
      {/* Playable preview — same markup as the subscriber page, so you can
          watch a video to tell duplicates apart before deleting one. */}
      <video
        src={video.url}
        poster={video.thumbnailUrl ?? undefined}
        controls
        preload="none"
        playsInline
        className="w-full bg-black aspect-video object-contain"
      />
      <CardContent className="p-3 space-y-2">
        {editing ? (
          <Input
            autoFocus
            defaultValue={video.title ?? ""}
            placeholder="Video title"
            className="h-8 text-sm"
            onBlur={(e) => {
              setEditing(false);
              const next = e.target.value.trim();
              if (next !== (video.title ?? "")) onRename(next);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") {
                (e.target as HTMLInputElement).value = video.title ?? "";
                (e.target as HTMLInputElement).blur();
              }
            }}
            data-testid={`input-video-title-${video.id}`}
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="w-full flex items-center gap-2 text-left group min-w-0"
            data-testid={`button-edit-video-title-${video.id}`}
          >
            {video.title ? (
              <span className="text-sm font-medium truncate flex-1">{video.title}</span>
            ) : (
              <span className="flex items-center gap-2 flex-1 min-w-0">
                <Badge variant="outline" className="text-xs flex-shrink-0">Untitled</Badge>
                <span className="text-xs text-muted-foreground truncate">
                  shows as "Video" to subscribers
                </span>
              </span>
            )}
            <Pencil className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 opacity-0 group-hover:opacity-100" />
          </button>
        )}

        <div className="flex items-center gap-2">
          <Select value={video.category ?? ""} onValueChange={onRecategorise}>
            <SelectTrigger className="h-8 text-xs flex-1" data-testid={`select-video-category-${video.id}`}>
              <SelectValue placeholder="No section — pick one" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 flex-shrink-0 text-muted-foreground"
            onClick={onDelete}
            data-testid={`button-delete-video-${video.id}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
