// App.tsx

import React, { useEffect, useState } from 'react';
import { View, StatusBar, AppState } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { useFonts, JetBrainsMono_400Regular, JetBrainsMono_800ExtraBold } from '@expo-google-fonts/jetbrains-mono';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import HomeScreen from './screens/HomeScreen';
import SettingsScreen from './screens/SettingsScreen';
import ProfileSettingsScreen from './screens/ProfileSettingsScreen';
import ThemeSettingsScreen from './screens/ThemeSettingsScreen';
import DataSettingsScreen from './screens/DataSettingsScreen';
import PermissionsSettingsScreen from './screens/PermissionsSettingsScreen';
import AboutScreen from './screens/AboutScreen';
import FAQScreen from './screens/FAQScreen';
import BookScreen from './screens/BookScreen';
import ComicScreen from './screens/ComicScreen';
import MovieScreen from './screens/MovieScreen';
import TVScreen from './screens/TVScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import { getSettings } from './lib/storage';
import { scheduleDailyRecommendationNotification } from './lib/notifications';
import { ThemeProvider, useTheme } from './lib/theme';

const Stack = createNativeStackNavigator();

// Keep the native splash screen visible until JetBrains Mono has loaded -
// without this, Expo hides it as soon as the JS bundle starts, which is
// before the font is ready and would show a flash of the system font first.
SplashScreen.preventAutoHideAsync().catch(() => {});

// Show the daily recommendation reminder as a normal alert+sound even if
// the app happens to already be open at 10am, rather than staying silent.
// shouldSetBadge is true so the badge set on the notification itself
// (lib/notifications.ts) actually applies even if it happens to arrive
// while the app is in the foreground, not just when delivered normally
// while the app is closed/backgrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Clears the badge on cold launch and every time the app returns to the
// foreground - otherwise the "something's waiting" badge from the daily
// reminder would just sit there indefinitely once you've already seen
// it. Same approach Home Base already uses successfully for its own
// notifications.
//
// setBadgeCountAsync resolves to a boolean (not just void) - per Expo's
// own docs, false specifically means the OS isn't currently authorizing
// badge access. Worth checking Settings > Notifications > Expo Go >
// Badges if this ever logs - though on its own that's probably NOT what
// explains a missing badge here specifically, since Home Base's badge
// (also running under Expo Go) works fine, which rules out a shared,
// Expo-Go-wide permission gap as the sole cause.
function clearBadge() {
  Notifications.setBadgeCountAsync(0)
    .then((success) => {
      if (!success) {
        console.warn(
          'Media Base: setBadgeCountAsync reported the OS is not currently authorizing badge access - check Settings > Notifications > Expo Go > Badges.',
        );
      }
    })
    .catch(() => {});
}
clearBadge();
AppState.addEventListener('change', (state) => {
  if (state === 'active') clearBadge();
});

// Sets the badge directly at the moment the daily reminder fires -
// but only helps if the app happens to be open/recently backgrounded
// right then. Per Expo's own notes, there's no way to react to a
// notification via JS listeners when the app is fully closed/killed -
// which is exactly the state the app is most likely in at 10am, since
// that's the whole point of the reminder. For THAT case, the badge is
// applied entirely at the OS level by reading the notification's own
// content.badge field (lib/notifications.ts) - zero JS involvement, so
// this listener genuinely doesn't help there. Kept anyway since it's a
// real improvement for the case where the app IS open, and mirrors the
// same class of fix already working for Home Base - but if the badge is
// still missing specifically when the app was fully closed at 10am, this
// addition isn't what fixes that; the real cause is more likely in how
// content.badge itself is being read for a background-delivered LOCAL
// (not push) notification.
Notifications.addNotificationReceivedListener(() => {
  Notifications.setBadgeCountAsync(1)
    .then((success) => {
      if (!success) {
        console.warn(
          'Media Base: setBadgeCountAsync(1) on notification-received reported the OS is not currently authorizing badge access.',
        );
      }
    })
    .catch(() => {});
});

function RootGate() {
  const { theme, refreshSettings } = useTheme();
  const [checked, setChecked] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    (async () => {
      const settings = await getSettings();
      setNeedsOnboarding(!settings.onboarded);
      setChecked(true);
    })();
  }, []);

  if (!checked) {
    return <View style={{ flex: 1, backgroundColor: theme.colors.background }} />;
  }

  if (needsOnboarding) {
    return (
      <OnboardingScreen
        onDone={async () => {
          await refreshSettings();
          setNeedsOnboarding(false);
        }}
      />
    );
  }

  return <ThemedApp />;
}

function ThemedApp() {
  const { theme, settings } = useTheme();

  // A scheduled notification is a one-time registration with iOS/Android -
  // the OS doesn't re-check the app's code before firing it each day, so a
  // code change to content/trigger (like adding the badge field) never
  // retroactively updates a notification that was already scheduled before
  // that change existed. Re-running the schedule call on every launch when
  // enabled keeps it in sync with whatever the current code actually says,
  // rather than silently drifting from it until the next manual toggle.
  useEffect(() => {
    if (settings.notificationsEnabled) {
      scheduleDailyRecommendationNotification().catch(() => {});
    }
  }, [settings.notificationsEnabled]);

  const navTheme = {
    ...(theme.mode === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(theme.mode === 'dark' ? DarkTheme.colors : DefaultTheme.colors),
      background: theme.colors.background,
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} />
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="ProfileSettings" component={ProfileSettingsScreen} />
          <Stack.Screen name="ThemeSettings" component={ThemeSettingsScreen} />
          <Stack.Screen name="DataSettings" component={DataSettingsScreen} />
          <Stack.Screen name="PermissionsSettings" component={PermissionsSettingsScreen} />
          <Stack.Screen name="About" component={AboutScreen} />
          <Stack.Screen name="FAQ" component={FAQScreen} />
          <Stack.Screen name="Book" component={BookScreen} />
          <Stack.Screen name="Comic" component={ComicScreen} />
          <Stack.Screen name="Movie" component={MovieScreen} />
          <Stack.Screen name="TV" component={TVScreen} />
        </Stack.Navigator>
      </View>
    </NavigationContainer>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    JetBrainsMono_400Regular,
    JetBrainsMono_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    // Native splash screen is still showing on top of this.
    return null;
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <RootGate />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
