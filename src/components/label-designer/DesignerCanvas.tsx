import React, { useRef, useState } from 'react';
import { TemplateLayout, TemplateElement } from './LabelDesigner';

interface DesignerCanvasProps {
  layout: TemplateLayout;
  sampleProduct: any;
  selectedElement: string | null;
  onElementSelect: (elementId: string | null) => void;
  onElementUpdate: (elementId: string, updates: Partial<TemplateElement>) => void;
  onElementDelete: (elementId: string) => void;
}

export function DesignerCanvas({
  layout,
  sampleProduct,
  selectedElement,
  onElementSelect,
  onElementUpdate,
  onElementDelete
}: DesignerCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  
  const DRAG_THRESHOLD = 3; // pixels

  // Calculate canvas scale to fit in container
  const containerWidth = 600; // Fixed container width
  const containerHeight = 400; // Fixed container height
  const labelWidth = layout.meta.width_mm;
  const labelHeight = layout.meta.height_mm;
  
  const scaleX = containerWidth / labelWidth;
  const scaleY = containerHeight / labelHeight;
  const baseScale = Math.min(scaleX, scaleY, 3) * 0.8; // Max 3x, with padding
  const finalScale = baseScale * zoom;

  // Convert mm to pixels
  const mmToPx = (mm: number) => mm * finalScale;

  const evaluateBinding = (bind: string, product: any): string => {
    if (!bind) return '';
    
    if (bind.startsWith('product.')) {
      const prop = bind.substring(8);
      let value = product[prop] || '';
      
      if (bind.includes('| currency(')) {
        const match = bind.match(/\| currency\('(.+?)'\)/);
        if (match) {
          const symbol = match[1];
          return `${symbol}${parseFloat(value).toFixed(2)}`;
        }
      }
      
      return String(value);
    }
    
    return bind;
  };

  const handleElementMouseDown = (e: React.MouseEvent, element: TemplateElement) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Always select the element on mouse down
    onElementSelect(element.id);
    
    // Store initial position for drag threshold detection
    setDragStart({ x: e.clientX, y: e.clientY });
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: e.clientX - rect.left - mmToPx(element.x_mm),
        y: e.clientY - rect.top - mmToPx(element.y_mm)
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!selectedElement) return;
    
    // Check if we should start dragging (mouse moved beyond threshold)
    if (!isDragging && dragStart.x !== 0 && dragStart.y !== 0) {
      const deltaX = Math.abs(e.clientX - dragStart.x);
      const deltaY = Math.abs(e.clientY - dragStart.y);
      
      if (deltaX > DRAG_THRESHOLD || deltaY > DRAG_THRESHOLD) {
        setIsDragging(true);
      }
    }
    
    // Only update position if actively dragging
    if (isDragging) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const newX = (e.clientX - rect.left - dragOffset.x) / finalScale;
        const newY = (e.clientY - rect.top - dragOffset.y) / finalScale;
        
        // Constrain to canvas bounds
        const constrainedX = Math.max(0, Math.min(newX, labelWidth - 10));
        const constrainedY = Math.max(0, Math.min(newY, labelHeight - 5));
        
        onElementUpdate(selectedElement, {
          x_mm: constrainedX,
          y_mm: constrainedY
        });
      }
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragStart({ x: 0, y: 0 });
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (isDragging) return;
    onElementSelect(null);
  };

  const renderElement = (element: TemplateElement) => {
    const value = evaluateBinding(element.bind || '', sampleProduct);
    const isSelected = element.id === selectedElement;
    
    const elementStyle: React.CSSProperties = {
      position: 'absolute',
      left: mmToPx(element.x_mm),
      top: mmToPx(element.y_mm),
      width: mmToPx(element.w_mm),
      height: mmToPx(element.h_mm),
      border: isSelected ? '2px solid #3b82f6' : '1px solid rgba(0,0,0,0.2)',
      cursor: 'move',
      backgroundColor: element.type === 'box' ? element.style?.fill || '#f0f0f0' : 'transparent',
      fontSize: element.style?.font_size_pt ? `${element.style.font_size_pt * finalScale}px` : '12px',
      fontFamily: element.style?.font_family || 'Inter',
      fontWeight: element.style?.font_weight || 400,
      textAlign: element.style?.align || 'left',
      display: 'flex',
      alignItems: 'center',
      justifyContent: element.style?.align === 'center' ? 'center' : element.style?.align === 'right' ? 'flex-end' : 'flex-start',
      padding: '2px',
      boxSizing: 'border-box',
      overflow: 'hidden'
    };

    let content = '';
    if (element.type === 'text') {
      content = value || 'Text';
    } else if (element.type === 'barcode') {
      content = `[BARCODE: ${value || '123456789012'}]`;
    } else if (element.type === 'image') {
      content = '[IMAGE]';
    }

    return (
      <div
        key={element.id}
        style={elementStyle}
        onMouseDown={(e) => handleElementMouseDown(e, element)}
        title={`${element.type}: ${element.bind || element.id}`}
      >
        {content}
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
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Zoom Controls */}
      <div className="flex items-center gap-2 mb-4">
        <button
          className="px-2 py-1 border rounded text-sm"
          onClick={() => setZoom(Math.max(0.25, zoom - 0.25))}
        >
          -
        </button>
        <span className="text-sm min-w-16 text-center">{Math.round(zoom * 100)}%</span>
        <button
          className="px-2 py-1 border rounded text-sm"
          onClick={() => setZoom(Math.min(4, zoom + 0.25))}
        >
          +
        </button>
        <button
          className="px-2 py-1 border rounded text-sm ml-2"
          onClick={() => setZoom(1)}
        >
          Reset
        </button>
      </div>

      {/* Canvas */}
      <div 
        className="flex-1 overflow-auto bg-gray-50 p-8 relative"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div className="flex items-center justify-center min-h-full">
          <div
            ref={canvasRef}
            className="relative bg-white shadow-lg"
            style={{
              width: mmToPx(labelWidth),
              height: mmToPx(labelHeight),
              backgroundColor: layout.meta.bg || '#FFFFFF'
            }}
            onClick={handleCanvasClick}
          >
            {/* Grid overlay */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: `
                  linear-gradient(to right, rgba(0,0,0,0.1) 1px, transparent 1px),
                  linear-gradient(to bottom, rgba(0,0,0,0.1) 1px, transparent 1px)
                `,
                backgroundSize: `${mmToPx(5)} ${mmToPx(5)}`
              }}
            />
            
            {/* Render elements */}
            {layout.elements.map(renderElement)}
            
            {/* Rulers */}
            <div
              className="absolute -top-6 left-0 right-0 h-6 bg-gray-100 border-b flex"
              style={{ fontSize: '10px' }}
            >
              {Array.from({ length: Math.ceil(labelWidth / 5) + 1 }, (_, i) => (
                <div
                  key={i}
                  className="relative"
                  style={{ width: mmToPx(5) }}
                >
                  <div className="absolute bottom-0 left-0 w-px h-2 bg-gray-400" />
                  <div className="absolute bottom-2 left-1 text-xs text-gray-600">
                    {i * 5}
                  </div>
                </div>
              ))}
            </div>
            
            <div
              className="absolute -left-6 top-0 bottom-0 w-6 bg-gray-100 border-r flex flex-col"
              style={{ fontSize: '10px' }}
            >
              {Array.from({ length: Math.ceil(labelHeight / 5) + 1 }, (_, i) => (
                <div
                  key={i}
                  className="relative"
                  style={{ height: mmToPx(5) }}
                >
                  <div className="absolute right-0 top-0 h-px w-2 bg-gray-400" />
                  <div 
                    className="absolute right-2 top-1 text-xs text-gray-600"
                    style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
                  >
                    {i * 5}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}