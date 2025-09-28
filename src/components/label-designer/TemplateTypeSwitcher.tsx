import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Palette, Code } from 'lucide-react';

interface TemplateTypeSwitcherProps {
  currentType: 'visual' | 'html';
  onTypeChange: (type: 'visual' | 'html') => void;
  hasVisualContent: boolean;
  hasHtmlContent: boolean;
}

export function TemplateTypeSwitcher({ 
  currentType, 
  onTypeChange, 
  hasVisualContent,
  hasHtmlContent 
}: TemplateTypeSwitcherProps) {
  return (
    <div className="flex items-center gap-2 p-1 bg-muted rounded-lg">
      <Button
        variant={currentType === 'visual' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onTypeChange('visual')}
        className="flex items-center gap-2"
      >
        <Palette className="w-4 h-4" />
        Visual Designer
        {hasVisualContent && <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs">●</Badge>}
      </Button>
      
      <Button
        variant={currentType === 'html' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onTypeChange('html')}
        className="flex items-center gap-2"
      >
        <Code className="w-4 h-4" />
        HTML Editor
        {hasHtmlContent && <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs">●</Badge>}
      </Button>
    </div>
  );
}