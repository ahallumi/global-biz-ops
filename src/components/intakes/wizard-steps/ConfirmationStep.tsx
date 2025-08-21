import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle, Plus, Check } from 'lucide-react';
import { WizardData } from '../AddProductWizard';
import { useCreateIntakeItem } from '@/hooks/useIntakes';
import { useCreateProduct } from '@/hooks/useProducts';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ConfirmationStepProps {
  intakeId: string;
  data: WizardData;
  onFinish: () => void;
  onAddAnother: () => void;
}

export function ConfirmationStep({ intakeId, data, onFinish, onAddAnother }: ConfirmationStepProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  
  const { toast } = useToast();
  const createProduct = useCreateProduct();
  const createIntakeItem = useCreateIntakeItem();

  const handleSave = async () => {
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

      setIsComplete(true);
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

  if (isComplete) {
    return (
      <div className="flex flex-col h-full">
        {/* Success Header */}
        <div className="p-6 text-center flex-1 flex flex-col justify-center">
          <div className="w-20 h-20 mx-auto mb-6 bg-green-100 rounded-full flex items-center justify-center animate-scale-in">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-green-800 mb-2">Product Added!</h2>
          <p className="text-green-600 text-sm mb-6">
            Successfully added to intake order
          </p>
          
          {/* Summary */}
          <div className="bg-green-50 rounded-lg p-4 text-left">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-green-700">Product:</span>
                <span className="font-medium text-green-800">
                  {data.productName || `Barcode ${data.barcode}`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-green-700">Total Units:</span>
                <span className="font-medium text-green-800">{data.totalUnits}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-green-700">Boxes:</span>
                <span className="font-medium text-green-800">
                  {data.boxCount} × {data.unitsPerBox}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 border-t space-y-3">
          <Button onClick={onAddAnother} size="lg" className="w-full">
            <Plus className="mr-2 w-5 h-5" />
            Add Another Product
          </Button>
          <Button variant="outline" onClick={onFinish} size="lg" className="w-full">
            <Check className="mr-2 w-5 h-5" />
            Finish
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Review & Save</h2>
        <p className="text-muted-foreground text-sm">
          Confirm the details and add to intake
        </p>
      </div>

      {/* Summary */}
      <div className="flex-1 px-6">
        <div className="bg-muted/30 rounded-lg p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Product:</span>
            <span className="font-medium">
              {data.productName || `New Product (${data.barcode})`}
            </span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Barcode:</span>
            <span className="font-mono text-sm">{data.barcode}</span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Boxes:</span>
            <span className="font-medium">{data.boxCount}</span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Units per Box:</span>
            <span className="font-medium">{data.unitsPerBox}</span>
          </div>
          
          <div className="border-t pt-3 flex justify-between items-center">
            <span className="font-medium">Total Units:</span>
            <span className="text-xl font-bold text-primary">{data.totalUnits}</span>
          </div>
          
          {data.photoFile && (
            <div className="border-t pt-3">
              <span className="text-muted-foreground text-sm">✓ Photo attached</span>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="p-6 border-t">
        <Button 
          onClick={handleSave}
          disabled={isProcessing}
          size="lg" 
          className="w-full"
        >
          {isProcessing ? 'Saving...' : 'Save Product'}
        </Button>
      </div>
    </div>
  );
}