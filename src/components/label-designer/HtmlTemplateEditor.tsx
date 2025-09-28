import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, Save, AlertTriangle, CheckCircle, Copy, FileText } from 'lucide-react';
import { toast } from 'sonner';

interface HtmlTemplateEditorProps {
  value: string;
  onChange: (value: string) => void;
  dimensions: { width_mm: number; height_mm: number; dpi: number };
  sampleProduct: any;
  onSave: () => void;
  isSaving: boolean;
  onTestPrint?: () => void;
}

const BROTHER_29x90_TEMPLATE = `<!doctype html>
<html><head><meta charset="utf-8">
<style>
  @page { size: 29mm 90mm; margin: 0; }
  html,body { width:29mm; height:90mm; margin:0; padding:0; }
  * { box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }

  /* Fonts: embed base64 to prevent metric drift */
  @font-face {
    font-family: "Inter";
    src: url("data:font/woff2;base64,d09GMgABAAAAAAcoAAoAAAAABHwAAAbeAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAABmAAgkIJgmSCGwsGAAE2AiQDCAQgBQYHLhtzA8iOwradU4zkqjAhxHM8/P9+3/Y5994xizN5HURF05blWROn0TtJL4RlvZglK1Xz9/8/v7nvzCFaRKxLJokTieVOJBOTqm0ua/8eif3t+XTy+a5b1s7n5pNeZGBZy8uYh1vJ6yQJSkMJpRtKfPcgasgnznOA2960fjG9JLWaAKIXm4HbNzcvfKnQivxuzyC+mcMhXgOzAg0aDAqwphEYVMyiKIJWapvPDxglgKhHMoGJTvFgqQKlhGbzKHU6C5cue6C7Vqtqh5kl5j3FjqN9gW8K3LbGLHg15V+99TYxc8w8iV9Y+1S7mAb9n/9Y+9TcuH";
    font-weight: 400 800; font-style: normal; font-display: swap;
  }
  body { font-family: "Inter", system-ui, sans-serif; }

  .label { position:relative; width:29mm; height:90mm; }
  .name   { position:absolute; left:3mm; top:3mm;  width:23mm; height:12mm; font-weight:800; line-height:1.15; }
  .price  { position:absolute; right:3mm; top:17mm; width:23mm; height:8mm; text-align:right; font-weight:800; }
  .unit   { position:absolute; right:3mm; top:26mm; width:10mm; height:5mm; font-size:7pt; opacity:.9; text-align:right; }
  .barcode { position:absolute; left:2mm; top:34mm; width:25mm; height:16mm; }
  .barcode svg { width:100%; height:100%; display:block; shape-rendering:crispEdges; }
  .sku    { position:absolute; left:3mm;  bottom:6mm; width:20mm; height:5mm; font-size:6pt; opacity:.8; }
  .stamp  { position:absolute; right:3mm; bottom:6mm; width:9mm;  height:5mm; font-size:5pt; opacity:.8; text-align:right; }

  .autofit { overflow:hidden; }
</style></head>
<body>
  <div class="label">
    <div class="name autofit" data-minpt="7" data-maxpt="10">{{product.name}}</div>
    <div class="price">{{price_formatted}}</div>
    <div class="unit">{{unit_suffix}}</div>
    <div class="barcode">{{barcode_svg}}</div>
    <div class="sku">{{product.sku}}</div>
    <div class="stamp">{{printed_at}}</div>
  </div>

  <!-- Client & server will both run this autofit in the same way -->
  <script>
  (function(){
    const PT_PER_DOT = 72/300; // 300dpi
    const snapPt = pt => Math.round(pt / PT_PER_DOT) * PT_PER_DOT;
    const fits = el => {
      const r = el.getBoundingClientRect();
      return el.scrollWidth <= r.width + 0.5 && el.scrollHeight <= r.height + 0.5;
    };
    document.querySelectorAll('.autofit').forEach(el=>{
      const min = +el.dataset.minpt || 7, max = +el.dataset.maxpt || 10;
      let lo=min, hi=max, best=min;
      for(let i=0;i<7;i++){ const mid=(lo+hi)/2; el.style.fontSize=snapPt(mid)+'pt'; fits(el)?(best=mid,lo=mid):(hi=mid); }
      el.style.fontSize = snapPt(best)+'pt';
    });
  })();
  </script>
</body></html>`;

