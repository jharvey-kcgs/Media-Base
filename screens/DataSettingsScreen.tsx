// screens/DataSettingsScreen.tsx

import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, TextInput, Share, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppText, { FONT_FAMILY } from '../components/AppText';
import { useTheme } from '../lib/theme';
import { exportAllData, importAllData, deleteAllData } from '../lib/storage';

export default function DataSettingsScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [importText, setImportText] = useState('');

  const handleExport = async () => {
    const json = await exportAllData();
    await Share.share({ message: json });
  };

  const handleImport = async () => {
    try {
      await importAllData(importText);
      Alert.alert('Import complete', 'Your data has been restored.');
      setImportText('');
    } catch (err: any) {
      Alert.alert('Import failed', err.message ?? 'Something went wrong.');
    }
  };

  const handleDelete = () => {
    // Confirmed design: all-or-nothing wipe only, with a two-step confirmation.
    Alert.alert(
      'Delete all data?',
      'This permanently removes every item you have tracked. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete everything',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Are you sure?', 'Last chance - this cannot be undone.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => deleteAllData() },
            ]);
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <AppText style={{ color: theme.colors.accent, fontSize: 15 * theme.fontScale }}>‹ Settings</AppText>
        </TouchableOpacity>
        <AppText variant="header" style={[styles.title, { color: theme.colors.text, fontSize: 20 * theme.fontScale }]}>
          Data
        </AppText>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.content}>
        <TouchableOpacity
          onPress={handleExport}
          style={[styles.button, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}
        >
          <AppText style={{ color: theme.colors.text, fontSize: 16 * theme.fontScale }}>Export data</AppText>
        </TouchableOpacity>

        <AppText style={[styles.label, { color: theme.colors.textSecondary, fontSize: 14 * theme.fontScale }]}>
          Paste a Media Base backup below to import it
        </AppText>
        <TextInput
          value={importText}
          onChangeText={setImportText}
          multiline
          placeholder="Paste backup JSON here"
          placeholderTextColor={theme.colors.textMuted}
          style={[
            styles.input,
            {
              color: theme.colors.text,
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.surface,
              fontFamily: FONT_FAMILY.body,
            },
          ]}
        />
        <TouchableOpacity
          onPress={handleImport}
          disabled={!importText.trim()}
          style={[
            styles.button,
            { borderColor: theme.colors.border, backgroundColor: theme.colors.surface, opacity: importText.trim() ? 1 : 0.5 },
          ]}
        >
          <AppText style={{ color: theme.colors.text, fontSize: 16 * theme.fontScale }}>Import data</AppText>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleDelete}
          style={[styles.button, styles.dangerButton, { borderColor: theme.colors.danger }]}
        >
          <AppText style={{ color: theme.colors.danger, fontSize: 16 * theme.fontScale }}>Delete all data</AppText>
        </TouchableOpacity>
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
  title: {},
  content: { padding: 20, paddingTop: 8 },
  label: { marginTop: 20, marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, minHeight: 100, textAlignVertical: 'top' },
  button: { borderWidth: 1, borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  dangerButton: { marginTop: 32, backgroundColor: 'transparent' },
});
