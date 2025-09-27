import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { TemplateElement } from './LabelDesigner';
import { validateElementConstraints } from '@/lib/layoutEngine';
import { snapMm, snapSizeMm, mmToDots, DOT_MM, minimumBarcodeHeightMm, moduleMmFromDesired, quietZoneMmFromDesired } from '@/lib/dotGrid';

interface DesignerInspectorProps {
  element?: TemplateElement;
  onElementUpdate: (updates: Partial<TemplateElement>) => void;
  canvasSize?: { width_mm: number; height_mm: number };
}

export function DesignerInspector({ element, onElementUpdate, canvasSize }: DesignerInspectorProps) {
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

  // Validate element constraints
  const warnings = canvasSize ? validateElementConstraints(element, canvasSize) : [];
  
  // Add precision warnings for dot-grid alignment
  const precisionWarnings: string[] = [];
  
  if (element.type === 'barcode') {
    const minHeight = minimumBarcodeHeightMm(element.symbology || 'code128');
    if (element.h_mm < minHeight) {
      precisionWarnings.push(`Barcode height (${element.h_mm.toFixed(2)}mm) is below minimum for reliable scanning (${minHeight.toFixed(2)}mm)`);
    }
    
    const moduleWidth = element.barcode?.module_width_mm || 0.33;
    const optimalModule = moduleMmFromDesired(moduleWidth);
    if (Math.abs(moduleWidth - optimalModule) > 0.001) {
      precisionWarnings.push(`Module width should be ${optimalModule.toFixed(3)}mm for precise dot alignment`);
    }
  }
  
  // Show snapped dimensions
  const snappedX = snapMm(element.x_mm);
  const snappedY = snapMm(element.y_mm);
  const snappedW = snapSizeMm(element.w_mm);
  const snappedH = snapSizeMm(element.h_mm);
  
  const isSnapped = Math.abs(element.x_mm - snappedX) < 0.001 && 
                    Math.abs(element.y_mm - snappedY) < 0.001 &&
                    Math.abs(element.w_mm - snappedW) < 0.001 &&
                    Math.abs(element.h_mm - snappedH) < 0.001;
  
  if (!isSnapped) {
    precisionWarnings.push('Element is not aligned to dot grid for precise printing');
  }

  const allWarnings = [...warnings, ...precisionWarnings];

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
    { value: "product.price | currency('$') ~ ' ' ~ (product.unit | unit_suffix())", label: 'Price with Unit' },
    { value: 'product.barcode', label: 'Barcode' },
    { value: 'product.sku', label: 'SKU' },
    { value: 'product.size', label: 'Size' },
    { value: 'product.unit', label: 'Unit' },
    { value: 'product.unit | unit_suffix()', label: 'Unit Suffix' }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Properties - {element.type}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Validation warnings */}
        {allWarnings.length > 0 && (
          <div className="space-y-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
            <h4 className="text-sm font-medium text-destructive">⚠️ Validation Issues</h4>
            {allWarnings.map((warning, index) => (
              <p key={index} className="text-xs text-destructive/80">
                {warning}
              </p>
            ))}
          </div>
        )}

        {/* Precision Information */}
        <div className="space-y-2 p-3 bg-muted/50 rounded-md">
          <h4 className="text-sm font-medium">Precision Dimensions</h4>
          <div className="grid grid-cols-4 gap-2 text-xs font-mono">
            <div>
              <label className="text-muted-foreground">X (mm)</label>
              <div>{element.x_mm.toFixed(3)}</div>
            </div>
            <div>
              <label className="text-muted-foreground">Y (mm)</label>
              <div>{element.y_mm.toFixed(3)}</div>
            </div>
            <div>
              <label className="text-muted-foreground">W (mm)</label>
              <div>{element.w_mm.toFixed(3)}</div>
            </div>
            <div>
              <label className="text-muted-foreground">H (mm)</label>
              <div>{element.h_mm.toFixed(3)}</div>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 text-xs font-mono text-muted-foreground">
            <div>
              <label>Dots</label>
              <div>{mmToDots(element.x_mm)}</div>
            </div>
            <div>
              <label>Dots</label>
              <div>{mmToDots(element.y_mm)}</div>
            </div>
            <div>
              <label>Dots</label>
              <div>{mmToDots(element.w_mm)}</div>
            </div>
            <div>
              <label>Dots</label>
              <div>{mmToDots(element.h_mm)}</div>
            </div>
          </div>
          {!isSnapped && (
            <div className="text-xs text-amber-600 mt-2">
              💡 Tip: Enable snap-to-grid for precise dot alignment
            </div>
          )}
        </div>

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
            {/* Overflow Settings */}
            <div className="space-y-2">
              <Label>Text Overflow</Label>
              <Select
                value={element.overflow?.mode || 'shrink_to_fit'}
                onValueChange={(value) => onElementUpdate({ 
                  overflow: { 
                    ...element.overflow,
                    mode: value as any,
                    min_font_size_pt: element.overflow?.min_font_size_pt || 6,
                    max_lines: element.overflow?.max_lines || 2
                  } 
                })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="shrink_to_fit">Shrink to Fit</SelectItem>
                  <SelectItem value="wrap_lines">Wrap Lines</SelectItem>
                  <SelectItem value="ellipsis">Ellipsis</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {element.overflow?.mode === 'shrink_to_fit' && (
              <div className="space-y-2">
                <Label>Min Font Size (pt)</Label>
                <Input
                  type="number"
                  value={element.overflow?.min_font_size_pt || 6}
                  onChange={(e) => onElementUpdate({ 
                    overflow: { 
                      ...element.overflow,
                      min_font_size_pt: parseFloat(e.target.value) || 6
                    } 
                  })}
                  step="0.5"
                  min="4"
                  max="12"
                />
              </div>
            )}

            {(element.overflow?.mode === 'wrap_lines' || element.overflow?.mode === 'shrink_to_fit') && (
              <div className="space-y-2">
                <Label>Max Lines</Label>
                <Input
                  type="number"
                  value={element.overflow?.max_lines || 2}
                  onChange={(e) => onElementUpdate({ 
                    overflow: { 
                      ...element.overflow,
                      max_lines: parseInt(e.target.value) || 2
                    } 
                  })}
                  min="1"
                  max="5"
                />
              </div>
            )}

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
                value={element.barcode?.module_width_mm || 0.33}
                onChange={(e) => onElementUpdate({ 
                  barcode: { 
                    ...element.barcode,
                    module_width_mm: parseFloat(e.target.value) || 0.33 
                  } 
                })}
                step="0.01"
                min="0.1"
                max="1"
              />
              <div className="text-xs text-muted-foreground">
                {mmToDots(element.barcode?.module_width_mm || 0.33)} dots
                {(element.barcode?.module_width_mm || 0.33) < 0.169 && (
                  <Badge variant="destructive" className="ml-2 text-xs">⚠ Too small</Badge>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Quiet Zone (mm)</Label>
              <Input
                type="number"
                value={element.barcode?.quiet_zone_mm || 1}
                onChange={(e) => onElementUpdate({ 
                  barcode: { 
                    ...element.barcode,
                    quiet_zone_mm: parseFloat(e.target.value) || 1 
                  } 
                })}
                step="0.1"
                min="0.5"
                max="5"
              />
              <div className="text-xs text-muted-foreground">
                {mmToDots(element.barcode?.quiet_zone_mm || 1)} dots
                {(element.barcode?.quiet_zone_mm || 1) < 1 && (
                  <Badge variant="destructive" className="ml-2 text-xs">⚠ Too small</Badge>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Height Validation</Label>
              <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                Current: {element.h_mm.toFixed(1)}mm ({mmToDots(element.h_mm)} dots)<br/>
                Minimum: {minimumBarcodeHeightMm(element.symbology || 'code128').toFixed(1)}mm for reliable scanning
                {element.h_mm < minimumBarcodeHeightMm(element.symbology || 'code128') && (
                  <Badge variant="destructive" className="ml-2">⚠ Too short</Badge>
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}