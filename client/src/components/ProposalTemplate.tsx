import { useState, useEffect, useRef, forwardRef } from 'react';
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

// Lazy loading image component using Intersection Observer
function LazyImage({ src, alt, className }: { src: string; alt: string; className: string }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !isLoaded) {
            setIsLoaded(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '100px', // Start loading 100px before image enters viewport
        threshold: 0.01
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [isLoaded]);

  return (
    <img
      ref={imgRef}
      src={isLoaded ? src : 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="600" height="600"%3E%3Crect width="600" height="600" fill="%23f3f4f6"/%3E%3C/svg%3E'}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
    />
  );
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
                <div className="mb-2 sm:mb-6">
                  <p className="text-gray-700 text-xs sm:text-base whitespace-pre-wrap break-words">{section.description}</p>
                </div>
              )}

              {/* Section Photos */}
              {section.photos.length > 0 && (
                <div className="mb-4 sm:mb-6">
                  <h4 className="font-medium text-gray-900 text-sm sm:text-base mb-3">Documentation</h4>
                  <div className="grid grid-cols-4 md:grid-cols-4 gap-1 sm:gap-1.5">
                    {section.photos.map((photo, photoIndex) => (
                      <div 
                        key={photo.id} 
                        className="bg-gray-50 rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity" 
                        data-testid={`img-photo-${photo.id}`}
                        onClick={() => {
                          const photos = section.photos;
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
                          img.className = 'max-w-full max-h-full object-contain';
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
                          className="w-full aspect-square object-cover"
                        />
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

          <Separator className="my-3 sm:my-4" />

          {/* Totals */}
          <div className="p-3 sm:p-4">
            <div className="flex justify-end">
              <div className="w-full max-w-xs space-y-1 sm:space-y-1.5">
                <div className="flex justify-between text-xs sm:text-sm text-gray-700">
                  <span>Subtotal (excl GST):</span>
                  <span data-testid="text-subtotal" className="font-medium">{formatCurrency(totals.subtotal)}</span>
                </div>
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