'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { fetchMetArtwork } from '@/lib/metApi';
import { parseDimensions } from '@/utils/dimensionParser';
import { generateAINormalMap, generateCanvasNormalMap, generateRoughnessMap, generateDisplacementMap } from '@/lib/aiEnhancement';

interface PaintingData {
  id: string;
  title: string;
  imageUrl: string;
  dimensions: { width: number; height: number; depth?: number };
}

interface Gallery3DProps {
  paintingIds: string[];
}

export default function Gallery3D({ paintingIds }: Gallery3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<PointerLockControls | null>(null);
  
  const [paintings, setPaintings] = useState<PaintingData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [aiEnhanced, setAiEnhanced] = useState(true);
  const [enhancementProgress, setEnhancementProgress] = useState<string>('');
  
  const velocityRef = useRef(new THREE.Vector3());
  const directionRef = useRef(new THREE.Vector3());
  const moveStateRef = useRef({ forward: false, backward: false, left: false, right: false });
  const normalMapsRef = useRef<Map<string, THREE.Texture>>(new Map());
  const displacementMapsRef = useRef<Map<string, THREE.Texture>>(new Map());
  const roughnessMapsRef = useRef<Map<string, THREE.Texture>>(new Map());
  const paintingMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map());

  // Load painting data from Met API
  useEffect(() => {
    const loadPaintings = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const paintingData: PaintingData[] = [];
        
        for (const id of paintingIds) {
          try {
            const data = await fetchMetArtwork(id);
            
            if (data.primaryImage) {
              const dimensions = parseDimensions(data.dimensions);
              
              paintingData.push({
                id,
                title: data.title || 'Untitled',
                imageUrl: data.primaryImage,
                dimensions: {
                  width: dimensions.width || 0.5,
                  height: dimensions.height || 0.7,
                  depth: dimensions.depth || 0.003,
                },
              });
            }
          } catch (err) {
            console.error(`Failed to load painting ${id}:`, err);
          }
        }
        
        if (paintingData.length === 0) {
          setError('No valid paintings could be loaded');
        } else {
          setPaintings(paintingData);
        }
      } catch (err) {
        setError('Failed to load paintings');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadPaintings();
  }, [paintingIds]);

  // Initialize 3D scene
  useEffect(() => {
    if (!containerRef.current || paintings.length === 0) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);
    scene.fog = new THREE.Fog(0x1a1a1a, 1, 20);
    sceneRef.current = scene;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      75,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      100
    );
    camera.position.set(0, 1.6, 5); // Eye level height
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // First-person controls
    const controls = new PointerLockControls(camera, renderer.domElement);
    controlsRef.current = controls;

    controls.addEventListener('lock', () => setIsLocked(true));
    controls.addEventListener('unlock', () => setIsLocked(false));

    // General studio lighting (ambient + directional)
    createStudioLighting(scene);

    // Position paintings on walls (this also creates the room and dedicated spotlights)
    positionPaintings(scene, paintings);

    // Keyboard controls
    const onKeyDown = (event: KeyboardEvent) => {
      switch (event.code) {
        case 'KeyW':
        case 'ArrowUp':
          moveStateRef.current.forward = true;
          break;
        case 'KeyS':
        case 'ArrowDown':
          moveStateRef.current.backward = true;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          moveStateRef.current.left = true;
          break;
        case 'KeyD':
        case 'ArrowRight':
          moveStateRef.current.right = true;
          break;
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      switch (event.code) {
        case 'KeyW':
        case 'ArrowUp':
          moveStateRef.current.forward = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
          moveStateRef.current.backward = false;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          moveStateRef.current.left = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          moveStateRef.current.right = false;
          break;
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    // Animation loop
    const clock = new THREE.Clock();
    let prevTime = performance.now();

    const animate = () => {
      requestAnimationFrame(animate);

      const time = performance.now();
      const delta = (time - prevTime) / 1000;

      if (controlsRef.current?.isLocked) {
        velocityRef.current.x -= velocityRef.current.x * 10.0 * delta;
        velocityRef.current.z -= velocityRef.current.z * 10.0 * delta;

        directionRef.current.z = Number(moveStateRef.current.forward) - Number(moveStateRef.current.backward);
        directionRef.current.x = Number(moveStateRef.current.right) - Number(moveStateRef.current.left);
        directionRef.current.normalize();

        if (moveStateRef.current.forward || moveStateRef.current.backward) {
          velocityRef.current.z -= directionRef.current.z * 20.0 * delta;
        }
        if (moveStateRef.current.left || moveStateRef.current.right) {
          velocityRef.current.x -= directionRef.current.x * 20.0 * delta;
        }

        controlsRef.current.moveRight(-velocityRef.current.x * delta);
        controlsRef.current.moveForward(-velocityRef.current.z * delta);
      }

      prevTime = time;
      renderer.render(scene, camera);
    };

    animate();

    // Handle resize
    const handleResize = () => {
      if (!containerRef.current || !camera || !renderer) return;
      
      camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', handleResize);
      
      if (controlsRef.current) {
        controlsRef.current.disconnect();
      }
      if (renderer) {
        renderer.dispose();
      }
      if (containerRef.current?.contains(renderer.domElement)) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, [paintings]);

  const createGalleryRoom = (scene: THREE.Scene, width: number, depth: number) => {
    // Floor
    const floorGeometry = new THREE.PlaneGeometry(width, depth);
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.8,
      metalness: 0.2,
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Walls
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0xe8e8e8,
      roughness: 0.9,
      metalness: 0.0,
    });

    // Back wall
    const backWall = new THREE.Mesh(
      new THREE.PlaneGeometry(width, 5),
      wallMaterial
    );
    backWall.position.set(0, 2.5, -depth / 2);
    backWall.receiveShadow = true;
    scene.add(backWall);

    // Left wall
    const leftWall = new THREE.Mesh(
      new THREE.PlaneGeometry(depth, 5),
      wallMaterial
    );
    leftWall.position.set(-width / 2, 2.5, 0);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.receiveShadow = true;
    scene.add(leftWall);

    // Right wall
    const rightWall = new THREE.Mesh(
      new THREE.PlaneGeometry(depth, 5),
      wallMaterial
    );
    rightWall.position.set(width / 2, 2.5, 0);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.receiveShadow = true;
    scene.add(rightWall);

    // Ceiling
    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(width, depth),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1.0 })
    );
    ceiling.position.y = 5;
    ceiling.rotation.x = Math.PI / 2;
    scene.add(ceiling);
  };

  const createStudioLighting = (scene: THREE.Scene) => {
    // Ambient light for overall illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
    scene.add(ambientLight);

    // Directional light for general shadows
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.3);
    dirLight.position.set(5, 8, 5);
    dirLight.castShadow = true;
    dirLight.shadow.camera.left = -15;
    dirLight.shadow.camera.right = 15;
    dirLight.shadow.camera.top = 15;
    dirLight.shadow.camera.bottom = -15;
    scene.add(dirLight);
  };

  const positionPaintings = async (scene: THREE.Scene, paintingsData: PaintingData[]) => {
    const textureLoader = new THREE.TextureLoader();
    
    // Calculate optimal gallery size and layout
    const paintingSpacing = 2; // Space between paintings
    const wallMargin = 1.5; // Space from edges
    const paintingsPerWall = Math.ceil(paintingsData.length / 3);
    
    // Determine which walls to use
    let wallsToUse = 1; // Start with back wall only
    if (paintingsData.length > 6) {
      wallsToUse = 3; // Use all three walls
    } else if (paintingsData.length > 3) {
      wallsToUse = 2; // Use back wall and one side wall
    }
    
    // Calculate gallery dimensions based on paintings
    const avgWidth = paintingsData.reduce((sum, p) => sum + p.dimensions.width, 0) / paintingsData.length;
    const galleryWidth = Math.max(12, (avgWidth + paintingSpacing) * Math.min(paintingsData.length, paintingsPerWall) + wallMargin * 2);
    const galleryDepth = wallsToUse === 1 ? 8 : (wallsToUse === 2 ? 12 : 16);
    
    // Create gallery room with calculated dimensions
    createGalleryRoom(scene, galleryWidth, galleryDepth);
    
    // Calculate wall positions based on gallery size
    const wallConfigs = [
      { position: new THREE.Vector3(0, 1.6, -galleryDepth / 2 + 0.1), rotation: 0 }, // Back wall
      { position: new THREE.Vector3(-galleryWidth / 2 + 0.1, 1.6, 0), rotation: Math.PI / 2 }, // Left wall
      { position: new THREE.Vector3(galleryWidth / 2 - 0.1, 1.6, 0), rotation: -Math.PI / 2 }, // Right wall
    ].slice(0, wallsToUse);

    for (let index = 0; index < paintingsData.length; index++) {
      const painting = paintingsData[index];
      const wallIndex = index % wallsToUse;
      const wallConfig = wallConfigs[wallIndex];
      const paintingsOnThisWall = Math.floor(index / wallsToUse);
      const totalOnWall = Math.ceil(paintingsData.length / wallsToUse);
      
      // Calculate offset to center paintings on wall
      const totalWidth = (totalOnWall - 1) * paintingSpacing;
      const startOffset = -totalWidth / 2;
      const offset = startOffset + paintingsOnThisWall * paintingSpacing;

      const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(painting.imageUrl)}`;
      
      setEnhancementProgress(`Loading ${index + 1} of ${paintingsData.length}: ${painting.title}`);
      
      try {
        // Load base texture
        const texture = await new Promise<THREE.Texture>((resolve, reject) => {
          textureLoader.load(proxyUrl, resolve, undefined, reject);
        });
        texture.colorSpace = THREE.SRGBColorSpace;
        
        // Generate AI enhancements
        let normalTexture: THREE.Texture | null = null;
        let roughnessTexture: THREE.Texture | null = null;
        let displacementTexture: THREE.Texture | null = null;
        
        try {
          // Generate normal map
          let normalMapUrl: string;
          try {
            normalMapUrl = await generateAINormalMap(painting.imageUrl, 'marigold-normals');
          } catch (aiError) {
            normalMapUrl = await generateCanvasNormalMap(proxyUrl, 0.04, 0.2, 4, 2);
          }
          
          normalTexture = await new Promise<THREE.Texture>((resolve, reject) => {
            textureLoader.load(normalMapUrl, resolve, undefined, reject);
          });
          normalTexture.colorSpace = THREE.SRGBColorSpace;
          normalMapsRef.current.set(painting.id, normalTexture);
          
          // Generate roughness map
          const roughnessUrl = await generateRoughnessMap(proxyUrl);
          roughnessTexture = await new Promise<THREE.Texture>((resolve, reject) => {
            textureLoader.load(roughnessUrl, resolve, undefined, reject);
          });
          roughnessTexture.colorSpace = THREE.LinearSRGBColorSpace;
          roughnessMapsRef.current.set(painting.id, roughnessTexture);
          
          // Generate displacement map
          const displacementUrl = await generateDisplacementMap(proxyUrl, 0.01, 0.5, 2, 1.5);
          displacementTexture = await new Promise<THREE.Texture>((resolve, reject) => {
            textureLoader.load(displacementUrl, resolve, undefined, reject);
          });
          displacementTexture.colorSpace = THREE.LinearSRGBColorSpace;
          displacementMapsRef.current.set(painting.id, displacementTexture);
        } catch (enhanceError) {
          console.error(`Failed to enhance painting ${painting.id}:`, enhanceError);
          // Continue without enhancements
        }
        
        const paintingMesh = createPaintingMesh(
          texture,
          painting.dimensions.width,
          painting.dimensions.height,
          painting.dimensions.depth || 0.003,
          normalTexture,
          roughnessTexture,
          displacementTexture
        );

        // Position on wall
        const position = wallConfig.position.clone();
        
        if (wallConfig.rotation === 0) {
          // Back wall
          position.x += offset;
        } else if (wallConfig.rotation === Math.PI / 2) {
          // Left wall
          position.z -= offset;
        } else {
          // Right wall
          position.z += offset;
        }

        paintingMesh.position.copy(position);
        paintingMesh.rotation.y = wallConfig.rotation;
        
        scene.add(paintingMesh);
        paintingMeshesRef.current.set(painting.id, paintingMesh);
        
        // Add dedicated spotlight above this painting (museum-style)
        const spotlight = new THREE.SpotLight(0xfff5e6, 1.2); // Warm white light
        const lightOffset = new THREE.Vector3(0, 0, 0.5); // Offset light forward from wall
        lightOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), wallConfig.rotation);
        spotlight.position.copy(position).add(new THREE.Vector3(0, 1.5, 0)).add(lightOffset);
        spotlight.target.position.copy(position);
        spotlight.angle = Math.PI / 8; // Narrow beam focused on painting
        spotlight.penumbra = 0.4; // Soft edges
        spotlight.decay = 2;
        spotlight.distance = 5;
        spotlight.castShadow = true;
        spotlight.shadow.mapSize.width = 1024;
        spotlight.shadow.mapSize.height = 1024;
        spotlight.shadow.bias = -0.001;
        scene.add(spotlight);
        scene.add(spotlight.target);
      } catch (error) {
        console.error(`Failed to load texture for painting ${painting.id}:`, error);
      }
    }
    
    setEnhancementProgress('');
  };

  const createPaintingMesh = (
    texture: THREE.Texture,
    width: number,
    height: number,
    depth: number,
    normalMap: THREE.Texture | null,
    roughnessMap: THREE.Texture | null,
    displacementMap: THREE.Texture | null
  ): THREE.Mesh => {
    const group = new THREE.Group();

    // Canvas
    const canvasGeometry = new THREE.PlaneGeometry(width, height, 256, 256);
    const canvasMaterial = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.5,
      metalness: 0.0,
      emissive: 0xffffff,
      emissiveIntensity: 0.01,
      normalMap: normalMap || undefined,
      normalScale: normalMap ? new THREE.Vector2(2.0, 2.0) : undefined,
      displacementMap: displacementMap || undefined,
      displacementScale: displacementMap ? 0.05 : 0,
      displacementBias: displacementMap ? -0.025 : 0,
      roughnessMap: roughnessMap || undefined,
    });
    
    const canvas = new THREE.Mesh(canvasGeometry, canvasMaterial);
    canvas.position.z = -0.02
    canvas.castShadow = false;
    canvas.receiveShadow = true;
    group.add(canvas);

    // Frame
    const frameColor = 0x4a3728;
    const frameMaterial = new THREE.MeshStandardMaterial({
      color: frameColor,
      roughness: 0.4,
      metalness: 0.3,
    });

    const frameThickness = 0.02;
    const frameDepth = 0.01;

    // Top frame
    const topFrame = new THREE.Mesh(
      new THREE.BoxGeometry(width + frameThickness * 2, frameThickness, frameDepth),
      frameMaterial
    );
    topFrame.position.set(0, height / 2 + frameThickness / 2, -frameDepth / 2);
    topFrame.castShadow = false;
    group.add(topFrame);

    // Bottom frame
    const bottomFrame = new THREE.Mesh(
      new THREE.BoxGeometry(width + frameThickness * 2, frameThickness, frameDepth),
      frameMaterial
    );
    bottomFrame.position.set(0, -height / 2 - frameThickness / 2, -frameDepth / 2);
    bottomFrame.castShadow = false;
    group.add(bottomFrame);

    // Left frame
    const leftFrame = new THREE.Mesh(
      new THREE.BoxGeometry(frameThickness, height, frameDepth),
      frameMaterial
    );
    leftFrame.position.set(-width / 2 - frameThickness / 2, 0, -frameDepth / 2);
    leftFrame.castShadow = false;
    group.add(leftFrame);

    // Right frame
    const rightFrame = new THREE.Mesh(
      new THREE.BoxGeometry(frameThickness, height, frameDepth),
      frameMaterial
    );
    rightFrame.position.set(width / 2 + frameThickness / 2, 0, -frameDepth / 2);
    rightFrame.castShadow = false;
    group.add(rightFrame);

    return group as any;
  };

  const handleToggleAI = async () => {
    if (aiEnhanced) {
      setAiEnhanced(false);
      // Reset all paintings to original textures
      paintingMeshesRef.current.forEach((mesh) => {
        const canvas = mesh.children[0] as THREE.Mesh;
        if (canvas.material instanceof THREE.MeshStandardMaterial) {
          canvas.material.normalMap = null;
          canvas.material.displacementMap = null;
          canvas.material.roughnessMap = null;
          canvas.material.needsUpdate = true;
        }
      });
      return;
    }
    
    if (paintings.length === 0) return;
    
    // Re-enable AI enhancements from cached maps
    setAiEnhanced(true);
    paintingMeshesRef.current.forEach((mesh, paintingId) => {
      const canvas = mesh.children[0] as THREE.Mesh;
      if (canvas.material instanceof THREE.MeshStandardMaterial) {
        const normalMap = normalMapsRef.current.get(paintingId);
        const roughnessMap = roughnessMapsRef.current.get(paintingId);
        const displacementMap = displacementMapsRef.current.get(paintingId);
        
        canvas.material.normalMap = normalMap || null;
        canvas.material.normalScale = normalMap ? new THREE.Vector2(2.0, 2.0) : new THREE.Vector2(1.0, 1.0);
        canvas.material.roughnessMap = roughnessMap || null;
        canvas.material.displacementMap = displacementMap || null;
        canvas.material.displacementScale = displacementMap ? 0.05 : 0;
        canvas.material.displacementBias = displacementMap ? -0.025 : 0;
        canvas.material.needsUpdate = true;
      }
    });

    setEnhancementProgress('Enhancing paintings...');
    const textureLoader = new THREE.TextureLoader();

    try {
      for (let i = 0; i < paintings.length; i++) {
        const painting = paintings[i];
        setEnhancementProgress(`Enhancing ${i + 1} of ${paintings.length}: ${painting.title}`);

        const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(painting.imageUrl)}`;
        
        try {
          // Generate normal map
          let normalMapUrl: string;
          try {
            normalMapUrl = await generateAINormalMap(painting.imageUrl, 'marigold-normals');
          } catch (aiError) {
            normalMapUrl = await generateCanvasNormalMap(proxyUrl, 0.04, 0.2, 4, 2);
          }

          const normalTexture = await new Promise<THREE.Texture>((resolve, reject) => {
            textureLoader.load(normalMapUrl, resolve, undefined, reject);
          });
          normalTexture.colorSpace = THREE.SRGBColorSpace;
          normalMapsRef.current.set(painting.id, normalTexture);

          // Generate roughness map
          const roughnessUrl = await generateRoughnessMap(proxyUrl);
          const roughnessTexture = await new Promise<THREE.Texture>((resolve, reject) => {
            textureLoader.load(roughnessUrl, resolve, undefined, reject);
          });
          roughnessTexture.colorSpace = THREE.LinearSRGBColorSpace;
          roughnessMapsRef.current.set(painting.id, roughnessTexture);

          // Generate displacement map
          const displacementUrl = await generateDisplacementMap(proxyUrl, 0.01, 0.5, 2, 1.5);
          const displacementTexture = await new Promise<THREE.Texture>((resolve, reject) => {
            textureLoader.load(displacementUrl, resolve, undefined, reject);
          });
          displacementTexture.colorSpace = THREE.LinearSRGBColorSpace;
          displacementMapsRef.current.set(painting.id, displacementTexture);

          // Update mesh material
          const mesh = paintingMeshesRef.current.get(painting.id);
          if (mesh) {
            const canvas = mesh.children[0] as THREE.Mesh;
            if (canvas.material instanceof THREE.MeshStandardMaterial) {
              canvas.material.normalMap = normalTexture;
              canvas.material.normalScale = new THREE.Vector2(2.0, 2.0);
              canvas.material.roughnessMap = roughnessTexture;
              canvas.material.displacementMap = displacementTexture;
              canvas.material.displacementScale = 0.05;
              canvas.material.displacementBias = -0.025;
              canvas.material.needsUpdate = true;
            }
          }
        } catch (error) {
          console.error(`Failed to enhance painting ${painting.id}:`, error);
        }
      }

      setAiEnhanced(true);
      setEnhancementProgress('All paintings enhanced!');
      setTimeout(() => setEnhancementProgress(''), 3000);
    } catch (error) {
      console.error('Enhancement error:', error);
      setEnhancementProgress('Enhancement failed');
      setTimeout(() => setEnhancementProgress(''), 3000);
    }
  };

  const handleLockPointer = () => {
    if (controlsRef.current) {
      controlsRef.current.lock();
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-xl mb-2">Loading gallery...</p>
          {enhancementProgress && (
            <p className="text-sm text-gray-400">{enhancementProgress}</p>
          )}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Error</h2>
          <p className="text-gray-400 mb-6">{error}</p>
          <a
            href="/gallery"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg inline-block"
          >
            Go Back
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen">
      <div ref={containerRef} className="w-full h-full" onClick={!isLocked ? handleLockPointer : undefined} />
      
      {!isLocked && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black bg-opacity-75 text-white p-8 rounded-lg text-center max-w-md pointer-events-auto">
            <h2 className="text-2xl font-bold mb-4">Click to Enter Gallery</h2>
            <p className="mb-4">Use WASD or arrow keys to move</p>
            <p className="text-sm text-gray-300">Press ESC to exit</p>
          </div>
        </div>
      )}

      {isLocked && (
        <div className="absolute top-4 left-4 bg-black bg-opacity-75 text-white p-4 rounded-lg">
          <div className="text-sm space-y-2">
            <div><strong>Controls:</strong></div>
            <div>W/↑ - Move Forward</div>
            <div>S/↓ - Move Backward</div>
            <div>A/← - Move Left</div>
            <div>D/→ - Move Right</div>
            <div>Mouse - Look Around</div>
            <div>ESC - Exit</div>
          </div>
        </div>
      )}

      {isLocked && (
        <div className="absolute top-4 right-4 space-y-2">
          <button
            onClick={handleToggleAI}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              aiEnhanced
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-gray-600 hover:bg-gray-700'
            } text-white`}
          >
            {aiEnhanced ? '✓ AI Enhanced (Click to Disable)' : 'Enable AI Enhancement'}
          </button>
          
          {enhancementProgress && (
            <div className="bg-black bg-opacity-75 text-white px-4 py-2 rounded-lg text-sm">
              {enhancementProgress}
            </div>
          )}
        </div>
      )}

      <div className="absolute bottom-4 left-4 bg-black bg-opacity-75 text-white px-4 py-2 rounded-lg">
        {paintings.length} painting{paintings.length !== 1 ? 's' : ''} loaded
      </div>

      <div className="absolute bottom-4 right-4">
        <a
          href="/gallery"
          className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold inline-block"
        >
          Exit Gallery
        </a>
      </div>
    </div>
  );
}
