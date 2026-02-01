/**
 * Met Museum API Service
 * Fetches artwork data from the Met Museum Collection API
 */

export interface MetArtwork {
  objectID: number;
  title: string;
  primaryImage: string;
  primaryImageSmall: string;
  dimensions: string;
  department: string;
  culture: string;
  period: string;
  dynasty: string;
  reign: string;
  portfolio: string;
  artistRole: string;
  artistPrefix: string;
  artistDisplayName: string;
  artistDisplayBio: string;
  artistSuffix: string;
  artistAlphaSort: string;
  artistNationality: string;
  artistBeginDate: string;
  artistEndDate: string;
  artistGender: string;
  artistWikidata_URL: string;
  artistULAN_URL: string;
  objectDate: string;
  objectBeginDate: number;
  objectEndDate: number;
  medium: string;
  measurements: Array<{
    elementName: string;
    elementDescription: string;
    elementMeasurements: {
      Height: number;
      Width: number;
      Depth?: number;
    };
  }>;
  creditLine: string;
  geographyType: string;
  city: string;
  state: string;
  county: string;
  country: string;
  region: string;
  subregion: string;
  locale: string;
  locus: string;
  excavation: string;
  river: string;
  classification: string;
  rightsAndReproduction: string;
  linkResource: string;
  metadataDate: string;
  repository: string;
  objectURL: string;
  tags: Array<{
    term: string;
    AAT_URL: string;
    Wikidata_URL: string;
  }>;
  objectWikidata_URL: string;
  isTimelineWork: boolean;
  isPublicDomain: boolean;
  GalleryNumber: string;
}

/**
 * Fetches artwork data from the Met Museum API
 * @param objectId - The Met Museum object ID
 * @returns Promise with artwork data or null if not found
 */
export async function fetchMetArtwork(objectId: number): Promise<MetArtwork | null> {
  try {
    const response = await fetch(
      `https://collectionapi.metmuseum.org/public/collection/v1/objects/${objectId}`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    // Check if the object has the required fields
    if (!data.objectID) {
      return null;
    }

    return data as MetArtwork;
  } catch (error) {
    console.error('Error fetching Met artwork:', error);
    throw error;
  }
}

/**
 * Search for artworks in the Met Museum collection
 * @param query - Search query string
 * @returns Promise with array of object IDs or empty array if no results
 */
export async function searchMetArtwork(query: string): Promise<number[]> {
  try {
    const response = await fetch(
      `https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&isPublicDomain=true&medium=Paintings&q=${encodeURIComponent(query)}`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return [];
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    // The API returns { total: number, objectIDs: number[] | null }
    if (!data.objectIDs || data.objectIDs.length === 0) {
      return [];
    }

    return data.objectIDs;
  } catch (error) {
    console.error('Error searching Met artworks:', error);
    throw error;
  }
}
