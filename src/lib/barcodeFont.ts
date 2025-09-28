// Libre Barcode 39 Text font utilities for precise barcode rendering

// Load Libre Barcode 39 Text font for barcode rendering
export async function loadLibreBarcodeFont(): Promise<void> {
  try {
    const font = new FontFace(
      'Libre Barcode 39 Text',
      'url(https://fonts.gstatic.com/s/librebarcodetext39/v17/sykz-ydym6Atkdtz08vJpgKqRxRPxo0Jq9LyW1BQ.woff2)'
    );
    
    await font.load();
    document.fonts.add(font);
    console.log('Libre Barcode 39 Text font loaded successfully');
  } catch (error) {
    console.warn('Failed to load Libre Barcode 39 Text font:', error);
  }
}

// Generate barcode text in Code39 format
export function formatCode39Barcode(data: string): string {
  // Code39 requires uppercase letters and specific characters
  const validChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-. $/+%';
  
  // Filter to valid characters and convert to uppercase
  const cleaned = data.toUpperCase().split('').filter(char => 
    validChars.includes(char)
  ).join('');
  
  // Add start/stop asterisks (*) if not present
  let formatted = cleaned;
  if (!formatted.startsWith('*')) {
    formatted = '*' + formatted;
  }
  if (!formatted.endsWith('*')) {
    formatted = formatted + '*';
  }
  
  return formatted;
}

// Check if barcode data is compatible with Code39
export function isValidCode39(data: string): boolean {
  const validChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-. $/+%*';
  return data.toUpperCase().split('').every(char => validChars.includes(char));
}

// Get optimal font size for barcode based on available width
export function calculateBarcodeFontSize(
  text: string, 
  maxWidth: number, 
  maxHeight: number
): { fontSize: number; width: number; height: number } {
  // Libre Barcode 39 Text has a specific character width ratio
  const charWidthRatio = 0.6; // Approximate character width to height ratio
  const characters = text.length;
  
  // Calculate maximum font size based on width constraint
  const maxFontSizeByWidth = Math.floor(maxWidth / (characters * charWidthRatio));
  
  // Calculate maximum font size based on height constraint
  const maxFontSizeByHeight = Math.floor(maxHeight);
  
  // Use the smaller of the two constraints
  const fontSize = Math.min(maxFontSizeByWidth, maxFontSizeByHeight, 48); // Cap at 48px
  
  return {
    fontSize,
    width: Math.ceil(fontSize * characters * charWidthRatio),
    height: fontSize
  };
}