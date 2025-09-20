import React, { useState, useMemo, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Search, 
  Filter, 
  X, 
  Calendar,
  DollarSign,
  Phone,
  Mail,
  User,
  MapPin,
  FileText,
  Target,
  Briefcase
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface SearchFilter {
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'date_range';
  value: string;
  label: string;
}

interface GlobalSearchProps {
  data: any[];
  searchFields: string[];
  onFilteredResults: (results: any[]) => void;
  placeholder?: string;
  enableFilters?: boolean;
  filterOptions?: {
    field: string;
    label: string;
    type: 'text' | 'select' | 'date' | 'number';
    options?: { value: string; label: string }[];
  }[];
}

export function GlobalSearch({ 
  data, 
  searchFields, 
  onFilteredResults, 
  placeholder = "Search...",
  enableFilters = true,
  filterOptions = []
}: GlobalSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<SearchFilter[]>([]);
  const [showFilterPopover, setShowFilterPopover] = useState(false);

  // Debounce search query updates
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 250); // 250ms delay

    return () => {
      clearTimeout(handler);
    };
  }, [searchQuery]);

  // Apply search and filters
  const filteredData = useMemo(() => {
    let results = data;

    // Apply text search (using debounced query)
    if (debouncedSearchQuery.trim()) {
      results = results.filter((item: any) => {
        return searchFields.some(field => {
          const value = getNestedValue(item, field);
          return value?.toString().toLowerCase().includes(debouncedSearchQuery.toLowerCase());
        });
      });
    }

    // Apply filters
    activeFilters.forEach(filter => {
      results = results.filter((item: any) => {
        const value = getNestedValue(item, filter.field);
        
        switch (filter.operator) {
          case 'equals':
            return value?.toString().toLowerCase() === filter.value.toLowerCase();
          case 'contains':
            return value?.toString().toLowerCase().includes(filter.value.toLowerCase());
          case 'greater_than':
            return Number(value) > Number(filter.value);
          case 'less_than':
            return Number(value) < Number(filter.value);
          case 'date_range':
            // Simplified date filtering
            const itemDate = new Date(value);
            const filterDate = new Date(filter.value);
            return itemDate >= filterDate;
          default:
            return true;
        }
      });
    });

    return results;
  }, [data, debouncedSearchQuery, activeFilters, searchFields]);

  // Update parent with filtered results
  React.useEffect(() => {
    onFilteredResults(filteredData);
  }, [filteredData, onFilteredResults]);

  const getNestedValue = (obj: any, path: string) => {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  };

  const addFilter = (field: string, operator: string, value: string, label: string) => {
    const newFilter: SearchFilter = { field, operator, value, label };
    setActiveFilters(prev => [...prev.filter(f => f.field !== field), newFilter]);
    setShowFilterPopover(false);
  };

  const removeFilter = (fieldToRemove: string) => {
    setActiveFilters(prev => prev.filter(f => f.field !== fieldToRemove));
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setActiveFilters([]);
  };

  const getFieldIcon = (fieldType: string) => {
    switch (fieldType) {
      case 'email': return <Mail className="h-3 w-3" />;
      case 'phone': return <Phone className="h-3 w-3" />;
      case 'name': return <User className="h-3 w-3" />;
      case 'address': return <MapPin className="h-3 w-3" />;
      case 'date': return <Calendar className="h-3 w-3" />;
      case 'amount': return <DollarSign className="h-3 w-3" />;
      case 'status': return <Target className="h-3 w-3" />;
      case 'type': return <FileText className="h-3 w-3" />;
      case 'job': return <Briefcase className="h-3 w-3" />;
      default: return <Search className="h-3 w-3" />;
    }
  };

  return (
    <div className="space-y-3">
      {/* Search Bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder={placeholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4"
            data-testid="global-search-input"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchQuery('')}
              className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 p-0 hover:bg-gray-100"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        {enableFilters && (
          <Popover open={showFilterPopover} onOpenChange={setShowFilterPopover}>
            <PopoverTrigger asChild>
              <Button 
                variant="outline" 
                size="sm"
                className="flex items-center gap-2"
                data-testid="filter-button"
              >
                <Filter className="h-4 w-4" />
                Filters
                {activeFilters.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {activeFilters.length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-sm mb-3">Add Filter</h4>
                  {filterOptions.map((option) => (
                    <FilterOption
                      key={option.field}
                      option={option}
                      onAddFilter={addFilter}
                    />
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )}

        {(searchQuery || activeFilters.length > 0) && (
          <Button
            variant="outline"
            size="sm"
            onClick={clearAllFilters}
            className="text-gray-600 hover:text-gray-800"
            data-testid="clear-filters-button"
          >
            Clear All
          </Button>
        )}
      </div>

      {/* Active Filters */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {activeFilters.map((filter) => (
            <Badge
              key={filter.field}
              variant="outline"
              className="flex items-center gap-2 py-1 px-2 hover:bg-gray-50"
            >
              {getFieldIcon(filter.field)}
              <span className="text-xs">
                {filter.label}: {filter.value}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeFilter(filter.field)}
                className="h-3 w-3 p-0 hover:bg-transparent"
              >
                <X className="h-2 w-2" />
              </Button>
            </Badge>
          ))}
        </div>
      )}

      {/* Results Summary */}
      <div className="text-sm text-gray-600">
        Showing {filteredData.length} of {data.length} results
        {searchQuery && (
          <span> for "{searchQuery}"</span>
        )}
      </div>
    </div>
  );
}

// Helper component for filter options
function FilterOption({ 
  option, 
  onAddFilter 
}: { 
  option: any; 
  onAddFilter: (field: string, operator: string, value: string, label: string) => void;
}) {
  const [operator, setOperator] = useState<string>('equals');
  const [value, setValue] = useState('');

  const handleAddFilter = () => {
    if (value.trim()) {
      onAddFilter(option.field, operator, value, option.label);
      setValue('');
    }
  };

  const getOperatorOptions = (type: string) => {
    switch (type) {
      case 'text':
        return [
          { value: 'contains', label: 'Contains' },
          { value: 'equals', label: 'Equals' }
        ];
      case 'number':
        return [
          { value: 'equals', label: 'Equals' },
          { value: 'greater_than', label: 'Greater than' },
          { value: 'less_than', label: 'Less than' }
        ];
      case 'date':
        return [
          { value: 'date_range', label: 'After' },
          { value: 'equals', label: 'On' }
        ];
      case 'select':
        return [{ value: 'equals', label: 'Is' }];
      default:
        return [{ value: 'equals', label: 'Equals' }];
    }
  };

  return (
    <Card className="p-3 mb-2">
      <div className="space-y-2">
        <div className="text-sm font-medium">{option.label}</div>
        <div className="grid grid-cols-2 gap-2">
          <Select value={operator} onValueChange={setOperator}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {getOperatorOptions(option.type).map((op) => (
                <SelectItem key={op.value} value={op.value}>
                  {op.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {option.type === 'select' ? (
            <Select value={value} onValueChange={setValue}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {option.options?.map((opt: any) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              placeholder="Value"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              type={option.type === 'number' ? 'number' : option.type === 'date' ? 'date' : 'text'}
              className="h-8 text-xs"
            />
          )}
        </div>
        <Button
          onClick={handleAddFilter}
          disabled={!value.trim()}
          className="w-full h-7 text-xs"
          size="sm"
        >
          Add Filter
        </Button>
      </div>
    </Card>
  );
}