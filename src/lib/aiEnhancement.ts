/**
 * AI Enhancement Service
 * Supports multiple AI providers for texture enhancement and generation
 * Compatible with: OpenAI, Stability AI, Hunyuan (Tencent), and others
 */

export interface AIEnhancementOptions {
  provider?: 'openai' | 'stability' | 'hunyuan' | 'replicate' | 'huggingface';
  enhanceType?: 'upscale' | 'texture' | 'normal-map' | 'depth-map';
  strength?: number; // 0-1, how much to enhance
}

/**
 * Generate normal map using an AI model
 *
 * NOTE:
 * - This implementation now calls a local Marigold normals server
 *   running at http://127.0.0.1:8000/marigold-normals
 * - If the server is unavailable, we throw a special fallback error
 *   so the caller can gracefully switch to the procedural method.
 */
export async function generateAINormalMap(
  imageUrl: string,
  model: 'depth-anything-v2' | 'marigold-normals' | 'depthpro' = 'marigold-normals'
): Promise<string> {
  if (imageUrl.startsWith('blob:') || imageUrl.startsWith('data:')) {
    const fallbackError = new Error('AI_NORMAL_MAP_UNAVAILABLE');
    (fallbackError as any).isFallback = true;
    throw fallbackError;
  }
  try {
    // Call local Marigold normals server
    const response = await fetch('http://127.0.0.1:8000/marigold-normals', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image_url: imageUrl,
        num_inference_steps: 10,
      }),
    });

    if (!response.ok) {
      const fallbackError = new Error('AI_NORMAL_MAP_UNAVAILABLE');
      (fallbackError as any).isFallback = true;
      throw fallbackError;
    }

    const result = await response.json();

    // Local server returns a data URL for the normal map
    if (!result.normal_map_base64) {
      const fallbackError = new Error('AI_NORMAL_MAP_UNAVAILABLE');
      (fallbackError as any).isFallback = true; // Mark as expected fallback
      throw fallbackError;
    }

    return result.normal_map_base64 as string;
  } catch (error) {
    if (error instanceof Error && (error as any).isFallback) {
      throw error;
    }
    const fallbackError = new Error('AI_NORMAL_MAP_UNAVAILABLE');
    (fallbackError as any).isFallback = true;
    throw fallbackError;
  }
}

export interface EnhancementResult {
  enhancedImageUrl: string;
  normalMapUrl?: string;
  depthMapUrl?: string;
  message?: string;
}

/**
 * Enhance image using AI
 * This is a flexible wrapper that can work with multiple AI providers
 */
export async function enhanceImageWithAI(
  imageUrl: string,
  options: AIEnhancementOptions = {}
): Promise<EnhancementResult> {
  if (imageUrl.startsWith('blob:') || imageUrl.startsWith('data:')) {
    return {
      enhancedImageUrl: imageUrl,
      message: 'AI Enhancement: Local uploads use procedural enhancement only.'
    } as EnhancementResult;
  }
  const {
    provider = 'replicate', // Default to Replicate for easy access
    enhanceType = 'upscale',
    strength = 0.7,
  } = options;

  try {
    // Use Next.js API route to handle AI enhancement
    const response = await fetch('/api/ai-enhance', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageUrl,
        provider,
        enhanceType,
        strength,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'AI enhancement failed' }));
      return {
        enhancedImageUrl: imageUrl,
        message: error.error || 'AI Enhancement: Replicate API token not configured. Using original image.'
      } as EnhancementResult;
    }

    const result = await response.json();
    return result;
  } catch (error) {
    return {
      enhancedImageUrl: imageUrl,
      message: 'AI Enhancement: Replicate API token not configured. Using original image.'
    } as EnhancementResult;
  }
}

/**
 * Generate normal map from image (for canvas texture and impasto effects)
 * Creates both canvas weave texture and impasto brushstroke effects
 * 
 * @param imageUrl - Source image URL
 * @param canvasScale - Intensity of canvas weave (0.05-0.3, lower = smoother)
 * @param impastoStrength - Intensity of impasto effect (0.2-1.0, lower = smoother)
 * @param weaveFrequency - Frequency of canvas weave (10-30, lower = smoother/less spiky)
 * @param impastoFrequency - Frequency of impasto pattern (4-12, lower = smoother)
 */
