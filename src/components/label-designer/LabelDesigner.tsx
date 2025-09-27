import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Save, Eye, Printer, ArrowLeft } from 'lucide-react';
import { DesignerCanvas } from './DesignerCanvas';
import { DesignerToolbox } from './DesignerToolbox';
import { DesignerInspector } from './DesignerInspector';
import { ProductSamplePicker } from './ProductSamplePicker';
import { useLabelTemplates } from '@/hooks/useLabelTemplates';
import { toast } from 'sonner';

interface LabelDesignerProps {
  profileId: string;
  profileName: string;
  dimensions: { width_mm: number; height_mm: number; dpi: number };
  onBack: () => void;
}

export interface TemplateElement {
  id: string;
  type: 'text' | 'barcode' | 'image' | 'box';
  x_mm: number;
  y_mm: number;
  w_mm: number;
  h_mm: number;
  bind?: string;
  style?: any;
  [key: string]: any;
}

export interface TemplateLayout {
  meta: {
    width_mm: number;
    height_mm: number;
    dpi: number;
    margin_mm: number;
    bg: string;
  };
  elements: TemplateElement[];
}

export function LabelDesigner({ profileId, profileName, dimensions, onBack }: LabelDesignerProps) {
  const { templates, upsertTemplate } = useLabelTemplates(profileId);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [sampleProduct, setSampleProduct] = useState({
    name: 'Sample Product Name',
    price: 12.99,
    barcode: '123456789012',
    sku: 'SKU-001',
    size: '1 lb',
    unit: 'lb'
  });

  // Get active template or create default
  const activeTemplate = templates.find(t => t.is_active) || {
    id: '',
    profile_id: profileId,
    name: 'New Template',
    layout: {
      meta: {
        width_mm: dimensions.width_mm,
        height_mm: dimensions.height_mm,
        dpi: dimensions.dpi,
        margin_mm: 2,
        bg: '#FFFFFF'
      },
      elements: []
    } as TemplateLayout,
    is_active: true,
    version: 1,
    created_at: '',
    updated_at: ''
  };

  const [currentLayout, setCurrentLayout] = useState<TemplateLayout>(activeTemplate.layout);

  const handleSave = async () => {
    try {
      await upsertTemplate.mutateAsync({
        id: activeTemplate.id || undefined,
        profile_id: profileId,
        name: activeTemplate.name,
        layout: currentLayout,
        is_active: true
      });
    } catch (error) {
      console.error('Error saving template:', error);
    }
  };

  const handleElementAdd = (elementType: TemplateElement['type']) => {
    const newElement: TemplateElement = {
      id: `element_${Date.now()}`,
      type: elementType,
      x_mm: 5,
      y_mm: 5,
      w_mm: elementType === 'barcode' ? 25 : 20,
      h_mm: elementType === 'barcode' ? 10 : 8,
      bind: elementType === 'text' ? 'product.name' : elementType === 'barcode' ? 'product.barcode' : undefined,
      style: elementType === 'text' ? {
        font_family: 'Inter',
        font_size_pt: 10,
        font_weight: 400,
        align: 'left'
      } : {}
    };

    setCurrentLayout(prev => ({
      ...prev,
      elements: [...prev.elements, newElement]
    }));
    setSelectedElement(newElement.id);
  };

  const handleElementUpdate = (elementId: string, updates: Partial<TemplateElement>) => {
    setCurrentLayout(prev => ({
      ...prev,
      elements: prev.elements.map(el => 
        el.id === elementId ? { ...el, ...updates } : el
      )
    }));
  };

  const handleElementDelete = (elementId: string) => {
    setCurrentLayout(prev => ({
      ...prev,
      elements: prev.elements.filter(el => el.id !== elementId)
    }));
    if (selectedElement === elementId) {
      setSelectedElement(null);
    }
  };

  const selectedElementData = currentLayout.elements.find(el => el.id === selectedElement);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-xl font-semibold">Label Designer</h1>
              <p className="text-sm text-muted-foreground">
                {profileName} ({dimensions.width_mm}×{dimensions.height_mm}mm)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Eye className="w-4 h-4 mr-2" />
              Preview
            </Button>
            <Button variant="outline" size="sm">
              <Printer className="w-4 h-4 mr-2" />
              Test Print
            </Button>
            <Button size="sm" onClick={handleSave} disabled={upsertTemplate.isPending}>
              <Save className="w-4 h-4 mr-2" />
              {upsertTemplate.isPending ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-80px)]">
        {/* Left Toolbox */}
        <div className="w-64 border-r bg-card p-4">
          <DesignerToolbox onElementAdd={handleElementAdd} />
          <div className="mt-6">
            <ProductSamplePicker 
              value={sampleProduct}
              onChange={setSampleProduct}
            />
          </div>
        </div>

        {/* Main Canvas */}
        <div className="flex-1 p-6">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Canvas</CardTitle>
            </CardHeader>
            <CardContent className="h-[calc(100%-80px)]">
              <DesignerCanvas
                layout={currentLayout}
                sampleProduct={sampleProduct}
                selectedElement={selectedElement}
                onElementSelect={setSelectedElement}
                onElementUpdate={handleElementUpdate}
                onElementDelete={handleElementDelete}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right Inspector */}
        <div className="w-80 border-l bg-card p-4">
          <DesignerInspector
            element={selectedElementData}
            onElementUpdate={(updates) => {
              if (selectedElement) {
                handleElementUpdate(selectedElement, updates);
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}