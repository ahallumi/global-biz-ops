import { cn } from '@/lib/utils';
import { Barcode, Camera, Package, PackageCheck, CheckCircle } from 'lucide-react';

interface ProgressIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

export function ProgressIndicator({ currentStep, totalSteps }: ProgressIndicatorProps) {
  const steps = [
    { icon: Barcode, label: 'Barcode' },
    { icon: Camera, label: 'Photo' },
    { icon: Package, label: 'Boxes' },
    { icon: PackageCheck, label: 'Units' },
    { icon: CheckCircle, label: 'Done' },
  ];

  return (
    <div className="bg-primary/5 p-4 border-b">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isActive = stepNumber === currentStep;
          const isCompleted = stepNumber < currentStep;
          const Icon = step.icon;

          return (
            <div key={stepNumber} className="flex flex-col items-center">
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center mb-2 border-2 transition-all",
                  isActive && "bg-primary text-primary-foreground border-primary scale-110",
                  isCompleted && "bg-primary/20 text-primary border-primary/30",
                  !isActive && !isCompleted && "bg-muted text-muted-foreground border-muted"
                )}
              >
                <Icon className="w-5 h-5" />
              </div>
              <span
                className={cn(
                  "text-xs font-medium transition-colors",
                  isActive && "text-primary",
                  isCompleted && "text-primary/70",
                  !isActive && !isCompleted && "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}