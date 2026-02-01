'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { fetchMetArtwork, MetArtwork } from '@/lib/metApi';
import { parseDimensions, getDefaultDimensions, ParsedDimensions } from '@/utils/dimensionParser';
import PaintingProcessor from '@/components/PaintingProcessor';

export default function ViewArtworkPage() {
  const params = useParams();
  const router = useRouter();
  const objectId = params.id as string;

  const [artwork, setArtwork] = useState<MetArtwork | null>(null);
  const [dimensions, setDimensions] = useState<ParsedDimensions | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadArtwork = async () => {
      const id = parseInt(objectId);
      
      if (isNaN(id) || id <= 0) {
        setError('Invalid artwork ID');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const data = await fetchMetArtwork(id);
        
        if (!data) {
          setError(`Artwork with ID ${id} not found.`);
          setIsLoading(false);
          return;
        }

        // Check if artwork has an image
        if (!data.primaryImage || data.primaryImage === '') {
          setError('This artwork does not have a primary image available.');
          setIsLoading(false);
          return;
        }

        // Check if artwork is public domain
        if (!data.isPublicDomain) {
          setError('This artwork is not in the public domain.');
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
        } else {
          setDimensions(parsedDims);
        }

        setIsLoading(false);
      } catch (err) {
        console.error('Error:', err);
        setError('Failed to load artwork. Please try again.');
        setIsLoading(false);
      }
    };

    loadArtwork();
  }, [objectId]);

  if (isLoading) {
    return (
      <main className="min-h-screen p-8 bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="max-w-6xl mx-auto">
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading artwork...</p>
          </div>
        </div>
      </main>
    );
  }

  if (error || !artwork || !dimensions) {
    return (
      <main className="min-h-screen p-8 bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="max-w-6xl mx-auto">
          <div className="text-center py-20">
            <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg inline-block">
              <p className="font-semibold mb-2">Error Loading Artwork</p>
              <p>{error || 'Unknown error occurred'}</p>
            </div>
            <div className="mt-6 space-x-4">
              <Link
                href="/search"
                className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Back to Search
              </Link>
              <Link
                href="/"
                className="inline-block px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Home
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-8 bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-6xl mx-auto">
        {/* Navigation */}
        <div className="mb-6">
          <Link
            href="/search"
            className="text-blue-600 hover:text-blue-800 underline text-sm"
          >
            ← Back to Search
          </Link>
        </div>

        {/* Artwork Info */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {artwork.title || 'Untitled'}
          </h1>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
            <div>
              <p className="mb-1">
                <span className="font-semibold">Artist:</span>{' '}
                {artwork.artistDisplayName || 'Unknown'}
              </p>
              <p className="mb-1">
                <span className="font-semibold">Date:</span>{' '}
                {artwork.objectDate || 'Unknown'}
              </p>
              <p className="mb-1">
                <span className="font-semibold">Medium:</span>{' '}
                {artwork.medium || 'Unknown'}
              </p>
            </div>
            <div>
              <p className="mb-1">
                <span className="font-semibold">Department:</span>{' '}
                {artwork.department || 'Unknown'}
              </p>
              <p className="mb-1">
                <span className="font-semibold">Culture:</span>{' '}
                {artwork.culture || 'Unknown'}
              </p>
              <p className="mb-1">
                <span className="font-semibold">Dimensions:</span>{' '}
                {artwork.dimensions || 'Not specified'}
              </p>
            </div>
          </div>
          {artwork.creditLine && (
            <p className="mt-4 text-xs text-gray-500 italic">
              {artwork.creditLine}
            </p>
          )}
          <div className="mt-4">
            <a
              href={artwork.objectURL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline text-sm"
            >
              View on Met Museum Website →
            </a>
          </div>
        </div>

        {/* 3D Viewer */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            3D Model Viewer
          </h2>
          <PaintingProcessor
            imageUrl={artwork.primaryImage}
            dimensions={dimensions}
            title={artwork.title || 'Untitled'}
          />
        </div>
      </div>
    </main>
  );
}
