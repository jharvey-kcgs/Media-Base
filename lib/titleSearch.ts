// lib/titleSearch.ts
//
// The third entry method, alongside scan and number-entry: type a title,
// get a short list of real candidates back, tap the right one, every
// field that candidate has gets filled in at once. Meant for the cases
// scan/ISBN-or-UPC-entry can't cover - no working camera, a damaged or
// unknown barcode, a thrifted book with a sticker over part of it.
//
// Books/Comics both search Google Books (the same source runIsbnLookup
// already uses) by title instead of ISBN - reuses normalizeGenres() from
// lib/isbnLookup.ts so results go through the exact same genre-allowlist
// matching. Movies reuses lib/upcLookup.ts's tmdbSearchMovies() directly,
// since that's the same TMDb search the UPC pipeline's second step
// already calls, just asking for several results instead of one.
//
// Deliberately different result shapes per category rather than one
// forced-generic type: Movies results never carry a UPC at all - UPC
// identifies a specific physical disc/release, not "the movie" as a
// concept, so there's no correct number to backfill from a title search
// the way there is for books.
//
// NOTE: not network-testable from the sandbox this was written in.

import { normalizeGenres } from './isbnLookup';
import { tmdbSearchMovies, UpcMovieLookupResult } from './upcLookup';

export interface BookTitleSearchResult {
  key: string; // Google Books volume ID - always present, stable, unique
  isbn: string; // '' if this record has no ISBN on file (common, even for well-known titles - see below)
  title: string;
  author?: string;
  genres: string[];
}

/** Searches Google Books by title (shared by Books and Comics/Manga -
 * pass each screen's own genre allowlist). Returns up to `maxResults`
 * candidates. ISBN is NOT required to be present - an earlier version of
 * this filtered out every result missing one, reasoning "the whole point
 * is filling that field in too", but that was a real bug: Google Books'
 * title-search results frequently omit industryIdentifiers entirely,
 * even for extremely well-known titles - confirmed as the actual cause
 * of a reported 100% failure rate on real searches (Harry Potter, The
 * Hunger Games, etc.). A result without an ISBN is still genuinely
 * useful - title/author/genre still fill in correctly, the ISBN field
 * just stays whatever it was, same as manual entry. */
export async function searchBooksByTitle(
  query: string,
  genreAllowlist: string[],
  maxResults = 8,
): Promise<BookTitleSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const res = await fetch(
    `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(`intitle:"${trimmed}"`)}&maxResults=${maxResults}`,
  );
  if (!res.ok) {
    if (res.status !== 429) {
      // Same reasoning as lookupGoogleBooks in isbnLookup.ts - 429 is
      // routine during a busy search session, not worth logging as if
      // unexpected.
      console.warn('Media Base: Google Books title search returned', res.status);
    }
    return [];
  }
  const json = await res.json();
  const items = Array.isArray(json?.items) ? json.items : [];

  const results: BookTitleSearchResult[] = [];
  for (const item of items) {
    const info = item?.volumeInfo;
    if (!info?.title || !item?.id) continue;
    const ids = Array.isArray(info.industryIdentifiers) ? info.industryIdentifiers : [];
    const isbn13 = ids.find((i: any) => i.type === 'ISBN_13')?.identifier;
    const isbn10 = ids.find((i: any) => i.type === 'ISBN_10')?.identifier;
    results.push({
      key: item.id as string,
      isbn: isbn13 || isbn10 || '',
      title: info.title as string,
      author: Array.isArray(info.authors) ? info.authors[0] : undefined,
      genres: normalizeGenres(info.categories, genreAllowlist),
    });
  }
  // Diagnostic, not a warning about anything wrong - helps confirm at a
  // glance whether a "no matches" report is genuinely zero raw results
  // from Google Books, versus something being filtered out afterward.
  console.warn('Media Base: title search for', `"${trimmed}"`, '->', items.length, 'raw,', results.length, 'usable');
  return results;
}

/** Searches TMDb by movie title - thin wrapper around
 * lib/upcLookup.ts's tmdbSearchMovies(), which the UPC pipeline's own
 * second step already uses for a single best match. No UPC field on the
 * result - see the file-level note above for why. */
export async function searchMoviesByTitle(query: string, maxResults = 8): Promise<UpcMovieLookupResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  return tmdbSearchMovies(trimmed, maxResults);
}
