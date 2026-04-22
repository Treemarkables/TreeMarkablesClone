import { useState, forwardRef } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { FileText, Download, Mail, Copy, Image as ImageIcon, MapPin, Phone, Mail as MailIcon, Calendar, MessageSquare, MousePointerClick } from 'lucide-react';
import type { DocumentTemplate, Proposal, Customer } from '@shared/schema';
import { LinkifiedText } from '@/utils/linkify';
import { ProposalReviewsWidget } from '@/components/ProposalReviewsWidget';

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
  priceIncludesTax?: boolean;
}

interface ProposalPhoto {
  id: string;
  url: string;
  thumbnailUrl?: string;
  filename: string;
  type: string;
  category: string;
  notes?: string;
  capturedAt: string;
}

type SectionType = "fixed" | "subtotalOnly" | "multipleChoice" | "optional";

interface ProposalSection {
  id: string;
  title: string;
  description: string;
  photos: ProposalPhoto[];
  lineItems: ProposalLineItem[];
  sortOrder: number;
  sectionType?: SectionType;
}

interface ProposalTemplateProps {
  template: DocumentTemplate;
  proposal: Proposal;
  customer?: Customer;
  job?: any;
  sections?: ProposalSection[];
  className?: string;
  showActions?: boolean;
  onEmail?: () => void;
  onSms?: () => void;
  onDownload?: () => void;
  onCopy?: () => void;
  allowChoiceSelection?: boolean;
  selectedChoices?: Record<string, string>;
  onChoiceSelect?: (lineItemId: string, choiceId: string) => void;
  selectedOptionalItems?: Record<string, boolean>;
  onOptionalToggle?: (lineItemId: string, selected: boolean) => void;
}

// Photo thumbnail — fills its square aspect-ratio container completely
function LazyImage({ src, alt }: { src: string; alt: string; className?: string }) {
  const [hasError, setHasError] = useState(false);

  return (
    <div className="relative w-full bg-gray-100" style={{ paddingBottom: '100%' }}>
      {hasError ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <ImageIcon className="w-5 h-5 text-gray-300" />
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
          decoding="async"
          onError={() => setHasError(true)}
        />
      )}
    </div>
  );
}

