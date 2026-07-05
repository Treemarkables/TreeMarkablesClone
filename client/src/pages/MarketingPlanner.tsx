import { useState, useMemo, useEffect } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Calendar, DollarSign, Facebook, Instagram, Megaphone, Plus, Share2, Star, TrendingUp, Eye, 
  MousePointer, Users, Heart, ChevronLeft, ChevronRight, CloudRain, Sun, Snowflake, Leaf, 
  TreeDeciduous, Zap, Image as ImageIcon, Mail, Clock, Target, BarChart3, ArrowUp, ArrowDown,
  Layers, FileText, Copy, Trash2, Edit2, ExternalLink, Check
} from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, parseISO, isToday } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-NZ', {
    style: 'currency',
    currency: 'NZD',
    minimumFractionDigits: 2,
  }).format(amount);
};

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
  linkedLeadSource?: string;
  linkedJobIds?: string[];
  templateId?: string;
  createdAt: string;
}

interface SeasonalTemplate {
  id: string;
  name: string;
  season: 'spring' | 'summer' | 'autumn' | 'winter' | 'storm' | 'general';
  icon: any;
  headline: string;
  text: string;
  ctaText: string;
  color: string;
}

const seasonalTemplates: SeasonalTemplate[] = [
  {
    id: 'spring-cleanup',
    name: 'Spring Cleanup',
    season: 'spring',
    icon: Leaf,
    headline: 'Spring Tree Care Special',
    text: 'Get your trees ready for the growing season! Professional pruning, dead wood removal, and health assessments. Book now and save 15% on spring services.',
    ctaText: 'Book Spring Service',
    color: 'bg-green-500',
  },
  {
    id: 'summer-shade',
    name: 'Summer Shade',
    season: 'summer',
    icon: Sun,
    headline: 'Beat the Heat with Healthy Trees',
    text: 'Keep your property cool and beautiful this summer. Expert tree trimming for better shade coverage and improved air circulation. Free quotes available.',
    ctaText: 'Get Free Quote',
    color: 'bg-yellow-500',
  },
  {
    id: 'autumn-prep',
    name: 'Autumn Prep',
    season: 'autumn',
    icon: TreeDeciduous,
    headline: 'Prepare Your Trees for Winter',
    text: 'Autumn is the perfect time for tree maintenance. Pruning, leaf cleanup, and winter prep services to keep your property safe and tidy.',
    ctaText: 'Schedule Now',
    color: 'bg-orange-500',
  },
  {
    id: 'winter-storm',
    name: 'Winter Protection',
    season: 'winter',
    icon: Snowflake,
    headline: 'Winter Storm Preparation',
    text: 'Don\'t let winter storms damage your property. Professional hazard assessment and preventive tree removal. Emergency services available 24/7.',
    ctaText: 'Book Assessment',
    color: 'bg-blue-500',
  },
  {
    id: 'storm-damage',
    name: 'Storm Damage',
    season: 'storm',
    icon: CloudRain,
    headline: 'Storm Damage Cleanup Available',
    text: 'Storm hit your area? Our emergency team is ready to help. Fast response, safe removal, and insurance claim assistance. Available 24/7.',
    ctaText: 'Call Now',
    color: 'bg-purple-500',
  },
  {
    id: 'emergency-service',
    name: 'Emergency Service',
    season: 'general',
    icon: Zap,
    headline: '24/7 Emergency Tree Service',
    text: 'Trees threatening your home or blocking access? Our emergency response team is standing by. Fast, safe, professional service when you need it most.',
    ctaText: 'Emergency Call',
    color: 'bg-red-500',
  },
];

