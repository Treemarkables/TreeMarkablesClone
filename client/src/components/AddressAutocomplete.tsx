import { useState, useRef, useEffect } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onAddressSelect?: (address: string) => void;
  onManualEdit?: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  "data-testid"?: string;
  mode?: "full" | "street" | "city" | "region"; // Different modes for different field types
}

interface AddySuggestion {
  a: string; // Full address
  pxid: string; // Unique ID
  v: number; // Version
  components?: {
    street?: string;
    suburb?: string;
    city?: string;
    region?: string;
    postcode?: string;
  };
}

export function AddressAutocomplete({
  value,
  onChange,
  onAddressSelect,
  onManualEdit,
  placeholder = "Start typing an address...",
  className,
  disabled,
  "data-testid": testId,
  mode = "full"
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<AddySuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const debounceRef = useRef<NodeJS.Timeout>();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isSelectingSuggestionRef = useRef(false);

  // Function to search addresses using backend API
  const searchAddresses = async (query: string) => {
    if (query.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsLoading(true);
    try {
      // Use secure backend API endpoint
      const response = await fetch(
        `/api/address-search?q=${encodeURIComponent(query)}&limit=8`,
        {
          headers: {
            'Accept': 'application/json',
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSuggestions(data.addresses || []);
          setShowSuggestions(true);
          setSelectedIndex(-1);
        } else {
          console.warn('Address search failed:', data.message);
          setSuggestions([]);
          setShowSuggestions(false);
        }
      } else {
        console.warn('Address API returned error:', response.status);
        setSuggestions([]);
        setShowSuggestions(false);
      }
    } catch (error) {
      console.warn('Address API unavailable:', error);
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setIsLoading(false);
    }
  };


  // Format address with proper spacing
  const formatAddress = (address: string): string => {
    // If address already has proper formatting (commas with spaces), return as-is
    if (address.includes(', ')) {
      return address;
    }
    
    // Always add space before capital letters that follow lowercase letters
    // This fixes "StreetWhataupoko" -> "Street Whataupoko"
    let formatted = address.replace(/([a-z])([A-Z])/g, '$1 $2');
    
    // Also ensure commas are followed by a space
    formatted = formatted.replace(/,([^\s])/g, ', $1');
    
    // If address was formatted, return it
    if (formatted !== address) {
      return formatted;
    }
    
    // If address already has commas, return as-is
    if (address.includes(',')) {
      return address;
    }
    
    // First, handle addresses with newline characters
    // Convert "23 Moana Dr\nHawke's Bay\nMahia 4198" -> "23 Moana Dr, Hawke's Bay, Mahia 4198"
    if (address.includes('\n')) {
      return address.split('\n').map(line => line.trim()).filter(line => line).join(', ');
    }
    
    // Try to intelligently add spaces and commas for readability
    // Pattern: "23 Moana DrHawke's BayMahia 4198" -> "23 Moana Dr, Hawke's Bay, Mahia 4198"
    
    // Now split by postcode pattern (4 digits at end)
    const postcodeMatch = formatted.match(/^(.+)\s+(\d{4})$/);
    
    if (postcodeMatch) {
      const [, addressPart, postcode] = postcodeMatch;
      
      // Split address into parts (street, region, city)
      // Look for pattern where we have multiple capitalized words
      const parts = addressPart.split(/\s+(?=[A-Z])/);
      
      if (parts.length >= 3) {
        // Join street parts, region, city with commas
        const street = parts.slice(0, -2).join(' ');
        const region = parts[parts.length - 2];
        const city = parts[parts.length - 1];
        return `${street}, ${region}, ${city} ${postcode}`;
      } else if (parts.length === 2) {
        return `${parts[0]}, ${parts[1]} ${postcode}`;
      }
      
      return `${addressPart}, ${postcode}`;
    }
    
    // Fallback: just add space before capitals
    return formatted;
  };

  // Parse address using structured data when available, fallback to intelligent parsing
  const parseAddress = (suggestion: AddySuggestion) => {
    // Use structured data if available (from our enhanced mock data or real API)
    if (suggestion.components) {
      const street = suggestion.components.street || '';
      const streetParts = street.split(' ');
      return {
        fullAddress: suggestion.a,
        streetNumber: streetParts[0] || '',
        streetName: streetParts.slice(1).join(' ') || '',
        suburb: suggestion.components.suburb || '',
        city: suggestion.components.city || '',
        region: suggestion.components.region || '',
        postcode: suggestion.components.postcode || ''
      };
    }

    // Fallback to intelligent parsing for older API responses
    const fullAddress = suggestion.a;
    const parts = fullAddress.split(', ');
    
    // Handle common NZ address format: "123 Street Name, Suburb, City PostCode"
    let streetNumber = '';
    let streetName = '';
    let suburb = '';
    let city = '';
    let region = '';
    let postcode = '';

    if (parts.length >= 3) {
      // Parse street address (first part)
      const streetParts = parts[0].trim().split(' ');
      streetNumber = streetParts[0] || '';
      streetName = streetParts.slice(1).join(' ') || '';
      
      // Suburb is second part
      suburb = parts[1]?.trim() || '';
      
      // City and postcode are in the third part
      const cityPostcodePart = parts[2]?.trim() || '';
      const cityPostcodeMatch = cityPostcodePart.match(/^(.+?)\s+(\d{4})$/);
      
      if (cityPostcodeMatch) {
        city = cityPostcodeMatch[1].trim();
        postcode = cityPostcodeMatch[2];
      } else {
        city = cityPostcodePart;
      }

      // Map cities to their regions (NZ-specific)
      const cityToRegionMap: Record<string, string> = {
        'Auckland': 'Auckland',
        'Wellington': 'Wellington',
        'Christchurch': 'Canterbury',
        'Hamilton': 'Waikato',
        'Tauranga': 'Bay of Plenty',
        'Dunedin': 'Otago',
        'New Plymouth': 'Taranaki',
        'Palmerston North': 'Manawatū-Whanganui',
        'Napier': 'Hawke\'s Bay',
        'Hastings': 'Hawke\'s Bay',
        'Rotorua': 'Bay of Plenty',
        'Whangarei': 'Northland',
        'Invercargill': 'Southland',
        'Nelson': 'Nelson',
        'Queenstown': 'Otago'
      };
      
      region = cityToRegionMap[city] || '';
    }

    return {
      fullAddress,
      streetNumber,
      streetName,
      suburb,
      city,
      region,
      postcode
    };
  };

  // Handle input change with debounce and manual edit detection
  const handleInputChange = (newValue: string) => {
    onChange(newValue);
    
    // Only notify parent of manual edit if we're not in the middle of selecting a suggestion
    if (onManualEdit && !isSelectingSuggestionRef.current) {
      onManualEdit();
    }
    
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      searchAddresses(newValue);
    }, 300);
  };

  // Handle suggestion selection
  const selectSuggestion = (suggestion: AddySuggestion) => {
    // Set flag to indicate we're selecting a suggestion (not manual typing)
    isSelectingSuggestionRef.current = true;
    
    const parsedAddress = parseAddress(suggestion);
    
    if (mode === "full") {
      // Format the address with proper commas
      const formattedAddress = formatAddress(suggestion.a);
      onChange(formattedAddress);
    } else if (mode === "street") {
      onChange(`${parsedAddress.streetNumber} ${parsedAddress.streetName}`.trim());
    } else if (mode === "city") {
      onChange(parsedAddress.city);
    } else if (mode === "region") {
      onChange(parsedAddress.region);
    }

    if (onAddressSelect) {
      onAddressSelect(parsedAddress);
    }

    setShowSuggestions(false);
    setSelectedIndex(-1);
    
    // Reset flag after a brief delay to allow for the onChange to complete
    setTimeout(() => {
      isSelectingSuggestionRef.current = false;
    }, 50);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          selectSuggestion(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
    }
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative px-4">
      <div className="relative">
        <Input
          ref={inputRef}
          value={formatAddress(value)}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => value.length >= 3 && setShowSuggestions(suggestions.length > 0)}
          placeholder={placeholder}
          className={`${className} leading-relaxed`}
          disabled={disabled}
          data-testid={testId}
        />
        {isLoading && (
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <Card className="absolute top-full left-0 right-0 z-50 mt-1">
          <CardContent className="p-0">
            <div className="max-h-60 overflow-y-auto">
              {suggestions.map((suggestion, index) => (
                <button
                  key={suggestion.pxid}
                  className={`w-full text-left px-3 py-2 hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground border-b border-border last:border-b-0 ${
                    index === selectedIndex ? 'bg-accent text-accent-foreground' : ''
                  }`}
                  onClick={() => selectSuggestion(suggestion)}
                  data-testid={`address-suggestion-${index}`}
                >
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm truncate">{suggestion.a}</span>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}