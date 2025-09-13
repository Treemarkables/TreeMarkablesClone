import { Card, CardContent } from "@/components/ui/card";
import { Star } from "lucide-react";

interface Review {
  id: string;
  name: string;
  location: string;
  rating: number;
  comment: string;
  service: string;
}

const reviews: Review[] = [
  {
    id: "1",
    name: "Sarah M.",
    location: "Gisborne",
    rating: 5,
    comment: "The Gizzy guys did an amazing job removing a massive pine tree from our backyard. Professional, quick, and cleaned up everything perfectly. Highly recommend!",
    service: "Tree Removal"
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
    service: "Tree Removal"
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

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reviews.map((review) => (
            <Card key={review.id} className="hover-elevate" data-testid={`review-card-${review.id}`}>
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-semibold text-foreground" data-testid={`review-name-${review.id}`}>
                      {review.name}
                    </h3>
                    <p className="text-sm text-muted-foreground" data-testid={`review-location-${review.id}`}>
                      {review.location}
                    </p>
                  </div>
                  <StarRating rating={review.rating} />
                </div>
                
                <p className="text-muted-foreground mb-4 italic" data-testid={`review-comment-${review.id}`}>
                  "{review.comment}"
                </p>
                
                <div className="text-xs text-primary font-medium bg-primary/10 px-2 py-1 rounded-md inline-block" data-testid={`review-service-${review.id}`}>
                  {review.service}
                </div>
              </CardContent>
            </Card>
          ))}
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