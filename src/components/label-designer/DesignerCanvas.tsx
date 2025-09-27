import React, { useRef, useState, useCallback, useEffect } from 'react';
import { TemplateElement, TemplateLayout } from './LabelDesigner';
import { ResizeHandle, ResizeHandlePosition } from './ResizeHandle';
import { useDesignerStore } from '@/stores/designerStore';
import { fitTextToBox, mmToPx, getUnitSuffix } from '@/lib/textAutofit';
import { formatCurrency } from '@/lib/utils';

interface DesignerCanvasProps {
  layout: TemplateLayout;
  sampleProduct: any;
  onElementUpdate: (elementId: string, updates: Partial<TemplateElement>) => void;
  onElementDelete: (elementId: string) => void;
}

export function DesignerCanvas({ layout, sampleProduct, onElementUpdate, onElementDelete }: DesignerCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const { 
    selectedElementId, 
    setSelected, 
    gridEnabled, 
    snapEnabled, 
    showRulers,
    zoom 
  } = useDesignerStore();
  
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeHandle, setResizeHandle] = useState<ResizeHandlePosition | null>(null);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, w: 0, h: 0 });
  
  const DRAG_THRESHOLD = 3; // pixels
  const SNAP_GRID = 1; // mm
  
  const selectedElement = layout.elements.find(el => el.id === selectedElementId);

  // Calculate canvas scale to fit in container
  const containerWidth = 600;
  const containerHeight = 400;
  const labelWidth = layout.meta.width_mm;
  const labelHeight = layout.meta.height_mm;
  const scaleX = containerWidth / labelWidth;
  const scaleY = containerHeight / labelHeight;
  const baseScale = Math.min(scaleX, scaleY) * 0.8;
  const finalScale = baseScale * zoom;

  // Convert mm to pixels
  const mmToPxCanvas = useCallback((mm: number): number => {
    return mm * finalScale;
  }, [finalScale]);

  // Convert pixels to mm with snapping
  const pxToMm = useCallback((px: number): number => {
    const mm = px / finalScale;
    return snapEnabled ? Math.round(mm / SNAP_GRID) * SNAP_GRID : mm;
  }, [finalScale, snapEnabled]);

  // Snap to grid helper
  const snapToGrid = useCallback((value: number): number => {
    return snapEnabled ? Math.round(value / SNAP_GRID) * SNAP_GRID : value;
  }, [snapEnabled]);

  // Enhanced binding evaluation with unit suffix support
  const evaluateBinding = useCallback((bind: string, product: any): string => {
    if (!bind) return '';
    
    try {
      // Handle unit suffix binding
      if (bind.includes('unit_suffix')) {
        const unitMatch = bind.match(/product\.unit\s*\|\s*unit_suffix\(\)/);
        if (unitMatch) {
          return getUnitSuffix(product.unit);
        }
      }
      
      // Handle price with unit suffix
      if (bind.includes("product.price | currency('$') ~ ' ' ~ (product.unit | unit_suffix())")) {
        return `${formatCurrency(product.price)} ${getUnitSuffix(product.unit)}`;
      }
      
      // Handle currency formatting
      if (bind.includes("currency('$')")) {
        const priceMatch = bind.match(/product\.price/);
        if (priceMatch && typeof product.price === 'number') {
          return formatCurrency(product.price);
        }
      }
      
      // Simple property access
      const propMatch = bind.match(/^product\.(\w+)$/);
      if (propMatch) {
        const prop = propMatch[1];
        return String(product[prop] || '');
      }
      
      return bind;
    } catch (error) {
      console.error('Error evaluating binding:', error);
      return bind;
    }
  }, []);

  // Element interaction handlers
  const handleElementMouseDown = useCallback((element: TemplateElement, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Always select the element on mouse down
    setSelected(element.id);
    
    // Store initial position for drag threshold detection
    setDragStart({ x: e.clientX, y: e.clientY });
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: e.clientX - rect.left - mmToPxCanvas(element.x_mm),
        y: e.clientY - rect.top - mmToPxCanvas(element.y_mm)
      });
    }
  }, [setSelected, mmToPxCanvas]);

  // Resize handle mouse down
  const handleResizeMouseDown = useCallback((e: React.MouseEvent, handle: ResizeHandlePosition) => {
    if (!selectedElement) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    setIsResizing(true);
    setResizeHandle(handle);
    setResizeStart({
      x: selectedElement.x_mm,
      y: selectedElement.y_mm,
      w: selectedElement.w_mm,
      h: selectedElement.h_mm
    });
    
    setDragStart({ x: e.clientX, y: e.clientY });
  }, [selectedElement]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!selectedElement) return;
    
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    
    // Handle resize operations
    if (isResizing && resizeHandle) {
      const deltaXMm = pxToMm(deltaX);
      const deltaYMm = pxToMm(deltaY);
      
      let newX = resizeStart.x;
      let newY = resizeStart.y;
      let newW = resizeStart.w;
      let newH = resizeStart.h;
      
      // Apply resize based on handle position
      switch (resizeHandle) {
        case 'n':
          newY = snapToGrid(resizeStart.y + deltaYMm);
          newH = snapToGrid(resizeStart.h - deltaYMm);
          break;
        case 'ne':
          newY = snapToGrid(resizeStart.y + deltaYMm);
          newW = snapToGrid(resizeStart.w + deltaXMm);
          newH = snapToGrid(resizeStart.h - deltaYMm);
          break;
        case 'e':
          newW = snapToGrid(resizeStart.w + deltaXMm);
          break;
        case 'se':
          newW = snapToGrid(resizeStart.w + deltaXMm);
          newH = snapToGrid(resizeStart.h + deltaYMm);
          break;
        case 's':
          newH = snapToGrid(resizeStart.h + deltaYMm);
          break;
        case 'sw':
          newX = snapToGrid(resizeStart.x + deltaXMm);
          newW = snapToGrid(resizeStart.w - deltaXMm);
          newH = snapToGrid(resizeStart.h + deltaYMm);
          break;
        case 'w':
          newX = snapToGrid(resizeStart.x + deltaXMm);
          newW = snapToGrid(resizeStart.w - deltaXMm);
          break;
        case 'nw':
          newX = snapToGrid(resizeStart.x + deltaXMm);
          newY = snapToGrid(resizeStart.y + deltaYMm);
          newW = snapToGrid(resizeStart.w - deltaXMm);
          newH = snapToGrid(resizeStart.h - deltaYMm);
          break;
      }
      
      // Enforce minimum sizes
      const minSize = selectedElement.type === 'barcode' ? 5 : 2;
      newW = Math.max(minSize, newW);
      newH = Math.max(minSize, newH);
      
      // Constrain to canvas bounds
      newX = Math.max(0, Math.min(newX, labelWidth - newW));
      newY = Math.max(0, Math.min(newY, labelHeight - newH));
      
      onElementUpdate(selectedElement.id, {
        x_mm: newX,
        y_mm: newY,
        w_mm: newW,
        h_mm: newH
      });
      return;
    }
    
    // Check if we should start dragging (mouse moved beyond threshold)
    if (!isDragging && dragStart.x !== 0 && dragStart.y !== 0) {
      if (Math.abs(deltaX) > DRAG_THRESHOLD || Math.abs(deltaY) > DRAG_THRESHOLD) {
        setIsDragging(true);
      }
    }
    
    // Handle dragging
    if (isDragging) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const newX = pxToMm(e.clientX - rect.left - dragOffset.x);
        const newY = pxToMm(e.clientY - rect.top - dragOffset.y);
        
        // Constrain to canvas bounds
        const constrainedX = Math.max(0, Math.min(snapToGrid(newX), labelWidth - selectedElement.w_mm));
        const constrainedY = Math.max(0, Math.min(snapToGrid(newY), labelHeight - selectedElement.h_mm));
        
        onElementUpdate(selectedElement.id, {
          x_mm: constrainedX,
          y_mm: constrainedY
        });
      }
    }
  }, [selectedElement, isResizing, isDragging, resizeHandle, resizeStart, dragStart, dragOffset, pxToMm, snapToGrid, labelWidth, labelHeight, onElementUpdate]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(false);
    setResizeHandle(null);
    setDragStart({ x: 0, y: 0 });
  }, []);

  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    // Only deselect if clicking on empty canvas
    if (e.target === e.currentTarget) {
      setSelected(null);
    }
  }, [setSelected]);

  // Auto-fit text effect
  useEffect(() => {
    const autoFitElements = layout.elements.filter(el => 
      el.type === 'text' && el.overflow?.mode === 'shrink_to_fit'
    );
    
    autoFitElements.forEach(async (element) => {
      if (!element.bind || !element.style) return;
      
      const text = evaluateBinding(element.bind, sampleProduct);
      if (!text) return;
      
      const boxPx = {
        width: mmToPx(element.w_mm, layout.meta.dpi),
        height: mmToPx(element.h_mm, layout.meta.dpi)
      };
      
      try {
        const result = await fitTextToBox(text, boxPx, element.style, element.overflow);
        
        if (Math.abs(result.fontSize - element.style.font_size_pt) > 0.1) {
          onElementUpdate(element.id, {
            style: {
              ...element.style,
              font_size_pt: result.fontSize
            }
          });
        }
      } catch (error) {
        console.error('Error auto-fitting text:', error);
      }
    });
  }, [layout.elements, sampleProduct, evaluateBinding, onElementUpdate]);

  // Render individual element
  const renderElement = useCallback((element: TemplateElement) => {
    const isSelected = selectedElementId === element.id;
    const content = element.bind ? evaluateBinding(element.bind, sampleProduct) : '';
    
    // Calculate computed font size for display
    const displayFontSize = element.type === 'text' && element.overflow?.mode === 'shrink_to_fit' 
      ? element.style?.font_size_pt || 10 
      : element.style?.font_size_pt || 10;
    
    const elementStyle: React.CSSProperties = {
      position: 'absolute',
      left: mmToPxCanvas(element.x_mm),
      top: mmToPxCanvas(element.y_mm),
      width: mmToPxCanvas(element.w_mm),
      height: mmToPxCanvas(element.h_mm),
      border: isSelected ? '2px solid hsl(var(--primary))' : '1px solid hsl(var(--border))',
      backgroundColor: element.type === 'box' ? 'hsl(var(--muted))' : 'transparent',
      cursor: 'pointer',
      userSelect: 'none',
      boxSizing: 'border-box',
      overflow: 'hidden'
    };

    // Type-specific styling
    if (element.type === 'text') {
      Object.assign(elementStyle, {
        fontFamily: element.style?.font_family || 'Inter',
        fontSize: `${displayFontSize * finalScale / 4}px`, // Approximate pt to px conversion
        fontWeight: element.style?.font_weight || 400,
        textAlign: element.style?.align || 'left',
        display: 'flex',
        alignItems: 'center',
        padding: '2px',
        lineHeight: '1.2',
        wordWrap: 'break-word'
      });
    }

    if (element.type === 'barcode') {
      Object.assign(elementStyle, {
        backgroundColor: 'hsl(var(--muted))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '10px',
        color: 'hsl(var(--muted-foreground))'
      });
    }

    return (
      <div key={element.id}>
        <div
          style={elementStyle}
          onMouseDown={(e) => handleElementMouseDown(element, e)}
        >
          {element.type === 'text' && content}
          {element.type === 'barcode' && `[${content}]`}
          {element.type === 'image' && '[IMAGE]'}
          {element.type === 'box' && ''}
          
          {/* Delete button */}
          {isSelected && (
            <div
              style={{
                position: 'absolute',
                top: -10,
                right: -10,
                width: 20,
                height: 20,
                backgroundColor: '#ef4444',
                color: 'white',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 'bold',
                cursor: 'pointer',
                zIndex: 1000,
                border: '2px solid white',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                transition: 'all 0.2s ease'
              }}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onElementDelete(element.id);
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.backgroundColor = '#dc2626';
                (e.target as HTMLElement).style.transform = 'scale(1.1)';
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.backgroundColor = '#ef4444';
                (e.target as HTMLElement).style.transform = 'scale(1)';
              }}
            >
              ×
            </div>
          )}
        </div>
        
        {/* Resize handles */}
        {isSelected && (
          <div style={{ position: 'absolute', left: mmToPxCanvas(element.x_mm), top: mmToPxCanvas(element.y_mm), width: mmToPxCanvas(element.w_mm), height: mmToPxCanvas(element.h_mm) }}>
            <ResizeHandle position="n" onMouseDown={handleResizeMouseDown} />
            <ResizeHandle position="ne" onMouseDown={handleResizeMouseDown} />
            <ResizeHandle position="e" onMouseDown={handleResizeMouseDown} />
            <ResizeHandle position="se" onMouseDown={handleResizeMouseDown} />
            <ResizeHandle position="s" onMouseDown={handleResizeMouseDown} />
            <ResizeHandle position="sw" onMouseDown={handleResizeMouseDown} />
            <ResizeHandle position="w" onMouseDown={handleResizeMouseDown} />
            <ResizeHandle position="nw" onMouseDown={handleResizeMouseDown} />
          </div>
        )}
      </div>
    );
  }, [selectedElementId, evaluateBinding, sampleProduct, mmToPxCanvas, finalScale, handleElementMouseDown, handleResizeMouseDown, onElementDelete]);

  return (
    <div className="h-full flex flex-col">
      {/* Canvas container */}
      <div className="flex-1 relative overflow-hidden">
        {/* Rulers */}
        {showRulers && (
          <>
            {/* Top ruler */}
            <div className="absolute top-0 left-8 right-0 h-6 bg-muted border-b flex items-end text-xs">
              {Array.from({ length: Math.ceil(labelWidth) }, (_, i) => (
                <div
                  key={i}
                  className="relative flex-shrink-0 border-l border-muted-foreground/20"
                  style={{ width: mmToPxCanvas(1) }}
                >
                  {i % 5 === 0 && (
                    <span className="absolute bottom-0 left-1 text-muted-foreground">
                      {i}
                    </span>
                  )}
                </div>
              ))}
            </div>
            
            {/* Left ruler */}
            <div className="absolute top-6 left-0 bottom-0 w-8 bg-muted border-r flex flex-col text-xs">
              {Array.from({ length: Math.ceil(labelHeight) }, (_, i) => (
                <div
                  key={i}
                  className="relative flex-shrink-0 border-t border-muted-foreground/20"
                  style={{ height: mmToPxCanvas(1) }}
                >
                  {i % 5 === 0 && (
                    <span className="absolute top-1 left-1 text-muted-foreground transform -rotate-90 origin-left text-[10px]">
                      {i}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Main canvas */}
        <div 
          className="absolute bg-background"
          style={{
            top: showRulers ? 24 : 0,
            left: showRulers ? 32 : 0,
            right: 0,
            bottom: 0,
            overflow: 'auto'
          }}
        >
          <div className="flex items-center justify-center h-full p-8">
            <div
              ref={canvasRef}
              className="relative bg-white border-2 border-muted"
              style={{
                width: mmToPxCanvas(labelWidth),
                height: mmToPxCanvas(labelHeight),
                minWidth: mmToPxCanvas(labelWidth),
                minHeight: mmToPxCanvas(labelHeight)
              }}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onClick={handleCanvasClick}
            >
              {/* Grid overlay */}
              {gridEnabled && (
                <div 
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    backgroundImage: `
                      linear-gradient(to right, hsl(var(--muted-foreground) / 0.1) 1px, transparent 1px),
                      linear-gradient(to bottom, hsl(var(--muted-foreground) / 0.1) 1px, transparent 1px)
                    `,
                    backgroundSize: `${mmToPxCanvas(SNAP_GRID)}px ${mmToPxCanvas(SNAP_GRID)}px`
                  }}
                />
              )}
              
              {/* Elements */}
              {layout.elements.map(renderElement)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}