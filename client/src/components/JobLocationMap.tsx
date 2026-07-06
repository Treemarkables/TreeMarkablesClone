import { useState } from "react";
import { MapPin, Building2, ChevronDown, ChevronUp, ExternalLink, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface JobLocationMapProps {
  jobAddress: string;
  className?: string;
}

// Yard/depot location - 213 Stanley Road, Gisborne, New Zealand
const YARD_ADDRESS = "213 Stanley Road, Gisborne, New Zealand";

export function JobLocationMap({ jobAddress, className = "" }: JobLocationMapProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mapMode, setMapMode] = useState<'satellite' | 'directions'>('satellite');

  if (!jobAddress) {
    return null;
  }

  // Encode addresses for Google Maps
  const encodedJobAddress = encodeURIComponent(jobAddress);
  const encodedYardAddress = encodeURIComponent(YARD_ADDRESS);

  // Satellite view of job location (bird's eye)
  const satelliteMapUrl = `https://maps.google.com/maps?q=${encodedJobAddress}&t=k&z=18&output=embed`;
  
  // Directions view showing both yard and job location with route
  const directionsMapUrl = `https://maps.google.com/maps?saddr=${encodedYardAddress}&daddr=${encodedJobAddress}&output=embed`;

  // Current embed URL based on mode
  const mapEmbedUrl = mapMode === 'satellite' ? satelliteMapUrl : directionsMapUrl;

  // Google Maps directions URL (opens in new tab)
  const directionsUrl = `https://www.google.com/maps/dir/${encodedYardAddress}/${encodedJobAddress}`;

  // Google Maps satellite view URL (opens in new tab)
  const satelliteViewUrl = `https://www.google.com/maps/place/${encodedJobAddress}/@-38.65,178.02,17z/data=!3m1!1e3`;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
      <CollapsibleTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="w-full justify-between text-xs text-muted-foreground"
        >
          <span className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" />
            View on Map (Bird's Eye)
          </span>
          {isOpen ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </Button>
      </CollapsibleTrigger>
      
      <CollapsibleContent className="mt-2">
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            {/* Map mode toggle */}
            <div className="flex gap-1 p-2 bg-muted/50 border-b">
              <Button
                variant={mapMode === 'satellite' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setMapMode('satellite')}
                className="flex-1 text-xs"
              >
                <MapPin className="h-3 w-3 mr-1" />
                Job Site
              </Button>
              <Button
                variant={mapMode === 'directions' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setMapMode('directions')}
                className="flex-1 text-xs"
              >
                <Navigation className="h-3 w-3 mr-1" />
                Route from Yard
              </Button>
            </div>
            
            {/* Map embed - satellite or directions view */}
            <div className="relative w-full h-52 bg-muted">
              <iframe
                key={mapMode}
                src={mapEmbedUrl}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title={mapMode === 'satellite' ? "Job location satellite map" : "Route from yard to job"}
                className="absolute inset-0"
              />
            </div>
            
            {/* Location info and actions */}
            <div className="p-3 space-y-2 bg-card">
              {/* Job address */}
              <div className="flex items-start gap-2 text-xs">
                <MapPin className="h-3.5 w-3.5 mt-0.5 text-orange-500 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-foreground">Job Site</span>
                  <p className="text-muted-foreground break-words">{jobAddress}</p>
                </div>
              </div>
              
              {/* Yard address */}
              <div className="flex items-start gap-2 text-xs">
                <Building2 className="h-3.5 w-3.5 mt-0.5 text-blue-500 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-foreground">Yard</span>
                  <p className="text-muted-foreground break-words">{YARD_ADDRESS}</p>
                </div>
              </div>
              
              {/* Action buttons */}
              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => window.open(directionsUrl, '_blank')}
                >
                  <Navigation className="h-3.5 w-3.5 mr-1.5" />
                  Open in Google Maps
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => window.open(satelliteViewUrl, '_blank')}
                  title="Open full satellite view"
                  aria-label="Open full satellite view"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
}
