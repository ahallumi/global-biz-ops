import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, PackageCheck } from 'lucide-react';
import { WizardData } from '../AddProductWizard';
import { CustomNumericKeyboard } from './CustomNumericKeyboard';
import { useCreateIntakeItem, useUpdateIntakeItem } from '@/hooks/useIntakes';
import { useCreateProduct } from '@/hooks/useProducts';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { DuplicateProductDialog } from '../DuplicateProductDialog';

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
  const [error, setError] = useState<string | null>(null);
  const [duplicateDialog, setDuplicateDialog] = useState<{
    open: boolean;
    existingItem: any;
    productName: string;
  }>({ open: false, existingItem: null, productName: '' });
  
  const { toast } = useToast();
  const createProduct = useCreateProduct();
  const createIntakeItem = useCreateIntakeItem();
  const updateIntakeItem = useUpdateIntakeItem();

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
    setError(null);
    
    try {
      let productId = data.productId;
      
      // Create product if it doesn't exist, or find existing one
      if (!productId && data.barcode) {
        try {
          const product = await createProduct.mutateAsync({
            name: data.productName || `Product ${data.barcode}`,
            upc: data.barcode,
            sku: data.barcode,
          });
          productId = product.id;
        } catch (err: any) {
          // Check if it's a duplicate UPC error
          if (err?.message?.includes('duplicate key value violates unique constraint "products_upc_key"') || 
              err?.code === '23505') {
            // Product already exists, try to find it
            try {
              const { data: existingProducts } = await supabase
                .from('products')
                .select('id, name')
                .eq('upc', data.barcode)
                .limit(1);
              
              if (existingProducts && existingProducts.length > 0) {
                productId = existingProducts[0].id;
                toast({
                  title: 'Product Found',
                  description: `Using existing product: ${existingProducts[0].name}`,
                  variant: 'default',
                });
              } else {
                throw new Error('Product with this UPC already exists but could not be found');
              }
            } catch (findError) {
              throw new Error(`Product with UPC ${data.barcode} already exists`);
            }
          } else {
            throw new Error(`Failed to create product: ${err?.message || 'Unknown error'}`);
          }
        }
      }

      if (!productId) {
        throw new Error('Product ID is required');
      }

      // Upload photo if provided
      let photoUrl = null;
      if (data.photoFile) {
        try {
          const fileExt = data.photoFile.name.split('.').pop();
          const fileName = `${Date.now()}.${fileExt}`;
          const filePath = `intake-photos/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('intake-photos')
            .upload(filePath, data.photoFile);

          if (uploadError) {
            console.error('Photo upload error:', uploadError);
            throw new Error(`Photo upload failed: ${uploadError.message}`);
          } else {
            const { data: { publicUrl } } = supabase.storage
              .from('intake-photos')
              .getPublicUrl(filePath);
            photoUrl = publicUrl;
          }
        } catch (err) {
          console.error('Photo processing error:', err);
          // Continue without photo if upload fails
          toast({
            title: 'Photo Upload Warning',
            description: 'Photo upload failed, but product will be saved without image.',
            variant: 'default',
          });
        }
      }

      // Check for existing product in this intake
      const { data: existingItems, error: checkError } = await supabase
        .from('product_intake_items')
        .select('*, products!inner(name)')
        .eq('intake_id', intakeId)
        .eq('product_id', productId);

      if (checkError) {
        console.error('Error checking for duplicates:', checkError);
      }

      const existingItem = existingItems?.[0];

      if (existingItem) {
        // Product already exists in this intake
        if (existingItem.units_per_box === data.unitsPerBox) {
          // Same units per box - merge quantities
          const newQuantityBoxes = existingItem.quantity_boxes + data.boxCount;
          const newTotalQuantity = newQuantityBoxes * data.unitsPerBox;

          await updateIntakeItem.mutateAsync({
            id: existingItem.id,
            intake_id: intakeId,
            quantity_boxes: newQuantityBoxes,
            quantity: newTotalQuantity,
            ...(photoUrl && { photo_url: photoUrl }), // Update photo if new one provided
          });

          toast({
            title: 'Quantities Merged',
            description: `Added ${data.boxCount} boxes to existing ${existingItem.products.name} (Total: ${newQuantityBoxes} boxes)`,
            variant: 'default',
          });

          onNext();
          return;
        } else {
          // Different units per box - show conflict dialog
          setDuplicateDialog({
            open: true,
            existingItem,
            productName: existingItem.products.name,
          });
          return;
        }
      }

      // No duplicate found - create new intake item
      try {
        await createIntakeItem.mutateAsync({
          intake_id: intakeId,
          product_id: productId,
          quantity: data.totalUnits,
          quantity_boxes: data.boxCount,
          units_per_box: data.unitsPerBox,
          unit_cost_cents: 0, // Default cost
          upc: data.barcode,
          photo_url: photoUrl,
        });

        onNext();
      } catch (err: any) {
        console.error('Intake item creation error:', err);
        if (err?.message?.includes('cannot insert a non-DEFAULT value into column "line_total_cents"')) {
          throw new Error('Database configuration error: please contact support');
        } else {
          throw new Error(`Failed to save intake item: ${err?.message || 'Unknown error'}`);
        }
      }
    } catch (error: any) {
      console.error('Error saving product:', error);
      const errorMessage = error?.message || 'Failed to add product. Please try again.';
      setError(errorMessage);
      toast({
        title: 'Error Adding Product',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRetry = () => {
    setError(null);
    handleEnter();
  };

  const handleKeepSeparate = async () => {
    setDuplicateDialog({ open: false, existingItem: null, productName: '' });
    
    // Create new intake item as separate entry
    try {
      setIsProcessing(true);
      const productId = data.productId;
      
      // Upload photo if provided (reuse photo logic from handleEnter)
      let photoUrl = null;
      if (data.photoFile) {
        try {
          const fileExt = data.photoFile.name.split('.').pop();
          const fileName = `${Date.now()}.${fileExt}`;
          const filePath = `intake-photos/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('intake-photos')
            .upload(filePath, data.photoFile);

          if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage
              .from('intake-photos')
              .getPublicUrl(filePath);
            photoUrl = publicUrl;
          }
        } catch (err) {
          console.error('Photo processing error:', err);
        }
      }

      await createIntakeItem.mutateAsync({
        intake_id: intakeId,
        product_id: productId!,
        quantity: data.totalUnits,
        quantity_boxes: data.boxCount,
        units_per_box: data.unitsPerBox,
        unit_cost_cents: 0,
        upc: data.barcode,
        photo_url: photoUrl,
      });

      toast({
        title: 'Product Added',
        description: 'Product saved as separate entry',
        variant: 'default',
      });

      onNext();
    } catch (error: any) {
      setError(error?.message || 'Failed to save product');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReplace = async () => {
    setDuplicateDialog({ open: false, existingItem: null, productName: '' });
    
    try {
      setIsProcessing(true);
      const existingItem = duplicateDialog.existingItem;
      
      // Upload photo if provided
      let photoUrl = existingItem.photo_url;
      if (data.photoFile) {
        try {
          const fileExt = data.photoFile.name.split('.').pop();
          const fileName = `${Date.now()}.${fileExt}`;
          const filePath = `intake-photos/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('intake-photos')
            .upload(filePath, data.photoFile);

          if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage
              .from('intake-photos')
              .getPublicUrl(filePath);
            photoUrl = publicUrl;
          }
        } catch (err) {
          console.error('Photo processing error:', err);
        }
      }

      await updateIntakeItem.mutateAsync({
        id: existingItem.id,
        intake_id: intakeId,
        quantity_boxes: data.boxCount,
        units_per_box: data.unitsPerBox,
        quantity: data.totalUnits,
        photo_url: photoUrl,
      });

      toast({
        title: 'Product Updated',
        description: 'Previous entry has been replaced with new data',
        variant: 'default',
      });

      onNext();
    } catch (error: any) {
      setError(error?.message || 'Failed to update product');
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
        {error ? (
          <div className="space-y-2">
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
              {error}
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={onBack} 
                size="lg" 
                className="flex-1"
                disabled={isProcessing}
              >
                <ChevronLeft className="mr-2 w-5 h-5" />
                Back
              </Button>
              <Button 
                onClick={handleRetry} 
                size="lg" 
                className="flex-1"
                disabled={isProcessing}
              >
                Try Again
              </Button>
            </div>
          </div>
        ) : (
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
        )}
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

      {/* Duplicate Product Dialog */}
      <DuplicateProductDialog
        open={duplicateDialog.open}
        onOpenChange={(open) => setDuplicateDialog(prev => ({ ...prev, open }))}
        productName={duplicateDialog.productName}
        existingUnitsPerBox={duplicateDialog.existingItem?.units_per_box || 0}
        newUnitsPerBox={data.unitsPerBox}
        onKeepSeparate={handleKeepSeparate}
        onReplace={handleReplace}
      />
    </div>
  );
}