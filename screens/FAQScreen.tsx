// screens/FAQScreen.tsx

import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppText from '../components/AppText';
import ScreenHeader from '../components/ScreenHeader';
import { useTheme } from '../lib/theme';

const FAQS: { q: string; a: string }[] = [
  {
    q: 'Do I have to scan a barcode to add something?',
    a: "No - scanning is always optional on Books, Comics/Manga, and Vinyl/CD, and every entry form lets you type everything in by hand instead. Movies, TV Shows, Anime, and Tabletop Games don't have a scan option at all - title search is the fast path there instead.",
  },
  {
    q: "Why isn't a category showing on my Home screen?",
    a: 'Check Settings → Profile - it may have been turned off. Turning it back on brings its widget and data back.',
  },
  {
    q: 'What happens to my rating after I mark something as done?',
    a: 'It opens a place to rate (1-5 stars) and leave a written review, and the item stops showing up as a suggestion.',
  },
  {
    q: 'Can an entry have more than one genre?',
    a: "Yes. On Books, Comics/Manga, Movies, TV Shows, and Anime, up to 4 - they're matched against a built-in list of real genre terms so auto-filled results stay clean rather than picking up stray keywords. Vinyl/CD and Tabletop Games work a bit differently: their sources already return clean genre data directly, so there's no cleanup step or 4-genre cap on the entry itself - the fixed, short list you see in Filter by genre... on those two is just the filter menu, not a limit on what an entry can actually hold. Filter by any genre from the ••• menu → Filter by genre... on any category.",
  },
  {
    q: 'Can I delete more than one entry at a time?',
    a: 'Yes - press and hold any entry to switch into a selection mode with that entry already checked, tap any others you want to remove, then Delete.',
  },
  {
    q: 'Can I see everything by one author or artist?',
    a: "Yes - on Books and Comics/Manga, tap an author's name on any entry (shown in the accent color) to narrow the list to just their books. On Vinyl/CD, tap an artist's name the same way to narrow to just their records. Tap the ✕ next to \"Sorted by...\" to clear it.",
  },
  {
    q: 'Can a Comic/Manga end up under Books, or a Book under Comics/Manga?',
    a: "No - they're stored completely separately, so nothing added under one screen can ever show up in the other. If you scan or enter an ISBN that's clearly classified as the wrong type, the app won't auto-fill it and tells you which screen to use instead.",
  },
  {
    q: "Why didn't I get a cover photo when I added something?",
    a: "Not every book, comic, movie, TV show, or anime has a cover photo indexed anywhere online - same as genre, some entries just don't have one available, which isn't a bug. Tap the cover in Add/Edit to take a photo or choose one from your library instead.",
  },
  {
    q: 'How do I find out where to watch a movie, show, or anime?',
    a: 'On Movies, TV Shows, and Anime, entries matched against the main movie/show database get a "Where to Watch" button in the Edit screen - tap it for current streaming, rental, and purchase options. An entry typed in entirely by hand won\'t have this button, and on Anime specifically, a less common title matched only through the backup lookup source won\'t either - both need to know exactly which title you mean.',
  },
  {
    q: "Why don't Vinyl/CD or Tabletop Games have a similar button for where to listen or play?",
    a: "By design - both are for things you already physically own, so there's no \"where can I access this\" question to answer the way there is for a movie or show you might not have seen yet. You already have the copy; just play or listen to it.",
  },
  {
    q: 'Does my photo get saved anywhere else on my phone?',
    a: "No - a photo taken through Media Base stays inside the app only. It's never added to your device's Photos app, and no other app can see it.",
  },
  {
    q: 'Does my backup file include cover photos?',
    a: 'Yes - Settings → Data → Save Backup File includes every cover photo along with your entries, all in one file.',
  },
];

export default function FAQScreen({ navigation }: any) {
  const { theme } = useTheme();

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.colors.background }]} edges={['left', 'right', 'bottom']}>
      <ScreenHeader title="FAQ" onBack={() => navigation.goBack()} backLabel="Settings" />

      <ScrollView contentContainerStyle={styles.content}>
        {FAQS.map((item, i) => (
          <View
            key={item.q}
            style={[
              styles.card,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
              i === FAQS.length - 1 && { marginBottom: 0 },
            ]}
          >
            <AppText variant="header" style={{ color: theme.colors.accentReadable, fontSize: 15 * theme.fontScale, marginBottom: 6 }}>
              {item.q}
            </AppText>
            <AppText style={{ color: theme.colors.textSecondary, fontSize: 14 * theme.fontScale, lineHeight: 20 }}>
              {item.a}
            </AppText>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 20, paddingTop: 8 },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
  },
});
