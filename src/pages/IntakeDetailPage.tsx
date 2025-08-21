import { useParams, useNavigate } from 'react-router-dom';
import { useIntake, useDeleteIntakeItem } from '@/hooks/useIntakes';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { IntakeStatusBadge } from '@/components/intakes/IntakeStatusBadge';
import { AddProductWizard } from '@/components/intakes/AddProductWizard';
import { ResponsiveProductImage } from '@/components/intakes/ResponsiveProductImage';
import { MobileProductItem } from '@/components/intakes/MobileProductItem';
import { ArrowLeft, Edit, Package, Calendar, User, FileText, MapPin, Trash2, Info, X } from 'lucide-react';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { useState } from 'react';

export default function IntakeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: intake, isLoading } = useIntake(id!);
  const deleteIntakeItem = useDeleteIntakeItem();
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-6">
          <Skeleton className="h-6 w-64" />
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Skeleton className="h-64 lg:col-span-2" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!intake) {
    return (
      <Layout>
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-foreground">Intake Not Found</h1>
          <p className="text-muted-foreground">The intake you're looking for doesn't exist or you don't have permission to view it.</p>
          <Button onClick={() => navigate('/intakes')}>
            Back to Intakes
          </Button>
        </div>
      </Layout>
    );
  }

  const intakeId = intake.id.split('-')[0].toUpperCase();

  return (
    <Layout>
      <div className="space-y-6">
        {/* Breadcrumb - Hidden on mobile */}
        {!isMobile && (
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/intakes">Intakes</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>{intakeId}</BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        )}

        {/* Header */}
        <div className={cn("flex gap-4", isMobile ? "flex-col" : "items-center")}>
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => navigate('/intakes')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className={cn("font-bold text-foreground", isMobile ? "text-xl" : "text-2xl")}>
                  Intake {intakeId}
                </h1>
                <IntakeStatusBadge status={intake.status} />
              </div>
              {!isMobile && (
                <p className="text-muted-foreground">
                  Product intake submission details and management
                </p>
              )}
            </div>
          </div>
          <div className={cn("flex gap-2", isMobile && "w-full")}>
            {isMobile && (
              <Button 
                variant="outline"
                onClick={() => setDrawerOpen(true)}
                className="flex-1"
              >
                <Info className="mr-2 h-4 w-4" />
                Details
              </Button>
            )}
            <Button 
              onClick={() => navigate(`/intakes/${intake.id}/edit`)}
              className={cn(isMobile && "flex-1")}
            >
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
          </div>
        </div>

        {/* Mobile Compact Overview */}
        {isMobile && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Package className="h-4 w-4" />
                    {intake.suppliers?.name || 'Unknown Supplier'}
                  </div>
                  <p className="text-sm text-foreground">
                    {format(new Date(intake.date_received), 'MMM dd, yyyy')}
                  </p>
                  {intake.invoice_number && (
                    <p className="text-xs text-muted-foreground font-mono">
                      {intake.invoice_number}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">
                    {intake.product_intake_items?.length || 0} items
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Content Grid - Reorganized */}
        <div className={cn("grid gap-6", isMobile ? "grid-cols-1" : "lg:grid-cols-3")}>
          
          {/* Main Content - Product Items (Left side on desktop, 2/3 width) */}
          <div className={cn("space-y-6", !isMobile && "lg:col-span-2")}>
            {/* Product Items - Now the primary focus */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Product Items
                  </CardTitle>
                  <AddProductWizard intakeId={intake.id} />
                </div>
                <CardDescription>
                  Products included in this intake submission
                </CardDescription>
              </CardHeader>
              <CardContent>
                {intake.product_intake_items && intake.product_intake_items.length > 0 ? (
                  <div className="space-y-4">
                    {intake.product_intake_items.map((item) => (
                      isMobile ? (
                        <MobileProductItem
                          key={item.id}
                          item={item}
                          onDelete={() => deleteIntakeItem.mutate({ id: item.id, intake_id: intake.id })}
                          isDeleting={deleteIntakeItem.isPending}
                        />
                      ) : (
                        <div key={item.id} className="border border-border rounded-lg p-4 hover:bg-muted/30 transition-colors">
                          <div className="flex items-start gap-4">
                            <ResponsiveProductImage
                              productName={item.products?.name || 'Unknown Product'}
                              photoUrl={item.photo_url}
                              size="lg"
                            />
                            <div className="space-y-3 flex-1">
                              <div className="flex items-center justify-between">
                                <h4 className="font-semibold text-foreground text-lg">
                                  {item.products?.name || 'Unknown Product'}
                                </h4>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => deleteIntakeItem.mutate({ id: item.id, intake_id: intake.id })}
                                  disabled={deleteIntakeItem.isPending}
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div className="space-y-1">
                                  <span className="text-muted-foreground block">Quantity</span>
                                  <span className="text-foreground font-medium">{item.quantity} ({item.quantity_boxes} boxes)</span>
                                </div>
                                <div className="space-y-1">
                                  <span className="text-muted-foreground block">Unit Cost</span>
                                  <span className="text-foreground font-medium">${(item.unit_cost_cents / 100).toFixed(2)}</span>
                                </div>
                                {item.lot_number && (
                                  <div className="space-y-1">
                                    <span className="text-muted-foreground block">Lot Number</span>
                                    <span className="text-foreground font-mono text-sm">{item.lot_number}</span>
                                  </div>
                                )}
                                {item.expiry_date && (
                                  <div className="space-y-1">
                                    <span className="text-muted-foreground block">Expiry Date</span>
                                    <span className="text-foreground">{format(new Date(item.expiry_date), 'MMM dd, yyyy')}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="space-y-1">
                                <p className="text-sm text-muted-foreground">Total</p>
                                <p className="text-xl font-bold text-foreground">
                                  ${((item.line_total_cents || 0) / 100).toFixed(2)}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Package className="mx-auto h-16 w-16 mb-4 opacity-30" />
                    <h3 className="text-lg font-medium mb-2">No products added yet</h3>
                    <p className="text-sm mb-4">Start by adding products to this intake</p>
                    <AddProductWizard intakeId={intake.id} />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Desktop Only (Right side, 1/3 width) */}
          {!isMobile && (
            <div className="space-y-6">
              {/* Condensed Intake Overview */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Overview
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">Supplier</p>
                      <p className="text-sm text-foreground">{intake.suppliers?.name || 'N/A'}</p>
                      <p className="text-xs text-muted-foreground">{intake.suppliers?.code || ''}</p>
                    </div>
                    
                    <div>
                      <p className="text-sm font-medium text-foreground">Date Received</p>
                      <p className="text-sm text-foreground">
                        {format(new Date(intake.date_received), 'MMM dd, yyyy')}
                      </p>
                    </div>
                    
                    {intake.invoice_number && (
                      <div>
                        <p className="text-sm font-medium text-foreground">Invoice #</p>
                        <p className="text-sm text-foreground font-mono">{intake.invoice_number}</p>
                      </div>
                    )}
                    
                    {intake.location_id && (
                      <div>
                        <p className="text-sm font-medium text-foreground">Location</p>
                        <p className="text-sm text-foreground">{intake.location_id}</p>
                      </div>
                    )}
                  </div>
                  
                  {intake.notes && (
                    <div className="pt-3 border-t border-border">
                      <p className="text-sm font-medium text-foreground mb-1">Notes</p>
                      <p className="text-sm text-muted-foreground">{intake.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Files & Attachments */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Files & Attachments</CardTitle>
                </CardHeader>
                <CardContent>
                  {intake.intake_files && intake.intake_files.length > 0 ? (
                    <div className="space-y-2">
                      {intake.intake_files.map((file) => (
                        <div key={file.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                          <div className="flex items-center gap-3">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground capitalize truncate">{file.kind}</p>
                              <p className="text-xs text-muted-foreground">
                                {file.byte_size ? `${Math.round(file.byte_size / 1024)} KB` : ''} • 
                                {format(new Date(file.created_at), 'MMM dd')}
                              </p>
                            </div>
                          </div>
                          <Button variant="outline" size="sm" asChild>
                            <a href={file.url} target="_blank" rel="noopener noreferrer">
                              View
                            </a>
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-muted-foreground">
                      <FileText className="mx-auto h-8 w-8 mb-2 opacity-50" />
                      <p className="text-sm">No files attached</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Submission Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Submission Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Submitted by</p>
                      <p className="text-sm text-muted-foreground">Staff User</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Created</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(intake.created_at), 'MMM dd, yyyy • h:mm a')}
                      </p>
                    </div>
                  </div>
                  
                  {intake.updated_at && intake.updated_at !== intake.created_at && (
                    <div className="flex items-center gap-3">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium text-foreground">Last Updated</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(intake.updated_at), 'MMM dd, yyyy • h:mm a')}
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Supplier Information */}
              {intake.suppliers && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Supplier Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="font-medium text-foreground">{intake.suppliers.name}</p>
                      <p className="text-sm text-muted-foreground">{intake.suppliers.code}</p>
                    </div>
                    
                    {intake.suppliers.contact_name && (
                      <div>
                        <p className="text-sm font-medium text-foreground">Contact</p>
                        <p className="text-sm text-muted-foreground">{intake.suppliers.contact_name}</p>
                      </div>
                    )}
                    
                    {intake.suppliers.contact_email && (
                      <div>
                        <p className="text-sm font-medium text-foreground">Email</p>
                        <p className="text-sm text-muted-foreground">{intake.suppliers.contact_email}</p>
                      </div>
                    )}
                    
                    {intake.suppliers.contact_phone && (
                      <div>
                        <p className="text-sm font-medium text-foreground">Phone</p>
                        <p className="text-sm text-muted-foreground">{intake.suppliers.contact_phone}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>

        {/* Mobile Drawer for Additional Details */}
        {isMobile && (
          <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
            <DrawerContent className="h-[80vh]">
              <DrawerHeader>
                <DrawerTitle>Intake Details</DrawerTitle>
                <DrawerDescription>
                  Complete information for this intake submission
                </DrawerDescription>
              </DrawerHeader>
              
              <div className="px-4 pb-4 overflow-y-auto space-y-6">
                {/* Full Intake Overview */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Complete Overview</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground">Supplier</p>
                        <div>
                          <p className="text-sm text-foreground">{intake.suppliers?.name || 'N/A'}</p>
                          <p className="text-xs text-muted-foreground">{intake.suppliers?.code || ''}</p>
                        </div>
                      </div>
                      
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground">Date Received</p>
                        <p className="text-sm text-foreground">
                          {format(new Date(intake.date_received), 'MMMM dd, yyyy')}
                        </p>
                      </div>
                      
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground">Invoice Number</p>
                        <p className="text-sm text-foreground font-mono">
                          {intake.invoice_number || 'Not provided'}
                        </p>
                      </div>
                      
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground">Location</p>
                        <p className="text-sm text-foreground">
                          {intake.location_id || 'Not specified'}
                        </p>
                      </div>
                    </div>
                    
                    {intake.notes && (
                      <div className="space-y-1 pt-4 border-t border-border">
                        <p className="text-sm font-medium text-foreground">Notes</p>
                        <p className="text-sm text-muted-foreground">{intake.notes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Files & Attachments */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Files & Attachments</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {intake.intake_files && intake.intake_files.length > 0 ? (
                      <div className="space-y-2">
                        {intake.intake_files.map((file) => (
                          <div key={file.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                            <div className="flex items-center gap-3">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="text-sm font-medium text-foreground capitalize">{file.kind}</p>
                                <p className="text-xs text-muted-foreground">
                                  {file.byte_size ? `${Math.round(file.byte_size / 1024)} KB` : ''} • 
                                  {format(new Date(file.created_at), 'MMM dd, yyyy')}
                                </p>
                              </div>
                            </div>
                            <Button variant="outline" size="sm" asChild>
                              <a href={file.url} target="_blank" rel="noopener noreferrer">
                                View
                              </a>
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-muted-foreground">
                        <FileText className="mx-auto h-8 w-8 mb-2 opacity-50" />
                        <p className="text-sm">No files attached</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Submission Details */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Submission Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-3">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium text-foreground">Submitted by</p>
                        <p className="text-sm text-muted-foreground">Staff User</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium text-foreground">Created</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(intake.created_at), 'MMM dd, yyyy • h:mm a')}
                        </p>
                      </div>
                    </div>
                    
                    {intake.updated_at && intake.updated_at !== intake.created_at && (
                      <div className="flex items-center gap-3">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium text-foreground">Last Updated</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(intake.updated_at), 'MMM dd, yyyy • h:mm a')}
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Supplier Information */}
                {intake.suppliers && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Supplier Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <p className="font-medium text-foreground">{intake.suppliers.name}</p>
                        <p className="text-sm text-muted-foreground">{intake.suppliers.code}</p>
                      </div>
                      
                      {intake.suppliers.contact_name && (
                        <div>
                          <p className="text-sm font-medium text-foreground">Contact</p>
                          <p className="text-sm text-muted-foreground">{intake.suppliers.contact_name}</p>
                        </div>
                      )}
                      
                      {intake.suppliers.contact_email && (
                        <div>
                          <p className="text-sm font-medium text-foreground">Email</p>
                          <p className="text-sm text-muted-foreground">{intake.suppliers.contact_email}</p>
                        </div>
                      )}
                      
                      {intake.suppliers.contact_phone && (
                        <div>
                          <p className="text-sm font-medium text-foreground">Phone</p>
                          <p className="text-sm text-muted-foreground">{intake.suppliers.contact_phone}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>

              <DrawerFooter>
                <DrawerClose asChild>
                  <Button variant="outline">Close</Button>
                </DrawerClose>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
        )}
      </div>
    </Layout>
  );
}