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
// forced-generic type: Books/Comics results always carry an ISBN (results
// missing one are filtered out entirely, since the whole point is
// filling that field in too); Movies results never carry a UPC at all -
// UPC identifies a specific physical disc/release, not "the movie" as a
// concept, so there's no correct number to backfill from a title search
// the way there is for books. This is a deliberate difference from
// Books/Comics, not a gap.
//
// NOTE: not network-testable from the sandbox this was written in.

import { normalizeGenres } from './isbnLookup';
import { tmdbSearchMovies, UpcMovieLookupResult } from './upcLookup';

export interface BookTitleSearchResult {
  isbn: string; // always present - results without one are filtered out
  title: string;
  author?: string;
  genres: string[];
}

/** Searches Google Books by title (shared by Books and Comics/Manga -
 * pass each screen's own genre allowlist). Returns up to `maxResults`
 * candidates, each guaranteed to have a real ISBN. */
export async function searchBooksByTitle(
  query: string,
  genreAllowlist: string[],
  maxResults = 8,
): Promise<BookTitleSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const res = await fetch(
    `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(`intitle:${trimmed}`)}&maxResults=${maxResults}`,
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
    if (!info?.title) continue;
    const ids = Array.isArray(info.industryIdentifiers) ? info.industryIdentifiers : [];
    const isbn13 = ids.find((i: any) => i.type === 'ISBN_13')?.identifier;
    const isbn10 = ids.find((i: any) => i.type === 'ISBN_10')?.identifier;
    const isbn = isbn13 || isbn10;
    if (!isbn) continue; // filtered out - can't fill the ISBN field without one
    results.push({
      isbn,
      title: info.title as string,
      author: Array.isArray(info.authors) ? info.authors[0] : undefined,
      genres: normalizeGenres(info.categories, genreAllowlist),
    });
  }
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
