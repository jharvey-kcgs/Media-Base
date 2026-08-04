// lib/storage.ts

import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import * as FileSystem from 'expo-file-system/legacy';
import { AppSettings, DEFAULT_SETTINGS, Book, Comic, Movie, TVShow, Anime, MusicAlbum } from '../types/models';
import { deleteCover, deleteAllCovers, getCoverUri, ensureCoverDirExists } from './coverStorage';

const KEYS = {
  settings: 'mediabase:settings',
  books: 'mediabase:books',
  comics: 'mediabase:comics',
  movies: 'mediabase:movies',
  tvShows: 'mediabase:tvShows',
  anime: 'mediabase:anime',
  music: 'mediabase:music',
  dailyPicks: 'mediabase:dailyPicks',
};

// Exported so a screen can pre-generate an id when the Add form opens -
// needed so a cover photo picked/taken *before* the entry is first saved
// still has a real, final id to be stored under from the start, rather
// than needing to move the file once a real id exists.
export const newId = () => uuidv4();

async function getAll<T>(key: string): Promise<T[]> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch (err) {
    console.warn(`Media Base: corrupted data at "${key}", showing empty instead of crashing.`, err);
    return [];
  }
}

async function saveAll<T>(key: string, items: T[]): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(items));
}

// --- Settings ---

export async function getSettings(): Promise<AppSettings> {
  const raw = await AsyncStorage.getItem(KEYS.settings);
  if (!raw) return DEFAULT_SETTINGS;
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await AsyncStorage.setItem(KEYS.settings, JSON.stringify(settings));
}

// --- Books ---

export async function getBooks(): Promise<Book[]> {
  const raw = await getAll<any>(KEYS.books);
  // Migrates anything saved before genres became an array (genre: string ->
  // genres: string[]) - old data still loads correctly instead of breaking.
  return raw.map((b) => (Array.isArray(b.genres) ? (b as Book) : { ...b, genres: b.genre ? [b.genre] : [] }));
}

export async function addBook(input: Omit<Book, 'id' | 'createdAt'>, id?: string): Promise<Book> {
  const books = await getBooks();
  const book: Book = { ...input, id: id ?? newId(), createdAt: new Date().toISOString() };
  await saveAll(KEYS.books, [...books, book]);
  return book;
}

export async function updateBook(id: string, updates: Partial<Book>): Promise<void> {
  const books = await getBooks();
  const next = books.map((b) => (b.id === id ? { ...b, ...updates } : b));
  await saveAll(KEYS.books, next);
}

export async function deleteBook(id: string): Promise<void> {
  const books = await getBooks();
  await saveAll(
    KEYS.books,
    books.filter((b) => b.id !== id),
  );
  await deleteCover('books', id);
}

export async function deleteBooks(ids: string[]): Promise<void> {
  const books = await getBooks();
  const idSet = new Set(ids);
  await saveAll(
    KEYS.books,
    books.filter((b) => !idSet.has(b.id)),
  );
  await Promise.all(ids.map((id) => deleteCover('books', id)));
}

// --- Comics/Manga ---

export async function getComics(): Promise<Comic[]> {
  const raw = await getAll<any>(KEYS.comics);
  // Same migration safety net as getBooks(), in case this shape ever
  // changes the way Book's genre field once did.
  return raw.map((c) => (Array.isArray(c.genres) ? (c as Comic) : { ...c, genres: c.genre ? [c.genre] : [] }));
}

export async function addComic(input: Omit<Comic, 'id' | 'createdAt'>, id?: string): Promise<Comic> {
  const comics = await getComics();
  const comic: Comic = { ...input, id: id ?? newId(), createdAt: new Date().toISOString() };
  await saveAll(KEYS.comics, [...comics, comic]);
  return comic;
}

export async function updateComic(id: string, updates: Partial<Comic>): Promise<void> {
  const comics = await getComics();
  const next = comics.map((c) => (c.id === id ? { ...c, ...updates } : c));
  await saveAll(KEYS.comics, next);
}

export async function deleteComic(id: string): Promise<void> {
  const comics = await getComics();
  await saveAll(
    KEYS.comics,
    comics.filter((c) => c.id !== id),
  );
  await deleteCover('comics', id);
}

export async function deleteComics(ids: string[]): Promise<void> {
  const comics = await getComics();
  const idSet = new Set(ids);
  await saveAll(
    KEYS.comics,
    comics.filter((c) => !idSet.has(c.id)),
  );
  await Promise.all(ids.map((id) => deleteCover('comics', id)));
}

// --- Movies ---

export async function getMovies(): Promise<Movie[]> {
  return getAll<Movie>(KEYS.movies);
}

export async function addMovie(input: Omit<Movie, 'id' | 'createdAt'>, id?: string): Promise<Movie> {
  const movies = await getMovies();
  const movie: Movie = { ...input, id: id ?? newId(), createdAt: new Date().toISOString() };
  await saveAll(KEYS.movies, [...movies, movie]);
  return movie;
}

