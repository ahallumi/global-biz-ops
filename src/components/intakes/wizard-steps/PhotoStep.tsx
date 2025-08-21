import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Camera, Upload } from 'lucide-react';
import { WizardData } from '../AddProductWizard';

interface PhotoStepProps {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function PhotoStep({ data, onUpdate, onNext, onBack }: PhotoStepProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpdate({ photoFile: file });
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target?.result as string);
        // Auto-advance to next step after photo is loaded
        setTimeout(() => {
          onNext();
        }, 500);
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleNext = () => {
    onNext();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNext();
    }
  };

  return (
    <div className="flex flex-col h-full" onKeyPress={handleKeyPress} tabIndex={0}>
      {/* Header */}
      <div className="p-6 text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
          <Camera className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Take Product Photo</h2>
        <p className="text-muted-foreground text-sm">
          Capture an image of the product for your records
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 flex flex-col items-center justify-center">
        {preview || data.photoFile ? (
          <div className="w-full max-w-sm">
            <div className="aspect-square bg-muted rounded-lg overflow-hidden mb-4">
              {preview && (
                <img 
                  src={preview} 
                  alt="Product preview" 
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            <Button 
              variant="outline" 
              onClick={triggerFileInput}
              className="w-full"
            >
              <Camera className="mr-2 w-4 h-4" />
              Retake Photo
            </Button>
          </div>
        ) : (
          <div className="text-center">
            <div 
              className="w-40 h-40 bg-muted border-2 border-dashed border-muted-foreground/30 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-muted/80 transition-colors mb-4"
              onClick={triggerFileInput}
            >
              <Camera className="w-12 h-12 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">Tap to capture</p>
            </div>
            <Button onClick={triggerFileInput} size="lg" className="w-full">
              <Upload className="mr-2 w-5 h-5" />
              Select Photo
            </Button>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Navigation */}
      <div className="p-6 border-t flex gap-3">
        <Button variant="outline" onClick={onBack} size="lg" className="flex-1">
          <ChevronLeft className="mr-2 w-5 h-5" />
          Back
        </Button>
        <Button onClick={handleNext} size="lg" className="flex-1">
          Next
          <ChevronRight className="ml-2 w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}