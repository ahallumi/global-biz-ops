import { useState } from 'react';
import { DataTable } from '@/components/data-table/DataTable';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StagingFilters } from '@/components/products/StagingFilters';
import { CandidateActions } from '@/components/products/CandidateActions';
import { PlaceholderActions } from '@/components/products/PlaceholderActions';
import { StagingAdminActions } from '@/components/products/StagingAdminActions';
import { ColumnDef } from '@tanstack/react-table';
import { useStagingData, useStagingStats, StagingItem } from '@/hooks/useStagingData';

export default function StagingTab() {
  const [sourceFilter, setSourceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: stagingData, isLoading: isLoadingStaging } = useStagingData(true);
  const { data: stagingStats } = useStagingStats(true);

  const handleClearFilters = () => {
    setSourceFilter('all');
    setStatusFilter('all');
  };

  const filteredStagingData = (stagingData || []).filter((item) => {
    if (sourceFilter !== 'all') {
      if (sourceFilter === 'candidate' && item.type !== 'CANDIDATE') return false;
      if (sourceFilter === 'placeholder' && item.type !== 'PLACEHOLDER') return false;
    }
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    return true;
  });

  const displayedStagingData = filteredStagingData;

  const stagingColumns: ColumnDef<StagingItem>[] = [
    {
      accessorKey: 'type',
      header: 'Type',
      cell: ({ row }) => {
        const item = row.original;
        const variant = item.type === 'CANDIDATE' ? 'default' : 'secondary';
        return <Badge variant={variant}>{item.type === 'CANDIDATE' ? 'Candidate' : 'Legacy'}</Badge>;
      },
    },
    {
      accessorKey: 'source',
      header: 'Source',
      cell: ({ row }) => {
        const item = row.original;
        let sourceText = item.source;
        if (item.type === 'PLACEHOLDER') sourceText = 'Legacy Placeholder';
        return <Badge variant="outline">{sourceText}</Badge>;
      },
    },
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => {
        const item = row.original as StagingItem | undefined;
        if (!item) return null;
        return (
          <div className="space-y-1">
            <div className="font-medium">{item.name || 'Unnamed'}</div>
            {item.type === 'CANDIDATE' && item.intake && (
              <div className="text-sm text-muted-foreground">
                From intake: {item.intake.invoice_number}
              </div>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'upc',
      header: 'UPC/PLU',
      cell: ({ row }) => {
        const item = row.original as StagingItem | undefined;
        if (!item) return null;
        return (
          <div className="font-mono text-sm">
            {item.upc || item.plu || 'N/A'}
          </div>
        );
      },
    },
    {
      accessorKey: 'unit_of_sale',
      header: 'Unit',
      cell: ({ row }) => {
        const item = row.original as StagingItem | undefined;
        if (!item) return null;
        return item.unit_of_sale ? (
          <Badge variant="outline">{item.unit_of_sale}</Badge>
        ) : 'N/A';
      },
    },
    {
      accessorKey: 'suggested_cost_cents',
      header: 'Cost',
      cell: ({ row }) => {
        const item = row.original as StagingItem | undefined;
        if (!item) return null;
        const cents = item.suggested_cost_cents;
        return cents ? `$${(cents / 100).toFixed(2)}` : 'N/A';
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const item = row.original as StagingItem | undefined;
        if (!item) return null;
        const getVariant = (status: string) => {
          switch (status) {
            case 'APPROVED': return 'default';
            case 'REJECTED': return 'destructive';
            case 'MERGED': return 'secondary';
            case 'PENDING': return 'outline';
            case 'PLACEHOLDER': return 'secondary';
            case 'ARCHIVED': return 'secondary';
            default: return 'outline';
          }
        };
        return <Badge variant={getVariant(item.status)}>{item.status}</Badge>;
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const item = row.original as StagingItem | undefined;
        if (!item) return null;
        if (item.type === 'CANDIDATE') {
          return <CandidateActions candidate={item.original_data} />;
        } else {
          return <PlaceholderActions product={item.original_data} />;
        }
      },
    },
  ];

  return (
    <>
      <StagingAdminActions />
      <Card>
        <CardHeader>
          <CardTitle>Staging Area ({stagingStats?.totalStaging || 0})</CardTitle>
          <CardDescription>
            Product candidates and legacy placeholders that need action to move into your live catalog.
            Use filters to narrow down the view as needed.
          </CardDescription>
          {stagingData && (
            <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
              <strong>Debug:</strong> Loaded {stagingData.length} total items • 
              Displaying {displayedStagingData.length} after filters • 
              Raw candidates: {stagingData.filter(i => i.type === 'CANDIDATE').length} • 
              Raw placeholders: {stagingData.filter(i => i.type === 'PLACEHOLDER').length}
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <StagingFilters
            sourceFilter={sourceFilter}
            statusFilter={statusFilter}
            onSourceFilterChange={setSourceFilter}
            onStatusFilterChange={setStatusFilter}
            onClearFilters={handleClearFilters}
            stats={{
              total: stagingData?.length || 0,
              filtered: displayedStagingData.length
            }}
          />
          <div className="p-6">
            {isLoadingStaging ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <>
                <DataTable 
                  key={`staging-${displayedStagingData.length}`}
                  columns={stagingColumns} 
                  data={displayedStagingData}
                  searchKey="name"
                />
                {stagingData && stagingData.length > 0 && displayedStagingData.length === 0 && (
                  <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
                    <h4 className="font-semibold text-yellow-800 dark:text-yellow-200">Debug: Data Present But Hidden</h4>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                      Found {stagingData.length} items but filters are hiding them all. First 3 items:
                    </p>
                    <div className="mt-2 space-y-1 text-xs">
                      {stagingData.slice(0, 3).map((item, idx) => (
                        <div key={idx} className="font-mono bg-yellow-100 dark:bg-yellow-900/40 p-1 rounded">
                          {item.type}: {item.name} | Status: {item.status} | Source: {item.source}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
