// lib/isbnLookup.ts
//
// Category-agnostic ISBN lookup (Open Library primary, Google Books
// fallback, Open Library search-index as a third genre-only fallback) plus
// genre-allowlist matching. Extracted out of BookScreen.tsx so Comics/Manga
// (and any future ISBN-based category - anything with a real ISBN barcode)
// can reuse the exact same, already-debugged logic instead of a second
// copy that would need every future fix applied twice. Each category still
// supplies its OWN genre allowlist (e.g. Comics/Manga's includes manga
// demographic labels like Shonen/Seinen that Books' doesn't), since what
// counts as a valid genre differs by category.
//
// NOTE: not network-testable from the sandbox this was written in - if a
// lookup still comes back empty for an ISBN you know is real, check the
// Metro/dev console for the "Media Base:" warnings this logs; that'll show
// whether it's an API error/block versus neither database actually having
// that specific edition indexed.

const OPEN_LIBRARY_USER_AGENT = 'MediaBase/1.0 (contact: JHarvey.appdeveloper@gmail.com)';

export interface LookupResult {
  title?: string;
  authors?: string[];
  categories?: string[];
}

export async function lookupOpenLibrary(digits: string): Promise<LookupResult | null> {
  const res = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${digits}&format=json&jscmd=data`, {
    headers: { 'User-Agent': OPEN_LIBRARY_USER_AGENT },
  });
  if (!res.ok) {
    console.warn('Media Base: Open Library returned', res.status);
    return null;
  }
  const json = await res.json();
  const info = json?.[`ISBN:${digits}`];
  if (!info) return null; // genuinely not indexed - not an error worth logging
  return {
    title: info.title as string | undefined,
    authors: Array.isArray(info.authors) ? info.authors.map((a: any) => a.name).filter(Boolean) : undefined,
    categories: Array.isArray(info.subjects) ? info.subjects.map((s: any) => s.name).filter(Boolean) : undefined,
  };
}

export async function lookupGoogleBooks(digits: string): Promise<LookupResult | null> {
  const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${digits}`);
  if (!res.ok) {
    // 429 = rate-limited, which happens routinely during a bulk scanning
    // session (no API key means a shared, low quota) - Open Library is
    // the primary source anyway, so this isn't worth logging as if it
    // were unexpected. Other non-ok statuses still get logged.
    if (res.status !== 429) {
      console.warn('Media Base: Google Books returned', res.status);
    }
    return null;
  }
  const json = await res.json();
  if (json?.error) {
    console.warn('Media Base: Google Books API error', json.error);
    return null;
  }
  return json?.items?.[0]?.volumeInfo ?? null;
}

// Fallback source, only worth calling when the two primary lookups leave
// genre empty. Hits Open Library's *search index* (search.json) instead of
// its single-edition record - the search index is aggregated across every
// edition/printing of a work, so it's often populated with genre subjects
// even when this one specific ISBN's own edition record is sparse.
export async function lookupOpenLibraryWork(digits: string): Promise<LookupResult | null> {
  const res = await fetch(`https://openlibrary.org/search.json?isbn=${digits}&fields=title,author_name,subject`, {
    headers: { 'User-Agent': OPEN_LIBRARY_USER_AGENT },
  });
  if (!res.ok) {
    console.warn('Media Base: Open Library search returned', res.status);
    return null;
  }
  const json = await res.json();
  const doc = json?.docs?.[0];
  if (!doc) return null;
  return {
    title: doc.title as string | undefined,
    authors: Array.isArray(doc.author_name) ? doc.author_name : undefined,
    categories: Array.isArray(doc.subject) ? doc.subject : undefined,
  };
}

export interface IsbnLookupResult {
  title?: string;
  author?: string;
  genres: string[];
}

/** Runs both primary lookups in parallel and merges them field by field
 * (rather than an all-or-nothing fallback, which was the actual cause of
 * some books ending up with a missing title even though one of the two
 * databases had it). If genre is still empty after that merge, tries the
 * work-search fallback. Returns null only if every source came back with
 * nothing at all - callers decide what message to show for that case vs.
 * "found it, but no usable fields" (both are real, distinct situations). */
