import { Button } from '@/components/ui/button';
import { Delete, CornerDownLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CustomNumericKeyboardProps {
  onNumber: (num: string) => void;
  onBackspace: () => void;
  onEnter: () => void;
  className?: string;
}

export function CustomNumericKeyboard({ 
  onNumber, 
  onBackspace, 
  onEnter,
  className 
}: CustomNumericKeyboardProps) {
  const numbers = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

  return (
    <div className={cn("grid grid-cols-3 gap-3 p-4 bg-muted/30", className)}>
      {/* Numbers */}
      {numbers.slice(0, 9).map((num) => (
        <Button
          key={num}
          variant="outline"
          size="lg"
          onClick={() => onNumber(num)}
          className="h-14 text-xl font-semibold hover:bg-primary hover:text-primary-foreground"
        >
          {num}
        </Button>
      ))}
      
      {/* Bottom row: Backspace, 0, Enter */}
      <Button
        variant="outline"
        size="lg"
        onClick={onBackspace}
        className="h-14 hover:bg-destructive hover:text-destructive-foreground"
      >
        <Delete className="w-6 h-6" />
      </Button>
      
      <Button
        variant="outline"
        size="lg"
        onClick={() => onNumber('0')}
        className="h-14 text-xl font-semibold hover:bg-primary hover:text-primary-foreground"
      >
        0
      </Button>
      
      <Button
        variant="default"
        size="lg"
        onClick={onEnter}
        className="h-14 bg-primary hover:bg-primary/90"
      >
        <CornerDownLeft className="w-6 h-6" />
      </Button>
    </div>
  );
}