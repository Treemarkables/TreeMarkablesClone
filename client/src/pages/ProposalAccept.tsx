import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check, AlertCircle, Download, Loader2, ArrowLeft, ShieldCheck } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { ProposalTemplate } from "@/components/ProposalTemplate";
import { BlockRenderedProposal } from "@/components/BlockRenderedProposal";
import type { DocumentBlock, DocumentTemplate } from "@shared/schema";

type AcceptanceStatus = 'viewing' | 'pending_deposit' | 'deposit_cancelled' | 'success';

interface DepositInfo {
  depositAmount: number;
  depositType: 'percent' | 'fixed' | 'none' | null;
  depositValue: string | number | null;
  totalAmount: number;
}

function formatNzd(n: number): string {
  return new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' }).format(n || 0);
}

export default function ProposalAccept() {
  const { proposalId } = useParams();
  const [acceptanceStatus, setAcceptanceStatus] = useState<AcceptanceStatus>('viewing');
  const [depositInfo, setDepositInfo] = useState<DepositInfo | null>(null);
  const [selectedChoices, setSelectedChoices] = useState<Record<string, string>>({});
  const [selectedOptionalItems, setSelectedOptionalItems] = useState<Record<string, boolean>>({});

  // Detect ?deposit=success / ?deposit=cancelled return from Stripe Checkout
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const dep = params.get('deposit');
    if (dep === 'success') {
      setAcceptanceStatus('success');
    } else if (dep === 'cancelled') {
      setAcceptanceStatus('deposit_cancelled');
    }
  }, []);

  // Quotes share this page (same proposals row, templateUsed === 'quote').
  // The ?type=quote hint from the email/PDF link sets the labels before data
  // loads; once loaded, the record itself is authoritative.
  const quoteTypeHint = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('type') === 'quote';

  // Tell the server the customer opened the document. Idempotent server-side:
  // the first hit flips status sent → viewed and writes a diary entry.
  const viewedSentRef = useRef(false);
  useEffect(() => {
    if (!proposalId || viewedSentRef.current) return;
    viewedSentRef.current = true;
    fetch(`/api/proposals/${proposalId}/viewed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }).catch(() => {});
  }, [proposalId]);

  const handleChoiceSelect = (lineItemId: string, choiceId: string) => {
    setSelectedChoices(prev => ({ ...prev, [lineItemId]: choiceId }));
  };

  const handleOptionalToggle = (lineItemId: string, selected: boolean) => {
    setSelectedOptionalItems(prev => ({ ...prev, [lineItemId]: selected }));
  };

  const { data: proposalDataResponse, isLoading: proposalLoading, refetch: refetchProposal } = useQuery<any>({
    queryKey: ["/api/proposals", proposalId, "public"],
    enabled: !!proposalId,
  });

  // Accept mutation. May return requiresDeposit=true, in which case we open
  // the deposit modal instead of moving to the success state.
  const acceptProposalMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/proposals/${proposalId}/accept`, {
        selectedChoices: Object.keys(selectedChoices).length > 0 ? selectedChoices : undefined,
        selectedOptionalItems: Object.keys(selectedOptionalItems).length > 0 ? selectedOptionalItems : undefined,
      });
      const data = await response.json();
      return data;
    },
    onSuccess: (data: any) => {
      if (data?.requiresDeposit) {
        const info: DepositInfo = {
          depositAmount: Number(data?.data?.depositAmount ?? 0),
          depositType: (data?.data?.depositType ?? null) as DepositInfo['depositType'],
          depositValue: data?.data?.depositValue ?? null,
          totalAmount: Number(data?.data?.totalAmount ?? 0),
        };
        setDepositInfo(info);
        setAcceptanceStatus('pending_deposit');
      } else {
        setAcceptanceStatus('success');
      }
    },
    onError: () => {
      setAcceptanceStatus('success');
    },
  });

  // Creates the Stripe Checkout Session and redirects.
  const depositCheckoutMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/proposals/${proposalId}/deposit-checkout`, {});
      const data = await response.json();
      return data;
    },
    onSuccess: (data: any) => {
      const url = data?.data?.url;
      if (url) {
        window.location.href = url;
      }
    },
  });

  const proposal = proposalDataResponse?.data?.proposal;
  const customer = proposalDataResponse?.data?.customer;
  const job = proposalDataResponse?.data?.job;
  const isQuote = proposal ? proposal.templateUsed === 'quote' : quoteTypeHint;
  const docLabel = isQuote ? 'Quote' : 'Proposal';
  const docLower = isQuote ? 'quote' : 'proposal';
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

  // If we already loaded the proposal and it's pending deposit (e.g. customer
  // returned via Stripe cancel link), surface the modal automatically.
  useEffect(() => {
    if (!proposal) return;
    if (proposal.status === 'accepted_pending_deposit' && !depositInfo) {
      const depositAmount = Number(
        (proposal.depositType === 'percent'
          ? Number(proposal.totalAmount || 0) * (Number(proposal.depositValue || 0) / 100)
          : proposal.depositType === 'fixed'
            ? Math.min(Number(proposal.depositValue || 0), Number(proposal.totalAmount || 0))
            : 0) || 0,
      );
      setDepositInfo({
        depositAmount: Math.round(depositAmount * 100) / 100,
        depositType: proposal.depositType,
        depositValue: proposal.depositValue,
        totalAmount: Number(proposal.totalAmount || 0),
      });
      if (acceptanceStatus === 'viewing') setAcceptanceStatus('pending_deposit');
    }
  }, [proposal, depositInfo, acceptanceStatus]);

  if (proposalLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <div className="mb-6">
              <Loader2 className="w-16 h-16 text-orange-600 animate-spin mx-auto" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Loading {docLabel}</h1>
            <p className="text-gray-600">Please wait...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{docLabel} Not Found</h1>
            <p className="text-gray-600 mb-6">
              The {docLower} you're looking for doesn't exist or may have been removed.
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

  const depositModalOpen = acceptanceStatus === 'pending_deposit' || acceptanceStatus === 'deposit_cancelled';

  const depositDescription = depositInfo
    ? depositInfo.depositType === 'percent'
      ? `A deposit of ${depositInfo.depositValue}% (${formatNzd(depositInfo.depositAmount)} of ${formatNzd(depositInfo.totalAmount)}) is required before this ${docLower} can be finalized.`
      : `A deposit of ${formatNzd(depositInfo.depositAmount)} is required before this ${docLower} can be finalized.`
    : '';

  const depositDialog = depositInfo ? (
    <Dialog open={depositModalOpen} onOpenChange={(open) => {
      if (!open && acceptanceStatus === 'deposit_cancelled') {
        setAcceptanceStatus('viewing');
      }
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Deposit required to confirm acceptance</DialogTitle>
          <DialogDescription>
            {depositDescription}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border bg-muted/40 p-4 my-2">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Deposit due now</span>
            <span className="text-2xl font-bold text-gray-900" data-testid="text-deposit-amount">
              {formatNzd(depositInfo.depositAmount)}
            </span>
          </div>
          {depositInfo.totalAmount > 0 && (
            <div className="flex items-baseline justify-between mt-2 text-sm text-muted-foreground">
              <span>Balance after deposit</span>
              <span>{formatNzd(Math.max(0, depositInfo.totalAmount - depositInfo.depositAmount))}</span>
            </div>
          )}
        </div>

        {acceptanceStatus === 'deposit_cancelled' && (
          <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>Your deposit wasn't completed. Your acceptance is saved — pay the deposit to confirm the booking.</span>
          </div>
        )}

        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="w-4 h-4" />
          Secure payment via Stripe. Cards, Apple Pay and Google Pay accepted.
        </p>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => setAcceptanceStatus('viewing')}
            data-testid="button-deposit-later"
          >
            Pay later
          </Button>
          <Button
            onClick={() => depositCheckoutMutation.mutate()}
            disabled={depositCheckoutMutation.isPending}
            data-testid="button-pay-deposit"
          >
            {depositCheckoutMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Redirecting...
              </>
            ) : (
              <>Pay deposit of {formatNzd(depositInfo.depositAmount)}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ) : null;

  if (acceptanceStatus === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white">
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
                  {docLabel} Accepted Successfully!
                </h1>
                <p className="text-gray-600 mb-4">
                  Thank you for accepting our {docLower}. Treemarkables will be in touch soon to schedule your job.
                </p>
                <div className="flex flex-wrap gap-3">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-semibold text-gray-700">{docLabel} #:</span>
                    <span className="text-gray-900">{proposal.proposalNumber}</span>
                  </div>
                  {customer && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-semibold text-gray-700">Customer:</span>
                      <span className="text-gray-900">{customer.name}</span>
                    </div>
                  )}
                </div>
                <div className="mt-4">
                  <Button variant="outline" asChild data-testid="button-download-pdf-success">
                    <a href={`/api/proposals/${proposalId}/pdf`}>
                      <Download className="w-4 h-4 mr-2" />
                      Download PDF
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-8">
          <Card>
            <CardContent className="p-0">
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
                      className="border-0"
                    />
                  );
                }
                return (
                  <ProposalTemplate
                    proposal={proposal}
                    customer={customer}
                    job={job}
                    template={template}
                    sections={proposal.sections || []}
                    showActions={false}
                    className="border-0"
                    allowChoiceSelection={false}
                    selectedChoices={selectedChoices}
                  />
                );
              })()}
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">What Happens Next?</h2>
              <div className="space-y-3 text-gray-600">
                <p className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                  <span>Your {docLower} has been accepted and converted to a work order</span>
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

  // Viewing (or deposit-pending) state — show proposal with Accept button
  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white">
      <div className="fixed top-0 left-0 right-0 z-[100] bg-white border-b border-gray-200 shadow-lg">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-3 sm:gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-gray-900 truncate">Review Your {docLabel}</h1>
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
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="icon" asChild data-testid="button-download-pdf">
                <a href={`/api/proposals/${proposalId}/pdf`} aria-label="Download PDF">
                  <Download className="w-4 h-4" />
                </a>
              </Button>
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
                    Accepting...
                  </>
                ) : proposal?.status === 'accepted' ? (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Already Accepted
                  </>
                ) : proposal?.status === 'accepted_pending_deposit' ? (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Continue to deposit
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Accept {docLabel}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="h-[72px]"></div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <Card>
          <CardContent className="p-0">
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
                    className="border-0"
                  />
                );
              }
              return (
                <ProposalTemplate
                  proposal={proposal}
                  customer={customer}
                  job={job}
                  template={template}
                  sections={proposal.sections || []}
                  showActions={false}
                  className="border-0"
                  allowChoiceSelection={proposal?.status !== 'accepted'}
                  selectedChoices={selectedChoices}
                  onChoiceSelect={handleChoiceSelect}
                  selectedOptionalItems={selectedOptionalItems}
                  onOptionalToggle={handleOptionalToggle}
                />
              );
            })()}
          </CardContent>
        </Card>
      </div>

      {depositDialog}
    </div>
  );
}
