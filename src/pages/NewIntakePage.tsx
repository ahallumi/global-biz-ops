import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCreateIntake } from '@/hooks/useIntakes';
import { useSuppliers } from '@/hooks/useSuppliers';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { CalendarIcon, ArrowLeft, Save, Send } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const intakeFormSchema = z.object({
  supplier_id: z.string().min(1, 'Supplier is required'),
  date_received: z.date({
    required_error: 'Date received is required',
  }),
  invoice_number: z.string().optional(),
  location_id: z.string().optional(),
  notes: z.string().optional(),
});

type IntakeFormData = z.infer<typeof intakeFormSchema>;

type IntakeCreateData = Omit<IntakeFormData, 'date_received'> & {
  date_received: string;
  status: 'draft' | 'submitted';
  supplier_id: string;
};

export default function NewIntakePage() {
  const navigate = useNavigate();
  const { data: suppliers, isLoading: suppliersLoading } = useSuppliers();
  const createIntake = useCreateIntake();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<IntakeFormData>({
    resolver: zodResolver(intakeFormSchema),
    defaultValues: {
      date_received: new Date(),
      invoice_number: '',
      location_id: '',
      notes: '',
    },
  });

  const onSubmit = async (data: IntakeFormData, status: 'draft' | 'submitted' = 'draft') => {
    try {
      setIsSubmitting(true);
      if (!data.supplier_id) {
        throw new Error('Supplier is required');
      }
      const createData: IntakeCreateData = {
        ...data,
        supplier_id: data.supplier_id,
        date_received: format(data.date_received, 'yyyy-MM-dd'),
        status,
      };
      const result = await createIntake.mutateAsync(createData);
      
      navigate(`/intakes/${result.id}`);
    } catch (error) {
      console.error('Error creating intake:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveDraft = () => {
    form.handleSubmit((data) => onSubmit(data, 'draft'))();
  };

  const handleSubmit = () => {
    form.handleSubmit((data) => onSubmit(data, 'submitted'))();
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/intakes">Intakes</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>New Intake</BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header */}
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => navigate('/intakes')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Create New Product Intake</h1>
            <p className="text-muted-foreground">
              Start a new product intake submission
            </p>
          </div>
        </div>

        {/* Form */}
        <div className="max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle>Intake Information</CardTitle>
              <CardDescription>
                Provide the basic information for this product intake submission
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6">
              <Form {...form}>
                <form className="space-y-6">
                  {/* Supplier Selection */}
                  <FormField
                    control={form.control}
                    name="supplier_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Supplier *</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                          disabled={suppliersLoading}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a supplier" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {suppliers?.filter(s => s.active).map((supplier) => (
                              <SelectItem key={supplier.id} value={supplier.id}>
                                <div>
                                  <div className="font-medium">{supplier.name}</div>
                                  <div className="text-xs text-muted-foreground">{supplier.code}</div>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Date Received */}
                  <FormField
                    control={form.control}
                    name="date_received"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Date Received *</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  'w-full pl-3 text-left font-normal',
                                  !field.value && 'text-muted-foreground'
                                )}
                              >
                                {field.value ? (
                                  format(field.value, 'PPP')
                                ) : (
                                  <span>Pick a date</span>
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
                                date > new Date() || date < new Date('1900-01-01')
                              }
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Invoice Number */}
                  <FormField
                    control={form.control}
                    name="invoice_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Invoice Number</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Enter invoice number"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Location */}
                  <FormField
                    control={form.control}
                    name="location_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location/Warehouse</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Enter location or warehouse"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Notes */}
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Any additional notes or special instructions..."
                            className="min-h-[100px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Action Buttons */}
                  <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleSaveDraft}
                      disabled={isSubmitting}
                    >
                      <Save className="mr-2 h-4 w-4" />
                      Save as Draft
                    </Button>
                    
                    <Button
                      type="button"
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                    >
                      <Send className="mr-2 h-4 w-4" />
                      Create & Continue
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}