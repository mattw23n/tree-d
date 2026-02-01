'use client';

interface PaintingControlsProps {
  isDarkMode: boolean;
  showFrame: boolean;
  isEnhancing: boolean;
  onToggleDarkMode: () => void;
  onToggleFrame: () => void;
}

export default function PaintingControls({
  isDarkMode,
  showFrame,
  isEnhancing,
  onToggleDarkMode,
  onToggleFrame,
}: PaintingControlsProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        onClick={onToggleDarkMode}
        className="rounded-full border border-[#3b362f] px-5 py-2 text-xs uppercase tracking-[0.3em] text-[#cfc6b7] hover:border-[#c8bfae] hover:text-[#f4efe6] transition"
      >
        {isDarkMode ? 'Gallery Night' : 'Daylight'}
      </button>

      {isEnhancing && (
        <div className="rounded-full border border-[#2a2722] bg-[#171511] px-5 py-2 text-xs uppercase tracking-[0.3em] text-[#b9b1a4]">
          Enhancing
        </div>
      )}

      <button
        onClick={onToggleFrame}
        className="rounded-full border border-[#3b362f] px-5 py-2 text-xs uppercase tracking-[0.3em] text-[#cfc6b7] hover:border-[#c8bfae] hover:text-[#f4efe6] transition"
      >
        {showFrame ? 'Frame On' : 'Frame Off'}
      </button>
    </div>
  );
}
