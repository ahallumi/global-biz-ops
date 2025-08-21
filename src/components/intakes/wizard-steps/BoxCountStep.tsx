import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Package } from 'lucide-react';
import { WizardData } from '../AddProductWizard';
import { CustomNumericKeyboard } from './CustomNumericKeyboard';

interface BoxCountStepProps {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function BoxCountStep({ data, onUpdate, onNext, onBack }: BoxCountStepProps) {
  const [displayValue, setDisplayValue] = useState(data.boxCount.toString());

  const handleNumber = (num: string) => {
    const newValue = displayValue === '0' ? num : displayValue + num;
    setDisplayValue(newValue);
    onUpdate({ boxCount: parseInt(newValue) || 1 });
  };

  const handleBackspace = () => {
    const newValue = displayValue.slice(0, -1) || '0';
    setDisplayValue(newValue);
    onUpdate({ boxCount: parseInt(newValue) || 1 });
  };

  const handleEnter = () => {
    onNext();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
          <Package className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Enter Box Count</h2>
        <p className="text-muted-foreground text-sm">
          How many boxes did you receive?
        </p>
      </div>

      {/* Display */}
      <div className="px-6 py-8 text-center">
        <div className="text-6xl font-bold text-primary mb-2 font-mono">
          {displayValue}
        </div>
        <div className="text-lg text-muted-foreground">
          {displayValue === '1' ? 'Box' : 'Boxes'}
        </div>
      </div>

      {/* Custom Numeric Keyboard */}
      <div className="flex-1 flex flex-col justify-end">
        <CustomNumericKeyboard
          onNumber={handleNumber}
          onBackspace={handleBackspace}
          onEnter={handleEnter}
        />
      </div>

      {/* Navigation */}
      <div className="p-4 border-t">
        <Button variant="outline" onClick={onBack} size="lg" className="w-full">
          <ChevronLeft className="mr-2 w-5 h-5" />
          Back
        </Button>
      </div>
    </div>
  );
}