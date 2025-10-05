import { useState, forwardRef } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { FileText, Download, Mail, Copy, Image as ImageIcon, MapPin, Phone, Mail as MailIcon, Calendar } from 'lucide-react';
import type { DocumentTemplate, Proposal, Customer } from '@shared/schema';

interface ProposalLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  unit: string;
  category?: string;
  notes?: string;
  isOptional: boolean;
  selected: boolean;
  pricingType: 'normal' | 'choice' | 'fixed';
  choices?: {
    id: string;
    label: string;
    description: string;
    price: number;
    isDefault?: boolean;
  }[];
  selectedChoiceId?: string;
  fixedPrice?: number;
}

interface ProposalPhoto {
  id: string;
  url: string;
  filename: string;
  type: string;
  category: string;
  notes?: string;
  capturedAt: string;
}

interface ProposalSection {
  id: string;
  title: string;
  description: string;
  photos: ProposalPhoto[];
  lineItems: ProposalLineItem[];
  sortOrder: number;
}

interface ProposalTemplateProps {
  template: DocumentTemplate;
  proposal: Proposal;
  customer?: Customer;
  sections?: ProposalSection[];
  className?: string;
  showActions?: boolean;
  onEmail?: () => void;
  onDownload?: () => void;
  onCopy?: () => void;
}

