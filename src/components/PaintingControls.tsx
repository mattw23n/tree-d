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
    <div className="flex gap-4 items-center flex-wrap">
      <button
        onClick={onToggleDarkMode}
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

      {isEnhancing && (
        <div className="px-4 py-2 bg-purple-600 text-white rounded-lg flex items-center gap-2">
          <span className="animate-spin">✨</span>
          <span>Enhancing...</span>
        </div>
      )}

      <button
        onClick={onToggleFrame}
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
  );
}
