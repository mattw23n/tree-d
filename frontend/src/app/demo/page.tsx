'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchMetArtwork, MetArtwork } from '@/lib/metApi';
import { parseDimensions, getDefaultDimensions, ParsedDimensions } from '@/utils/dimensionParser';
import PaintingProcessor from '@/components/PaintingProcessor';

type DemoMode = 'met' | 'upload';

export default function Home() {
  const [mode, setMode] = useState<DemoMode>('met');
  const [objectId, setObjectId] = useState<string>('');
  const [artwork, setArtwork] = useState<MetArtwork | null>(null);
  const [dimensions, setDimensions] = useState<ParsedDimensions | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadUrl, setUploadUrl] = useState<string | null>(null);
  const [uploadTitle, setUploadTitle] = useState<string>('Untitled Study');
  const [uploadWidthCm, setUploadWidthCm] = useState<string>('50');
  const [uploadHeightCm, setUploadHeightCm] = useState<string>('60');
  const [uploadDepthCm, setUploadDepthCm] = useState<string>('0.03');

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

  const handleUpload = (file: File | null) => {
    if (!file) return;

    setError(null);
    setArtwork(null);
    setDimensions(null);

    const url = URL.createObjectURL(file);
    setUploadUrl(url);
  };

  const buildUploadDimensions = (): ParsedDimensions => {
    const width = Number(uploadWidthCm);
    const height = Number(uploadHeightCm);
    const depth = Number(uploadDepthCm);

    if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
      return {
        width: width / 100,
        height: height / 100,
        depth: Number.isFinite(depth) && depth > 0 ? depth / 100 : undefined,
        originalString: `Custom dimensions (${width} x ${height}${Number.isFinite(depth) && depth > 0 ? ` x ${depth}` : ''} cm)`,
      };
    }

    return getDefaultDimensions();
  };

  useEffect(() => {
    return () => {
      if (uploadUrl) {
        URL.revokeObjectURL(uploadUrl);
      }
    };
  }, [uploadUrl]);

  return (
    <main className="min-h-screen bg-[#0f0f0d] text-[#e8e2d5]">
      <div className="mx-auto max-w-6xl px-6 py-10 sm:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#2a2722] pb-6">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.3em] text-[#b9b1a4]">Tree-D Studio</p>
            <h1 className="text-2xl font-serif text-[#f4efe6]">Experimental Demo</h1>
          </div>
          <nav className="hidden gap-6 text-sm text-[#b9b1a4] sm:flex">
            <a className="hover:text-[#f4efe6] transition" href="/search">Search</a>
            <a className="hover:text-[#f4efe6] transition" href="/demo">Demo</a>
            <span className="text-[#6f675b]">View</span>
          </nav>
        </header>

        <section className="mt-10 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.4em] text-[#a79f92]">Proofing Room</p>
            <h2 className="text-4xl font-serif leading-tight text-[#f7f1e7] sm:text-5xl">
              Test a Met ID or upload your own painting
            </h2>
            <p className="text-lg text-[#cfc6b7] leading-relaxed">
              Use the demo suite to validate depth conversion. You can pull a work directly from the
              Met archive or upload a personal study to observe the relief response.
            </p>
          </div>
          <div className="rounded-3xl border border-[#2a2722] bg-gradient-to-b from-[#1a1815] via-[#12110f] to-[#0f0f0d] p-6">
            <p className="text-xs uppercase tracking-[0.3em] text-[#b9b1a4]">Studio Notes</p>
            <ul className="mt-4 space-y-3 text-sm text-[#cfc6b7]">
              <li className="flex gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-[#c8bfae]" />
                100 cm equals 1 unit in the 3D scene.
              </li>
              <li className="flex gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-[#c8bfae]" />
                Uploaded images never leave your browser.
              </li>
              <li className="flex gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-[#c8bfae]" />
                Adjust dimensions to match a physical painting.
              </li>
            </ul>
          </div>
        </section>

        <section className="mt-10 rounded-3xl border border-[#2a2722] bg-[#141311] p-6">
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => {
                setMode('met');
                setError(null);
              }}
              className={`rounded-full border px-5 py-2 text-xs uppercase tracking-[0.3em] transition ${
                mode === 'met'
                  ? 'border-[#c8bfae] text-[#0f0f0d] bg-[#c8bfae]'
                  : 'border-[#3b362f] text-[#cfc6b7] hover:border-[#c8bfae] hover:text-[#f4efe6]'
              }`}
            >
              Met Object ID
            </button>
            <button
              onClick={() => {
                setMode('upload');
                setError(null);
                setArtwork(null);
                setDimensions(null);
              }}
              className={`rounded-full border px-5 py-2 text-xs uppercase tracking-[0.3em] transition ${
                mode === 'upload'
                  ? 'border-[#c8bfae] text-[#0f0f0d] bg-[#c8bfae]'
                  : 'border-[#3b362f] text-[#cfc6b7] hover:border-[#c8bfae] hover:text-[#f4efe6]'
              }`}
            >
              Upload Image
            </button>
          </div>

          {mode === 'met' && (
            <div className="mt-6 grid gap-4 md:grid-cols-[1.4fr_0.6fr]">
              <div>
                <label htmlFor="objectId" className="text-xs uppercase tracking-[0.3em] text-[#b9b1a4]">
                  Met Object ID
                </label>
                <input
                  id="objectId"
                  type="number"
                  value={objectId}
                  onChange={(e) => setObjectId(e.target.value)}
                  placeholder="436524"
                  className="mt-3 w-full rounded-full border border-[#3b362f] bg-[#0f0f0d] px-5 py-3 text-sm text-[#f4efe6] placeholder:text-[#7c7265] focus:border-[#c8bfae] focus:outline-none"
                  disabled={isLoading}
                />
                <p className="mt-3 text-xs text-[#9a9184]">
                  Retrieve IDs from{' '}
                  <a
                    href="https://www.metmuseum.org/art/collection"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#c8bfae] hover:text-[#f4efe6]"
                  >
                    metmuseum.org/art/collection
                  </a>
                </p>
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleGenerate}
                  disabled={isLoading || !objectId.trim()}
                  className="w-full rounded-full border border-[#c8bfae] px-6 py-3 text-xs uppercase tracking-[0.3em] text-[#f4efe6] hover:bg-[#c8bfae] hover:text-[#0f0f0d] transition disabled:opacity-40"
                >
                  {isLoading ? 'Loading…' : 'Generate Relief'}
                </button>
              </div>
            </div>
          )}

          {mode === 'upload' && (
            <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-4">
                <label className="text-xs uppercase tracking-[0.3em] text-[#b9b1a4]">
                  Upload Painting Image
                </label>
                <div className="rounded-3xl border border-dashed border-[#3b362f] bg-[#0f0f0d] p-6">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleUpload(e.target.files?.[0] ?? null)}
                    className="w-full text-sm text-[#cfc6b7] file:mr-4 file:rounded-full file:border-0 file:bg-[#c8bfae] file:px-4 file:py-2 file:text-xs file:uppercase file:tracking-[0.3em] file:text-[#0f0f0d] hover:file:bg-[#d9d2c5]"
                  />
                  <p className="mt-3 text-xs text-[#9a9184]">
                    PNG or JPEG recommended. Large files may take longer to process.
                  </p>
                </div>

                <div>
                  <label className="text-xs uppercase tracking-[0.3em] text-[#b9b1a4]">Study Title</label>
                  <input
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    className="mt-3 w-full rounded-full border border-[#3b362f] bg-[#0f0f0d] px-5 py-3 text-sm text-[#f4efe6] placeholder:text-[#7c7265] focus:border-[#c8bfae] focus:outline-none"
                    placeholder="Untitled Study"
                  />
                </div>
              </div>
              <div className="space-y-4">
                <p className="text-xs uppercase tracking-[0.3em] text-[#b9b1a4]">Physical dimensions (cm)</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="text-xs text-[#9a9184]">Height</label>
                    <input
                      value={uploadWidthCm}
                      onChange={(e) => setUploadWidthCm(e.target.value)}
                      className="mt-2 w-full rounded-full border border-[#3b362f] bg-[#0f0f0d] px-4 py-2 text-sm text-[#f4efe6] focus:border-[#c8bfae] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[#9a9184]">Width</label>
                    <input
                      value={uploadHeightCm}
                      onChange={(e) => setUploadHeightCm(e.target.value)}
                      className="mt-2 w-full rounded-full border border-[#3b362f] bg-[#0f0f0d] px-4 py-2 text-sm text-[#f4efe6] focus:border-[#c8bfae] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[#9a9184]">Depth</label>
                    <input
                      value={uploadDepthCm}
                      onChange={(e) => setUploadDepthCm(e.target.value)}
                      className="mt-2 w-full rounded-full border border-[#3b362f] bg-[#0f0f0d] px-4 py-2 text-sm text-[#f4efe6] focus:border-[#c8bfae] focus:outline-none"
                    />
                  </div>
                </div>
                <p className="text-xs text-[#9a9184]">
                  Dimensions convert at 100 cm = 1 unit. Depth can be minimal (0.03 cm default).
                </p>
              </div>
            </div>
          )}
        </section>

        {error && (
          <section className="mt-6 rounded-3xl border border-[#4a2f2a] bg-[#1a1311] p-6 text-sm text-[#f0b9ad]">
            {error}
          </section>
        )}

        {artwork && dimensions && mode === 'met' && (
          <section className="mt-10 rounded-3xl border border-[#2a2722] bg-[#141311] p-6">
            <h3 className="text-xl font-serif text-[#f4efe6]">Relief Preview</h3>
            <div className="mt-4">
              <PaintingProcessor
                imageUrl={artwork.primaryImage}
                dimensions={dimensions}
                title={artwork.title}
              />
            </div>
          </section>
        )}

        {uploadUrl && mode === 'upload' && (
          <section className="mt-10 rounded-3xl border border-[#2a2722] bg-[#141311] p-6">
            <h3 className="text-xl font-serif text-[#f4efe6]">Relief Preview</h3>
            <div className="mt-4">
              <PaintingProcessor
                imageUrl={uploadUrl}
                dimensions={buildUploadDimensions()}
                title={uploadTitle}
              />
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