export async function runIsbnLookup(digits: string, genreAllowlist: string[]): Promise<IsbnLookupResult | null> {
  const [olInfo, gInfo] = await Promise.all([
    lookupOpenLibrary(digits).catch((err) => {
      console.warn('Media Base: Open Library lookup threw', err);
      return null;
    }),
    lookupGoogleBooks(digits).catch((err) => {
      console.warn('Media Base: Google Books lookup threw', err);
      return null;
    }),
  ]);

  if (!olInfo && !gInfo) return null;

  const title = olInfo?.title || gInfo?.title;
  const author = (olInfo?.authors && olInfo.authors[0]) || (gInfo?.authors && gInfo.authors[0]);
  // Genre specifically prefers Google Books: its categories are usually
  // one or two curated BISAC-style entries ("Fiction / Romance"), while
  // Open Library's subject list is long and noisy - normalizeGenres cleans
  // up whichever one actually has data.
  let genres = normalizeGenres(gInfo?.categories?.length ? gInfo.categories : olInfo?.categories, genreAllowlist);

  if (genres.length === 0) {
    const workInfo = await lookupOpenLibraryWork(digits).catch((err) => {
      console.warn('Media Base: Open Library work-search lookup threw', err);
      return null;
    });
    if (workInfo) {
      genres = normalizeGenres(workInfo.categories, genreAllowlist);
      return { title: title || workInfo.title, author: author || (workInfo.authors && workInfo.authors[0]), genres };
    }
  }

  return { title, author, genres };
}

// --- Genre allowlist matching ---
//
// An allowlist is a much stronger guarantee than reactively blocking known-
// bad patterns one at a time as new junk examples turn up: whatever list a
// category passes in, that's what can ever show up as a genre - nothing
// else gets through by definition, and the list itself is just an array,
// so adding/removing a genre is a one-line edit rather than a new filtering
// rule to write and test. Real junk that used to get through before this
// existed: "New York Times Bestseller, Nyt:paperback_books=2012-02-25,
// Families", "Futurology", "Girl Next Door", "Hieros Gamos", "Mechanical
// Hound" - Open Library's raw subject data mixes plot keywords, character
// names, settings, and library-internal bookkeeping in with actual
// genres, with no reliable way to tell them apart algorithmically.

// Broad classifications that should sort *after* more specific genre tags
// (e.g. a book auto-tagged Fiction + Romance + Contemporary should show as
// "Romance, Contemporary, Fiction" - Fiction on its own tells you nothing
// useful once you already have a more specific tag). Shared across
// categories since "Fiction"/"Nonfiction" mean the same generic thing
// everywhere.
const GENERIC_GENRE_TERMS = new Set(['fiction', 'nonfiction']);

// Library of Congress subject headings often qualify a real genre with a
// parenthetical, e.g. "Poetry (poetic works by one author)" - the genre
// itself (Poetry) is legitimate, only the qualifier is noise. Stripping it
// before allowlist-matching salvages the useful part.
function stripParenthetical(tag: string): string {
  return tag.replace(/\([^)]*\)?/g, '').trim();
}

// Same idea for another very common LCSH pattern: a trailing era/decade
// qualifier like "Fiction, 21st century" or "Mystery fiction, 1990-1999" -
// stripping the date first lets the genre part underneath still match the
// allowlist normally, instead of the whole tag being thrown out by a
// blanket "contains a digit" rule.
function stripEraSuffix(tag: string): string {
  return tag
    .replace(/,?\s*\d{3,4}(-\d{2,4})?\s*$/i, '') // trailing "1990-1999" / "2020" style
    .replace(/,?\s*\d+(st|nd|rd|th)\s+century\.?\s*$/i, '') // trailing "21st century"
    .trim();
}

/** Turns whatever a lookup API returned into a clean, ordered genre list -
 * every entry guaranteed to be one of `allowlist`'s own terms, nothing
 * else. Google Books often returns one BISAC-style string per entry
 * ("Fiction / Romance / Contemporary") - those get split apart first. */
export function normalizeGenres(rawCategories: string[] | undefined, allowlist: string[]): string[] {
  if (!rawCategories || rawCategories.length === 0) return [];
  const matchers = allowlist.map(
    (g) => [g, new RegExp(`\\b${g.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')] as const,
  );
  const matchOne = (tag: string): string | null => {
    for (const [canonical, re] of matchers) {
      if (re.test(tag)) return canonical;
    }
    return null;
  };

  const flattened = rawCategories
    .flatMap((c) => c.split('/').map((part) => part.trim()).filter(Boolean))
    .map(stripParenthetical)
    .map(stripEraSuffix)
    .filter(Boolean);

  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const tag of flattened) {
    const match = matchOne(tag);
    if (match && !seen.has(match.toLowerCase())) {
      seen.add(match.toLowerCase());
      deduped.push(match);
    }
  }
  const specific = deduped.filter((t) => !GENERIC_GENRE_TERMS.has(t.toLowerCase()));
  const generic = deduped.filter((t) => GENERIC_GENRE_TERMS.has(t.toLowerCase()));
  return [...specific, ...generic].slice(0, 4);
}
