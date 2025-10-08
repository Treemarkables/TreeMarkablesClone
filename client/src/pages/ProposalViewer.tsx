import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Mail, Check, Clock } from "lucide-react";
import { ProposalTemplate } from "@/components/ProposalTemplate";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ProposalViewerProps {}

export default function ProposalViewer({}: ProposalViewerProps) {
  const { proposalId } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // First try to fetch proposal directly by ID
  const { data: proposalResponse, isLoading: proposalLoading, error: proposalError } = useQuery({
    queryKey: ["/api/proposals", proposalId],
    enabled: !!proposalId,
  });

  // If direct fetch fails (404), try to find proposal by job ID
  const { data: proposalsByJobResponse, isLoading: proposalsByJobLoading } = useQuery({
    queryKey: ["/api/proposals", { jobId: proposalId }],
    queryFn: async () => {
      try {
        const response = await fetch(`/api/proposals?jobId=${proposalId}`);
        if (!response.ok) {
          return { success: false, data: [], count: 0 };
        }
        return response.json();
      } catch (error) {
        console.error('Error fetching proposals by job ID:', error);
        return { success: false, data: [], count: 0 };
      }
    },
    enabled: !!proposalId && !proposalLoading && !proposalResponse?.success,
  });

  // Use either direct proposal or first proposal found by job ID
  const actualProposalResponse = proposalResponse?.success ? proposalResponse : 
    (proposalsByJobResponse?.success && proposalsByJobResponse.data.length > 0) ? 
      { success: true, data: proposalsByJobResponse.data[0] } : 
      proposalResponse;

  const actualLoading = proposalLoading || proposalsByJobLoading;

  // Fetch customer data if proposal has customerId
  const { data: customerResponse } = useQuery({
    queryKey: ["/api/customers", actualProposalResponse?.data?.customerId],
    enabled: !!actualProposalResponse?.data?.customerId,
  });

  // Fetch default proposal template
  const { data: templateResponse } = useQuery({
    queryKey: ["/api/templates/default/proposal"],
  });

  // Accept proposal mutation
  const acceptProposalMutation = useMutation({
    mutationFn: async () => {
      const actualId = actualProposalResponse?.data?.id || proposalId;
      console.log('Accepting proposal:', actualId);
      const response = await apiRequest('POST', `/api/proposals/${actualId}/accept`);
      return response;
    },
    onSuccess: (response: any) => {
      console.log('Proposal accepted successfully:', response);
      toast({
        title: "Proposal Accepted!",
        description: "Your proposal has been accepted and converted to a work order. We'll be in touch to schedule the work.",
      });
      // Refresh proposal data to show updated status
      queryClient.invalidateQueries({ queryKey: ["/api/proposals", proposalId] });
      queryClient.invalidateQueries({ queryKey: ["/api/proposals", { jobId: proposalId }] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
    onError: (error: any) => {
      console.error('Proposal acceptance error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to accept proposal. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleAcceptProposal = () => {
    acceptProposalMutation.mutate();
  };

  if (actualLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading proposal...</p>
        </div>
      </div>
    );
  }

  if (!actualProposalResponse?.success || !actualProposalResponse?.data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Proposal Not Found</h1>
            <p className="text-gray-600 mb-4">
              The proposal you're looking for doesn't exist or may have been removed.
            </p>
            <Link href="/">
              <Button variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Go Back
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const proposal = actualProposalResponse.data;
  const customer = customerResponse?.data;
  const template = templateResponse?.data || {
    id: 'default',
    name: 'Default Template',
    type: 'proposal',
    companyName: 'Treemarkables',
    companyPhone: '+64 6 867 1234',
    companyEmail: 'info@treemarkables.co.nz',
    companyAddress: 'Gisborne, New Zealand',
    paymentTerms: 'This proposal is valid for 30 days from the date above. Payment due within 7 days of acceptance.',
    gstNumber: '123-456-789'
  };

  const isExpired = proposal.validUntil && new Date(proposal.validUntil) < new Date();
  const isAccepted = proposal.status === 'accepted';

  return (
    <div className="min-h-screen bg-gray-50 w-full overflow-x-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-2 sm:px-4 py-3 sm:py-4 w-full">
        <div className="max-w-4xl mx-auto w-full">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <Link href="/">
                <Button variant="outline" size="sm" className="shrink-0">
                  <ArrowLeft className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Back</span>
                </Button>
              </Link>
              <div className="min-w-0 flex-1">
                <h1 className="text-base sm:text-xl font-semibold text-gray-900 truncate">
                  Proposal #{proposal.proposalNumber || proposal.id}
                </h1>
                <p className="text-xs sm:text-sm text-gray-600 truncate">
                  {customer?.name || 'Customer'} - {new Date(proposal.createdAt).toLocaleDateString()}
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
              <Button variant="outline" size="sm" className="hidden sm:flex">
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Proposal Content */}
      <div className="max-w-4xl mx-auto py-4 sm:py-6 px-2 sm:px-4 w-full">
        {/* Status Banner */}
        {isAccepted && (
          <div className="bg-green-100 border border-green-300 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <Check className="w-5 h-5 text-green-600 mr-2" />
              <span className="text-green-800 font-medium">Proposal Accepted</span>
              <span className="text-green-600 ml-2">- We'll be in touch to schedule the work!</span>
            </div>
          </div>
        )}

        {isExpired && !isAccepted && (
          <div className="bg-red-100 border border-red-300 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <Clock className="w-5 h-5 text-red-600 mr-2" />
              <span className="text-red-800 font-medium">Proposal Expired</span>
              <span className="text-red-600 ml-2">- Please contact us for an updated proposal</span>
            </div>
          </div>
        )}

        <ProposalTemplate
          template={template}
          proposal={proposal}
          customer={customer}
          sections={[]} // TODO: Fetch proposal sections when implemented
          showActions={false}
          className="bg-white"
        />
      </div>
    </div>
  );
}