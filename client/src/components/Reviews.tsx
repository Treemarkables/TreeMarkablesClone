import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, ChevronLeft, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";

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

const reviews: Review[] = [
  {
    id: "1",
    name: "Sarah M.",
    location: "Gisborne",
    rating: 5,
    comment: "The Gizzy guys did an amazing job removing a massive pine tree from our backyard. Professional, quick, and cleaned up everything perfectly. Highly recommend!",
    service: "Tree Care"
  },
  {
    id: "2",
    name: "Mike P.",
    location: "Makaraka",
    rating: 5,
    comment: "Brilliant service! Called them for an emergency tree removal after a storm and they were out the same day. The team was friendly and knew exactly what they were doing.",
    service: "Emergency Service"
  },
  {
    id: "3",
    name: "Jenny L.",
    location: "Kaiti",
    rating: 5,
    comment: "Had my hedge trimmed and some pruning done. The difference is incredible! My garden looks fantastic now. Great value for money too.",
    service: "Hedge Trimming"
  },
  {
    id: "4",
    name: "Dave R.",
    location: "Te Hapara",
    rating: 5,
    comment: "Top notch stump grinding service. They made quick work of three old stumps that had been bothering me for years. Clean job, fair price.",
    service: "Stump Grinding"
  },
  {
    id: "5",
    name: "Lisa K.",
    location: "Elgin",
    rating: 5,
    comment: "These guys are legends! Friendly, reliable, and really know their stuff. Wouldn't use anyone else for tree work around Gizzy.",
    service: "Tree Pruning"
  },
  {
    id: "6",
    name: "Tom H.",
    location: "Wainui",
    rating: 5,
    comment: "Called for a free quote and they came out the same week. Fair pricing, excellent work, and they left the place spotless. Can't ask for more!",
    service: "Tree Care"
  }
];

const StarRating = ({ rating }: { rating: number }) => {
  return (
    <div className="flex gap-1">
      {[...Array(5)].map((_, i) => (
        <Star
          key={i}
          className={`w-4 h-4 ${
            i < rating ? 'fill-primary text-primary' : 'text-muted-foreground'
          }`}
        />
      ))}
    </div>
  );
};

