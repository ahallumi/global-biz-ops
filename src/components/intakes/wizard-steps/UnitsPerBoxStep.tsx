import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, PackageCheck } from 'lucide-react';
import { WizardData } from '../AddProductWizard';
import { CustomNumericKeyboard } from './CustomNumericKeyboard';
import { useCreateIntakeItem } from '@/hooks/useIntakes';
import { useCreateProduct } from '@/hooks/useProducts';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface UnitsPerBoxStepProps {
  intakeId: string;
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function UnitsPerBoxStep({ intakeId, data, onUpdate, onNext, onBack }: UnitsPerBoxStepProps) {
  const [displayValue, setDisplayValue] = useState(data.unitsPerBox.toString());
  const [isProcessing, setIsProcessing] = useState(false);
  
  const { toast } = useToast();
  const createProduct = useCreateProduct();
  const createIntakeItem = useCreateIntakeItem();

  const handleNumber = (num: string) => {
    const newValue = displayValue === '0' ? num : displayValue + num;
    setDisplayValue(newValue);
    const unitsPerBox = parseInt(newValue) || 1;
    onUpdate({ unitsPerBox });
  };

  const handleBackspace = () => {
    const newValue = displayValue.slice(0, -1) || '0';
    setDisplayValue(newValue);
    const unitsPerBox = parseInt(newValue) || 1;
    onUpdate({ unitsPerBox });
  };

  const handleEnter = async () => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    
    try {
      let productId = data.productId;
      
      // Create product if it doesn't exist
      if (!productId && data.barcode) {
        const product = await createProduct.mutateAsync({
          name: data.productName || `Product ${data.barcode}`,
          upc: data.barcode,
          sku: data.barcode,
        });
        productId = product.id;
      }

      if (!productId) {
        throw new Error('Product ID is required');
      }

      // Upload photo if provided
      let photoUrl = null;
      if (data.photoFile) {
        const fileExt = data.photoFile.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `intake-photos/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('intake-photos')
          .upload(filePath, data.photoFile);

        if (uploadError) {
          console.error('Photo upload error:', uploadError);
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from('intake-photos')
            .getPublicUrl(filePath);
          photoUrl = publicUrl;
        }
      }

      // Create intake item
      await createIntakeItem.mutateAsync({
        intake_id: intakeId,
        product_id: productId,
        quantity: data.totalUnits,
        quantity_boxes: data.boxCount,
        units_per_box: data.unitsPerBox,
        unit_cost_cents: 0, // Default cost
        line_total_cents: 0,
        photo_url: photoUrl,
        upc: data.barcode,
      });

      onNext();
    } catch (error) {
      console.error('Error saving product:', error);
      toast({
        title: 'Error',
        description: 'Failed to add product. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-full relative">
      {/* Header */}
      <div className="p-6 text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
          <PackageCheck className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Units per Box</h2>
        <p className="text-muted-foreground text-sm">
          How many units are in each box?
        </p>
      </div>

      {/* Display */}
      <div className="px-6 py-4 text-center">
        <div className="text-6xl font-bold text-primary mb-2 font-mono">
          {displayValue}
        </div>
        <div className="text-lg text-muted-foreground mb-4">
          {displayValue === '1' ? 'Unit per Box' : 'Units per Box'}
        </div>
        
        {/* Total Calculation */}
        <div className="bg-muted/50 rounded-lg p-4">
          <div className="text-sm text-muted-foreground mb-1">Total Units</div>
          <div className="text-lg font-semibold text-primary">
            {data.boxCount} boxes × {displayValue} units = {data.boxCount * (parseInt(displayValue) || 1)} total units
          </div>
        </div>
      </div>

      {/* Custom Numeric Keyboard */}
      <div className="flex-1 flex flex-col justify-end">
        <CustomNumericKeyboard
          onNumber={handleNumber}
          onBackspace={handleBackspace}
          onEnter={handleEnter}
          disabled={isProcessing}
        />
      </div>

      {/* Navigation */}
      <div className="p-4 border-t">
        <Button 
          variant="outline" 
          onClick={onBack} 
          size="lg" 
          className="w-full"
          disabled={isProcessing}
        >
          <ChevronLeft className="mr-2 w-5 h-5" />
          Back
        </Button>
      </div>
      
      {/* Processing Indicator */}
      {isProcessing && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-card p-6 rounded-lg shadow-lg text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3"></div>
            <p className="text-sm text-muted-foreground">Saving product...</p>
          </div>
        </div>
      )}
    </div>
  );
}