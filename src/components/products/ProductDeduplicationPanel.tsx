import { useState } from 'react';
import { useFindDuplicateProducts, useMergeDuplicateProducts, useAutoResolveDuplicates } from '@/hooks/useProductDeduplication';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { AlertTriangle, Merge, Zap, RefreshCw } from 'lucide-react';

export function ProductDeduplicationPanel() {
  const { data: duplicates, isLoading, refetch } = useFindDuplicateProducts();
  const mergeDuplicates = useMergeDuplicateProducts();
  const autoResolve = useAutoResolveDuplicates();
  const [selectedCanonical, setSelectedCanonical] = useState<Record<string, string>>({});

  const handleMergeGroup = async (groupKey: string, canonicalId: string, duplicateIds: string[]) => {
    await mergeDuplicates.mutateAsync({
      canonicalProductId: canonicalId,
      duplicateProductIds: duplicateIds
    });
    // Refetch to update the list
    refetch();
  };

  const handleAutoResolve = async () => {
    await autoResolve.mutateAsync();
    refetch();
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Product Deduplication
          </CardTitle>
          <CardDescription>
            Scanning for duplicate products...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalDuplicates = (duplicates?.upcDuplicates?.length || 0) + (duplicates?.skuDuplicates?.length || 0);

  if (totalDuplicates === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-green-600" />
            Product Deduplication
          </CardTitle>
          <CardDescription>
            No duplicate products found! Your catalog is clean.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => refetch()} disabled={isLoading} variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Scan Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Product Deduplication
            </CardTitle>
            <CardDescription>
              Found {totalDuplicates} duplicate groups that need resolution
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => refetch()} disabled={isLoading} variant="outline" size="sm">
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Rescan
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="default" size="sm" disabled={autoResolve.isPending}>
                  <Zap className="h-4 w-4 mr-2" />
                  Auto-Resolve All
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Auto-Resolve All Duplicates</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will automatically resolve all duplicate groups by keeping the product with POS links 
                    (or the oldest product if none have POS links) and removing the others. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleAutoResolve} disabled={autoResolve.isPending}>
                    {autoResolve.isPending ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Resolving...
                      </>
                    ) : 'Auto-Resolve All'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          {/* UPC Duplicates */}
          {duplicates?.upcDuplicates?.map((group, index) => (
            <AccordionItem key={`upc-${group.upc}-${index}`} value={`upc-${group.upc}-${index}`}>
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <Badge variant="destructive">UPC Duplicate</Badge>
                  <span className="font-mono text-sm">{group.upc}</span>
                  <span className="text-muted-foreground">({group.products.length} products)</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Multiple products share the same UPC. Choose which product to keep:
                  </p>
                  {group.products.map((product) => (
                    <div key={product.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="space-y-1">
                        <div className="font-medium">{product.name}</div>
                        <div className="text-sm text-muted-foreground">
                          ID: {product.id} • Created: {new Date(product.created_at).toLocaleDateString()}
                        </div>
                        {product.pos_links.length > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            Has POS Link ({product.pos_links[0].pos_item_id})
                          </Badge>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant={selectedCanonical[`upc-${group.upc}-${index}`] === product.id ? "default" : "outline"}
                        onClick={() => setSelectedCanonical(prev => ({
                          ...prev,
                          [`upc-${group.upc}-${index}`]: product.id
                        }))}
                      >
                        Keep This
                      </Button>
                    </div>
                  ))}
                  {selectedCanonical[`upc-${group.upc}-${index}`] && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button className="w-full" disabled={mergeDuplicates.isPending}>
                          <Merge className="h-4 w-4 mr-2" />
                          Merge Group
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Merge Duplicate Products</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will keep the selected product and remove the others. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => handleMergeGroup(
                              `upc-${group.upc}-${index}`,
                              selectedCanonical[`upc-${group.upc}-${index}`],
                              group.products.filter(p => p.id !== selectedCanonical[`upc-${group.upc}-${index}`]).map(p => p.id)
                            )}
                            disabled={mergeDuplicates.isPending}
                          >
                            Merge Group
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}

          {/* SKU Duplicates */}
          {duplicates?.skuDuplicates?.map((group, index) => (
            <AccordionItem key={`sku-${group.sku}-${index}`} value={`sku-${group.sku}-${index}`}>
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <Badge variant="destructive">SKU Duplicate</Badge>
                  <span className="font-mono text-sm">{group.sku}</span>
                  <span className="text-muted-foreground">({group.products.length} products)</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Multiple products share the same SKU. Choose which product to keep:
                  </p>
                  {group.products.map((product) => (
                    <div key={product.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="space-y-1">
                        <div className="font-medium">{product.name}</div>
                        <div className="text-sm text-muted-foreground">
                          ID: {product.id} • Created: {new Date(product.created_at).toLocaleDateString()}
                        </div>
                        {product.pos_links.length > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            Has POS Link ({product.pos_links[0].pos_item_id})
                          </Badge>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant={selectedCanonical[`sku-${group.sku}-${index}`] === product.id ? "default" : "outline"}
                        onClick={() => setSelectedCanonical(prev => ({
                          ...prev,
                          [`sku-${group.sku}-${index}`]: product.id
                        }))}
                      >
                        Keep This
                      </Button>
                    </div>
                  ))}
                  {selectedCanonical[`sku-${group.sku}-${index}`] && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button className="w-full" disabled={mergeDuplicates.isPending}>
                          <Merge className="h-4 w-4 mr-2" />
                          Merge Group
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Merge Duplicate Products</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will keep the selected product and remove the others. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => handleMergeGroup(
                              `sku-${group.sku}-${index}`,
                              selectedCanonical[`sku-${group.sku}-${index}`],
                              group.products.filter(p => p.id !== selectedCanonical[`sku-${group.sku}-${index}`]).map(p => p.id)
                            )}
                            disabled={mergeDuplicates.isPending}
                          >
                            Merge Group
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}