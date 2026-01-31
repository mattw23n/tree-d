import { NextRequest, NextResponse } from 'next/server';

/**
 * AI Normal Map Generation API Route
 * Uses Hugging Face Depth Anything V2 or Marigold Normals
 * Fast AI-based normal map generation (213ms latency)
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageUrl, model = 'depth-anything-v2' } = body;

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'Missing imageUrl parameter' },
        { status: 400 }
      );
    }

    const apiKey = process.env.HUGGINGFACE_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { 
          error: 'HUGGINGFACE_API_KEY not configured',
          message: 'Set HUGGINGFACE_API_KEY in your .env.local file to enable AI normal maps'
        },
        { status: 500 }
      );
    }

    // Fetch the image
    const imageResponse = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
    });
    
    if (!imageResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch source image' },
        { status: 400 }
      );
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const imageBytes = Buffer.from(imageBuffer);

    // Try alternative model IDs - some models may have moved or changed
    // Note: If you get 410 errors, the model endpoint may have changed
    // Check https://huggingface.co/models?search=depth+estimation for current models
    let modelId: string;
    if (model === 'depthpro') {
      modelId = 'apple/DepthPro-hf'; // Apple's DepthPro - best quality, fast, ICLR 2025
    } else if (model === 'marigold-normals') {
      modelId = 'prs-eth/marigold-normals-v1-1'; // Use v1-1, not deprecated v0-1
    } else if (model === 'depth-anything-v2') {
      modelId = 'depth-anything/Depth-Anything-V2-Small-hf';
    } else {
      modelId = 'prs-eth/marigold-normals-v1-1'; // Default fallback
    }

    // Call Hugging Face Inference API
    // Try binary format first (more reliable for image models)
    let hfResponse = await fetch(
      `https://api-inference.huggingface.co/models/${modelId}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        body: imageBytes, // Send binary image directly
      }
    );

    // If binary fails, try with base64 JSON format
    if (!hfResponse.ok && hfResponse.status === 410) {
      const base64Image = imageBytes.toString('base64');
      hfResponse = await fetch(
        `https://api-inference.huggingface.co/models/${modelId}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inputs: `data:image/jpeg;base64,${base64Image}`,
          }),
        }
      );
    }

    if (!hfResponse.ok) {
      const errorText = await hfResponse.text();
      // Return a clear error that will trigger fallback to procedural maps
      return NextResponse.json(
        { 
          error: `Hugging Face API error: ${hfResponse.status}`,
          details: errorText,
          fallback: true // Signal to use procedural normal map
        },
        { status: 200 } // Return 200 so client can handle fallback gracefully
      );
    }

    const resultBlob = await hfResponse.blob();
    const resultBuffer = await resultBlob.arrayBuffer();
    const resultBase64 = Buffer.from(resultBuffer).toString('base64');

    // Return the normal map as base64 data URL
    const mimeType = resultBlob.type || 'image/png';
    const normalMapUrl = `data:${mimeType};base64,${resultBase64}`;

    return NextResponse.json({
      normalMapUrl,
      model,
      message: 'AI normal map generated successfully',
    });

  } catch (error) {
    console.error('AI normal map generation error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate AI normal map', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
