import React from 'react';

export type ResizeHandlePosition = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

interface ResizeHandleProps {
  position: ResizeHandlePosition;
  onMouseDown: (e: React.MouseEvent, position: ResizeHandlePosition) => void;
}

export function ResizeHandle({ position, onMouseDown }: ResizeHandleProps) {
  const getPositionStyles = (pos: ResizeHandlePosition) => {
    const baseStyles = {
      position: 'absolute' as const,
      width: '8px',
      height: '8px',
      backgroundColor: 'hsl(var(--primary))',
      border: '1px solid white',
      borderRadius: '2px',
      cursor: getCursor(pos),
      zIndex: 1001,
      boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
    };

    switch (pos) {
      case 'n':
        return { ...baseStyles, top: '-4px', left: '50%', transform: 'translateX(-50%)' };
      case 'ne':
        return { ...baseStyles, top: '-4px', right: '-4px' };
      case 'e':
        return { ...baseStyles, top: '50%', right: '-4px', transform: 'translateY(-50%)' };
      case 'se':
        return { ...baseStyles, bottom: '-4px', right: '-4px' };
      case 's':
        return { ...baseStyles, bottom: '-4px', left: '50%', transform: 'translateX(-50%)' };
      case 'sw':
        return { ...baseStyles, bottom: '-4px', left: '-4px' };
      case 'w':
        return { ...baseStyles, top: '50%', left: '-4px', transform: 'translateY(-50%)' };
      case 'nw':
        return { ...baseStyles, top: '-4px', left: '-4px' };
      default:
        return baseStyles;
    }
  };

  const getCursor = (pos: ResizeHandlePosition) => {
    switch (pos) {
      case 'n':
      case 's':
        return 'ns-resize';
      case 'e':
      case 'w':
        return 'ew-resize';
      case 'ne':
      case 'sw':
        return 'nesw-resize';
      case 'nw':
      case 'se':
        return 'nwse-resize';
      default:
        return 'default';
    }
  };

  return (
    <div
      style={getPositionStyles(position)}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onMouseDown(e, position);
      }}
    />
  );
}