export const ProposalTemplate = forwardRef<HTMLDivElement, ProposalTemplateProps>(({
  template,
  proposal,
  customer,
  job,
  sections = [],
  className = '',
  showActions = false,
  onEmail,
  onSms,
  onDownload,
  onCopy,
  allowChoiceSelection = false,
  selectedChoices = {},
  onChoiceSelect,
  selectedOptionalItems = {},
  onOptionalToggle
}, ref) => {
  const [isLoading, setIsLoading] = useState(false);
  const logoUrl = (template.logoUrl as string | null | undefined) || "/treemarkables-logo.png";

  // Calculate totals from all sections
  const calculateTotals = () => {
    let subtotalExGst = 0;
    let gstAmount = 0;
    
    sections.forEach(section => {
      const secType = (section.sectionType ?? 'fixed') as string;
      const sectionIsInteractive = secType === 'optional' || secType === 'multipleChoice';
      (section.lineItems || []).forEach(item => {
        // Optional items (individual isOptional flag OR entire section is interactive) are
        // excluded from the total by default — only included once the customer explicitly
        // toggles them on via selectedOptionalItems.
        const defaultSelected = !item.isOptional && !sectionIsInteractive && item.selected !== false;
        const isItemSelected = selectedOptionalItems[item.id] !== undefined 
          ? selectedOptionalItems[item.id] 
          : defaultSelected;
        
        if (isItemSelected) {
          let itemPrice = 0;
          const effectiveChoiceId = selectedChoices[item.id] || item.selectedChoiceId;
          if (item.pricingType === 'choice' && effectiveChoiceId) {
            const selectedChoice = item.choices?.find(c => c.id === effectiveChoiceId);
            if (selectedChoice) {
              itemPrice = Number(selectedChoice.price) * Number(item.quantity);
            }
          } else if (item.pricingType === 'fixed' && item.fixedPrice) {
            itemPrice = Number(item.fixedPrice);
          } else {
            itemPrice = Number(item.totalPrice);
          }

          const isInclusive = item.priceIncludesTax || false;
          const gstRate = 0.15; // 15% GST for New Zealand
          
          if (isInclusive) {
            // Price includes GST - extract the ex-GST amount
            const exGst = itemPrice / (1 + gstRate);
            subtotalExGst += exGst;
            gstAmount += itemPrice - exGst;
          } else {
            // Price excludes GST - add it
            subtotalExGst += itemPrice;
            gstAmount += itemPrice * gstRate;
          }
        }
      });
    });

    // Apply discount from proposal (discount reduces the taxable amount)
    const discountAmount = proposal?.discountAmount ? parseFloat(String(proposal.discountAmount)) : 0;
    const subtotalAfterDiscount = Math.max(0, subtotalExGst - discountAmount);
    
    // GST is calculated on the discounted amount (less GST)
    const gstRate = 0.15;
    const gstOnDiscounted = subtotalAfterDiscount * gstRate;
    const totalAmount = subtotalAfterDiscount + gstOnDiscounted;
    
    return {
      subtotal: subtotalExGst,
      discount: discountAmount,
      subtotalAfterDiscount: subtotalAfterDiscount,
      gst: gstOnDiscounted,
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
    <div ref={ref} className={`max-w-4xl mx-auto bg-white w-full overflow-x-hidden ${className}`}>
      {/* Action Bar */}
      {showActions && (
        <div className="flex justify-end items-center mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex gap-2">
            {onCopy && (
              <Button variant="outline" size="sm" onClick={onCopy} data-testid="button-copy-proposal" className="bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200">
                <Copy className="w-4 h-4 mr-2" />
                Copy
              </Button>
            )}
            {onEmail && (
              <Button variant="outline" size="sm" onClick={onEmail} data-testid="button-email-proposal" className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200">
                <Mail className="w-4 h-4 mr-2" />
                Email
              </Button>
            )}
            {onSms && (
              <Button variant="outline" size="sm" onClick={onSms} data-testid="button-sms-proposal-preview" className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200">
                <MessageSquare className="w-4 h-4 mr-2" />
                SMS
              </Button>
            )}
            {onDownload && (
              <Button variant="outline" size="sm" onClick={onDownload} data-testid="button-download-proposal" className="bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200">
                <Download className="w-4 h-4 mr-2" />
                PDF
              </Button>
            )}
          </div>
        </div>
      )}

      <Card className="shadow-lg">
        {/* Header with Logo — compact, logo left, company contact info right */}
        <CardHeader className="p-4 sm:p-6 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            {/* Logo */}
            <div className="shrink-0">
              <img
                src={logoUrl}
                alt="Company Logo"
                className="h-24 sm:h-36 w-auto object-contain"
                data-testid="img-company-logo"
              />
            </div>

            {/* Company contact info */}
            <div className="sm:text-right min-w-0">
              {template.companyAddress && (
                <p className="text-sm text-gray-700 break-words">{template.companyAddress}</p>
              )}
              {template.companyPhone && (
                <p className="text-sm text-gray-600 mt-0.5 break-all">{template.companyPhone}</p>
              )}
              {template.companyEmail && (
                <p className="text-sm text-gray-600 mt-0.5 break-all">{template.companyEmail}</p>
              )}
              {template.gstNumber && (
                <p className="text-xs text-gray-500 mt-0.5">GST Number: {template.gstNumber}</p>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          {/* Customer + Proposal Info Row — matches the builder layout */}
          <div className="p-4 sm:p-6 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              {/* Left: Customer box */}
              <div className="bg-gray-50 rounded-lg p-3 sm:p-4 flex-1 min-w-0">
                {customer ? (
                  <>
                    <h4 className="font-semibold text-gray-900 text-sm sm:text-base break-words" data-testid="text-customer-name">
                      {customer.name}
                    </h4>
                    {(job?.address || customer.address) && (
                      <div className="flex items-start gap-2 text-gray-700 mt-2 text-sm">
                        <MapPin className="w-3 h-3 sm:w-4 sm:h-4 shrink-0 mt-0.5" />
                        <p className="break-words">
                          {[
                            job?.address || customer.address,
                            job?.city || customer.city,
                            job?.region || customer.region,
                          ].filter(Boolean).join(', ')}
                        </p>
                      </div>
                    )}
                    {customer.email && (
                      <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600 mt-1">
                        <MailIcon className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
                        <span className="break-all">{customer.email}</span>
                      </div>
                    )}
                    {customer.phone && (
                      <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600 mt-1">
                        <Phone className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
                        <span className="break-all">{customer.phone}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-gray-400 italic">No customer selected</p>
                )}
              </div>

              {/* Right: Proposal reference info */}
              <div className="text-right shrink-0">
                <p className="text-base font-bold text-gray-900" data-testid="text-proposal-number">
                  Proposal #{proposal.proposalNumber}
                </p>
                {job?.jobNumber && (
                  <p className="text-sm text-gray-600 mt-0.5">Job #{job.jobNumber}</p>
                )}
                {proposal.createdAt && (
                  <p className="text-sm text-gray-500 mt-1">
                    {format(new Date(proposal.createdAt), 'dd MMM yyyy')}
                  </p>
                )}
                {expiryDate && (
                  <p className={`text-xs mt-1 ${isExpired ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                    {isExpired ? 'Expired:' : 'Valid until:'} {format(expiryDate, 'dd MMM yyyy')}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Proposal Sections */}
          {sections.map((section, sectionIndex) => (
            <div key={section.id} className="p-4 sm:p-5 border-b border-gray-200">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2 sm:mb-3 break-words" data-testid={`text-section-title-${sectionIndex}`}>
                {section.title}
              </h3>

              {/* Section Description */}
              {section.description && (
                <div className="mb-2 sm:mb-3">
                  <p className="text-gray-700 text-xs sm:text-base whitespace-pre-wrap break-words">
                    <LinkifiedText text={section.description} />
                  </p>
                </div>
              )}

              {/* Section Photos */}
              {(section.photos || []).length > 0 && (
                <div className="mb-3 sm:mb-4">
                  <div className="grid grid-cols-8 gap-1 sm:gap-1.5">
                    {(section.photos || []).map((photo, photoIndex) => (
                      <div 
                        key={photo.id} 
                        className="bg-gray-50 rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity" 
                        data-testid={`img-photo-${photo.id}`}
                        onClick={() => {
                          const photos = section.photos || [];
                          let currentIndex = photoIndex;
                          
                          // Create modal container
                          const modal = document.createElement('div');
                          modal.className = 'fixed inset-0 z-[200] flex items-center justify-center bg-black/95';
                          
                          // Create close button — fixed positioning so it always sits above imgContainer
                          const closeBtn = document.createElement('button');
                          closeBtn.innerHTML = '×';
                          closeBtn.className = 'text-white text-4xl w-14 h-14 flex items-center justify-center bg-black/40 rounded-full transition-colors';
                          closeBtn.style.cssText = 'position:fixed;right:1rem;top:max(1rem,env(safe-area-inset-top));z-index:201;pointer-events:auto;';
                          closeBtn.onclick = (e) => { e.stopPropagation(); modal.remove(); document.removeEventListener('keydown', handleKeyDown); };

                          // Create image container — no position:relative so it doesn't compete with closeBtn
                          const imgContainer = document.createElement('div');
                          imgContainer.className = 'w-full h-full flex items-center justify-center p-4 sm:p-16';
                          
                          // Create image element
                          const img = document.createElement('img');
                          img.style.cssText = 'max-width: calc(100vw - 4rem); max-height: calc(100vh - 4rem); width: auto; height: auto; object-fit: contain; display: block; border-radius: 4px;';
                          img.onclick = (e) => e.stopPropagation();
                          
                          // Create counter
                          const counter = document.createElement('div');
                          counter.className = 'absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white text-sm bg-black/50 px-3 py-1 rounded-full';
                          
                          // Create prev button
                          const prevBtn = document.createElement('button');
                          prevBtn.innerHTML = '‹';
                          prevBtn.className = 'absolute left-2 sm:left-4 top-1/2 transform -translate-y-1/2 text-white text-5xl w-12 h-12 flex items-center justify-center hover:bg-white/20 rounded-full transition-colors';
                          
                          // Create next button
                          const nextBtn = document.createElement('button');
                          nextBtn.innerHTML = '›';
                          nextBtn.className = 'absolute right-2 sm:right-4 top-1/2 transform -translate-y-1/2 text-white text-5xl w-12 h-12 flex items-center justify-center hover:bg-white/20 rounded-full transition-colors';
                          
                          const updateImage = () => {
                            img.src = photos[currentIndex].url;
                            counter.textContent = `${currentIndex + 1} / ${photos.length}`;
                            prevBtn.style.display = currentIndex === 0 ? 'none' : 'flex';
                            nextBtn.style.display = currentIndex === photos.length - 1 ? 'none' : 'flex';
                          };
                          
                          prevBtn.onclick = (e) => {
                            e.stopPropagation();
                            if (currentIndex > 0) {
                              currentIndex--;
                              updateImage();
                            }
                          };
                          
                          nextBtn.onclick = (e) => {
                            e.stopPropagation();
                            if (currentIndex < photos.length - 1) {
                              currentIndex++;
                              updateImage();
                            }
                          };
                          
                          // Add keyboard navigation
                          const handleKeyDown = (e: KeyboardEvent) => {
                            if (e.key === 'ArrowLeft' && currentIndex > 0) {
                              currentIndex--;
                              updateImage();
                            } else if (e.key === 'ArrowRight' && currentIndex < photos.length - 1) {
                              currentIndex++;
                              updateImage();
                            } else if (e.key === 'Escape') {
                              modal.remove();
                            }
                          };
                          document.addEventListener('keydown', handleKeyDown);
                          
                          // Add touch swipe support for mobile
                          let touchStartX = 0;
                          let touchEndX = 0;
                          
                          imgContainer.addEventListener('touchstart', (e) => {
                            touchStartX = e.changedTouches[0].screenX;
                          });
                          
                          imgContainer.addEventListener('touchend', (e) => {
                            touchEndX = e.changedTouches[0].screenX;
                            if (touchStartX - touchEndX > 50 && currentIndex < photos.length - 1) {
                              currentIndex++;
                              updateImage();
                            } else if (touchEndX - touchStartX > 50 && currentIndex > 0) {
                              currentIndex--;
                              updateImage();
                            }
                          });
                          
                          // Guard against ghost clicks on mobile: the same tap that opens the
                          // modal fires a synthetic click ~300ms later and would close it instantly.
                          const openedAt = Date.now();
                          const safeClose = () => {
                            if (Date.now() - openedAt < 400) return;
                            document.removeEventListener('keydown', handleKeyDown);
                            modal.remove();
                          };
                          // Close on background tap only (not on image — tap to zoom is natural)
                          modal.onclick = safeClose;

                          // Stop pointer/mouse events from bubbling to document so Radix Dialog
                          // doesn't interpret them as an "outside click" and close the proposal viewer.
                          modal.addEventListener('pointerdown', (e) => e.stopPropagation());
                          modal.addEventListener('mousedown', (e) => e.stopPropagation());

                          // Assemble modal
                          imgContainer.appendChild(img);
                          modal.appendChild(closeBtn);
                          modal.appendChild(imgContainer);
                          modal.appendChild(counter);
                          if (photos.length > 1) {
                            modal.appendChild(prevBtn);
                            modal.appendChild(nextBtn);
                          }
                          
                          updateImage();
                          document.body.appendChild(modal);
                        }}
                      >
                        <LazyImage
                          src={photo.thumbnailUrl || photo.url}
                          alt={photo.filename}
                          className="w-full h-40 object-contain bg-gray-100 rounded-lg"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Section Line Items */}
              {(section.lineItems || []).length > 0 && (() => {
                const secType: SectionType = section.sectionType ?? "fixed";
                const isInteractive = (secType === "optional" || secType === "multipleChoice") && onOptionalToggle;
                const isMultipleChoice = secType === "multipleChoice";
                const isSubtotalOnly = secType === "subtotalOnly";

                // For subtotalOnly: compute the section subtotal and show one row
                if (isSubtotalOnly) {
                  const sectionSubtotal = (section.lineItems || []).reduce((sum, item) => {
                    const p = item.pricingType === "fixed" && item.fixedPrice
                      ? Number(item.fixedPrice)
                      : Number(item.totalPrice);
                    return sum + (p || 0);
                  }, 0);
                  return (
                    <div className="mb-4 sm:mb-6">
                      <div className="w-full overflow-x-auto">
                        <div className="inline-block min-w-full align-middle">
                          <table className="w-full border-collapse border border-gray-200 rounded-lg overflow-hidden">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="border border-gray-200 px-2 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-gray-900">{section.title || "Items"}</th>
                                <th className="border border-gray-200 px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-900">Subtotal</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr className="bg-gray-50">
                                <td className="border border-gray-200 px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-700">Included works — {(section.lineItems || []).length} item{(section.lineItems || []).length !== 1 ? "s" : ""}</td>
                                <td className="border border-gray-200 px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-900 whitespace-nowrap">{formatCurrency(sectionSubtotal)}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="mb-4 sm:mb-6">
                    {isInteractive && (
                      <div className="flex items-center gap-2.5 bg-orange-50 border border-orange-200 rounded-lg px-3 py-3 mb-3">
                        <MousePointerClick className="w-5 h-5 text-orange-500 shrink-0" />
                        <p className="text-sm font-semibold text-orange-700">
                          {isMultipleChoice
                            ? "Tap an option to select it — only your chosen option will be added to the total"
                            : "Tap the options you'd like to add — they'll be reflected in the total below"}
                        </p>
                      </div>
                    )}

                    {/* ── Mobile card layout (interactive sections only — non-interactive always uses the table) ── */}
                    <div className={`${isInteractive ? 'sm:hidden' : 'hidden'} space-y-2`}>
                      {(section.lineItems || []).map((item, index) => {
                        let displayPrice: number = Number(item.totalPrice) || 0;
                        const effectiveChoiceId = selectedChoices[item.id] || item.selectedChoiceId;
                        if (item.pricingType === 'choice' && effectiveChoiceId) {
                          const sel = item.choices?.find(c => c.id === effectiveChoiceId);
                          if (sel) displayPrice = Number(sel.price) * Number(item.quantity);
                        } else if (item.pricingType === 'fixed' && item.fixedPrice) {
                          displayPrice = Number(item.fixedPrice);
                        }
                        const defaultSelected = !item.isOptional && !isInteractive && item.selected !== false;
                        const isItemSelected = selectedOptionalItems[item.id] !== undefined
                          ? selectedOptionalItems[item.id] : defaultSelected;
                        const isItemToggleable = isInteractive || item.isOptional;
                        const handleToggle = () => {
                          if (!isItemToggleable || !onOptionalToggle) return;
                          if (isMultipleChoice) {
                            (section.lineItems || []).forEach(li => {
                              if (li.id !== item.id) onOptionalToggle(li.id, false);
                            });
                            onOptionalToggle(item.id, !isItemSelected);
                          } else {
                            onOptionalToggle(item.id, !isItemSelected);
                          }
                        };
                        return (
                          <div
                            key={item.id}
                            className={`border rounded-lg p-3 overflow-hidden transition-colors ${isItemToggleable && isItemSelected ? 'bg-green-50 border-green-300' : isInteractive ? 'bg-white border-gray-200' : 'bg-white border-gray-200'} ${isItemToggleable && onOptionalToggle ? 'cursor-pointer' : ''}`}
                            data-testid={`row-line-item-${sectionIndex}-${index}`}
                            onClick={handleToggle}
                          >
                            {/* Interactive: side-by-side layout with big circle on right */}
                            {isInteractive ? (
                              <div className="flex items-center gap-3">
                                <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                                  <div className={`font-medium text-sm break-words [overflow-wrap:anywhere] ${isItemSelected ? 'text-gray-900' : 'text-gray-500'}`}>
                                    <LinkifiedText text={item.description} />
                                  </div>
                                  {item.notes && (
                                    <div className={`text-xs break-words [overflow-wrap:anywhere] ${isItemSelected ? 'text-gray-600' : 'text-gray-400'}`}>
                                      <LinkifiedText text={item.notes} />
                                    </div>
                                  )}
                                  <div className={`text-xs ${isItemSelected ? 'text-gray-500' : 'text-gray-400'}`}>Qty: {item.quantity}</div>
                                  <div className={`text-base font-semibold ${isItemSelected ? 'text-green-700' : 'text-gray-400'}`}>
                                    {formatCurrency(displayPrice)}
                                  </div>
                                </div>
                                <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    onClick={handleToggle}
                                    aria-pressed={isItemSelected}
                                    className={`inline-flex flex-col items-center justify-center gap-1 w-16 h-16 rounded-full border-[3px] transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-green-300 ${isItemSelected ? 'bg-green-500 border-green-500 text-white shadow-lg scale-105' : 'bg-white border-gray-300 text-gray-400 hover:border-green-400 hover:text-green-500 hover:shadow-md'}`}
                                  >
                                    {isItemSelected ? (
                                      <>
                                        <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                        <span className="text-[9px] font-bold leading-none">ADDED</span>
                                      </>
                                    ) : (
                                      <>
                                        <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></svg>
                                        <span className="text-[9px] font-semibold leading-none">{isMultipleChoice ? "SELECT" : "ADD"}</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-col gap-2 min-w-0">
                              <div className={`font-medium text-sm break-words [overflow-wrap:anywhere] text-gray-900`}>
                                <LinkifiedText text={item.description} />
                              </div>
                              {item.notes && (
                                <div className={`text-xs break-words [overflow-wrap:anywhere] text-gray-600`}>
                                  <LinkifiedText text={item.notes} />
                                </div>
                              )}
                              <div className={`text-xs text-gray-500`}>
                                Qty: {item.quantity}
                              </div>
                              <div className={`text-base font-semibold break-words ${isItemToggleable ? (isItemSelected ? 'text-green-700' : 'text-gray-400') : 'text-gray-900'}`}>
                                {formatCurrency(displayPrice)}
                              </div>
                              {item.pricingType === 'choice' && item.choices && item.choices.length > 0 && (
                                <div className="text-xs min-w-0" onClick={(e) => e.stopPropagation()}>
                                  <p className="text-gray-600 font-medium mb-1">{allowChoiceSelection ? 'Select an option:' : 'Options:'}</p>
                                  <ul className="flex flex-col gap-1.5">
                                    {item.choices.map(choice => {
                                      const isChoiceSelected = choice.id === (selectedChoices[item.id] || item.selectedChoiceId);
                                      return (
                                        <li
                                          key={choice.id}
                                          className={`flex items-start gap-2 p-2 rounded-md border ${isChoiceSelected ? 'border-green-300 bg-green-50 font-medium text-green-700' : 'border-gray-200 text-gray-700'} ${allowChoiceSelection ? 'cursor-pointer' : ''}`}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (allowChoiceSelection && onChoiceSelect) onChoiceSelect(item.id, choice.id);
                                          }}
                                        >
                                          {allowChoiceSelection ? (
                                            <input type="radio" name={`choice-${item.id}`} checked={isChoiceSelected} onChange={(e) => { e.stopPropagation(); onChoiceSelect?.(item.id, choice.id); }} className="mt-0.5 h-4 w-4 text-green-600 focus:ring-green-500 cursor-pointer shrink-0" />
                                          ) : <span className="shrink-0">•</span>}
                                          <div className="flex-1 min-w-0 flex flex-col gap-0.5 break-words [overflow-wrap:anywhere]">
                                            <span>{choice.label}</span>
                                            <span className="text-gray-600">{formatCurrency(Number(choice.price) || 0)}</span>
                                            {choice.description && <span className="text-gray-500 text-[11px]">{choice.description}</span>}
                                          </div>
                                        </li>
                                      );
                                    })}
                                  </ul>
                                </div>
                              )}
                              {item.isOptional && !isInteractive && (
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                  <Badge variant={isItemSelected ? "default" : "secondary"} className="text-xs">
                                    {isItemSelected ? "Included" : "Optional"}
                                  </Badge>
                                  {onOptionalToggle && (
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); onOptionalToggle(item.id, !isItemSelected); }}
                                      className={`text-xs px-3 py-1 rounded-full border transition-all duration-150 font-medium ${isItemSelected ? 'bg-green-500 border-green-500 text-white' : 'bg-white border-gray-300 text-gray-500'}`}
                                    >
                                      {isItemSelected ? "Included" : "+ Add"}
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                          </div>
                        );
                      })}
                    </div>

                    {/* ── Table layout (always visible for non-interactive; desktop-only for interactive) ── */}
                    <div className={`${isInteractive ? 'hidden sm:block' : 'block'} w-full overflow-x-auto`}>
                      <table className="w-full border-collapse border border-gray-200 rounded-lg overflow-hidden">
                        <thead className="bg-gray-50">
                          <tr>
                            {isInteractive && (
                              <th className="border border-gray-200 px-2 py-3 text-center text-sm font-semibold text-gray-900 w-24">Select</th>
                            )}
                            <th className="border border-gray-200 px-4 py-3 text-left text-sm font-semibold text-gray-900">Line Item</th>
                            <th className="border border-gray-200 px-3 py-3 text-center text-sm font-semibold text-gray-900 w-14">Qty</th>
                            <th className="hidden sm:table-cell border border-gray-200 px-4 py-3 text-center text-sm font-semibold text-gray-900">Rate</th>
                            <th className="border border-gray-200 px-4 py-3 text-right text-sm font-semibold text-gray-900">Price</th>
                            {!isInteractive && (
                              <th className="hidden sm:table-cell border border-gray-200 px-4 py-3 text-center text-sm font-semibold text-gray-900">Optional</th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {(section.lineItems || []).map((item, index) => {
                            let displayPrice: number = Number(item.totalPrice) || 0;
                            const effectiveChoiceId = selectedChoices[item.id] || item.selectedChoiceId;
                            if (item.pricingType === 'choice' && effectiveChoiceId) {
                              const selectedChoice = item.choices?.find(c => c.id === effectiveChoiceId);
                              if (selectedChoice) {
                                displayPrice = Number(selectedChoice.price) * Number(item.quantity);
                              }
                            } else if (item.pricingType === 'fixed' && item.fixedPrice) {
                              displayPrice = Number(item.fixedPrice);
                            }
                            const defaultSelected = !item.isOptional && !isInteractive && item.selected !== false;
                            const isItemSelected = selectedOptionalItems[item.id] !== undefined
                              ? selectedOptionalItems[item.id]
                              : defaultSelected;
                            const isItemToggleable = isInteractive || item.isOptional;
                            const handleToggle = () => {
                              if (!isItemToggleable || !onOptionalToggle) return;
                              if (isMultipleChoice) {
                                (section.lineItems || []).forEach(li => {
                                  if (li.id !== item.id) onOptionalToggle(li.id, false);
                                });
                                onOptionalToggle(item.id, !isItemSelected);
                              } else {
                                onOptionalToggle(item.id, !isItemSelected);
                              }
                            };
                            return (
                              <tr
                                key={item.id}
                                className={`transition-colors ${isItemToggleable && isItemSelected ? 'bg-green-50' : 'even:bg-gray-50'} ${isItemToggleable && onOptionalToggle ? 'cursor-pointer' : ''}`}
                                data-testid={`row-line-item-${sectionIndex}-${index}`}
                                onClick={handleToggle}
                              >
                                {isInteractive && (
                                  <td className="border border-gray-200 px-2 py-3 text-center align-middle" onClick={(e) => e.stopPropagation()}>
                                    <button
                                      type="button"
                                      onClick={handleToggle}
                                      aria-pressed={isItemSelected}
                                      className={`inline-flex flex-col items-center justify-center gap-1 w-16 h-16 rounded-full border-[3px] transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-green-300 ${isItemSelected ? 'bg-green-500 border-green-500 text-white shadow-lg scale-105' : 'bg-white border-gray-300 text-gray-400 hover:border-green-400 hover:text-green-500 hover:shadow-md hover:scale-105'}`}
                                      style={{ minWidth: "4rem", minHeight: "4rem" }}
                                    >
                                      {isItemSelected ? (
                                        <>
                                          <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                          <span className="text-[10px] font-bold leading-none">ADDED</span>
                                        </>
                                      ) : (
                                        <>
                                          <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></svg>
                                          <span className="text-[10px] font-semibold leading-none">{isMultipleChoice ? "SELECT" : "ADD"}</span>
                                        </>
                                      )}
                                    </button>
                                  </td>
                                )}
                                <td className="border border-gray-200 px-4 py-3 text-gray-900">
                                  <div className="flex-1">
                                    <span className={`font-medium text-sm break-words ${isInteractive && !isItemSelected ? 'text-gray-400' : 'text-gray-900'}`}>
                                      <LinkifiedText text={item.description} />
                                    </span>
                                    {item.notes && (
                                      <p className={`text-xs mt-1 break-words ${isInteractive && !isItemSelected ? 'text-gray-300' : 'text-gray-600'}`}>
                                        <LinkifiedText text={item.notes} />
                                      </p>
                                    )}
                                    {item.pricingType === 'choice' && item.choices && item.choices.length > 0 && (
                                      <div className="mt-2 text-xs" onClick={(e) => e.stopPropagation()}>
                                        <p className="text-gray-600 font-medium">{allowChoiceSelection ? 'Select an option:' : 'Options:'}</p>
                                        <ul className="ml-1 space-y-1.5 mt-1">
                                          {item.choices.map(choice => {
                                            const isChoiceSelected = choice.id === (selectedChoices[item.id] || item.selectedChoiceId);
                                            return (
                                              <li
                                                key={choice.id}
                                                className={`flex items-start gap-2 ${isChoiceSelected ? 'font-medium text-green-700' : 'text-gray-600'} break-words ${allowChoiceSelection ? 'cursor-pointer hover:bg-green-50 p-1.5 rounded-md transition-colors' : ''}`}
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  if (allowChoiceSelection && onChoiceSelect) onChoiceSelect(item.id, choice.id);
                                                }}
                                              >
                                                {allowChoiceSelection ? (
                                                  <input type="radio" name={`choice-${item.id}`} checked={isChoiceSelected} onChange={(e) => { e.stopPropagation(); onChoiceSelect?.(item.id, choice.id); }} className="mt-0.5 h-4 w-4 text-green-600 focus:ring-green-500 cursor-pointer" />
                                                ) : <span>•</span>}
                                                <span className="flex-1">
                                                  {choice.label} - {formatCurrency(Number(choice.price) || 0)}
                                                  {choice.description && <span className="block text-gray-500 text-[10px] mt-0.5">{choice.description}</span>}
                                                </span>
                                              </li>
                                            );
                                          })}
                                        </ul>
                                      </div>
                                    )}
                                    {item.isOptional && !isInteractive && (
                                      <div className="mt-1 md:hidden">
                                        <Badge variant={isItemSelected ? "default" : "secondary"} className="text-xs">
                                          {isItemSelected ? "Included" : "Optional"}
                                        </Badge>
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td className={`border border-gray-200 px-3 py-3 text-center text-sm whitespace-nowrap ${isInteractive ? (isItemSelected ? 'font-bold text-green-700' : 'text-gray-400') : 'text-gray-700'}`}>
                                  {item.quantity}
                                </td>
                                <td className={`hidden sm:table-cell border border-gray-200 px-4 py-3 text-center text-sm ${isInteractive && !isItemSelected ? 'text-gray-300' : 'text-gray-700'}`}>
                                  {formatCurrency(Number(item.unitPrice) || 0)}
                                </td>
                                <td className={`border border-gray-200 px-4 py-3 text-right text-sm whitespace-nowrap ${isItemToggleable ? (isItemSelected ? 'font-bold text-green-700' : 'text-gray-300') : 'font-semibold text-gray-900'}`}>
                                  {formatCurrency(displayPrice)}
                                </td>
                                {!isInteractive && (
                                  <td className="hidden sm:table-cell border border-gray-200 px-4 py-3 text-center">
                                    {item.isOptional && (
                                      <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); if (onOptionalToggle) onOptionalToggle(item.id, !isItemSelected); }}
                                        className={`text-xs px-3 py-1 rounded-full border transition-all duration-150 font-medium ${isItemSelected ? 'bg-green-500 border-green-500 text-white' : 'bg-white border-gray-300 text-gray-500 hover:border-green-400 hover:text-green-600'}`}
                                      >
                                        {isItemSelected ? "Included" : "+ Add"}
                                      </button>
                                    )}
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}
            </div>
          ))}

          <Separator className="my-3 sm:my-4" />

          {/* Totals */}
          <div className="p-3 sm:p-4">
            <div className="flex justify-end">
              <div className="w-full max-w-xs space-y-1 sm:space-y-1.5">
                <div className="flex justify-between text-xs sm:text-sm text-gray-700">
                  <span>Subtotal (excl GST):</span>
                  <span data-testid="text-subtotal" className="font-medium">{formatCurrency(totals.subtotal)}</span>
                </div>
                {totals.discount > 0 && (
                  <div className="flex justify-between text-xs sm:text-sm text-orange-600">
                    <span>Discount:</span>
                    <span data-testid="text-discount" className="font-medium">-{formatCurrency(totals.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs sm:text-sm text-gray-700">
                  <span>GST (15%):</span>
                  <span data-testid="text-gst-amount" className="font-medium">{formatCurrency(totals.gst)}</span>
                </div>
                <Separator className="my-1" />
                <div className="flex justify-between text-base sm:text-lg font-bold text-gray-900">
                  <span>Total (inc GST):</span>
                  <span data-testid="text-total-amount">{formatCurrency(totals.total)}</span>
                </div>
              </div>
            </div>
          </div>

          <ProposalReviewsWidget />

          {/* Footer */}
          <div className="p-3 sm:p-4 pt-2">
            {template.paymentTerms && (
              <p className="text-center text-xs text-gray-500 mb-2">{template.paymentTerms}</p>
            )}
            <div className="text-center text-xs sm:text-sm text-gray-600">
              <p>Thank you for choosing {template.companyName || 'Treemarkables LTD'}!</p>
              <p className="mt-1">Professional tree services you can trust.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

ProposalTemplate.displayName = 'ProposalTemplate';

export default ProposalTemplate;