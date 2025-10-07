import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, AlertCircle, Loader2, ArrowLeft, FileText } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { ProposalTemplate } from "@/components/ProposalTemplate";

export default function ProposalAccept() {
  const { proposalId } = useParams();
  const [acceptanceStatus, setAcceptanceStatus] = useState<'viewing' | 'success' | 'error' | 'already_accepted'>('viewing');
  
  // Fetch proposal, customer, and template in one optimized request
  const { data: proposalDataResponse, isLoading: proposalLoading } = useQuery({
    queryKey: ["/api/proposals", proposalId, "public"],
    enabled: !!proposalId,
  });

  // Accept proposal mutation
  const acceptProposalMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/proposals/${proposalId}/accept`);
      return response;
    },
    onSuccess: (response: any) => {
      console.log('Proposal accepted successfully:', response);
      setAcceptanceStatus('success');
    },
    onError: (error: any) => {
      console.error('Proposal acceptance error:', error);
      if (error.message?.includes('already been accepted')) {
        setAcceptanceStatus('already_accepted');
      } else {
        setAcceptanceStatus('error');
      }
    }
  });

  // Extract data from combined response
  const proposal = proposalDataResponse?.data?.proposal;
  const customer = proposalDataResponse?.data?.customer;
  const template = proposalDataResponse?.data?.template || {
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

  // Check if proposal is already accepted when page loads
  useEffect(() => {
    if (proposal && acceptanceStatus === 'viewing') {
      if (proposal.status === 'accepted') {
        setAcceptanceStatus('already_accepted');
      }
    }
  }, [proposal, acceptanceStatus]);

  // Loading state - show while fetching proposal
  if (proposalLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <div className="mb-6">
              <Loader2 className="w-16 h-16 text-orange-600 animate-spin mx-auto" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Loading Proposal</h1>
            <p className="text-gray-600">
              Please wait...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state - proposal not found
  if (!proposal) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Proposal Not Found</h1>
            <p className="text-gray-600 mb-6">
              The proposal you're looking for doesn't exist or may have been removed.
            </p>
            <Link href="/">
              <Button variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Go to Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state - acceptance failed
  if (acceptanceStatus === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Acceptance Failed</h1>
            <p className="text-gray-600 mb-6">
              We couldn't accept your proposal at this time. Please try again or contact us for assistance.
            </p>
            <div className="flex flex-col gap-2">
              <Button 
                onClick={() => {
                  acceptProposalMutation.mutate();
                }}
                disabled={acceptProposalMutation.isPending}
                className="bg-orange-600 hover:bg-orange-700"
              >
                Try Again
              </Button>
              <Link href={`/proposal/${proposalId}`}>
                <Button variant="outline" className="w-full">
                  <FileText className="w-4 h-4 mr-2" />
                  View Proposal
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Viewing state - show proposal with Accept button
  if (acceptanceStatus === 'viewing') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white">
        {/* Fixed Header with Accept Button - Safari compatible */}
        <div className="fixed top-0 left-0 right-0 z-[100] bg-white border-b border-gray-200 shadow-lg">
          <div className="max-w-4xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
            <div className="flex items-center justify-between gap-3 sm:gap-4">
              <div className="flex-1 min-w-0">
                <h1 className="text-base sm:text-lg font-bold text-gray-900 truncate">Review Your Proposal</h1>
                <div className="flex flex-wrap gap-2 mt-0.5 sm:mt-1">
                  <span className="text-xs sm:text-sm text-gray-600">
                    {proposal.proposalNumber}
                  </span>
                  {customer && (
                    <>
                      <span className="text-xs sm:text-sm text-gray-400">•</span>
                      <span className="text-xs sm:text-sm text-gray-600 truncate">{customer.name}</span>
                    </>
                  )}
                </div>
              </div>
              <Button 
                onClick={() => acceptProposalMutation.mutate()}
                disabled={acceptProposalMutation.isPending}
                className="bg-green-600 hover:bg-green-700 text-white whitespace-nowrap shrink-0 shadow-lg"
                size="default"
                data-testid="button-accept-proposal-sticky"
              >
                {acceptProposalMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Accept Proposal
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Accept Proposal
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Spacer for fixed header */}
        <div className="h-[72px]"></div>

        {/* Proposal Details */}
        <div className="max-w-4xl mx-auto px-4 py-8 pb-24">
          <Card>
            <CardContent className="p-0">
              <ProposalTemplate
                proposal={proposal}
                customer={customer}
                template={template}
                sections={proposal.sections || []}
                showActions={false}
                className="border-0"
              />
            </CardContent>
          </Card>

          {/* Accept Button */}
          <Card className="mt-6">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-1">Ready to Accept?</h2>
                  <p className="text-sm text-gray-600">
                    By accepting this proposal, you agree to proceed with the work as outlined above.
                  </p>
                </div>
                <Button 
                  onClick={() => acceptProposalMutation.mutate()}
                  disabled={acceptProposalMutation.isPending}
                  className="bg-green-600 hover:bg-green-700 text-white whitespace-nowrap"
                  size="lg"
                  data-testid="button-accept-proposal"
                >
                  {acceptProposalMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Accepting...
                    </>
                  ) : (
                    <>
                      <Check className="w-5 h-5 mr-2" />
                      Accept Proposal
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Success state - proposal accepted or already accepted
  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      {/* Success Banner */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-start gap-4">
            <div className="shrink-0">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <Check className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                {acceptanceStatus === 'already_accepted' ? 'Proposal Already Accepted' : 'Proposal Accepted Successfully!'}
              </h1>
              <p className="text-gray-600 mb-4">
                {acceptanceStatus === 'already_accepted' 
                  ? 'This proposal has already been accepted. Your work order has been created and we will be in touch shortly.'
                  : 'Thank you for accepting our proposal. Your work order has been created and we will contact you shortly to schedule the work.'}
              </p>
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-semibold text-gray-700">Proposal #:</span>
                  <span className="text-gray-900">{proposal.proposalNumber}</span>
                </div>
                {customer && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-semibold text-gray-700">Customer:</span>
                    <span className="text-gray-900">{customer.name}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Proposal Details */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Card>
          <CardContent className="p-0">
            <ProposalTemplate
              proposal={proposal}
              customer={customer}
              template={template}
              sections={proposal.sections || []}
              showActions={false}
              className="border-0"
            />
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card className="mt-6">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">What Happens Next?</h2>
            <div className="space-y-3 text-gray-600">
              <p className="flex items-start gap-2">
                <Check className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                <span>Your proposal has been accepted and converted to a work order</span>
              </p>
              <p className="flex items-start gap-2">
                <Check className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                <span>We will contact you within 1-2 business days to schedule the work</span>
              </p>
              <p className="flex items-start gap-2">
                <Check className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                <span>If you have any questions, please contact us at {template.companyPhone}</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
