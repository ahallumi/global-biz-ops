import React, { useState } from 'react';
import { MobileIntakeCard } from './MobileIntakeCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Package } from 'lucide-react';

type IntakeData = {
  id: string;
  date_received: string;
  invoice_number: string | null;
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'needs_correction';
  created_at: string;
  suppliers: {
    name: string;
    code: string;
  } | null;
  submitted_by: string;
  supplier_id: string;
  updated_at: string | null;
  invoice_url: string | null;
  location_id: string | null;
  notes: string | null;
};

interface MobileIntakeListProps {
  data: IntakeData[];
  searchPlaceholder?: string;
}

export function MobileIntakeList({ 
  data, 
  searchPlaceholder = "Search by supplier name..." 
}: MobileIntakeListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 10;

  // Filter data based on search term
  const filteredData = data.filter(intake => 
    intake.suppliers?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    intake.suppliers?.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    intake.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    intake.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Paginate data
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = filteredData.slice(
    currentPage * itemsPerPage,
    (currentPage + 1) * itemsPerPage
  );

  const handleNextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={searchPlaceholder}
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setCurrentPage(0); // Reset to first page when searching
          }}
          className="pl-9"
        />
      </div>

      {/* Results */}
      {paginatedData.length > 0 ? (
        <div className="space-y-3">
          {paginatedData.map((intake) => (
            <MobileIntakeCard key={intake.id} intake={intake} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">
            {searchTerm ? 'No intakes found matching your search.' : 'No intakes found.'}
          </p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <p className="text-sm text-muted-foreground">
            Showing {currentPage * itemsPerPage + 1} to{' '}
            {Math.min((currentPage + 1) * itemsPerPage, filteredData.length)} of{' '}
            {filteredData.length} results
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreviousPage}
              disabled={currentPage === 0}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextPage}
              disabled={currentPage >= totalPages - 1}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}