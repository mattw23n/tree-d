'use client';

import { useState } from 'react';
import Link from 'next/link';
import { searchMetArtwork, fetchMetArtwork, MetArtwork } from '@/lib/metApi';

interface SearchResult {
  objectID: number;
  title: string;
  primaryImageSmall: string;
  artistDisplayName: string;
  objectDate: string;
  department: string;
}

export default function SearchPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalResults, setTotalResults] = useState(0);
  const [displayedResults, setDisplayedResults] = useState(0);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setError('Please enter a search term');
      return;
    }

    setIsSearching(true);
    setError(null);
    setSearchResults([]);
    setTotalResults(0);
    setDisplayedResults(0);

    try {
      // Search for artworks
      const objectIDs = await searchMetArtwork(searchQuery);
      
      if (!objectIDs || objectIDs.length === 0) {
        setError('No results found. Try a different search term.');
        setIsSearching(false);
        return;
      }

      setTotalResults(objectIDs.length);

      // Fetch details for the first 20 objects and filter for public domain with images
      const results: SearchResult[] = [];
      let processed = 0;
      
      for (const objectID of objectIDs.slice(0, 50)) {
        if (results.length >= 20) break; // Stop once we have 20 valid results
        
        try {
          const artwork = await fetchMetArtwork(objectID);
          processed++;
          
          // Filter: must be public domain AND have a primary image
          if (artwork?.isPublicDomain && artwork?.primaryImage) {
            results.push({
              objectID: artwork.objectID,
              title: artwork.title || 'Untitled',
              primaryImageSmall: artwork.primaryImageSmall || artwork.primaryImage,
              artistDisplayName: artwork.artistDisplayName || 'Unknown Artist',
              objectDate: artwork.objectDate || 'Date unknown',
              department: artwork.department || 'Unknown',
            });
          }
        } catch (err) {
          console.error(`Error fetching object ${objectID}:`, err);
          // Continue to next object
        }
      }

      setSearchResults(results);
      setDisplayedResults(processed);

      if (results.length === 0) {
        setError('No public domain artworks with images found. Try a different search term.');
      }

      setIsSearching(false);
    } catch (err) {
      console.error('Search error:', err);
      setError('Search failed. Please try again.');
      setIsSearching(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <main className="min-h-screen bg-[#0f0f0d] text-[#e8e2d5]">
      <div className="mx-auto max-w-6xl px-6 py-10 sm:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#2a2722] pb-6">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.3em] text-[#b9b1a4]">Tree-D Studio</p>
            <h1 className="text-2xl font-serif text-[#f4efe6]">Curatorial Search</h1>
          </div>
          <nav className="flex gap-6 text-sm text-[#b9b1a4]">
            <a className="hover:text-[#f4efe6] transition" href="/">Landing</a>
            <a className="hover:text-[#f4efe6] transition" href="/demo">Demo</a>
            <a href='https://github.com/mattw23n/tree-d' target='_blank'>
              <img height={20} width={20} src={"https://cdn.simpleicons.org/github/f4efe6"}/>
            </a>
          </nav>
        </header>

        <section className="mt-12 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.4em] text-[#a79f92]">Metropolitan Museum Archive</p>
            <h2 className="text-4xl font-serif leading-tight text-[#f7f1e7] sm:text-5xl">
              Select a painting to convert into relief
            </h2>
            <p className="text-lg text-[#cfc6b7] leading-relaxed">
              Search by artist, title, or medium. We only surface public-domain works with available imagery
              to preserve the integrity of the collection and deliver accurate depth conversion.
            </p>
          </div>
          <div className="rounded-3xl border border-[#2a2722] bg-gradient-to-b from-[#1a1815] via-[#12110f] to-[#0f0f0d] p-6">
            <p className="text-xs uppercase tracking-[0.3em] text-[#b9b1a4]">Search Notes</p>
            <ul className="mt-4 space-y-3 text-sm text-[#cfc6b7]">
              <li className="flex gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-[#c8bfae]" />
                Only public-domain works with primary images appear.
              </li>
              <li className="flex gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-[#c8bfae]" />
                We sample the first 50 matches to curate the top 20.
              </li>
              <li className="flex gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-[#c8bfae]" />
                Select any work to open the 3D viewer.
              </li>
            </ul>
          </div>
        </section>

        <section className="mt-12 rounded-3xl border border-[#2a2722] bg-[#141311] p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label htmlFor="search" className="block text-xs uppercase tracking-[0.3em] text-[#b9b1a4]">
                Search the archive
              </label>
              <input
                id="search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Monet, sunflowers, portrait, landscape..."
                className="mt-3 w-full rounded-full border border-[#3b362f] bg-[#0f0f0d] px-5 py-3 text-sm text-[#f4efe6] placeholder:text-[#7c7265] focus:border-[#c8bfae] focus:outline-none"
                disabled={isSearching}
              />
              <p className="mt-3 text-xs text-[#9a9184]">
                Search by artist, title, medium, or keyword. We only show public-domain works with images.
              </p>
            </div>
            <button
              onClick={handleSearch}
              disabled={isSearching || !searchQuery.trim()}
              className="rounded-full border border-[#c8bfae] px-6 py-3 text-sm text-[#f4efe6] hover:bg-[#c8bfae] hover:text-[#0f0f0d] transition disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[#f4efe6]"
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </div>
        </section>

        {isSearching && (
          <section className="mt-10 rounded-3xl border border-[#2a2722] bg-[#141311] p-8 text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-[#c8bfae] border-t-transparent" />
            <p className="mt-4 text-sm text-[#cfc6b7]">
              Curating public-domain works with available images...
            </p>
            {displayedResults > 0 && (
              <p className="mt-2 text-xs text-[#9a9184]">
                Processed {displayedResults} of {totalResults} results
              </p>
            )}
          </section>
        )}

        {error && !isSearching && (
          <section className="mt-10 rounded-3xl border border-[#4a2f2a] bg-[#1a1311] p-6 text-sm text-[#f0b9ad]">
            {error}
          </section>
        )}

        {searchResults.length > 0 && !isSearching && (
          <section className="mt-10">
            <div className="mb-4 text-xs uppercase tracking-[0.3em] text-[#b9b1a4]">
              Found {searchResults.length} works
              {displayedResults < totalResults && ` (searched ${displayedResults} of ${totalResults})`}
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {searchResults.map((result) => (
                <Link
                  key={result.objectID}
                  href={`/view/${result.objectID}`}
                  className="group rounded-3xl border border-[#2a2722] bg-[#141311] overflow-hidden transition hover:border-[#c8bfae]"
                >
                  <div className="relative aspect-[4/5] bg-[#1a1815]">
                    <img
                      src={result.primaryImageSmall}
                      alt={result.title}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-5">
                    <h3 className="text-lg font-serif text-[#f4efe6] leading-snug">
                      {result.title}
                    </h3>
                    <p className="mt-2 text-sm text-[#cfc6b7]">{result.artistDisplayName}</p>
                    <div className="mt-3 flex items-center justify-between text-xs text-[#9a9184]">
                      <span>{result.objectDate}</span>
                      <span className="uppercase tracking-[0.2em]">{result.department}</span>
                    </div>
                    <div className="mt-4 text-xs text-[#c8bfae]">View in 3D →</div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {!isSearching && searchResults.length === 0 && !error && (
          <section className="mt-10 rounded-3xl border border-[#2a2722] bg-[#141311] p-10 text-center">
            <p className="text-sm text-[#cfc6b7]">
              Begin with an artist, medium, or era to reveal works suitable for relief translation.
            </p>
            <p className="mt-2 text-xs text-[#9a9184]">
              Try “Van Gogh”, “Impressionism”, or “landscape”.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
