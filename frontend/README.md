# Tree-D Studio Frontendd

## Usage

1. **Landing**: Learn the pipeline and view the featured 3D relief.
2. **Search**: Find public-domain artworks from the Met collection.
3. **View**: Inspect a single artwork in the 3D viewer.
4. **Demo**: Enter a Met Object ID or upload your own image, then export USDZ/GLTF.

## How It Works

### Dimension Parsing

The `dimensionParser.ts` utility extracts centimeter values from Met API dimension strings using regex patterns. It handles various formats:
- Standard: "29 1/8 x 36 1/4 in. (73.7 x 92.1 cm)"
- Metric-only: "73.7 x 92.1 cm"
- Height/Width format: "H. 73.7 cm; W. 92.1 cm"

### Metric Conversion

The parser converts centimeter values to Three.js units using the standard metric conversion:
- **100cm in real life = 1 unit in Three.js**

This ensures that when the GLTF model is imported into AR/VR environments, it will appear at the correct physical size.

### 3D Generation

The `PaintingProcessor` pipeline:
- Builds a high-segment plane for displacement detail
- Applies normal, roughness, and displacement maps
- Uses gallery lighting and orbit controls
- Exports GLTF or USDZ with baked relief

## Project Structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout
│   ├── page.tsx                # Landing page
│   ├── search/page.tsx         # Met search
│   ├── view/[id]/page.tsx      # Viewer page
│   └── demo/page.tsx           # Demo + upload
├── components/
│   ├── PaintingProcessor.tsx   # Orchestrates viewer + export
│   ├── PaintingRenderer.tsx    # Three.js rendering + enhancement
│   ├── PaintingControls.tsx    # UI controls
│   └── PaintingExportControls.tsx
├── lib/
│   ├── metApi.ts               # Met Museum API
│   └── aiEnhancement.ts        # AI + procedural map generation
├── types/
│   └── model-viewer.d.ts       # Web component types
└── utils/
    └── dimensionParser.ts      # Dimension parsing
```

## Error Handling

- **CORS Issues**: Handles texture loading failures with fallback rendering
- **Missing Dimensions**: Uses default dimensions (50cm × 60cm) if parsing fails
- **Missing Images**: Validates that artwork has a primary image before processing
- **Invalid Object IDs**: Provides clear error messages for invalid or missing artwork

## Decision Support

This tool provides "Decision Support" for collectors by allowing them to:
- Visualize artwork at accurate real-world scale
- Export models for AR preview in their own space
- Understand exactly how a painting would fit in their environment

## Built For

PINUS Hack 2026

## License

MIT
