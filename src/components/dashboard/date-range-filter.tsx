// ==============================================
// RateFlow — Dashboard: Date Range Filter
// Toggle between 10d / 15d / 30d views
// ==============================================

"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DateRangeFilterProps {
  value: number;
  onChange: (days: number) => void;
}

const options = [
  { label: "10 days", value: 10 },
  { label: "15 days", value: 15 },
  { label: "30 days", value: 30 },
];

export function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-border p-1">
      {options.map((option) => (
        <Button
          key={option.value}
          variant="ghost"
          size="sm"
          onClick={() => onChange(option.value)}
          className={cn(
            "h-7 px-3 text-xs font-medium",
            value === option.value &&
              "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
          )}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
