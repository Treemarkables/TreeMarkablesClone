import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  Star,
  Send,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Mail,
  MessageSquare,
  Phone,
  RefreshCw,
  TrendingUp,
  Users,
  Copy,
  ExternalLink,
  ThumbsUp
} from "lucide-react";
import { format, differenceInDays } from "date-fns";

interface ReviewRequest {
  id: string;
  jobId: string;
  customerId: string;
  token: string;
  status: string;
  sentAt: string | null;
  sentBy: string | null;
  sentVia: string | null;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  jobNumber: string | null;
  jobAddress: string | null;
  createdAt: string;
  submissionId: string | null;
  rating: number | null;
  comment: string | null;
  submittedAt: string | null;
}

interface ReviewStats {
  totalSent: number;
  totalReceived: number;
  conversionRate: number;
  averageRating: number;
}

interface ReviewTemplate {
  id: string;
  name: string;
  message: string;
  type: 'thank_you' | 'follow_up' | 'negative_response';
}

const defaultTemplates: ReviewTemplate[] = [
  {
    id: '1',
    name: 'Thank You - 5 Star',
    message: "Thank you so much for your wonderful 5-star review! We're thrilled to hear you had a great experience with our tree services. Your feedback means the world to us!",
    type: 'thank_you'
  },
  {
    id: '2', 
    name: 'Thank You - General',
    message: "Thank you for taking the time to leave us a review! We really appreciate your feedback and are glad we could help with your tree care needs.",
    type: 'thank_you'
  },
  {
    id: '3',
    name: 'Follow Up Reminder',
    message: "Hi! We hope you're enjoying your beautifully trimmed trees. If you have a moment, we'd really appreciate a quick review on Google or Facebook. It helps others find us!",
    type: 'follow_up'
  },
  {
    id: '4',
    name: 'Negative Review Response',
    message: "Thank you for your feedback. We're sorry to hear your experience didn't meet expectations. We'd love the opportunity to make things right - please contact us directly so we can address your concerns.",
    type: 'negative_response'
  }
];

const getStatusBadge = (request: ReviewRequest) => {
  if (request.submissionId) {
    const stars = request.rating || 0;
    if (stars >= 4) {
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Reviewed - {stars} Stars</Badge>;
    } else {
      return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Reviewed - {stars} Stars</Badge>;
    }
  }
  
  if (request.sentAt) {
    const daysSinceSent = differenceInDays(new Date(), new Date(request.sentAt));
    if (daysSinceSent > 7) {
      return <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">Needs Follow-up ({daysSinceSent} days)</Badge>;
    }
    return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">Sent ({daysSinceSent} days ago)</Badge>;
  }
  
  return <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">Pending</Badge>;
};

const getSentViaBadge = (sentVia: string | null) => {
  switch (sentVia) {
    case 'email':
      return <Badge variant="outline" className="gap-1"><Mail className="w-3 h-3" /> Email</Badge>;
    case 'sms':
      return <Badge variant="outline" className="gap-1"><MessageSquare className="w-3 h-3" /> SMS</Badge>;
    case 'both':
      return <Badge variant="outline" className="gap-1"><Send className="w-3 h-3" /> Both</Badge>;
    default:
      return null;
  }
};

