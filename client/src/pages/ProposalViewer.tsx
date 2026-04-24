import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Mail, Check, Clock } from "lucide-react";
import { ProposalTemplate } from "@/components/ProposalTemplate";
import { BlockRenderedProposal } from "@/components/BlockRenderedProposal";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { DocumentBlock, DocumentTemplate } from "@shared/schema";

interface ProposalViewerProps {}

export default function ProposalViewer({}: ProposalViewerProps) {
  const { proposalId } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const viewedRef = useRef(false);
  const [selectedChoices, setSelectedChoices] = useState<
    Record<string, string>
  >({});
  const [selectedOptionalItems, setSelectedOptionalItems] = useState<
    Record<string, boolean>
  >({});

  const handleChoiceSelect = (lineItemId: string, choiceId: string) => {
    setSelectedChoices((prev) => ({ ...prev, [lineItemId]: choiceId }));
  };

  const handleOptionalToggle = (lineItemId: string, selected: boolean) => {
    setSelectedOptionalItems((prev) => ({ ...prev, [lineItemId]: selected }));
  };

  const handleBackClick = () => {
    // Check if there's a page to go back to in the history
    if (window.history.length > 1) {
      window.history.back();
    } else {
      // Fallback to dispatch board if no history
      setLocation("/dispatch");
    }
  };

  // First try to fetch proposal directly by ID
  const {
    data: proposalResponse,
    isLoading: proposalLoading,
    error: proposalError,
  } = useQuery({
    queryKey: ["/api/proposals", proposalId],
    enabled: !!proposalId,
  });

  // If direct fetch fails (404), try to find proposal by job ID
  const { data: proposalsByJobResponse, isLoading: proposalsByJobLoading } =
    useQuery({
      queryKey: ["/api/proposals", { jobId: proposalId }],
      queryFn: async () => {
        try {
          const response = await fetch(`/api/proposals?jobId=${proposalId}`);
          if (!response.ok) return { success: false, data: [], count: 0 };
          return response.json();
        } catch (error) {
          console.error("Error fetching proposals by job ID:", error);
          return { success: false, data: [], count: 0 };
        }
      },
      enabled: !!proposalId && !proposalLoading && !proposalResponse?.success,
    });

  // The job-ID list endpoint returns proposals without sections — do a follow-up fetch
  const fallbackProposalId =
    !proposalResponse?.success &&
    proposalsByJobResponse?.success &&
    proposalsByJobResponse.data?.length > 0
      ? proposalsByJobResponse.data[0].id
      : null;

  const { data: fallbackFullResponse, isLoading: fallbackLoading } = useQuery({
    queryKey: ["/api/proposals", fallbackProposalId],
    enabled: !!fallbackProposalId && fallbackProposalId !== proposalId,
  });

  // Use either direct proposal, or the full follow-up fetch from the job-ID search
  const actualProposalResponse = proposalResponse?.success
    ? proposalResponse
    : fallbackFullResponse?.success
      ? fallbackFullResponse
      : proposalsByJobResponse?.success && proposalsByJobResponse.data?.length > 0
        ? { success: true, data: proposalsByJobResponse.data[0] }
        : proposalResponse;

  const actualLoading = proposalLoading || proposalsByJobLoading || fallbackLoading;

  // Fetch customer data if proposal has customerId
  const { data: customerResponse } = useQuery({
    queryKey: ["/api/customers", actualProposalResponse?.data?.customerId],
    enabled: !!actualProposalResponse?.data?.customerId,
  });

  // Fetch job data if proposal has jobId
  const { data: jobResponse } = useQuery({
    queryKey: ["/api/jobs", actualProposalResponse?.data?.jobId],
    enabled: !!actualProposalResponse?.data?.jobId,
  });

  // Fetch default proposal template
  const { data: templateResponse } = useQuery({
    queryKey: ["/api/templates/default/proposal"],
  });

  // Mark proposal as viewed when loaded (only once per session)
  useEffect(() => {
    const actualId = actualProposalResponse?.data?.id;
    if (actualId && !viewedRef.current) {
      fetch(`/api/proposals/${actualId}/viewed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
        .then(() => {
          viewedRef.current = true;
        })
        .catch((err) =>
          console.error("Failed to mark proposal as viewed:", err),
        );
    }
  }, [actualProposalResponse?.data?.id]);

  // Accept proposal mutation
  const acceptProposalMutation = useMutation({
    mutationFn: async () => {
      const actualId = actualProposalResponse?.data?.id || proposalId;
      console.log(
        "Accepting proposal:",
        actualId,
        "with selected choices:",
        selectedChoices,
      );
      const response = await apiRequest(
        "POST",
        `/api/proposals/${actualId}/accept`,
        {
          selectedChoices:
            Object.keys(selectedChoices).length > 0
              ? selectedChoices
              : undefined,
        },
      );
      return response;
    },
    onSuccess: (response: any) => {
      console.log("Proposal accepted successfully:", response);
      // Refresh proposal data to show updated status
      queryClient.invalidateQueries({
        queryKey: ["/api/proposals", proposalId],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/proposals", { jobId: proposalId }],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
    onError: (error: any) => {
      console.error("Proposal acceptance error:", error);

      // If already accepted, refresh the proposal to show updated status
      if (error.message?.includes("already been accepted")) {
        queryClient.invalidateQueries({
          queryKey: ["/api/proposals", proposalId],
        });
        queryClient.invalidateQueries({
          queryKey: ["/api/proposals", { jobId: proposalId }],
        });
        toast({
          title: "Already Accepted",
          description: "This proposal has already been accepted.",
        });
      } else {
        toast({
          title: "Error",
          description:
            error.message || "Failed to accept proposal. Please try again.",
          variant: "destructive",
        });
      }
    },
  });

  const handleAcceptProposal = () => {
    acceptProposalMutation.mutate();
  };

  if (actualLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading proposal...</p>
        </div>
      </div>
    );
  }

  if (!actualProposalResponse?.success || !actualProposalResponse?.data) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <h1 className="text-xl font-semibold text-gray-900 mb-2">
              Proposal Not Found
            </h1>
            <p className="text-gray-600 mb-4">
              The proposal you're looking for doesn't exist or may have been
              removed.
            </p>
            <Button
              variant="outline"
              onClick={handleBackClick}
              data-testid="button-back-not-found"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const proposal = actualProposalResponse.data;
  const customer = customerResponse?.data;
  const job = jobResponse?.data; // Same pattern as customer
  const template = templateResponse?.data || {
    id: "default",
    name: "Default Template",
    type: "proposal",
    companyName: "Treemarkables",
    companyPhone: "+64 6 867 1234",
    companyEmail: "info@treemarkables.co.nz",
    companyAddress: "Gisborne, New Zealand",
    paymentTerms:
      "This proposal is valid for 30 days from the date above. Payment due within 7 days of acceptance.",
    gstNumber: "123-456-789",
  };

  const isExpired =
    proposal.validUntil && new Date(proposal.validUntil) < new Date();
  const isAccepted = proposal.status === "accepted";

  return (
    <div className="min-h-screen bg-white w-full overflow-x-hidden">
      {/* Header with safe area padding for mobile notch/Dynamic Island */}
      <div
        className="sticky top-0 z-50 bg-white border-b border-gray-200 w-full shadow-sm"
        style={{
          paddingTop: "max(0.75rem, env(safe-area-inset-top))",
          paddingLeft: "max(0.5rem, env(safe-area-inset-left))",
          paddingRight: "max(0.5rem, env(safe-area-inset-right))",
        }}
      >
        <div className="max-w-4xl mx-auto w-full px-2 sm:px-4 pb-3 sm:pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={handleBackClick}
                data-testid="button-back"
              >
                <ArrowLeft className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Back</span>
              </Button>
              <div className="min-w-0 flex-1">
                <h1 className="text-base sm:text-xl font-semibold text-gray-900 truncate">
                  Proposal #{proposal.proposalNumber || proposal.id}
                </h1>
                <p className="text-xs sm:text-sm text-gray-600 truncate">
                  {customer?.name || "Customer"} -{" "}
                  {new Date(proposal.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="flex gap-2 shrink-0">
              {!isAccepted && !isExpired && (
                <Button
                  onClick={handleAcceptProposal}
                  disabled={acceptProposalMutation.isPending}
                  className="bg-green-600 hover:bg-green-700 text-white flex-1 sm:flex-none"
                  size="sm"
                  data-testid="button-accept-proposal"
                >
                  {acceptProposalMutation.isPending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin sm:mr-2" />
                      <span className="hidden sm:inline">Accepting...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 sm:mr-2" />
                      <span className="hidden sm:inline">Accept</span>
                      <span className="sm:hidden">Accept Proposal</span>
                    </>
                  )}
                </Button>
              )}
              <Button variant="outline" size="sm" className="hidden sm:flex">
                <Mail className="w-4 h-4 mr-2" />
                Email
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  if (!proposalId) return;
                  try {
                    const actualId = proposal?.id || proposalId;
                    const res = await fetch(`/api/proposals/${actualId}/pdf`);
                    if (!res.ok) throw new Error("Failed to generate PDF");
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `Proposal-${proposal?.proposalNumber || actualId}.pdf`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  } catch {
                    toast({ title: "Download failed", description: "Could not generate PDF. Please try again.", variant: "destructive" });
                  }
                }}
              >
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Proposal Content with safe area padding */}
      <div
        className="max-w-4xl mx-auto py-4 sm:py-6 w-full"
        style={{
          paddingLeft: "max(0.5rem, env(safe-area-inset-left))",
          paddingRight: "max(0.5rem, env(safe-area-inset-right))",
          paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
        }}
      >
        {/* Status Banner */}
        {isAccepted && (
          <div className="bg-green-100 border border-green-300 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6 mx-2 sm:mx-4">
            <div className="flex items-start sm:items-center gap-2">
              <Check className="w-5 h-5 text-green-600 shrink-0 mt-0.5 sm:mt-0" />
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                <span className="text-green-800 font-medium text-sm sm:text-base">
                  Proposal Accepted
                </span>
                <span className="text-green-600 text-xs sm:text-base">
                  - We'll be in touch to schedule the work!
                </span>
              </div>
            </div>
          </div>
        )}

        {isExpired && !isAccepted && (
          <div className="bg-red-100 border border-red-300 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6 mx-2 sm:mx-4">
            <div className="flex items-start sm:items-center gap-2">
              <Clock className="w-5 h-5 text-red-600 shrink-0 mt-0.5 sm:mt-0" />
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                <span className="text-red-800 font-medium text-sm sm:text-base">
                  Proposal Expired
                </span>
                <span className="text-red-600 text-xs sm:text-base">
                  - Please contact us for an updated proposal
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="px-2 sm:px-4">
          {(() => {
            const blocks: DocumentBlock[] | null =
              Array.isArray(proposal.blockConfig) && proposal.blockConfig.length > 0
                ? (proposal.blockConfig as DocumentBlock[])
                : null;
            if (blocks) {
              return (
                <BlockRenderedProposal
                  proposal={proposal}
                  customer={customer}
                  job={job}
                  template={template as unknown as DocumentTemplate}
                  blocks={blocks}
                  selectedChoices={selectedChoices}
                  selectedOptionalItems={selectedOptionalItems}
                />
              );
            }
            return (
              <ProposalTemplate
                template={template}
                proposal={proposal}
                customer={customer}
                job={job}
                sections={proposal.sections || []}
                showActions={false}
                className="bg-white"
                allowChoiceSelection={!isAccepted && !isExpired}
                selectedChoices={selectedChoices}
                onChoiceSelect={handleChoiceSelect}
                selectedOptionalItems={selectedOptionalItems}
                onOptionalToggle={!isAccepted && !isExpired ? handleOptionalToggle : undefined}
              />
            );
          })()}
        </div>
      </div>
    </div>
  );
}
