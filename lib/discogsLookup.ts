// lib/discogsLookup.ts
//
// Vinyl/CD's barcode and title-search lookup - Discogs' database API.
// Needs a personal user-token (lib/config.ts's DISCOGS_USER_TOKEN) -
// unlike Books/Comics' ISBN lookup, there's no keyless source for real
// vinyl/CD release metadata. Rate limit is 60 requests/minute
// authenticated - real, but far more workable day-to-day than
// MusicBrainz's ~1/second ever was for Music, especially for a personal
// app adding entries one at a time rather than bulk-importing.
//
// Confirmed via real research before writing this, not guessed:
// - Discogs' search results return a COMBINED "Artist - Title" string
//   in the title field (e.g. "Miles Davis - Kind Of Blue"), not
//   separate fields the way TMDb/MusicBrainz search results do - every
//   result needs splitting on " - " to get artist and title apart.
// - genre and style are both arrays (Discogs' own hierarchy: genre is
//   the broad grouping like "Rock", style is the more specific
//   sub-genre like "Hard Rock") - both get combined into this app's
//   single genre field, matching every other category's one-genre-field
//   convention (see types/models.ts's VinylCD comment for why there's
//   no separate style field).
// - cover_image comes bundled directly in the search response - no
//   separate cover-art service needed, unlike Music's whole Cover Art
//   Archive saga (wrong image format, missing headers, flaky 500s).
// - The barcode param is a real, direct search filter
//   (?barcode=...&type=release), not a fuzzy multi-hop chain the way
//   Movies' old UPC approach turned out to be - a real, structured
//   match, closer in spirit to Books' ISBN lookup than to Board Games'
//   still-planned "UPC then fuzzy name match" approach.
//
// NOTE: not network-tested from the sandbox this was written in.

import { DISCOGS_USER_TOKEN } from './config';

const USER_AGENT = 'MediaBase/1.0 +https://github.com/JHarvey/Media-Base';

export interface DiscogsSearchResult {
  key: string; // Discogs release id, as a string - stable, unique
  releaseId: number;
  title: string; // just the release title - artist already split off, see splitDiscogsTitle()
  artist: string;
  genres: string[]; // genre + style combined, deduped - see combineGenres()
  coverUrl: string | null;
  releaseYear?: string;
}

// Splits Discogs' combined "Artist - Title" search-result string apart.
// Falls back to using the whole string as the title (artist left blank)
// when no " - " separator is found - a "Various Artists" compilation or
// an unusually-formatted release can legitimately not have one, and
// leaving artist blank is safer than guessing wrong at which half is
// which.
function splitDiscogsTitle(raw: string): { artist: string; title: string } {
  const match = raw.match(/^(.+?)\s+-\s+(.+)$/);
  if (match) {
    return { artist: match[1].trim(), title: match[2].trim() };
  }
  return { artist: '', title: raw.trim() };
}

// Discogs' genre/style fields are documented as arrays, but this
// defends against either coming back as a single string anyway - some
// APIs are inconsistent about this in practice, and there's no upside
// to trusting the documented shape blindly when a defensive check costs
// nothing.
function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
  if (typeof value === 'string') return [value];
  return [];
}

function combineGenres(genre: unknown, style: unknown): string[] {
  const combined = [...toStringArray(genre), ...toStringArray(style)];
  // Dedupe case-insensitively (Discogs' own genre/style lists don't
  // overlap in practice, but defends against it anyway), preserving
  // first-seen casing/order - genre (broader) always listed first here,
  // so it naturally comes first in the combined result too.
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const g of combined) {
    if (!seen.has(g.toLowerCase())) {
      seen.add(g.toLowerCase());
      deduped.push(g);
    }
  }
  return deduped;
}

function mapResult(r: any): DiscogsSearchResult | null {
  if (!r?.id || !r?.title) return null;
  const { artist, title } = splitDiscogsTitle(r.title as string);
  return {
    key: String(r.id),
    releaseId: r.id,
    title,
    artist,
    genres: combineGenres(r.genre, r.style),
    coverUrl: r.cover_image || r.thumb || null,
    releaseYear: r.year ? String(r.year) : undefined,
  };
}

async function discogsSearch(params: Record<string, string>): Promise<DiscogsSearchResult[]> {
  if (!DISCOGS_USER_TOKEN) {
    console.warn('Media Base: DISCOGS_USER_TOKEN is not set in lib/config.ts - Vinyl/CD lookup is unavailable until it is');
    return [];
  }
  const query = new URLSearchParams({ ...params, type: 'release', per_page: '8', token: DISCOGS_USER_TOKEN });
  const url = `https://api.discogs.com/database/search?${query.toString()}`;
  const safeUrlForLogging = url.replace(DISCOGS_USER_TOKEN, '<token>');
  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) {
      console.warn('Media Base: Discogs search returned', res.status, safeUrlForLogging);
      return [];
    }
    const json = await res.json();
    const results = Array.isArray(json?.results) ? json.results : [];
    const mapped = results
      .map(mapResult)
      .filter((r: DiscogsSearchResult | null): r is DiscogsSearchResult => r !== null);
    console.warn('Media Base: Discogs search', JSON.stringify(params), '->', results.length, 'raw,', mapped.length, 'usable');
    return mapped;
  } catch (err) {
    console.warn('Media Base: Discogs search threw', safeUrlForLogging, err);
    return [];
  }
}

/** Barcode lookup - the scan/code-entry path. The caller is responsible
 * for checking looksLikeIsbn() first (exported from lib/movieLookup.ts,
 * kept there specifically for reuse by a future UPC-based category like
 * this one) before calling this with a scanned code - a Vinyl/CD box
 * set can bundle a booklet with its own ISBN barcode printed right next
 * to the disc's real UPC, and scanning the wrong one by mistake is a
 * real failure mode that guard exists specifically to catch. */
export async function searchDiscogsByBarcode(barcode: string): Promise<DiscogsSearchResult[]> {
  return discogsSearch({ barcode });
}

/** Title search - splits an "Artist - Title" pattern typed into the
 * search box (same trick already proven for Music's search) into
 * separate release_title/artist query params when present, for a more
 * precise match on a common title; falls back to a plain title-only
 * search otherwise. */
export async function searchDiscogsByTitle(query: string): Promise<DiscogsSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const match = trimmed.match(/^(.+?)\s+-\s+(.+)$/);
  if (match) {
    return discogsSearch({ artist: match[1].trim(), release_title: match[2].trim() });
  }
  return discogsSearch({ release_title: trimmed });
}
