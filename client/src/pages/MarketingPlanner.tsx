import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Calendar, DollarSign, Facebook, Instagram, Megaphone, Plus, Share2, Star, TrendingUp, Eye, MousePointer, Users, Heart } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface MarketingCampaign {
  id: string;
  name: string;
  type: 'ad' | 'review_post';
  platform: 'facebook' | 'instagram' | 'both';
  status: 'draft' | 'scheduled' | 'published' | 'failed';
  scheduledFor: string | null;
  publishedAt: string | null;
  objective: string | null;
  budget: string | null;
  budgetType: string | null;
  adCreative: any;
  targeting: any;
  reviewId: string | null;
  reviewText: string | null;
  reviewAuthor: string | null;
  reviewRating: number | null;
  reviewSource: string | null;
  metaCampaignId: string | null;
  metaPostId: string | null;
  reach: number;
  impressions: number;
  clicks: number;
  engagement: number;
  spent: string;
  conversions: number;
  createdAt: string;
}

const adCampaignSchema = z.object({
  name: z.string().min(1, "Campaign name is required"),
  platform: z.enum(['facebook', 'instagram', 'both']),
  objective: z.enum(['awareness', 'traffic', 'engagement', 'leads', 'sales']),
  budget: z.string().min(1, "Budget is required"),
  budgetType: z.enum(['daily', 'lifetime']),
  headline: z.string().min(1, "Headline is required"),
  text: z.string().min(1, "Ad text is required"),
  imageUrl: z.string().url("Valid image URL is required"),
  ctaText: z.string().min(1, "Call-to-action is required"),
  ctaUrl: z.string().url("Valid URL is required"),
  scheduledFor: z.string().optional(),
});

const reviewPostSchema = z.object({
  name: z.string().min(1, "Campaign name is required"),
  platform: z.enum(['facebook', 'instagram', 'both']),
  reviewText: z.string().min(1, "Review text is required"),
  reviewAuthor: z.string().min(1, "Review author is required"),
  reviewRating: z.number().min(1).max(5),
  reviewSource: z.enum(['google', 'facebook']),
  scheduledFor: z.string().optional(),
});

