// lib/titleSearch.ts
//
// The third entry method, alongside scan and number-entry: type a title,
// get a short list of real candidates back, tap the right one, every
// field that candidate has gets filled in at once. Meant for the cases
// scan/ISBN-or-UPC-entry can't cover - no working camera, a damaged or
// unknown barcode, a thrifted book with a sticker over part of it.
//
// Books/Comics search Google Books first, falling back to Open Library
// if that comes back empty or rate-limited - the same multi-source
// resilience pattern lib/isbnLookup.ts already uses for ISBN lookup,
// applied here for the same reason: real testing confirmed Google
// Books' free keyless quota getting rate-limited (429) specifically on
// title search, which fires on nearly every keystroke pause and hits
// that shared quota far harder than the occasional ISBN-blur lookup
// ever does. Open Library is a fully independent source with its own
// quota, so it keeps working even while Google Books is throttled.
// Reuses normalizeGenres() from lib/isbnLookup.ts either way, so results
// go through the exact same genre-allowlist matching regardless of
// which source actually answered.
//
// Movies reuses lib/upcLookup.ts's tmdbSearchMovies() directly, since
// that's the same TMDb search the UPC pipeline's second step already
// calls, just asking for several results instead of one.
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

const OPEN_LIBRARY_USER_AGENT = 'MediaBase/1.0 (contact: JHarvey.appdeveloper@gmail.com)';

export interface BookTitleSearchResult {
  key: string; // stable, unique per result (Google Books volume ID, or Open Library work key)
  isbn: string; // '' if this record has no ISBN on file (common, even for well-known titles - see below)
  title: string;
  author?: string;
  genres: string[];
}

async function searchGoogleBooksByTitle(
  trimmed: string,
  genreAllowlist: string[],
  maxResults: number,
): Promise<BookTitleSearchResult[]> {
  const res = await fetch(
    `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(`intitle:"${trimmed}"`)}&maxResults=${maxResults}`,
  );
  if (!res.ok) {
    // Deliberately NOT suppressing 429 here the way lookupGoogleBooks
    // (isbnLookup.ts) does for the occasional ISBN-blur lookup - title
    // search fires on nearly every keystroke pause while typing, which
    // hits Google Books' free keyless quota far harder and far more
    // often. Silencing it would hide exactly the evidence needed to
    // tell "genuinely no matches" apart from "got rate-limited" - which
    // is precisely what a real 429 turned out to be, confirmed via this
    // exact log line.
    console.warn('Media Base: Google Books title search returned', res.status);
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
  console.warn('Media Base: Google Books title search for', `"${trimmed}"`, '->', items.length, 'raw,', results.length, 'usable');
  return results;
}

// Independent fallback, tried only when Google Books comes back empty
// (including rate-limited) - a completely separate service with its own
// quota, so it isn't affected by whatever's throttling Google Books.
async function searchOpenLibraryByTitle(
  trimmed: string,
  genreAllowlist: string[],
  maxResults: number,
): Promise<BookTitleSearchResult[]> {
  const res = await fetch(
    `https://openlibrary.org/search.json?title=${encodeURIComponent(trimmed)}&limit=${maxResults}&fields=key,title,author_name,isbn,subject`,
    { headers: { 'User-Agent': OPEN_LIBRARY_USER_AGENT } },
  );
  if (!res.ok) {
    console.warn('Media Base: Open Library title search returned', res.status);
    return [];
  }
  const json = await res.json();
  const docs = Array.isArray(json?.docs) ? json.docs : [];

  const results: BookTitleSearchResult[] = [];
  for (const doc of docs) {
    if (!doc?.title || !doc?.key) continue;
    const isbn = Array.isArray(doc.isbn) && doc.isbn.length > 0 ? doc.isbn[0] : '';
    results.push({
      key: doc.key as string,
      isbn,
      title: doc.title as string,
      author: Array.isArray(doc.author_name) ? doc.author_name[0] : undefined,
      genres: normalizeGenres(doc.subject, genreAllowlist),
    });
  }
  console.warn('Media Base: Open Library title search for', `"${trimmed}"`, '->', docs.length, 'raw,', results.length, 'usable');
  return results;
}

/** Searches for books/comics by title (shared by both - pass each
 * screen's own genre allowlist). Tries Google Books first, falls back to
 * Open Library if that source comes back with nothing at all. ISBN is
 * NOT required to be present on a result - an earlier version filtered
 * out every result missing one, reasoning "the whole point is filling
 * that field in too", but that was a real bug: both sources frequently
 * omit it entirely, even for extremely well-known titles - confirmed as
 * the actual cause of a reported 100% failure rate on real searches
 * (Harry Potter, The Hunger Games, etc.). A result without an ISBN is
 * still genuinely useful - title/author/genre still fill in correctly,
 * the ISBN field just stays whatever it was, same as manual entry. */
export async function searchBooksByTitle(
  query: string,
  genreAllowlist: string[],
  maxResults = 8,
): Promise<BookTitleSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const googleResults = await searchGoogleBooksByTitle(trimmed, genreAllowlist, maxResults).catch((err) => {
    console.warn('Media Base: Google Books title search threw', err);
    return [];
  });
  if (googleResults.length > 0) return googleResults;

  return searchOpenLibraryByTitle(trimmed, genreAllowlist, maxResults).catch((err) => {
    console.warn('Media Base: Open Library title search threw', err);
    return [];
  });
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
