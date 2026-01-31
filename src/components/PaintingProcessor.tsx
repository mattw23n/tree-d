'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ParsedDimensions } from '@/utils/dimensionParser';
import { 
  enhanceImageWithAI, 
  generateCanvasNormalMap, 
  generateDepthMap,
  generateAINormalMap,
  generateRoughnessMap,
  generateDisplacementMap
} from '@/lib/aiEnhancement';

interface PaintingProcessorProps {
  imageUrl: string;
  dimensions: ParsedDimensions;
  title: string;
}

export default function PaintingProcessor({
  imageUrl,
  dimensions,
  title,
}: PaintingProcessorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const wallRef = useRef<THREE.Mesh | null>(null);
  const paintingGroupRef = useRef<THREE.Group | null>(null);
  const frameElementsRef = useRef<THREE.Mesh[]>([]);
  const pointLightRef = useRef<THREE.PointLight | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [showWall, setShowWall] = useState(true);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhancedTexture, setEnhancedTexture] = useState<THREE.Texture | null>(null);
  const [normalMap, setNormalMap] = useState<THREE.Texture | null>(null);
  const [roughnessMap, setRoughnessMap] = useState<THREE.Texture | null>(null);
  const [displacementMap, setDisplacementMap] = useState<THREE.Texture | null>(null);
  const [showFrame, setShowFrame] = useState(true);
  const [enhancementStatus, setEnhancementStatus] = useState<{
    normalMap: boolean;
    aiEnhanced: boolean;
    message?: string;
  }>({ normalMap: false, aiEnhanced: false });

  useEffect(() => {
    if (!canvasRef.current) return;

    // Initialize scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(isDarkMode ? 0x000000 : 0xffffff); // Black or white background
    sceneRef.current = scene;

    // Initialize camera
    const camera = new THREE.PerspectiveCamera(
      75,
      canvasRef.current.clientWidth / canvasRef.current.clientHeight,
      0.01,
      1000
    );
    camera.position.set(0, 0, 1.5);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Initialize WebGL renderer
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
    });
    renderer.setSize(canvasRef.current.clientWidth, canvasRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    rendererRef.current = renderer;

    // Initialize OrbitControls for interaction
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = true;
    controls.enablePan = true;
    controlsRef.current = controls;

    // Add lights - gallery-style lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    // Main gallery light from front-top
    const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
    mainLight.position.set(0, 2, 3);
    mainLight.castShadow = true;
    scene.add(mainLight);

    // Fill light from the side
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-2, 0, 2);
    scene.add(fillLight);

    // Rim light for depth
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.2);
    rimLight.position.set(0, -1, -2);
    scene.add(rimLight);

    // Interactive point light that follows mouse - CRITICAL for impasto visibility
    // This "raking" light casts shadows in paint ridges, making texture pop
    const pointLight = new THREE.PointLight(0xffffff, 1.5, 10);
    pointLight.position.set(2, 2, 3); // Start position (slightly to the side for raking effect)
    pointLight.castShadow = true;
    scene.add(pointLight);
    pointLightRef.current = pointLight;

    // Mouse tracking for interactive lighting (raking light effect)
    const handleMouseMove = (event: MouseEvent) => {
      if (!canvasRef.current || !pointLightRef.current) return;
      
      const rect = canvasRef.current.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1; // -1 to 1
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1; // -1 to 1
      
      // Map mouse position to 3D space (raking light across surface)
      // Keep light at a good distance but move it based on mouse
      const lightDistance = 3;
      pointLightRef.current.position.set(
        x * lightDistance,
        y * lightDistance + 1, // Offset upward
        lightDistance
      );
    };

    if (canvasRef.current) {
      canvasRef.current.addEventListener('mousemove', handleMouseMove);
    }

    // Create wall if showWall is true
    const createWall = (width: number, height: number) => {
      if (!showWall) return null;
      
      // Wall material - subtle texture
      const wallMaterial = new THREE.MeshStandardMaterial({
        color: isDarkMode ? 0x2a2a2a : 0xf5f5f5, // Dark gray or light gray wall
        roughness: 0.9,
        metalness: 0.0,
      });
      
      // Create a large wall plane behind the painting
      const wallSize = Math.max(width, height) * 3; // Wall is 3x larger than painting
      const wallGeometry = new THREE.PlaneGeometry(wallSize, wallSize);
      const wall = new THREE.Mesh(wallGeometry, wallMaterial);
      
      // Position wall behind the painting - flush against the back of the frame
      // Frame depth is 0.01, stretcher bars are at -0.005 (center), so wall should be slightly behind
      wall.position.set(0, 0, -0.006); // Flush against the back of the frame
      wall.rotation.x = 0;
      wall.rotation.y = 0;
      wall.rotation.z = 0;
      
      return wall;
    };
    const addDimensionLabels = (
      scene: THREE.Scene,
      width: number,
      height: number,
      depth: number
    ) => {
      // Clear existing labels
      labelRefs.current.forEach((label) => {
        scene.remove(label);
        label.element.remove();
      });
      labelRefs.current = [];

      // Clear existing lines
      lineRefs.current.forEach((line) => {
        scene.remove(line);
        line.geometry.dispose();
        if (line.material instanceof THREE.Material) {
          line.material.dispose();
        }
      });
      lineRefs.current = [];

      // Convert back to cm for display (multiply by 100)
      const widthCm = width * 100;
      const heightCm = height * 100;
      const depthCm = depth * 100;

      // Create label elements
      const createLabel = (text: string, className: string = '') => {
        const div = document.createElement('div');
        div.className = `dimension-label ${className}`;
        div.textContent = text;
        div.style.color = '#1f2937';
        div.style.fontSize = '14px';
        div.style.fontWeight = '600';
        div.style.fontFamily = 'monospace';
        div.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
        div.style.padding = '4px 8px';
        div.style.borderRadius = '4px';
        div.style.border = '2px solid #3b82f6';
        div.style.pointerEvents = 'none';
        div.style.whiteSpace = 'nowrap';
        return new CSS2DObject(div);
      };

      // Width label (top edge)
      const widthLabel = createLabel(`W: ${widthCm.toFixed(1)} cm`, 'width-label');
      widthLabel.position.set(0, height / 2 + 0.05, 0);
      scene.add(widthLabel);
      labelRefs.current.push(widthLabel);

      // Height label (right edge)
      const heightLabel = createLabel(`H: ${heightCm.toFixed(1)} cm`, 'height-label');
      heightLabel.position.set(width / 2 + 0.05, 0, 0);
      scene.add(heightLabel);
      labelRefs.current.push(heightLabel);

      // Depth label (front edge, bottom)
      if (depthCm > 0.1) {
        const depthLabel = createLabel(`D: ${depthCm.toFixed(2)} cm`, 'depth-label');
        depthLabel.position.set(width / 2 + 0.05, -height / 2 - 0.05, depth / 2);
        scene.add(depthLabel);
        labelRefs.current.push(depthLabel);
      }

      // Add dimension lines (optional visual aid)
      const lineMaterial = new THREE.LineBasicMaterial({ color: 0x3b82f6, linewidth: 2 });
      
      // Width indicator line (top)
      const widthLineGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-width / 2, height / 2 + 0.02, 0),
        new THREE.Vector3(width / 2, height / 2 + 0.02, 0),
      ]);
      const widthLine = new THREE.Line(widthLineGeometry, lineMaterial);
      scene.add(widthLine);

      // Height indicator line (right)
      const heightLineGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(width / 2 + 0.02, -height / 2, 0),
        new THREE.Vector3(width / 2 + 0.02, height / 2, 0),
      ]);
      const heightLine = new THREE.Line(heightLineGeometry, lineMaterial);
      scene.add(heightLine);
    };

    // Helper function to create painting with optional frame
    const createPaintingWithFrame = (
      texture: THREE.Texture | null,
      width: number,
      height: number,
      canvasDepth: number,
      normalMapTexture?: THREE.Texture | null,
      roughnessMapTexture?: THREE.Texture | null,
      displacementMapTexture?: THREE.Texture | null,
      includeFrame: boolean = true
    ): { canvasMesh: THREE.Mesh; paintingGroup: THREE.Group } => {
      const frameWidth = 0.02; // Frame width in units (2cm)
      const frameDepth = 0.01; // Frame depth (1cm)
      
      // Create canvas geometry with high segment count for displacement support
      // Increased segments (256x256) for better displacement detail and smoother impasto
      // More segments = smoother displacement curves = more visible relief
      const canvasGeometry = new THREE.PlaneGeometry(
        width - frameWidth * 2,
        height - frameWidth * 2,
        256, // widthSegments - VERY high density for smooth displacement
        256  // heightSegments - VERY high density for smooth displacement
      );
      
      // Create canvas material with impasto support
      // Includes normal map, roughness map, displacement map, and optimized settings for paint texture
      const canvasMaterial = new THREE.MeshStandardMaterial({
        map: texture,
        color: texture ? undefined : 0xcccccc,
        side: THREE.FrontSide, // Only render texture on front side, not back
        roughness: 0.5, // Reduced for more realistic paint (not perfectly matte)
        roughnessMap: roughnessMapTexture || undefined, // Brushstrokes are slightly shinier
        metalness: 0.0,
        normalMap: normalMapTexture || undefined,
        normalScale: normalMapTexture ? new THREE.Vector2(2.0, 2.0) : undefined, // Exaggerated for visible impasto
        // Displacement map for REAL 3D relief (actual vertex displacement)
        displacementMap: displacementMapTexture || undefined,
        displacementScale: displacementMapTexture ? 0.05 : 0, // 5cm max relief - MUCH more visible from side!
        displacementBias: displacementMapTexture ? -0.025 : 0, // Center displacement around zero
      });

      // Create canvas mesh
      // Position canvas - if no frame, center it; if frame, position at front
      const canvasMesh = new THREE.Mesh(canvasGeometry, canvasMaterial);
      canvasMesh.position.set(0, 0, includeFrame ? 0.002 : 0); // At front if framed, centered if not
      
      // Create stretcher bars (wooden frame behind canvas)
      const stretcherMaterial = new THREE.MeshStandardMaterial({
        color: 0x8b7355, // Wood color
        roughness: 0.7,
        metalness: 0.1,
      });
      
      // Top stretcher bar
      const topBar = new THREE.Mesh(
        new THREE.BoxGeometry(width, frameWidth, frameDepth),
        stretcherMaterial
      );
      topBar.position.set(0, height / 2 - frameWidth / 2, -frameDepth / 2);
      
      // Bottom stretcher bar
      const bottomBar = new THREE.Mesh(
        new THREE.BoxGeometry(width, frameWidth, frameDepth),
        stretcherMaterial
      );
      bottomBar.position.set(0, -height / 2 + frameWidth / 2, -frameDepth / 2);
      
      // Left stretcher bar
      const leftBar = new THREE.Mesh(
        new THREE.BoxGeometry(frameWidth, height - frameWidth * 2, frameDepth),
        stretcherMaterial
      );
      leftBar.position.set(-width / 2 + frameWidth / 2, 0, -frameDepth / 2);
      
      // Right stretcher bar
      const rightBar = new THREE.Mesh(
        new THREE.BoxGeometry(frameWidth, height - frameWidth * 2, frameDepth),
        stretcherMaterial
      );
      rightBar.position.set(width / 2 - frameWidth / 2, 0, -frameDepth / 2);
      
      // Create decorative frame (outer frame)
      const frameMaterial = new THREE.MeshStandardMaterial({
        color: 0x4a3728, // Dark wood/bronze frame color
        roughness: 0.4,
        metalness: 0.3,
      });
      
      // Frame outer dimensions
      const frameThickness = 0.005; // 0.5cm frame thickness
      const frameOuterWidth = width + frameThickness * 2;
      const frameOuterHeight = height + frameThickness * 2;
      
      // Top frame piece
      const topFrame = new THREE.Mesh(
        new THREE.BoxGeometry(frameOuterWidth, frameThickness, frameDepth + 0.002),
        frameMaterial
      );
      topFrame.position.set(0, height / 2 + frameThickness / 2, 0);
      
      // Bottom frame piece
      const bottomFrame = new THREE.Mesh(
        new THREE.BoxGeometry(frameOuterWidth, frameThickness, frameDepth + 0.002),
        frameMaterial
      );
      bottomFrame.position.set(0, -height / 2 - frameThickness / 2, 0);
      
      // Left frame piece
      const leftFrame = new THREE.Mesh(
        new THREE.BoxGeometry(frameThickness, frameOuterHeight, frameDepth + 0.002),
        frameMaterial
      );
      leftFrame.position.set(-width / 2 - frameThickness / 2, 0, 0);
      
      // Right frame piece
      const rightFrame = new THREE.Mesh(
        new THREE.BoxGeometry(frameThickness, frameOuterHeight, frameDepth + 0.002),
        frameMaterial
      );
      rightFrame.position.set(width / 2 + frameThickness / 2, 0, 0);
      
      // Create a group to hold all painting elements
      const paintingGroup = new THREE.Group();
      paintingGroup.add(canvasMesh);
      
      // Store frame elements for toggling
      const frameElements = [
        topBar, bottomBar, leftBar, rightBar,
        topFrame, bottomFrame, leftFrame, rightFrame
      ];
      
      // Only add frame elements if includeFrame is true
      if (includeFrame) {
        frameElements.forEach(element => paintingGroup.add(element));
      }
      
      return { canvasMesh, paintingGroup, frameElements };
    };

    // Load texture using proxy API route to avoid CORS issues
    const textureLoader = new THREE.TextureLoader();
    
    // Use Next.js API route to proxy the image
    const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;
    
    textureLoader.setCrossOrigin('anonymous');
    
    textureLoader.load(
      proxyUrl,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        
        // Use enhanced texture if available, otherwise use original
        const finalTexture = enhancedTexture || texture;
        
        // Create painting with frame
        const width = dimensions.height;  // Swap: use height for x-axis (horizontal)
        const height = dimensions.width;   // Swap: use width for y-axis (vertical)
        const canvasDepth = dimensions.depth ?? 0.0003;
        
        const { canvasMesh, paintingGroup, frameElements } = createPaintingWithFrame(
          finalTexture,
          width,
          height,
          canvasDepth,
          normalMap,
          roughnessMap || null,
          displacementMap || null,
          showFrame
        );
        
        scene.add(paintingGroup);
        meshRef.current = canvasMesh;
        paintingGroupRef.current = paintingGroup;
        frameElementsRef.current = frameElements;

        // Create and add wall if enabled
        if (showWall) {
          const wall = createWall(width, height);
          if (wall) {
            scene.add(wall);
            wallRef.current = wall;
          }
        }

        // Center camera on the painting group
        const box = new THREE.Box3().setFromObject(paintingGroup);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const distance = showWall ? maxDim * 2.2 : maxDim * 1.8; // Further back if wall is shown
        
        camera.position.set(center.x, center.y, distance);
        camera.lookAt(center);

        setIsLoading(false);
        setError(null);
        setEnhancementStatus({ normalMap: false, aiEnhanced: false }); // Reset when new painting loads
        setDisplacementMap(null); // Clear displacement map for new painting
      },
      undefined,
      (err) => {
        console.error('Error loading texture:', err);
        setError('Failed to load image. Trying direct load...');
        
        // Fallback: try direct load with crossOrigin
        textureLoader.setCrossOrigin('anonymous');
        textureLoader.load(
          imageUrl,
          (texture) => {
            texture.colorSpace = THREE.SRGBColorSpace;
            const width = dimensions.height;
            const height = dimensions.width;
            const canvasDepth = dimensions.depth ?? 0.0003;
            
            const finalTexture = enhancedTexture || texture;
            const { canvasMesh, paintingGroup, frameElements } = createPaintingWithFrame(
              finalTexture,
              width,
              height,
              canvasDepth,
              normalMap,
              roughnessMap || null,
              displacementMap || null,
              showFrame
            );
            
            scene.add(paintingGroup);
            meshRef.current = canvasMesh;
            paintingGroupRef.current = paintingGroup;
            frameElementsRef.current = frameElements;
            
            // Create and add wall if enabled
            if (showWall) {
              const wall = createWall(width, height);
              if (wall) {
                scene.add(wall);
                wallRef.current = wall;
              }
            }
            
            const box = new THREE.Box3().setFromObject(paintingGroup);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const distance = showWall ? maxDim * 2.2 : maxDim * 1.8;
            camera.position.set(center.x, center.y, distance);
            camera.lookAt(center);
            
            setIsLoading(false);
            setError(null);
          },
          undefined,
          () => {
            // Final fallback: create mesh without texture
            setIsLoading(false);
            setError('Image unavailable. Showing 3D model without texture.');
            
            const width = dimensions.height;
            const height = dimensions.width;
            const canvasDepth = dimensions.depth ?? 0.0003;
            
            const { canvasMesh, paintingGroup, frameElements } = createPaintingWithFrame(
              null, // No texture for fallback
              width,
              height,
              canvasDepth,
              normalMap,
              roughnessMap || null,
              displacementMap || null,
              showFrame
            );
            
            scene.add(paintingGroup);
            meshRef.current = canvasMesh;
            paintingGroupRef.current = paintingGroup;
            frameElementsRef.current = frameElements;
            
            // Create and add wall if enabled
            if (showWall) {
              const wall = createWall(width, height);
              if (wall) {
                scene.add(wall);
                wallRef.current = wall;
              }
            }
            
            const box = new THREE.Box3().setFromObject(paintingGroup);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const distance = maxDim * 1.8;
            camera.position.set(center.x, center.y, distance);
            camera.lookAt(center);
          }
        );
      }
    );

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      if (controls) {
        controls.update(); // Update controls for damping
      }
      if (renderer && scene && camera) {
        renderer.render(scene, camera);
      }
    };
    animate();

    // Handle resize
    const handleResize = () => {
      if (!canvasRef.current || !camera || !renderer) return;
      
      const width = canvasRef.current.clientWidth;
      const height = canvasRef.current.clientHeight;
      
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (canvasRef.current && handleMouseMove) {
        canvasRef.current.removeEventListener('mousemove', handleMouseMove);
      }
      
      if (controls) {
        controls.dispose();
      }
      if (renderer) {
        renderer.dispose();
      }
      if (wallRef.current) {
        wallRef.current.geometry.dispose();
        if (wallRef.current.material instanceof THREE.Material) {
          wallRef.current.material.dispose();
        }
      }
      if (meshRef.current) {
        meshRef.current.geometry.dispose();
        if (Array.isArray(meshRef.current.material)) {
          meshRef.current.material.forEach((mat) => {
            if (mat.map) mat.map.dispose();
            mat.dispose();
          });
        } else {
          if (meshRef.current.material.map) {
            meshRef.current.material.map.dispose();
          }
          meshRef.current.material.dispose();
        }
      }
      // Dispose textures in scene
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          if (object.material instanceof THREE.MeshStandardMaterial && object.material.map) {
            object.material.map.dispose();
          }
        }
      });
    };
  }, [imageUrl, dimensions, isDarkMode, showWall, showFrame]);

  // Update background and wall when toggles change
  useEffect(() => {
    if (!sceneRef.current) return;
    
    // Update background color
    sceneRef.current.background = new THREE.Color(isDarkMode ? 0x000000 : 0xffffff);
    
    // Update wall if it exists
    if (wallRef.current) {
      const wallMaterial = wallRef.current.material as THREE.MeshStandardMaterial;
      if (wallMaterial) {
        wallMaterial.color.setHex(isDarkMode ? 0x2a2a2a : 0xf5f5f5);
      }
      
      // Remove wall if showWall is false
      if (!showWall && wallRef.current.parent) {
        wallRef.current.parent.remove(wallRef.current);
        wallRef.current.geometry.dispose();
        wallRef.current.material.dispose();
        wallRef.current = null;
      }
    } else if (showWall && meshRef.current) {
      // Create wall if it doesn't exist and showWall is true
      const width = dimensions.height;
      const height = dimensions.width;
      const wallSize = Math.max(width, height) * 3;
      const wallGeometry = new THREE.PlaneGeometry(wallSize, wallSize);
      const wallMaterial = new THREE.MeshStandardMaterial({
        color: isDarkMode ? 0x2a2a2a : 0xf5f5f5,
        roughness: 0.9,
        metalness: 0.0,
      });
      const wall = new THREE.Mesh(wallGeometry, wallMaterial);
      wall.position.set(0, 0, -0.006);
      sceneRef.current.add(wall);
      wallRef.current = wall;
    }
  }, [isDarkMode, showWall, dimensions]);

  // Update frame visibility when toggle changes
  useEffect(() => {
    if (!paintingGroupRef.current || frameElementsRef.current.length === 0) return;
    
    frameElementsRef.current.forEach((frameElement) => {
      if (showFrame) {
        // Add frame element if not already in group
        if (!paintingGroupRef.current!.children.includes(frameElement)) {
          paintingGroupRef.current!.add(frameElement);
        }
      } else {
        // Remove frame element
        if (paintingGroupRef.current!.children.includes(frameElement)) {
          paintingGroupRef.current!.remove(frameElement);
        }
      }
    });
  }, [showFrame]);

  const handleAIEnhance = async () => {
    if (!imageUrl) {
      alert('No image to enhance');
      return;
    }

    setIsEnhancing(true);
    setError(null);
    setEnhancementStatus({ normalMap: false, aiEnhanced: false }); // Reset status
    setDisplacementMap(null); // Clear displacement map

    try {
      // Use proxy URL for normal map generation to avoid CORS
      const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;
      const textureLoader = new THREE.TextureLoader();
      
      let normalMapUrl: string;
      let useAI = false;
      
      // Try AI-generated normal map first (if API key available)
      // Falls back gracefully to procedural maps if API unavailable
      try {
        // Try DepthPro first (best quality), fallback to depth-anything-v2 if unavailable
        normalMapUrl = await generateAINormalMap(imageUrl, 'marigold-normals');
        useAI = true;
      } catch (aiError) {
        // Gracefully fallback to procedural normal map generation
        // This happens if API key is missing, model unavailable (410), or other API errors
        const errorMessage = aiError instanceof Error ? aiError.message : String(aiError);
        const isExpectedFallback = errorMessage.includes('AI_NORMAL_MAP_UNAVAILABLE') || 
                                   errorMessage.includes('410') ||
                                   (aiError instanceof Error && (aiError as any).isFallback);
        
        if (isExpectedFallback) {
          // Silent fallback - this is expected behavior, not an error
          // Procedural normal maps work great without API setup
        } else {
          // Log unexpected errors
          console.warn('AI normal map generation failed. Using procedural normal map:', errorMessage);
        }
        // Use even smoother parameters: lower canvas scale, lower frequencies for less spiky edges
        normalMapUrl = await generateCanvasNormalMap(proxyUrl, 0.04, 0.2, 4, 2);
      }
      
      // Load normal map texture
      textureLoader.load(normalMapUrl, (normalTexture) => {
        normalTexture.colorSpace = THREE.SRGBColorSpace;
        setNormalMap(normalTexture);
        
        // Generate roughness map for realistic paint texture
        // Brushstrokes are slightly shinier than canvas
        generateRoughnessMap(proxyUrl).then((roughnessUrl) => {
          textureLoader.load(roughnessUrl, (roughnessTexture) => {
            roughnessTexture.colorSpace = THREE.SRGBColorSpace;
            setRoughnessMap(roughnessTexture);
            
            // Update material if mesh exists
            if (meshRef.current && meshRef.current.material instanceof THREE.MeshStandardMaterial) {
              meshRef.current.material.roughnessMap = roughnessTexture;
              meshRef.current.material.needsUpdate = true;
            }
          });
        });
        
        // Generate displacement map for REAL 3D impasto relief
        // This creates actual vertex displacement visible from the side
        // Using even smoother parameters: lower frequencies for less spiky edges
        generateDisplacementMap(proxyUrl, 0.01, 0.5, 2, 1.5).then((displacementUrl) => {
          textureLoader.load(displacementUrl, (displacementTexture) => {
            // Displacement maps should NOT use SRGB color space - they're grayscale data
            displacementTexture.colorSpace = THREE.NoColorSpace; // Important for displacement!
            displacementTexture.wrapS = THREE.RepeatWrapping;
            displacementTexture.wrapT = THREE.RepeatWrapping;
            setDisplacementMap(displacementTexture);
            
            // Update material if mesh exists
            if (meshRef.current && meshRef.current.material instanceof THREE.MeshStandardMaterial) {
              meshRef.current.material.displacementMap = displacementTexture;
              meshRef.current.material.displacementScale = 0.05; // 5cm max relief - MUCH more visible from side!
              meshRef.current.material.displacementBias = -0.025; // Center displacement
              meshRef.current.material.needsUpdate = true;
              
              // Force geometry update to apply displacement
              // Three.js displacement maps work automatically, but we need to recompute normals
              if (meshRef.current.geometry) {
                meshRef.current.geometry.computeVertexNormals();
                meshRef.current.geometry.attributes.position.needsUpdate = true;
              }
              
              // Update enhancement status
              setEnhancementStatus(prev => ({ 
                ...prev, 
                message: '3D impasto relief applied! Rotate to see depth from the side.'
              }));
            }
          });
        }).catch((error) => {
          console.error('Failed to generate displacement map:', error);
          // Continue without displacement - normal map still works
        });
        
        // Update material if mesh exists
        if (meshRef.current && meshRef.current.material instanceof THREE.MeshStandardMaterial) {
          meshRef.current.material.normalMap = normalTexture;
          meshRef.current.material.normalScale = new THREE.Vector2(2.0, 2.0); // Exaggerated for visible impasto
          meshRef.current.material.needsUpdate = true;
        }
        
        setEnhancementStatus(prev => ({ 
          ...prev, 
          normalMap: true,
          message: useAI ? 'AI-generated impasto texture applied!' : 'Procedural impasto texture applied!'
        }));
        
        // Note: Displacement map will be applied separately when it loads
        setIsEnhancing(false);
      }, undefined, (error) => {
        console.error('Failed to load normal map texture:', error);
        setError('Failed to load normal map texture');
        setIsEnhancing(false);
      });

      // Optional: Try AI enhancement (requires API setup)
      // This is wrapped in a try-catch so it doesn't break if API isn't configured
      try {
        const result = await enhanceImageWithAI(imageUrl, {
          provider: 'replicate',
          enhanceType: 'upscale',
          strength: 0.7,
        });
        
        // Check if we got an enhanced image (different from original)
        if (result.enhancedImageUrl && result.enhancedImageUrl !== imageUrl) {
          // Load enhanced texture
          textureLoader.load(result.enhancedImageUrl, (enhancedTexture) => {
            enhancedTexture.colorSpace = THREE.SRGBColorSpace;
            setEnhancedTexture(enhancedTexture);
            
            // Update material if mesh exists
            if (meshRef.current && meshRef.current.material instanceof THREE.MeshStandardMaterial) {
              meshRef.current.material.map = enhancedTexture;
              meshRef.current.material.needsUpdate = true;
            }
            
            setEnhancementStatus(prev => ({ 
              ...prev, 
              aiEnhanced: true,
              message: 'AI texture enhancement applied!' 
            }));
          }, undefined, (error) => {
            console.log('Failed to load enhanced texture, using original:', error);
            setEnhancementStatus(prev => ({ 
              ...prev, 
              aiEnhanced: false,
              message: 'AI enhancement failed, using original texture' 
            }));
          });
        } else if (result.message) {
          // API returned a message (likely API not configured)
          setEnhancementStatus(prev => ({ 
            ...prev, 
            aiEnhanced: false,
            message: result.message || 'AI enhancement not configured' 
          }));
          console.log('AI Enhancement:', result.message);
        }
      } catch (aiError) {
        // This is expected if API isn't configured - normal maps still work!
        console.log('AI enhancement skipped (API not configured or failed):', aiError instanceof Error ? aiError.message : aiError);
        // Don't show error to user - normal map enhancement is the main feature
      }
    } catch (error) {
      console.error('Enhancement error:', error);
      setError('Failed to enhance texture. Normal map generation may still work.');
      setIsEnhancing(false);
    }
  };

  const handleExport = async () => {
    if (!sceneRef.current || !meshRef.current) {
      alert('No 3D model to export');
      return;
    }

    setIsExporting(true);
    try {
      const exporter = new GLTFExporter();
      
      // Export as GLB (binary format)
      exporter.parse(
        sceneRef.current,
        (result) => {
          if (result instanceof ArrayBuffer) {
            const blob = new Blob([result], { type: 'model/gltf-binary' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${title.replace(/[^a-z0-9]/gi, '_')}_3d.glb`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            setIsExporting(false);
          } else {
            // Fallback to JSON format if binary export fails
            const output = JSON.stringify(result, null, 2);
            const blob = new Blob([output], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${title.replace(/[^a-z0-9]/gi, '_')}_3d.gltf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            setIsExporting(false);
          }
        },
        { binary: true }
      );
    } catch (err) {
      console.error('Export error:', err);
      alert('Failed to export GLB file');
      setIsExporting(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col items-center">
      <div className="relative w-full h-[600px] border border-gray-300 rounded-lg overflow-hidden bg-gray-100">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="text-gray-600">Loading 3D model...</div>
          </div>
        )}
        {error && (
          <div className="absolute top-4 left-4 bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-2 rounded z-10">
            {error}
          </div>
        )}
        {enhancementStatus.normalMap && (
          <div className="absolute top-4 right-4 bg-green-100 border border-green-400 text-green-800 px-4 py-2 rounded z-10 shadow-lg">
            <div className="flex items-center gap-2">
              <span>✨</span>
              <div>
                <div className="font-semibold">Canvas Texture Applied</div>
                {enhancementStatus.aiEnhanced && (
                  <div className="text-xs mt-1">AI Enhanced</div>
                )}
              </div>
            </div>
          </div>
        )}
        {enhancementStatus.message && !enhancementStatus.normalMap && (
          <div className="absolute top-4 right-4 bg-blue-100 border border-blue-400 text-blue-800 px-4 py-2 rounded z-10 text-sm">
            {enhancementStatus.message}
          </div>
        )}
        <canvas ref={canvasRef} className="w-full h-full" />
      </div>
      <div className="mt-4 flex flex-col gap-4">
        <div className="flex gap-4 items-center flex-wrap">
          <button
            onClick={handleExport}
            disabled={isLoading || isExporting}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isExporting ? 'Exporting...' : 'Export as GLB'}
          </button>
          
          {/* Dark Mode Toggle */}
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
          >
            {isDarkMode ? (
              <>
                <span>🌙</span>
                <span>Dark Mode</span>
              </>
            ) : (
              <>
                <span>☀️</span>
                <span>Light Mode</span>
              </>
            )}
          </button>
          
          {/* Wall Toggle */}
          <button
            onClick={() => setShowWall(!showWall)}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
              showWall
                ? 'bg-gray-800 text-white hover:bg-gray-700'
                : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
            }`}
          >
            <span>🖼️</span>
            <span>{showWall ? 'Wall View' : 'Gallery View'}</span>
          </button>
          
          {/* AI Enhancement Button */}
          <button
            onClick={handleAIEnhance}
            disabled={isLoading || isEnhancing}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isEnhancing ? (
              <>
                <span className="animate-spin">✨</span>
                <span>Enhancing...</span>
              </>
            ) : (
              <>
                <span>✨</span>
                <span>AI Enhance</span>
              </>
            )}
          </button>
          
          {/* Frame Toggle */}
          <button
            onClick={() => setShowFrame(!showFrame)}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
              showFrame
                ? 'bg-amber-700 text-white hover:bg-amber-800'
                : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
            }`}
          >
            <span>🖼️</span>
            <span>{showFrame ? 'Frame On' : 'Frame Off'}</span>
          </button>
        </div>
        
        <div className="text-sm text-gray-600">
          Dimensions: {dimensions.width.toFixed(3)} × {dimensions.height.toFixed(3)} units
          {dimensions.depth && ` × ${dimensions.depth.toFixed(4)} units`}
          <br />
          <span className="text-xs">
            ({dimensions.originalString})
          </span>
        </div>
      </div>
    </div>
  );
}
