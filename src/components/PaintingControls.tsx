'use client';

interface PaintingControlsProps {
  isDarkMode: boolean;
  showFrame: boolean;
  showScaleReference: boolean;
  isEnhancing: boolean;
  onToggleDarkMode: () => void;
  onToggleFrame: () => void;
  onToggleScaleReference: () => void;
}

export default function PaintingControls({
  isDarkMode,
  showFrame,
  showScaleReference,
  isEnhancing,
  onToggleDarkMode,
  onToggleFrame,
  onToggleScaleReference,
}: PaintingControlsProps) {
  return (
    <div className="flex flex-wrap justify-center items-center gap-3">
      <button
        onClick={onToggleDarkMode}
        className="rounded-full border border-[#3b362f] px-5 py-2 text-xs uppercase tracking-[0.3em] text-[#cfc6b7] hover:border-[#c8bfae] hover:text-[#f4efe6] transition"
      >
        {isDarkMode ? 'Dark Mode' : 'Light Mode'}
      </button>

      <button
        onClick={onToggleFrame}
        className="rounded-full border border-[#3b362f] px-5 py-2 text-xs uppercase tracking-[0.3em] text-[#cfc6b7] hover:border-[#c8bfae] hover:text-[#f4efe6] transition"
      >
        {showFrame ? 'Frame On' : 'Frame Off'}
      </button>

      <button
        onClick={onToggleScaleReference}
        className="rounded-full border border-[#3b362f] px-5 py-2 text-xs uppercase tracking-[0.3em] text-[#cfc6b7] hover:border-[#c8bfae] hover:text-[#f4efe6] transition"
      >
        {showScaleReference ? 'Human Scale On' : 'Human Scale Off'}
      </button>
    </div>
  );
}
