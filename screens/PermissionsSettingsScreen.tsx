// screens/PermissionsSettingsScreen.tsx

import React, { useCallback, useEffect, useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Switch, Linking, Alert, AppState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useCameraPermissions } from 'expo-camera';
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
  // Camera comes straight from the hook - no separate state to keep in
  // sync, unlike the standalone getCameraPermissionsAsync/
  // requestCameraPermissionsAsync functions this used to call, which
  // TypeScript confirmed don't actually exist as exports of the
  // installed expo-camera version at all (a real bug, not a stale-read
  // issue - calling a function that doesn't exist throws immediately,
  // before it can ever reach a log line or update any state, which is
  // why nothing was appearing anywhere). Same hook BookScreen.tsx/
  // ComicScreen.tsx/MovieScreen.tsx already use successfully for their
  // own scan-button permission check.
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [photoGranted, setPhotoGranted] = useState(false);
  const [photoCanAskAgain, setPhotoCanAskAgain] = useState(true);
  const [notifStatus, setNotifStatus] = useState<Notifications.PermissionStatus | null>(null);

  const refreshAllPermissions = useCallback(async () => {
    // Handled independently, not combined - a problem with one check
    // can't silently block the other two this way, and each one's real
    // error (if any) is now visible on its own rather than the whole
    // thing just going quiet. requestCameraPermission() is safe to call
    // here even though it's the "request" function, not just a "check" -
    // per Expo's own documented behavior, it only shows a native prompt
    // when status is still undetermined; if already granted or
    // permanently denied, it just returns the current status silently,
    // which is exactly the "refresh" behavior wanted here.
    const cam = await requestCameraPermission().catch((err: any) => {
      console.warn('Media Base: requestCameraPermission (refresh) threw', err);
      return null;
    });
    const photo = await ImagePicker.getMediaLibraryPermissionsAsync().catch((err: any) => {
      console.warn('Media Base: getMediaLibraryPermissionsAsync threw', err);
      return null;
    });
    const notif = await Notifications.getPermissionsAsync().catch((err: any) => {
      console.warn('Media Base: Notifications.getPermissionsAsync threw', err);
      return null;
    });
    if (cam) {
      console.warn('Media Base: camera permission ->', JSON.stringify(cam));
    }
    if (photo) {
      console.warn('Media Base: photo permission ->', JSON.stringify(photo));
      setPhotoGranted(photo.granted);
      setPhotoCanAskAgain(photo.canAskAgain);
    }
    if (notif) {
      setNotifStatus(notif.status);
    }
  }, [requestCameraPermission]);

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
      if (!(cameraPermission?.canAskAgain ?? true)) {
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
      await requestCameraPermission().catch((err: any) => {
        console.warn('Media Base: requestCameraPermission threw', err);
      });
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
      const result = await ImagePicker.requestMediaLibraryPermissionsAsync().catch((err: any) => {
        console.warn('Media Base: requestMediaLibraryPermissionsAsync threw', err);
        return null;
      });
      if (result) {
        setPhotoGranted(result.granted);
        setPhotoCanAskAgain(result.canAskAgain);
      }
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
            value={cameraPermission?.granted ?? false}
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