const BROTHER_62x100_TEMPLATE = `<!doctype html>
<html><head><meta charset="utf-8">
<style>
  @page { size: 62mm 100mm; margin: 0; }
  html,body { width:62mm; height:100mm; margin:0; padding:0; }
  * { box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  
  body { font-family: "Inter", system-ui, sans-serif; }
  .label { position:relative; width:62mm; height:100mm; padding:3mm; }
  .name { font-size:12pt; font-weight:800; text-align:center; margin-bottom:3mm; }
  .price { font-size:16pt; font-weight:800; text-align:center; margin-bottom:2mm; }
  .barcode { text-align:center; margin:2mm 0; }
  .barcode svg { width:50mm; height:15mm; }
  .details { text-align:center; font-size:8pt; opacity:0.8; }
</style></head>
<body>
  <div class="label">
    <div class="name">{{product.name}}</div>
    <div class="price">{{price_formatted}}</div>
    <div class="barcode">{{barcode_svg}}</div>
    <div class="details">{{unit_suffix}} | SKU: {{product.sku}}</div>
  </div>
</body></html>`;

const HTML_PRESETS = [
  { 
    name: 'Brother DK-1201 (29×90mm)', 
    template: BROTHER_29x90_TEMPLATE,
    width_mm: 29,
    height_mm: 90
  },
  { 
    name: 'Brother DK-1202 (62×100mm)', 
    template: BROTHER_62x100_TEMPLATE,
    width_mm: 62,
    height_mm: 100
  }
];

