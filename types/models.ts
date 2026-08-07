// types/models.ts

// The full v1 category list. Video Games intentionally excluded (Steam
// already covers that for the user). Music (digital, via streaming)
// was tried and removed - see the project README/Roadmap doc for why;
// it didn't fit this project's physical/owned-media philosophy the way
// TV Shows/Anime still do despite lacking a literal disc. Puzzles was
// also dropped from the plan before ever being built - no real
// assisted-entry story (no barcode database exists for jigsaw puzzles
// at all) and, on reflection, not something worth tracking here. Order
// here is also the order shown on OnboardingScreen and, once picked, on
// the HomeScreen widget stack.
export type MediaCategory =
  | 'books'
  | 'comics'
  | 'movies'
  | 'tvshows'
  | 'anime'
  | 'vinyl'
  | 'tabletop';

export const ALL_CATEGORIES: MediaCategory[] = [
  'books',
  'comics',
  'movies',
  'tvshows',
  'anime',
  'vinyl',
  'tabletop',
];

export const CATEGORY_LABELS: Record<MediaCategory, string> = {
  books: 'Books',
  comics: 'Comics/Manga',
  movies: 'Movies',
  tvshows: 'TV Shows',
  anime: 'Anime',
  vinyl: 'Vinyl/CD',
  tabletop: 'Tabletop Games',
};

// Which categories support a scan-to-fill shortcut, vs. manual entry only.
// This only decides whether the little camera icon shows up next to the
// entry form - manual entry is always available regardless.
export const SCANNABLE_CATEGORIES: Record<MediaCategory, boolean> = {
  books: true,
  comics: true,
  movies: false,
  tvshows: false,
  anime: false,
  vinyl: true,
  tabletop: true,
};

export interface Book {
  id: string;
  title: string;
  genres: string[]; // a book can carry more than one genre tag; index 0 is treated as "primary" for sorting/A-Z grouping
  author: string;
  isbn: string; // optional - if filled in, triggers the same auto-fill lookup as scanning
  coverImage: string | null; // local file URI (lib/coverStorage.ts) - never a remote URL, see that file for why
  read: boolean;
  rating: number | null; // 1-5, only meaningful once read = true
  review: string; // only meaningful once read = true
  createdAt: string; // ISO timestamp
}

export type BookSortField = 'title' | 'genre' | 'author' | 'read' | 'rating';

// Structurally identical to Book by design - Comics/Manga entries work the
// same way (multi-genre, ISBN lookup/scan, a read switch), just with
// Comics/Manga's own genre allowlist (see screens/ComicScreen.tsx) since
// manga in particular is often filed by demographic (Shonen/Seinen/etc.)
// as much as by traditional genre.
export interface Comic {
  id: string;
  title: string;
  genres: string[];
  author: string; // covers writer/illustrator both - typed as one field, same as Book's Author
  isbn: string;
  coverImage: string | null; // local file URI (lib/coverStorage.ts) - never a remote URL, see that file for why
  read: boolean;
  rating: number | null;
  review: string;
  createdAt: string;
}

export type ComicSortField = 'title' | 'genre' | 'author' | 'read' | 'rating';

// No barcode/number field at all as of this refactor - real testing
// confirmed UPC scanning was unreliable (the multi-hop UPC -> messy
// retail title -> TMDb search chain was always the structurally weaker
// path here, unlike Books/Comics' direct ISBN lookup), and Title Search
// was already the reliable path being used in practice. Removed scan
// and UPC entirely rather than half-measures, matching TVShow's shape
// exactly - Movie and TVShow are now structural twins, both TMDb-backed,
// both title-search-only, both with a stored tmdbId for Where to Watch.
export interface Movie {
  id: string;
  title: string;
  genres: string[];
  coverImage: string | null; // local file URI (lib/coverStorage.ts) - never a remote URL, see that file for why
  tmdbId: number | null; // for the Where to Watch button - null for anything typed by hand rather than found through title search
  watched: boolean;
  rating: number | null;
  review: string;
  createdAt: string;
}

export type MovieSortField = 'title' | 'genre' | 'watched' | 'rating';

// No author, no barcode/number field at all - confirmed design: title
// search is the only entry-assist method for TV Shows, no scan or
// number-entry path the way Books/Comics/Movies have (SCANNABLE_CATEGORIES
// above already anticipated this: tvshows: false). tmdbId is stored
// specifically so the "Where to Watch" button can open TMDb's own watch
// page for this exact show without needing another search - null for an
// entry added by typing everything by hand rather than through title
// search, in which case the button just doesn't show (nothing to link to).
export interface TVShow {
  id: string;
  title: string;
  genres: string[];
  coverImage: string | null;
  tmdbId: number | null;
  watched: boolean;
  rating: number | null;
  review: string;
  createdAt: string;
}

export type TVShowSortField = 'title' | 'genre' | 'watched' | 'rating';

// Same shape as TVShow (own separate storage/list/daily-pick pool
// regardless), reflecting a real, deliberate two-source design: TMDb is
// the primary source (reuses lib/tvLookup.ts's tmdbSearchTVShows() -
// same TV search TV Shows already uses, since most mainstream-popular
// anime is catalogued there as a regular TV show), with Jikan
// (lib/jikanLookup.ts, MyAnimeList data) as a fallback for anything
// TMDb doesn't have - same multi-source resilience pattern already
// established for Books/Comics (Google Books primary, Open Library
// fallback). tmdbId stays null for anything found only via the Jikan
// fallback, not just anything typed by hand - Jikan doesn't carry a
// TMDb cross-reference, so a Jikan-sourced entry gets real title/genre/
// cover data but no Where to Watch button, same graceful-hide behavior
// already built for a hand-typed entry, just triggered by which source
// actually found it.
export interface Anime {
  id: string;
  title: string;
  genres: string[];
  coverImage: string | null;
  tmdbId: number | null;
  watched: boolean;
  rating: number | null;
  review: string;
  createdAt: string;
}

export type AnimeSortField = 'title' | 'genre' | 'watched' | 'rating';

export interface AppSettings {
  onboarded: boolean;
  categories: MediaCategory[]; // which widgets show on Home
  themeColor: string; // hex
  themeMode: 'light' | 'dark';
  fontSize: 'small' | 'default' | 'large';
  notificationsEnabled: boolean; // daily 10am "check today's recommendations" reminder
}

export const DEFAULT_SETTINGS: AppSettings = {
  onboarded: false,
  categories: [],
  themeColor: '#378ADD',
  themeMode: 'light',
  fontSize: 'default',
  notificationsEnabled: false,
};
