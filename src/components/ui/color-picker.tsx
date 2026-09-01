import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  disabled?: boolean;
  label?: string;
}

const PRESET_COLORS = [
  "#000000", // Black
  "#FFFFFF", // White
  "#EF4444", // Red
  "#F97316", // Orange
  "#EAB308", // Yellow
  "#22C55E", // Green
  "#06B6D4", // Cyan
  "#3B82F6", // Blue
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#6B7280", // Gray
];

export function ColorPicker({ value, onChange, disabled, label }: ColorPickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-10 w-12 rounded-lg border border-border p-0"
          disabled={disabled}
          title={label || "Pick a color"}
        >
          <div
            className="h-8 w-10 rounded-md border border-border"
            style={{ backgroundColor: value || "#000000" }}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 rounded-2xl p-3">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold">Custom Color</label>
            <Input
              type="color"
              value={value || "#000000"}
              onChange={(e) => onChange(e.target.value)}
              disabled={disabled}
              className="h-9 w-16 cursor-pointer border-border rounded-lg"
            />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold">Presets</p>
            <div className="grid grid-cols-6 gap-2">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => onChange(color)}
                  disabled={disabled}
                  className="h-8 w-8 rounded-lg border-2 border-border transition-all hover:scale-110"
                  style={{
                    backgroundColor: color,
                    borderColor: value === color ? "#000000" : undefined,
                    borderWidth: value === color ? "2px" : "1px",
                  }}
                  title={color}
                />
              ))}
            </div>
          </div>
          <Input
            type="text"
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            placeholder="#000000"
            className="h-9 text-xs border-border rounded-lg"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
