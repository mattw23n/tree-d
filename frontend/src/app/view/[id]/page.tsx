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
      <main className="min-h-screen bg-[#0f0f0d] text-[#e8e2d5]">
        <div className="mx-auto max-w-6xl px-6 py-10 sm:px-8">
          <div className="rounded-3xl border border-[#2a2722] bg-[#141311] p-12 text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-[#c8bfae] border-t-transparent" />
            <p className="mt-4 text-sm text-[#cfc6b7]">Loading artwork...</p>
          </div>
        </div>
      </main>
    );
  }

  if (error || !artwork || !dimensions) {
    return (
      <main className="min-h-screen bg-[#0f0f0d] text-[#e8e2d5]">
        <div className="mx-auto max-w-6xl px-6 py-10 sm:px-8">
          <div className="rounded-3xl border border-[#4a2f2a] bg-[#1a1311] p-10 text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-[#f0b9ad]">Archive Notice</p>
            <p className="mt-3 text-lg font-serif text-[#f7e3dc]">Unable to load artwork</p>
            <p className="mt-3 text-sm text-[#f0b9ad]">{error || 'Unknown error occurred'}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                href="/search"
                className="rounded-full border border-[#c8bfae] px-6 py-2 text-sm text-[#f4efe6] hover:bg-[#c8bfae] hover:text-[#0f0f0d] transition"
              >
                Return to Search
              </Link>
              <Link
                href="/"
                className="rounded-full border border-[#3b362f] px-6 py-2 text-sm text-[#cfc6b7] hover:border-[#c8bfae] hover:text-[#f4efe6] transition"
              >
                Landing
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0f0f0d] text-[#e8e2d5]">
      <div className="mx-auto max-w-6xl px-6 py-10 sm:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#2a2722] pb-6">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.3em] text-[#b9b1a4]">Tree-D Studio</p>
            <h1 className="text-2xl font-serif text-[#f4efe6]">Viewing Room</h1>
          </div>
          <Link className="text-sm text-[#b9b1a4] hover:text-[#f4efe6] transition" href="/search">
            ← Return to Search
          </Link>
        </header>

        <section className="mt-10 rounded-3xl border border-[#2a2722] bg-[#141311] p-6">
          <div className="flex flex-col gap-4">
            <p className="text-xs uppercase tracking-[0.3em] text-[#b9b1a4]">Selected Work</p>
            <h2 className="text-3xl font-serif text-[#f7f1e7]">{artwork.title || 'Untitled'}</h2>
            <div className="grid gap-4 text-sm text-[#cfc6b7] md:grid-cols-2">
              <div className="space-y-2">
                <p>
                  <span className="text-[#9a9184]">Artist</span> — {artwork.artistDisplayName || 'Unknown'}
                </p>
                <p>
                  <span className="text-[#9a9184]">Date</span> — {artwork.objectDate || 'Unknown'}
                </p>
                <p>
                  <span className="text-[#9a9184]">Medium</span> — {artwork.medium || 'Unknown'}
                </p>
              </div>
              <div className="space-y-2">
                <p>
                  <span className="text-[#9a9184]">Department</span> — {artwork.department || 'Unknown'}
                </p>
                <p>
                  <span className="text-[#9a9184]">Culture</span> — {artwork.culture || 'Unknown'}
                </p>
                <p>
                  <span className="text-[#9a9184]">Dimensions</span> — {artwork.dimensions || 'Not specified'}
                </p>
              </div>
            </div>
            {artwork.creditLine && (
              <p className="text-xs text-[#9a9184] italic">{artwork.creditLine}</p>
            )}
            <a
              href={artwork.objectURL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs uppercase tracking-[0.3em] text-[#c8bfae] hover:text-[#f4efe6] transition"
            >
              View in Met Archive →
            </a>
          </div>
        </section>

        <section className="mt-10 rounded-3xl border border-[#2a2722] bg-[#141311] p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-serif text-[#f4efe6]">Relief Study</h3>
            <p className="text-xs uppercase tracking-[0.3em] text-[#b9b1a4]">Studio Lighting Enabled</p>
          </div>
          <PaintingProcessor
            imageUrl={artwork.primaryImage}
            dimensions={dimensions}
            title={artwork.title || 'Untitled'}
          />
        </section>
      </div>
    </main>
  );
}