export async function updateMovie(id: string, updates: Partial<Movie>): Promise<void> {
  const movies = await getMovies();
  const next = movies.map((m) => (m.id === id ? { ...m, ...updates } : m));
  await saveAll(KEYS.movies, next);
}

export async function deleteMovie(id: string): Promise<void> {
  const movies = await getMovies();
  await saveAll(
    KEYS.movies,
    movies.filter((m) => m.id !== id),
  );
  await deleteCover('movies', id);
}

export async function deleteMovies(ids: string[]): Promise<void> {
  const movies = await getMovies();
  const idSet = new Set(ids);
  await saveAll(
    KEYS.movies,
    movies.filter((m) => !idSet.has(m.id)),
  );
  await Promise.all(ids.map((id) => deleteCover('movies', id)));
}

// --- TV Shows ---

export async function getTVShows(): Promise<TVShow[]> {
  return getAll<TVShow>(KEYS.tvShows);
}

export async function addTVShow(input: Omit<TVShow, 'id' | 'createdAt'>, id?: string): Promise<TVShow> {
  const tvShows = await getTVShows();
  const tvShow: TVShow = { ...input, id: id ?? newId(), createdAt: new Date().toISOString() };
  await saveAll(KEYS.tvShows, [...tvShows, tvShow]);
  return tvShow;
}

export async function updateTVShow(id: string, updates: Partial<TVShow>): Promise<void> {
  const tvShows = await getTVShows();
  const next = tvShows.map((t) => (t.id === id ? { ...t, ...updates } : t));
  await saveAll(KEYS.tvShows, next);
}

export async function deleteTVShow(id: string): Promise<void> {
  const tvShows = await getTVShows();
  await saveAll(
    KEYS.tvShows,
    tvShows.filter((t) => t.id !== id),
  );
  await deleteCover('tvshows', id);
}

export async function deleteTVShows(ids: string[]): Promise<void> {
  const tvShows = await getTVShows();
  const idSet = new Set(ids);
  await saveAll(
    KEYS.tvShows,
    tvShows.filter((t) => !idSet.has(t.id)),
  );
  await Promise.all(ids.map((id) => deleteCover('tvshows', id)));
}

// --- Anime ---

export async function getAnime(): Promise<Anime[]> {
  return getAll<Anime>(KEYS.anime);
}

export async function addAnime(input: Omit<Anime, 'id' | 'createdAt'>, id?: string): Promise<Anime> {
  const anime = await getAnime();
  const entry: Anime = { ...input, id: id ?? newId(), createdAt: new Date().toISOString() };
  await saveAll(KEYS.anime, [...anime, entry]);
  return entry;
}

export async function updateAnime(id: string, updates: Partial<Anime>): Promise<void> {
  const anime = await getAnime();
  const next = anime.map((a) => (a.id === id ? { ...a, ...updates } : a));
  await saveAll(KEYS.anime, next);
}

export async function deleteAnime(id: string): Promise<void> {
  const anime = await getAnime();
  await saveAll(
    KEYS.anime,
    anime.filter((a) => a.id !== id),
  );
  await deleteCover('anime', id);
}

export async function deleteAnimeEntries(ids: string[]): Promise<void> {
  const anime = await getAnime();
  const idSet = new Set(ids);
  await saveAll(
    KEYS.anime,
    anime.filter((a) => !idSet.has(a.id)),
  );
  await Promise.all(ids.map((id) => deleteCover('anime', id)));
}

// --- Music ---

export async function getMusicAlbums(): Promise<MusicAlbum[]> {
  return getAll<MusicAlbum>(KEYS.music);
}

export async function addMusicAlbum(input: Omit<MusicAlbum, 'id' | 'createdAt'>, id?: string): Promise<MusicAlbum> {
  const albums = await getMusicAlbums();
  const entry: MusicAlbum = { ...input, id: id ?? newId(), createdAt: new Date().toISOString() };
  await saveAll(KEYS.music, [...albums, entry]);
  return entry;
}

export async function updateMusicAlbum(id: string, updates: Partial<MusicAlbum>): Promise<void> {
  const albums = await getMusicAlbums();
  const next = albums.map((a) => (a.id === id ? { ...a, ...updates } : a));
  await saveAll(KEYS.music, next);
}

export async function deleteMusicAlbum(id: string): Promise<void> {
  const albums = await getMusicAlbums();
  await saveAll(
    KEYS.music,
    albums.filter((a) => a.id !== id),
  );
  await deleteCover('music', id);
}

export async function deleteMusicAlbums(ids: string[]): Promise<void> {
  const albums = await getMusicAlbums();
  const idSet = new Set(ids);
  await saveAll(
    KEYS.music,
    albums.filter((a) => !idSet.has(a.id)),
  );
  await Promise.all(ids.map((id) => deleteCover('music', id)));
}

// --- Daily recommendation ("try this today" on Home) ---
//
// One category's own random pick should stay fixed for the whole calendar
// day rather than re-rolling every time Home loads/refreshes - this is
// what makes that possible, keyed generically by category so future
// categories (Movies, Comics, etc.) can reuse it rather than each needing
// their own version.

