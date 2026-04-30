import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Review {
  id: string;
  name: string;
  location: string;
  rating: number;
  comment: string;
  service: string;
  source?: string;
  date?: string;
}

interface ApiResponse {
  success: boolean;
  reviews?: Review[];
  message?: string;
}

interface GoogleReviewsGridProps {
  heading?: string;
  ctaLabel?: string;
  onCtaClick?: () => void;
  placeId?: string;
}

const DEFAULT_PLACE_ID = "ChIJyW5ncp55Zm0R3_iU47Axcn8";

function GoogleG({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-label="Google">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[...Array(5)].map((_, i) => (
        <Star
          key={i}
          className={`w-4 h-4 ${i < rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
        />
      ))}
    </div>
  );
}

export default function GoogleReviewsGrid({
  heading = "What Gisborne homeowners say",
  ctaLabel,
  onCtaClick,
  placeId = DEFAULT_PLACE_ID,
}: GoogleReviewsGridProps) {
  const { data, isLoading } = useQuery<ApiResponse>({
    queryKey: ["/api/reviews/google"],
    retry: 1,
    staleTime: 1000 * 60 * 10,
  });

  const reviews = data?.reviews ?? [];
  const avgRating =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 5;
  const reviewsUrl = `https://search.google.com/local/reviews?placeid=${placeId}`;

  return (
    <section className="py-16 bg-muted/30">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
            {heading}
          </h2>

          <div className="inline-flex items-center gap-3 bg-white rounded-2xl px-5 py-3 shadow-sm border border-border">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#f8f9fa]">
              <GoogleG className="w-6 h-6" />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-foreground">
                  {avgRating.toFixed(1)}
                </span>
                <Stars rating={Math.round(avgRating)} />
              </div>
              <p className="text-xs text-muted-foreground">
                {reviews.length > 0
                  ? `${reviews.length} Google review${reviews.length === 1 ? "" : "s"}`
                  : "Google Reviews"}
              </p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center text-muted-foreground py-8">
            Loading reviews…
          </div>
        ) : reviews.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <a
              href={reviewsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:no-underline"
            >
              See our reviews on Google
            </a>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6 mb-10">
            {reviews.map((review) => (
              <div
                key={review.id}
                className="bg-white p-6 rounded-lg shadow-sm border border-border flex flex-col"
                data-testid={`google-review-card-${review.id}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <Stars rating={review.rating} />
                  <GoogleG className="w-5 h-5" />
                </div>
                <p
                  className="text-foreground/80 mb-4 leading-relaxed flex-1"
                  data-testid={`google-review-comment-${review.id}`}
                >
                  {review.comment}
                </p>
                <div className="pt-3 border-t border-border">
                  <h3
                    className="font-semibold text-foreground"
                    data-testid={`google-review-name-${review.id}`}
                  >
                    {review.name}
                  </h3>
                  {review.date && (
                    <p className="text-xs text-muted-foreground">
                      {review.date}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="text-center flex flex-col sm:flex-row gap-3 justify-center items-center">
          <a
            href={reviewsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-foreground hover:text-foreground/80 underline-offset-4 hover:underline"
            data-testid="link-see-all-google-reviews"
          >
            <GoogleG className="w-4 h-4" /> See all reviews on Google
          </a>
          {ctaLabel && onCtaClick && (
            <Button size="lg" onClick={onCtaClick} data-testid="button-reviews-cta">
              {ctaLabel}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
