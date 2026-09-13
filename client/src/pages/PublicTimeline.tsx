/**
 * Public job photo timeline — the customer-facing page behind the shareable
 * /timeline/:token link (CompanyCam-style). Read-only, session-less, branded
 * with the tenant's colours. Shows the job's non-private photo entries
 * newest-first; tap a photo to view it full-screen.
 */
import { useState } from "react";
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Loader2, X } from "lucide-react";

interface TimelineEntry {
  id: string;
  caption: string;
  author: string;
  createdAt: string;
  photos: string[];
}

interface TimelinePayload {
  business: { name: string; headerColor: string; accentColor: string };
  job: { jobNumber: number | null; title: string | null };
  entries: TimelineEntry[];
}

function formatEntryDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleDateString("en-NZ", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Pacific/Auckland",
    });
  } catch {
    return "";
  }
}

export default function PublicTimeline() {
  const [, params] = useRoute("/timeline/:token");
  const token = params?.token;
  const [expandedPhoto, setExpandedPhoto] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery<{ data: TimelinePayload }>({
    queryKey: ["/api/public/timeline", token],
    queryFn: async () => {
      const res = await fetch(`/api/public/timeline/${token}`);
      if (!res.ok) throw new Error("Timeline not found");
      return res.json();
    },
    enabled: !!token,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (isError || !data?.data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
        <div className="text-center">
          <h1 className="text-xl font-bold text-gray-900">Timeline not available</h1>
          <p className="text-gray-500 mt-2 text-sm">
            This link may have expired or been turned off.
          </p>
        </div>
      </div>
    );
  }

  const { business, job, entries } = data.data;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Branded header */}
      <header
        className="px-5 py-6"
        style={{ backgroundColor: business.headerColor }}
      >
        <div className="max-w-2xl mx-auto">
          <div
            className="text-xl font-extrabold uppercase tracking-tight"
            style={{ color: business.accentColor }}
          >
            {business.name}
          </div>
          <div className="text-gray-400 text-xs font-semibold uppercase tracking-wider mt-1">
            Job photo timeline
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-lg font-bold text-gray-900">
          {job.title || `Job ${job.jobNumber ?? ""}`}
        </h1>
        <p className="text-sm text-gray-500 mt-0.5 mb-6">
          Live photo updates from our team — newest first.
        </p>

        {entries.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500 text-sm">
            No photos yet — check back once work is underway.
          </div>
        ) : (
          <div className="space-y-6">
            {entries.map((entry) => (
              <section
                key={entry.id}
                className="bg-white border border-gray-200 rounded-xl overflow-hidden"
              >
                <div className="px-4 pt-3 pb-2">
                  <div className="text-xs font-semibold text-gray-400">
                    {formatEntryDate(entry.createdAt)}
                    {entry.author ? ` · ${entry.author}` : ""}
                  </div>
                  {entry.caption && (
                    <p className="text-sm text-gray-800 mt-1">{entry.caption}</p>
                  )}
                </div>
                <div className={entry.photos.length === 1 ? "" : "grid grid-cols-2 gap-0.5"}>
                  {entry.photos.map((url, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setExpandedPhoto(url)}
                      className="block w-full"
                      aria-label="View photo full screen"
                    >
                      <img
                        src={url}
                        alt={entry.caption || "Job photo"}
                        loading="lazy"
                        className={`w-full object-cover ${entry.photos.length === 1 ? "max-h-[420px]" : "h-44"}`}
                      />
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        <footer className="text-center text-xs text-gray-400 py-8">
          Shared by {business.name}
        </footer>
      </main>

      {/* Full-screen photo overlay */}
      {expandedPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setExpandedPhoto(null)}
          role="dialog"
          aria-label="Photo viewer"
        >
          <button
            type="button"
            className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 grid place-items-center"
            onClick={() => setExpandedPhoto(null)}
            aria-label="Close photo"
          >
            <X className="h-5 w-5 text-white" />
          </button>
          <img
            src={expandedPhoto}
            alt="Job photo"
            className="max-w-full max-h-full object-contain"
          />
        </div>
      )}
    </div>
  );
}
