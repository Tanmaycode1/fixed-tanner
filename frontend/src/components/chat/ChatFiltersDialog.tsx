import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Filters } from "@/types/chat";

interface ChatFiltersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  onApply: () => void;
  onReset: () => void;
}

export function ChatFiltersDialog({
  open,
  onOpenChange,
  filters,
  onFiltersChange,
  onApply,
  onReset
}: ChatFiltersDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Filter Messages</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Date Range</label>
            <div className="grid grid-cols-2 gap-4">
              <Calendar
                mode="single"
                selected={filters.start_date ? new Date(filters.start_date) : undefined}
                onSelect={(date) => onFiltersChange({...filters, start_date: date?.toISOString()})}
              />
              <Calendar
                mode="single"
                selected={filters.end_date ? new Date(filters.end_date) : undefined}
                onSelect={(date) => onFiltersChange({...filters, end_date: date?.toISOString()})}
              />
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox
              id="read"
              checked={filters.is_read}
              onCheckedChange={(checked) => onFiltersChange({...filters, is_read: !!checked})}
            />
            <label htmlFor="read">Show read messages only</label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="attachments"
              checked={filters.has_attachment}
              onCheckedChange={(checked) => onFiltersChange({...filters, has_attachment: !!checked})}
            />
            <label htmlFor="attachments">Show messages with attachments</label>
          </div>

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={onReset}>Reset</Button>
            <Button onClick={onApply}>Apply Filters</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 