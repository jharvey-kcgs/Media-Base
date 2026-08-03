// screens/HomeScreen.tsx

import React, { useCallback, useState } from 'react';
import { View, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import AppText from '../components/AppText';
import ScreenHeader from '../components/ScreenHeader';
import CoverThumbnail from '../components/CoverThumbnail';
import { useTheme } from '../lib/theme';
import { getBooks, getComics, getMovies, getDailyPick, saveDailyPick, toLocalDateString } from '../lib/storage';
import { CATEGORY_LABELS, MediaCategory } from '../types/models';

// Categories with a working screen so far. Everything else selected during
// Onboarding shows a "coming soon" widget until its screen is built.
const IMPLEMENTED: Partial<Record<MediaCategory, keyof RootStackParamList>> = {
  books: 'Book',
  comics: 'Comic',
  movies: 'Movie',
};

// Kept local rather than imported from App.tsx to avoid a circular import -
// only the couple of route names this screen actually navigates to matter here.
type RootStackParamList = {
  Book: undefined;
  Comic: undefined;
  Movie: undefined;
  Settings: undefined;
};

interface TrackedItem {
  id: string;
  title: string;
  coverImage?: string | null;
}

interface WidgetData {
  count: number;
  suggestion: string | null;
  suggestionCoverImage: string | null;
  unitSingular: string;
  unitPlural: string;
}

// "77 Books Tracked" / "47 Entries Tracked" / "Try Today: ..." - Title
// Case throughout this widget specifically, per explicit request. The
// unit words themselves (book/books, entry/entries, movie/movies) are
// passed in lowercase since they're reused elsewhere in lowercase
// contexts (error messages, etc.) - only capitalized right here at the
// point of display.
function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function pickRandomUnread<T extends TrackedItem>(items: T[], isDone: (item: T) => boolean): T | null {
  const unread = items.filter((i) => !isDone(i));
  if (unread.length === 0) return null;
  return unread[Math.floor(Math.random() * unread.length)];
}

// One implemented category's full widget data: count, plus today's "try
// this" suggestion, which stays fixed for the whole calendar day (even
// across manual refreshes/app reopens) unless the day changes or the
// previous pick got marked done/deleted since it was chosen. Generic over
// any category whose items look like { id, title, coverImage } - isDone is
// passed in separately since the "done" field's actual name differs per
// category (Books/Comics: read, Movies: watched).
async function loadWidgetData<T extends TrackedItem>(
  category: string,
  items: T[],
  isDone: (item: T) => boolean,
  unitSingular: string,
  unitPlural: string,
  today: string,
): Promise<WidgetData> {
  const stored = await getDailyPick(category);
  let pick: T | null = null;
  if (stored && stored.date === today) {
    const stillValid = items.find((i) => i.id === stored.itemId && !isDone(i));
    if (stillValid) pick = stillValid;
  }
  if (!pick) {
    pick = pickRandomUnread(items, isDone);
    if (pick) await saveDailyPick(category, pick.id);
  }
  return {
    count: items.length,
    suggestion: pick?.title ?? null,
    suggestionCoverImage: pick?.coverImage ?? null,
    unitSingular,
    unitPlural,
  };
}

export default function HomeScreen({ navigation }: any) {
  const { theme, settings } = useTheme();
  const [widgetData, setWidgetData] = useState<Partial<Record<MediaCategory, WidgetData>>>({});

  const load = useCallback(async () => {
    const today = toLocalDateString(new Date());
    const [books, comics, movies] = await Promise.all([getBooks(), getComics(), getMovies()]);
    const [booksData, comicsData, moviesData] = await Promise.all([
      loadWidgetData('books', books, (b) => b.read, 'book', 'books', today),
      loadWidgetData('comics', comics, (c) => c.read, 'entry', 'entries', today),
      loadWidgetData('movies', movies, (m) => m.watched, 'movie', 'movies', today),
    ]);
    setWidgetData({ books: booksData, comics: comicsData, movies: moviesData });
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.colors.background }]} edges={['left', 'right', 'bottom']}>
      <ScreenHeader
        title="Media Base"
        left={
          <TouchableOpacity onPress={() => navigation.navigate('Settings')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="settings-outline" size={24} color={theme.colors.accentReadable} />
          </TouchableOpacity>
        }
        right={
          <TouchableOpacity onPress={load} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="play" size={24} color={theme.colors.accentReadable} />
          </TouchableOpacity>
        }
      />

      <ScrollView contentContainerStyle={styles.content}>
        {settings.categories.length === 0 && (
          <AppText style={{ color: theme.colors.textMuted, fontSize: 15 * theme.fontScale }}>
            No categories selected yet. Head to Settings → Profile to pick some.
          </AppText>
        )}

        {settings.categories.map((cat) => {
          const route = IMPLEMENTED[cat];
          const data = widgetData[cat];

          return (
            <TouchableOpacity
              key={cat}
              disabled={!route}
              onPress={() => route && navigation.navigate(route)}
              style={[styles.widget, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
            >
              <AppText variant="header" style={{ color: theme.colors.text, fontSize: 17 * theme.fontScale }}>
                {CATEGORY_LABELS[cat]}
              </AppText>

              {data ? (
                <>
                  <AppText style={{ color: theme.colors.textSecondary, fontSize: 14 * theme.fontScale, marginTop: 2 }}>
                    {data.count} {capitalize(data.count === 1 ? data.unitSingular : data.unitPlural)} Tracked
                  </AppText>
                  {data.suggestion && (
                    <View style={styles.suggestionRow}>
                      <CoverThumbnail
                        uri={data.suggestionCoverImage}
                        iconName={cat === 'movies' ? 'film-outline' : 'book-outline'}
                      />
                      <AppText
                        style={{ color: theme.colors.accentReadable, fontSize: 14 * theme.fontScale, flexShrink: 1 }}
                      >
                        Try Today: {data.suggestion}
                      </AppText>
                    </View>
                  )}
                </>
              ) : (
                <AppText style={{ color: theme.colors.textMuted, fontSize: 14 * theme.fontScale, marginTop: 2 }}>
                  Coming soon
                </AppText>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 20, paddingTop: 8 },
  widget: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
});
