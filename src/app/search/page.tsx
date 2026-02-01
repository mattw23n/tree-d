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
    <main className="min-h-screen p-8 bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Met Museum Search
          </h1>
          <p className="text-lg text-gray-600 mb-4">
            Search for public domain artwork with available images
          </p>
          <Link 
            href="/"
            className="text-blue-600 hover:text-blue-800 underline text-sm"
          >
            ← Back to Direct ID Entry
          </Link>
        </div>

        {/* Search Box */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
                Search Artwork
              </label>
              <input
                id="search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="e.g., Monet, sunflowers, landscape, impressionism..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isSearching}
              />
              <p className="mt-2 text-xs text-gray-500">
                Search by artist, title, medium, or keyword. Only public domain works with images will be shown.
              </p>
            </div>
            <button
              onClick={handleSearch}
              disabled={isSearching || !searchQuery.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>

        {/* Loading State */}
        {isSearching && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">
              Searching and filtering for public domain artworks with images...
            </p>
            {displayedResults > 0 && (
              <p className="mt-2 text-sm text-gray-500">
                Processed {displayedResults} of {totalResults} results
              </p>
            )}
          </div>
        )}

        {/* Error State */}
        {error && !isSearching && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Results Grid */}
        {searchResults.length > 0 && !isSearching && (
          <>
            <div className="mb-4 text-sm text-gray-600">
              Found {searchResults.length} public domain artworks with images
              {displayedResults < totalResults && ` (searched ${displayedResults} of ${totalResults} total results)`}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {searchResults.map((result) => (
                <Link
                  key={result.objectID}
                  href={`/view/${result.objectID}`}
                  className="bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow overflow-hidden group"
                >
                  <div className="relative aspect-square bg-gray-200">
                    <img
                      src={result.primaryImageSmall}
                      alt={result.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2 group-hover:text-blue-600 transition-colors">
                      {result.title}
                    </h3>
                    <p className="text-sm text-gray-600 mb-1">
                      {result.artistDisplayName}
                    </p>
                    <p className="text-xs text-gray-500 mb-2">
                      {result.objectDate}
                    </p>
                    <p className="text-xs text-gray-400">
                      {result.department}
                    </p>
                    <div className="mt-3 text-xs text-blue-600 font-medium">
                      View in 3D →
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}

        {/* No Results Yet */}
        {!isSearching && searchResults.length === 0 && !error && (
          <div className="text-center py-12 text-gray-500">
            <svg
              className="mx-auto h-12 w-12 text-gray-400 mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <p>Enter a search term to find artwork from the Met Museum</p>
            <p className="text-sm mt-2">
              Try searching for artists like &quot;Van Gogh&quot;, &quot;Monet&quot;, or keywords like &quot;landscape&quot;
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
