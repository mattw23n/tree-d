'use client';

import { useCallback, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { ParsedDimensions } from '@/utils/dimensionParser';
import {
  enhanceImageWithAI,
  generateAINormalMap,
  generateCanvasNormalMap,
  generateDisplacementMap,
  generateRoughnessMap,
} from '@/lib/aiEnhancement';

interface EnhancementStatus {
  normalMap: boolean;
  aiEnhanced: boolean;
  message?: string;
}

interface SceneTargets {
  scene: THREE.Scene | null;
  mesh: THREE.Mesh | null;
}

interface ProcessingStage {
  id: string;
  step: number;
  title: string;
  description: string;
  imageUrl: string;
}

interface PaintingRendererProps {
  imageUrl: string;
  dimensions: ParsedDimensions;
  isDarkMode: boolean;
  showFrame: boolean;
  showScaleReference: boolean;
  isEnhancing: boolean;
  isLoading: boolean;
  error: string | null;
  onSceneTargetsChange: (targets: SceneTargets) => void;
  onLoadingChange: (isLoading: boolean) => void;
  onError: (error: string | null) => void;
  onEnhancementStatusChange: (status: EnhancementStatus) => void;
  onEnhancingChange: (isEnhancing: boolean) => void;
  onProcessingStagesChange: (stages: ProcessingStage[]) => void;
}

export default function PaintingRenderer({
  imageUrl,
  dimensions,
  isDarkMode,
  showFrame,
  showScaleReference,
  isEnhancing,
  isLoading,
  error,
  onSceneTargetsChange,
  onLoadingChange,
  onError,
  onEnhancementStatusChange,
  onEnhancingChange,
  onProcessingStagesChange,
}: PaintingRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const paintingGroupRef = useRef<THREE.Group | null>(null);
  const frameElementsRef = useRef<THREE.Mesh[]>([]);
  const scaleReferenceGroupRef = useRef<THREE.Group | null>(null);
  const pointLightRef = useRef<THREE.PointLight | null>(null);
  const enhancementInFlightRef = useRef(false);
  const enhancementRunForImageRef = useRef<string | null>(null);
  const enhancedTextureRef = useRef<THREE.Texture | null>(null);
  const normalMapRef = useRef<THREE.Texture | null>(null);
  const roughnessMapRef = useRef<THREE.Texture | null>(null);
  const displacementMapRef = useRef<THREE.Texture | null>(null);

  const applyEnhancement = useCallback(async () => {
    if (!imageUrl) {
      return;
    }
    if (enhancementInFlightRef.current || enhancementRunForImageRef.current === imageUrl) {
      return;
    }

    enhancementInFlightRef.current = true;
    onEnhancingChange(true);
    onError(null);
    onEnhancementStatusChange({ normalMap: false, aiEnhanced: false });
    displacementMapRef.current = null;

    try {
      const proxyUrl = imageUrl.startsWith('blob:') || imageUrl.startsWith('data:')
        ? imageUrl
        : `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;

      const stages: ProcessingStage[] = [
        {
          id: 'original',
          step: 1,
          title: 'Original painting',
          description: 'The 2D artwork as provided to Tree‑D Studio.',
          imageUrl: proxyUrl,
        },
      ];
      onProcessingStagesChange(stages);

      const textureLoader = new THREE.TextureLoader();

      let normalMapUrl: string;
      let useAI = false;

      try {
        // Try a simpler, widely-available depth model first (Depth Anything V2 Small via Hugging Face)
        normalMapUrl = await generateAINormalMap(imageUrl, 'depth-anything-v2');
        useAI = true;
      } catch (aiError) {
        const errorMessage = aiError instanceof Error ? aiError.message : String(aiError);
        const isExpectedFallback =
          errorMessage.includes('AI_NORMAL_MAP_UNAVAILABLE') ||
          errorMessage.includes('410') ||
          (aiError instanceof Error && (aiError as any).isFallback);

        if (!isExpectedFallback) {
          console.warn('AI normal map generation failed. Using procedural normal map:', errorMessage);
        }

        normalMapUrl = await generateCanvasNormalMap(proxyUrl, 0.04, 0.2, 4, 2);
      }

      stages.push({
        id: 'normal',
        step: 2,
        title: useAI ? 'AI depth / normal prediction' : 'Procedural normal map',
        description: useAI
          ? 'A depth model predicts which parts of the image are closer or farther and encodes that as RGB normals.'
          : 'A procedural normal map simulates canvas weave and brush strokes without calling an AI service.',
        imageUrl: normalMapUrl,
      });
      onProcessingStagesChange([...stages]);

      textureLoader.load(
        normalMapUrl,
        (normalTexture) => {
          normalTexture.colorSpace = THREE.SRGBColorSpace;
          normalMapRef.current = normalTexture;

          if (meshRef.current && meshRef.current.material instanceof THREE.MeshStandardMaterial) {
            meshRef.current.material.normalMap = normalTexture;
            meshRef.current.material.normalScale = new THREE.Vector2(2.0, 2.0);
            meshRef.current.material.needsUpdate = true;
          }

          onEnhancementStatusChange({
            normalMap: true,
            aiEnhanced: useAI,
            message: useAI ? 'AI-generated impasto texture applied!' : 'Procedural impasto texture applied!',
          });

          onEnhancingChange(false);
        },
        undefined,
        (error) => {
          console.error('Failed to load normal map texture:', error);
          onError('Failed to load normal map texture');
          onEnhancingChange(false);
        }
      );

      generateRoughnessMap(proxyUrl).then((roughnessUrl) => {
        textureLoader.load(roughnessUrl, (roughnessTexture) => {
          roughnessTexture.colorSpace = THREE.SRGBColorSpace;
          roughnessMapRef.current = roughnessTexture;

          if (meshRef.current && meshRef.current.material instanceof THREE.MeshStandardMaterial) {
            meshRef.current.material.roughnessMap = roughnessTexture;
            meshRef.current.material.needsUpdate = true;
          }
        });

        stages.push({
          id: 'roughness',
          step: 3,
          title: 'Roughness map',
          description: 'Bright and dark regions control how glossy or matte each point of the surface appears.',
          imageUrl: roughnessUrl,
        });
        onProcessingStagesChange([...stages]);
      });

      generateDisplacementMap(proxyUrl, 0.01, 0.5, 2, 1.5)
        .then((displacementUrl) => {
          textureLoader.load(displacementUrl, (displacementTexture) => {
            displacementTexture.colorSpace = THREE.NoColorSpace;
            displacementTexture.wrapS = THREE.RepeatWrapping;
            displacementTexture.wrapT = THREE.RepeatWrapping;
            displacementMapRef.current = displacementTexture;

            if (meshRef.current && meshRef.current.material instanceof THREE.MeshStandardMaterial) {
              meshRef.current.material.displacementMap = displacementTexture;
              meshRef.current.material.displacementScale = 0.05;
              meshRef.current.material.displacementBias = -0.025;
              meshRef.current.material.needsUpdate = true;

              if (meshRef.current.geometry) {
                meshRef.current.geometry.computeVertexNormals();
                meshRef.current.geometry.attributes.position.needsUpdate = true;
              }
            }

            onEnhancementStatusChange({
              normalMap: true,
              aiEnhanced: useAI,
              message: '3D impasto relief applied! Rotate to see depth from the side.',
            });
          });

          stages.push({
            id: 'displacement',
            step: 4,
            title: 'Displacement (height) map',
            description: 'This grayscale map pushes vertices forward and backward to form the 3D relief.',
            imageUrl: displacementUrl,
          });
          onProcessingStagesChange([...stages]);
        })
        .catch((error) => {
          console.error('Failed to generate displacement map:', error);
        });

      try {
        const result = await enhanceImageWithAI(imageUrl, {
          provider: 'replicate',
          enhanceType: 'upscale',
          strength: 0.7,
        });

        if (result.enhancedImageUrl && result.enhancedImageUrl !== imageUrl) {
          textureLoader.load(
            result.enhancedImageUrl,
            (enhancedTexture) => {
              enhancedTexture.colorSpace = THREE.SRGBColorSpace;
              enhancedTextureRef.current = enhancedTexture;

              if (meshRef.current && meshRef.current.material instanceof THREE.MeshStandardMaterial) {
                meshRef.current.material.map = enhancedTexture;
                meshRef.current.material.needsUpdate = true;
              }

              onEnhancementStatusChange({
                normalMap: true,
                aiEnhanced: true,
                message: 'AI texture enhancement applied!'
              });
            },
            undefined,
            (error) => {
              console.log('Failed to load enhanced texture, using original:', error);
              onEnhancementStatusChange({
                normalMap: true,
                aiEnhanced: false,
                message: 'AI enhancement failed, using original texture'
              });
            }
          );
        } else if (result.message) {
          onEnhancementStatusChange({
            normalMap: true,
            aiEnhanced: false,
            message: result.message || 'AI enhancement not configured',
          });
          console.log('AI Enhancement:', result.message);
        }
      } catch (aiError) {
        console.log(
          'AI enhancement skipped (API not configured or failed):',
          aiError instanceof Error ? aiError.message : aiError
        );
      }

      enhancementRunForImageRef.current = imageUrl;
    } catch (error) {
      console.error('Enhancement error:', error);
      onError('Failed to enhance texture. Normal map generation may still work.');
      onEnhancingChange(false);
      enhancementRunForImageRef.current = null;
    } finally {
      enhancementInFlightRef.current = false;
    }
  }, [imageUrl, onEnhancingChange, onEnhancementStatusChange, onError, onProcessingStagesChange]);

  useEffect(() => {
    enhancementRunForImageRef.current = null;
    enhancementInFlightRef.current = false;
  }, [imageUrl]);

  useEffect(() => {
    if (!canvasRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(isDarkMode ? 0x000000 : 0xffffff);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      75,
      canvasRef.current.clientWidth / canvasRef.current.clientHeight,
      0.01,
      1000
    );
    camera.position.set(0, 0, 1.5);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
    });
    renderer.setSize(canvasRef.current.clientWidth, canvasRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = true;
    controls.enablePan = true;
    controlsRef.current = controls;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
    mainLight.position.set(0, 2, 3);
    mainLight.castShadow = true;
    scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-2, 0, 2);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.2);
    rimLight.position.set(0, -1, -2);
    scene.add(rimLight);

    const pointLight = new THREE.PointLight(0xffffff, 1.5, 10);
    pointLight.position.set(2, 2, 3);
    pointLight.castShadow = true;
    scene.add(pointLight);
    pointLightRef.current = pointLight;

    const handleMouseMove = (event: MouseEvent) => {
      if (!canvasRef.current || !pointLightRef.current) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      const lightDistance = 3;
      pointLightRef.current.position.set(
        x * lightDistance,
        y * lightDistance + 1,
        lightDistance
      );
    };

    canvasRef.current.addEventListener('mousemove', handleMouseMove);

    const createPaintingWithFrame = (
      texture: THREE.Texture | null,
      width: number,
      height: number,
      canvasDepth: number,
      normalMapTexture?: THREE.Texture | null,
      roughnessMapTexture?: THREE.Texture | null,
      displacementMapTexture?: THREE.Texture | null,
      includeFrame: boolean = true
    ): { canvasMesh: THREE.Mesh; paintingGroup: THREE.Group; frameElements: THREE.Mesh[] } => {
      const frameWidth = 0.02;
      const frameDepth = 0.05;

      const canvasGeometry = new THREE.PlaneGeometry(
        width - frameWidth * 2,
        height - frameWidth * 2,
        256,
        256
      );

      const canvasMaterial = new THREE.MeshStandardMaterial({
        map: texture,
        color: texture ? undefined : 0xcccccc,
        side: THREE.FrontSide,
        roughness: 0.5,
        roughnessMap: roughnessMapTexture || undefined,
        metalness: 0.0,
        normalMap: normalMapTexture || undefined,
        normalScale: normalMapTexture ? new THREE.Vector2(2.0, 2.0) : undefined,
        displacementMap: displacementMapTexture || undefined,
        displacementScale: displacementMapTexture ? 0.05 : 0,
        displacementBias: displacementMapTexture ? -0.025 : 0,
      });

      const canvasMesh = new THREE.Mesh(canvasGeometry, canvasMaterial);
      canvasMesh.position.set(0, 0, includeFrame ? 0.002 : 0);
      canvasMesh.position.z = -0.02;

      const stretcherMaterial = new THREE.MeshStandardMaterial({
        color: 0x8b7355,
        roughness: 0.7,
        metalness: 0.1,
      });

      const topBar = new THREE.Mesh(
        new THREE.BoxGeometry(width, frameWidth, frameDepth),
        stretcherMaterial
      );
      topBar.position.set(0, height / 2 - frameWidth / 2, -frameDepth / 2);

      const bottomBar = new THREE.Mesh(
        new THREE.BoxGeometry(width, frameWidth, frameDepth),
        stretcherMaterial
      );
      bottomBar.position.set(0, -height / 2 + frameWidth / 2, -frameDepth / 2);

      const leftBar = new THREE.Mesh(
        new THREE.BoxGeometry(frameWidth, height - frameWidth * 2, frameDepth),
        stretcherMaterial
      );
      leftBar.position.set(-width / 2 + frameWidth / 2, 0, -frameDepth / 2);

      const rightBar = new THREE.Mesh(
        new THREE.BoxGeometry(frameWidth, height - frameWidth * 2, frameDepth),
        stretcherMaterial
      );
      rightBar.position.set(width / 2 - frameWidth / 2, 0, -frameDepth / 2);

      const frameMaterial = new THREE.MeshStandardMaterial({
        color: 0x4a3728,
        roughness: 0.4,
        metalness: 0.3,
      });

      const frameThickness = 0.005;
      const frameOuterWidth = width + frameThickness * 2;
      const frameOuterHeight = height + frameThickness * 2;
      const frameZOffset = -0.02;

      const topFrame = new THREE.Mesh(
        new THREE.BoxGeometry(frameOuterWidth, frameThickness, frameDepth),
        frameMaterial
      );
      topFrame.position.set(0, height / 2 + frameThickness / 2, frameZOffset);

      const bottomFrame = new THREE.Mesh(
        new THREE.BoxGeometry(frameOuterWidth, frameThickness, frameDepth),
        frameMaterial
      );
      bottomFrame.position.set(0, -height / 2 - frameThickness / 2, frameZOffset);

      const leftFrame = new THREE.Mesh(
        new THREE.BoxGeometry(frameThickness, frameOuterHeight, frameDepth),
        frameMaterial
      );
      leftFrame.position.set(-width / 2 - frameThickness / 2, 0, frameZOffset);

      const rightFrame = new THREE.Mesh(
        new THREE.BoxGeometry(frameThickness, frameOuterHeight, frameDepth),
        frameMaterial
      );
      rightFrame.position.set(width / 2 + frameThickness / 2, 0, frameZOffset);

      const backPanel = new THREE.Mesh(
        new THREE.BoxGeometry(frameOuterWidth, frameOuterHeight, frameThickness),
        frameMaterial
      );
      backPanel.position.set(0, 0, -frameDepth / 2 - frameThickness / 2 - 0.015);

      const paintingGroup = new THREE.Group();
      paintingGroup.add(canvasMesh);

      const frameElements = [
        topBar, bottomBar, leftBar, rightBar,
        topFrame, bottomFrame, leftFrame, rightFrame,
        backPanel
      ];

      if (includeFrame) {
        frameElements.forEach(element => paintingGroup.add(element));
      }

      // Human scale reference figure (approx. 1.8m tall person)
      const humanHeightUnits = 1.8; // 180cm / 100
      const humanGroup = new THREE.Group();

      const legHeight = humanHeightUnits * 0.45;
      const torsoHeight = humanHeightUnits * 0.35;
      const headHeight = humanHeightUnits * 0.2;
      const bodyWidth = humanHeightUnits * 0.18;
      const depth = frameDepth * 0.6;

      const material = new THREE.MeshStandardMaterial({
        color: 0x555577,
        roughness: 0.5,
        metalness: 0.1,
      });

      const leftLeg = new THREE.Mesh(
        new THREE.BoxGeometry(bodyWidth * 0.5, legHeight, depth),
        material
      );
      const rightLeg = leftLeg.clone();
      leftLeg.position.set(-bodyWidth * 0.15, legHeight / 2, 0);
      rightLeg.position.set(bodyWidth * 0.15, legHeight / 2, 0);

      const torso = new THREE.Mesh(
        new THREE.BoxGeometry(bodyWidth, torsoHeight, depth * 1.1),
        material
      );
      torso.position.set(0, legHeight + torsoHeight / 2, 0);

      const head = new THREE.Mesh(
        new THREE.BoxGeometry(bodyWidth * 0.7, headHeight, depth),
        material
      );
      head.position.set(0, legHeight + torsoHeight + headHeight / 2, 0);

      humanGroup.add(leftLeg, rightLeg, torso, head);

      // Position human so feet are roughly aligned with painting bottom
      const humanOffsetX = width / 2 + bodyWidth;
      const humanOffsetY = -height / 2;
      const humanOffsetZ = frameZOffset;
      humanGroup.position.set(humanOffsetX, humanOffsetY, humanOffsetZ);

      humanGroup.visible = showScaleReference;
      paintingGroup.add(humanGroup);
      scaleReferenceGroupRef.current = humanGroup;

      return { canvasMesh, paintingGroup, frameElements };
    };

    const textureLoader = new THREE.TextureLoader();
    const proxyUrl = imageUrl.startsWith('blob:') || imageUrl.startsWith('data:')
      ? imageUrl
      : `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;
    textureLoader.setCrossOrigin('anonymous');

    textureLoader.load(
      proxyUrl,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;

        const finalTexture = enhancedTextureRef.current || texture;
        const width = dimensions.height;
        const height = dimensions.width;
        const canvasDepth = dimensions.depth ?? 0.0003;

        const { canvasMesh, paintingGroup, frameElements } = createPaintingWithFrame(
          finalTexture,
          width,
          height,
          canvasDepth,
          normalMapRef.current,
          roughnessMapRef.current,
          displacementMapRef.current,
          true
        );

        scene.add(paintingGroup);
        meshRef.current = canvasMesh;
        paintingGroupRef.current = paintingGroup;
        frameElementsRef.current = frameElements;
        frameElementsRef.current.forEach((element) => {
          element.visible = showFrame;
        });
        onSceneTargetsChange({ scene, mesh: canvasMesh });

        const box = new THREE.Box3().setFromObject(paintingGroup);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const distance = maxDim * 1.8;

        camera.position.set(center.x, center.y, distance);
        camera.lookAt(center);

        onLoadingChange(false);
        onError(null);
        onEnhancementStatusChange({ normalMap: false, aiEnhanced: false });
        displacementMapRef.current = null;

        setTimeout(() => {
          applyEnhancement();
        }, 100);
      },
      undefined,
      (err) => {
        console.error('Error loading texture:', err);
        onError('Failed to load image. Trying direct load...');

        textureLoader.setCrossOrigin('anonymous');
        textureLoader.load(
          imageUrl,
          (texture) => {
            texture.colorSpace = THREE.SRGBColorSpace;
            const width = dimensions.height;
            const height = dimensions.width;
            const canvasDepth = dimensions.depth ?? 0.0003;

            const finalTexture = enhancedTextureRef.current || texture;
            const { canvasMesh, paintingGroup, frameElements } = createPaintingWithFrame(
              finalTexture,
              width,
              height,
              canvasDepth,
              normalMapRef.current,
              roughnessMapRef.current,
              displacementMapRef.current,
              true
            );

            scene.add(paintingGroup);
            meshRef.current = canvasMesh;
            paintingGroupRef.current = paintingGroup;
            frameElementsRef.current = frameElements;
            frameElementsRef.current.forEach((element) => {
              element.visible = showFrame;
            });
            onSceneTargetsChange({ scene, mesh: canvasMesh });

            const box = new THREE.Box3().setFromObject(paintingGroup);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const distance = maxDim * 1.8;
            camera.position.set(center.x, center.y, distance);
            camera.lookAt(center);

            onLoadingChange(false);
            onError(null);
          },
          undefined,
          () => {
            onLoadingChange(false);
            onError('Image unavailable. Showing 3D model without texture.');

            const width = dimensions.height;
            const height = dimensions.width;
            const canvasDepth = dimensions.depth ?? 0.0003;

            const { canvasMesh, paintingGroup, frameElements } = createPaintingWithFrame(
              null,
              width,
              height,
              canvasDepth,
              normalMapRef.current,
              roughnessMapRef.current,
              displacementMapRef.current,
              true
            );

            scene.add(paintingGroup);
            meshRef.current = canvasMesh;
            paintingGroupRef.current = paintingGroup;
            frameElementsRef.current = frameElements;
            frameElementsRef.current.forEach((element) => {
              element.visible = showFrame;
            });
            onSceneTargetsChange({ scene, mesh: canvasMesh });

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

    const animate = () => {
      requestAnimationFrame(animate);
      if (controls) {
        controls.update();
      }
      if (renderer && scene && camera) {
        renderer.render(scene, camera);
      }
    };
    animate();

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
      canvasRef.current?.removeEventListener('mousemove', handleMouseMove);

      controls.dispose();
      renderer.dispose();

      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          if (object.geometry) {
            object.geometry.dispose();
          }
          if (object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach((material) => material.dispose());
            } else {
              object.material.dispose();
            }
          }
        }
      });
    };
  }, [
    imageUrl,
    dimensions,
    isDarkMode,
    applyEnhancement,
    onEnhancementStatusChange,
    onError,
    onLoadingChange,
    onSceneTargetsChange,
  ]);

  useEffect(() => {
    if (!sceneRef.current) return;
    sceneRef.current.background = new THREE.Color(isDarkMode ? 0x000000 : 0xffffff);
  }, [isDarkMode]);

  useEffect(() => {
    if (!paintingGroupRef.current || frameElementsRef.current.length === 0) return;

    frameElementsRef.current.forEach((frameElement) => {
      frameElement.visible = showFrame;
    });
  }, [showFrame]);

  useEffect(() => {
    if (!scaleReferenceGroupRef.current) return;
    scaleReferenceGroupRef.current.visible = showScaleReference;
  }, [showScaleReference]);

  return (
    <div className="relative mx-auto w-full max-w-3xl h-[420px] sm:h-[520px] lg:h-[600px] overflow-hidden rounded-2xl border border-[#2a2722] bg-[#0f0f0d]">
      {(isLoading || isEnhancing) && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-[#0f0f0d]/90">
          <div className="flex flex-col items-center gap-3 text-[#cfc6b7]">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#c8bfae] border-t-transparent" />
            <span className="text-xs uppercase tracking-[0.3em]">
              {isEnhancing ? 'Enhancing surface' : 'Loading relief'}
            </span>
          </div>
        </div>
      )}
      {error && (
        <div className="absolute top-4 left-4 rounded-xl border border-[#4a2f2a] bg-[#1a1311] px-4 py-2 text-xs text-[#f0b9ad] z-10">
          {error}
        </div>
      )}
      <canvas
        ref={canvasRef}
        className={`w-full h-full ${isEnhancing ? 'opacity-0' : 'opacity-100'}`}
      />
    </div>
  );
}