export const ProposalTemplate = forwardRef<HTMLDivElement, ProposalTemplateProps>(({
  template,
  proposal,
  customer,
  sections = [],
  className = '',
  showActions = false,
  onEmail,
  onDownload,
  onCopy
}, ref) => {
  const [isLoading, setIsLoading] = useState(false);

  // Calculate totals from all sections
  const calculateTotals = () => {
    let subtotalAmount = 0;
    
    sections.forEach(section => {
      section.lineItems.forEach(item => {
        if (item.selected) {
          if (item.pricingType === 'choice' && item.selectedChoiceId) {
            const selectedChoice = item.choices?.find(c => c.id === item.selectedChoiceId);
            if (selectedChoice) {
              subtotalAmount += selectedChoice.price * item.quantity;
            }
          } else if (item.pricingType === 'fixed' && item.fixedPrice) {
            subtotalAmount += item.fixedPrice;
          } else {
            subtotalAmount += item.totalPrice;
          }
        }
      });
    });

    const gstRate = 0.15; // 15% GST for New Zealand
    const gstAmount = subtotalAmount * gstRate;
    const totalAmount = subtotalAmount + gstAmount;

    return {
      subtotal: subtotalAmount,
      gst: gstAmount,
      total: totalAmount
    };
  };

  const totals = calculateTotals();

  // Get status color
  const getStatusColor = (status: string) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-800',
      sent: 'bg-blue-100 text-blue-800',
      viewed: 'bg-purple-100 text-purple-800',
      accepted: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      expired: 'bg-yellow-100 text-yellow-800'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  // Format currency as NZD
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NZ', {
      style: 'currency',
      currency: 'NZD'
    }).format(amount);
  };

  // Get proposal expiry date
  const expiryDate = proposal.expiryDate ? new Date(proposal.expiryDate) : null;
  const isExpired = expiryDate && expiryDate < new Date();

  return (
    <div ref={ref} className={`max-w-4xl mx-auto bg-white ${className}`}>
      {/* Action Bar */}
      {showActions && (
        <div className="flex justify-between items-center mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-orange-600" />
            <div>
              <h3 className="font-semibold text-gray-900">Proposal #{proposal.proposalNumber || 'P-' + proposal.id}</h3>
              <p className="text-sm text-gray-600">Using template: {template.name}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {onCopy && (
              <Button variant="outline" size="sm" onClick={onCopy} data-testid="button-copy-proposal">
                <Copy className="w-4 h-4 mr-2" />
                Copy
              </Button>
            )}
            {onEmail && (
              <Button variant="outline" size="sm" onClick={onEmail} data-testid="button-email-proposal">
                <Mail className="w-4 h-4 mr-2" />
                Email
              </Button>
            )}
            {onDownload && (
              <Button variant="outline" size="sm" onClick={onDownload} data-testid="button-download-proposal">
                <Download className="w-4 h-4 mr-2" />
                PDF
              </Button>
            )}
          </div>
        </div>
      )}

      <Card className="shadow-lg">
        <CardContent className="p-0">
          {/* Header with Treemarkables Branding */}
          <div className="bg-gradient-to-r from-orange-500 to-blue-600 p-1 sm:p-3 text-white">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-1 sm:gap-0">
              <div className="flex-1 min-w-0">
                <h1 className="text-xs sm:text-lg font-bold mb-0 sm:mb-1 truncate">{template.companyName || 'Treemarkables LTD'}</h1>
                <p className="text-orange-100 text-[8px] sm:text-xs">Professional Tree Services</p>
                <div className="mt-0.5 sm:mt-1.5 space-y-0 text-[8px] sm:text-xs text-orange-100">
                  <div className="flex items-center gap-0.5 sm:gap-1">
                    <Phone className="w-2 h-2 sm:w-3 sm:h-3" />
                    <span className="break-all">{template.companyPhone || '027 216 6882'}</span>
                  </div>
                  <div className="flex items-center gap-0.5 sm:gap-1">
                    <MapPin className="w-2 h-2 sm:w-3 sm:h-3" />
                    <span className="break-all">{template.companyAddress || '213 Stanley road, Gisborne'}</span>
                  </div>
                </div>
              </div>
              <div className="text-left sm:text-right flex-shrink-0">
                <div className="bg-white/20 rounded p-1 sm:p-1.5 backdrop-blur-sm">
                  <h2 className="text-xs sm:text-base font-bold mb-0 sm:mb-0.5">PROPOSAL</h2>
                  <div className="mt-0.5 space-y-0 text-[8px] sm:text-xs">
                    <p><strong>Number:</strong> {proposal.proposalNumber || 'PROP-' + proposal.id}</p>
                    <p><strong>Date:</strong> {format(new Date(proposal.createdAt || Date.now()), 'dd MMM yyyy')}</p>
                    {expiryDate && (
                      <p><strong>Valid Until:</strong> {format(expiryDate, 'dd MMM yyyy')}</p>
                    )}
                    <div className="mt-0.5">
                      <Badge className={`${getStatusColor(proposal.status || 'draft')} text-[7px] sm:text-[10px] px-1 py-0`}>
                        {(proposal.status || 'draft').toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Customer Information */}
          {customer && (
            <div className="p-4 sm:p-8 border-b border-gray-200">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Proposal For</h3>
              <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <h4 className="font-semibold text-gray-900 text-sm sm:text-base break-words" data-testid="text-customer-name">
                      {customer.name}
                    </h4>
                    {customer.address && (
                      <p className="text-gray-700 mt-2 text-sm sm:text-base break-words">{customer.address}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    {customer.email && (
                      <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600">
                        <MailIcon className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
                        <span className="break-all">{customer.email}</span>
                      </div>
                    )}
                    {customer.phone && (
                      <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600">
                        <Phone className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
                        <span className="break-all">{customer.phone}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Proposal Introduction */}
          {proposal.introduction && (
            <div className="p-4 sm:p-8 border-b border-gray-200">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Proposal Overview</h3>
              <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                <p className="text-gray-700 text-sm sm:text-base whitespace-pre-wrap break-words" data-testid="text-proposal-description">
                  {proposal.introduction}
                </p>
              </div>
            </div>
          )}

          {/* Proposal Sections */}
          {sections.map((section, sectionIndex) => (
            <div key={section.id} className="p-4 sm:p-8 border-b border-gray-200">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4 break-words" data-testid={`text-section-title-${sectionIndex}`}>
                {section.title}
              </h3>

              {/* Section Description */}
              {section.description && (
                <div className="mb-4 sm:mb-6">
                  <p className="text-gray-700 text-sm sm:text-base whitespace-pre-wrap break-words">{section.description}</p>
                </div>
              )}

              {/* Section Photos */}
              {section.photos.length > 0 && (
                <div className="mb-4 sm:mb-6">
                  <h4 className="font-medium text-gray-900 text-sm sm:text-base mb-3">Documentation</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4">
                    {section.photos.map((photo) => (
                      <div key={photo.id} className="bg-gray-50 rounded-lg overflow-hidden" data-testid={`img-photo-${photo.id}`}>
                        <img
                          src={photo.url}
                          alt={photo.filename}
                          className="w-full h-24 sm:h-32 object-cover"
                        />
                        <div className="p-2">
                          <p className="text-xs text-gray-600 truncate">{photo.filename}</p>
                          {photo.notes && (
                            <p className="text-xs text-gray-500 truncate">{photo.notes}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Section Line Items */}
              {section.lineItems.length > 0 && (
                <div className="mb-4 sm:mb-6">
                  <h4 className="font-medium text-gray-900 text-sm sm:text-base mb-3">Services & Pricing</h4>
                  <div className="overflow-x-auto -mx-4 sm:mx-0">
                    <div className="inline-block min-w-full align-middle px-4 sm:px-0">
                      <table className="min-w-full border-collapse border border-gray-200 rounded-lg overflow-hidden">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="border border-gray-200 px-2 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-gray-900">Service</th>
                            <th className="border border-gray-200 px-2 sm:px-4 py-2 sm:py-3 text-center text-xs sm:text-sm font-semibold text-gray-900">Qty</th>
                            <th className="border border-gray-200 px-2 sm:px-4 py-2 sm:py-3 text-center text-xs sm:text-sm font-semibold text-gray-900 hidden sm:table-cell">Unit</th>
                            <th className="border border-gray-200 px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-900">Price</th>
                            <th className="border border-gray-200 px-2 sm:px-4 py-2 sm:py-3 text-center text-xs sm:text-sm font-semibold text-gray-900 hidden md:table-cell">Optional</th>
                          </tr>
                        </thead>
                        <tbody>
                          {section.lineItems.map((item, index) => {
                            let displayPrice = item.totalPrice;
                            if (item.pricingType === 'choice' && item.selectedChoiceId) {
                              const selectedChoice = item.choices?.find(c => c.id === item.selectedChoiceId);
                              if (selectedChoice) {
                                displayPrice = selectedChoice.price * item.quantity;
                              }
                            } else if (item.pricingType === 'fixed' && item.fixedPrice) {
                              displayPrice = item.fixedPrice;
                            }

                            return (
                              <tr key={item.id} className={`${item.selected ? 'bg-green-50' : 'even:bg-gray-50'} ${!item.selected && item.isOptional ? 'opacity-60' : ''}`} data-testid={`row-line-item-${sectionIndex}-${index}`}>
                                <td className="border border-gray-200 px-2 sm:px-4 py-2 sm:py-3 text-gray-900">
                                  <div>
                                    <span className="font-medium text-xs sm:text-sm break-words">{item.description}</span>
                                    {item.notes && (
                                      <p className="text-xs text-gray-600 mt-1 break-words">{item.notes}</p>
                                    )}
                                    {item.pricingType === 'choice' && item.choices && item.choices.length > 0 && (
                                      <div className="mt-2 text-xs">
                                        <p className="text-gray-600">Options:</p>
                                        <ul className="ml-3 space-y-1">
                                          {item.choices.map(choice => (
                                            <li key={choice.id} className={`${choice.id === item.selectedChoiceId ? 'font-medium text-green-700' : 'text-gray-600'} break-words`}>
                                              • {choice.label} - {formatCurrency(choice.price)}
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                    {item.isOptional && (
                                      <div className="mt-1 md:hidden">
                                        <Badge variant={item.selected ? "default" : "secondary"} className="text-xs">
                                          {item.selected ? "Included" : "Optional"}
                                        </Badge>
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td className="border border-gray-200 px-2 sm:px-4 py-2 sm:py-3 text-center text-xs sm:text-sm text-gray-700">{item.quantity}</td>
                                <td className="border border-gray-200 px-2 sm:px-4 py-2 sm:py-3 text-center text-xs sm:text-sm text-gray-700 hidden sm:table-cell">{item.unit}</td>
                                <td className="border border-gray-200 px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-900 whitespace-nowrap">{formatCurrency(displayPrice)}</td>
                                <td className="border border-gray-200 px-2 sm:px-4 py-2 sm:py-3 text-center hidden md:table-cell">
                                  {item.isOptional && (
                                    <Badge variant={item.selected ? "default" : "secondary"} className="text-xs">
                                      {item.selected ? "Included" : "Optional"}
                                    </Badge>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          <Separator className="my-4 sm:my-8" />

          {/* Totals */}
          <div className="p-4 sm:p-8">
            <div className="flex justify-end">
              <div className="w-full max-w-sm space-y-2 sm:space-y-3">
                <div className="flex justify-between text-sm sm:text-base text-gray-700">
                  <span>Subtotal (excl GST):</span>
                  <span data-testid="text-subtotal" className="font-medium">{formatCurrency(totals.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm sm:text-base text-gray-700">
                  <span>GST (15%):</span>
                  <span data-testid="text-gst-amount" className="font-medium">{formatCurrency(totals.gst)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg sm:text-xl font-bold text-gray-900">
                  <span>Total (inc GST):</span>
                  <span data-testid="text-total-amount">{formatCurrency(totals.total)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Terms and Conditions */}
          {(proposal.conclusion || template.paymentTerms) && (
            <div className="p-4 sm:p-8 border-t border-gray-200">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Terms & Conditions</h3>
              <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                <p className="text-gray-700 text-xs sm:text-sm whitespace-pre-wrap break-words" data-testid="text-proposal-terms">
                  {proposal.conclusion || template.paymentTerms || 'This proposal is valid for 30 days from the date above. Payment due within 7 days of acceptance.'}
                </p>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="p-4 sm:p-8 pt-4 sm:pt-6 border-t border-gray-200">
            <div className="text-center text-xs sm:text-sm text-gray-600">
              <p className="break-words">Thank you for considering {template.companyName || 'Treemarkables'}!</p>
              <p className="mt-1">This proposal is valid until {expiryDate ? format(expiryDate, 'dd MMM yyyy') : '30 days from proposal date'}.</p>
              {template.gstNumber && (
                <p className="mt-1">GST Number: {template.gstNumber}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

ProposalTemplate.displayName = 'ProposalTemplate';

export default ProposalTemplate;