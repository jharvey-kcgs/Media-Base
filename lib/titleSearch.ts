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
// Movies reuses lib/movieLookup.ts's tmdbSearchMovies() directly -
// Movies' only entry-assist method now that barcode/UPC scanning has
// been removed (confirmed unreliable via real testing; Title Search was
// already the reliable path being used in practice).
//
// Deliberately different result shapes per category rather than one
// forced-generic type: Movies results never carry a UPC at all - that
// field doesn't exist on the Movie type anymore, since a UPC identifies
// a specific physical disc/release, not "the movie" as a concept, so
// there was never a correct number to backfill from a title search the
// way there is for books.
//
// NOTE: not network-testable from the sandbox this was written in.

import { normalizeGenres } from './isbnLookup';
import { tmdbSearchMovies, MovieLookupResult } from './movieLookup';
import { tmdbSearchTVShows, TVShowLookupResult } from './tvLookup';
import { searchJikanAnime } from './jikanLookup';
import { searchMusicBrainz, MusicSearchResult } from './musicLookup';

const OPEN_LIBRARY_USER_AGENT = 'MediaBase/1.0 (contact: JHarvey.appdeveloper@gmail.com)';

export interface BookTitleSearchResult {
  key: string; // stable, unique per result (Google Books volume ID, or Open Library work key)
  isbn: string; // '' if this record has no ISBN on file (common, even for well-known titles - see below)
  title: string;
  author?: string;
  genres: string[];
  coverUrl?: string;
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
      coverUrl: info.imageLinks?.thumbnail ? String(info.imageLinks.thumbnail).replace(/^http:/, 'https:') : undefined,
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
    `https://openlibrary.org/search.json?title=${encodeURIComponent(trimmed)}&limit=${maxResults}&fields=key,title,author_name,isbn,subject,cover_i`,
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
      coverUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : undefined,
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
 * lib/movieLookup.ts's tmdbSearchMovies(), Movies' only entry-assist
 * method now that barcode/UPC scanning has been removed (confirmed
 * unreliable via real testing). No UPC field on the result - see the
 * file-level note above for why. */
export async function searchMoviesByTitle(query: string, maxResults = 8): Promise<MovieLookupResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  return tmdbSearchMovies(trimmed, maxResults);
}

/** Searches TMDb by TV show title - thin wrapper around
 * lib/tvLookup.ts's tmdbSearchTVShows(). TV Shows has no number-entry
 * pipeline the way Movies' UPC does (confirmed design - title search is
 * the only assisted entry method for this category), so this is the
 * only lookup path TVScreen.tsx has at all. */
export async function searchTVShowsByTitle(query: string, maxResults = 8): Promise<TVShowLookupResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  return tmdbSearchTVShows(trimmed, maxResults);
}

export interface AnimeSearchResult {
  key: string;
  title: string;
  genres: string[];
  releaseYear?: string;
  coverUrl?: string;
  // Only set when this result came from TMDb - a Jikan-sourced result
  // never has one, since MyAnimeList doesn't carry a TMDb cross-
  // reference. AnimeScreen.tsx's Where to Watch button only shows when
  // this is present, same graceful-hide behavior as an entry typed in
  // by hand - just triggered by which source actually found it here.
  tmdbId?: number;
}

/** Searches for anime by title - TMDb first (most mainstream-popular
 * anime is catalogued there as a regular TV show, and it's the source
 * that makes Where to Watch possible), falling back to Jikan
 * (lib/jikanLookup.ts, MyAnimeList data) only when TMDb comes back with
 * nothing. Same multi-source resilience pattern already established for
 * Books/Comics (Google Books primary, Open Library fallback) - a real,
 * deliberate design, not a reluctant workaround. */
export async function searchAnimeByTitle(query: string, maxResults = 8): Promise<AnimeSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const tmdbResults = await tmdbSearchTVShows(trimmed, maxResults).catch((err) => {
    console.warn('Media Base: TMDb anime search threw', err);
    return [];
  });
  if (tmdbResults.length > 0) {
    return tmdbResults.map((r) => ({
      key: r.tmdbId != null ? String(r.tmdbId) : `${r.title}-${r.firstAirYear}`,
      title: r.title ?? 'Untitled',
      genres: r.genres,
      releaseYear: r.firstAirYear,
      coverUrl: r.coverUrl,
      tmdbId: r.tmdbId,
    }));
  }

  const jikanResults = await searchJikanAnime(trimmed, maxResults).catch((err) => {
    console.warn('Media Base: Jikan anime search threw', err);
    return [];
  });
  return jikanResults.map((r) => ({
    key: r.key,
    title: r.title,
    genres: r.genres,
    releaseYear: r.releaseYear,
    coverUrl: r.coverUrl,
    // no tmdbId - see the interface comment above
  }));
}

/** Searches for albums/songs by title - thin wrapper around
 * lib/musicLookup.ts's searchMusicBrainz(), which itself merges two
 * MusicBrainz search types (album titles and song titles) into one
 * result list. No fallback source needed here the way Anime has one -
 * MusicBrainz alone already covers both search shapes Music needs. */
export async function searchMusicByTitle(query: string, maxResults = 8): Promise<MusicSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  return searchMusicBrainz(trimmed, maxResults);
}
