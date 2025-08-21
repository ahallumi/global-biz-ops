import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { CalendarIcon, Plus, Search } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useSearchProducts, useCreateProduct } from '@/hooks/useProducts';
import { useCreateIntakeItem } from '@/hooks/useIntakes';
import { useToast } from '@/hooks/use-toast';

const formSchema = z.object({
  product_id: z.string().min(1, 'Product is required'),
  quantity: z.coerce.number().min(0.01, 'Quantity must be greater than 0'),
  quantity_boxes: z.coerce.number().min(1, 'Number of boxes must be at least 1'),
  units_per_box: z.coerce.number().min(1, 'Units per box must be at least 1'),
  unit_cost_cents: z.coerce.number().min(0, 'Unit cost must be 0 or greater'),
  lot_number: z.string().optional(),
  expiry_date: z.date().optional(),
  description: z.string().optional(),
  upc: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface AddProductDialogProps {
  intakeId: string;
  children?: React.ReactNode;
}

export function AddProductDialog({ intakeId, children }: AddProductDialogProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateProduct, setShowCreateProduct] = useState(false);
  
  const { toast } = useToast();
  const { data: searchResults = [] } = useSearchProducts(searchQuery);
  const createProduct = useCreateProduct();
  const createIntakeItem = useCreateIntakeItem();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      quantity: 1,
      quantity_boxes: 1,
      units_per_box: 1,
      unit_cost_cents: 0,
    },
  });

  const handleProductSelect = (productId: string) => {
    const product = searchResults.find(p => p.id === productId);
    if (product) {
      form.setValue('product_id', product.id);
      form.setValue('upc', product.upc || '');
      if (product.default_cost_cents) {
        form.setValue('unit_cost_cents', product.default_cost_cents);
      }
    }
  };

  const handleCreateNewProduct = async () => {
    if (!searchQuery.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a product name to create',
        variant: 'destructive',
      });
      return;
    }

    try {
      const product = await createProduct.mutateAsync({
        name: searchQuery.trim(),
        sku: '',
      });
      
      form.setValue('product_id', product.id);
      setShowCreateProduct(false);
      setSearchQuery('');
    } catch (error) {
      // Error is handled in the mutation
    }
  };

  const onSubmit = async (values: FormValues) => {
    const lineTotal = Math.round(values.quantity * values.unit_cost_cents);
    
    try {
      await createIntakeItem.mutateAsync({
        intake_id: intakeId,
        product_id: values.product_id,
        quantity: values.quantity,
        quantity_boxes: values.quantity_boxes,
        units_per_box: values.units_per_box,
        unit_cost_cents: values.unit_cost_cents,
        line_total_cents: lineTotal,
        lot_number: values.lot_number || null,
        expiry_date: values.expiry_date?.toISOString().split('T')[0] || null,
        description: values.description || null,
        upc: values.upc || null,
      });

      setOpen(false);
      form.reset();
      setSearchQuery('');
      setShowCreateProduct(false);
    } catch (error) {
      // Error is handled in the mutation
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add Product
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Product to Intake</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Product Selection */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <Input
                    placeholder="Search products by name, SKU, or UPC..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateProduct(true)}
                  disabled={!searchQuery.trim()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {searchResults.length > 0 && (
                <div className="border border-border rounded-md max-h-40 overflow-y-auto">
                  {searchResults.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => handleProductSelect(product.id)}
                      className={cn(
                        "w-full p-3 text-left hover:bg-muted transition-colors border-b border-border last:border-b-0",
                        form.watch('product_id') === product.id && "bg-muted"
                      )}
                    >
                      <div className="font-medium">{product.name}</div>
                      <div className="text-sm text-muted-foreground">
                        SKU: {product.sku || 'N/A'} • UPC: {product.upc || 'N/A'}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {showCreateProduct && (
                <div className="p-4 border border-border rounded-md bg-muted/50">
                  <p className="text-sm mb-3">
                    Product "{searchQuery}" not found. Create new product?
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleCreateNewProduct}
                      disabled={createProduct.isPending}
                    >
                      Create Product
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setShowCreateProduct(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              <FormField
                control={form.control}
                name="product_id"
                render={({ field }) => (
                  <FormItem className="hidden">
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Quantity and Cost */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Quantity</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="unit_cost_cents"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit Cost ($)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01" 
                        value={field.value / 100}
                        onChange={(e) => field.onChange(Math.round(parseFloat(e.target.value || '0') * 100))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="quantity_boxes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Number of Boxes</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="units_per_box"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Units per Box</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Additional Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="lot_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lot Number (Optional)</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="expiry_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expiry Date (Optional)</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Select expiry date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) =>
                            date < new Date()
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createIntakeItem.isPending || !form.watch('product_id')}
              >
                Add Product
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}