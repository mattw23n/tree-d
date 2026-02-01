'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Gallery3D from '@/components/Gallery3D';

function GalleryViewContent() {
  const searchParams = useSearchParams();
  const idsParam = searchParams.get('ids');
  const ids = idsParam ? idsParam.split(',').map(id => id.trim()) : [];

  if (ids.length === 0) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">No Paintings Selected</h1>
          <p className="text-gray-400 mb-6">Please provide painting IDs to create your gallery</p>
          <a
            href="/gallery"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg inline-block"
          >
            Go Back
          </a>
        </div>
      </div>
    );
  }

  return <Gallery3D paintingIds={ids} />;
}

export default function GalleryViewPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Loading gallery...</p>
        </div>
      </div>
    }>
      <GalleryViewContent />
    </Suspense>
  );
}
