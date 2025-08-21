import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronRight, Barcode } from 'lucide-react';
import { WizardData } from '../AddProductWizard';
import { useSearchProducts } from '@/hooks/useProducts';

interface BarcodeStepProps {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  onNext: () => void;
}

export function BarcodeStep({ data, onUpdate, onNext }: BarcodeStepProps) {
  const [barcode, setBarcode] = useState(data.barcode || '');
  const inputRef = useRef<HTMLInputElement>(null);
  
  const { data: searchResults = [] } = useSearchProducts(barcode);

  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleBarcodeChange = (value: string) => {
    setBarcode(value);
    onUpdate({ barcode: value });
    
    // Auto-search for existing product
    if (value.trim()) {
      const foundProduct = searchResults.find(p => 
        p.upc === value || p.barcode === value || p.sku === value
      );
      
      if (foundProduct) {
        onUpdate({ 
          productId: foundProduct.id,
          productName: foundProduct.name,
        });
      } else {
        onUpdate({ 
          productId: undefined,
          productName: undefined,
        });
      }
    }
  };

  const handleNext = () => {
    onUpdate({ barcode });
    onNext();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNext();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
          <Barcode className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Scan or Enter Barcode</h2>
        <p className="text-muted-foreground text-sm">
          Scan the product barcode or enter it manually
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 px-6">
        <div className="space-y-4">
          <Input
            ref={inputRef}
            placeholder="Product Barcode"
            value={barcode}
            onChange={(e) => handleBarcodeChange(e.target.value)}
            onKeyPress={handleKeyPress}
            className="text-center text-lg h-12 font-mono"
          />
          
          {data.productName && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-center">
              <p className="text-sm text-green-700">Product Found!</p>
              <p className="font-medium text-green-800">{data.productName}</p>
            </div>
          )}
          
          {barcode.trim() && !data.productName && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-center">
              <p className="text-sm text-blue-700">
                New product will be created for barcode: <span className="font-mono">{barcode}</span>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="p-6 border-t">
        <Button 
          onClick={handleNext}
          disabled={!barcode.trim()}
          size="lg"
          className="w-full"
        >
          Next
          <ChevronRight className="ml-2 w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}