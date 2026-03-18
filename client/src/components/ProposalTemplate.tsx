import { useState, useEffect, useRef, forwardRef } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { FileText, Download, Mail, Copy, Image as ImageIcon, MapPin, Phone, Mail as MailIcon, Calendar, MessageSquare } from 'lucide-react';
import type { DocumentTemplate, Proposal, Customer } from '@shared/schema';
import { LinkifiedText } from '@/utils/linkify';
import logoUrl from '@assets/treelogo_1761690528797.webp';

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

// Lazy loading image component using Intersection Observer with zero layout shift
function LazyImage({ src, alt, className }: { src: string; alt: string; className: string }) {
  const [shouldLoad, setShouldLoad] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !shouldLoad) {
            setShouldLoad(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '100px', // Start loading 100px before image enters viewport
        threshold: 0.01
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [shouldLoad]);

  // Preload image and fade in when ready
  useEffect(() => {
    if (shouldLoad && !isLoaded) {
      const img = new Image();
      img.onload = () => {
        setIsLoaded(true);
      };
      img.src = src;
    }
  }, [shouldLoad, src, isLoaded]);

  return (
    <div ref={containerRef} className="relative w-full bg-gray-100" style={{ paddingBottom: '100%' }}>
      {/* Placeholder - always rendered to maintain aspect ratio */}
      <div className={`absolute inset-0 bg-gray-100 transition-opacity duration-300 ${isLoaded ? 'opacity-0' : 'opacity-100'}`} />
      {/* Real image - fades in when loaded */}
      {shouldLoad && (
        <img
          src={src}
          alt={alt}
          className={`${className} absolute inset-0 transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
          loading="lazy"
          decoding="async"
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

  // Calculate totals from all sections
  const calculateTotals = () => {
    let subtotalExGst = 0;
    let gstAmount = 0;
    
    sections.forEach(section => {
      (section.lineItems || []).forEach(item => {
        // Check if this item is selected - use state override if available, otherwise use original
        const isItemSelected = selectedOptionalItems[item.id] !== undefined 
          ? selectedOptionalItems[item.id] 
          : item.selected;
        
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
          
          console.log(`💰 Item: ${item.description}, Price: ${itemPrice}, priceIncludesTax: ${item.priceIncludesTax}, isInclusive: ${isInclusive}`);
          
          if (isInclusive) {
            // Price includes GST - extract the ex-GST amount
            const exGst = itemPrice / (1 + gstRate);
            subtotalExGst += exGst;
            gstAmount += itemPrice - exGst;
            console.log(`  ✅ GST INCLUSIVE: exGst=${exGst}, gstAmount=${itemPrice - exGst}`);
          } else {
            // Price excludes GST - add it
            subtotalExGst += itemPrice;
            gstAmount += itemPrice * gstRate;
            console.log(`  ✅ GST EXCLUSIVE: subtotal=${itemPrice}, gstAmount=${itemPrice * gstRate}`);
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
    
    console.log(`📊 FINAL TOTALS: subtotal=${subtotalExGst}, discount=${discountAmount}, subtotalAfterDiscount=${subtotalAfterDiscount}, gst=${gstOnDiscounted}, total=${totalAmount}`);

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
    <div ref={ref} className={`max-w-4xl mx-auto bg-white w-full ${className}`}>
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
        {/* Header with Logo */}
        <CardHeader className="p-4 sm:p-8 border-b border-gray-200 bg-gradient-to-r from-orange-50 to-white">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <img 
                src={logoUrl} 
                alt="Treemarkables Logo" 
                className="h-16 sm:h-20 w-auto object-contain"
                data-testid="img-company-logo"
              />
            </div>
            <div className="text-right">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-1">PROPOSAL</h2>
              <p className="text-sm text-gray-600" data-testid="text-proposal-number">
                #{proposal.proposalNumber}
              </p>
              {job?.jobNumber && (
                <p className="text-xs text-gray-600 mt-0.5">
                  Job #{job.jobNumber}
                </p>
              )}
              {proposal.createdAt && (
                <p className="text-xs text-gray-500 mt-1">
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
        </CardHeader>
        
        <CardContent className="p-0">
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
                    {(job?.address || customer.address) && (
                      <div className="flex items-start gap-2 text-gray-700 mt-2 text-sm sm:text-base">
                        <MapPin className="w-3 h-3 sm:w-4 sm:h-4 shrink-0 mt-1" />
                        <p className="break-words">{job?.address || customer.address}</p>
                      </div>
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

          {/* Proposal Sections */}
          {sections.map((section, sectionIndex) => (
            <div key={section.id} className="p-4 sm:p-8 border-b border-gray-200">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4 break-words" data-testid={`text-section-title-${sectionIndex}`}>
                {section.title}
              </h3>

              {/* Section Description */}
              {section.description && (
                <div className="mb-2 sm:mb-6">
                  <p className="text-gray-700 text-xs sm:text-base whitespace-pre-wrap break-words">
                    <LinkifiedText text={section.description} />
                  </p>
                </div>
              )}

              {/* Section Photos */}
              {(section.photos || []).length > 0 && (
                <div className="mb-4 sm:mb-6">
                  <h4 className="font-medium text-gray-900 text-sm sm:text-base mb-3">Documentation</h4>
                  <div className="grid grid-cols-4 md:grid-cols-4 gap-1 sm:gap-1.5">
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
                          
                          // Create close button
                          const closeBtn = document.createElement('button');
                          closeBtn.innerHTML = '×';
                          closeBtn.className = 'absolute top-4 right-4 text-white text-4xl w-12 h-12 flex items-center justify-center hover:bg-white/20 rounded-full transition-colors z-10';
                          closeBtn.onclick = () => modal.remove();
                          
                          // Create image container
                          const imgContainer = document.createElement('div');
                          imgContainer.className = 'relative w-full h-full flex items-center justify-center p-4 sm:p-16';
                          
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
                          
                          // Clean up on close
                          modal.onclick = () => {
                            document.removeEventListener('keydown', handleKeyDown);
                            modal.remove();
                          };
                          
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
              {(section.lineItems || []).length > 0 && (
                <div className="mb-4 sm:mb-6">
                  <h4 className="font-medium text-gray-900 text-sm sm:text-base mb-3">Services & Pricing</h4>
                  <div className="w-full overflow-x-auto">
                    <div className="inline-block min-w-full align-middle">
                      <table className="w-full border-collapse border border-gray-200 rounded-lg overflow-hidden">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="border border-gray-200 px-2 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-gray-900">Service</th>
                            <th className="border border-gray-200 px-2 sm:px-4 py-2 sm:py-3 text-center text-xs sm:text-sm font-semibold text-gray-900">Qty</th>
                            <th className="border border-gray-200 px-2 sm:px-4 py-2 sm:py-3 text-center text-xs sm:text-sm font-semibold text-gray-900 hidden sm:table-cell">Rate</th>
                            <th className="border border-gray-200 px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-900">Price</th>
                            <th className="border border-gray-200 px-2 sm:px-4 py-2 sm:py-3 text-center text-xs sm:text-sm font-semibold text-gray-900 hidden md:table-cell">Optional</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(section.lineItems || []).map((item, index) => {
                            let displayPrice = item.totalPrice;
                            const effectiveChoiceId = selectedChoices[item.id] || item.selectedChoiceId;
                            if (item.pricingType === 'choice' && effectiveChoiceId) {
                              const selectedChoice = item.choices?.find(c => c.id === effectiveChoiceId);
                              if (selectedChoice) {
                                displayPrice = selectedChoice.price * item.quantity;
                              }
                            } else if (item.pricingType === 'fixed' && item.fixedPrice) {
                              displayPrice = item.fixedPrice;
                            }

                            // Check if this item is selected (use state override if available, otherwise use original)
                            // All items can be selected/deselected by the customer, not just optional ones
                            const isItemSelected = selectedOptionalItems[item.id] !== undefined 
                              ? selectedOptionalItems[item.id] 
                              : item.selected;
                            
                            // Determine if this row is clickable - all rows are clickable in customer selection mode
                            const isRowClickable = allowChoiceSelection && onOptionalToggle;
                            
                            const handleRowClick = () => {
                              if (isRowClickable) {
                                onOptionalToggle(item.id, !isItemSelected);
                              }
                            };

                            return (
                              <tr 
                                key={item.id} 
                                className={`
                                  ${isItemSelected ? 'bg-green-50' : 'even:bg-gray-50'} 
                                  ${!isItemSelected && item.isOptional ? 'opacity-60' : ''}
                                  ${isRowClickable ? 'cursor-pointer hover:bg-green-100 transition-colors' : ''}
                                `} 
                                data-testid={`row-line-item-${sectionIndex}-${index}`}
                                onClick={handleRowClick}
                              >
                                <td className="border border-gray-200 px-2 sm:px-4 py-2 sm:py-3 text-gray-900">
                                  <div className="flex items-start gap-2">
                                    {/* Checkbox for selection */}
                                    {isRowClickable && (
                                      <input 
                                        type="checkbox" 
                                        checked={isItemSelected}
                                        onChange={(e) => {
                                          e.stopPropagation();
                                          onOptionalToggle(item.id, e.target.checked);
                                        }}
                                        className="mt-0.5 h-4 w-4 text-green-600 focus:ring-green-500 cursor-pointer shrink-0 rounded border-gray-300"
                                      />
                                    )}
                                    <div className="flex-1">
                                      <span className="font-medium text-xs sm:text-sm break-words">
                                        <LinkifiedText text={item.description} />
                                      </span>
                                      {item.notes && (
                                        <p className="text-xs text-gray-600 mt-1 break-words">
                                          <LinkifiedText text={item.notes} />
                                        </p>
                                      )}
                                      {item.pricingType === 'choice' && item.choices && item.choices.length > 0 && (
                                        <div className="mt-2 text-xs" onClick={(e) => e.stopPropagation()}>
                                          <p className="text-gray-600 font-medium">{allowChoiceSelection ? 'Select an option:' : 'Options:'}</p>
                                          <ul className="ml-1 space-y-1.5 mt-1">
                                            {item.choices.map(choice => {
                                              const effectiveChoiceId = selectedChoices[item.id] || item.selectedChoiceId;
                                              const isSelected = choice.id === effectiveChoiceId;
                                              return (
                                                <li 
                                                  key={choice.id} 
                                                  className={`flex items-start gap-2 ${isSelected ? 'font-medium text-green-700' : 'text-gray-600'} break-words ${allowChoiceSelection ? 'cursor-pointer hover:bg-green-50 p-1.5 rounded-md transition-colors' : ''}`}
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (allowChoiceSelection && onChoiceSelect) {
                                                      onChoiceSelect(item.id, choice.id);
                                                    }
                                                  }}
                                                >
                                                  {allowChoiceSelection ? (
                                                    <input 
                                                      type="radio" 
                                                      name={`choice-${item.id}`}
                                                      checked={isSelected}
                                                      onChange={(e) => {
                                                        e.stopPropagation();
                                                        onChoiceSelect?.(item.id, choice.id);
                                                      }}
                                                      className="mt-0.5 h-4 w-4 text-green-600 focus:ring-green-500 cursor-pointer"
                                                    />
                                                  ) : (
                                                    <span>•</span>
                                                  )}
                                                  <span className="flex-1">
                                                    {choice.label} - {formatCurrency(choice.price)}
                                                    {choice.description && (
                                                      <span className="block text-gray-500 text-[10px] mt-0.5">{choice.description}</span>
                                                    )}
                                                  </span>
                                                </li>
                                              );
                                            })}
                                          </ul>
                                        </div>
                                      )}
                                      {item.isOptional && !isRowClickable && (
                                        <div className="mt-1 md:hidden">
                                          <Badge variant={isItemSelected ? "default" : "secondary"} className="text-xs">
                                            {isItemSelected ? "Included" : "Optional"}
                                          </Badge>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td className="border border-gray-200 px-2 sm:px-4 py-2 sm:py-3 text-center text-xs sm:text-sm text-gray-700">{item.quantity}</td>
                                <td className="border border-gray-200 px-2 sm:px-4 py-2 sm:py-3 text-center text-xs sm:text-sm text-gray-700 hidden sm:table-cell">{formatCurrency(item.unitPrice)}</td>
                                <td className="border border-gray-200 px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-900 whitespace-nowrap">{formatCurrency(displayPrice)}</td>
                                <td className="border border-gray-200 px-2 sm:px-4 py-2 sm:py-3 text-center hidden md:table-cell">
                                  {item.isOptional && !isRowClickable && (
                                    <Badge variant={isItemSelected ? "default" : "secondary"} className="text-xs">
                                      {isItemSelected ? "Included" : "Optional"}
                                    </Badge>
                                  )}
                                  {isRowClickable && (
                                    <Badge variant={isItemSelected ? "default" : "secondary"} className="text-xs">
                                      {isItemSelected ? "Selected" : "Click to select"}
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

          {/* Footer */}
          <div className="p-3 sm:p-4 pt-2">
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