# API-to-3D Pipeline

A web application that converts 2D painting data from the Met Museum API into 1:1 scale 3D GLB models, solving the **Scalar Gap** pain point identified in art collection research.

## Problem Statement

The "Scalar Gap" refers to the challenge collectors face when viewing artwork online: they cannot accurately judge the physical size and presence of paintings. This tool bridges the sensory gap between digital images and physical presence by providing accurate, real-world scaled 3D models.

## Features

- **Met Museum API Integration**: Fetches artwork data directly from the Met Museum Collection API
- **Intelligent Dimension Parsing**: Uses regex to extract centimeter values from Met's dimension strings (e.g., "29 1/8 x 36 1/4 in. (73.7 x 92.1 cm)")
- **Accurate 3D Scaling**: Converts real-world dimensions to Three.js units (100cm = 1 unit) for precise scaling
- **GLB Export**: Allows users to export 3D models as GLB files for use in AR/VR environments
- **Real-time Preview**: Interactive 3D preview with proper lighting and camera controls

## Tech Stack

- **Next.js 14** (App Router)
- **TypeScript**
- **Three.js** (3D rendering)
- **Tailwind CSS** (styling)
- **GLTFExporter** (3D model export)

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd tree-d
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

1. Enter a Met Museum Object ID (find IDs at [metmuseum.org/art/collection](https://www.metmuseum.org/art/collection))
2. Click "Generate & Preview 3D"
3. View the 3D model with accurate real-world scaling
4. Export as GLB for use in AR/VR applications

## How It Works

### Dimension Parsing

The `dimensionParser.ts` utility extracts centimeter values from Met API dimension strings using regex patterns. It handles various formats:
- Standard: "29 1/8 x 36 1/4 in. (73.7 x 92.1 cm)"
- Metric-only: "73.7 x 92.1 cm"
- Height/Width format: "H. 73.7 cm; W. 92.1 cm"

### Metric Conversion

The parser converts centimeter values to Three.js units using the standard metric conversion:
- **100cm in real life = 1 unit in Three.js**

This ensures that when the GLB model is imported into AR/VR environments, it will appear at the correct physical size.

### 3D Generation

The `PaintingProcessor` component:
- Creates a `THREE.BoxGeometry` with parsed width, height, and depth (default 0.03 units for canvas thickness)
- Loads the primary image as a `MeshStandardMaterial` texture
- Uses `THREE.GLTFExporter` to export the mesh as a `.glb` file

## Project Structure

```
src/
├── app/
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Main landing page
│   └── globals.css         # Global styles
├── components/
│   └── PaintingProcessor.tsx  # Three.js 3D component
├── lib/
│   └── metApi.ts           # Met Museum API service
└── utils/
    └── dimensionParser.ts  # Dimension parsing utility
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

PINUS Hack 2026 Track 4

## License

MIT
