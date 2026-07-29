// screens/PermissionsSettingsScreen.tsx

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Switch, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCameraPermissions } from 'expo-camera';
import { useTheme } from '../lib/theme';

export default function PermissionsSettingsScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();

  const granted = permission?.granted ?? false;
  // "Can ask again" is false once the user has explicitly denied it before -
  // at that point iOS/Android no longer let an app re-prompt, so the only
  // way back in is the Phone Settings app.
  const canAskAgain = permission?.canAskAgain ?? true;

  const handleToggle = async (wantsOn: boolean) => {
    if (wantsOn) {
      if (!canAskAgain) {
        Alert.alert(
          'Camera access needed',
          'Camera access was turned off outside the app - open Phone Settings to turn it back on.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Phone Settings', onPress: () => Linking.openSettings() },
          ],
        );
        return;
      }
      await requestPermission();
    } else {
      // Apps can't revoke a permission on their own - only the OS settings can.
      Alert.alert(
        'Turn off camera access',
        'This has to be done from Phone Settings, not from inside Media Base.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Phone Settings', onPress: () => Linking.openSettings() },
        ],
      );
    }
  };

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={{ color: theme.colors.accent, fontSize: 15 * theme.fontScale }}>‹ Settings</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text, fontSize: 20 * theme.fontScale }]}>Permissions</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.content}>
        <View style={[styles.row, { borderColor: theme.colors.border }]}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={{ color: theme.colors.text, fontSize: 16 * theme.fontScale }}>Camera access</Text>
            <Text style={{ color: theme.colors.textSecondary, fontSize: 13 * theme.fontScale, marginTop: 2 }}>
              Only used for the optional barcode-scan shortcut when adding an entry.
            </Text>
          </View>
          <Switch
            value={granted}
            onValueChange={handleToggle}
            trackColor={{ true: theme.colors.accent, false: theme.colors.border }}
          />
        </View>

        <TouchableOpacity
          onPress={() => Linking.openSettings()}
          style={[styles.button, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}
        >
          <Text style={{ color: theme.colors.text, fontSize: 16 * theme.fontScale }}>Open Phone Settings</Text>
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
  title: { fontWeight: '700' },
  content: { padding: 20, paddingTop: 8 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  button: { borderWidth: 1, borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
});
