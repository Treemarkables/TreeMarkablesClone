import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

interface FeaturedReview {
  id: string;
  photoUrls?: string[] | null;
}

interface FeaturedReviewsResponse {
  success?: boolean;
  data?: FeaturedReview[];
}

export function ProposalReviewsWidget() {
  const { data } = useQuery<FeaturedReviewsResponse>({
    queryKey: ["/api/reviews/featured"],
    staleTime: 1000 * 60 * 5,
  });

  const images: string[] = (data?.data ?? []).flatMap((r) =>
    Array.isArray(r.photoUrls) ? r.photoUrls : [],
  );

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (index >= images.length && images.length > 0) setIndex(0);
  }, [images.length, index]);

  useEffect(() => {
    if (paused || images.length <= 1) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % images.length), 5000);
    return () => clearInterval(t);
  }, [paused, images.length]);

  if (images.length === 0) return null;

  const url = images[Math.min(index, images.length - 1)];

  return (
    <div
      className="px-6 sm:px-10 py-5 border-t border-gray-100"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      data-testid="proposal-reviews-widget"
    >
      <p className="text-sm font-semibold text-gray-700 text-center mb-3">
        What our customers say
      </p>
      <div className="flex justify-center">
        <img
          src={url}
          alt="Customer review"
          className="max-h-96 w-auto max-w-full object-contain rounded-md border border-gray-200"
          loading="lazy"
        />
      </div>
      {images.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-3">
          {images.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Go to review ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? "w-6 bg-amber-400" : "w-1.5 bg-gray-300"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default ProposalReviewsWidget;
