// lib/storage.ts

import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { AppSettings, DEFAULT_SETTINGS, Book } from '../types/models';

const KEYS = {
  settings: 'mediabase:settings',
  books: 'mediabase:books',
  dailyPicks: 'mediabase:dailyPicks',
};

const newId = () => uuidv4();

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

export async function addBook(input: Omit<Book, 'id' | 'createdAt'>): Promise<Book> {
  const books = await getBooks();
  const book: Book = { ...input, id: newId(), createdAt: new Date().toISOString() };
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
  version: 1;
  exportedAt: string;
  data: Record<string, string>;
}

/** Serializes every stored key into one JSON string, for backup/transfer. */
export async function exportAllData(): Promise<string> {
  const allKeys = Object.values(KEYS);
  const pairs = await AsyncStorage.multiGet(allKeys);
  const data: Record<string, string> = {};
  for (const [key, value] of pairs) {
    if (value !== null) data[key] = value;
  }
  const payload: BackupPayload = {
    app: 'media-base',
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
  };
  return JSON.stringify(payload, null, 2);
}

/** Restores data from a backup produced by exportAllData(). Throws if unrecognizable. */
export async function importAllData(jsonString: string): Promise<void> {
  let parsed: any;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new Error("That doesn't look like valid backup text.");
  }
  if (!parsed || parsed.app !== 'media-base' || typeof parsed.data !== 'object') {
    throw new Error("That doesn't look like a Media Base backup.");
  }
  const validKeys = new Set(Object.values(KEYS));
  const entries = Object.entries(parsed.data).filter(([key]) => validKeys.has(key));
  await AsyncStorage.multiSet(entries as [string, string][]);
}

/** All-or-nothing wipe, per the confirmed Settings > Data > Delete Data design. */
export async function deleteAllData(): Promise<void> {
  await AsyncStorage.multiRemove(Object.values(KEYS));
}
