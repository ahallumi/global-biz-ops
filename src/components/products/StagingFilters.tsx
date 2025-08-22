import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface StagingFiltersProps {
  sourceFilter: string;
  statusFilter: string;
  onSourceFilterChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
  onClearFilters: () => void;
  stats: {
    total: number;
    filtered: number;
  };
}

export function StagingFilters({
  sourceFilter,
  statusFilter,
  onSourceFilterChange,
  onStatusFilterChange,
  onClearFilters,
  stats
}: StagingFiltersProps) {
  const hasFilters = sourceFilter !== 'all' || statusFilter !== 'all';

  return (
    <div className="flex items-center gap-4 p-4 border-b bg-muted/20">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Filters:</span>
        
        <Select value={sourceFilter} onValueChange={onSourceFilterChange}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="candidate">Candidates</SelectItem>
            <SelectItem value="placeholder">Legacy Placeholders</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={onStatusFilterChange}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
            <SelectItem value="MERGED">Merged</SelectItem>
            <SelectItem value="PLACEHOLDER">Placeholder</SelectItem>
            <SelectItem value="ARCHIVED">Archived</SelectItem>
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="h-8 px-2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
            Clear
          </Button>
        )}
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {hasFilters && (
          <span>
            Showing {stats.filtered} of {stats.total}
          </span>
        )}
        {!hasFilters && (
          <span>
            {stats.total} total items
          </span>
        )}
      </div>
    </div>
  );
}