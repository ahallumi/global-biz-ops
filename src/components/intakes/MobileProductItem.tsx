import { Button } from '@/components/ui/button';
import { ResponsiveProductImage } from './ResponsiveProductImage';
import { Trash2 } from 'lucide-react';
import { format } from 'date-fns';

interface MobileProductItemProps {
  item: {
    id: string;
    quantity: number;
    quantity_boxes: number;
    unit_cost_cents: number;
    line_total_cents?: number;
    lot_number?: string;
    expiry_date?: string;
    photo_url?: string;
    products?: {
      name: string;
    };
  };
  onDelete: () => void;
  isDeleting: boolean;
}

export function MobileProductItem({ item, onDelete, isDeleting }: MobileProductItemProps) {
  return (
    <div className="border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-start gap-3">
        <ResponsiveProductImage
          productName={item.products?.name || 'Unknown Product'}
          photoUrl={item.photo_url}
          size="md"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-medium text-foreground text-sm leading-tight">
              {item.products?.name || 'Unknown Product'}
            </h4>
            <Button
              size="sm"
              variant="ghost"
              onClick={onDelete}
              disabled={isDeleting}
              className="text-destructive hover:text-destructive p-1 h-8 w-8"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-2 text-right">
            <p className="font-medium text-foreground">
              ${((item.line_total_cents || 0) / 100).toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-muted-foreground block">Quantity</span>
          <span className="text-foreground font-medium">
            {item.quantity} ({item.quantity_boxes} boxes)
          </span>
        </div>
        <div>
          <span className="text-muted-foreground block">Unit Cost</span>
          <span className="text-foreground font-medium">
            ${(item.unit_cost_cents / 100).toFixed(2)}
          </span>
        </div>
        
        {item.lot_number && (
          <div>
            <span className="text-muted-foreground block">Lot Number</span>
            <span className="text-foreground font-mono text-xs">
              {item.lot_number}
            </span>
          </div>
        )}
        
        {item.expiry_date && (
          <div>
            <span className="text-muted-foreground block">Expiry Date</span>
            <span className="text-foreground">
              {format(new Date(item.expiry_date), 'MMM dd, yyyy')}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}