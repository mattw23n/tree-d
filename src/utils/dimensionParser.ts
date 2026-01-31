/**
 * Dimension Parser Utility
 * Extracts centimeter values from Met Museum dimension strings
 * 
 * Mapping: 100cm in real life = 1 unit in Three.js (standard metric conversion)
 */

export interface ParsedDimensions {
  width: number; // in Three.js units (cm / 100)
  height: number; // in Three.js units (cm / 100)
  depth?: number; // in Three.js units (cm / 100)
  originalString: string;
}

/**
 * Parses dimension string from Met API to extract centimeter values
 * Handles formats like:
 * - "29 1/8 x 36 1/4 in. (73.7 x 92.1 cm)"
 * - "73.7 x 92.1 cm"
 * - "H. 73.7 cm; W. 92.1 cm"
 * 
 * @param dimensions - The dimensions string from Met API
 * @returns Parsed dimensions in Three.js units (100cm = 1 unit) or null if parsing fails
 */
export function parseDimensions(dimensions: string | null | undefined): ParsedDimensions | null {
  if (!dimensions || dimensions.toLowerCase().includes('unavailable')) {
    return null;
  }

  // Regex pattern to find centimeter values
  // Matches patterns like: (73.7 x 92.1 cm) or 73.7 x 92.1 cm or H. 73.7 cm; W. 92.1 cm
  const cmPattern = /(\d+\.?\d*)\s*[x×]\s*(\d+\.?\d*)\s*cm/i;
  const heightWidthPattern = /[HW]\.?\s*(\d+\.?\d*)\s*cm[^;]*[HW]\.?\s*(\d+\.?\d*)\s*cm/i;
  const depthPattern = /[D]\.?\s*(\d+\.?\d*)\s*cm/i;

  let width: number | null = null;
  let height: number | null = null;
  let depth: number | undefined = undefined;

  // Try to match standard "width x height cm" pattern
  const cmMatch = dimensions.match(cmPattern);
  if (cmMatch) {
    width = parseFloat(cmMatch[1]);
    height = parseFloat(cmMatch[2]);
  } else {
    // Try height/width pattern
    const hwMatch = dimensions.match(heightWidthPattern);
    if (hwMatch) {
      height = parseFloat(hwMatch[1]);
      width = parseFloat(hwMatch[2]);
    } else {
      // Try to find individual cm values
      const cmValues = dimensions.match(/(\d+\.?\d*)\s*cm/gi);
      if (cmValues && cmValues.length >= 2) {
        width = parseFloat(cmValues[0]);
        height = parseFloat(cmValues[1]);
        if (cmValues.length >= 3) {
          depth = parseFloat(cmValues[2]);
        }
      }
    }
  }

  // Try to find depth if not already found
  if (!depth) {
    const depthMatch = dimensions.match(depthPattern);
    if (depthMatch) {
      depth = parseFloat(depthMatch[1]);
    }
  }

  if (width === null || height === null) {
    return null;
  }

  // Convert from cm to Three.js units (100cm = 1 unit)
  // So 73.7 cm becomes 0.737 units
  return {
    width: width / 100,
    height: height / 100,
    depth: depth ? depth / 100 : undefined,
    originalString: dimensions,
  };
}

/**
 * Gets default dimensions if parsing fails
 * Uses a standard painting size as fallback
 */
export function getDefaultDimensions(): ParsedDimensions {
  // Default to a standard painting size: 50cm x 60cm
  return {
    width: 0.5, // 50cm / 100
    height: 0.6, // 60cm / 100
    depth: 0.0003, // 0.03cm / 100 (very thin canvas)
    originalString: 'Default dimensions (50 x 60 cm)',
  };
}
