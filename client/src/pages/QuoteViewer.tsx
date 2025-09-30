import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Mail, Check, Clock } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface QuoteViewerProps {}

export default function QuoteViewer({}: QuoteViewerProps) {
  const { quoteId } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // First try to fetch quote directly by ID
  const { data: quoteResponse, isLoading: quoteLoading, error: quoteError } = useQuery({
    queryKey: ["/api/quotes", quoteId],
    enabled: !!quoteId,
  });

  // If direct fetch fails (404), try to find quote by job ID
  const { data: quotesByJobResponse, isLoading: quotesByJobLoading } = useQuery({
    queryKey: ["/api/quotes", { jobId: quoteId }],
    queryFn: async () => {
      try {
        const response = await fetch(`/api/quotes?jobId=${quoteId}`);
        if (!response.ok) {
          return { success: false, data: [], count: 0 };
        }
        return response.json();
      } catch (error) {
        console.error('Error fetching quotes by job ID:', error);
        return { success: false, data: [], count: 0 };
      }
    },
    enabled: !!quoteId && !quoteLoading && !quoteResponse?.success,
  });

  // Use either direct quote or first quote found by job ID
  const actualQuoteResponse = quoteResponse?.success ? quoteResponse : 
    (quotesByJobResponse?.success && quotesByJobResponse.data.length > 0) ? 
      { success: true, data: quotesByJobResponse.data[0] } : 
      quoteResponse;

  const actualLoading = quoteLoading || quotesByJobLoading;

  // Fetch customer data if quote has customerId
  const { data: customerResponse } = useQuery({
    queryKey: ["/api/customers", actualQuoteResponse?.data?.customerId],
    enabled: !!actualQuoteResponse?.data?.customerId,
  });

  // Fetch job data if quote has jobId
  const { data: jobResponse } = useQuery({
    queryKey: ["/api/jobs", actualQuoteResponse?.data?.jobId],
    enabled: !!actualQuoteResponse?.data?.jobId,
  });

  // Accept quote mutation
  const acceptQuoteMutation = useMutation({
    mutationFn: async () => {
      console.log('Accepting quote:', quoteId);
      const response = await apiRequest('POST', `/api/quotes/${quoteId}/accept`);
      return response;
    },
    onSuccess: (response: any) => {
      console.log('Quote accepted successfully:', response);
      toast({
        title: "Quote Accepted!",
        description: "Your quote has been accepted and converted to a work order. We'll be in touch to schedule the work.",
        duration: 1000,
      });
      // Refresh quote data to show updated status
      queryClient.invalidateQueries({ queryKey: ["/api/quotes", quoteId] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
    onError: (error: any) => {
      console.error('Quote acceptance error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to accept quote. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleAcceptQuote = () => {
    acceptQuoteMutation.mutate();
  };

  if (actualLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading quote...</p>
        </div>
      </div>
    );
  }

  if (!actualQuoteResponse?.success || !actualQuoteResponse?.data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Quote Not Found</h1>
            <p className="text-gray-600 mb-4">
              The quote you're looking for doesn't exist or may have been removed.
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

  const quote = actualQuoteResponse.data;
  const customer = customerResponse?.data;
  const job = jobResponse?.data;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NZ', {
      style: 'currency',
      currency: 'NZD'
    }).format(amount);
  };

  const isExpired = quote.validUntil && new Date(quote.validUntil) < new Date();
  const isAccepted = quote.status === 'accepted';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                Quote #{quote.quoteNumber || quote.id}
              </h1>
              <p className="text-sm text-gray-600">
                {customer?.name || 'Customer'} - {new Date(quote.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          
          <div className="flex gap-2">
            {!isAccepted && !isExpired && (
              <Button 
                onClick={handleAcceptQuote}
                disabled={acceptQuoteMutation.isPending}
                className="bg-green-600 hover:bg-green-700 text-white"
                data-testid="button-accept-quote"
              >
                {acceptQuoteMutation.isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                    Accepting...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Accept Quote
                  </>
                )}
              </Button>
            )}
            <Button variant="outline" size="sm">
              <Mail className="w-4 h-4 mr-2" />
              Email
            </Button>
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Quote Content */}
      <div className="max-w-4xl mx-auto py-6 px-4">
        <Card className="bg-white shadow-sm">
          <CardContent className="p-8">
            {/* Company Header */}
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-orange-600 mb-2">Treemarkables</h1>
              <p className="text-gray-600">Professional Tree Care Services</p>
              <p className="text-sm text-gray-500">Gisborne, New Zealand | Phone: +64 6 867 1234 | Email: info@treemarkables.co.nz</p>
            </div>

            {/* Status Banner */}
            {isAccepted && (
              <div className="bg-green-100 border border-green-300 rounded-lg p-4 mb-6">
                <div className="flex items-center">
                  <Check className="w-5 h-5 text-green-600 mr-2" />
                  <span className="text-green-800 font-medium">Quote Accepted</span>
                  <span className="text-green-600 ml-2">- We'll be in touch to schedule the work!</span>
                </div>
              </div>
            )}

            {isExpired && !isAccepted && (
              <div className="bg-red-100 border border-red-300 rounded-lg p-4 mb-6">
                <div className="flex items-center">
                  <Clock className="w-5 h-5 text-red-600 mr-2" />
                  <span className="text-red-800 font-medium">Quote Expired</span>
                  <span className="text-red-600 ml-2">- Please contact us for an updated quote</span>
                </div>
              </div>
            )}

            {/* Quote Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Quote Details</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Quote Number:</span>
                    <span className="font-medium">{quote.quoteNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Date:</span>
                    <span className="font-medium">{new Date(quote.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Valid Until:</span>
                    <span className="font-medium">
                      {quote.validUntil ? new Date(quote.validUntil).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Status:</span>
                    <span className={`font-medium ${isAccepted ? 'text-green-600' : isExpired ? 'text-red-600' : 'text-orange-600'}`}>
                      {isAccepted ? 'Accepted' : isExpired ? 'Expired' : 'Pending'}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Customer Details</h3>
                <div className="space-y-2">
                  <div>
                    <span className="text-gray-600">Name:</span>
                    <span className="font-medium ml-2">{customer?.name || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Email:</span>
                    <span className="font-medium ml-2">{customer?.email || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Phone:</span>
                    <span className="font-medium ml-2">{customer?.phone || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Address:</span>
                    <span className="font-medium ml-2">{job?.address || customer?.address || 'N/A'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Job Description */}
            {job?.description && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Work Description</h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-gray-700">{job.description}</p>
                </div>
              </div>
            )}

            {/* Line Items */}
            {quote.lineItems && quote.lineItems.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Services</h3>
                <div className="overflow-x-auto max-w-full">
                  <table className="w-full border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border border-gray-300 px-4 py-2 text-left">Description</th>
                        <th className="border border-gray-300 px-4 py-2 text-center">Quantity</th>
                        <th className="border border-gray-300 px-4 py-2 text-right">Unit Price</th>
                        <th className="border border-gray-300 px-4 py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quote.lineItems.map((item: any, index: number) => (
                        <tr key={index}>
                          <td className="border border-gray-300 px-4 py-2">{item.description}</td>
                          <td className="border border-gray-300 px-4 py-2 text-center">{item.quantity}</td>
                          <td className="border border-gray-300 px-4 py-2 text-right">{formatCurrency(item.unitPrice)}</td>
                          <td className="border border-gray-300 px-4 py-2 text-right">{formatCurrency(item.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Totals */}
            <div className="flex justify-end mb-8">
              <div className="w-full max-w-sm space-y-3">
                <div className="flex justify-between text-gray-700">
                  <span>Subtotal (excl GST):</span>
                  <span>{formatCurrency(quote.subtotal || 0)}</span>
                </div>
                <div className="flex justify-between text-gray-700">
                  <span>GST (15%):</span>
                  <span>{formatCurrency((quote.totalAmount || 0) - (quote.subtotal || 0))}</span>
                </div>
                <div className="border-t pt-2">
                  <div className="flex justify-between text-xl font-bold text-gray-900">
                    <span>Total (inc GST):</span>
                    <span>{formatCurrency(quote.totalAmount || 0)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Terms */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Terms & Conditions</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-gray-700 text-sm">
                  {quote.terms || 'Quote valid for 30 days from the date above. GST included. Payment due within 7 days of work completion.'}
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="text-center text-sm text-gray-600 mt-8 pt-6 border-t">
              <p>Thank you for considering Treemarkables!</p>
              <p className="mt-1">
                Valid until {quote.validUntil ? new Date(quote.validUntil).toLocaleDateString() : '30 days from quote date'}.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}