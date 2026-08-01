// lib/upcLookup.ts
//
// Movies' entry-assist pipeline, in two steps - UPC codes don't carry
// genre/metadata themselves the way ISBNs effectively do via Open
// Library/Google Books, so this always needs two lookups:
// 1. UPC -> a rough product title, via UPCitemdb's free trial endpoint
//    (upcitemdb.com/api) - no signup/API key needed, 100 requests/day.
//    Retail UPC titles are messy ("The Matrix (1999) [Blu-ray] [WS]"),
//    so the title gets cleaned up before the next step.
// 2. Cleaned title -> real movie metadata (title, genres, release year),
//    via TMDb's (The Movie Database) search endpoint - this DOES need a
//    free API key, see lib/config.ts.
//
// NOTE: not network-testable from the sandbox this was written in - the
// title-cleaning regex in particular is a first pass based on common
// disc-packaging conventions, not verified against real UPCitemdb
// responses. If real lookups are consistently landing on the wrong
// movie, checking what UPCitemdb's raw title actually looks like for a
// few real UPCs (logged via console.warn on every lookup) is the first
// thing to check before assuming TMDb's search itself is at fault.

import { TMDB_API_KEY } from './config';

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

export interface UpcMovieLookupResult {
  title?: string;
  genres: string[];
  releaseYear?: string;
}

async function lookupUpcItem(upc: string): Promise<string | null> {
  const res = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${upc}`);
  if (!res.ok) {
    console.warn('Media Base: UPCitemdb returned', res.status);
    return null;
  }
  const json = await res.json();
  const rawTitle = json?.items?.[0]?.title as string | undefined;
  if (!rawTitle) return null;
  // Logged deliberately on every successful lookup, not just failures -
  // this is the single most useful diagnostic for tuning
  // cleanMovieTitle() below against what real UPCitemdb responses
  // actually look like, which wasn't verifiable from this sandbox.
  console.warn('Media Base: UPCitemdb raw title for', upc, '->', rawTitle);
  return rawTitle;
}

// Strips common disc-packaging noise so what's left searches TMDb as
// close to just the movie's actual title as possible. A first-pass
// heuristic, not verified against real UPCitemdb data - see the
// file-level note above if titles are landing on the wrong movie.
function cleanMovieTitle(raw: string): string {
  return raw
    .replace(/\[[^\]]*\]/g, ' ') // anything in [brackets] - "[Blu-ray]", "[WS]", etc.
    .replace(
      /\((?:blu-?ray|dvd|4k(?:\s*ultra\s*hd)?|uhd|widescreen|full\s*screen|ws|fs|steelbook|collector'?s?\s*edition|special\s*edition|anniversary\s*edition|director'?s?\s*cut|\d{4})\)/gi,
      ' ',
    ) // common parenthetical packaging/format noise, including a bare release year
    .replace(/\b(blu-?ray|dvd|4k\s*ultra\s*hd|uhd|widescreen|full\s*screen|steelbook)\b/gi, ' ') // same words without brackets/parens
    .replace(/\s+/g, ' ')
    .trim();
}

async function searchTmdbMovie(title: string): Promise<UpcMovieLookupResult | null> {
  if (!TMDB_API_KEY) {
    console.warn(
      'Media Base: TMDB_API_KEY is not set in lib/config.ts - get a free key from themoviedb.org to enable Movies auto-fill.',
    );
    return null;
  }
  const res = await fetch(
    `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}`,
  );
  if (!res.ok) {
    console.warn('Media Base: TMDb returned', res.status);
    return null;
  }
  const json = await res.json();
  const match = json?.results?.[0];
  if (!match) return null;
  const genres = Array.isArray(match.genre_ids)
    ? match.genre_ids.map((id: number) => TMDB_GENRE_MAP[id]).filter(Boolean)
    : [];
  return {
    title: match.title as string | undefined,
    genres,
    releaseYear: match.release_date ? String(match.release_date).slice(0, 4) : undefined,
  };
}

export async function runUpcMovieLookup(upc: string): Promise<UpcMovieLookupResult | null> {
  const rawTitle = await lookupUpcItem(upc).catch((err) => {
    console.warn('Media Base: UPCitemdb lookup threw', err);
    return null;
  });
  if (!rawTitle) return null;
  const cleaned = cleanMovieTitle(rawTitle);
  if (!cleaned) return null;
  return searchTmdbMovie(cleaned).catch((err) => {
    console.warn('Media Base: TMDb search threw', err);
    return null;
  });
}
