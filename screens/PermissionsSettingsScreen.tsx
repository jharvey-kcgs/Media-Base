// screens/PermissionsSettingsScreen.tsx

import React, { useEffect, useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Switch, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCameraPermissions } from 'expo-camera';
import * as Notifications from 'expo-notifications';
import AppText from '../components/AppText';
import ScreenHeader from '../components/ScreenHeader';
import { useTheme } from '../lib/theme';
import { getSettings, saveSettings } from '../lib/storage';
import { scheduleDailyRecommendationNotification, cancelDailyRecommendationNotification } from '../lib/notifications';

export default function PermissionsSettingsScreen({ navigation }: any) {
  const { theme, settings, refreshSettings } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [notifStatus, setNotifStatus] = useState<Notifications.PermissionStatus | null>(null);

  useEffect(() => {
    Notifications.getPermissionsAsync().then((p) => setNotifStatus(p.status));
  }, []);

  const granted = permission?.granted ?? false;
  const canAskAgain = permission?.canAskAgain ?? true;

  const handleCameraToggle = async (wantsOn: boolean) => {
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

  const handleNotificationToggle = async (wantsOn: boolean) => {
    if (wantsOn) {
      let status = notifStatus;
      if (status !== 'granted') {
        // Explicit rather than relying on requestPermissionsAsync()'s
        // defaults - Expo Go shares ONE OS-level notification permission
        // across every project you test in it (it's a single native app
        // hosting many JS projects), so if a different project already
        // triggered the permission prompt at some point without the
        // badge option granted, status here can already read 'granted'
        // and this call never re-prompts - the badge then just silently
        // never appears. Being explicit here doesn't fix that (iOS won't
        // re-prompt once a decision is on file either way - Settings app
        // is the only fix then), but it does mean a genuinely fresh
        // first-time prompt always asks for badge specifically.
        const result = await Notifications.requestPermissionsAsync({
          ios: { allowAlert: true, allowBadge: true, allowSound: true },
        });
        status = result.status;
        setNotifStatus(status);
        if (status === 'granted' && result.ios?.allowsBadge === false) {
          console.warn(
            'Media Base: notification permission granted, but badges specifically are not authorized - check Settings > Notifications > Expo Go > Badges.',
          );
        }
      }
      if (status !== 'granted') {
        Alert.alert(
          'Notifications needed',
          'Notification access was turned off - open Phone Settings to allow it, then try again.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Phone Settings', onPress: () => Linking.openSettings() },
          ],
        );
        return;
      }
      await scheduleDailyRecommendationNotification();
    } else {
      await cancelDailyRecommendationNotification();
    }
    const current = await getSettings();
    await saveSettings({ ...current, notificationsEnabled: wantsOn });
    await refreshSettings();
  };

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.colors.background }]} edges={['left', 'right', 'bottom']}>
      <ScreenHeader title="Permissions" onBack={() => navigation.goBack()} backLabel="Settings" />

      <View style={styles.content}>
        <View style={[styles.row, { borderColor: theme.colors.border }]}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <AppText style={{ color: theme.colors.text, fontSize: 16 * theme.fontScale }}>Camera access</AppText>
            <AppText style={{ color: theme.colors.textSecondary, fontSize: 13 * theme.fontScale, marginTop: 2 }}>
              Only used for the optional barcode-scan shortcut when adding an entry.
            </AppText>
          </View>
          <Switch
            value={granted}
            onValueChange={handleCameraToggle}
            trackColor={{ true: theme.colors.accent, false: theme.colors.border }}
          />
        </View>

        <View style={[styles.row, { borderColor: theme.colors.border }]}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <AppText style={{ color: theme.colors.text, fontSize: 16 * theme.fontScale }}>Daily reminder</AppText>
            <AppText style={{ color: theme.colors.textSecondary, fontSize: 13 * theme.fontScale, marginTop: 2 }}>
              One notification at 10:00 AM: "Come check out today's recommendations!" - no specific pick is named.
            </AppText>
          </View>
          <Switch
            value={settings.notificationsEnabled}
            onValueChange={handleNotificationToggle}
            trackColor={{ true: theme.colors.accent, false: theme.colors.border }}
          />
        </View>

        <TouchableOpacity
          onPress={() => Linking.openSettings()}
          style={[styles.button, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}
        >
          <AppText style={{ color: theme.colors.text, fontSize: 16 * theme.fontScale }}>Open Phone Settings</AppText>
        </TouchableOpacity>
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
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  button: { borderWidth: 1, borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
});
