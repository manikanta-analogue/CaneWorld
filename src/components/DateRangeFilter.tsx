import { useMemo, useState } from "react";
import { CalendarDays, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type DateRange = { from: string; to: string; preset: Preset };
export type Preset = "today" | "yesterday" | "7d" | "30d" | "month" | "year" | "all" | "custom";

const startOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const endOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
};

const toInput = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export function presetRange(preset: Preset, from?: string, to?: string): DateRange {
  const now = new Date();
  const make = (start: Date, end = now) => ({ from: toInput(start), to: toInput(end), preset });
  switch (preset) {
    case "today":
      return make(now);
    case "yesterday": {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      return make(yesterday, yesterday);
    }
    case "7d": {
      const start = new Date(now);
      start.setDate(now.getDate() - 6);
      return make(start);
    }
    case "30d": {
      const start = new Date(now);
      start.setDate(now.getDate() - 29);
      return make(start);
    }
    case "month":
      return make(new Date(now.getFullYear(), now.getMonth(), 1));
    case "year":
      return make(new Date(now.getFullYear(), 0, 1));
    case "all":
      return { from: "2000-01-01", to: toInput(now), preset };
    case "custom":
      return { from: from ?? toInput(now), to: to ?? toInput(now), preset };
  }
}

/** ISO bounds for querying, derived from the selected range. */
export function rangeBounds(range: DateRange) {
  return {
    fromIso: startOfDay(new Date(`${range.from}T00:00:00`)).toISOString(),
    toIso: endOfDay(new Date(`${range.to}T00:00:00`)).toISOString(),
  };
}

export function useDateRange(initial: Preset = "30d") {
  const [range, setRange] = useState<DateRange>(() => presetRange(initial));
  const bounds = useMemo(() => rangeBounds(range), [range]);
  return { range, setRange, ...bounds };
}

const labels: Record<Preset, string> = {
  today: "Today",
  yesterday: "Yesterday",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  month: "This month",
  year: "This year",
  all: "All time",
  custom: "Custom range",
};

export function DateRangeFilter({
  range,
  onChange,
  onExport,
}: {
  range: DateRange;
  onChange: (next: DateRange) => void;
  onExport?: (format: "csv" | "xlsx") => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-2">
        <CalendarDays className="h-4 w-4 text-muted-foreground" />
        <Select
          value={range.preset}
          onValueChange={(value) => onChange(presetRange(value as Preset, range.from, range.to))}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(labels) as Preset[]).map((preset) => (
              <SelectItem key={preset} value={preset}>
                {labels[preset]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {range.preset === "custom" && (
        <div className="flex items-center gap-2">
          <Input
            type="date"
            className="w-[150px]"
            aria-label="From date"
            value={range.from}
            max={range.to}
            onChange={(e) => onChange({ ...range, from: e.target.value })}
          />
          <span className="text-xs text-muted-foreground">to</span>
          <Input
            type="date"
            className="w-[150px]"
            aria-label="To date"
            value={range.to}
            min={range.from}
            onChange={(e) => onChange({ ...range, to: e.target.value })}
          />
        </div>
      )}

      {onExport && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Download className="mr-1 h-4 w-4" /> Download
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onExport("csv")}>CSV (.csv)</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onExport("xlsx")}>Excel (.xlsx)</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
