// lib/tvLookup.ts
//
// TV Shows' TMDb integration - its own file rather than folded into
// lib/movieLookup.ts, even though both use TMDb: TV shows have their
// own official genre taxonomy (confirmed via TMDb's live API - notably
// different from Movies': no separate Horror/Thriller/Romance, but
// Kids/News/Reality/Soap/Talk exist here that don't for movies), and
// TMDb's TV endpoints use different field names entirely (`name` instead
// of `title`, `first_air_date` instead of `release_date`) - not a
// drop-in reuse of the Movies code despite the surface similarity.
//
// TV Shows has no barcode/number entry at all (confirmed design - title
// search is the only assisted entry method). Movies later dropped its
// own barcode/UPC entry too, after real testing confirmed it was
// unreliable - the two are now structural twins in this specific way,
// though this file stayed separate from movieLookup.ts regardless,
// since the genre/field-name differences above are real and unrelated
// to that later change.
//
// NOTE: not network-tested from the sandbox this was written in.

import { TMDB_READ_ACCESS_TOKEN } from './config';

// TMDb's own official TV genre list, verified directly against their
// live API response - a genuinely different set from Movies' (see file
// header above), not assumed to match just because both come from TMDb.
const TMDB_TV_GENRE_MAP: Record<number, string> = {
  10759: 'Action & Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  10762: 'Kids',
  9648: 'Mystery',
  10763: 'News',
  10764: 'Reality',
  10765: 'Sci-Fi & Fantasy',
  10766: 'Soap',
  10767: 'Talk',
  10768: 'War & Politics',
  37: 'Western',
};

export const TMDB_TV_GENRE_NAMES = Object.values(TMDB_TV_GENRE_MAP);

export interface TVShowLookupResult {
  tmdbId?: number;
  title?: string;
  genres: string[];
  firstAirYear?: string;
  coverUrl?: string;
}

/** Shared low-level TMDb TV search - returns up to maxResults candidates.
 * Reused directly by lib/titleSearch.ts's searchTVShowsByTitle(), same
 * split as movieLookup.ts's tmdbSearchMovies(). */
export async function tmdbSearchTVShows(query: string, maxResults: number): Promise<TVShowLookupResult[]> {
  if (!TMDB_READ_ACCESS_TOKEN) {
    console.warn(
      'Media Base: TMDB_READ_ACCESS_TOKEN is not set - get a free one from themoviedb.org, then add it as EXPO_PUBLIC_TMDB_READ_ACCESS_TOKEN in .env (local) and as an EAS environment variable (cloud builds) to enable TV Shows auto-fill.',
    );
    return [];
  }
  const res = await fetch(`https://api.themoviedb.org/3/search/tv?query=${encodeURIComponent(query)}`, {
    headers: { Authorization: `Bearer ${TMDB_READ_ACCESS_TOKEN}`, accept: 'application/json' },
  });
  if (!res.ok) {
    console.warn('Media Base: TMDb (TV) returned', res.status);
    return [];
  }
  const json = await res.json();
  const results = Array.isArray(json?.results) ? json.results.slice(0, maxResults) : [];
  return results.map((match: any) => {
    const genres = Array.isArray(match.genre_ids)
      ? match.genre_ids.map((id: number) => TMDB_TV_GENRE_MAP[id]).filter(Boolean)
      : [];
    return {
      tmdbId: typeof match.id === 'number' ? match.id : undefined,
      // TV shows use `name`, not `title` - a real field-name difference
      // from Movies, not an oversight if this looks inconsistent.
      title: match.name as string | undefined,
      genres,
      firstAirYear: match.first_air_date ? String(match.first_air_date).slice(0, 4) : undefined,
      coverUrl: match.poster_path ? `https://image.tmdb.org/t/p/w500${match.poster_path}` : undefined,
    };
  });
}

/** The URL "Where to Watch" opens - TMDb's own watch page for this show,
 * which already has correct JustWatch attribution/branding built in.
 * Deliberately NOT a custom in-app provider list: that data is licensed
 * from JustWatch and requires attribution everywhere it's shown, not
 * just once in Credits - linking to TMDb's own page sidesteps needing to
 * build and maintain that ourselves. Region-specific (results vary by
 * country) - defaults to US, matching everything else in this app so
 * far; worth revisiting if international support is ever needed. */
export function tmdbWatchUrl(tmdbId: number): string {
  return `https://www.themoviedb.org/tv/${tmdbId}/watch?locale=US`;
}
