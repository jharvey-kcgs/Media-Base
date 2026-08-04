// screens/AboutScreen.tsx

import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppText from '../components/AppText';
import ScreenHeader from '../components/ScreenHeader';
import { useTheme } from '../lib/theme';

const SECTIONS: { title: string; body: string }[] = [
  {
    title: 'Profile',
    body: "Lets you pick which media categories show up as widgets on your Home screen. Turning a category off hides its widget but keeps everything you've already added, in case you turn it back on.",
  },
  {
    title: 'Finding entries',
    body: "Each category screen lists what you've added, with a search box (below \"Sorted by...\") to quickly find one by name, a dedicated genre filter, and an A-Z index for jumping around a longer list. On Books and Comics/Manga, tapping an author's name (shown in the accent color) narrows the list to just their books; on Music, tapping an artist's name does the same for their albums. Tap the ✕ next to \"Sorted by...\" to clear it.",
  },
  {
    title: 'Adding entries',
    body: "Books and Comics/Manga support typing everything by hand, scanning a barcode, entering the ISBN directly, or searching by title and picking the right result. Movies, TV Shows, Anime, and Music are title-search only - no scanning or number entry for any of them, since real testing showed a barcode-based lookup for movies was unreliable in practice, and title search was already the more reliable path. Whichever method you use, you get a chance to review and edit every field before saving, and the same title can't be added twice. Every category is stored completely separately, so nothing added under one can ever end up in another.",
  },
  {
    title: 'Cover photos',
    body: "Cover photos fill in automatically wherever one's available, whichever way you add an entry. Tap an item's cover in Add/Edit to take a new photo, choose one from your library, or remove it - your own photo is never added to your device's Photos app, it stays inside Media Base only.",
  },
  {
    title: 'Where to Watch',
    body: "On Movies, TV Shows, and Anime, entries added through title search get a \"Where to Watch\" button in Edit - tap it to open a page showing which streaming services currently carry that title, plus rental/purchase pricing where available. This only shows up for entries matched against the main movie/show database - an entry typed in entirely by hand won't have this button, and on Anime specifically, a less common title matched only through the backup lookup source (used only when the main one has no match) won't either.",
  },
  {
    title: 'Where to Listen',
    body: 'Every Music entry has a "Where to Listen" button in Edit - tap it to search Spotify for that album. Unlike Where to Watch, this always shows, even on an album typed in entirely by hand - it just needs the artist and title text, not a precise match against a database.',
  },
  {
    title: 'The ••• menu & deleting entries',
    body: 'The ••• menu (top right of each category screen) has Add entry / Filter by... / Filter by genre.... To remove one or many entries at once, press and hold any entry - that switches the screen into a selection mode with the entry you held already checked, tap any others you want to remove, then Delete.',
  },
  {
    title: 'Tracking progress',
    body: "Marking an item as not-yet-read/watched/listened/played/completed is what makes it eligible to show up as today's random suggestion on Home. Marking it done opens a place to rate and review it, and it stops appearing as a suggestion.",
  },
  {
    title: 'Data',
    body: 'Save everything - your entries and their cover photos - to one backup file, restore from a previous backup file, or permanently delete all your data. Deletion is all-or-nothing and always asks for confirmation twice.',
  },
  {
    title: 'Permissions',
    body: "Shows whether Camera and Photo Library access are currently granted, always kept in sync with your actual Phone Settings, and links straight there to change either. Camera is only used for the optional scan shortcut on Books and Comics/Manga - Movies, TV Shows, Anime, and Music don't use it at all. Photo Library is only used when you choose \"Choose from Library\" for a cover photo - taking a new photo with the camera doesn't need it. Also has a Daily reminder toggle: one notification at 10:00 AM nudging you to check today's recommendations, with no specific pick named.",
  },
  {
    title: 'Credits',
    body: 'This product uses the TMDb API but is not endorsed or certified by TMDb.',
  },
];

export default function AboutScreen({ navigation }: any) {
  const { theme } = useTheme();

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.colors.background }]} edges={['left', 'right', 'bottom']}>
      <ScreenHeader title="About" onBack={() => navigation.goBack()} backLabel="Settings" />

      <ScrollView contentContainerStyle={styles.content}>
        {SECTIONS.map((section, i) => (
          <View
            key={section.title}
            style={[
              styles.card,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
              i === SECTIONS.length - 1 && { marginBottom: 0 },
            ]}
          >
            <AppText variant="header" style={{ color: theme.colors.accentReadable, fontSize: 16 * theme.fontScale, marginBottom: 6 }}>
              {section.title}
            </AppText>
            <AppText style={{ color: theme.colors.textSecondary, fontSize: 14 * theme.fontScale, lineHeight: 21 }}>
              {section.body}
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
