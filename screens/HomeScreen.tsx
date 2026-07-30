// screens/HomeScreen.tsx

import React, { useCallback, useState } from 'react';
import { TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import AppText from '../components/AppText';
import ScreenHeader from '../components/ScreenHeader';
import { useTheme } from '../lib/theme';
import { getBooks, getDailyPick, saveDailyPick, toLocalDateString } from '../lib/storage';
import { Book, CATEGORY_LABELS, MediaCategory } from '../types/models';

// Categories with a working screen so far. Everything else selected during
// Onboarding shows a "coming soon" widget until its screen is built.
const IMPLEMENTED: Partial<Record<MediaCategory, keyof RootStackParamList>> = {
  books: 'Book',
};

// Kept local rather than imported from App.tsx to avoid a circular import -
// only the couple of route names this screen actually navigates to matter here.
type RootStackParamList = {
  Book: undefined;
  Settings: undefined;
};

function pickRandomUnread(books: Book[]): Book | null {
  const unread = books.filter((b) => !b.read);
  if (unread.length === 0) return null;
  return unread[Math.floor(Math.random() * unread.length)];
}

export default function HomeScreen({ navigation }: any) {
  const { theme, settings } = useTheme();
  const [suggestedBook, setSuggestedBook] = useState<Book | null>(null);
  const [bookCount, setBookCount] = useState(0);

  const load = useCallback(async () => {
    const books = await getBooks();
    setBookCount(books.length);

    // A "try today" suggestion should stay the same all calendar day,
    // even across manual refreshes/app reopens - only actually re-rolling
    // once the day changes, or if today's stored pick got marked read or
    // deleted since it was chosen.
    const today = toLocalDateString(new Date());
    const stored = await getDailyPick('books');
    let pick: Book | null = null;
    if (stored && stored.date === today) {
      const stillValid = books.find((b) => b.id === stored.itemId && !b.read);
      if (stillValid) pick = stillValid;
    }
    if (!pick) {
      pick = pickRandomUnread(books);
      if (pick) await saveDailyPick('books', pick.id);
    }
    setSuggestedBook(pick);
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
          const isBooks = cat === 'books';

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

              {isBooks ? (
                <>
                  <AppText style={{ color: theme.colors.textSecondary, fontSize: 14 * theme.fontScale, marginTop: 2 }}>
                    {bookCount} {bookCount === 1 ? 'book' : 'books'} tracked
                  </AppText>
                  {suggestedBook && (
                    <AppText style={{ color: theme.colors.accentReadable, fontSize: 14 * theme.fontScale, marginTop: 6 }}>
                      Try today: {suggestedBook.title}
                    </AppText>
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
});
