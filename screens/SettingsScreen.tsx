// screens/SettingsScreen.tsx

import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppText from '../components/AppText';
import ScreenHeader from '../components/ScreenHeader';
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
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.colors.background }]} edges={['left', 'right', 'bottom']}>
      <ScreenHeader title="Settings" onBack={() => navigation.goBack()} backLabel="Home" />

      <View style={styles.content}>
        {ROWS.map((row) => (
          <TouchableOpacity
            key={row.route}
            onPress={() => navigation.navigate(row.route)}
            style={[styles.row, { borderColor: theme.colors.border }]}
          >
            <AppText style={{ color: theme.colors.text, fontSize: 16 * theme.fontScale }}>{row.label}</AppText>
            <AppText style={{ color: theme.colors.textMuted, fontSize: 16 * theme.fontScale }}>›</AppText>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 20, paddingTop: 8 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 16,
  },
});
