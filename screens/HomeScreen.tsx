// screens/HomeScreen.tsx

import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../lib/theme';
import { getBooks } from '../lib/storage';
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

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const books = await getBooks();
        setBookCount(books.length);
        setSuggestedBook(pickRandomUnread(books));
      })();
    }, []),
  );

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text, fontSize: 22 * theme.fontScale }]}>Media Base</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
          <Text style={{ color: theme.colors.accent, fontSize: 15 * theme.fontScale }}>Settings</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {settings.categories.length === 0 && (
          <Text style={{ color: theme.colors.textMuted, fontSize: 15 * theme.fontScale }}>
            No categories selected yet. Head to Settings → Profile to pick some.
          </Text>
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
              <Text style={[styles.widgetTitle, { color: theme.colors.text, fontSize: 17 * theme.fontScale }]}>
                {CATEGORY_LABELS[cat]}
              </Text>

              {isBooks ? (
                <>
                  <Text style={{ color: theme.colors.textSecondary, fontSize: 14 * theme.fontScale, marginTop: 2 }}>
                    {bookCount} {bookCount === 1 ? 'book' : 'books'} tracked
                  </Text>
                  {suggestedBook && (
                    <Text style={{ color: theme.colors.accent, fontSize: 14 * theme.fontScale, marginTop: 6 }}>
                      Try today: {suggestedBook.title}
                    </Text>
                  )}
                </>
              ) : (
                <Text style={{ color: theme.colors.textMuted, fontSize: 14 * theme.fontScale, marginTop: 2 }}>
                  Coming soon
                </Text>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  title: { fontWeight: '700' },
  content: { padding: 20, paddingTop: 8 },
  widget: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  widgetTitle: { fontWeight: '600' },
});
