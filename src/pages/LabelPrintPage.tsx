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
import { findPaperMatch, generatePrintOptions } from '@/lib/paperMatching';
import { Printer, Search, Zap, Package, Tag, Barcode, ArrowLeft, Settings, CheckCircle } from 'lucide-react';
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
    selectedProduct,
    lastPrintedProduct,
    config,
    printers,
    configLoading,
    printersLoading,
    searchLoading,
    printLoading,
    calibrationLoading,
    searchResults,
    handleSearch,
    handleQuickPrint,
    setSelectedProduct
  } = useLabelPrint();

  // Auto-focus search input on mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Get basic printer info
  const selectedPrinter = printers.find(p => p.id === selectedPrinterId);
  const activeProfile = config?.profiles?.find(p => p.id === config.active_profile_id);

  // Load last printer from localStorage
  useEffect(() => {
    const lastPrinterId = localStorage.getItem('last-printer-id');
    if (lastPrinterId && printers?.some(p => p.id === lastPrinterId)) {
      setSelectedPrinterId(lastPrinterId);
    } else if (printers?.length) {
      // Use default printer or first available
      const defaultPrinter = printers.find(p => p.default) || printers[0];
      setSelectedPrinterId(defaultPrinter.id);
    }
  }, [printers]);

  // Handle printer selection
  const handlePrinterChange = (printerId: string) => {
    setSelectedPrinterId(printerId);
    localStorage.setItem('last-printer-id', printerId);
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
          
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
          <Skeleton className="h-48" />
        </div>
      </Layout>
    );
  }

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
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Active Profile Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-5 w-5" />
                Active Profile
              </CardTitle>
              <CardDescription>Current label configuration</CardDescription>
            </CardHeader>
            <CardContent>
              {activeProfile ? (
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Name:</span>
                    <span className="text-sm">{activeProfile.label_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Size:</span>
                    <span className="text-sm">{activeProfile.width_mm}×{activeProfile.height_mm}mm</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">DPI:</span>
                    <span className="text-sm">{activeProfile.dpi}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Template:</span>
                    <span className="text-sm">{activeProfile.template_id}</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No active profile</p>
              )}
            </CardContent>
          </Card>

          {/* Printer Selection Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Printer className="h-5 w-5" />
                Selected Printer
              </CardTitle>
              <CardDescription>Choose target printer</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={selectedPrinterId} onValueChange={setSelectedPrinterId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a printer" />
                </SelectTrigger>
                <SelectContent>
                  {printers.map((printer) => (
                    <SelectItem key={printer.id} value={printer.id}>
                      <div className="flex items-center gap-2">
                        <span>{printer.name}</span>
                        {printer.default && (
                          <Badge variant="outline" className="text-xs">Default</Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {selectedPrinterId && (
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium">Model:</span>
                    <span>{printers.find(p => p.id === selectedPrinterId)?.make_and_model}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Status:</span>
                    <Badge variant={
                      printers.find(p => p.id === selectedPrinterId)?.status === 'online' 
                        ? 'default' 
                        : 'secondary'
                    }>
                      {printers.find(p => p.id === selectedPrinterId)?.status || 'unknown'}
                    </Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Printer Status - Simplified */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Printer Status
              </CardTitle>
              <CardDescription>Ready to print</CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedPrinterId ? (
                <p className="text-sm text-muted-foreground">Select a printer first</p>
              ) : !activeProfile ? (
                <p className="text-sm text-muted-foreground">No active profile</p>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium">Ready to print</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {activeProfile.width_mm}×{activeProfile.height_mm}mm at {activeProfile.dpi}dpi
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Last Printed Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Last Printed
              </CardTitle>
              <CardDescription>Recently printed label</CardDescription>
            </CardHeader>
            <CardContent>
              {lastPrintedProduct ? (
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Product:</span>
                    <span className="text-sm truncate ml-2" title={lastPrintedProduct.name}>
                      {lastPrintedProduct.name}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">SKU:</span>
                    <span className="text-sm">{lastPrintedProduct.sku || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Price:</span>
                    <span className="text-sm">{formatPrice(lastPrintedProduct.price)}</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No recent prints</p>
              )}
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