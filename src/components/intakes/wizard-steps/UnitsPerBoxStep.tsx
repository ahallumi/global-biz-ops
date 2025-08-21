import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, PackageCheck } from 'lucide-react';
import { WizardData } from '../AddProductWizard';
import { CustomNumericKeyboard } from './CustomNumericKeyboard';

interface UnitsPerBoxStepProps {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function UnitsPerBoxStep({ data, onUpdate, onNext, onBack }: UnitsPerBoxStepProps) {
  const [displayValue, setDisplayValue] = useState(data.unitsPerBox.toString());

  const handleNumber = (num: string) => {
    const newValue = displayValue === '0' ? num : displayValue + num;
    setDisplayValue(newValue);
    const unitsPerBox = parseInt(newValue) || 1;
    onUpdate({ unitsPerBox });
  };

  const handleBackspace = () => {
    const newValue = displayValue.slice(0, -1) || '0';
    setDisplayValue(newValue);
    const unitsPerBox = parseInt(newValue) || 1;
    onUpdate({ unitsPerBox });
  };

  const handleEnter = () => {
    onNext();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
          <PackageCheck className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Units per Box</h2>
        <p className="text-muted-foreground text-sm">
          How many units are in each box?
        </p>
      </div>

      {/* Display */}
      <div className="px-6 py-4 text-center">
        <div className="text-6xl font-bold text-primary mb-2 font-mono">
          {displayValue}
        </div>
        <div className="text-lg text-muted-foreground mb-4">
          {displayValue === '1' ? 'Unit per Box' : 'Units per Box'}
        </div>
        
        {/* Total Calculation */}
        <div className="bg-muted/50 rounded-lg p-4">
          <div className="text-sm text-muted-foreground mb-1">Total Units</div>
          <div className="text-2xl font-bold text-primary">
            {data.boxCount} boxes × {displayValue} units = {data.boxCount * (parseInt(displayValue) || 1)} total units
          </div>
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