/** Local calendar date as YYYY-MM-DD - deliberately not toISOString(),
 * which is UTC and can silently roll the date forward once local evening
 * time crosses midnight UTC. */
export function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

interface DailyPick {
  date: string;
  itemId: string;
}

async function getDailyPicks(): Promise<Record<string, DailyPick>> {
  const raw = await AsyncStorage.getItem(KEYS.dailyPicks);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function getDailyPick(category: string): Promise<DailyPick | null> {
  const picks = await getDailyPicks();
  return picks[category] ?? null;
}

export async function saveDailyPick(category: string, itemId: string): Promise<void> {
  const picks = await getDailyPicks();
  picks[category] = { date: toLocalDateString(new Date()), itemId };
  await AsyncStorage.setItem(KEYS.dailyPicks, JSON.stringify(picks));
}

// --- Data (Settings > Data) ---

export interface BackupPayload {
  app: 'media-base';
  version: 2;
  exportedAt: string;
  data: Record<string, string>;
  // Cover photos, base64-encoded, keyed by "category/id" - the whole
  // reason this moved from pasteable text to a real file. Version 1
  // backups predate this entirely and simply won't have one -
  // importAllData() below handles that as "nothing to restore", not an
  // error, so an old backup still restores everything it actually has.
  covers: Record<string, string>;
}

const COVER_CATEGORY_KEYS: { category: string; key: string }[] = [
  { category: 'books', key: KEYS.books },
  { category: 'comics', key: KEYS.comics },
  { category: 'movies', key: KEYS.movies },
  { category: 'tvshows', key: KEYS.tvShows },
  { category: 'anime', key: KEYS.anime },
  { category: 'music', key: KEYS.music },
];

/** Builds a full backup - every stored key's data, plus every item's
 * actual cover photo read and embedded as base64 - and writes it to one
 * JSON file in temporary storage, ready to hand to the OS share sheet
 * (Settings > Data > Save Backup File). Returns the file's local URI. */
export async function exportAllData(): Promise<string> {
  const allKeys = Object.values(KEYS);
  const pairs = await AsyncStorage.multiGet(allKeys);
  const data: Record<string, string> = {};
  for (const [key, value] of pairs) {
    if (value !== null) data[key] = value;
  }

  const covers: Record<string, string> = {};
  for (const { category, key } of COVER_CATEGORY_KEYS) {
    const raw = data[key];
    if (!raw) continue;
    let items: { id: string; coverImage?: string | null }[] = [];
    try {
      items = JSON.parse(raw);
    } catch {
      continue;
    }
    for (const item of items) {
      if (!item.coverImage) continue;
      const base64 = await FileSystem.readAsStringAsync(item.coverImage, {
        encoding: FileSystem.EncodingType.Base64,
      }).catch((err) => {
        console.warn('Media Base: failed to read cover for backup', item.id, err);
        return null;
      });
      if (base64) covers[`${category}/${item.id}`] = base64;
    }
  }

  const payload: BackupPayload = {
    app: 'media-base',
    version: 2,
    exportedAt: new Date().toISOString(),
    data,
    covers,
  };

  const fileName = `media-base-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(payload));
  return fileUri;
}

/** Restores data from a backup file (produced by exportAllData(), or an
 * older pasted-text export - version is checked, not assumed) at
 * fileUri. Throws if the file isn't a recognizable Media Base backup. */
export async function importAllData(fileUri: string): Promise<void> {
  const raw = await FileSystem.readAsStringAsync(fileUri).catch(() => null);
  if (raw === null) {
    throw new Error("Couldn't read that file.");
  }
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("That doesn't look like a valid backup file.");
  }
  if (!parsed || parsed.app !== 'media-base' || typeof parsed.data !== 'object') {
    throw new Error("That doesn't look like a Media Base backup.");
  }

  const validKeys = new Set(Object.values(KEYS));
  const entries = Object.entries(parsed.data).filter(([key]) => validKeys.has(key));
  await AsyncStorage.multiSet(entries as [string, string][]);

  // Version 1 backups (the old pasted-text format) predate cover photos
  // entirely - parsed.covers is simply undefined for those, which is
  // fine, not an error; everything else still restores correctly.
  const covers: Record<string, string> = parsed.covers ?? {};
  for (const [coverKey, base64] of Object.entries(covers)) {
    const [category, id] = coverKey.split('/');
    if (!category || !id) continue;
    await ensureCoverDirExists(category);
    await FileSystem.writeAsStringAsync(getCoverUri(category, id), base64 as string, {
      encoding: FileSystem.EncodingType.Base64,
    }).catch((err) => {
      console.warn('Media Base: failed to restore cover', coverKey, err);
    });
  }
}

/** All-or-nothing wipe, per the confirmed Settings > Data > Delete Data design. */
export async function deleteAllData(): Promise<void> {
  await AsyncStorage.multiRemove(Object.values(KEYS));
  await deleteAllCovers();
}
