// screens/SettingsScreen.tsx

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../lib/theme';

const ROWS: { label: string; route: string }[] = [
  { label: 'Profile', route: 'ProfileSettings' },
  { label: 'Theme', route: 'ThemeSettings' },
  { label: 'Data', route: 'DataSettings' },
  { label: 'Permissions', route: 'PermissionsSettings' },
  { label: 'About', route: 'About' },
  { label: 'FAQ', route: 'FAQ' },
];

export default function SettingsScreen({ navigation }: any) {
  const { theme } = useTheme();

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={{ color: theme.colors.accent, fontSize: 15 * theme.fontScale }}>‹ Home</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text, fontSize: 20 * theme.fontScale }]}>Settings</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={styles.content}>
        {ROWS.map((row) => (
          <TouchableOpacity
            key={row.route}
            onPress={() => navigation.navigate(row.route)}
            style={[styles.row, { borderColor: theme.colors.border }]}
          >
            <Text style={{ color: theme.colors.text, fontSize: 16 * theme.fontScale }}>{row.label}</Text>
            <Text style={{ color: theme.colors.textMuted, fontSize: 16 * theme.fontScale }}>›</Text>
          </TouchableOpacity>
        ))}
      </View>
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 16,
  },
});
