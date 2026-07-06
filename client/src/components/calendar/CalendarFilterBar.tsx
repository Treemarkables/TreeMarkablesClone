import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Users, Tag, X } from "lucide-react";
import type { CalendarEmployee } from "./calendarMath";
import type { CalendarFilter } from "./useCalendarData";

const STORAGE_KEY = "calendar-filters";

// Statuses a scheduled job can realistically carry on the calendar.
const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "work_order", label: "Work order" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "quote", label: "Quote" },
  { value: "lead", label: "Lead" },
];

export function loadStoredFilter(): CalendarFilter {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<CalendarFilter>;
      return {
        staffIds: Array.isArray(parsed.staffIds) ? parsed.staffIds : [],
        statuses: Array.isArray(parsed.statuses) ? parsed.statuses : [],
      };
    }
  } catch {
    // corrupted storage — fall through to defaults
  }
  return { staffIds: [], statuses: [] };
}

interface CalendarFilterBarProps {
  employees: CalendarEmployee[];
  filter: CalendarFilter;
  onFilterChange: (filter: CalendarFilter) => void;
}

export function CalendarFilterBar({
  employees,
  filter,
  onFilterChange,
}: CalendarFilterBarProps) {
  const [staffOpen, setStaffOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filter));
    } catch {
      // storage unavailable (private mode) — filters just won't persist
    }
  }, [filter]);

  const toggleStaff = (id: string) => {
    const next = filter.staffIds.includes(id)
      ? filter.staffIds.filter((s) => s !== id)
      : [...filter.staffIds, id];
    onFilterChange({ ...filter, staffIds: next });
  };

  const toggleStatus = (value: string) => {
    const next = filter.statuses.includes(value)
      ? filter.statuses.filter((s) => s !== value)
      : [...filter.statuses, value];
    onFilterChange({ ...filter, statuses: next });
  };

  const hasFilters = filter.staffIds.length > 0 || filter.statuses.length > 0;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Popover open={staffOpen} onOpenChange={setStaffOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={filter.staffIds.length > 0 ? "default" : "outline"}
            size="sm"
            data-testid="button-filter-staff"
          >
            <Users className="h-4 w-4 mr-1" />
            Staff
            {filter.staffIds.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px]">
                {filter.staffIds.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2" align="start">
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {employees.map((emp) => (
              <label
                key={emp.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover-elevate text-sm"
                data-testid={`filter-staff-${emp.id}`}
              >
                <Checkbox
                  checked={filter.staffIds.includes(emp.id)}
                  onCheckedChange={() => toggleStaff(emp.id)}
                />
                <span className="truncate">
                  {emp.firstName} {emp.lastName}
                </span>
              </label>
            ))}
            {employees.length === 0 && (
              <p className="text-xs text-muted-foreground px-2 py-1.5">
                No active staff
              </p>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <Popover open={statusOpen} onOpenChange={setStatusOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={filter.statuses.length > 0 ? "default" : "outline"}
            size="sm"
            data-testid="button-filter-status"
          >
            <Tag className="h-4 w-4 mr-1" />
            Status
            {filter.statuses.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px]">
                {filter.statuses.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-2" align="start">
          <div className="space-y-1">
            {STATUS_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover-elevate text-sm"
                data-testid={`filter-status-${opt.value}`}
              >
                <Checkbox
                  checked={filter.statuses.includes(opt.value)}
                  onCheckedChange={() => toggleStatus(opt.value)}
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onFilterChange({ staffIds: [], statuses: [] })}
          data-testid="button-clear-filters"
        >
          <X className="h-4 w-4 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
}
