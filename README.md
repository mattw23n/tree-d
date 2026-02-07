# Tree-D Studio: AI-Enhanced 2D to 3D Painting Reliefs

## Live Demo

Experience the application live: [https://tree-d-two.vercel.app/](https://tree-d-two.vercel.app/)

## Problem Statement (The Scalar Gap)

Collectors often struggle to accurately judge the physical size and presence of artwork when viewing it online. Tree-D Studio addresses this "Scalar Gap" by converting 2D paintings into real-world scaled, depth-aware 3D reliefs, bridging the sensory gap between digital images and physical presence.

## Description

Tree-D Studio is a cutting-edge web application that transforms traditional 2D paintings into immersive 3D reliefs. Utilizing a FastAPI backend powered by the **Marigold depth estimation model** (from Hugging Face), it generates high-quality normal, displacement, and roughness maps. This process captures intricate details like impasto and defining textures, making it particularly effective for oil paintings. The resulting 3D models can be interactively viewed and exported in GLTF or USDZ formats for AR/VR integration.

In cases where the Marigold backend server is unavailable, the application gracefully falls back to a **TypeScript-based procedural method**. While this fallback provides a rough surface normal estimation, it allows for continuous operation, albeit with less fidelity compared to the AI-driven approach.

### The 2D to 3D Pipeline:
1.  **2D Painting Input**: The process begins with a 2D image (either from the Met Museum API or user upload).
2.  **Surface Normal Generation**: The Marigold model (or fallback) estimates the surface normals, defining the orientation of each pixel in 3D space.
3.  **Roughness Calculation**: Luminosity values for each pixel are analyzed to determine surface roughness.
4.  **Displacement Manufacturing**: Individual pixels are then "moved" based on normal and roughness data to create a tactile 3D relief.
5.  **3D Object Output**: A Three.js 3D object is generated, ready for interactive viewing and export.

## Features

*   **Intuitive User Interface**: Landing, Search, View, and Demo pages with a museum-inspired aesthetic.
*   **Met Museum API Integration**: Explore and transform public-domain artworks from the Metropolitan Museum of Art.
*   **Custom Image Uploads**: Transform your own 2D images with local-only processing.
*   **AI Normal Map Generation**: Leverage the Marigold model for high-fidelity depth perception, with a procedural fallback.
*   **Tactile 3D Relief**: Dynamic Displacement and Roughness Maps create a realistic, textured surface.
*   **Accurate 3D Scaling**: Models are scaled precisely (100cm = 1 Three.js unit) for real-world AR/VR placement.
*   **Universal 3D Export**: Export models in GLTF and USDZ (for iOS AR Quick Look) formats.
*   **Decision Support**: Visualize artwork at accurate scale and preview in AR to understand fit in your environment.

## Tech Stack

### Frontend
*   **Next.js 14** (App Router)
*   **TypeScript**
*   **Three.js** (3D rendering library)
*   **Tailwind CSS** (Styling)
*   **GLTFExporter** (3D model export)

### Backend
*   **FastAPI** (Python web framework)
*   **Python 3.11+**
*   **Hugging Face `prs-eth/marigold-normals-v1-1`** (AI model for normal map generation)
*   **Uvicorn** (ASGI server)

## Getting Started

### Prerequisites

*   [Node.js](https://nodejs.org/en/) 18+ and `npm` (for frontend)
*   [Python](https://www.python.org/downloads/) 3.11+ and `pip` (for backend)

### Installation

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/mattw23n/tree-d
    cd tree-d
    ```

2.  **Frontend Setup:**

    ```bash
    cd frontend
    npm install
    cd ..
    ```

3.  **Backend Setup:**

    ```bash
    cd backend
    python -m venv .venv
    # On Windows:
    .\.venv\Scripts\activate
    # On macOS/Linux:
    # source .venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt
    cd ..
    ```

### Running the Services

1.  **Start the Backend Server (Marigold):**

    ```bash
    cd backend
    # Activate virtual environment (Windows):
    .\.venv\Scripts\activate
    # Activate virtual environment (macOS/Linux):
    # source .venv/bin/activate
    uvicorn marigold_server:app --host 127.0.0.1 --port 8000
    cd ..
    ```
    *The backend server will lazily load the AI model weights on its first request.* 

2.  **Start the Frontend Development Server:**

    ```bash
    cd frontend
    npm run dev
    cd ..
    ```

3.  **Open in Browser:**

    Navigate to [http://localhost:3000](http://localhost:3000) in your web browser.

## Built For

PINUS Hack 2026 Track 4

## License

MIT
