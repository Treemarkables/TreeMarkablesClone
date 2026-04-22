import { useRef, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { LogoSidebarTrigger } from "@/components/LogoSidebarTrigger";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
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
  ThumbsUp,
  Plus,
  Trash2,
  EyeOff,
  Eye,
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

// Row from the `reviews` table — drives the curated pool used by the proposal
// widget and PDF. `/api/reviews/featured` filters this to isPublic rows that
// have at least one uploaded photo.
interface CuratedReview {
  id: string;
  platform: string;
  rating: number;
  reviewerName: string | null;
  reviewText: string | null;
  reviewDate: string | null;
  response: string | null;
  isPublic: boolean | null;
  sentiment: string | null;
  photoUrls: string[] | null;
  createdAt: string | null;
}

interface ReviewTemplate {
  id: string;
  name: string;
  message: string;
  type: "thank_you" | "follow_up" | "negative_response";
}

const defaultTemplates: ReviewTemplate[] = [
  {
    id: "1",
    name: "Thank You - 5 Star",
    message:
      "Thank you so much for your wonderful 5-star review! We're thrilled to hear you had a great experience with our tree services. Your feedback means the world to us!",
    type: "thank_you",
  },
  {
    id: "2",
    name: "Thank You - General",
    message:
      "Thank you for taking the time to leave us a review! We really appreciate your feedback and are glad we could help with your tree care needs.",
    type: "thank_you",
  },
  {
    id: "3",
    name: "Follow Up Reminder",
    message:
      "Hi! We hope you're enjoying your beautifully trimmed trees. If you have a moment, we'd really appreciate a quick review on Google or Facebook. It helps others find us!",
    type: "follow_up",
  },
  {
    id: "4",
    name: "Negative Review Response",
    message:
      "Thank you for your feedback. We're sorry to hear your experience didn't meet expectations. We'd love the opportunity to make things right - please contact us directly so we can address your concerns.",
    type: "negative_response",
  },
];

const getStatusBadge = (request: ReviewRequest) => {
  if (request.submissionId) {
    const stars = request.rating || 0;
    if (stars >= 4) {
      return (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
          Reviewed - {stars} Stars
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
          Reviewed - {stars} Stars
        </Badge>
      );
    }
  }

  if (request.sentAt) {
    const daysSinceSent = differenceInDays(
      new Date(),
      new Date(request.sentAt),
    );
    if (daysSinceSent > 7) {
      return (
        <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
          Needs Follow-up ({daysSinceSent} days)
        </Badge>
      );
    }
    return (
      <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
        Sent ({daysSinceSent} days ago)
      </Badge>
    );
  }

  return (
    <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
      Pending
    </Badge>
  );
};

const getSentViaBadge = (sentVia: string | null) => {
  switch (sentVia) {
    case "email":
      return (
        <Badge variant="outline" className="gap-1">
          <Mail className="w-3 h-3" /> Email
        </Badge>
      );
    case "sms":
      return (
        <Badge variant="outline" className="gap-1">
          <MessageSquare className="w-3 h-3" /> SMS
        </Badge>
      );
    case "both":
      return (
        <Badge variant="outline" className="gap-1">
          <Send className="w-3 h-3" /> Both
        </Badge>
      );
    default:
      return null;
  }
};

export default function Reviews() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("curated");
  const [selectedTemplate, setSelectedTemplate] =
    useState<ReviewTemplate | null>(null);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);

  // Curated review upload state — the dialog only collects photos. Each save
  // creates one row per uploaded image (platform/rating are defaulted server-
  // side-friendly values so the NOT NULL columns are satisfied).
  const [curatedDialogOpen, setCuratedDialogOpen] = useState(false);
  const [pendingPhotos, setPendingPhotos] = useState<string[]>([]);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: statsData, isLoading: statsLoading } = useQuery<{
    success: boolean;
    data: ReviewStats;
  }>({
    queryKey: ["/api/reviews/stats"],
  });

  const {
    data: requestsData,
    isLoading: requestsLoading,
    refetch,
  } = useQuery<{ success: boolean; data: ReviewRequest[] }>({
    queryKey: ["/api/reviews/requests"],
  });

  const stats = statsData?.data;
  const requests = requestsData?.data || [];

  // Curated reviews feed — what powers the featured widget on quotes/proposals.
  const { data: curatedData, isLoading: curatedLoading } = useQuery<{
    success: boolean;
    data: CuratedReview[];
  }>({
    queryKey: ["/api/reviews"],
  });
  const curatedReviews = curatedData?.data || [];
  const featuredCount = curatedReviews.filter(
    (r) => r.isPublic && Array.isArray(r.photoUrls) && r.photoUrls.length > 0,
  ).length;

  const invalidateCuratedCaches = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/reviews"] });
    queryClient.invalidateQueries({ queryKey: ["/api/reviews/featured"] });
  };

  // One POST per uploaded image so each screenshot is an independent row the
  // widget can rotate through. `platform`/`rating` are required by the schema
  // but unused in the image-only flow, so they get harmless defaults.
  const saveCuratedMutation = useMutation({
    mutationFn: async (photos: string[]) => {
      await Promise.all(
        photos.map((url) =>
          apiRequest("POST", "/api/reviews", {
            platform: "manual",
            rating: 5,
            isPublic: true,
            photoUrls: [url],
          }),
        ),
      );
    },
    onSuccess: () => {
      invalidateCuratedCaches();
      setCuratedDialogOpen(false);
      setPendingPhotos([]);
    },
    onError: (err: any) => {
      toast({
        title: "Couldn't save review",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteCuratedMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/reviews/${id}`),
    onSuccess: () => invalidateCuratedCaches(),
    onError: () =>
      toast({ title: "Couldn't delete review", variant: "destructive" }),
  });

  const togglePublicMutation = useMutation({
    mutationFn: async ({ id, isPublic }: { id: string; isPublic: boolean }) =>
      apiRequest("PUT", `/api/reviews/${id}`, { isPublic }),
    onSuccess: () => invalidateCuratedCaches(),
    onError: () =>
      toast({ title: "Couldn't update visibility", variant: "destructive" }),
  });

  const openCuratedForCreate = () => {
    setPendingPhotos([]);
    setCuratedDialogOpen(true);
  };

  // Upload state for the dialog's photo dropzone. Kept alongside the dialog
  // lifecycle so a mid-upload spinner disappears when the dialog closes.
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoDragActive, setPhotoDragActive] = useState(false);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  const uploadPhotos = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (list.length === 0) return;
    setPhotoUploading(true);
    try {
      const fd = new FormData();
      list.forEach((f) => fd.append("photos", f));
      const res = await fetch("/api/reviews/upload-photos", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Upload failed");
      }
      setPendingPhotos((prev) => [...prev, ...(data.urls as string[])]);
    } catch (err: any) {
      toast({
        title: "Couldn't upload photos",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setPhotoUploading(false);
    }
  };

  const removePhoto = (url: string) => {
    setPendingPhotos((prev) => prev.filter((u) => u !== url));
  };

  const handleDeleteCurated = (review: CuratedReview) => {
    if (!window.confirm("Delete this review? This can't be undone.")) return;
    deleteCuratedMutation.mutate(review.id);
  };

  const filteredRequests = requests.filter(
    (r) =>
      r.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.jobNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.jobAddress?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const needsFollowUp = requests.filter((r) => {
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
        <LogoSidebarTrigger size={36} />
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            Reviews
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Track customer review requests and responses
          </p>
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
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Requests Sent
                  </p>
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
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Reviews Received
                  </p>
                  <p className="text-2xl font-bold">
                    {stats?.totalReceived || 0}
                  </p>
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
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Conversion Rate
                  </p>
                  <p className="text-2xl font-bold">
                    {stats?.conversionRate || 0}%
                  </p>
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
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Average Rating
                  </p>
                  <p className="text-2xl font-bold">
                    {stats?.averageRating || 0}
                  </p>
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
                    {needsFollowUp.length} customer
                    {needsFollowUp.length === 1 ? "" : "s"} need follow-up
                  </p>
                  <p className="text-sm text-orange-600 dark:text-orange-300">
                    These customers were sent review requests more than 7 days
                    ago but haven't responded
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-4"
        >
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="curated">
              Curated
              {featuredCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {featuredCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="requests">
              All Requests
              {requests.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {requests.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="followup">
              Follow-up
              {needsFollowUp.length > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {needsFollowUp.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="links">Review Links</TabsTrigger>
          </TabsList>

          <TabsContent value="curated" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <CardTitle>Curated reviews</CardTitle>
                    <CardDescription>
                      Upload review screenshots. Public uploads appear on
                      quotes, proposals and generated PDFs.
                    </CardDescription>
                  </div>
                  <Button onClick={openCuratedForCreate} size="sm">
                    <Plus className="w-4 h-4 mr-2" /> Upload reviews
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {curatedLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
                  </div>
                ) : curatedReviews.length === 0 ? (
                  <div className="py-8 text-center border border-dashed rounded-lg">
                    <Star className="w-10 h-10 mx-auto text-gray-300 mb-3" />
                    <p className="text-sm text-gray-600">No reviews yet</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Add your first review to start showcasing on quotes.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {curatedReviews
                      .slice()
                      .sort((a, b) => {
                        const bd = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                        const ad = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                        return bd - ad;
                      })
                      .map((review) => {
                        const url = Array.isArray(review.photoUrls)
                          ? review.photoUrls[0]
                          : undefined;
                        const willFeature = !!review.isPublic && !!url;
                        return (
                          <div
                            key={review.id}
                            className="relative group aspect-[3/4] rounded-md border overflow-hidden bg-gray-50"
                          >
                            {url ? (
                              <img
                                src={url}
                                alt="Customer review"
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                                No image
                              </div>
                            )}
                            <div className="absolute top-1 left-1">
                              {willFeature ? (
                                <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-[10px] px-1.5 py-0">
                                  On quotes
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                  Hidden
                                </Badge>
                              )}
                            </div>
                            <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                              <Button
                                size="icon"
                                variant="secondary"
                                className="h-7 w-7"
                                onClick={() =>
                                  togglePublicMutation.mutate({
                                    id: review.id,
                                    isPublic: !review.isPublic,
                                  })
                                }
                                title={
                                  review.isPublic
                                    ? "Hide from quotes"
                                    : "Show on quotes"
                                }
                              >
                                {review.isPublic ? (
                                  <Eye className="w-3.5 h-3.5" />
                                ) : (
                                  <EyeOff className="w-3.5 h-3.5" />
                                )}
                              </Button>
                              <Button
                                size="icon"
                                variant="secondary"
                                className="h-7 w-7"
                                onClick={() => handleDeleteCurated(review)}
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

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
                    Send review request emails from completed jobs to start
                    tracking
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
                            <h3 className="font-medium">
                              {request.customerName}
                            </h3>
                            {getStatusBadge(request)}
                          </div>
                          <div className="text-sm text-gray-500 space-y-1">
                            {request.jobNumber && (
                              <p>Job #{request.jobNumber}</p>
                            )}
                            {request.jobAddress && (
                              <p className="truncate max-w-md">
                                {request.jobAddress}
                              </p>
                            )}
                            <div className="flex items-center gap-3 flex-wrap">
                              {request.sentAt && (
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {format(
                                    new Date(request.sentAt),
                                    "dd MMM yyyy h:mm a",
                                  )}
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
                                      ? "text-yellow-400 fill-yellow-400"
                                      : "text-gray-300"
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

                      {!request.submissionId &&
                        request.sentAt &&
                        differenceInDays(new Date(), new Date(request.sentAt)) >
                          7 && (
                          <div className="mt-3 pt-3 border-t flex items-center gap-2 flex-wrap">
                            <span className="text-sm text-gray-500 mr-2">
                              Follow up:
                            </span>
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
                            <h3 className="font-medium">
                              {request.customerName}
                            </h3>
                            {getStatusBadge(request)}
                          </div>
                          <div className="text-sm text-gray-500 space-y-1">
                            {request.jobNumber && (
                              <p>Job #{request.jobNumber}</p>
                            )}
                            {request.jobAddress && <p>{request.jobAddress}</p>}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t flex items-center gap-2 flex-wrap">
                        <span className="text-sm text-gray-500 mr-2">
                          Follow up:
                        </span>
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
                        {template.type === "thank_you" && "Thank You"}
                        {template.type === "follow_up" && "Follow Up"}
                        {template.type === "negative_response" &&
                          "Negative Response"}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-500 line-clamp-2">
                      {template.message}
                    </p>
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
                          navigator.clipboard.writeText(
                            "https://search.google.com/local/writereview?placeid=ChIJyW5ncp55Zm0R3_iU47Axcn8",
                          );
                        }}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() =>
                        window.open(
                          "https://search.google.com/local/writereview?placeid=ChIJyW5ncp55Zm0R3_iU47Axcn8",
                          "_blank",
                        )
                      }
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
                          navigator.clipboard.writeText(
                            "https://www.facebook.com/TreemarkablesGisborne/reviews",
                          );
                        }}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() =>
                        window.open(
                          "https://www.facebook.com/TreemarkablesGisborne/reviews",
                          "_blank",
                        )
                      }
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

        <Dialog
          open={curatedDialogOpen}
          onOpenChange={(open) => {
            setCuratedDialogOpen(open);
            if (!open) setPendingPhotos([]);
          }}
        >
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Upload reviews</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <input
                ref={photoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) uploadPhotos(e.target.files);
                  e.target.value = "";
                }}
              />
              <div
                role="button"
                tabIndex={0}
                onClick={() => photoInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    photoInputRef.current?.click();
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setPhotoDragActive(true);
                }}
                onDragLeave={() => setPhotoDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setPhotoDragActive(false);
                  if (e.dataTransfer.files) uploadPhotos(e.dataTransfer.files);
                }}
                className={`rounded-md border-2 border-dashed p-6 text-center text-sm cursor-pointer transition-colors ${
                  photoDragActive
                    ? "border-orange-400 bg-orange-50"
                    : "border-gray-300 hover:border-orange-300 hover:bg-orange-50/30"
                }`}
              >
                {photoUploading ? (
                  <span className="inline-flex items-center gap-2 text-gray-500">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Uploading…
                  </span>
                ) : (
                  <span className="text-gray-600">
                    Drop review screenshots here or click to browse
                    <br />
                    <span className="text-xs text-gray-400">
                      PNG, JPG, WebP, GIF — up to 5MB each
                    </span>
                  </span>
                )}
              </div>
              {pendingPhotos.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {pendingPhotos.map((url) => (
                    <div
                      key={url}
                      className="relative group aspect-[3/4] rounded-md border overflow-hidden"
                    >
                      <img
                        src={url}
                        alt="Review"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removePhoto(url)}
                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                        aria-label="Remove photo"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setCuratedDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => saveCuratedMutation.mutate(pendingPhotos)}
                disabled={
                  saveCuratedMutation.isPending ||
                  photoUploading ||
                  pendingPhotos.length === 0
                }
              >
                {saveCuratedMutation.isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selectedTemplate?.name}</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <Label className="mb-2 block">Message</Label>
              <Textarea
                value={selectedTemplate?.message || ""}
                readOnly
                className="min-h-[120px]"
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setTemplateDialogOpen(false)}
              >
                Close
              </Button>
              <Button
                onClick={() => {
                  if (selectedTemplate) {
                    copyTemplate(selectedTemplate.message);
                  }
                }}
              >
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
