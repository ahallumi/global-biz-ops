import { useParams, useNavigate } from 'react-router-dom';
import { useIntake } from '@/hooks/useIntakes';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { IntakeStatusBadge } from '@/components/intakes/IntakeStatusBadge';
import { ArrowLeft, Edit, Package, Calendar, User, FileText, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

export default function IntakeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: intake, isLoading } = useIntake(id!);

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
        {/* Breadcrumb */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/intakes">Intakes</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>{intakeId}</BreadcrumbItem>
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
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">Intake {intakeId}</h1>
              <IntakeStatusBadge status={intake.status} />
            </div>
            <p className="text-muted-foreground">
              Product intake submission details and management
            </p>
          </div>
          <Button onClick={() => navigate(`/intakes/${intake.id}/edit`)}>
            <Edit className="mr-2 h-4 w-4" />
            Edit Intake
          </Button>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="space-y-6 lg:col-span-2">
            {/* Intake Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Intake Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

            {/* Product Items */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Product Items</CardTitle>
                  <Button size="sm">
                    Add Product
                  </Button>
                </div>
                <CardDescription>
                  Products included in this intake submission
                </CardDescription>
              </CardHeader>
              <CardContent>
                {intake.product_intake_items && intake.product_intake_items.length > 0 ? (
                  <div className="space-y-4">
                    {intake.product_intake_items.map((item) => (
                      <div key={item.id} className="border border-border rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2 flex-1">
                            <h4 className="font-medium text-foreground">
                              {item.products?.name || 'Unknown Product'}
                            </h4>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-muted-foreground">Quantity: </span>
                                <span className="text-foreground">{item.quantity} ({item.quantity_boxes} boxes)</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Unit Cost: </span>
                                <span className="text-foreground">${(item.unit_cost_cents / 100).toFixed(2)}</span>
                              </div>
                              {item.lot_number && (
                                <div>
                                  <span className="text-muted-foreground">Lot: </span>
                                  <span className="text-foreground font-mono">{item.lot_number}</span>
                                </div>
                              )}
                              {item.expiry_date && (
                                <div>
                                  <span className="text-muted-foreground">Expiry: </span>
                                  <span className="text-foreground">{format(new Date(item.expiry_date), 'MMM dd, yyyy')}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-foreground">
                              ${((item.line_total_cents || 0) / 100).toFixed(2)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="mx-auto h-12 w-12 mb-4 opacity-50" />
                    <p>No products added yet</p>
                    <p className="text-sm">Start by adding products to this intake</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Files & Attachments */}
            <Card>
              <CardHeader>
                <CardTitle>Files & Attachments</CardTitle>
                <CardDescription>
                  Invoices, photos, and other documents
                </CardDescription>
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
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
                    <p>No files attached</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
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
                
                {intake.location_id && (
                  <div className="flex items-center gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Location</p>
                      <p className="text-sm text-muted-foreground">{intake.location_id}</p>
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
        </div>
      </div>
    </Layout>
  );
}