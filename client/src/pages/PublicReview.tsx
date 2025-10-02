import { useState } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Star, CheckCircle2, Loader2 } from "lucide-react";

interface ReviewRequest {
  id: string;
  jobId: string;
  customerId: string;
  jobNumber: string;
  customerName: string;
  status: string;
  token: string;
}

export default function PublicReview() {
  const [, params] = useRoute("/review/:token");
  const token = params?.token;
  
  const [rating, setRating] = useState<number>(0);
  const [hoveredRating, setHoveredRating] = useState<number>(0);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const { data: reviewRequest, isLoading, error } = useQuery<{ data: ReviewRequest }>({
    queryKey: ["/api/reviews/request", token],
    queryFn: async () => {
      const response = await fetch(`/api/reviews/request/${token}`);
      if (!response.ok) {
        throw new Error("Review request not found");
      }
      return response.json();
    },
    enabled: !!token,
  });

  const submitMutation = useMutation({
    mutationFn: async (data: { token: string; rating: number; comment: string }) => {
      return await apiRequest("POST", "/api/reviews/submit", data);
    },
    onSuccess: () => {
      setSubmitted(true);
    },
  });

  const handleSubmit = () => {
    if (!token || rating === 0) return;
    
    submitMutation.mutate({
      token,
      rating,
      comment,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardContent className="py-16 flex flex-col items-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Loading...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !reviewRequest?.data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle className="text-center text-red-600">Invalid Link</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground">
              This review link is invalid or has expired.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Thank You!</h2>
            <p className="text-muted-foreground mb-6">
              Your review has been submitted successfully.
            </p>
            {rating >= 4 && (
              <p className="text-sm text-muted-foreground">
                We'll be posting your review to Google and Facebook shortly.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const request = reviewRequest.data;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-3 sm:p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center pb-4">
          <div className="mb-4">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-3xl">🌲</span>
            </div>
          </div>
          <CardTitle className="text-xl sm:text-2xl mb-2">
            How was our service?
          </CardTitle>
          <CardDescription className="text-sm sm:text-base">
            Hi {request.customerName}! We'd love to hear about your experience with job #{request.jobNumber}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Star Rating */}
          <div className="space-y-3">
            <Label className="text-sm sm:text-base font-medium">Your Rating</Label>
            <div className="flex justify-center gap-2 sm:gap-3">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary rounded-full p-1"
                  data-testid={`star-${star}`}
                >
                  <Star
                    className={`w-8 h-8 sm:w-10 sm:h-10 ${
                      star <= (hoveredRating || rating)
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-gray-300 dark:text-gray-600"
                    }`}
                  />
                </button>
              ))}
            </div>
            {rating > 0 && (
              <p className="text-center text-sm text-muted-foreground">
                {rating === 1 && "We'd like to understand what went wrong"}
                {rating === 2 && "We appreciate your feedback"}
                {rating === 3 && "Thank you for your feedback"}
                {rating === 4 && "Glad you had a good experience!"}
                {rating === 5 && "Wonderful! Thank you so much!"}
              </p>
            )}
          </div>

          {/* Comment */}
          <div className="space-y-2">
            <Label htmlFor="comment" className="text-sm sm:text-base">
              Additional Comments (Optional)
            </Label>
            <Textarea
              id="comment"
              placeholder="Tell us more about your experience..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              className="resize-none text-sm sm:text-base"
              data-testid="input-comment"
            />
          </div>

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            disabled={rating === 0 || submitMutation.isPending}
            className="w-full h-11 text-base"
            data-testid="button-submit-review"
          >
            {submitMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Review"
            )}
          </Button>

          {submitMutation.isError && (
            <p className="text-sm text-red-600 text-center">
              Failed to submit review. Please try again.
            </p>
          )}

          {/* Footer */}
          <div className="pt-4 border-t text-center">
            <p className="text-xs text-muted-foreground">
              Your feedback helps us improve our tree services
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
