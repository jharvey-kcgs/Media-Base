// App.tsx

import React, { useEffect, useState } from 'react';
import { View, StatusBar } from 'react-native';
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
import OnboardingScreen from './screens/OnboardingScreen';
import { getSettings } from './lib/storage';
import { ThemeProvider, useTheme } from './lib/theme';

const Stack = createNativeStackNavigator();

// Keep the native splash screen visible until JetBrains Mono has loaded -
// without this, Expo hides it as soon as the JS bundle starts, which is
// before the font is ready and would show a flash of the system font first.
SplashScreen.preventAutoHideAsync().catch(() => {});

// Show the daily recommendation reminder as a normal alert+sound even if
// the app happens to already be open at 10am, rather than staying silent.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
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
  const { theme } = useTheme();

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
