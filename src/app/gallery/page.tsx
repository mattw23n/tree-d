'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function GalleryPage() {
  const [ids, setIds] = useState('');
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const idList = ids.split(',').map(id => id.trim()).filter(id => id);
    if (idList.length > 0) {
      router.push(`/gallery/view?ids=${idList.join(',')}`);
    }
  };

  const loadExample = () => {
    // Example painting IDs from the Met Museum
    const exampleIds = '436535,459080,438817,437853,436105';
    setIds(exampleIds);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-5xl font-bold mb-4 text-center bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600">
            3D Art Gallery
          </h1>
          <p className="text-gray-300 text-center mb-12">
            Enter Metropolitan Museum of Art object IDs to create your virtual gallery
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="ids" className="block text-sm font-medium mb-2">
                Painting IDs (comma-separated)
              </label>
              <textarea
                id="ids"
                value={ids}
                onChange={(e) => setIds(e.target.value)}
                placeholder="436535, 459080, 438817, 437853, 436105"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-500 min-h-[120px]"
                required
              />
              <p className="text-sm text-gray-400 mt-2">
                Enter Metropolitan Museum object IDs separated by commas
              </p>
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-all transform hover:scale-105"
              >
                Create Gallery
              </button>
              <button
                type="button"
                onClick={loadExample}
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-all"
              >
                Load Example
              </button>
            </div>
          </form>

          <div className="mt-12 p-6 bg-gray-800 rounded-lg border border-gray-700">
            <h2 className="text-xl font-semibold mb-3">Gallery Features</h2>
            <ul className="space-y-2 text-gray-300">
              <li className="flex items-start">
                <span className="text-blue-400 mr-2">•</span>
                <span>Walk around using WASD keys and look with your mouse</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-400 mr-2">•</span>
                <span>Toggle AI-enhanced impasto textures for realistic brushwork</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-400 mr-2">•</span>
                <span>Professional studio lighting with shadows</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-400 mr-2">•</span>
                <span>Inspect paintings up close to see frame details</span>
              </li>
            </ul>
          </div>

          <div className="mt-8 text-center">
            <a
              href="/"
              className="text-blue-400 hover:text-blue-300 underline"
            >
              ← Back to Single Painting View
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