export default function Reviews() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("requests");
  const [selectedTemplate, setSelectedTemplate] = useState<ReviewTemplate | null>(null);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: statsData, isLoading: statsLoading } = useQuery<{ success: boolean; data: ReviewStats }>({
    queryKey: ['/api/reviews/stats']
  });

  const { data: requestsData, isLoading: requestsLoading, refetch } = useQuery<{ success: boolean; data: ReviewRequest[] }>({
    queryKey: ['/api/reviews/requests']
  });

  const stats = statsData?.data;
  const requests = requestsData?.data || [];

  const filteredRequests = requests.filter(r => 
    r.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.jobNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.jobAddress?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const needsFollowUp = requests.filter(r => {
    if (r.submissionId) return false;
    if (!r.sentAt) return false;
    return differenceInDays(new Date(), new Date(r.sentAt)) > 7;
  });

  const copyTemplate = (message: string) => {
    navigator.clipboard.writeText(message);
      };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center gap-3">
        <SidebarTrigger data-testid="button-sidebar-toggle" />
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Reviews</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Track customer review requests and responses</p>
        </div>
        <Button onClick={() => refetch()} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <Send className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Requests Sent</p>
                  <p className="text-2xl font-bold">{stats?.totalSent || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Reviews Received</p>
                  <p className="text-2xl font-bold">{stats?.totalReceived || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Conversion Rate</p>
                  <p className="text-2xl font-bold">{stats?.conversionRate || 0}%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
                  <Star className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Average Rating</p>
                  <p className="text-2xl font-bold">{stats?.averageRating || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {needsFollowUp.length > 0 && (
          <Card className="mb-6 border-orange-200 bg-orange-50 dark:bg-orange-900/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
                <div>
                  <p className="font-medium text-orange-800 dark:text-orange-200">
                    {needsFollowUp.length} customer{needsFollowUp.length === 1 ? '' : 's'} need follow-up
                  </p>
                  <p className="text-sm text-orange-600 dark:text-orange-300">
                    These customers were sent review requests more than 7 days ago but haven't responded
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="requests">
              All Requests
              {requests.length > 0 && (
                <Badge variant="secondary" className="ml-2">{requests.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="followup">
              Follow-up
              {needsFollowUp.length > 0 && (
                <Badge variant="destructive" className="ml-2">{needsFollowUp.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="links">Review Links</TabsTrigger>
          </TabsList>

          <TabsContent value="requests" className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search by customer, job number, or address..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {requestsLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : filteredRequests.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <Users className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500">No review requests found</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Send review request emails from completed jobs to start tracking
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredRequests.map((request) => (
                  <Card key={request.id} className="hover-elevate">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h3 className="font-medium">{request.customerName}</h3>
                            {getStatusBadge(request)}
                          </div>
                          <div className="text-sm text-gray-500 space-y-1">
                            {request.jobNumber && (
                              <p>Job #{request.jobNumber}</p>
                            )}
                            {request.jobAddress && (
                              <p className="truncate max-w-md">{request.jobAddress}</p>
                            )}
                            <div className="flex items-center gap-3 flex-wrap">
                              {request.sentAt && (
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {format(new Date(request.sentAt), 'dd MMM yyyy h:mm a')}
                                </span>
                              )}
                              {getSentViaBadge(request.sentVia)}
                            </div>
                          </div>
                        </div>
                        
                        {request.submissionId && request.rating && (
                          <div className="text-right">
                            <div className="flex items-center gap-1">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  className={`w-4 h-4 ${
                                    star <= request.rating!
                                      ? 'text-yellow-400 fill-yellow-400'
                                      : 'text-gray-300'
                                  }`}
                                />
                              ))}
                            </div>
                            {request.comment && (
                              <p className="text-sm text-gray-500 mt-1 max-w-xs truncate">
                                "{request.comment}"
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {!request.submissionId && request.sentAt && differenceInDays(new Date(), new Date(request.sentAt)) > 7 && (
                        <div className="mt-3 pt-3 border-t flex items-center gap-2 flex-wrap">
                          <span className="text-sm text-gray-500 mr-2">Follow up:</span>
                          {request.customerPhone && (
                            <Button size="sm" variant="outline" asChild>
                              <a href={`tel:${request.customerPhone}`}>
                                <Phone className="w-3 h-3 mr-1" />
                                Call
                              </a>
                            </Button>
                          )}
                          {request.customerEmail && (
                            <Button size="sm" variant="outline" asChild>
                              <a href={`mailto:${request.customerEmail}`}>
                                <Mail className="w-3 h-3 mr-1" />
                                Email
                              </a>
                            </Button>
                          )}
                          {request.customerPhone && (
                            <Button size="sm" variant="outline" asChild>
                              <a href={`sms:${request.customerPhone}`}>
                                <MessageSquare className="w-3 h-3 mr-1" />
                                SMS
                              </a>
                            </Button>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="followup" className="space-y-4">
            {needsFollowUp.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <CheckCircle2 className="w-12 h-12 mx-auto text-green-300 mb-3" />
                  <p className="text-gray-500">All caught up!</p>
                  <p className="text-sm text-gray-400 mt-1">
                    No customers need follow-up at this time
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {needsFollowUp.map((request) => (
                  <Card key={request.id} className="border-orange-200">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h3 className="font-medium">{request.customerName}</h3>
                            {getStatusBadge(request)}
                          </div>
                          <div className="text-sm text-gray-500 space-y-1">
                            {request.jobNumber && <p>Job #{request.jobNumber}</p>}
                            {request.jobAddress && <p>{request.jobAddress}</p>}
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-3 pt-3 border-t flex items-center gap-2 flex-wrap">
                        <span className="text-sm text-gray-500 mr-2">Follow up:</span>
                        {request.customerPhone && (
                          <Button size="sm" variant="outline" asChild>
                            <a href={`tel:${request.customerPhone}`}>
                              <Phone className="w-3 h-3 mr-1" />
                              Call
                            </a>
                          </Button>
                        )}
                        {request.customerEmail && (
                          <Button size="sm" variant="outline" asChild>
                            <a href={`mailto:${request.customerEmail}`}>
                              <Mail className="w-3 h-3 mr-1" />
                              Email
                            </a>
                          </Button>
                        )}
                        {request.customerPhone && (
                          <Button size="sm" variant="outline" asChild>
                            <a href={`sms:${request.customerPhone}`}>
                              <MessageSquare className="w-3 h-3 mr-1" />
                              SMS
                            </a>
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="templates" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Response Templates</CardTitle>
                <CardDescription>
                  Pre-written messages to respond to customer reviews
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {defaultTemplates.map((template) => (
                  <div
                    key={template.id}
                    className="p-4 border rounded-lg hover-elevate cursor-pointer"
                    onClick={() => {
                      setSelectedTemplate(template);
                      setTemplateDialogOpen(true);
                    }}
                  >
                    <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                      <h4 className="font-medium">{template.name}</h4>
                      <Badge variant="outline">
                        {template.type === 'thank_you' && 'Thank You'}
                        {template.type === 'follow_up' && 'Follow Up'}
                        {template.type === 'negative_response' && 'Negative Response'}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-500 line-clamp-2">{template.message}</p>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="mt-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyTemplate(template.message);
                      }}
                    >
                      <Copy className="w-3 h-3 mr-1" />
                      Copy
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="links" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Star className="h-5 w-5 text-orange-500 fill-orange-500" />
                    Google Reviews
                  </CardTitle>
                  <CardDescription>
                    Your Google Business review link
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg space-y-3">
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Share this link with customers to get Google reviews:
                    </p>
                    <div className="flex items-center gap-2">
                      <Input 
                        value="https://search.google.com/local/writereview?placeid=ChIJyW5ncp55Zm0R3_iU47Axcn8"
                        readOnly
                        className="text-xs"
                      />
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText("https://search.google.com/local/writereview?placeid=ChIJyW5ncp55Zm0R3_iU47Axcn8");
                                                  }}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => window.open('https://search.google.com/local/writereview?placeid=ChIJyW5ncp55Zm0R3_iU47Axcn8', '_blank')}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Open Google Review Page
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ThumbsUp className="h-5 w-5 text-blue-600" />
                    Facebook Reviews
                  </CardTitle>
                  <CardDescription>
                    Your Facebook page review link
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg space-y-3">
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Share this link with customers to get Facebook reviews:
                    </p>
                    <div className="flex items-center gap-2">
                      <Input 
                        value="https://www.facebook.com/TreemarkablesGisborne/reviews"
                        readOnly
                        className="text-xs"
                      />
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText("https://www.facebook.com/TreemarkablesGisborne/reviews");
                                                  }}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => window.open('https://www.facebook.com/TreemarkablesGisborne/reviews', '_blank')}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Open Facebook Review Page
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selectedTemplate?.name}</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <Label className="mb-2 block">Message</Label>
              <Textarea
                value={selectedTemplate?.message || ''}
                readOnly
                className="min-h-[120px]"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>
                Close
              </Button>
              <Button onClick={() => {
                if (selectedTemplate) {
                  copyTemplate(selectedTemplate.message);
                }
              }}>
                <Copy className="w-4 h-4 mr-2" />
                Copy to Clipboard
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