export default function Reviews() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // Fetch Facebook reviews
  const { data: facebookReviews, isLoading: fbLoading } = useQuery<ApiResponse>({
    queryKey: ['/api/reviews/facebook'],
    retry: 1,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });

  // Fetch Google reviews
  const { data: googleReviews, isLoading: googleLoading } = useQuery<ApiResponse>({
    queryKey: ['/api/reviews/google'],
    retry: 1,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });

  const isLoading = fbLoading || googleLoading;

  // Combine Facebook and Google reviews, fallback to static reviews
  let displayReviews = reviews; // Default to local testimonials
  
  const allApiReviews: Review[] = [];
  
  // Add Facebook reviews if available
  if (facebookReviews?.reviews && facebookReviews.reviews.length > 0) {
    allApiReviews.push(...facebookReviews.reviews);
  }
  
  // Add Google reviews if available
  if (googleReviews?.reviews && googleReviews.reviews.length > 0) {
    allApiReviews.push(...googleReviews.reviews);
  }
  
  // Use API reviews if any are available, otherwise use local testimonials
  if (allApiReviews.length > 0) {
    displayReviews = allApiReviews;
  }

  // Safely clamp current index for rendering
  const safeIndex = Math.min(currentIndex, Math.max(0, displayReviews.length - 1));
  
  // Reset currentIndex when review count changes
  useEffect(() => {
    if (currentIndex >= displayReviews.length && displayReviews.length > 0) {
      setCurrentIndex(0);
    }
  }, [displayReviews.length, currentIndex]);

  // Auto-rotation timer
  useEffect(() => {
    if (isPaused || displayReviews.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % displayReviews.length);
    }, 5000); // Rotate every 5 seconds

    return () => clearInterval(timer);
  }, [isPaused, displayReviews.length]);

  const goToNext = () => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % displayReviews.length);
  };

  const goToPrevious = () => {
    setCurrentIndex((prevIndex) => 
      prevIndex === 0 ? displayReviews.length - 1 : prevIndex - 1
    );
  };

  // Minimum swipe distance (in pixels) to trigger navigation
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
    setIsPaused(true); // Pause auto-rotation during touch
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    // Always resume auto-rotation, even if no swipe detected
    setIsPaused(false);
    
    if (touchStart === null || touchEnd === null) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe) {
      goToNext();
    } else if (isRightSwipe) {
      goToPrevious();
    }
  };

  const onTouchCancel = () => {
    // Resume auto-rotation if touch is cancelled
    setIsPaused(false);
  };

  return (
    <section className="py-16 bg-muted/30">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            What our Gizzy customers say
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Don't just take our word for it - hear from local customers who've experienced our top-quality tree services
          </p>
        </div>

        {isLoading && (
          <div className="text-center text-muted-foreground">
            Loading customer reviews...
          </div>
        )}

        {allApiReviews.length === 0 && !isLoading && (
          <div className="text-center text-muted-foreground mb-8">
            <p>Showing local Gisborne testimonials</p>
          </div>
        )}

        <div className="relative max-w-4xl mx-auto">
          {/* Current Review Card with smooth transition */}
          <div 
            className="transition-opacity duration-500"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onTouchCancel={onTouchCancel}
          >
            {displayReviews.length > 0 && (
              <Card className="hover-elevate" data-testid={`review-card-${displayReviews[safeIndex].id}`}>
                <CardContent className="p-8 md:p-12">
                  <div className="flex flex-col items-center text-center">
                    <StarRating rating={displayReviews[safeIndex].rating} />
                    
                    <p className="text-lg md:text-xl text-muted-foreground my-6 italic leading-relaxed" data-testid={`review-comment-${displayReviews[safeIndex].id}`}>
                      "{displayReviews[safeIndex].comment}"
                    </p>
                    
                    <div className="space-y-2">
                      <h3 className="font-semibold text-lg text-foreground" data-testid={`review-name-${displayReviews[safeIndex].id}`}>
                        {displayReviews[safeIndex].name}
                      </h3>
                      <p className="text-sm text-muted-foreground" data-testid={`review-location-${displayReviews[safeIndex].id}`}>
                        {displayReviews[safeIndex].location}
                      </p>
                      <div className="text-xs text-primary font-medium bg-primary/10 px-3 py-1 rounded-md inline-block" data-testid={`review-service-${displayReviews[safeIndex].id}`}>
                        {displayReviews[safeIndex].service}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Navigation Controls */}
          {displayReviews.length > 1 && (
            <>
              <Button
                variant="outline"
                size="icon"
                onClick={goToPrevious}
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 md:-translate-x-12 min-h-[44px] min-w-[44px]"
                data-testid="button-review-previous"
                aria-label="Previous review"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              
              <Button
                variant="outline"
                size="icon"
                onClick={goToNext}
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 md:translate-x-12 min-h-[44px] min-w-[44px]"
                data-testid="button-review-next"
                aria-label="Next review"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>

              {/* Pagination Dots */}
              <div className="flex justify-center gap-2 mt-6">
                {displayReviews.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentIndex(index)}
                    className={`h-2 rounded-full transition-all ${
                      index === safeIndex 
                        ? 'w-8 bg-primary' 
                        : 'w-2 bg-muted-foreground/30 hover-elevate'
                    }`}
                    data-testid={`button-review-dot-${index}`}
                    aria-label={`Go to review ${index + 1}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        <div className="text-center mt-12">
          <p className="text-muted-foreground">
            Join hundreds of satisfied customers across the Gisborne region
          </p>
        </div>
      </div>
    </section>
  );
}