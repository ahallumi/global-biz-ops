import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIntakes } from '@/hooks/useIntakes';
import { useAuth } from '@/hooks/useAuth';
import { Layout } from '@/components/layout/Layout';
import { DataTable } from '@/components/data-table/DataTable';
import { intakeColumns } from '@/components/intakes/intakeColumns';
import { MobileIntakeList } from '@/components/intakes/MobileIntakeList';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Package, Filter } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

export default function IntakesPage() {
  const navigate = useNavigate();
  const { employee } = useAuth();
  const { data: intakes, isLoading } = useIntakes();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('all');
  const isMobile = useIsMobile();

  const isAdmin = employee?.role === 'admin';
  const isManager = employee?.role === 'manager';
  
  // Filter intakes based on user role and filters
  const filteredIntakes = intakes?.filter(intake => {
    // Role-based filtering
    if (!isAdmin && !isManager && intake.submitted_by !== employee?.user_id) {
      return false;
    }
    
    // Status filtering
    if (statusFilter !== 'all' && intake.status !== statusFilter) {
      return false;
    }
    
    // Tab filtering
    if (activeTab === 'my' && intake.submitted_by !== employee?.user_id) {
      return false;
    }
    
    return true;
  }) || [];

  const getStatusCounts = () => {
    const userIntakes = intakes?.filter(intake => 
      isAdmin || isManager ? true : intake.submitted_by === employee?.user_id
    ) || [];
    
    return {
      all: userIntakes.length,
      draft: userIntakes.filter(i => i.status === 'draft').length,
      submitted: userIntakes.filter(i => i.status === 'submitted').length,
      approved: userIntakes.filter(i => i.status === 'approved').length,
    };
  };

  const counts = getStatusCounts();

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-10 w-32" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className={cn("flex gap-4", isMobile ? "flex-col" : "flex-col sm:flex-row sm:items-center sm:justify-between")}>
          <div>
            <h1 className={cn("font-bold text-foreground", isMobile ? "text-xl" : "text-2xl")}>
              Product Intakes
            </h1>
            <p className="text-muted-foreground">
              Manage and track all product intake submissions
            </p>
          </div>
          <Button 
            onClick={() => navigate('/intakes/new')}
            className={cn(isMobile && "w-full")}
          >
            <Plus className="mr-2 h-4 w-4" />
            New Intake
          </Button>
        </div>

        {/* Stats Cards */}
        <div className={cn("grid gap-4", isMobile ? "grid-cols-2" : "grid-cols-1 md:grid-cols-4")}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className={cn("font-medium", isMobile ? "text-xs" : "text-sm")}>
                Total Intakes
              </CardTitle>
              {!isMobile && <Package className="h-4 w-4 text-muted-foreground" />}
            </CardHeader>
            <CardContent>
              <div className={cn("font-bold", isMobile ? "text-xl" : "text-2xl")}>
                {counts.all}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className={cn("font-medium", isMobile ? "text-xs" : "text-sm")}>
                Draft
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={cn("font-bold", isMobile ? "text-xl" : "text-2xl")}>
                {counts.draft}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className={cn("font-medium", isMobile ? "text-xs" : "text-sm")}>
                Submitted
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={cn("font-bold text-warning", isMobile ? "text-xl" : "text-2xl")}>
                {counts.submitted}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className={cn("font-medium", isMobile ? "text-xs" : "text-sm")}>
                Approved
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={cn("font-bold text-success", isMobile ? "text-xl" : "text-2xl")}>
                {counts.approved}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Card>
          <CardHeader>
            <div className={cn("flex gap-4", isMobile ? "flex-col" : "flex-col sm:flex-row sm:items-center sm:justify-between")}>
              <div>
                <CardTitle>Intake Management</CardTitle>
                <CardDescription>
                  View and manage product intake submissions
                </CardDescription>
              </div>
              
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className={cn(isMobile ? "w-full" : "w-[180px]")}>
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="submitted">Submitted</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="needs_correction">Needs Correction</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="all">
                  {isAdmin || isManager ? 'All Intakes' : 'My Intakes'}
                </TabsTrigger>
                {(isAdmin || isManager) && (
                  <TabsTrigger value="my">My Submissions</TabsTrigger>
                )}
              </TabsList>
              
              <TabsContent value="all" className="space-y-4">
                {isMobile ? (
                  <MobileIntakeList 
                    data={filteredIntakes}
                    searchPlaceholder="Search by supplier name..."
                  />
                ) : (
                  <DataTable 
                    columns={intakeColumns}
                    data={filteredIntakes}
                    searchKey="suppliers.name"
                    searchPlaceholder="Search by supplier name..."
                  />
                )}
              </TabsContent>
              
              {(isAdmin || isManager) && (
                <TabsContent value="my" className="space-y-4">
                  {isMobile ? (
                    <MobileIntakeList 
                      data={filteredIntakes}
                      searchPlaceholder="Search by supplier name..."
                    />
                  ) : (
                    <DataTable 
                      columns={intakeColumns}
                      data={filteredIntakes}
                      searchKey="suppliers.name"
                      searchPlaceholder="Search by supplier name..."
                    />
                  )}
                </TabsContent>
              )}
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}