const adCampaignSchema = z.object({
  name: z.string().min(1, "Campaign name is required"),
  platform: z.enum(['facebook', 'instagram', 'both']),
  objective: z.enum(['awareness', 'traffic', 'engagement', 'leads', 'sales']),
  budget: z.string().min(1, "Budget is required"),
  budgetType: z.enum(['daily', 'lifetime']),
  headline: z.string().min(1, "Headline is required"),
  text: z.string().min(1, "Ad text is required"),
  imageUrl: z.string().optional(),
  ctaText: z.string().min(1, "Call-to-action is required"),
  ctaUrl: z.string().url("Valid URL is required"),
  scheduledFor: z.string().optional(),
  linkedLeadSource: z.string().optional(),
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

const bulkScheduleSchema = z.object({
  templateId: z.string().min(1, "Select a template"),
  platform: z.enum(['facebook', 'instagram', 'both']),
  scheduleDates: z.array(z.string()).min(1, "Select at least one date"),
  budget: z.string().optional(),
});

export default function MarketingPlanner() {
  const { toast } = useToast();
  const [showAdDialog, setShowAdDialog] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<MarketingCampaign | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<SeasonalTemplate | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [activeTab, setActiveTab] = useState('calendar');
  const [autoPostReviews, setAutoPostReviews] = useState(false);
  const [selectedBulkDates, setSelectedBulkDates] = useState<string[]>([]);
  const [bulkPlatform, setBulkPlatform] = useState<'facebook' | 'instagram' | 'both'>('both');
  const [bulkBudget, setBulkBudget] = useState('');
  const [previewPlatform, setPreviewPlatform] = useState<'facebook' | 'instagram'>('facebook');

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

  const { data: jobs = [] } = useQuery<any[]>({
    queryKey: ['/api/jobs'],
    select: (data: any) => data?.data || [],
  });

  const { data: leads = [] } = useQuery<any[]>({
    queryKey: ['/api/leads'],
    select: (data: any) => data?.data || [],
  });

  const { data: marketingSettings } = useQuery<any>({
    queryKey: ['/api/marketing/settings'],
  });

  const allReviews = [...(googleReviews || []), ...(facebookReviews || [])].filter(r => r.rating >= 4);

  // Sync autoPostReviews with backend settings
  useEffect(() => {
    if (marketingSettings?.autoPostReviews !== undefined) {
      setAutoPostReviews(marketingSettings.autoPostReviews);
    }
  }, [marketingSettings]);

  const createCampaignMutation = useMutation({
    mutationFn: async (data: any) => apiRequest('/api/marketing/campaigns', 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/campaigns'] });
      setShowAdDialog(false);
      setShowReviewDialog(false);
      setShowBulkDialog(false);
    },
    onError: (error: Error) => {
      console.error('Failed to create campaign:', error);
    },
  });

  const updateCampaignMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => 
      apiRequest(`/api/marketing/campaigns/${id}`, 'PATCH', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/campaigns'] });
    },
  });

  const publishAdMutation = useMutation({
    mutationFn: async (id: string) => apiRequest(`/api/marketing/campaigns/${id}/publish-ad`, 'POST', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/campaigns'] });
    },
  });

  const publishReviewMutation = useMutation({
    mutationFn: async (id: string) => apiRequest(`/api/marketing/campaigns/${id}/publish-review`, 'POST', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/campaigns'] });
    },
  });

  const refreshStatsMutation = useMutation({
    mutationFn: async (id: string) => apiRequest(`/api/marketing/campaigns/${id}/refresh-stats`, 'POST', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/campaigns'] });
    },
  });

  const deleteCampaignMutation = useMutation({
    mutationFn: async (id: string) => apiRequest(`/api/marketing/campaigns/${id}`, 'DELETE', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/campaigns'] });
    },
  });

  const updateAutoPostMutation = useMutation({
    mutationFn: async (enabled: boolean) => 
      apiRequest('/api/marketing/settings', 'PATCH', { autoPostReviews: enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/settings'] });
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
      linkedLeadSource: values.linkedLeadSource || null,
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

  const applyTemplate = (template: SeasonalTemplate) => {
    adForm.setValue('headline', template.headline);
    adForm.setValue('text', template.text);
    adForm.setValue('ctaText', template.ctaText);
    adForm.setValue('name', template.name + ' Campaign');
    setShowTemplateDialog(false);
    setShowAdDialog(true);
  };

  const handleBulkSchedule = () => {
    if (!selectedTemplate || selectedBulkDates.length === 0) return;
    
    selectedBulkDates.forEach((date) => {
      const campaignData = {
        name: `${selectedTemplate.name} - ${format(parseISO(date), 'MMM d')}`,
        type: 'ad',
        platform: bulkPlatform,
        status: 'scheduled',
        scheduledFor: date,
        templateId: selectedTemplate.id,
        budget: bulkBudget || null,
        budgetType: bulkBudget ? 'daily' : null,
        adCreative: {
          headline: selectedTemplate.headline,
          text: selectedTemplate.text,
          ctaText: selectedTemplate.ctaText,
          ctaUrl: 'https://treemarkables.co.nz',
        },
      };
      createCampaignMutation.mutate(campaignData);
    });
    
    setSelectedBulkDates([]);
    setSelectedTemplate(null);
    setBulkPlatform('both');
    setBulkBudget('');
    setShowBulkDialog(false);
  };

  const handleDragStart = (e: React.DragEvent, campaign: MarketingCampaign) => {
    e.dataTransfer.setData('campaignId', campaign.id);
  };

  const handleDrop = (e: React.DragEvent, date: Date) => {
    e.preventDefault();
    const campaignId = e.dataTransfer.getData('campaignId');
    if (campaignId) {
      updateCampaignMutation.mutate({
        id: campaignId,
        data: { 
          scheduledFor: format(date, 'yyyy-MM-dd'),
          status: 'scheduled'
        }
      });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const getCampaignsForDay = (day: Date) => {
    return campaigns.filter(c => {
      if (!c.scheduledFor && !c.publishedAt) return false;
      const campaignDate = c.scheduledFor ? parseISO(c.scheduledFor) : parseISO(c.publishedAt!);
      return isSameDay(campaignDate, day);
    });
  };

  const roiData = useMemo(() => {
    const linkedLeads = leads.filter((lead: any) => 
      campaigns.some(c => c.linkedLeadSource === lead.source)
    );
    
    const linkedJobs = jobs.filter((job: any) => 
      linkedLeads.some((lead: any) => lead.id === job.leadId)
    );
    
    const totalSpent = campaigns.reduce((sum, c) => sum + parseFloat(c.spent || '0'), 0);
    const totalRevenue = linkedJobs.reduce((sum: number, job: any) => 
      sum + (parseFloat(job.actualPrice) || parseFloat(job.totalPrice) || 0), 0
    );
    
    return {
      totalSpent,
      totalRevenue,
      roi: totalSpent > 0 ? ((totalRevenue - totalSpent) / totalSpent * 100) : 0,
      linkedLeads: linkedLeads.length,
      linkedJobs: linkedJobs.length,
    };
  }, [campaigns, leads, jobs]);

  const performanceByTime = useMemo(() => {
    const hourlyData: Record<number, { engagement: number; count: number }> = {};
    const dayData: Record<number, { engagement: number; count: number }> = {};
    
    campaigns.filter(c => c.publishedAt).forEach(c => {
      const date = parseISO(c.publishedAt!);
      const hour = date.getHours();
      const day = date.getDay();
      
      if (!hourlyData[hour]) hourlyData[hour] = { engagement: 0, count: 0 };
      if (!dayData[day]) dayData[day] = { engagement: 0, count: 0 };
      
      hourlyData[hour].engagement += c.engagement;
      hourlyData[hour].count += 1;
      dayData[day].engagement += c.engagement;
      dayData[day].count += 1;
    });
    
    const bestHour = Object.entries(hourlyData)
      .sort(([,a], [,b]) => (b.engagement / b.count) - (a.engagement / a.count))[0];
    const bestDay = Object.entries(dayData)
      .sort(([,a], [,b]) => (b.engagement / b.count) - (a.engagement / a.count))[0];
    
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    return {
      bestHour: bestHour ? `${bestHour[0]}:00` : 'N/A',
      bestDay: bestDay ? dayNames[parseInt(bestDay[0])] : 'N/A',
      hourlyData,
      dayData,
    };
  }, [campaigns]);

  const statusColors: Record<string, string> = {
    draft: "bg-gray-500",
    scheduled: "bg-blue-500",
    published: "bg-green-500",
    failed: "bg-red-500",
  };

  const platformIcons: Record<string, JSX.Element> = {
    facebook: <Facebook className="w-4 h-4" />,
    instagram: <Instagram className="w-4 h-4" />,
    both: <Share2 className="w-4 h-4" />,
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Marketing Planner</h1>
          <p className="text-muted-foreground">Create, schedule, and track your marketing campaigns</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setShowTemplateDialog(true)} data-testid="button-templates">
            <Layers className="w-4 h-4 mr-2" />
            Templates
          </Button>
          <Button variant="outline" onClick={() => setShowBulkDialog(true)} data-testid="button-bulk-schedule">
            <Calendar className="w-4 h-4 mr-2" />
            Bulk Schedule
          </Button>
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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5 md:w-auto md:inline-grid">
          <TabsTrigger value="calendar" data-testid="tab-calendar">Calendar</TabsTrigger>
          <TabsTrigger value="campaigns" data-testid="tab-campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="analytics" data-testid="tab-analytics">Analytics</TabsTrigger>
          <TabsTrigger value="automation" data-testid="tab-automation">Automation</TabsTrigger>
          <TabsTrigger value="images" data-testid="tab-images">Images</TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Campaign Calendar</CardTitle>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                    aria-label="Previous month"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="font-medium min-w-[140px] text-center">
                    {format(currentMonth, 'MMMM yyyy')}
                  </span>
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                    aria-label="Next month"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: calendarDays[0].getDay() }).map((_, i) => (
                  <div key={`empty-${i}`} className="h-24 bg-gray-50 dark:bg-gray-900 rounded" />
                ))}
                {calendarDays.map(day => {
                  const dayCampaigns = getCampaignsForDay(day);
                  return (
                    <div
                      key={day.toISOString()}
                      className={`h-24 border rounded p-1 overflow-hidden transition-colors ${
                        isToday(day) ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' : 'border-gray-200 dark:border-gray-800'
                      } ${!isSameMonth(day, currentMonth) ? 'opacity-50' : ''}`}
                      onDrop={(e) => handleDrop(e, day)}
                      onDragOver={handleDragOver}
                    >
                      <div className="text-xs font-medium mb-1">{format(day, 'd')}</div>
                      <div className="space-y-0.5 overflow-y-auto max-h-16">
                        {dayCampaigns.map(campaign => (
                          <div
                            key={campaign.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, campaign)}
                            className={`text-[10px] p-0.5 rounded truncate cursor-move ${
                              campaign.type === 'ad' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                            }`}
                            onClick={() => {
                              setSelectedCampaign(campaign);
                              setShowPreviewDialog(true);
                            }}
                          >
                            {campaign.name}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-orange-100 dark:bg-orange-900" />
                  <span>Ad Campaign</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-purple-100 dark:bg-purple-900" />
                  <span>Review Post</span>
                </div>
                <span className="ml-auto">Drag campaigns to reschedule</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="campaigns" className="mt-4 space-y-4">
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
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <span className="truncate">{campaign.name}</span>
                        {platformIcons[campaign.platform]}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {campaign.type === 'ad' ? 'Ad Campaign' : 'Review Post'} • {format(new Date(campaign.createdAt), 'MMM d, yyyy')}
                        {campaign.scheduledFor && ` • Scheduled: ${format(parseISO(campaign.scheduledFor), 'MMM d, h:mm a')}`}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge className={statusColors[campaign.status]}>{campaign.status}</Badge>
                      {campaign.type === 'ad' && campaign.objective && (
                        <Badge variant="outline" className="hidden md:inline-flex">{campaign.objective}</Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {campaign.type === 'ad' && campaign.adCreative && (
                    <div className="space-y-2">
                      <p className="font-medium text-sm">{campaign.adCreative.headline}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{campaign.adCreative.text}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="text-xs">{campaign.adCreative.ctaText}</Badge>
                        {campaign.budget && (
                          <Badge variant="secondary" className="text-xs">
                            <DollarSign className="w-3 h-3 mr-1" />
                            {formatCurrency(parseFloat(campaign.budget))} {campaign.budgetType}
                          </Badge>
                        )}
                        {campaign.linkedLeadSource && (
                          <Badge variant="outline" className="text-xs">
                            <Target className="w-3 h-3 mr-1" />
                            {campaign.linkedLeadSource}
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {campaign.type === 'review_post' && campaign.reviewText && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1">
                        {Array.from({ length: campaign.reviewRating || 5 }).map((_, i) => (
                          <Star key={i} className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                        ))}
                      </div>
                      <p className="text-xs italic line-clamp-2">"{campaign.reviewText}"</p>
                      <p className="text-xs text-muted-foreground">- {campaign.reviewAuthor}</p>
                    </div>
                  )}

                  {campaign.status === 'published' && (
                    <div className="grid grid-cols-4 gap-2 pt-3 border-t">
                      <div className="text-center">
                        <Users className="w-3 h-3 mx-auto mb-0.5 text-muted-foreground" />
                        <p className="text-xs font-medium">{campaign.reach.toLocaleString()}</p>
                        <p className="text-[10px] text-muted-foreground">Reach</p>
                      </div>
                      <div className="text-center">
                        <Eye className="w-3 h-3 mx-auto mb-0.5 text-muted-foreground" />
                        <p className="text-xs font-medium">{campaign.impressions.toLocaleString()}</p>
                        <p className="text-[10px] text-muted-foreground">Views</p>
                      </div>
                      <div className="text-center">
                        <MousePointer className="w-3 h-3 mx-auto mb-0.5 text-muted-foreground" />
                        <p className="text-xs font-medium">{campaign.clicks.toLocaleString()}</p>
                        <p className="text-[10px] text-muted-foreground">Clicks</p>
                      </div>
                      <div className="text-center">
                        <Heart className="w-3 h-3 mx-auto mb-0.5 text-muted-foreground" />
                        <p className="text-xs font-medium">{campaign.engagement.toLocaleString()}</p>
                        <p className="text-[10px] text-muted-foreground">Engage</p>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedCampaign(campaign);
                        setShowPreviewDialog(true);
                      }}
                    >
                      <Eye className="w-3 h-3 mr-1" />
                      Preview
                    </Button>
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
                        Publish
                      </Button>
                    )}
                    {campaign.status === 'published' && campaign.metaCampaignId && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => refreshStatsMutation.mutate(campaign.id)}
                        disabled={refreshStatsMutation.isPending}
                      >
                        <TrendingUp className="w-3 h-3 mr-1" />
                        Refresh
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => deleteCampaignMutation.mutate(campaign.id)}
                      disabled={deleteCampaignMutation.isPending}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="analytics" className="mt-4 space-y-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Total Reach</p>
                    <p className="text-2xl font-bold">{campaigns.reduce((sum, c) => sum + c.reach, 0).toLocaleString()}</p>
                  </div>
                  <Users className="w-8 h-8 text-blue-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Total Clicks</p>
                    <p className="text-2xl font-bold">{campaigns.reduce((sum, c) => sum + c.clicks, 0).toLocaleString()}</p>
                  </div>
                  <MousePointer className="w-8 h-8 text-green-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Total Spent</p>
                    <p className="text-2xl font-bold">{formatCurrency(roiData.totalSpent)}</p>
                  </div>
                  <DollarSign className="w-8 h-8 text-orange-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">ROI</p>
                    <p className={`text-2xl font-bold ${roiData.roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {roiData.roi >= 0 ? '+' : ''}{roiData.roi.toFixed(1)}%
                    </p>
                  </div>
                  {roiData.roi >= 0 ? (
                    <ArrowUp className="w-8 h-8 text-green-500 opacity-50" />
                  ) : (
                    <ArrowDown className="w-8 h-8 text-red-500 opacity-50" />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Revenue Attribution</CardTitle>
                <CardDescription>Campaigns linked to leads and jobs</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Linked Leads</span>
                  <span className="font-medium">{roiData.linkedLeads}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Converted Jobs</span>
                  <span className="font-medium">{roiData.linkedJobs}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="text-sm font-medium">Total Revenue</span>
                  <span className="font-bold text-green-600">{formatCurrency(roiData.totalRevenue)}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Best Performance Times</CardTitle>
                <CardDescription>Optimal posting schedule</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">Best Hour</span>
                  </div>
                  <Badge variant="secondary">{performanceByTime.bestHour}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">Best Day</span>
                  </div>
                  <Badge variant="secondary">{performanceByTime.bestDay}</Badge>
                </div>
                <p className="text-xs text-muted-foreground pt-2 border-t">
                  Based on engagement data from {campaigns.filter(c => c.publishedAt).length} published campaigns
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Campaign Comparison</CardTitle>
              <CardDescription>Compare performance across campaigns</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {campaigns.filter(c => c.status === 'published').slice(0, 5).map(campaign => {
                  const maxEngagement = Math.max(...campaigns.map(c => c.engagement || 1));
                  const percentage = (campaign.engagement / maxEngagement) * 100;
                  return (
                    <div key={campaign.id} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="truncate max-w-[200px]">{campaign.name}</span>
                        <span className="text-muted-foreground">{campaign.engagement.toLocaleString()} engagements</span>
                      </div>
                      <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {campaigns.filter(c => c.status === 'published').length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No published campaigns to compare yet
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="automation" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Auto-Post Reviews</CardTitle>
              <CardDescription>Automatically share new 5-star reviews to social media</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="auto-post">Enable Auto-Posting</Label>
                  <p className="text-xs text-muted-foreground">
                    New 5-star reviews will be posted to Facebook automatically
                  </p>
                </div>
                <Switch
                  id="auto-post"
                  checked={autoPostReviews}
                  onCheckedChange={(checked) => {
                    setAutoPostReviews(checked);
                    updateAutoPostMutation.mutate(checked);
                  }}
                />
              </div>
              {autoPostReviews && (
                <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                    <Check className="w-4 h-4" />
                    <span className="text-sm font-medium">Auto-posting is enabled</span>
                  </div>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                    New 5-star reviews from Google and Facebook will be automatically shared
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Weather-Triggered Campaigns</CardTitle>
              <CardDescription>Automatic campaign suggestions based on weather</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <CloudRain className="w-8 h-8 text-blue-500" />
                    <div>
                      <p className="font-medium text-sm">Storm Alert</p>
                      <p className="text-xs text-muted-foreground">When severe weather is forecast</p>
                    </div>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => {
                      const stormTemplate = seasonalTemplates.find(t => t.id === 'storm-damage');
                      if (stormTemplate) applyTemplate(stormTemplate);
                    }}
                  >
                    Create Campaign
                  </Button>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Sun className="w-8 h-8 text-yellow-500" />
                    <div>
                      <p className="font-medium text-sm">Dry Spell</p>
                      <p className="text-xs text-muted-foreground">When extended dry weather is forecast</p>
                    </div>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => {
                      const summerTemplate = seasonalTemplates.find(t => t.id === 'summer-shade');
                      if (summerTemplate) applyTemplate(summerTemplate);
                    }}
                  >
                    Create Campaign
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Email Nurture Sequences</CardTitle>
              <CardDescription>Automated email follow-ups via Mailchimp</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center gap-3">
                  <Mail className="w-6 h-6 text-purple-500" />
                  <div>
                    <p className="font-medium text-sm">New Lead Welcome</p>
                    <p className="text-xs text-muted-foreground">3-email sequence for new leads</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center p-2 bg-gray-50 dark:bg-gray-900 rounded">
                    <p className="text-xs font-medium">Day 1</p>
                    <p className="text-[10px] text-muted-foreground">Welcome email</p>
                  </div>
                  <div className="text-center p-2 bg-gray-50 dark:bg-gray-900 rounded">
                    <p className="text-xs font-medium">Day 3</p>
                    <p className="text-[10px] text-muted-foreground">Services overview</p>
                  </div>
                  <div className="text-center p-2 bg-gray-50 dark:bg-gray-900 rounded">
                    <p className="text-xs font-medium">Day 7</p>
                    <p className="text-[10px] text-muted-foreground">Special offer</p>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="w-full">
                  <ExternalLink className="w-3 h-3 mr-2" />
                  Configure in Mailchimp
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="images" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Image Library</CardTitle>
              <CardDescription>Upload and manage images for your campaigns</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="aspect-square border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors">
                  <Plus className="w-8 h-8 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Upload Image</span>
                </div>
                {[1, 2, 3, 4, 5, 6, 7].map(i => (
                  <div key={i} className="aspect-square bg-gradient-to-br from-green-400 to-green-600 rounded-lg flex items-center justify-center relative group">
                    <TreeDeciduous className="w-12 h-12 text-white/50" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                      <Button size="icon" variant="ghost" className="text-white hover:bg-white/20" aria-label="Copy image">
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="text-white hover:bg-white/20" aria-label="Delete image">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Template Selection Dialog */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Choose a Template</DialogTitle>
            <DialogDescription>Select a seasonal or promotional template to get started quickly</DialogDescription>
          </DialogHeader>
          <div className="grid md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
            {seasonalTemplates.map(template => {
              const Icon = template.icon;
              return (
                <Card 
                  key={template.id} 
                  className="cursor-pointer hover-elevate"
                  onClick={() => applyTemplate(template)}
                >
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${template.color}`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{template.name}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{template.headline}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Schedule Dialog */}
      <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk Schedule Campaigns</DialogTitle>
            <DialogDescription>Schedule multiple campaigns at once using a template</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Template</Label>
              <div className="grid grid-cols-2 gap-2">
                {seasonalTemplates.slice(0, 4).map(template => {
                  const Icon = template.icon;
                  return (
                    <div
                      key={template.id}
                      onClick={() => setSelectedTemplate(template)}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedTemplate?.id === template.id 
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' 
                          : 'hover:border-gray-400'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${selectedTemplate?.id === template.id ? 'text-blue-500' : 'text-muted-foreground'}`} />
                        <span className="text-sm">{template.name}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Platform</Label>
                <Select value={bulkPlatform} onValueChange={(val: 'facebook' | 'instagram' | 'both') => setBulkPlatform(val)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="facebook">Facebook</SelectItem>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Budget per Campaign (NZD)</Label>
                <Input 
                  type="number" 
                  placeholder="50" 
                  value={bulkBudget}
                  onChange={(e) => setBulkBudget(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Select Dates</Label>
              <div className="grid grid-cols-7 gap-1 p-2 border rounded-lg">
                {eachDayOfInterval({ 
                  start: new Date(), 
                  end: addMonths(new Date(), 1) 
                }).slice(0, 28).map(day => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const isSelected = selectedBulkDates.includes(dateStr);
                  return (
                    <div
                      key={dateStr}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedBulkDates(prev => prev.filter(d => d !== dateStr));
                        } else {
                          setSelectedBulkDates(prev => [...prev, dateStr]);
                        }
                      }}
                      className={`aspect-square flex items-center justify-center text-xs rounded cursor-pointer transition-colors ${
                        isSelected 
                          ? 'bg-blue-500 text-white' 
                          : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                    >
                      {format(day, 'd')}
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedBulkDates.length} date(s) selected
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkDialog(false)}>Cancel</Button>
            <Button 
              onClick={handleBulkSchedule}
              disabled={!selectedTemplate || selectedBulkDates.length === 0}
            >
              Schedule {selectedBulkDates.length} Campaigns
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Post Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Post Preview</DialogTitle>
            <DialogDescription>See how your post will look on social media</DialogDescription>
          </DialogHeader>
          {selectedCampaign && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={previewPlatform === 'facebook' ? 'default' : 'outline'}
                  onClick={() => setPreviewPlatform('facebook')}
                >
                  <Facebook className="w-4 h-4 mr-2" />
                  Facebook
                </Button>
                <Button
                  size="sm"
                  variant={previewPlatform === 'instagram' ? 'default' : 'outline'}
                  onClick={() => setPreviewPlatform('instagram')}
                >
                  <Instagram className="w-4 h-4 mr-2" />
                  Instagram
                </Button>
              </div>
              
              <div className={`border rounded-lg overflow-hidden ${
                previewPlatform === 'facebook' ? 'bg-white' : 'bg-black'
              }`}>
                {/* Header */}
                <div className={`flex items-center gap-3 p-3 ${
                  previewPlatform === 'instagram' ? 'border-b border-gray-800' : 'border-b'
                }`}>
                  <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center">
                    <TreeDeciduous className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className={`font-semibold text-sm ${previewPlatform === 'instagram' ? 'text-white' : ''}`}>
                      Treemarkables
                    </p>
                    <p className={`text-xs ${previewPlatform === 'instagram' ? 'text-gray-400' : 'text-gray-500'}`}>
                      Sponsored
                    </p>
                  </div>
                </div>
                
                {/* Image placeholder */}
                <div className="aspect-square bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
                  {selectedCampaign.adCreative?.imageUrl ? (
                    <img src={selectedCampaign.adCreative.imageUrl} alt="Ad" className="w-full h-full object-cover" />
                  ) : (
                    <TreeDeciduous className="w-24 h-24 text-white/30" />
                  )}
                </div>
                
                {/* Content */}
                <div className={`p-3 ${previewPlatform === 'instagram' ? 'text-white' : ''}`}>
                  {selectedCampaign.type === 'ad' && selectedCampaign.adCreative && (
                    <>
                      <p className="font-semibold text-sm mb-1">{selectedCampaign.adCreative.headline}</p>
                      <p className="text-sm">{selectedCampaign.adCreative.text}</p>
                      <Button size="sm" className="mt-3 w-full">
                        {selectedCampaign.adCreative.ctaText}
                      </Button>
                    </>
                  )}
                  {selectedCampaign.type === 'review_post' && (
                    <>
                      <div className="flex items-center gap-1 mb-2">
                        {Array.from({ length: selectedCampaign.reviewRating || 5 }).map((_, i) => (
                          <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        ))}
                      </div>
                      <p className="text-sm italic">"{selectedCampaign.reviewText}"</p>
                      <p className={`text-sm mt-2 ${previewPlatform === 'instagram' ? 'text-gray-400' : 'text-gray-500'}`}>
                        - {selectedCampaign.reviewAuthor}
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
                name="linkedLeadSource"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Link to Lead Source (for ROI tracking)</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select lead source to track" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="facebook_ad">Facebook Ad</SelectItem>
                        <SelectItem value="instagram_ad">Instagram Ad</SelectItem>
                        <SelectItem value="social_media">Social Media</SelectItem>
                        <SelectItem value="online_marketing">Online Marketing</SelectItem>
                        <SelectItem value="ppc">PPC (Google Ads)</SelectItem>
                        <SelectItem value="google_maps">Google Maps</SelectItem>
                        <SelectItem value="seo">SEO (Organic)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>Link this campaign to a lead source to track ROI</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                    <FormLabel>Image URL (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="https://example.com/image.jpg" {...field} data-testid="input-ad-image" />
                    </FormControl>
                    <FormDescription>URL to your ad image or select from image library</FormDescription>
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

              <FormField
                control={adForm.control}
                name="scheduledFor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Schedule (optional)</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormDescription>Leave empty to save as draft</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

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

              <FormField
                control={reviewForm.control}
                name="scheduledFor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Schedule (optional)</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormDescription>Leave empty to save as draft</FormDescription>
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
