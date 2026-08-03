// screens/DataSettingsScreen.tsx
//
// Export/Import moved from pasteable text to a real backup file - a
// single JSON file with every cover photo embedded inside it as base64,
// not a .zip (a zip would mean the person has to unzip it themselves
// before restoring, which is exactly the extra friction this was meant
// to avoid). Base64 inflates file size by roughly a third over the raw
// photos, which is the accepted tradeoff for keeping this to one file
// with no unpacking step - not a problem for a local save or AirDrop,
// worth knowing if it ever needs to go through an email attachment
// limit on a very large library.

import React from 'react';
import { View, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import AppText from '../components/AppText';
import ScreenHeader from '../components/ScreenHeader';
import { useTheme } from '../lib/theme';
import { exportAllData, importAllData, deleteAllData } from '../lib/storage';

export default function DataSettingsScreen({ navigation }: any) {
  const { theme, refreshSettings } = useTheme();

  const handleExport = async () => {
    try {
      const fileUri = await exportAllData();
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert('Sharing not available', 'Your device cannot share files right now.');
        return;
      }
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/json',
        dialogTitle: 'Save Media Base backup',
      });
    } catch (err: any) {
      console.warn('Media Base: export failed', err);
      Alert.alert('Export failed', err.message ?? 'Something went wrong building the backup file.');
    }
  };

  const handleImport = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/json', 'public.json', 'public.plain-text'],
      copyToCacheDirectory: true,
    }).catch((err: any) => {
      console.warn('Media Base: document picker threw', err);
      return null;
    });
    if (!result || result.canceled || !result.assets?.[0]?.uri) return;

    try {
      await importAllData(result.assets[0].uri);
      // importAllData writes the restored settings to disk correctly, but
      // the running app's ThemeProvider still holds whatever settings it
      // loaded at launch in memory - without this, the imported theme
      // color/dark mode/text size (and enabled Home categories, which
      // live in that same settings object) wouldn't visibly take effect
      // until the app was fully restarted.
      await refreshSettings();
      Alert.alert('Import complete', 'Your data has been restored.');
    } catch (err: any) {
      Alert.alert('Import failed', err.message ?? 'Something went wrong.');
    }
  };

  const handleDelete = () => {
    // Confirmed design: all-or-nothing wipe only, with a two-step confirmation.
    Alert.alert(
      'Delete all data?',
      'This permanently removes every item you have tracked, including cover photos. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete everything',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Are you sure?', 'Last chance - this cannot be undone.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: async () => {
                  await deleteAllData();
                  // Same reason as the import fix above - deleteAllData
                  // wipes settings on disk too, but the running app needs
                  // to be told to reload them back to defaults.
                  await refreshSettings();
                } },
            ]);
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.colors.background }]} edges={['left', 'right', 'bottom']}>
      <ScreenHeader title="Data" onBack={() => navigation.goBack()} backLabel="Settings" />

      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity
          onPress={handleExport}
          style={[styles.button, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}
        >
          <AppText style={{ color: theme.colors.text, fontSize: 16 * theme.fontScale }}>Save Backup File</AppText>
        </TouchableOpacity>
        <AppText style={[styles.hint, { color: theme.colors.textMuted, fontSize: 12 * theme.fontScale }]}>
          One file with everything - your entries and their cover photos. Save it to Files, AirDrop it, or attach it
          to an email.
        </AppText>

        <TouchableOpacity
          onPress={handleImport}
          style={[styles.button, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface, marginTop: 24 }]}
        >
          <AppText style={{ color: theme.colors.text, fontSize: 16 * theme.fontScale }}>Choose Backup File</AppText>
        </TouchableOpacity>
        <AppText style={[styles.hint, { color: theme.colors.textMuted, fontSize: 12 * theme.fontScale }]}>
          Restores a Media Base backup file - overwrites anything currently in the app with what's in that file.
        </AppText>

        <TouchableOpacity
          onPress={handleDelete}
          style={[styles.button, styles.dangerButton, { borderColor: theme.colors.danger }]}
        >
          <AppText style={{ color: theme.colors.danger, fontSize: 16 * theme.fontScale }}>Delete all data</AppText>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 20, paddingTop: 8 },
  hint: { marginTop: 8, marginHorizontal: 4 },
  button: { borderWidth: 1, borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
  dangerButton: { marginTop: 40, backgroundColor: 'transparent' },
});
