import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  TrendingUp,
  TrendingDown,
  Star,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  BarChart3,
  Target,
  Calendar,
  Sparkles,
  ArrowUp,
  ArrowDown
} from "lucide-react";

interface ReputationStats {
  invitesGoal: {
    current: number;
    target: number;
    percentage: number;
  };
  reviewsReceived: {
    count: number;
    change: number;
    trend: 'up' | 'down';
  };
  sentiment: {
    positive: number;
    negative: number;
    positivePercentage: number;
    negativePercentage: number;
  };
  averageRating: {
    rating: number;
    maxRating: number;
    distribution: Array<{ stars: number; count: number }>;
  };
  aiSummary: {
    text: string;
    reviewCount: number;
  };
}

const mockReputationData: ReputationStats = {
  invitesGoal: {
    current: 4,
    target: 20,
    percentage: 20
  },
  reviewsReceived: {
    count: 7,
    change: -22,
    trend: 'down'
  },
  sentiment: {
    positive: 0,
    negative: 0,
    positivePercentage: 0,
    negativePercentage: 0
  },
  averageRating: {
    rating: 4.8,
    maxRating: 5,
    distribution: [
      { stars: 5, count: 24 },
      { stars: 4, count: 8 },
      { stars: 3, count: 2 },
      { stars: 2, count: 1 },
      { stars: 1, count: 0 }
    ]
  },
  aiSummary: {
    text: "Treemarkables consistently delivers exceptional tree maintenance services, characterized by prompt, professional, and friendly interactions. Customers commend the team's efficiency, quality of work, and effective communication, resulting in high levels of satisfaction and recommendations.",
    reviewCount: 37
  }
};