export default function MarketingPlanner() {
  const { toast } = useToast();
  const [showAdDialog, setShowAdDialog] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<MarketingCampaign | null>(null);

  const { data: campaigns = [], isLoading } = useQuery<MarketingCampaign[]>({
    queryKey: ['/api/marketing/campaigns'],
    select: (data: any) => data.data || [],
  });

  const { data: googleReviews = [] } = useQuery<any[]>({
    queryKey: ['/api/reviews/google'],
    select: (data: any) => data.reviews || [],
  });

  const { data: facebookReviews = [] } = useQuery<any[]>({
    queryKey: ['/api/reviews/facebook'],
    select: (data: any) => data.reviews || [],
  });

  const allReviews = [...(googleReviews || []), ...(facebookReviews || [])].filter(r => r.rating >= 4);

  const createCampaignMutation = useMutation({
    mutationFn: async (data: any) => apiRequest('/api/marketing/campaigns', 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/campaigns'] });
      toast({ title: "Campaign created successfully" });
      setShowAdDialog(false);
      setShowReviewDialog(false);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create campaign", description: error.message, variant: "destructive" });
    },
  });

  const publishAdMutation = useMutation({
    mutationFn: async (id: string) => apiRequest(`/api/marketing/campaigns/${id}/publish-ad`, 'POST', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/campaigns'] });
      toast({ title: "Ad campaign published successfully!" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to publish ad", description: error.message, variant: "destructive" });
    },
  });

  const publishReviewMutation = useMutation({
    mutationFn: async (id: string) => apiRequest(`/api/marketing/campaigns/${id}/publish-review`, 'POST', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/campaigns'] });
      toast({ title: "Review posted successfully!" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to post review", description: error.message, variant: "destructive" });
    },
  });

  const refreshStatsMutation = useMutation({
    mutationFn: async (id: string) => apiRequest(`/api/marketing/campaigns/${id}/refresh-stats`, 'POST', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/campaigns'] });
      toast({ title: "Stats refreshed" });
    },
  });

  const deleteCampaignMutation = useMutation({
    mutationFn: async (id: string) => apiRequest(`/api/marketing/campaigns/${id}`, 'DELETE', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/campaigns'] });
      toast({ title: "Campaign deleted" });
    },
  });

  const adForm = useForm<z.infer<typeof adCampaignSchema>>({
    resolver: zodResolver(adCampaignSchema),
    defaultValues: {
      name: "",
      platform: "facebook",
      objective: "awareness",
      budget: "",
      budgetType: "daily",
      headline: "",
      text: "",
      imageUrl: "",
      ctaText: "Learn More",
      ctaUrl: "",
    },
  });

  const reviewForm = useForm<z.infer<typeof reviewPostSchema>>({
    resolver: zodResolver(reviewPostSchema),
    defaultValues: {
      name: "",
      platform: "facebook",
      reviewText: "",
      reviewAuthor: "",
      reviewRating: 5,
      reviewSource: "google",
    },
  });

  const onSubmitAd = (values: z.infer<typeof adCampaignSchema>) => {
    const campaignData = {
      name: values.name,
      type: 'ad',
      platform: values.platform,
      objective: values.objective,
      budget: values.budget,
      budgetType: values.budgetType,
      status: values.scheduledFor ? 'scheduled' : 'draft',
      scheduledFor: values.scheduledFor || null,
      adCreative: {
        headline: values.headline,
        text: values.text,
        imageUrl: values.imageUrl,
        ctaText: values.ctaText,
        ctaUrl: values.ctaUrl,
      },
      targeting: {
        location: ['Gisborne', 'East Coast'],
        ageMin: 25,
        ageMax: 65,
        interests: ['home improvement', 'landscaping', 'tree care'],
      },
    };
    createCampaignMutation.mutate(campaignData);
  };

  const onSubmitReview = (values: z.infer<typeof reviewPostSchema>) => {
    const campaignData = {
      name: values.name,
      type: 'review_post',
      platform: values.platform,
      status: values.scheduledFor ? 'scheduled' : 'draft',
      scheduledFor: values.scheduledFor || null,
      reviewText: values.reviewText,
      reviewAuthor: values.reviewAuthor,
      reviewRating: values.reviewRating,
      reviewSource: values.reviewSource,
    };
    createCampaignMutation.mutate(campaignData);
  };

  const fillReviewFromSelection = (review: any) => {
    reviewForm.setValue('reviewText', review.text);
    reviewForm.setValue('reviewAuthor', review.author_name || review.reviewer_name || 'Anonymous');
    reviewForm.setValue('reviewRating', review.rating);
    reviewForm.setValue('reviewSource', review.source || 'google');
  };

  const statusColors = {
    draft: "bg-gray-500",
    scheduled: "bg-blue-500",
    published: "bg-green-500",
    failed: "bg-red-500",
  };

  const platformIcons = {
    facebook: <Facebook className="w-4 h-4" />,
    instagram: <Instagram className="w-4 h-4" />,
    both: <Share2 className="w-4 h-4" />,
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Marketing Planner</h1>
          <p className="text-muted-foreground">Create and manage Facebook & Instagram campaigns</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowReviewDialog(true)} data-testid="button-create-review-post">
            <Star className="w-4 h-4 mr-2" />
            Share Review
          </Button>
          <Button onClick={() => setShowAdDialog(true)} data-testid="button-create-ad">
            <Megaphone className="w-4 h-4 mr-2" />
            Create Ad
          </Button>
        </div>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all" data-testid="tab-all-campaigns">All Campaigns</TabsTrigger>
          <TabsTrigger value="ads" data-testid="tab-ads">Ads</TabsTrigger>
          <TabsTrigger value="reviews" data-testid="tab-reviews">Review Posts</TabsTrigger>
          <TabsTrigger value="analytics" data-testid="tab-analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {isLoading ? (
            <p className="text-muted-foreground">Loading campaigns...</p>
          ) : campaigns.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Megaphone className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg text-muted-foreground">No campaigns yet</p>
                <p className="text-sm text-muted-foreground">Create your first ad or review post to get started</p>
              </CardContent>
            </Card>
          ) : (
            campaigns.map((campaign) => (
              <Card key={campaign.id} className="hover-elevate" data-testid={`card-campaign-${campaign.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="flex items-center gap-2">
                        {campaign.name}
                        {platformIcons[campaign.platform]}
                      </CardTitle>
                      <CardDescription>
                        {campaign.type === 'ad' ? 'Ad Campaign' : 'Review Post'} • Created {format(new Date(campaign.createdAt), 'MMM d, yyyy')}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={statusColors[campaign.status]}>{campaign.status}</Badge>
                      {campaign.type === 'ad' && campaign.objective && (
                        <Badge variant="outline">{campaign.objective}</Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {campaign.type === 'ad' && campaign.adCreative && (
                    <div className="space-y-2">
                      <p className="font-medium">{campaign.adCreative.headline}</p>
                      <p className="text-sm text-muted-foreground">{campaign.adCreative.text}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{campaign.adCreative.ctaText}</Badge>
                        {campaign.budget && (
                          <Badge variant="secondary">
                            <DollarSign className="w-3 h-3 mr-1" />
                            ${campaign.budget} {campaign.budgetType}
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {campaign.type === 'review_post' && campaign.reviewText && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1">
                        {Array.from({ length: campaign.reviewRating || 5 }).map((_, i) => (
                          <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        ))}
                      </div>
                      <p className="text-sm italic">"{campaign.reviewText}"</p>
                      <p className="text-sm text-muted-foreground">- {campaign.reviewAuthor}</p>
                    </div>
                  )}

                  {campaign.status === 'published' && (
                    <div className="grid grid-cols-4 gap-4 pt-4 border-t">
                      <div className="text-center">
                        <Users className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                        <p className="text-sm font-medium">{campaign.reach.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Reach</p>
                      </div>
                      <div className="text-center">
                        <Eye className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                        <p className="text-sm font-medium">{campaign.impressions.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Impressions</p>
                      </div>
                      <div className="text-center">
                        <MousePointer className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                        <p className="text-sm font-medium">{campaign.clicks.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Clicks</p>
                      </div>
                      <div className="text-center">
                        <Heart className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                        <p className="text-sm font-medium">{campaign.engagement.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Engagement</p>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    {campaign.status === 'draft' && (
                      <Button
                        size="sm"
                        onClick={() => {
                          if (campaign.type === 'ad') {
                            publishAdMutation.mutate(campaign.id);
                          } else {
                            publishReviewMutation.mutate(campaign.id);
                          }
                        }}
                        disabled={publishAdMutation.isPending || publishReviewMutation.isPending}
                        data-testid={`button-publish-${campaign.id}`}
                      >
                        Publish Now
                      </Button>
                    )}
                    {campaign.status === 'published' && campaign.metaCampaignId && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => refreshStatsMutation.mutate(campaign.id)}
                        disabled={refreshStatsMutation.isPending}
                        data-testid={`button-refresh-stats-${campaign.id}`}
                      >
                        <TrendingUp className="w-4 h-4 mr-2" />
                        Refresh Stats
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => deleteCampaignMutation.mutate(campaign.id)}
                      disabled={deleteCampaignMutation.isPending}
                      data-testid={`button-delete-${campaign.id}`}
                    >
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="ads">
          {campaigns.filter(c => c.type === 'ad').length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">No ad campaigns yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {campaigns.filter(c => c.type === 'ad').map((campaign) => (
                <Card key={campaign.id} className="hover-elevate">
                  <CardHeader>
                    <CardTitle>{campaign.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{campaign.adCreative?.headline}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="reviews">
          {campaigns.filter(c => c.type === 'review_post').length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">No review posts yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {campaigns.filter(c => c.type === 'review_post').map((campaign) => (
                <Card key={campaign.id} className="hover-elevate">
                  <CardHeader>
                    <CardTitle>{campaign.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground italic">"{campaign.reviewText}"</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle>Campaign Performance</CardTitle>
              <CardDescription>Overall marketing statistics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-6">
                <div>
                  <p className="text-sm text-muted-foreground">Total Reach</p>
                  <p className="text-2xl font-bold">{campaigns.reduce((sum, c) => sum + c.reach, 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Clicks</p>
                  <p className="text-2xl font-bold">{campaigns.reduce((sum, c) => sum + c.clicks, 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Engagement</p>
                  <p className="text-2xl font-bold">{campaigns.reduce((sum, c) => sum + c.engagement, 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Spent</p>
                  <p className="text-2xl font-bold">
                    ${campaigns.reduce((sum, c) => sum + parseFloat(c.spent || '0'), 0).toFixed(2)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Ad Dialog */}
      <Dialog open={showAdDialog} onOpenChange={setShowAdDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-create-ad">
          <DialogHeader>
            <DialogTitle>Create Facebook/Instagram Ad</DialogTitle>
            <DialogDescription>Set up your ad campaign to promote your tree services</DialogDescription>
          </DialogHeader>
          <Form {...adForm}>
            <form onSubmit={adForm.handleSubmit(onSubmitAd)} className="space-y-4">
              <FormField
                control={adForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Campaign Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Summer Tree Removal Promotion" {...field} data-testid="input-ad-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={adForm.control}
                  name="platform"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Platform</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-ad-platform">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="facebook">Facebook Only</SelectItem>
                          <SelectItem value="instagram">Instagram Only</SelectItem>
                          <SelectItem value="both">Both Platforms</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={adForm.control}
                  name="objective"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Objective</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-ad-objective">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="awareness">Brand Awareness</SelectItem>
                          <SelectItem value="traffic">Website Traffic</SelectItem>
                          <SelectItem value="engagement">Engagement</SelectItem>
                          <SelectItem value="leads">Lead Generation</SelectItem>
                          <SelectItem value="sales">Sales</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={adForm.control}
                  name="budget"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Budget (NZD)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="50" {...field} data-testid="input-ad-budget" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={adForm.control}
                  name="budgetType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Budget Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-ad-budget-type">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="daily">Daily Budget</SelectItem>
                          <SelectItem value="lifetime">Lifetime Budget</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={adForm.control}
                name="headline"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ad Headline</FormLabel>
                    <FormControl>
                      <Input placeholder="Professional Tree Services in Gisborne" {...field} data-testid="input-ad-headline" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={adForm.control}
                name="text"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ad Text</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Get expert tree removal, pruning, and stump grinding services..."
                        {...field}
                        data-testid="input-ad-text"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={adForm.control}
                name="imageUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Image URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://example.com/image.jpg" {...field} data-testid="input-ad-image" />
                    </FormControl>
                    <FormDescription>URL to your ad image</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={adForm.control}
                  name="ctaText"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Call-to-Action</FormLabel>
                      <FormControl>
                        <Input placeholder="Learn More" {...field} data-testid="input-ad-cta-text" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={adForm.control}
                  name="ctaUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CTA URL</FormLabel>
                      <FormControl>
                        <Input placeholder="https://yourwebsite.com" {...field} data-testid="input-ad-cta-url" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowAdDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createCampaignMutation.isPending} data-testid="button-submit-ad">
                  Create Campaign
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Share Review Dialog */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-create-review-post">
          <DialogHeader>
            <DialogTitle>Share Customer Review</DialogTitle>
            <DialogDescription>Post a customer review to Facebook</DialogDescription>
          </DialogHeader>

          {allReviews.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Select from your reviews:</p>
              <div className="grid gap-2 max-h-48 overflow-y-auto">
                {allReviews.slice(0, 10).map((review, idx) => (
                  <Card
                    key={idx}
                    className="p-3 cursor-pointer hover-elevate"
                    onClick={() => fillReviewFromSelection(review)}
                    data-testid={`card-review-${idx}`}
                  >
                    <div className="flex items-center gap-1 mb-1">
                      {Array.from({ length: review.rating }).map((_, i) => (
                        <Star key={i} className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                      ))}
                    </div>
                    <p className="text-sm line-clamp-2">{review.text}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      - {review.author_name || review.reviewer_name}
                    </p>
                  </Card>
                ))}
              </div>
            </div>
          )}

          <Form {...reviewForm}>
            <form onSubmit={reviewForm.handleSubmit(onSubmitReview)} className="space-y-4">
              <FormField
                control={reviewForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Post Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Customer Review - March 2024" {...field} data-testid="input-review-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={reviewForm.control}
                name="platform"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Platform</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-review-platform">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="facebook">Facebook</SelectItem>
                        <SelectItem value="instagram">Instagram</SelectItem>
                        <SelectItem value="both">Both</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={reviewForm.control}
                name="reviewText"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Review Text</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Amazing service! They removed our large oak tree safely and efficiently..."
                        {...field}
                        data-testid="input-review-text"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={reviewForm.control}
                  name="reviewAuthor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Author Name</FormLabel>
                      <FormControl>
                        <Input placeholder="John Smith" {...field} data-testid="input-review-author" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={reviewForm.control}
                  name="reviewRating"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rating</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(parseInt(value))}
                        defaultValue={field.value.toString()}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-review-rating">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="5">5 Stars</SelectItem>
                          <SelectItem value="4">4 Stars</SelectItem>
                          <SelectItem value="3">3 Stars</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={reviewForm.control}
                name="reviewSource"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Review Source</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-review-source">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="google">Google Reviews</SelectItem>
                        <SelectItem value="facebook">Facebook Reviews</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowReviewDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createCampaignMutation.isPending} data-testid="button-submit-review">
                  Create Post
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
