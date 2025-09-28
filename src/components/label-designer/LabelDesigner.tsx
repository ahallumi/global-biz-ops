import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Save, Eye, Printer, ArrowLeft, Grid, Ruler, Move, ZoomIn, ZoomOut } from 'lucide-react';
import { DesignerCanvas } from './DesignerCanvas';
import { DesignerToolbox } from './DesignerToolbox';
import { DesignerInspector } from './DesignerInspector';
import { ProductSamplePicker } from './ProductSamplePicker';
import { HtmlTemplateEditor } from './HtmlTemplateEditor';
import { TemplateTypeSwitcher } from './TemplateTypeSwitcher';
import { useLabelTemplates } from '@/hooks/useLabelTemplates';
import { useDesignerStore } from '@/stores/designerStore';
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
  overflow?: {
    mode: 'shrink_to_fit' | 'wrap_lines' | 'ellipsis';
    min_font_size_pt: number;
    max_lines?: number;
  };
  barcode?: {
    module_width_mm: number;
    quiet_zone_mm: number;
  };
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
  const { 
    selectedElementId, 
    setSelected, 
    gridEnabled, 
    snapEnabled, 
    showRulers, 
    zoom, 
    toggleGrid, 
    toggleSnap, 
    toggleRulers,
    setZoom 
  } = useDesignerStore();
  
  const [sampleProduct, setSampleProduct] = useState({
    name: 'Sample Product Name That Could Be Very Long',
    price: 12.99,
    barcode: '123456789012',
    sku: 'SKU-001',
    size: '1 lb',
    unit: 'lb'
  });

  const [templateType, setTemplateType] = useState<'visual' | 'html'>('visual');
  const [htmlTemplate, setHtmlTemplate] = useState('');

  // Get active template or create default
  const activeTemplate = templates.find(t => t.is_active) || {
    id: '',
    profile_id: profileId,
    name: 'New Template',
    template_type: 'visual' as const,
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
    html_template: '',
    is_active: true,
    version: 1,
    created_at: '',
    updated_at: ''
  };

  const [currentLayout, setCurrentLayout] = useState<TemplateLayout>(activeTemplate.layout);
  
  // Initialize template type and HTML from active template
  React.useEffect(() => {
    if (activeTemplate) {
      setTemplateType(activeTemplate.template_type || 'visual');
      setHtmlTemplate(activeTemplate.html_template || '');
    }
  }, [activeTemplate]);

  const handleSave = async () => {
    try {
      const templateData: any = {
        id: activeTemplate.id || undefined,
        profile_id: profileId,
        name: activeTemplate.name,
        template_type: templateType,
        is_active: true
      };

      if (templateType === 'visual') {
        templateData.layout = currentLayout;
        templateData.html_template = null;
      } else {
        templateData.layout = null;
        templateData.html_template = htmlTemplate;
      }

      await upsertTemplate.mutateAsync(templateData);
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
      } : {},
      overflow: elementType === 'text' ? {
        mode: 'shrink_to_fit' as const,
        min_font_size_pt: 6,
        max_lines: 2
      } : undefined,
      barcode: elementType === 'barcode' ? {
        module_width_mm: 0.25,
        quiet_zone_mm: 1
      } : undefined
    };

    setCurrentLayout(prev => ({
      ...prev,
      elements: [...prev.elements, newElement]
    }));
    setSelected(newElement.id);
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
    if (selectedElementId === elementId) {
      setSelected(null);
    }
  };

  const selectedElementData = currentLayout.elements.find(el => el.id === selectedElementId);

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
            <TemplateTypeSwitcher
              currentType={templateType}
              onTypeChange={setTemplateType}
              hasVisualContent={currentLayout.elements.length > 0}
              hasHtmlContent={htmlTemplate.trim().length > 0}
            />
          </div>
          <div className="flex items-center gap-2">
            {/* View Controls */}
            <div className="flex items-center gap-1 mr-2">
              <Button 
                variant={gridEnabled ? "default" : "outline"} 
                size="sm"
                onClick={toggleGrid}
              >
                <Grid className="w-4 h-4" />
              </Button>
              <Button 
                variant={showRulers ? "default" : "outline"} 
                size="sm"
                onClick={toggleRulers}
              >
                <Ruler className="w-4 h-4" />
              </Button>
              <Button 
                variant={snapEnabled ? "default" : "outline"} 
                size="sm"
                onClick={toggleSnap}
              >
                <Move className="w-4 h-4" />
              </Button>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1 mr-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
                disabled={zoom <= 0.5}
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
              <span className="text-sm min-w-[60px] text-center">{Math.round(zoom * 100)}%</span>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setZoom(Math.min(3, zoom + 0.25))}
                disabled={zoom >= 3}
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
            </div>

            {/* Action Buttons */}
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
        {templateType === 'visual' ? (
          <>
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
                  if (selectedElementId) {
                    handleElementUpdate(selectedElementId, updates);
                  }
                }}
              />
            </div>
          </>
        ) : (
          /* HTML Template Editor */
          <div className="flex-1 p-6">
            <HtmlTemplateEditor
              value={htmlTemplate}
              onChange={setHtmlTemplate}
              dimensions={dimensions}
              sampleProduct={sampleProduct}
              onSave={handleSave}
              isSaving={upsertTemplate.isPending}
              onTestPrint={() => {
                // TODO: Implement test print for HTML templates
                toast.info('Test print functionality coming soon!');
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}