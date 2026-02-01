'use client';

import { useState } from 'react';
import Link from 'next/link';
import { fetchMetArtwork, MetArtwork } from '@/lib/metApi';
import { parseDimensions, getDefaultDimensions, ParsedDimensions } from '@/utils/dimensionParser';
import PaintingProcessor from '@/components/PaintingProcessor';

export default function Home() {
  const [objectId, setObjectId] = useState<string>('');
  const [artwork, setArtwork] = useState<MetArtwork | null>(null);
  const [dimensions, setDimensions] = useState<ParsedDimensions | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    const id = parseInt(objectId.trim());
    
    if (isNaN(id) || id <= 0) {
      setError('Please enter a valid Met Museum Object ID (positive number)');
      return;
    }

    setIsLoading(true);
    setError(null);
    setArtwork(null);
    setDimensions(null);

    try {
      const data = await fetchMetArtwork(id);
      
      if (!data) {
        setError(`Artwork with ID ${id} not found. Please check the Object ID.`);
        setIsLoading(false);
        return;
      }

      // Check if artwork has an image
      if (!data.primaryImage || data.primaryImage === '') {
        setError('This artwork does not have a primary image available.');
        setIsLoading(false);
        return;
      }

      setArtwork(data);

      // Parse dimensions
      const parsedDims = parseDimensions(data.dimensions);
      
      if (!parsedDims) {
        // Use default dimensions if parsing fails
        const defaultDims = getDefaultDimensions();
        setDimensions(defaultDims);
        setError('Could not parse dimensions from API. Using default dimensions.');
      } else {
        setDimensions(parsedDims);
      }

      setIsLoading(false);
    } catch (err) {
      console.error('Error:', err);
      setError('Failed to fetch artwork. Please check your connection and try again.');
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-8 bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            API-to-3D Pipeline
          </h1>
          <p className="text-lg text-gray-600 mb-1">
            Convert Met Museum paintings into 1:1 scale 3D models
          </p>
          <p className="text-sm text-gray-500">
            Solving the &quot;Scalar Gap&quot; — bridging the sensory gap between digital images and physical presence
          </p>
          <div className="mt-4">
            <Link 
              href="/search"
              className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Search Met Museum Collection →
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label htmlFor="objectId" className="block text-sm font-medium text-gray-700 mb-2">
                Met Museum Object ID
              </label>
              <input
                id="objectId"
                type="number"
                value={objectId}
                onChange={(e) => setObjectId(e.target.value)}
                placeholder="e.g., 436524"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isLoading}
              />
              <p className="mt-2 text-xs text-gray-500">
                Find Object IDs at{' '}
                <a
                  href="https://www.metmuseum.org/art/collection"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  metmuseum.org/art/collection
                </a>
              </p>
            </div>
            <button
              onClick={handleGenerate}
              disabled={isLoading || !objectId.trim()}
              className="px-8 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {isLoading ? 'Loading...' : 'Generate & Preview 3D'}
            </button>
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 text-red-800 rounded-lg">
              {error}
            </div>
          )}

          {artwork && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">{artwork.title}</h2>
              {artwork.artistDisplayName && (
                <p className="text-gray-600 mb-1">
                  <span className="font-medium">Artist:</span> {artwork.artistDisplayName}
                </p>
              )}
              {artwork.objectDate && (
                <p className="text-gray-600 mb-1">
                  <span className="font-medium">Date:</span> {artwork.objectDate}
                </p>
              )}
              {artwork.medium && (
                <p className="text-gray-600">
                  <span className="font-medium">Medium:</span> {artwork.medium}
                </p>
              )}
            </div>
          )}
        </div>

        {artwork && dimensions && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">3D Preview</h2>
            <PaintingProcessor
              imageUrl={artwork.primaryImage}
              dimensions={dimensions}
              title={artwork.title}
            />
          </div>
        )}

        <div className="mt-8 text-center text-sm text-gray-500">
          <p>
            Built for PINUS Hack 2026 Track 4 • Uses AI-driven parsing to bridge the sensory gap
          </p>
          <p className="mt-2">
            Metric conversion: 100cm in real life = 1 unit in Three.js (standard metric scale)
          </p>
        </div>
      </div>
    </main>
  );
}
