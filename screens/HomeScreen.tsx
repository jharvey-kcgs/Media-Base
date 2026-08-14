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
import { getBooks, getComics, getMovies, getTVShows, getAnime, getVinylCDs, getTabletopGames, getOrAssignDailyPick, toLocalDateString } from '../lib/storage';
import { CATEGORY_LABELS, MediaCategory } from '../types/models';

// Categories with a working screen so far. Everything else selected during
// Onboarding shows a "coming soon" widget until its screen is built.
const IMPLEMENTED: Partial<Record<MediaCategory, keyof RootStackParamList>> = {
  books: 'Book',
  comics: 'Comic',
  movies: 'Movie',
  tvshows: 'TV',
  anime: 'Anime',
  vinyl: 'Vinyl',
  tabletop: 'Tabletop',
};

// Kept local rather than imported from App.tsx to avoid a circular import -
// only the couple of route names this screen actually navigates to matter here.
type RootStackParamList = {
  Book: undefined;
  Comic: undefined;
  Movie: undefined;
  TV: undefined;
  Anime: undefined;
  Vinyl: undefined;
  Tabletop: undefined;
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

// One implemented category's full widget data: count, plus today's "try
// this" suggestion. Assignment/stability is fully handled by
// lib/storage.ts's getOrAssignDailyPick() now, not here - see that
// function's own comment for why the logic used to live split across
// this file and lib/storage.ts, and why that split was itself the bug.
// Generic over any category whose items look like { id, title,
// coverImage } - isDone is passed in separately since the "done"
// field's actual name differs per category (Books/Comics: read,
// Movies: watched).
async function loadWidgetData<T extends TrackedItem>(
  category: string,
  items: T[],
  isDone: (item: T) => boolean,
  unitSingular: string,
  unitPlural: string,
  today: string,
): Promise<WidgetData> {
  const pick = await getOrAssignDailyPick(category, items, isDone, today);
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
    const [books, comics, movies, tvShows, anime, vinyl, tabletop] = await Promise.all([
      getBooks(),
      getComics(),
      getMovies(),
      getTVShows(),
      getAnime(),
      getVinylCDs(),
      getTabletopGames(),
    ]);
    const [booksData, comicsData, moviesData, tvShowsData, animeData, vinylData, tabletopData] = await Promise.all([
      loadWidgetData('books', books, (b) => b.read, 'book', 'books', today),
      loadWidgetData('comics', comics, (c) => c.read, 'entry', 'entries', today),
      loadWidgetData('movies', movies, (m) => m.watched, 'movie', 'movies', today),
      loadWidgetData('tvshows', tvShows, (t) => t.watched, 'show', 'shows', today),
      // "anime" reads correctly as both singular and plural already
      // (same as "sheep"), so the same word covers both unit slots.
      loadWidgetData('anime', anime, (a) => a.watched, 'anime', 'anime', today),
      // "record" covers both vinyl and CD collectively - a natural
      // enough umbrella term for the widget text either way.
      loadWidgetData('vinyl', vinyl, (v) => v.listened, 'record', 'records', today),
      loadWidgetData('tabletop', tabletop, (g) => g.played, 'game', 'games', today),
    ]);
    setWidgetData({
      books: booksData,
      comics: comicsData,
      movies: moviesData,
      tvshows: tvShowsData,
      anime: animeData,
      vinyl: vinylData,
      tabletop: tabletopData,
    });
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
                        iconName={
                          cat === 'movies'
                            ? 'film-outline'
                            : cat === 'tvshows'
                              ? 'tv-outline'
                              : cat === 'anime'
                                ? 'sparkles-outline'
                                : cat === 'vinyl'
                                  ? 'disc-outline'
                                  : cat === 'tabletop'
                                    ? 'extension-puzzle-outline'
                                    : 'book-outline'
                        }
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
