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
    <div className="flex flex-wrap items-center gap-3">
      <button
        onClick={onExportGlb}
        disabled={isLoading || isExporting || isExportingUSDZ}
        className="rounded-full border border-[#c8bfae] px-6 py-2 text-xs uppercase tracking-[0.3em] text-[#f4efe6] hover:bg-[#c8bfae] hover:text-[#0f0f0d] transition disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[#f4efe6]"
      >
        {isExporting ? 'Exporting…' : 'Export GLTF'}
      </button>

      <button
        onClick={onExportUsdz}
        disabled={isLoading || isExporting || isExportingUSDZ}
        className="rounded-full border border-[#3b362f] px-6 py-2 text-xs uppercase tracking-[0.3em] text-[#cfc6b7] hover:border-[#c8bfae] hover:text-[#f4efe6] transition disabled:opacity-40"
      >
        {isExportingUSDZ ? 'Exporting…' : 'Export USDZ'}
      </button>
    </div>
  );
}
