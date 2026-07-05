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
import { Bold, Italic, Heading2, List, ListOrdered, Link as LinkIcon, Trash2, Upload, Plus } from "lucide-react";

const CATEGORIES = [
  "Getting started",
  "Jobs",
  "Quotes & Invoicing",
  "Customers & CRM",
  "Staff & Permissions",
  "Safety",
  "Settings & Billing",
];

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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Help authoring</h1>
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

          {/* Knowledge video upload panel — reuses POST /api/videos */}
          <div className="mt-4">
            <KnowledgeVideoPanel videos={knowledgeVideos} onChange={() => qc.invalidateQueries({ queryKey: ["/api/videos", { kind: "knowledge" }] })} />
          </div>
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

function KnowledgeVideoPanel({
  videos,
  onChange,
}: {
  videos: KnowledgeVideo[];
  onChange: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  async function upload(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("kind", "knowledge");
      if (title.trim()) form.append("title", title.trim());
      form.append("video", file);
      const r = await fetch("/api/videos", { method: "POST", body: form, credentials: "include" });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.message || "Upload failed");
      }
      setTitle("");
      if (fileRef.current) fileRef.current.value = "";
      onChange();
    } catch (e: any) {
      toast({ title: "Video upload failed", description: e?.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-3 space-y-3">
        <div>
          <h3 className="text-sm font-semibold mb-1">Knowledge videos</h3>
          <p className="text-xs text-muted-foreground">
            Upload how-to videos to embed in articles.
          </p>
        </div>
        <div className="space-y-2">
          <Input
            placeholder="Title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            data-testid="input-knowledge-video-title"
          />
          <Input
            ref={fileRef}
            type="file"
            accept="video/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
            }}
            disabled={uploading}
            data-testid="input-knowledge-video-file"
          />
          {uploading && <p className="text-xs text-muted-foreground">Uploading…</p>}
        </div>
        <div className="text-xs text-muted-foreground">
          {videos.length} video{videos.length === 1 ? "" : "s"} uploaded
        </div>
      </CardContent>
    </Card>
  );
}
