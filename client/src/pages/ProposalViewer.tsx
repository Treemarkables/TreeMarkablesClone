import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Mail } from "lucide-react";
import { ProposalTemplate } from "@/components/ProposalTemplate";
import { Link } from "wouter";

interface ProposalViewerProps {}

export default function ProposalViewer({}: ProposalViewerProps) {
  const { proposalId } = useParams();
  
  // Fetch proposal data
  const { data: proposalResponse, isLoading: proposalLoading } = useQuery({
    queryKey: ["/api/proposals", proposalId],
    enabled: !!proposalId,
  });

  // Fetch customer data if proposal has customerId
  const { data: customerResponse } = useQuery({
    queryKey: ["/api/customers", proposalResponse?.data?.customerId],
    enabled: !!proposalResponse?.data?.customerId,
  });

  // Fetch default proposal template
  const { data: templateResponse } = useQuery({
    queryKey: ["/api/templates/default/proposal"],
  });

  if (proposalLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading proposal...</p>
        </div>
      </div>
    );
  }

  if (!proposalResponse?.success || !proposalResponse?.data) {
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

  const proposal = proposalResponse.data;
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
                Proposal #{proposal.proposalNumber || proposal.id}
              </h1>
              <p className="text-sm text-gray-600">
                {customer?.name || 'Customer'} - {new Date(proposal.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          
          <div className="flex gap-2">
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

      {/* Proposal Content */}
      <div className="max-w-4xl mx-auto py-6 px-4">
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