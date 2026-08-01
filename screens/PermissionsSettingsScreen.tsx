// screens/PermissionsSettingsScreen.tsx

import React, { useCallback, useEffect, useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Switch, Linking, Alert, AppState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getCameraPermissionsAsync, requestCameraPermissionsAsync } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import AppText from '../components/AppText';
import ScreenHeader from '../components/ScreenHeader';
import { useTheme } from '../lib/theme';
import { getSettings, saveSettings } from '../lib/storage';
import { scheduleDailyRecommendationNotification, cancelDailyRecommendationNotification } from '../lib/notifications';

// All three toggles below reflect real, live OS permission state - not
// stored app state that could silently drift from reality. The one real
// platform limitation, true for every app on iOS, not just this one: no
// app can be notified the instant a permission changes in the Settings
// app - there's no such signal available. What IS fixable, and what this
// screen does: re-check all three the moment the app becomes visible
// again, both via useFocusEffect (navigated here from elsewhere) and an
// AppState listener (the more important case in practice - already
// sitting on this screen, tapped "Open Phone Settings", changed
// something there, and returned directly, which never fires a
// navigation event at all). That's as accurate as any app can be on this
// platform - not real-time while still in Settings, but correct the
// instant you're back.
export default function PermissionsSettingsScreen({ navigation }: any) {
  const { theme, settings, refreshSettings } = useTheme();
  const [cameraGranted, setCameraGranted] = useState(false);
  const [cameraCanAskAgain, setCameraCanAskAgain] = useState(true);
  const [photoGranted, setPhotoGranted] = useState(false);
  const [photoCanAskAgain, setPhotoCanAskAgain] = useState(true);
  const [notifStatus, setNotifStatus] = useState<Notifications.PermissionStatus | null>(null);

  const refreshAllPermissions = useCallback(async () => {
    const [cam, photo, notif] = await Promise.all([
      getCameraPermissionsAsync(),
      ImagePicker.getMediaLibraryPermissionsAsync(),
      Notifications.getPermissionsAsync(),
    ]);
    setCameraGranted(cam.granted);
    setCameraCanAskAgain(cam.canAskAgain);
    setPhotoGranted(photo.granted);
    setPhotoCanAskAgain(photo.canAskAgain);
    setNotifStatus(notif.status);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshAllPermissions();
    }, [refreshAllPermissions]),
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshAllPermissions();
    });
    return () => sub.remove();
  }, [refreshAllPermissions]);

  const handleCameraToggle = async (wantsOn: boolean) => {
    if (wantsOn) {
      if (!cameraCanAskAgain) {
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
      const result = await requestCameraPermissionsAsync();
      setCameraGranted(result.granted);
      setCameraCanAskAgain(result.canAskAgain);
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

  const handlePhotoToggle = async (wantsOn: boolean) => {
    if (wantsOn) {
      if (!photoCanAskAgain) {
        Alert.alert(
          'Photo Library access needed',
          'Photo Library access was turned off outside the app - open Phone Settings to turn it back on.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Phone Settings', onPress: () => Linking.openSettings() },
          ],
        );
        return;
      }
      const result = await ImagePicker.requestMediaLibraryPermissionsAsync();
      setPhotoGranted(result.granted);
      setPhotoCanAskAgain(result.canAskAgain);
    } else {
      Alert.alert(
        'Turn off Photo Library access',
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
            value={cameraGranted}
            onValueChange={handleCameraToggle}
            trackColor={{ true: theme.colors.accent, false: theme.colors.border }}
          />
        </View>

        <View style={[styles.row, { borderColor: theme.colors.border }]}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <AppText style={{ color: theme.colors.text, fontSize: 16 * theme.fontScale }}>Photo Library access</AppText>
            <AppText style={{ color: theme.colors.textSecondary, fontSize: 13 * theme.fontScale, marginTop: 2 }}>
              Only used when you choose "Choose from Library" for a cover photo. Taking a new photo with the camera
              doesn't need this.
            </AppText>
          </View>
          <Switch
            value={photoGranted}
            onValueChange={handlePhotoToggle}
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
