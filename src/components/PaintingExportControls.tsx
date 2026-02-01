'use client';

interface PaintingExportControlsProps {
  isLoading: boolean;
  isExporting: boolean;
  isExportingUSDZ: boolean;
  onExportGlb: () => void;
  onExportUsdz: () => void;
}

export default function PaintingExportControls({
  isLoading,
  isExporting,
  isExportingUSDZ,
  onExportGlb,
  onExportUsdz,
}: PaintingExportControlsProps) {
  return (
    <div className="flex gap-4 items-center flex-wrap">
      <button
        onClick={onExportGlb}
        disabled={isLoading || isExporting || isExportingUSDZ}
        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
      >
        {isExporting ? (
          <>
            <span className="animate-spin">⏳</span>
            <span>Exporting...</span>
          </>
        ) : (
          <>
            <span>💾</span>
            <span>Export GLB</span>
          </>
        )}
      </button>

      <button
        onClick={onExportUsdz}
        disabled={isLoading || isExporting || isExportingUSDZ}
        className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
      >
        {isExportingUSDZ ? (
          <>
            <span className="animate-spin">⏳</span>
            <span>Exporting...</span>
          </>
        ) : (
          <>
            <span>📱</span>
            <span>Export USDZ</span>
          </>
        )}
      </button>
    </div>
  );
}
