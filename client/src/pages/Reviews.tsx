import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Star, ThumbsUp, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Reviews() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-blue-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <SidebarTrigger data-testid="button-sidebar-toggle" />
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-gray-900">Customer Reviews</h1>
          <p className="text-sm text-muted-foreground">See what our customers say about us</p>
        </div>
      </div>

      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
        
        {/* Overall Rating Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-orange-500 fill-orange-500" />
              Our Reputation
            </CardTitle>
            <CardDescription>
              Trusted by hundreds of customers across New Zealand
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-4 bg-orange-50 rounded-lg">
                <div className="flex flex-col items-center">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star key={star} className="h-5 w-5 text-orange-500 fill-orange-500" />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">Google Reviews</p>
                </div>
                <div className="flex-1">
                  <p className="text-2xl font-bold">5.0</p>
                  <p className="text-sm text-muted-foreground">Average rating</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open('https://g.page/r/YOUR_GOOGLE_PLACE_ID/review', '_blank')}
                  data-testid="button-write-google-review"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Write Review
                </Button>
              </div>
              
              <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
                <div className="flex flex-col items-center">
                  <ThumbsUp className="h-8 w-8 text-blue-600" />
                  <p className="text-sm text-muted-foreground mt-1">Facebook Reviews</p>
                </div>
                <div className="flex-1">
                  <p className="text-2xl font-bold">Recommended</p>
                  <p className="text-sm text-muted-foreground">By our customers</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open('https://www.facebook.com/YOUR_PAGE/reviews', '_blank')}
                  data-testid="button-write-facebook-review"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Write Review
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Google Reviews Widget */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-orange-500 fill-orange-500" />
              Google Reviews
            </CardTitle>
            <CardDescription>
              See what customers are saying on Google
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* STEP 1: Sign up at elfsight.com/google-reviews-widget/ */}
            {/* STEP 2: Connect your Google Business Profile */}
            {/* STEP 3: Customize the widget design */}
            {/* STEP 4: Copy the embed code and paste it below */}
            
            <div className="bg-muted/50 border-2 border-dashed rounded-lg p-8 text-center">
              <Star className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-semibold mb-2">Google Reviews Widget</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
                To add your Google reviews here:
              </p>
              <ol className="text-sm text-left text-muted-foreground space-y-2 max-w-lg mx-auto mb-4">
                <li>1. Sign up at <a href="https://elfsight.com/google-reviews-widget/" target="_blank" className="text-primary hover:underline">Elfsight</a> or <a href="https://www.trustindex.io/widgets/google-reviews-widget/" target="_blank" className="text-primary hover:underline">Trustindex</a></li>
                <li>2. Connect your Google Business Profile</li>
                <li>3. Customize your widget design</li>
                <li>4. Copy the embed code</li>
                <li>5. Paste it in <code className="bg-muted px-1 py-0.5 rounded">client/src/pages/Reviews.tsx</code> (line 78)</li>
              </ol>
              
              {/* PASTE YOUR GOOGLE REVIEWS EMBED CODE HERE */}
              {/* Example:
              <script src="https://apps.elfsight.com/p/platform.js" defer></script>
              <div className="elfsight-app-xxxxx-xxxx"></div>
              */}
              
              <Button 
                variant="outline" 
                onClick={() => window.open('https://elfsight.com/google-reviews-widget/', '_blank')}
                data-testid="button-setup-google-widget"
              >
                Get Started with Elfsight
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Facebook Reviews Widget */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ThumbsUp className="h-5 w-5 text-blue-600" />
              Facebook Recommendations
            </CardTitle>
            <CardDescription>
              Customer recommendations from Facebook
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* STEP 1: Sign up at elfsight.com/facebook-reviews-widget/ */}
            {/* STEP 2: Connect your Facebook Page */}
            {/* STEP 3: Customize the widget design */}
            {/* STEP 4: Copy the embed code and paste it below */}
            
            <div className="bg-muted/50 border-2 border-dashed rounded-lg p-8 text-center">
              <ThumbsUp className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-semibold mb-2">Facebook Reviews Widget</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
                To add your Facebook reviews here:
              </p>
              <ol className="text-sm text-left text-muted-foreground space-y-2 max-w-lg mx-auto mb-4">
                <li>1. Sign up at <a href="https://elfsight.com/facebook-reviews-widget/" target="_blank" className="text-primary hover:underline">Elfsight</a> or <a href="https://onstipe.com/facebook-reviews-widget/" target="_blank" className="text-primary hover:underline">Onstipe (Free)</a></li>
                <li>2. Connect your Facebook Page</li>
                <li>3. Customize your widget design</li>
                <li>4. Copy the embed code</li>
                <li>5. Paste it in <code className="bg-muted px-1 py-0.5 rounded">client/src/pages/Reviews.tsx</code> (line 112)</li>
              </ol>
              
              {/* PASTE YOUR FACEBOOK REVIEWS EMBED CODE HERE */}
              {/* Example:
              <script src="https://apps.elfsight.com/p/platform.js" defer></script>
              <div className="elfsight-app-xxxxx-xxxx"></div>
              */}
              
              <Button 
                variant="outline" 
                onClick={() => window.open('https://onstipe.com/facebook-reviews-widget/', '_blank')}
                data-testid="button-setup-facebook-widget"
              >
                Get Started with Onstipe (Free)
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Call to Action */}
        <Card className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold mb-2">Love Our Service?</h3>
                <p className="text-orange-100">
                  Share your experience and help others find great tree removal services!
                </p>
              </div>
              <div className="flex gap-3">
                <Button 
                  variant="secondary"
                  onClick={() => window.open('https://g.page/r/YOUR_GOOGLE_PLACE_ID/review', '_blank')}
                  data-testid="button-leave-google-review"
                >
                  Review on Google
                </Button>
                <Button 
                  variant="secondary"
                  onClick={() => window.open('https://www.facebook.com/YOUR_PAGE/reviews', '_blank')}
                  data-testid="button-leave-facebook-review"
                >
                  Review on Facebook
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
