import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Star, 
  Send, 
  Mail, 
  MessageSquare, 
  TrendingUp, 
  SkipForward,
  CheckCircle2,
  Clock
} from "lucide-react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";

interface CompletedJob {
  id: string;
  jobNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  address: string;
  completedDate: string;
  reviewRequestId?: string;
  reviewRequestStatus?: string;
  reviewSubmissionId?: string;
  reviewRating?: number;
}

interface ReviewStats {
  totalSent: number;
  totalReceived: number;
  conversionRate: number;
  averageRating: number;
}

interface ReviewSubmission {
  id: string;
  rating: number;
  comment: string;
  postedToGoogle: boolean;
  postedToFacebook: boolean;
  googlePostStatus: string;
  facebookPostStatus: string;
  internalStatus: string;
  submittedAt: string;
  jobNumber: string;
  customerName: string;
  jobAddress: string;
}

export default function Reputation() {
  const { toast } = useToast();
  const [selectedJob, setSelectedJob] = useState<CompletedJob | null>(null);
  const [sendVia, setSendVia] = useState<"sms" | "email" | "both">("both");

  const { data: stats } = useQuery<{ data: ReviewStats }>({
    queryKey: ["/api/reviews/stats"],
  });

  const { data: completedJobs, isLoading: jobsLoading } = useQuery<{ data: CompletedJob[] }>({
    queryKey: ["/api/reviews/completed-jobs"],
  });

  const { data: submissions } = useQuery<{ data: ReviewSubmission[] }>({
    queryKey: ["/api/reviews/submissions"],
  });

  const sendRequestMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/reviews/send-request", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reviews/completed-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reviews/stats"] });
      setSelectedJob(null);
      toast({
        title: "Review request sent!",
        description: `Request sent to ${selectedJob?.customerName}`,
      });
    },
    onError: () => {
      toast({
        title: "Failed to send request",
        description: "Please try again",
        variant: "destructive",
      });
    },
  });

  const skipMutation = useMutation({
    mutationFn: async (requestId: string) => {
      return await apiRequest("POST", `/api/reviews/${requestId}/skip`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reviews/completed-jobs"] });
      toast({
        title: "Job skipped",
        description: "This job has been marked as skipped",
      });
    },
  });

  const handleSendRequest = () => {
    if (!selectedJob) return;

    sendRequestMutation.mutate({
      jobId: selectedJob.id,
      customerId: selectedJob.customerId,
      jobNumber: selectedJob.jobNumber,
      customerName: selectedJob.customerName,
      customerEmail: selectedJob.customerEmail,
      customerPhone: selectedJob.customerPhone,
      sentVia: sendVia,
    });
  };

  const pendingJobs = completedJobs?.data.filter(
    job => !job.reviewRequestId || job.reviewRequestStatus === 'pending'
  ) || [];

  const sentJobs = completedJobs?.data.filter(
    job => job.reviewRequestStatus === 'sent' && !job.reviewSubmissionId
  ) || [];

  const reviewedJobs = completedJobs?.data.filter(
    job => job.reviewSubmissionId
  ) || [];

  const renderStarRating = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${
              star <= rating
                ? "fill-yellow-400 text-yellow-400"
                : "text-muted-foreground"
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="h-full overflow-auto">
      <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Reputation Management</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Collect and manage customer reviews
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Requests Sent</CardTitle>
              <Send className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold">{stats?.data.totalSent || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Reviews Received</CardTitle>
              <Star className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold">{stats?.data.totalReceived || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Conversion Rate</CardTitle>
              <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold">{stats?.data.conversionRate || 0}%</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Avg Rating</CardTitle>
              <Star className="h-3 w-3 sm:h-4 sm:w-4 text-yellow-400 fill-yellow-400" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold">{stats?.data.averageRating || 0}</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="pending" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pending" data-testid="tab-pending">
              Pending ({pendingJobs.length})
            </TabsTrigger>
            <TabsTrigger value="sent" data-testid="tab-sent">
              Sent ({sentJobs.length})
            </TabsTrigger>
            <TabsTrigger value="reviews" data-testid="tab-reviews">
              Reviews ({submissions?.data.length || 0})
            </TabsTrigger>
          </TabsList>

          {/* Pending Jobs - Queue */}
          <TabsContent value="pending" className="space-y-3 sm:space-y-4 mt-3 sm:mt-4">
            {jobsLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : pendingJobs.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <CheckCircle2 className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 text-green-500" />
                  <p className="text-sm sm:text-base">All completed jobs have been handled!</p>
                </CardContent>
              </Card>
            ) : (
              pendingJobs.map((job) => (
                <Card key={job.id} className="overflow-hidden">
                  <CardContent className="p-3 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2 mb-2">
                          <Badge variant="outline" className="text-xs">#{job.jobNumber}</Badge>
                          {job.completedDate && (
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {format(new Date(job.completedDate), "MMM d, yyyy")}
                            </span>
                          )}
                        </div>
                        <h3 className="font-semibold text-sm sm:text-base truncate">{job.customerName}</h3>
                        <p className="text-xs sm:text-sm text-muted-foreground line-clamp-1 mt-1">{job.address}</p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {job.customerPhone && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <MessageSquare className="h-3 w-3" />
                              <span className="truncate">{job.customerPhone}</span>
                            </div>
                          )}
                          {job.customerEmail && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Mail className="h-3 w-3" />
                              <span className="truncate">{job.customerEmail}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => setSelectedJob(job)}
                          data-testid={`button-send-request-${job.id}`}
                          className="flex-1 sm:flex-none"
                        >
                          <Send className="h-4 w-4 mr-1.5" />
                          Send Request
                        </Button>
                        {job.reviewRequestId && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => skipMutation.mutate(job.reviewRequestId!)}
                            data-testid={`button-skip-${job.id}`}
                          >
                            <SkipForward className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Sent - Awaiting Response */}
          <TabsContent value="sent" className="space-y-3 sm:space-y-4 mt-3 sm:mt-4">
            {sentJobs.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Clock className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3" />
                  <p className="text-sm sm:text-base">No pending review requests</p>
                </CardContent>
              </Card>
            ) : (
              sentJobs.map((job) => (
                <Card key={job.id}>
                  <CardContent className="p-3 sm:p-6">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="text-xs">#{job.jobNumber}</Badge>
                          <Badge variant="secondary" className="text-xs">
                            <Clock className="h-3 w-3 mr-1" />
                            Awaiting
                          </Badge>
                        </div>
                        <h3 className="font-semibold text-sm sm:text-base truncate">{job.customerName}</h3>
                        <p className="text-xs sm:text-sm text-muted-foreground line-clamp-1 mt-1">{job.address}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Submitted Reviews */}
          <TabsContent value="reviews" className="space-y-3 sm:space-y-4 mt-3 sm:mt-4">
            {!submissions?.data || submissions.data.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Star className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3" />
                  <p className="text-sm sm:text-base">No reviews submitted yet</p>
                </CardContent>
              </Card>
            ) : (
              submissions.data.map((review) => (
                <Card key={review.id}>
                  <CardContent className="p-3 sm:p-6">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="text-xs">#{review.jobNumber}</Badge>
                            {renderStarRating(review.rating)}
                          </div>
                          <h3 className="font-semibold text-sm sm:text-base truncate">{review.customerName}</h3>
                          <p className="text-xs sm:text-sm text-muted-foreground line-clamp-1">{review.jobAddress}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground whitespace-nowrap">
                            {format(new Date(review.submittedAt), "MMM d, yyyy")}
                          </p>
                        </div>
                      </div>

                      {review.comment && (
                        <p className="text-xs sm:text-sm text-muted-foreground italic border-l-2 pl-3">
                          "{review.comment}"
                        </p>
                      )}

                      <div className="flex flex-wrap gap-2">
                        {review.rating >= 4 ? (
                          <>
                            <Badge variant={review.googlePostStatus === 'posted' ? 'default' : 'secondary'} className="text-xs">
                              Google: {review.googlePostStatus}
                            </Badge>
                            <Badge variant={review.facebookPostStatus === 'posted' ? 'default' : 'secondary'} className="text-xs">
                              Facebook: {review.facebookPostStatus}
                            </Badge>
                          </>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            Internal Review: {review.internalStatus}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Send Request Dialog */}
      <Dialog open={!!selectedJob} onOpenChange={() => setSelectedJob(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send Review Request</DialogTitle>
            <DialogDescription>
              Request a review from {selectedJob?.customerName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Customer Details</Label>
              <div className="text-sm space-y-1">
                <p className="text-muted-foreground">Job #{selectedJob?.jobNumber}</p>
                {selectedJob?.customerPhone && (
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedJob.customerPhone}</span>
                  </div>
                )}
                {selectedJob?.customerEmail && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{selectedJob.customerEmail}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium">Send via</Label>
              <RadioGroup value={sendVia} onValueChange={(v) => setSendVia(v as any)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="sms" id="sms" data-testid="radio-sms" />
                  <Label htmlFor="sms" className="font-normal cursor-pointer">
                    SMS only
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="email" id="email" data-testid="radio-email" />
                  <Label htmlFor="email" className="font-normal cursor-pointer">
                    Email only
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="both" id="both" data-testid="radio-both" />
                  <Label htmlFor="both" className="font-normal cursor-pointer">
                    Both SMS and Email
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setSelectedJob(null)}
              data-testid="button-cancel-send"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendRequest}
              disabled={sendRequestMutation.isPending}
              data-testid="button-confirm-send"
            >
              {sendRequestMutation.isPending ? "Sending..." : "Send Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
