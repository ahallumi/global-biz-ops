import { AspectRatio } from '@/components/ui/aspect-ratio';
import { cn } from '@/lib/utils';

interface ResponsiveProductImageProps {
  productName: string;
  photoUrl?: string;
  imageUrl?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function ResponsiveProductImage({ 
  productName, 
  photoUrl, 
  imageUrl, 
  size = 'md', 
  className 
}: ResponsiveProductImageProps) {
  const imageSource = photoUrl || imageUrl;
  
  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-16 h-16',
    lg: 'w-20 h-20'
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getInitialsColor = (name: string) => {
    const colors = [
      'bg-primary text-primary-foreground',
      'bg-secondary text-secondary-foreground',
      'bg-accent text-accent-foreground',
      'bg-muted text-muted-foreground',
    ];
    const index = name.length % colors.length;
    return colors[index];
  };

  if (imageSource) {
    return (
      <div className={cn(sizeClasses[size], 'flex-shrink-0', className)}>
        <AspectRatio ratio={1} className="overflow-hidden rounded-md">
          <img
            src={imageSource}
            alt={productName}
            className="h-full w-full object-cover"
            onError={(e) => {
              // Fallback to initials if image fails to load
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              if (target.nextSibling) {
                (target.nextSibling as HTMLElement).style.display = 'flex';
              }
            }}
          />
          <div 
            className={cn(
              'hidden h-full w-full items-center justify-center text-sm font-medium rounded-md',
              getInitialsColor(productName)
            )}
          >
            {getInitials(productName)}
          </div>
        </AspectRatio>
      </div>
    );
  }

  return (
    <div 
      className={cn(
        sizeClasses[size],
        'flex items-center justify-center text-sm font-medium rounded-md flex-shrink-0',
        getInitialsColor(productName),
        className
      )}
    >
      {getInitials(productName)}
    </div>
  );
}