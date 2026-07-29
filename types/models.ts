// types/models.ts

// The full v1 category list. Video Games intentionally excluded (Steam
// already covers that for the user). Order here is also the order shown
// on OnboardingScreen and, once picked, on the HomeScreen widget stack.
export type MediaCategory =
  | 'books'
  | 'comics'
  | 'movies'
  | 'tvshows'
  | 'anime'
  | 'music'
  | 'vinyl'
  | 'puzzles'
  | 'boardgames';

export const ALL_CATEGORIES: MediaCategory[] = [
  'books',
  'comics',
  'movies',
  'tvshows',
  'anime',
  'music',
  'vinyl',
  'puzzles',
  'boardgames',
];

export const CATEGORY_LABELS: Record<MediaCategory, string> = {
  books: 'Books',
  comics: 'Comics/Manga',
  movies: 'Movies',
  tvshows: 'TV Shows',
  anime: 'Anime',
  music: 'Music',
  vinyl: 'Vinyl/Records',
  puzzles: 'Puzzles',
  boardgames: 'Board Games',
};

// Which categories support a scan-to-fill shortcut, vs. manual entry only.
// This only decides whether the little camera icon shows up next to the
// entry form - manual entry is always available regardless.
export const SCANNABLE_CATEGORIES: Record<MediaCategory, boolean> = {
  books: true,
  comics: true,
  movies: true,
  tvshows: false,
  anime: false,
  music: false, // uses "paste a link" instead of a barcode scan
  vinyl: true,
  puzzles: false,
  boardgames: true,
};

export interface Book {
  id: string;
  title: string;
  genres: string[]; // a book can carry more than one genre tag; index 0 is treated as "primary" for sorting/A-Z grouping
  author: string;
  pageCount: number | null;
  isbn: string; // optional - if filled in, triggers the same auto-fill lookup as scanning
  read: boolean;
  rating: number | null; // 1-5, only meaningful once read = true
  review: string; // only meaningful once read = true
  createdAt: string; // ISO timestamp
}

export type BookSortField = 'title' | 'genre' | 'pageCount' | 'author' | 'read';

export interface AppSettings {
  onboarded: boolean;
  categories: MediaCategory[]; // which widgets show on Home
  themeColor: string; // hex
  themeMode: 'light' | 'dark';
  fontSize: 'small' | 'default' | 'large';
}

export const DEFAULT_SETTINGS: AppSettings = {
  onboarded: false,
  categories: [],
  themeColor: '#378ADD',
  themeMode: 'light',
  fontSize: 'default',
};