export function generateCanvasNormalMap(
  imageUrl: string,
  canvasScale: number = 0.1, // Reduced from 0.15 for smoother weave
  impastoStrength: number = 0.4,
  weaveFrequency: number = 12, // Reduced from 20 for smoother weave
  impastoFrequency: number = 6 // Reduced from 8 for smoother impasto
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Create normal map data with impasto effects
      const normalData = new Uint8ClampedArray(canvas.width * canvas.height * 4);
      
      // Generate canvas weave + impasto brushstroke pattern
      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const idx = (y * canvas.width + x) * 4;
          
          // Get image luminance for impasto effect (thicker paint = more relief)
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
          
          // Canvas weave pattern - smoother with lower frequency
          const u = x / canvas.width;
          const v = y / canvas.height;
          // Use smoother sine waves with lower frequency
          const weaveX = Math.sin(u * Math.PI * weaveFrequency) * canvasScale;
          const weaveY = Math.sin(v * Math.PI * weaveFrequency) * canvasScale;
          
          // Impasto effect based on image content - smoother with lower frequency
          // Darker/thicker paint areas have more relief
          const impastoX = Math.sin(u * Math.PI * impastoFrequency + luminance * Math.PI * 2) * impastoStrength * (1 - luminance * 0.5);
          const impastoY = Math.sin(v * Math.PI * impastoFrequency + luminance * Math.PI * 2) * impastoStrength * (1 - luminance * 0.5);
          
          // Brushstroke direction (simulate brush marks) - smoother
          const brushAngle = Math.atan2(
            Math.sin(u * Math.PI * (impastoFrequency * 0.75)) * Math.cos(v * Math.PI * (impastoFrequency * 0.75)),
            Math.cos(u * Math.PI * (impastoFrequency * 0.75))
          );
          const brushX = Math.cos(brushAngle) * impastoStrength * 0.3 * luminance;
          const brushY = Math.sin(brushAngle) * impastoStrength * 0.3 * luminance;
          
          // Combine all effects
          const normalX = weaveX + impastoX + brushX;
          const normalY = weaveY + impastoY + brushY;
          
          // Normalize and convert to 0-255 range
          const length = Math.sqrt(normalX * normalX + normalY * normalY + 1);
          const nx = normalX / length;
          const ny = normalY / length;
          const nz = 1 / length;
          
          // Normal map: R=X, G=Y, B=Z (normalized to 0-255)
          normalData[idx] = 128 + nx * 127;     // R (X normal)
          normalData[idx + 1] = 128 + ny * 127; // G (Y normal)
          normalData[idx + 2] = 128 + nz * 127; // B (Z normal)
          normalData[idx + 3] = 255;            // A
        }
      }
      
      const normalImageData = new ImageData(normalData, canvas.width, canvas.height);
      ctx.putImageData(normalImageData, 0, 0);
      
      // Apply blur to smooth out sharp edges (increased blur for smoother texture)
      // This helps reduce spiky artifacts from high-frequency patterns
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      if (tempCtx) {
        tempCtx.filter = 'blur(1px)'; // Increased blur for smoother edges (was 0.5px)
        tempCtx.drawImage(canvas, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(tempCanvas, 0, 0);
      }
      
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          resolve(url);
        } else {
          reject(new Error('Failed to create normal map blob'));
        }
      }, 'image/png');
    };
    
    img.onerror = (error) => {
      console.error('Image load error:', error);
      reject(new Error('Failed to load image for normal map. Using proxy URL...'));
    };
    
    // Use proxy API route to avoid CORS issues
    // Check if it's already a proxy URL or needs proxying
    if (imageUrl.startsWith('/api/proxy-image')) {
      img.src = imageUrl;
    } else if (imageUrl.startsWith('http')) {
      // Use proxy for external URLs
      img.src = `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;
    } else {
      img.src = imageUrl;
    }
  });
}

/**
 * Generate depth map from image (for 3D relief effect)
 */
export function generateDepthMap(
  imageUrl: string,
  intensity: number = 0.3
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Create depth map (grayscale based on image brightness)
      const depthData = new Uint8ClampedArray(data.length);
      
      for (let i = 0; i < data.length; i += 4) {
        // Calculate luminance
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
        
        // Convert to depth (darker = closer, brighter = further)
        const depth = Math.max(0, Math.min(255, 128 + (luminance - 128) * intensity));
        
        depthData[i] = depth;     // R
        depthData[i + 1] = depth; // G
        depthData[i + 2] = depth; // B
        depthData[i + 3] = 255;   // A
      }
      
      const depthImageData = new ImageData(depthData, canvas.width, canvas.height);
      ctx.putImageData(depthImageData, 0, 0);
      
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          resolve(url);
        } else {
          reject(new Error('Failed to create depth map blob'));
        }
      }, 'image/png');
    };
    
    img.onerror = () => reject(new Error('Failed to load image for depth map'));
    img.src = imageUrl;
  });
}

/**
 * Generate displacement map for real 3D impasto relief
 * Creates actual vertex displacement (not just lighting illusion)
 * Darker/thicker paint areas protrude more from the surface
 */
export function generateDisplacementMap(
  imageUrl: string,
  impastoStrength: number = 0.02, // Displacement scale in units (2cm max relief)
  weaveFrequency: number = 6, // Reduced from 20 for smoother weave
  brushstrokeFrequency: number = 4, // Reduced from 8 for smoother brushstrokes
  weaveIntensity: number = 3 // Reduced from 10 for smoother texture
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Create displacement map (grayscale: white = protrude, black = recess)
      // For impasto: darker/thicker paint = more relief (protrudes forward)
      const displacementData = new Uint8ClampedArray(data.length);
      
      for (let i = 0; i < data.length; i += 4) {
        // Calculate luminance
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
        
        // Invert: darker paint (lower luminance) = thicker = more protrusion
        // So we want darker areas to be brighter in the displacement map
        const invertedLuminance = 255 - luminance;
        
        // Add canvas weave pattern for texture
        const x = (i / 4) % canvas.width;
        const y = Math.floor((i / 4) / canvas.width);
        const u = x / canvas.width;
        const v = y / canvas.height;
        
        // Canvas weave adds subtle texture - smoother with lower frequency
        const weave = Math.sin(u * Math.PI * weaveFrequency) * Math.sin(v * Math.PI * weaveFrequency) * weaveIntensity;
        
        // Impasto brushstroke pattern (thicker paint in brushstroke areas) - smoother
        const brushstroke = Math.sin(u * Math.PI * brushstrokeFrequency + invertedLuminance * 0.01) * 
                           Math.sin(v * Math.PI * brushstrokeFrequency + invertedLuminance * 0.01) * 12; // Reduced from 15
        
        // Combine: base displacement from paint thickness + texture patterns
        // Map to 0-255 range where higher = more protrusion
        // Increased multipliers for more dramatic impasto effect
        const displacement = Math.max(0, Math.min(255, 
          invertedLuminance * 0.8 + // Base impasto (darker paint = thicker) - increased from 0.6
          (255 - invertedLuminance) * 0.5 + // Additional relief for dark areas - increased
          weave * 0.5 + // Canvas texture (reduced to not overpower)
          brushstroke * 1.2 * (1 - invertedLuminance / 255) // Brushstroke pattern - increased from 1.0
        ));
        
        displacementData[i] = displacement;     // R (displacement uses red channel)
        displacementData[i + 1] = displacement; // G
        displacementData[i + 2] = displacement; // B
        displacementData[i + 3] = 255;          // A
      }
      
      const displacementImageData = new ImageData(displacementData, canvas.width, canvas.height);
      ctx.putImageData(displacementImageData, 0, 0);
      
      // Apply blur to smooth out sharp edges in displacement map (increased blur)
      // This helps reduce spiky artifacts and creates smoother 3D relief
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      if (tempCtx) {
        tempCtx.filter = 'blur(1.5px)'; // Increased blur for smoother displacement edges (was 0.8px)
        tempCtx.drawImage(canvas, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(tempCanvas, 0, 0);
      }
      
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          resolve(url);
        } else {
          reject(new Error('Failed to create displacement map blob'));
        }
      }, 'image/png');
    };
    
    img.onerror = () => reject(new Error('Failed to load image for displacement map'));
    
    // Use proxy API route to avoid CORS issues
    if (imageUrl.startsWith('/api/proxy-image')) {
      img.src = imageUrl;
    } else if (imageUrl.startsWith('http')) {
      img.src = `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;
    } else {
      img.src = imageUrl;
    }
  });
}

