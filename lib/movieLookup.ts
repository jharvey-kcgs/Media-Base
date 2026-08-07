// lib/movieLookup.ts
//
// Renamed from lib/upcLookup.ts - Movies dropped barcode/UPC scanning
// entirely after real testing confirmed it was unreliable (the multi-hop
// UPC -> messy retail title -> TMDb search chain was always the
// structurally weaker path here, unlike Books/Comics' direct ISBN
// lookup). Title Search - already the reliable path being used in
// practice - is now the only entry-assist method, matching TV Shows
// exactly. This file kept its still-relevant pieces (TMDb's genre list,
// the shared search function, the watch-page URL) and dropped the
// UPC-specific pipeline (UPCitemdb lookup, the retail-title cleanup
// regex, and the two-step orchestration function) as genuinely dead
// code rather than leaving it unused. looksLikeIsbn() also stayed - not
// Movies-specific logic, still relevant if a future UPC-based category
// (Vinyl/CD, Tabletop Games) is ever built.

import { TMDB_READ_ACCESS_TOKEN } from './config';

// TMDb's own official movie genre list, verified directly against their
// live API response (id -> name) rather than guessed. Exported as
// TMDB_GENRE_NAMES for MovieScreen.tsx's genre allowlist/filter - unlike
// Books/Comics, this doesn't need a separate normalizeGenres() pass at
// all, since TMDb's genre_ids already map to this exact clean, fixed
// list with no free-text noise to filter out.
const TMDB_GENRE_MAP: Record<number, string> = {
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  36: 'History',
  27: 'Horror',
  10402: 'Music',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Science Fiction',
  10770: 'TV Movie',
  53: 'Thriller',
  10752: 'War',
  37: 'Western',
};

export const TMDB_GENRE_NAMES = Object.values(TMDB_GENRE_MAP);

export interface MovieLookupResult {
  tmdbId?: number;
  title?: string;
  genres: string[];
  releaseYear?: string;
  coverUrl?: string;
}

// An ISBN is structurally just an EAN-13 barcode in the reserved
// "Bookland" 978/979 prefix range - always true, not a guess. Not
// Movies-specific despite living in this file - kept for any future
// UPC-based category (Vinyl/CD, Tabletop Games) that could hit the same
// bundled-print-material ambiguity a physical UPC-scanning item can have
// (a boxed set that bundles a book/booklet, printing both barcodes on
// the case). Currently unused by Movies itself, which dropped UPC
// scanning entirely.
export function looksLikeIsbn(digits: string): boolean {
  return digits.length === 13 && (digits.startsWith('978') || digits.startsWith('979'));
}

/** Shared low-level TMDb search - returns up to maxResults candidates.
 * Reused directly by lib/titleSearch.ts's searchMoviesByTitle(), the
 * only entry-assist method Movies has now. */
export async function tmdbSearchMovies(query: string, maxResults: number): Promise<MovieLookupResult[]> {
  if (!TMDB_READ_ACCESS_TOKEN) {
    console.warn(
      'Media Base: TMDB_READ_ACCESS_TOKEN is not set in lib/config.ts - get a free one from themoviedb.org to enable Movies auto-fill.',
    );
    return [];
  }
  const res = await fetch(`https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(query)}`, {
    headers: { Authorization: `Bearer ${TMDB_READ_ACCESS_TOKEN}`, accept: 'application/json' },
  });
  if (!res.ok) {
    console.warn('Media Base: TMDb returned', res.status);
    return [];
  }
  const json = await res.json();
  const results = Array.isArray(json?.results) ? json.results.slice(0, maxResults) : [];
  return results.map((match: any) => {
    const genres = Array.isArray(match.genre_ids)
      ? match.genre_ids.map((id: number) => TMDB_GENRE_MAP[id]).filter(Boolean)
      : [];
    return {
      tmdbId: typeof match.id === 'number' ? match.id : undefined,
      title: match.title as string | undefined,
      genres,
      releaseYear: match.release_date ? String(match.release_date).slice(0, 4) : undefined,
      // TMDb's documented, stable image CDN base URL - w500 is a
      // reasonable fixed size for a poster that only ever gets displayed
      // small (list thumbnail) or medium (edit screen).
      coverUrl: match.poster_path ? `https://image.tmdb.org/t/p/w500${match.poster_path}` : undefined,
    };
  });
}

/** The URL "Where to Watch" opens - TMDb's own watch page for this
 * movie. Same reasoning as lib/tvLookup.ts's tmdbWatchUrl(): links to
 * TMDb's own page (already has correct JustWatch attribution/branding)
 * rather than building a custom in-app provider list, which would carry
 * an attribution requirement everywhere that data is shown, not just
 * once in Credits. Defaults to the US region - not yet configurable. */
export function tmdbMovieWatchUrl(tmdbId: number): string {
  return `https://www.themoviedb.org/movie/${tmdbId}/watch?locale=US`;
}
