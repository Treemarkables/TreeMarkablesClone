import { useState, useRef, useEffect } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onAddressSelect?: (address: {
    fullAddress: string;
    streetNumber?: string;
    streetName?: string;
    suburb?: string;
    city?: string;
    region?: string;
    postcode?: string;
  }) => void;
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
}

export function AddressAutocomplete({
  value,
  onChange,
  onAddressSelect,
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


  // Parse full address into components
  const parseAddress = (fullAddress: string) => {
    const parts = fullAddress.split(', ');
    return {
      fullAddress,
      streetNumber: parts[0]?.split(' ')[0] || '',
      streetName: parts[0]?.split(' ').slice(1).join(' ') || '',
      suburb: parts[1] || '',
      city: parts[2]?.split(' ')[0] || '',
      region: parts[2]?.split(' ')[0] || '', // Same as city for NZ
      postcode: parts[2]?.split(' ').slice(-1)[0] || ''
    };
  };

  // Handle input change with debounce
  const handleInputChange = (newValue: string) => {
    onChange(newValue);
    
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      searchAddresses(newValue);
    }, 300);
  };

  // Handle suggestion selection
  const selectSuggestion = (suggestion: AddySuggestion) => {
    const parsedAddress = parseAddress(suggestion.a);
    
    if (mode === "full") {
      onChange(suggestion.a);
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
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => value.length >= 3 && setShowSuggestions(suggestions.length > 0)}
          placeholder={placeholder}
          className={className}
          disabled={disabled}
          data-testid={testId}
        />
        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <MapPin className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
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