/**
 * Generate roughness map for realistic paint texture
 * Brushstrokes are slightly shinier (less rough) than canvas background
 */
export function generateRoughnessMap(
  imageUrl: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Create roughness map (grayscale: darker = rougher, lighter = shinier)
      const roughnessData = new Uint8ClampedArray(data.length);
      
      for (let i = 0; i < data.length; i += 4) {
        // Calculate luminance
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
        
        // Paint areas (higher luminance) are shinier (less rough)
        // Canvas background is rougher (more rough)
        // Map: 0-255 where 0 = very rough, 255 = very smooth/shiny
        const roughness = Math.max(100, Math.min(200, 150 + (luminance - 128) * 0.3));
        
        roughnessData[i] = roughness;     // R
        roughnessData[i + 1] = roughness; // G
        roughnessData[i + 2] = roughness; // B
        roughnessData[i + 3] = 255;       // A
      }
      
      const roughnessImageData = new ImageData(roughnessData, canvas.width, canvas.height);
      ctx.putImageData(roughnessImageData, 0, 0);
      
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          resolve(url);
        } else {
          reject(new Error('Failed to create roughness map blob'));
        }
      }, 'image/png');
    };
    
    img.onerror = () => reject(new Error('Failed to load image for roughness map'));
    
    // Use proxy API route to avoid CORS issues
    if (imageUrl.startsWith('/api/proxy-image')) {
      img.src = imageUrl;
    } else if (imageUrl.startsWith('http')) {
      img.src = `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;
    } else {
      img.src = imageUrl;
    }
  });
}
