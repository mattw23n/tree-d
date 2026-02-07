'use client';

import { useCallback, useRef, useState } from 'react';
import * as THREE from 'three';
import type { ParsedDimensions } from '@/utils/dimensionParser';
import PaintingRenderer from './PaintingRenderer';
import PaintingControls from './PaintingControls';
import PaintingExportControls from './PaintingExportControls';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { USDZExporter } from 'three/examples/jsm/exporters/USDZExporter.js';

interface EnhancementStatus {
  normalMap: boolean;
  aiEnhanced: boolean;
  message?: string;
}

interface ProcessingStage {
  id: string;
  step: number;
  title: string;
  description: string;
  imageUrl: string;
}

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
  const sceneRef = useRef<THREE.Scene | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingUSDZ, setIsExportingUSDZ] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [showFrame, setShowFrame] = useState(true);
  const [showScaleReference, setShowScaleReference] = useState(false);
  const [enhancementStatus, setEnhancementStatus] = useState<EnhancementStatus>({
    normalMap: false,
    aiEnhanced: false,
  });
  const [processingStages, setProcessingStages] = useState<ProcessingStage[]>([]);

  const handleSceneTargetsChange = useCallback((targets: { scene: THREE.Scene | null; mesh: THREE.Mesh | null }) => {
    sceneRef.current = targets.scene;
    meshRef.current = targets.mesh;
  }, []);

  const bakeDisplacementIntoGeometry = useCallback((mesh: THREE.Mesh) => {
    if (!mesh.geometry || !mesh.material) return;

    const material = mesh.material as THREE.MeshStandardMaterial;
    if (!material.displacementMap || !material.displacementScale) return;

    const geometry = mesh.geometry;
    const positionAttribute = geometry.attributes.position;
    const displacementMap = material.displacementMap;
    const displacementScale = material.displacementScale;
    const displacementBias = material.displacementBias || 0;

    const canvas = document.createElement('canvas');
    canvas.width = displacementMap.image.width;
    canvas.height = displacementMap.image.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(displacementMap.image, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    const positions = positionAttribute.array as Float32Array;
    const uvs = geometry.attributes.uv;

    if (uvs) {
      const uvArray = uvs.array as Float32Array;

      for (let i = 0; i < positions.length; i += 3) {
        const u = uvArray[(i / 3) * 2];
        const v = uvArray[(i / 3) * 2 + 1];

        const x = Math.floor(u * (canvas.width - 1));
        const y = Math.floor((1 - v) * (canvas.height - 1));
        const idx = (y * canvas.width + x) * 4;
        const displacement = (data[idx] / 255) * displacementScale + displacementBias;

        positions[i + 2] += displacement;
      }

      positionAttribute.needsUpdate = true;
      geometry.computeVertexNormals();
    }
  }, []);

  const cloneSceneForExport = useCallback((scene: THREE.Scene, targetMesh: THREE.Mesh) => {
    const originalMeshes: THREE.Mesh[] = [];
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        originalMeshes.push(object);
      }
    });

    const targetIndex = originalMeshes.indexOf(targetMesh);
    const clonedScene = scene.clone(true);
    const clonedMeshes: THREE.Mesh[] = [];
    let clonedMesh: THREE.Mesh | null = null;

    clonedScene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        if (object.geometry) {
          object.geometry = object.geometry.clone();
        }
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material = object.material.map((material) => material.clone());
          } else {
            object.material = object.material.clone();
          }
        }
        clonedMeshes.push(object);
      }
    });

    if (targetIndex >= 0 && targetIndex < clonedMeshes.length) {
      clonedMesh = clonedMeshes[targetIndex];
    }

    return { clonedScene, clonedMesh };
  }, []);

  const handleExportGlb = useCallback(async () => {
    if (!sceneRef.current || !meshRef.current) {
      alert('No 3D model to export');
      return;
    }

    setIsExporting(true);
    try {
      const { clonedScene, clonedMesh } = cloneSceneForExport(sceneRef.current, meshRef.current);

      if (clonedMesh && clonedMesh.material instanceof THREE.MeshStandardMaterial) {
        const material = clonedMesh.material;
        material.needsUpdate = true;
        if (clonedMesh.geometry) {
          clonedMesh.geometry.computeVertexNormals();
        }
        if (material.displacementMap) {
          bakeDisplacementIntoGeometry(clonedMesh);
        }
      }

      const exporter = new GLTFExporter();

      exporter.parse(
        clonedScene,
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
        (exportError) => {
          console.error('GLTF export error:', exportError);
          alert('Failed to Export GLTF file');
          setIsExporting(false);
        },
        {
          binary: true,
          includeCustomExtensions: false,
          embedImages: true,
        }
      );
    } catch (err) {
      console.error('Export error:', err);
      alert('Failed to Export GLTF file');
      setIsExporting(false);
    }
  }, [bakeDisplacementIntoGeometry, cloneSceneForExport, title]);

  const handleExportUsdz = useCallback(async () => {
    if (!sceneRef.current || !meshRef.current) {
      alert('No 3D model to export');
      return;
    }

    setIsExportingUSDZ(true);
    try {
      const { clonedScene, clonedMesh } = cloneSceneForExport(sceneRef.current, meshRef.current);

      if (clonedMesh && clonedMesh.material instanceof THREE.MeshStandardMaterial) {
        const material = clonedMesh.material;
        material.needsUpdate = true;
        if (clonedMesh.geometry) {
          clonedMesh.geometry.computeVertexNormals();
        }
        if (material.displacementMap) {
          bakeDisplacementIntoGeometry(clonedMesh);
        }
      }

      const exporter = new USDZExporter();

      const exportResult = await exporter.parseAsync(clonedScene, {
        maxTextureSize: 2048,
        quickLookCompatible: true,
        includeAnchoringProperties: true,
      });

      const blobBytes = exportResult instanceof Uint8Array
        ? new Uint8Array(exportResult)
        : new Uint8Array(exportResult);
      const blob = new Blob([blobBytes as unknown as BlobPart], { type: 'model/vnd.usdz+zip' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${title.replace(/[^a-z0-9]/gi, '_')}_3d.usdz`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setIsExportingUSDZ(false);
    } catch (err) {
      console.error('USDZ export error:', err);
      alert('Failed to export USDZ model. Make sure the scene is properly set up.');
      setIsExportingUSDZ(false);
    }
  }, [bakeDisplacementIntoGeometry, cloneSceneForExport, title]);

  return (
    <div className="w-full h-full flex flex-col items-center">
      <PaintingRenderer
        imageUrl={imageUrl}
        dimensions={dimensions}
        isDarkMode={isDarkMode}
        showFrame={showFrame}
        showScaleReference={showScaleReference}
        isEnhancing={isEnhancing}
        isLoading={isLoading}
        error={error}
        onSceneTargetsChange={handleSceneTargetsChange}
        onLoadingChange={setIsLoading}
        onError={setError}
        onEnhancementStatusChange={setEnhancementStatus}
        onEnhancingChange={setIsEnhancing}
        onProcessingStagesChange={setProcessingStages}
      />
      <div className="mt-4 flex flex-col gap-4">
        <PaintingExportControls
          isLoading={isLoading}
          isExporting={isExporting}
          isExportingUSDZ={isExportingUSDZ}
          onExportGlb={handleExportGlb}
          onExportUsdz={handleExportUsdz}
        />
        <PaintingControls
          isDarkMode={isDarkMode}
          showFrame={showFrame}
          showScaleReference={showScaleReference}
          isEnhancing={isEnhancing}
          onToggleDarkMode={() => setIsDarkMode((prev) => !prev)}
          onToggleFrame={() => setShowFrame((prev) => !prev)}
          onToggleScaleReference={() => setShowScaleReference((prev) => !prev)}
        />
        <div className="text-sm text-gray-600">
          Scene size: {dimensions.width.toFixed(3)} × {dimensions.height.toFixed(3)} units
          {dimensions.depth && ` × ${dimensions.depth.toFixed(4)} units`}
          <br />
          Real size (100 cm = 1 unit): {(dimensions.width * 100).toFixed(1)} ×{' '}
          {(dimensions.height * 100).toFixed(1)} cm
          {dimensions.depth && ` × ${(dimensions.depth * 100).toFixed(2)} cm`}
          <br />
          <span className="text-xs text-gray-500">
            Source dimensions: {dimensions.originalString}
          </span>
        </div>
        {enhancementStatus.message && (
          <div className="text-sm text-gray-600">
            {enhancementStatus.message}
          </div>
        )}
        {processingStages.length > 0 && (
          <div className="mt-4">
            <div className="text-xs uppercase tracking-[0.25em] text-gray-500 mb-2">
              How this 3D relief is generated
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
              {processingStages.map((stage) => (
                <div
                  key={stage.id}
                  className="rounded-xl border border-[#2a2722] bg-[#12100d] p-3"
                >
                  <div className="relative w-full pt-[75%] overflow-hidden rounded-lg border border-[#2a2722] bg-black/40">
                    <img
                      src={stage.imageUrl}
                      alt={stage.title}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  </div>
                  <div className="mt-2 text-xs font-semibold text-[#f4efe6]">
                    Step {stage.step}: {stage.title}
                  </div>
                  <p className="mt-1 text-[11px] leading-snug text-gray-400">
                    {stage.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
