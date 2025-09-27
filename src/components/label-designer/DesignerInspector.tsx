import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { TemplateElement } from './LabelDesigner';

interface DesignerInspectorProps {
  element?: TemplateElement;
  onElementUpdate: (updates: Partial<TemplateElement>) => void;
}

export function DesignerInspector({ element, onElementUpdate }: DesignerInspectorProps) {
  if (!element) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Properties</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Select an element to edit its properties
          </p>
        </CardContent>
      </Card>
    );
  }

  const handlePositionChange = (key: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    onElementUpdate({ [key]: numValue });
  };

  const handleStyleChange = (key: string, value: any) => {
    onElementUpdate({
      style: { ...element.style, [key]: value }
    });
  };

  const bindingOptions = [
    { value: 'product.name', label: 'Product Name' },
    { value: 'product.price | currency(\'$\')', label: 'Price ($)' },
    { value: 'product.barcode', label: 'Barcode' },
    { value: 'product.sku', label: 'SKU' },
    { value: 'product.size', label: 'Size' },
    { value: 'product.unit', label: 'Unit' }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Properties - {element.type}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Data Binding */}
        <div className="space-y-2">
          <Label>Data Binding</Label>
          <Select
            value={element.bind || ''}
            onValueChange={(value) => onElementUpdate({ bind: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select data field" />
            </SelectTrigger>
            <SelectContent>
              {bindingOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Position */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">X (mm)</Label>
            <Input
              type="number"
              value={element.x_mm}
              onChange={(e) => handlePositionChange('x_mm', e.target.value)}
              step="0.1"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Y (mm)</Label>
            <Input
              type="number"
              value={element.y_mm}
              onChange={(e) => handlePositionChange('y_mm', e.target.value)}
              step="0.1"
            />
          </div>
        </div>

        {/* Size */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Width (mm)</Label>
            <Input
              type="number"
              value={element.w_mm}
              onChange={(e) => handlePositionChange('w_mm', e.target.value)}
              step="0.1"
              min="1"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Height (mm)</Label>
            <Input
              type="number"
              value={element.h_mm}
              onChange={(e) => handlePositionChange('h_mm', e.target.value)}
              step="0.1"
              min="1"
            />
          </div>
        </div>

        {/* Text-specific properties */}
        {element.type === 'text' && (
          <>
            <div className="space-y-2">
              <Label>Font Family</Label>
              <Select
                value={element.style?.font_family || 'Inter'}
                onValueChange={(value) => handleStyleChange('font_family', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Inter">Inter</SelectItem>
                  <SelectItem value="Roboto">Roboto</SelectItem>
                  <SelectItem value="Arial">Arial</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Font Size (pt)</Label>
              <div className="px-3">
                <Slider
                  value={[element.style?.font_size_pt || 10]}
                  onValueChange={([value]) => handleStyleChange('font_size_pt', value)}
                  min={6}
                  max={24}
                  step={0.5}
                />
                <div className="text-xs text-muted-foreground mt-1">
                  {element.style?.font_size_pt || 10}pt
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Font Weight</Label>
              <Select
                value={String(element.style?.font_weight || 400)}
                onValueChange={(value) => handleStyleChange('font_weight', parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="300">Light (300)</SelectItem>
                  <SelectItem value="400">Regular (400)</SelectItem>
                  <SelectItem value="600">Semibold (600)</SelectItem>
                  <SelectItem value="700">Bold (700)</SelectItem>
                  <SelectItem value="800">Extra Bold (800)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Text Align</Label>
              <Select
                value={element.style?.align || 'left'}
                onValueChange={(value) => handleStyleChange('align', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Left</SelectItem>
                  <SelectItem value="center">Center</SelectItem>
                  <SelectItem value="right">Right</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {/* Barcode-specific properties */}
        {element.type === 'barcode' && (
          <>
            <div className="space-y-2">
              <Label>Symbology</Label>
              <Select
                value={element.symbology || 'auto'}
                onValueChange={(value) => onElementUpdate({ symbology: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto Detect</SelectItem>
                  <SelectItem value="code128">Code 128</SelectItem>
                  <SelectItem value="ean13">EAN-13</SelectItem>
                  <SelectItem value="upca">UPC-A</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Module Width (mm)</Label>
              <Input
                type="number"
                value={element.module_width_mm || 0.25}
                onChange={(e) => onElementUpdate({ module_width_mm: parseFloat(e.target.value) || 0.25 })}
                step="0.05"
                min="0.1"
                max="1"
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}