import { NextRequest, NextResponse } from 'next/server';

/**
 * AI Enhancement API Route
 * Handles AI-powered texture enhancement using various providers
 * 
 * Supports:
 * - OpenAI DALL-E (image enhancement)
 * - Stability AI (texture generation)
 * - Replicate (various models)
 * - Hunyuan/Tencent (if API available)
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageUrl, provider = 'replicate', enhanceType = 'upscale', strength = 0.7 } = body;

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'Missing imageUrl parameter' },
        { status: 400 }
      );
    }

    // Fetch the original image (use proxy if it's a Met Museum URL)
    let fetchUrl = imageUrl;
    if (imageUrl.startsWith('https://images.metmuseum.org')) {
      // For Met Museum images, we need to fetch them server-side
      fetchUrl = imageUrl;
    }
    
    const imageResponse = await fetch(fetchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
    });
    
    if (!imageResponse.ok) {
      return NextResponse.json(
        { error: `Failed to fetch source image: ${imageResponse.status} ${imageResponse.statusText}` },
        { status: 400 }
      );
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString('base64');
    const mimeType = imageResponse.headers.get('content-type') || 'image/jpeg';

    // Try to enhance with AI if API keys are available
    // Otherwise, gracefully return the original image
    let enhancedImageUrl = imageUrl;
    let enhancementMessage = null;
    
    try {
      switch (provider) {
        case 'openai':
          if (process.env.OPENAI_API_KEY) {
            enhancedImageUrl = await enhanceWithOpenAI(base64Image, enhanceType);
          } else {
            enhancementMessage = 'OpenAI API key not configured. Using original image.';
          }
          break;
        case 'stability':
          if (process.env.STABILITY_API_KEY) {
            // enhancedImageUrl = await enhanceWithStabilityAI(base64Image, enhanceType);
            enhancementMessage = 'Stability AI integration not yet implemented. Using original image.';
          } else {
            enhancementMessage = 'Stability API key not configured. Using original image.';
          }
          break;
        case 'hunyuan':
          if (process.env.HUNYUAN_API_KEY && process.env.HUNYUAN_SECRET) {
            // enhancedImageUrl = await enhanceWithHunyuan(base64Image, enhanceType);
            enhancementMessage = 'Hunyuan integration not yet implemented. Using original image.';
          } else {
            enhancementMessage = 'Hunyuan API credentials not configured. Using original image.';
          }
          break;
        case 'replicate':
          if (process.env.REPLICATE_API_TOKEN) {
            enhancedImageUrl = await enhanceWithReplicate(base64Image, enhanceType);
          } else {
            enhancementMessage = 'Replicate API token not configured. Using original image. Normal maps still work!';
          }
          break;
        case 'huggingface':
          if (process.env.HUGGINGFACE_API_KEY) {
            // Hugging Face is handled client-side for normal maps
            enhancementMessage = 'Hugging Face normal map generation available client-side.';
          } else {
            enhancementMessage = 'Hugging Face API key not configured. Using procedural normal maps.';
          }
          break;
        default:
          enhancementMessage = `Unknown provider: ${provider}. Using original image.`;
      }
    } catch (enhanceError) {
      console.error('AI enhancement error:', enhanceError);
      // Return original image if enhancement fails
      enhancementMessage = `AI enhancement failed: ${enhanceError instanceof Error ? enhanceError.message : 'Unknown error'}. Using original image.`;
    }

    return NextResponse.json({
      enhancedImageUrl,
      message: enhancementMessage,
      originalImageUrl: imageUrl,
      provider,
      enhanceType,
    });

  } catch (error) {
    console.error('AI enhancement error:', error);
    return NextResponse.json(
      { error: 'Failed to enhance image', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Enhance with Replicate API - BEST FOR ART/PAINTINGS
 * Uses Real-ESRGAN which is excellent for preserving artwork authenticity
 */
async function enhanceWithReplicate(
  base64Image: string,
  enhanceType: string
): Promise<string> {
  const apiToken = process.env.REPLICATE_API_TOKEN;
  
  if (!apiToken) {
    throw new Error('REPLICATE_API_TOKEN not set');
  }

  // Best models for art/paintings:
  // - Real-ESRGAN: Preserves artwork, excellent upscaling
  // - xinntao/realesrgan: Specialized for artwork restoration
  const model = enhanceType === 'upscale' 
    ? 'nightmareai/real-esrgan:42fed1c4974146d4d2414e2be2c5277c7f85aacc' // Best for paintings
    : 'xinntao/realesrgan:4b0d0c5b'; // Art restoration model

  const response = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      version: model,
      input: {
        image: `data:image/jpeg;base64,${base64Image}`,
        scale: 2, // 2x upscaling (can go up to 4x)
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Replicate API error: ${error}`);
  }

  const prediction = await response.json();
  
  // Poll for completion (Replicate is async)
  let result = prediction;
  while (result.status === 'starting' || result.status === 'processing') {
    await new Promise(resolve => setTimeout(resolve, 1000));
    const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${result.id}`, {
      headers: {
        'Authorization': `Token ${apiToken}`,
      },
    });
    result = await statusResponse.json();
  }

  if (result.status === 'succeeded' && result.output) {
    return Array.isArray(result.output) ? result.output[0] : result.output;
  }

  throw new Error('Replicate processing failed');
}

/**
 * Example: Enhance with OpenAI
 */
async function enhanceWithOpenAI(
  base64Image: string,
  enhanceType: string
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not set');
  }

  // Use OpenAI's image editing or DALL-E API
  const response = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      image: base64Image,
      prompt: enhanceType === 'upscale' 
        ? 'Enhance and upscale this painting image with improved detail and clarity'
        : 'Add realistic canvas texture and depth to this painting',
      n: 1,
      size: '1024x1024',
    }),
  });

  if (!response.ok) {
    throw new Error('OpenAI API error');
  }

  const data = await response.json();
  return data.data[0].url;
}