export function HtmlTemplateEditor({ 
  value, 
  onChange, 
  dimensions, 
  sampleProduct, 
  onSave, 
  isSaving,
  onTestPrint 
}: HtmlTemplateEditorProps) {
  const [previewHtml, setPreviewHtml] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Validate HTML template
  const validateTemplate = (html: string): string[] => {
    const errors: string[] = [];
    
    if (!html.trim()) {
      errors.push('Template cannot be empty');
      return errors;
    }

    // Check for required @page rule with exact dimensions
    const pageRegex = /@page\s*{\s*size:\s*(\d+(?:\.\d+)?)mm\s+(\d+(?:\.\d+)?)mm;\s*margin:\s*0;/;
    const pageMatch = html.match(pageRegex);
    
    if (!pageMatch) {
      errors.push(`Must include: @page { size: ${dimensions.width_mm}mm ${dimensions.height_mm}mm; margin: 0; }`);
    } else {
      const [, width, height] = pageMatch;
      if (parseFloat(width) !== dimensions.width_mm || parseFloat(height) !== dimensions.height_mm) {
        errors.push(`Page size must match profile: ${dimensions.width_mm}mm ${dimensions.height_mm}mm`);
      }
    }

    // Check for required html,body dimensions
    const bodyRegex = /html,body\s*{\s*width:\s*(\d+(?:\.\d+)?)mm;\s*height:\s*(\d+(?:\.\d+)?)mm;/;
    const bodyMatch = html.match(bodyRegex);
    
    if (!bodyMatch) {
      errors.push(`Must include: html,body { width:${dimensions.width_mm}mm; height:${dimensions.height_mm}mm; margin:0; padding:0 }`);
    }

    // Reject harmful CSS transforms
    if (html.includes('transform: scale') || html.includes('transform:scale') || html.includes('zoom:')) {
      errors.push('CSS transform: scale and zoom are not allowed on layout containers');
    }

    return errors;
  };

  // Generate preview HTML with sample data
  const generatePreview = (template: string) => {
    if (!template.trim()) return '';

    const substitutions = {
      '{{product.name}}': sampleProduct.name || 'Sample Product',
      '{{product.sku}}': sampleProduct.sku || 'SKU-001',
      '{{product.id}}': sampleProduct.id || '12345',
      '{{price_formatted}}': sampleProduct.price ? `$${sampleProduct.price.toFixed(2)}` : '',
      '{{unit_suffix}}': sampleProduct.unit ? `/${sampleProduct.unit}` : '',
      '{{barcode_svg}}': `<svg width="100%" height="100%" viewBox="0 0 200 50" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="white"/>
        <g fill="black">
          <rect x="10" y="5" width="2" height="30"/>
          <rect x="15" y="5" width="1" height="30"/>
          <rect x="18" y="5" width="3" height="30"/>
          <rect x="25" y="5" width="1" height="30"/>
          <rect x="30" y="5" width="2" height="30"/>
        </g>
        <text x="50%" y="45" text-anchor="middle" font-family="Arial" font-size="8">${sampleProduct.barcode || '123456789012'}</text>
      </svg>`,
      '{{printed_at}}': new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
    };

    let preview = template;
    Object.entries(substitutions).forEach(([key, value]) => {
      preview = preview.replace(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
    });

    return preview;
  };

  // Update preview when value changes
  useEffect(() => {
    setPreviewHtml(generatePreview(value));
    setValidationErrors(validateTemplate(value));
  }, [value, sampleProduct, dimensions]);

  const applyPreset = (preset: typeof HTML_PRESETS[0]) => {
    // Adjust preset template to match current dimensions
    let template = preset.template;
    if (preset.width_mm !== dimensions.width_mm || preset.height_mm !== dimensions.height_mm) {
      template = template
        .replace(`size: ${preset.width_mm}mm ${preset.height_mm}mm`, `size: ${dimensions.width_mm}mm ${dimensions.height_mm}mm`)
        .replace(`width:${preset.width_mm}mm; height:${preset.height_mm}mm`, `width:${dimensions.width_mm}mm; height:${dimensions.height_mm}mm`);
    }
    onChange(template);
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success('Template copied to clipboard');
    } catch (err) {
      toast.error('Failed to copy to clipboard');
    }
  };

  const isValid = validationErrors.length === 0 && value.trim().length > 0;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">HTML Template Editor</h3>
          <p className="text-sm text-muted-foreground">
            Raw HTML with variable substitutions ({dimensions.width_mm}×{dimensions.height_mm}mm)
          </p>
        </div>
        <div className="flex gap-2">
          {isValid ? (
            <Badge variant="default" className="bg-green-100 text-green-800">
              <CheckCircle className="w-3 h-3 mr-1" />
              Valid
            </Badge>
          ) : (
            <Badge variant="destructive">
              <AlertTriangle className="w-3 h-3 mr-1" />
              Invalid
            </Badge>
          )}
        </div>
      </div>

      {/* Presets */}
      <div className="mb-4">
        <h4 className="text-sm font-medium mb-2">Quick Start Templates</h4>
        <div className="flex gap-2 flex-wrap">
          {HTML_PRESETS.map((preset) => (
            <Button
              key={preset.name}
              variant="outline"
              size="sm"
              onClick={() => applyPreset(preset)}
              className="text-xs"
            >
              <FileText className="w-3 h-3 mr-1" />
              {preset.name}
            </Button>
          ))}
        </div>
      </div>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <Alert className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              {validationErrors.map((error, index) => (
                <div key={index} className="text-sm">• {error}</div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Editor and Preview */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* HTML Editor */}
        <Card className="flex flex-col">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">HTML Template</CardTitle>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={copyToClipboard}>
                  <Copy className="w-3 h-3" />
                </Button>
                <Button 
                  variant="default" 
                  size="sm" 
                  onClick={onSave} 
                  disabled={!isValid || isSaving}
                >
                  <Save className="w-3 h-3 mr-1" />
                  {isSaving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 p-2">
            <Textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Enter your HTML template..."
              className="h-full resize-none font-mono text-sm"
              style={{ minHeight: '400px' }}
            />
          </CardContent>
        </Card>

        {/* Live Preview */}
        <Card className="flex flex-col">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Live Preview</CardTitle>
              <div className="flex gap-1">
                {onTestPrint && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={onTestPrint}
                    disabled={!isValid}
                  >
                    <Eye className="w-3 h-3 mr-1" />
                    Test Print
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 p-2">
            <div className="border rounded bg-white overflow-auto" style={{ minHeight: '400px' }}>
              {previewHtml ? (
                <iframe
                  srcDoc={previewHtml}
                  className="w-full h-full"
                  style={{ 
                    minHeight: '400px',
                    transform: 'scale(1)',
                    transformOrigin: 'top left'
                  }}
                  title="Template Preview"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center">
                    <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Enter HTML template to see preview</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Available Variables */}
      <div className="mt-4">
        <h4 className="text-sm font-medium mb-2">Available Variables</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <Badge variant="secondary">{'{{product.name}}'}</Badge>
          <Badge variant="secondary">{'{{product.sku}}'}</Badge>
          <Badge variant="secondary">{'{{price_formatted}}'}</Badge>
          <Badge variant="secondary">{'{{unit_suffix}}'}</Badge>
          <Badge variant="secondary">{'{{barcode_svg}}'}</Badge>
          <Badge variant="secondary">{'{{printed_at}}'}</Badge>
        </div>
      </div>
    </div>
  );
}