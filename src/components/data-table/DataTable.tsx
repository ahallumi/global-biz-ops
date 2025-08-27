import * as React from "react"
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { ChevronDown, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  searchKey?: string
  searchPlaceholder?: string
  className?: string
  rowSelection?: Record<string, boolean>
  onRowSelectionChange?: (selection: Record<string, boolean>) => void
  getRowId?: (row: TData, index?: number) => string
  pageSizeKey?: string
  onPageRowsChange?: (rowIds: string[]) => void
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchKey,
  searchPlaceholder = "Search...",
  className,
  rowSelection: externalRowSelection,
  onRowSelectionChange: externalOnRowSelectionChange,
  getRowId,
  pageSizeKey = "datatable.pageSize",
  onPageRowsChange,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [internalRowSelection, setInternalRowSelection] = React.useState({})
  const [pageSize, setPageSize] = React.useState<number>(() => {
    if (typeof window === 'undefined') return 50;
    const saved = window.localStorage.getItem(pageSizeKey);
    const parsed = saved ? parseInt(saved, 10) : 50;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 50;
  });
  const [isPaginating, setIsPaginating] = React.useState(false);
  
  // Use external row selection if provided, otherwise use internal
  const rowSelection = externalRowSelection ?? internalRowSelection;
  const onRowSelectionChange = externalOnRowSelectionChange ?? setInternalRowSelection;

  // Defensive guards for table instantiation
  const safeData = React.useMemo(() => {
    return Array.isArray(data) ? data : [];
  }, [data]);
  
  const safeColumns = React.useMemo(() => {
    return Array.isArray(columns) ? columns : [];
  }, [columns]);

const table = useReactTable({
  data: safeData,
  columns: safeColumns,
  onSortingChange: setSorting,
  onColumnFiltersChange: setColumnFilters,
  getCoreRowModel: getCoreRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  onColumnVisibilityChange: setColumnVisibility,
  onRowSelectionChange,
  getRowId: getRowId ? ((originalRow: TData, index: number) => getRowId(originalRow, index)) : undefined,
  state: {
    sorting,
    columnFilters,
    columnVisibility,
    rowSelection: rowSelection || {},
  },
  initialState: {
    pagination: { pageSize },
  },
})

// Apply page size and persist
React.useEffect(() => {
  table.setPageSize(pageSize);
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(pageSizeKey, String(pageSize));
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [pageSize]);

// Brief skeleton during pagination changes
const pagination = table.getState().pagination as { pageIndex: number; pageSize: number };
React.useEffect(() => {
  setIsPaginating(true);
  const t = setTimeout(() => setIsPaginating(false), 120);
  return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [pagination.pageIndex, pagination.pageSize]);

// Notify current page row ids to parent if requested
React.useEffect(() => {
  if (!onPageRowsChange) return;
  const pageRows = table.getPaginationRowModel().rows;
  onPageRowsChange(pageRows.map(r => r.id));
  // Trigger when pagination or filtering changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [pagination.pageIndex, pagination.pageSize, table.getFilteredRowModel().rows.length]);

return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <div className="flex flex-1 items-center space-x-2">
          {searchKey && (
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={(table.getColumn(searchKey)?.getFilterValue() as string) ?? ""}
                onChange={(event) =>
                  table.getColumn(searchKey)?.setFilterValue(event.target.value)
                }
                className="pl-9"
              />
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={String(pageSize >= safeData.length && safeData.length > 0 ? 'ALL' : pageSize)}
            onValueChange={(val) => {
              if (val === 'ALL') {
                setPageSize(Number.MAX_SAFE_INTEGER);
              } else {
                const n = parseInt(val, 10);
                if (Number.isFinite(n) && n > 0) setPageSize(n);
              }
            }}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Rows per page" />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="10">10 rows</SelectItem>
              <SelectItem value="25">25 rows</SelectItem>
              <SelectItem value="50">50 rows</SelectItem>
              <SelectItem value="100">100 rows</SelectItem>
              <SelectItem value="ALL">All</SelectItem>
            </SelectContent>
          </Select>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="ml-auto">
                Columns <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(!!value)
                      }
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  )
                })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="relative rounded-md border">
        <Table aria-busy={isPaginating}>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id} className="font-medium">
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => {
                // Additional safety check for row data
                if (!row || !row.id) return null;
                
                return (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className="hover:bg-muted/50"
                  >
                    {row.getVisibleCells().map((cell) => {
                      // Safety check for cell rendering
                      if (!cell || !cell.id) return null;
                      
                      return (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={safeColumns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {isPaginating && (
          <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex flex-col gap-2 p-4">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        )}
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
        <div className="flex-1 text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} of{" "}
          {table.getFilteredRowModel().rows.length} row(s) selected.
        </div>
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}