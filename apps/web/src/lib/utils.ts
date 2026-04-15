type ClassValue = string | number | boolean | undefined | null | ClassValue[] | Record<string, boolean | undefined | null>;

function clsx(...inputs: ClassValue[]): string {
  const result: string[] = [];
  
  for (const input of inputs) {
    if (!input) continue;
    
    if (typeof input === 'string' || typeof input === 'number') {
      result.push(String(input));
    } else if (Array.isArray(input)) {
      const inner = clsx(...input);
      if (inner) result.push(inner);
    } else if (typeof input === 'object') {
      for (const [key, value] of Object.entries(input)) {
        if (value) result.push(key);
      }
    }
  }
  
  return result.join(' ');
}

function twMerge(...inputs: ClassValue[]): string {
  return clsx(...inputs);
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(...inputs);
}
