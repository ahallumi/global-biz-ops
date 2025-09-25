export const MM_TO_INCHES = 1 / 25.4;
export const INCHES_TO_MM = 25.4;

export function mmToInches(mm: number): number {
  return mm * MM_TO_INCHES;
}

export function inchesToMm(inches: number): number {
  return inches * INCHES_TO_MM;
}

export function convertUnit(value: number, fromUnit: 'mm' | 'inches', toUnit: 'mm' | 'inches'): number {
  if (fromUnit === toUnit) return value;
  
  if (fromUnit === 'mm' && toUnit === 'inches') {
    return mmToInches(value);
  }
  
  if (fromUnit === 'inches' && toUnit === 'mm') {
    return inchesToMm(value);
  }
  
  return value;
}

export function formatDimension(value: number, unit: 'mm' | 'inches'): string {
  if (unit === 'mm') {
    return `${value.toFixed(1)}mm`;
  } else {
    return `${value.toFixed(2)}"`;
  }
}