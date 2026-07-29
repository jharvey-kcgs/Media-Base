// screens/AboutScreen.tsx

import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../lib/theme';

export default function AboutScreen({ navigation }: any) {
  const { theme } = useTheme();

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={{ color: theme.colors.accent, fontSize: 15 * theme.fontScale }}>‹ Settings</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text, fontSize: 20 * theme.fontScale }]}>About</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.section, { color: theme.colors.text, fontSize: 15 * theme.fontScale }]}>
          Profile lets you pick which media categories show up as widgets on your Home screen. Turning a
          category off hides its widget but keeps everything you've already added, in case you turn it back on.
        </Text>
        <Text style={[styles.section, { color: theme.colors.text, fontSize: 15 * theme.fontScale }]}>
          Each category screen lists what you've added, with sorting and filtering options specific to that
          category. Marking an item as not-yet-read/watched/listened/played/completed is what makes it eligible
          to show up as today's random suggestion on Home. Marking it done opens a place to rate and review it,
          and it stops appearing as a suggestion.
        </Text>
        <Text style={[styles.section, { color: theme.colors.text, fontSize: 15 * theme.fontScale }]}>
          Settings → Data lets you export everything to a backup file, import a previous backup, or permanently
          delete all your data. Deletion is all-or-nothing and always asks for confirmation twice.
        </Text>
        <Text style={[styles.section, { color: theme.colors.text, fontSize: 15 * theme.fontScale }]}>
          Settings → Permissions shows whether camera access is currently granted and links straight to Phone
          Settings to change it. Camera access is only ever used for the optional scan shortcut - nothing about
          adding media requires it.
        </Text>
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
  section: { marginBottom: 16, lineHeight: 22 },
});
