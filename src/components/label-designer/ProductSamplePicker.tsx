import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';

interface ProductSamplePickerProps {
  value: any;
  onChange: (product: any) => void;
}

export function ProductSamplePicker({ value, onChange }: ProductSamplePickerProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const sampleProducts = [
    {
      name: 'Ground Beef 80/20',
      price: 8.99,
      barcode: '0123456789012',
      sku: 'BEEF-001',
      size: '1 lb',
      unit: 'lb'
    },
    {
      name: 'Organic Bananas',
      price: 2.49,
      barcode: '0987654321098',
      sku: 'BAN-002',
      size: '2 lb',
      unit: 'lb'
    },
    {
      name: 'Whole Milk',
      price: 4.29,
      barcode: '1234567890123',
      sku: 'MILK-003',
      size: '1 gal',
      unit: 'gal'
    }
  ];

  const filteredProducts = sampleProducts.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleFieldChange = (field: string, newValue: any) => {
    onChange({ ...value, [field]: newValue });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Sample Product</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Quick Product Search */}
        <div className="space-y-2">
          <Label className="text-xs">Quick Select</Label>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
          {filteredProducts.length > 0 && searchQuery && (
            <div className="max-h-32 overflow-y-auto border rounded-md">
              {filteredProducts.map((product, index) => (
                <button
                  key={index}
                  className="w-full text-left p-2 hover:bg-muted text-sm border-b last:border-b-0"
                  onClick={() => {
                    onChange(product);
                    setSearchQuery('');
                  }}
                >
                  <div className="font-medium">{product.name}</div>
                  <div className="text-xs text-muted-foreground">
                    ${product.price} • {product.sku}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Manual Fields */}
        <div className="space-y-2">
          <Label className="text-xs">Product Name</Label>
          <Input
            value={value.name}
            onChange={(e) => handleFieldChange('name', e.target.value)}
            placeholder="Enter product name"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Price</Label>
            <Input
              type="number"
              value={value.price}
              onChange={(e) => handleFieldChange('price', parseFloat(e.target.value) || 0)}
              step="0.01"
              placeholder="0.00"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">SKU</Label>
            <Input
              value={value.sku}
              onChange={(e) => handleFieldChange('sku', e.target.value)}
              placeholder="SKU-001"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Barcode</Label>
          <Input
            value={value.barcode}
            onChange={(e) => handleFieldChange('barcode', e.target.value)}
            placeholder="123456789012"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Size</Label>
            <Input
              value={value.size}
              onChange={(e) => handleFieldChange('size', e.target.value)}
              placeholder="1 lb"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Unit</Label>
            <Input
              value={value.unit}
              onChange={(e) => handleFieldChange('unit', e.target.value)}
              placeholder="lb"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}