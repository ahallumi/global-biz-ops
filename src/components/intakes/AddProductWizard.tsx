import { useState } from 'react';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { BarcodeStep } from './wizard-steps/BarcodeStep';
import { PhotoStep } from './wizard-steps/PhotoStep';
import { BoxCountStep } from './wizard-steps/BoxCountStep';
import { UnitsPerBoxStep } from './wizard-steps/UnitsPerBoxStep';
import { ConfirmationStep } from './wizard-steps/ConfirmationStep';
import { ProgressIndicator } from './wizard-steps/ProgressIndicator';

export interface WizardData {
  barcode?: string;
  productId?: string;
  productName?: string;
  photoFile?: File;
  photoUrl?: string;
  boxCount: number;
  unitsPerBox: number;
  totalUnits: number;
}

interface AddProductWizardProps {
  intakeId: string;
  children?: React.ReactNode;
}

export function AddProductWizard({ intakeId, children }: AddProductWizardProps) {
  const [open, setOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [wizardData, setWizardData] = useState<WizardData>({
    boxCount: 1,
    unitsPerBox: 1,
    totalUnits: 1,
  });

  const totalSteps = 5;

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setCurrentStep(1);
    setWizardData({
      boxCount: 1,
      unitsPerBox: 1,
      totalUnits: 1,
    });
  };

  const handleAddAnother = () => {
    setCurrentStep(1);
    setWizardData({
      boxCount: 1,
      unitsPerBox: 1,
      totalUnits: 1,
    });
  };

  const updateWizardData = (updates: Partial<WizardData>) => {
    setWizardData(prev => {
      const newData = { ...prev, ...updates };
      // Calculate total units when box count or units per box change
      if ('boxCount' in updates || 'unitsPerBox' in updates) {
        newData.totalUnits = newData.boxCount * newData.unitsPerBox;
      }
      return newData;
    });
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <BarcodeStep
            data={wizardData}
            onUpdate={updateWizardData}
            onNext={handleNext}
          />
        );
      case 2:
        return (
          <PhotoStep
            data={wizardData}
            onUpdate={updateWizardData}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 3:
        return (
          <BoxCountStep
            data={wizardData}
            onUpdate={updateWizardData}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 4:
        return (
          <UnitsPerBoxStep
            intakeId={intakeId}
            data={wizardData}
            onUpdate={updateWizardData}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 5:
        return (
          <ConfirmationStep
            intakeId={intakeId}
            data={wizardData}
            onFinish={handleClose}
            onAddAnother={handleAddAnother}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add Product
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="w-full h-screen sm:max-w-md sm:h-[600px] p-0 gap-0">
        <div className="flex flex-col h-full">
          <ProgressIndicator currentStep={currentStep} totalSteps={totalSteps} />
          
          <div className="flex-1 flex flex-col">
            {renderStep()}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}