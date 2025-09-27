import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Type, Barcode, Image, Square } from 'lucide-react';
import { TemplateElement } from './LabelDesigner';

interface DesignerToolboxProps {
  onElementAdd: (type: TemplateElement['type']) => void;
}

export function DesignerToolbox({ onElementAdd }: DesignerToolboxProps) {
  const tools = [
    {
      type: 'text' as const,
      icon: Type,
      label: 'Text',
      description: 'Add text element'
    },
    {
      type: 'barcode' as const,
      icon: Barcode,
      label: 'Barcode',
      description: 'Add barcode element'
    },
    {
      type: 'image' as const,
      icon: Image,
      label: 'Image',
      description: 'Add image element'
    },
    {
      type: 'box' as const,
      icon: Square,
      label: 'Box',
      description: 'Add box/shape element'
    }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Add Elements</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {tools.map((tool) => (
          <Button
            key={tool.type}
            variant="outline"
            className="w-full justify-start h-auto py-3"
            onClick={() => onElementAdd(tool.type)}
          >
            <tool.icon className="w-4 h-4 mr-3" />
            <div className="text-left">
              <div className="font-medium">{tool.label}</div>
              <div className="text-xs text-muted-foreground">{tool.description}</div>
            </div>
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}