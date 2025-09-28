import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useLabelPrint } from '@/hooks/useLabelPrint';
import { Printer, Search, Zap, Package, Tag, Barcode, ArrowLeft } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface Product {
  id: string;
  name: string;
  sku: string | null;
  upc: string | null;
  barcode: string | null;
  price: number | null;
  size: string | null;
  unit: string;
}

export default function LabelPrintPage() {
  const navigate = useNavigate();
  const [selectedPrinterId, setSelectedPrinterId] = useState<string>('');
  const [showResults, setShowResults] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  const {
    query,
    config,
    printers,
    searchResults,
    lastPrintedProduct,
    configLoading,
    printersLoading,
    searchLoading,
    printLoading,
    handleSearch,
    handleQuickPrint,
    getLastPrinterId,
    setLastPrinterId,
  } = useLabelPrint();

  // Auto-focus search input on mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Load last printer from localStorage
  useEffect(() => {
    const lastPrinterId = getLastPrinterId();
    if (lastPrinterId && printers?.some(p => p.id === lastPrinterId)) {
      setSelectedPrinterId(lastPrinterId);
    } else if (printers?.length) {
      // Use default printer or first available
      const defaultPrinter = printers.find(p => p.default) || printers[0];
      setSelectedPrinterId(defaultPrinter.id);
    }
  }, [printers, getLastPrinterId]);

  // Handle printer selection
  const handlePrinterChange = (printerId: string) => {
    setSelectedPrinterId(printerId);
    setLastPrinterId(printerId);
  };

  // Handle search input changes
  const handleSearchChange = (value: string) => {
    handleSearch(value);
    setShowResults(value.trim().length > 0);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && searchResults.length > 0) {
      const exactMatch = searchResults.find(
        product => product.barcode === query || product.upc === query
      );
      
      if (exactMatch) {
        // Exact barcode match - print immediately
        handleQuickPrint(exactMatch, selectedPrinterId);
        setShowResults(false);
      } else if (config?.print_on_enter) {
        // Print first result if print_on_enter is enabled
        handleQuickPrint(searchResults[0], selectedPrinterId);
        setShowResults(false);
      }
    } else if (e.key === 'Escape') {
      setShowResults(false);
    }
  };

  // Handle product selection
  const handleProductSelect = (product: Product) => {
    handleQuickPrint(product, selectedPrinterId);
    setShowResults(false);
  };

  const formatPrice = (price: number | null) => {
    return price ? `$${price.toFixed(2)}` : 'Price N/A';
  };

  if (configLoading || printersLoading) {
    return (
      <Layout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Label Print</h1>
            <p className="text-muted-foreground">
              Scan or search for products to print labels
            </p>
          </div>
          
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        </div>
      </Layout>
    );
  }

  const activeProfile = config?.profiles.find(p => p.id === config.active_profile_id);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Label Print</h1>
            <p className="text-muted-foreground">
              Scan or search for products to print labels
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate('/station')} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Station Terminal
          </Button>
        </div>

        {/* Status Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Profile</CardTitle>
              <Tag className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {activeProfile?.label_name || 'Not configured'}
              </div>
              <p className="text-xs text-muted-foreground">
                {activeProfile ? `${activeProfile.width_mm}×${activeProfile.height_mm}mm` : 'Configure in settings'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Selected Printer</CardTitle>
              <Printer className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {printers?.find(p => p.id === selectedPrinterId)?.name || 'None'}
              </div>
              <p className="text-xs text-muted-foreground">
                {printers?.length || 0} printers available
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Last Printed</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {lastPrintedProduct?.name.substring(0, 20) || 'None'}
                {lastPrintedProduct?.name && lastPrintedProduct.name.length > 20 && '...'}
              </div>
              <p className="text-xs text-muted-foreground">
                {lastPrintedProduct ? formatPrice(lastPrintedProduct.price) : 'No recent prints'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Interface */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Search and Print */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Product Search
                </CardTitle>
                <CardDescription>
                  Type product name, SKU, or scan barcode to find products
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Input
                    ref={searchInputRef}
                    placeholder="Scan barcode or type product name..."
                    value={query}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="text-lg py-3"
                    disabled={printLoading}
                  />
                  {searchLoading && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                    </div>
                  )}
                </div>

                {/* Search Results */}
                {showResults && searchResults.length > 0 && (
                  <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                    {searchResults.map((product, index) => (
                      <div
                        key={product.id}
                        className="p-3 hover:bg-muted cursor-pointer transition-colors"
                        onClick={() => handleProductSelect(product)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{product.name}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              {product.sku && <span>SKU: {product.sku}</span>}
                              {product.barcode && (
                                <>
                                  {product.sku && <span>•</span>}
                                  <span className="flex items-center gap-1">
                                    <Barcode className="h-3 w-3" />
                                    {product.barcode}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">{formatPrice(product.price)}</p>
                            <p className="text-sm text-muted-foreground">{product.unit}</p>
                          </div>
                        </div>
                        {index === 0 && config?.print_on_enter && (
                          <Badge variant="secondary" className="mt-2">
                            <Zap className="h-3 w-3 mr-1" />
                            Press Enter to print
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {showResults && query && !searchLoading && searchResults.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No products found for "{query}"</p>
                    <p className="text-sm">Try a different search term</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Settings Panel */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Printer className="h-5 w-5" />
                  Printer Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Select Printer
                  </label>
                  <Select value={selectedPrinterId} onValueChange={handlePrinterChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose printer..." />
                    </SelectTrigger>
                    <SelectContent>
                      {printers?.map((printer) => (
                        <SelectItem key={printer.id} value={printer.id}>
                          <div className="flex items-center justify-between w-full">
                            <span>{printer.name}</span>
                            {printer.default && (
                              <Badge variant="secondary" className="ml-2">Default</Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Quick Settings</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Print on Enter:</span>
                      <Badge variant={config?.print_on_enter ? 'default' : 'secondary'}>
                        {config?.print_on_enter ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Success Beep:</span>
                      <Badge variant={config?.beep_on_success ? 'default' : 'secondary'}>
                        {config?.beep_on_success ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Preview:</span>
                      <Badge variant={config?.preview_before_print ? 'default' : 'secondary'}>
                        {config?.preview_before_print ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Help Text */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3 text-sm text-muted-foreground">
              <div className="rounded-full p-1 bg-primary/10">
                <Zap className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground mb-1">Quick Tips:</p>
                <ul className="space-y-1">
                  <li>• Scan barcodes directly into the search box for instant printing</li>
                  <li>• Use keyboard arrow keys to navigate search results</li>
                  <li>• Press Enter to print the first result (if enabled in settings)</li>
                  <li>• Configure label profiles and printer settings in Admin → Settings → Printing</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}