export default function Reputation() {
  const [selectedPeriod, setSelectedPeriod] = useState('6months');
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch reputation data (using mock data for now)
  const { data: reputationData, isLoading } = useQuery({
    queryKey: ['/api/reputation/stats', selectedPeriod],
    queryFn: async () => {
      // TODO: Replace with real API call
      return { success: true, data: mockReputationData };
    }
  });

  const stats = reputationData?.data || mockReputationData;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading reputation data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Star className="h-6 w-6 text-orange-600" />
                Reputation
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Monitor and manage your online reputation and customer reviews
              </p>
            </div>
            <Button data-testid="button-send-review-request" className="bg-blue-600 hover:bg-blue-700">
              Send Review Request
            </Button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="px-6">
          <TabsList className="grid w-full grid-cols-6 lg:w-auto lg:grid-cols-6">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="requests" data-testid="tab-requests">Requests</TabsTrigger>
            <TabsTrigger value="reviews" data-testid="tab-reviews">Reviews</TabsTrigger>
            <TabsTrigger value="widgets" data-testid="tab-widgets">Widgets</TabsTrigger>
            <TabsTrigger value="listings" data-testid="tab-listings">Listings</TabsTrigger>
            <TabsTrigger value="settings" data-testid="tab-settings">Settings</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsContent value="overview" className="p-6 space-y-6">
            {/* Period Selector and My Stats Section */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h2 className="text-lg font-semibold text-blue-600">My Stats</h2>
                <div className="border-l border-gray-300 h-4"></div>
                <span className="text-gray-500">Competitor Analysis</span>
              </div>
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="w-40" data-testid="select-period">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1month">Last Month</SelectItem>
                  <SelectItem value="3months">Last 3 Months</SelectItem>
                  <SelectItem value="6months">Last 6 Months</SelectItem>
                  <SelectItem value="1year">Last Year</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* AI Recap Section */}
            <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="bg-purple-100 dark:bg-purple-900 p-2 rounded-lg">
                    <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">AI Recap 🤖</CardTitle>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Get chill AI summaries of customer reviews from your chosen Review Pages and time frames!
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-purple-200">
                  <div className="flex items-start gap-3">
                    <div className="bg-purple-100 dark:bg-purple-900 p-2 rounded-full">
                      <MessageSquare className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                        {stats.aiSummary.text}
                      </p>
                      <div className="flex items-center gap-2 mt-3">
                        <Badge variant="secondary" className="text-xs">
                          From {stats.aiSummary.reviewCount} Reviews
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-3">
                  <Button variant="ghost" className="text-purple-600 hover:text-purple-700 p-0 h-auto">
                    Check out Reviews AI →
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Invites Goal */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      Invites Goal
                    </CardTitle>
                    <Target className="h-4 w-4 text-gray-400" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-center">
                      <div className="relative w-24 h-24">
                        <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 36 36">
                          <path
                            className="text-gray-200 dark:text-gray-700"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                          <path
                            className="text-blue-600"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeDasharray={`${stats.invitesGoal.percentage}, 100`}
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-2xl font-bold text-gray-900 dark:text-white">
                            {stats.invitesGoal.current}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-center space-y-1">
                      <div className="flex items-center justify-center gap-1">
                        <ArrowUp className="h-3 w-3 text-green-600" />
                        <span className="text-sm font-medium text-green-600">
                          {stats.invitesGoal.percentage}%
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        out of {stats.invitesGoal.target}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Reviews Received */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      Reviews Received
                    </CardTitle>
                    <MessageSquare className="h-4 w-4 text-gray-400" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-gray-900 dark:text-white">
                        {stats.reviewsReceived.count}
                      </div>
                    </div>
                    <div className="flex items-center justify-center gap-1">
                      <ArrowDown className="h-3 w-3 text-red-600" />
                      <span className="text-sm font-medium text-red-600">
                        {Math.abs(stats.reviewsReceived.change)}%
                      </span>
                      <span className="text-xs text-gray-500">
                        vs Previous 6 Months
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Sentiment - Positive */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      Sentiment
                    </CardTitle>
                    <ThumbsUp className="h-4 w-4 text-green-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-gray-900 dark:text-white">
                        {stats.sentiment.positive}
                      </div>
                    </div>
                    <div className="flex items-center justify-center gap-1">
                      <ArrowUp className="h-3 w-3 text-gray-400" />
                      <span className="text-sm font-medium text-gray-500">
                        {stats.sentiment.positivePercentage}%
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Sentiment - Negative */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      Sentiment
                    </CardTitle>
                    <ThumbsDown className="h-4 w-4 text-red-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-gray-900 dark:text-white">
                        {stats.sentiment.negative}
                      </div>
                    </div>
                    <div className="flex items-center justify-center gap-1">
                      <ArrowUp className="h-3 w-3 text-gray-400" />
                      <span className="text-sm font-medium text-gray-500">
                        {stats.sentiment.negativePercentage}%
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Average Rating */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Average Rating</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-8">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-gray-900 dark:text-white">
                      {stats.averageRating.rating}
                    </div>
                    <div className="flex items-center justify-center gap-1 mt-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`h-4 w-4 ${
                            i < Math.floor(stats.averageRating.rating)
                              ? 'text-yellow-400 fill-current'
                              : 'text-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex-1 space-y-2">
                    {stats.averageRating.distribution.map((item, index) => (
                      <div key={item.stars} className="flex items-center gap-3">
                        <div className="flex items-center gap-1 w-8">
                          <span className="text-sm text-gray-600">{item.stars}</span>
                          <Star className="h-3 w-3 text-yellow-400 fill-current" />
                        </div>
                        <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div
                            className="bg-yellow-400 h-2 rounded-full"
                            style={{
                              width: `${
                                (item.count / Math.max(...stats.averageRating.distribution.map(d => d.count))) * 100
                              }%`
                            }}
                          />
                        </div>
                        <span className="text-sm text-gray-600 w-8 text-right">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Other Tab Content (placeholder) */}
          <TabsContent value="requests" className="p-6">
            <Card>
              <CardHeader>
                <CardTitle>Review Requests</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 dark:text-gray-400">
                  Manage and track review requests sent to customers.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reviews" className="p-6">
            <Card>
              <CardHeader>
                <CardTitle>Customer Reviews</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 dark:text-gray-400">
                  View and respond to customer reviews from all platforms.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="widgets" className="p-6">
            <Card>
              <CardHeader>
                <CardTitle>Review Widgets</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 dark:text-gray-400">
                  Embed review widgets on your website and social media.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="listings" className="p-6">
            <Card>
              <CardHeader>
                <CardTitle>Business Listings</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 dark:text-gray-400">
                  Manage your business listings across review platforms.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="p-6">
            <Card>
              <CardHeader>
                <CardTitle>Reputation Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 dark:text-gray-400">
                  Configure reputation management settings and integrations.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}