// screens/AboutScreen.tsx

import React from 'react';
import { View, ScrollView, StyleSheet, Image, TouchableOpacity, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppText from '../components/AppText';
import ScreenHeader from '../components/ScreenHeader';
import { useTheme } from '../lib/theme';

// `body` alone renders as a single plain paragraph (unchanged from
// before) - `intro` + `bullets` renders a short lead-in sentence
// followed by a labeled list, for any card whose content is genuinely
// per-category or per-permission rather than one continuous idea.
// Confirmed directly: several cards had grown into dense paragraphs
// that were hard to scan on a phone screen, especially where the same
// paragraph covered several different categories at once. `image`
// (currently only used by BGG's required "Powered by BGG" logo, see
// Credits below) renders as its own tappable row, real dimensions
// matching that specific asset's own aspect ratio.
const SECTIONS: {
  title: string;
  body?: string;
  intro?: string;
  bullets?: { label: string; text: string }[];
  outro?: string;
  image?: { source: any; width: number; height: number; url: string; accessibilityLabel: string };
}[] = [
  {
    title: 'Profile',
    body: "Lets you pick which media categories show up as widgets on your Home screen. Turning a category off hides its widget but keeps everything you've already added, in case you turn it back on.",
  },
  {
    title: 'Finding Entries',
    intro: "Every category screen has a search box (below \"Sorted by...\") to quickly find something by name, a dedicated genre filter, and an A-Z index for jumping around a longer list. A couple of categories add one more trick on top of that:",
    bullets: [
      { label: 'Books, Comics/Manga', text: "tap an author's name (shown in the accent color) to narrow the list to just their books." },
      { label: 'Vinyl/CD', text: "tap an artist's name the same way to narrow to just their records." },
      { label: 'Movies, TV Shows, Anime, Tabletop Games', text: 'search, genre filter, and A-Z all work the same as everywhere else - no author/artist tap here, since none of these track that kind of field.' },
    ],
    outro: 'Tap the ✕ next to "Sorted by..." to clear an author/artist filter once it\'s set.',
  },
  {
    title: 'Adding Entries',
    intro: 'Whichever method a category supports, you get a chance to review and edit every field before saving, and the same title can\'t be added twice.',
    bullets: [
      { label: 'Books, Comics/Manga', text: 'type everything by hand, scan a barcode, enter the code directly, or search by title and pick the right result.' },
      { label: 'Vinyl/CD', text: 'the same four methods as Books/Comics - its own barcode search is a real, direct match, closer to Books/Comics\' own ISBN lookup than to what Movies tried and dropped.' },
      { label: 'Movies', text: 'title search only - real testing showed a barcode-based lookup was unreliable in practice, and title search was already the more reliable path.' },
      { label: 'TV Shows, Anime', text: 'title search only, by design from the start.' },
      { label: 'Tabletop Games', text: "title search only - there's no barcode database for board or card games the way there is for movies or music." },
    ],
    outro: 'Every category is stored completely separately, so nothing added under one can ever end up in another.',
  },
  {
    title: 'The ••• Menu',
    body: 'Top right of each category screen - has Add entry / Filter by... / Filter by genre....',
  },
  {
    title: 'Deleting Entries',
    body: 'Press and hold any entry to remove one or many at once - that switches the screen into a selection mode with the entry you held already checked, tap any others you want to remove, then Delete.',
  },
  {
    title: 'Cover Photos',
    body: "Cover photos fill in automatically wherever one's available, whichever way you add an entry. Tap an item's cover in Add/Edit to take a new photo, choose one from your library, or remove it - your own photo is never added to your device's Photos app, it stays inside Media Base only.",
  },
  {
    title: 'Where to Watch',
    body: 'On Movies, TV Shows, and Anime, a "Where to Watch" button in Edit opens a page showing current streaming, rental, and purchase options for that title. Only shows up on entries matched against the main movie/show database - a typed-in-by-hand entry won\'t have it, and on Anime, a title found only through the backup lookup source won\'t either.',
  },
  {
    title: 'Tracking Progress',
    body: "Marking an item as not-yet-read/watched/listened/played/completed is what makes it eligible to show up as today's random suggestion on Home. Marking it done opens a place to rate and review it, and it stops appearing as a suggestion.",
  },
  {
    title: 'Data',
    body: 'Save everything - your entries and their cover photos - to one backup file, restore from a previous backup file, or permanently delete all your data. Deletion is all-or-nothing and always asks for confirmation twice.',
  },
  {
    title: 'Permissions',
    intro: 'Shows whether each of these is currently granted, always kept in sync with your actual Phone Settings, and links straight there to change any of them.',
    bullets: [
      { label: 'Camera', text: "used only for the optional scan shortcut on Books, Comics/Manga, and Vinyl/CD - Movies, TV Shows, Anime, and Tabletop Games don't use it at all." },
      { label: 'Photo Library', text: 'used only when you choose "Choose from Library" for a cover photo - taking a new photo with the camera doesn\'t need it.' },
      { label: 'Daily Reminder', text: 'one notification at 10:00 AM nudging you to check today\'s recommendations, with no specific pick named.' },
    ],
  },
  {
    title: 'Credits',
    bullets: [
      { label: 'TMDb', text: 'this product uses the TMDb API but is not endorsed or certified by TMDb.' },
      { label: 'Discogs', text: "this application uses Discogs' API but is not affiliated with, sponsored or endorsed by Discogs. 'Discogs' is a trademark of Zink Media, LLC." },
      { label: 'BoardGameGeek', text: 'board and card game data provided by BoardGameGeek.' },
    ],
    image: {
      source: require('../assets/powered-by-bgg.png'),
      width: 140,
      height: 41,
      url: 'https://boardgamegeek.com',
      accessibilityLabel: 'Powered by BGG - opens BoardGameGeek',
    },
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
            {section.body && (
              <AppText style={{ color: theme.colors.textSecondary, fontSize: 14 * theme.fontScale, lineHeight: 21 }}>
                {section.body}
              </AppText>
            )}
            {section.intro && (
              <AppText style={{ color: theme.colors.textSecondary, fontSize: 14 * theme.fontScale, lineHeight: 21, marginBottom: 10 }}>
                {section.intro}
              </AppText>
            )}
            {section.bullets?.map((bullet, bi) => (
              <View key={bullet.label} style={[styles.bulletRow, bi === section.bullets!.length - 1 && !section.outro && { marginBottom: 0 }]}>
                <AppText style={{ color: theme.colors.textSecondary, fontSize: 14 * theme.fontScale, lineHeight: 21 }}>
                  {'\u2022  '}
                  <AppText style={{ color: theme.colors.text, fontSize: 14 * theme.fontScale }}>{bullet.label}</AppText>
                  {' — '}
                  {bullet.text}
                </AppText>
              </View>
            ))}
            {section.outro && (
              <AppText style={{ color: theme.colors.textSecondary, fontSize: 14 * theme.fontScale, lineHeight: 21, marginTop: 10 }}>
                {section.outro}
              </AppText>
            )}
            {section.image && (
              <TouchableOpacity
                onPress={() => {
                  Linking.openURL(section.image!.url).catch((err) => {
                    console.warn('Media Base: failed to open URL', err);
                    Alert.alert("Couldn't open that", 'Something went wrong opening the link - please try again.');
                  });
                }}
                accessibilityLabel={section.image.accessibilityLabel}
                style={{ marginTop: 10 }}
              >
                <Image
                  source={section.image.source}
                  style={{ width: section.image.width, height: section.image.height }}
                  resizeMode="contain"
                />
              </TouchableOpacity>
            )}
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
  bulletRow: {
    marginBottom: 8,
  },
});
