import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useApproveCandidate, useMapCandidateToProduct, useRejectCandidate } from '@/hooks/useProductCandidates';
import { useSearchProducts } from '@/hooks/useProducts';
import { Database } from '@/integrations/supabase/types';
import { CheckCircle, XCircle, MapPin, MoreHorizontal, Link } from 'lucide-react';

type ProductCandidate = Database['public']['Tables']['product_candidates']['Row'];

interface CandidateActionsProps {
  candidate: any; // Make it flexible to accept staging item data
}

export function CandidateActions({ candidate }: CandidateActionsProps) {
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showMapDialog, setShowMapDialog] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  
  const approveCandidate = useApproveCandidate();
  const mapCandidate = useMapCandidateToProduct();
  const rejectCandidate = useRejectCandidate();
  const { data: searchResults } = useSearchProducts(productSearch);

  const [productData, setProductData] = useState({
    name: candidate.name || '',
    upc: candidate.upc || '',
    plu: candidate.plu || '',
    size: candidate.size || '',
    unit_of_sale: candidate.unit_of_sale || 'EACH' as const,
    weight_unit: candidate.weight_unit || 'LB',
    default_cost_cents: candidate.suggested_cost_cents || 0,
    category: '',
    brand: ''
  });

  if (candidate.status !== 'PENDING') {
    return (
      <div className="text-sm text-muted-foreground">
        {candidate.status === 'APPROVED' && 'Approved'}
        {candidate.status === 'REJECTED' && 'Rejected'} 
        {candidate.status === 'MERGED' && 'Mapped'}
      </div>
    );
  }

  const handleApprove = () => {
    approveCandidate.mutate({
      candidateId: candidate.id,
      productData
    }, {
      onSuccess: () => setShowApproveDialog(false)
    });
  };

  const handleMap = (productId: string) => {
    mapCandidate.mutate({
      candidateId: candidate.id,
      productId
    }, {
      onSuccess: () => setShowMapDialog(false)
    });
  };

  const handleReject = () => {
    rejectCandidate.mutate(candidate.id);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setShowApproveDialog(true)}>
            <CheckCircle className="h-4 w-4 mr-2" />
            Approve as New Product
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowMapDialog(true)}>
            <MapPin className="h-4 w-4 mr-2" />
            Map to Existing
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={handleReject}
            className="text-destructive focus:text-destructive"
          >
            <XCircle className="h-4 w-4 mr-2" />
            Reject
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Approve Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Approve as New Product</DialogTitle>
            <DialogDescription>
              Create a new product in the catalog from this candidate.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Product Name *</Label>
                <Input
                  id="name"
                  value={productData.name}
                  onChange={(e) => setProductData({...productData, name: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="brand">Brand</Label>
                <Input
                  id="brand"
                  value={productData.brand}
                  onChange={(e) => setProductData({...productData, brand: e.target.value})}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="upc">UPC</Label>
                <Input
                  id="upc"
                  value={productData.upc}
                  onChange={(e) => setProductData({...productData, upc: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plu">PLU</Label>
                <Input
                  id="plu"
                  value={productData.plu}
                  onChange={(e) => setProductData({...productData, plu: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="size">Size</Label>
                <Input
                  id="size"
                  value={productData.size}
                  onChange={(e) => setProductData({...productData, size: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="unit_of_sale">Unit of Sale</Label>
                <Select 
                  value={productData.unit_of_sale} 
                  onValueChange={(value) => setProductData({...productData, unit_of_sale: value as any})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EACH">Each</SelectItem>
                    <SelectItem value="WEIGHT">Weight</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cost">Default Cost</Label>
                <Input
                  id="cost"
                  type="number"
                  step="0.01"
                  value={(productData.default_cost_cents || 0) / 100}
                  onChange={(e) => setProductData({...productData, default_cost_cents: Math.round(parseFloat(e.target.value || '0') * 100)})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={productData.category}
                onChange={(e) => setProductData({...productData, category: e.target.value})}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowApproveDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleApprove} 
              disabled={!productData.name.trim() || approveCandidate.isPending}
            >
              {approveCandidate.isPending ? 'Creating...' : 'Create Product'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Map Dialog */}
      <Dialog open={showMapDialog} onOpenChange={setShowMapDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Map to Existing Product</DialogTitle>
            <DialogDescription>
              Search for and select an existing product to map this candidate to.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Search products by name, UPC, or SKU..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
            />
            
            {searchResults && searchResults.length > 0 && (
              <div className="max-h-60 overflow-y-auto space-y-2">
                {searchResults.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                    onClick={() => handleMap(product.id)}
                  >
                    <div>
                      <div className="font-medium">{product.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {product.upc && `UPC: ${product.upc}`}
                        {product.brand && ` • ${product.brand}`}
                      </div>
                    </div>
                    <Link className="h-4 w-4 text-muted-foreground" />
                  </div>
                ))}
              </div>
            )}
            
            {productSearch.trim() && (!searchResults || searchResults.length === 0) && (
              <div className="text-center py-4 text-muted-foreground">
                No products found matching "{productSearch}"
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}