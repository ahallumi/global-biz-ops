import { Button } from '@/components/ui/button';
import { CheckCircle, Plus, Check } from 'lucide-react';
import { WizardData } from '../AddProductWizard';

interface ConfirmationStepProps {
  intakeId: string;
  data: WizardData;
  onFinish: () => void;
  onAddAnother: () => void;
}

export function ConfirmationStep({ intakeId, data, onFinish, onAddAnother }: ConfirmationStepProps) {
  // This is now a success-only screen since saving happens in UnitsPerBoxStep
  return (
    <div className="flex flex-col h-full">
      {/* Success Header */}
      <div className="p-6 text-center flex-1 flex flex-col justify-center">
        <div className="w-20 h-20 mx-auto mb-6 bg-green-100 rounded-full flex items-center justify-center animate-scale-in">
          <CheckCircle className="w-12 h-12 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-green-800 mb-2">Product Added!</h2>
        <p className="text-green-600 text-sm mb-6">
          Successfully added to intake order
        </p>
        
        {/* Summary */}
        <div className="bg-green-50 rounded-lg p-4 text-left">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-green-700">Product:</span>
              <span className="font-medium text-green-800">
                {data.productName || `Barcode ${data.barcode}`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-green-700">Total Units:</span>
              <span className="font-medium text-green-800">{data.totalUnits}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-green-700">Boxes:</span>
              <span className="font-medium text-green-800">
                {data.boxCount} × {data.unitsPerBox}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="p-6 border-t space-y-3">
        <Button onClick={onAddAnother} size="lg" className="w-full">
          <Plus className="mr-2 w-5 h-5" />
          Add Another Product
        </Button>
        <Button variant="outline" onClick={onFinish} size="lg" className="w-full">
          <Check className="mr-2 w-5 h-5" />
          Finish
        </Button>
      </div>
    </div>
  );
}