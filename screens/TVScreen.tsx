// screens/TVScreen.tsx
//
// Step 4 of the TV Shows build - the screen shell only. Header, back
// button, and the ••• menu structure (Add entry / Filter by... / Filter
// by genre...), matching every other category screen's header pattern
// exactly. Deliberately NOT yet wired to anything real: no list
// rendering, no search, no A-Z index, no Add/Edit form, no Where to
// Watch button - those are their own later steps, built on top of this
// shell rather than all at once. The menu items below are placeholders
// for now (each just closes the menu) so the ••• button has the right
// shape from the start, without pretending any of it works yet.

import React from 'react';
import { View, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AppText from '../components/AppText';
import ScreenHeader from '../components/ScreenHeader';
import { useTheme } from '../lib/theme';

export default function TVScreen({ navigation }: any) {
  const { theme } = useTheme();

  const openMenu = () => {
    Alert.alert('TV Shows', undefined, [
      { text: '+ Add entry', onPress: () => {} },
      { text: 'Filter by...', onPress: () => {} },
      { text: 'Filter by genre...', onPress: () => {} },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.colors.background }]} edges={['left', 'right', 'bottom']}>
      <ScreenHeader
        title="TV Shows"
        onBack={() => navigation.goBack()}
        backLabel="Home"
        right={
          <TouchableOpacity onPress={openMenu} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="ellipsis-horizontal" size={22} color={theme.colors.accentReadable} />
          </TouchableOpacity>
        }
      />

      <View style={styles.content}>
        <AppText style={{ color: theme.colors.textMuted, fontSize: 15 * theme.fontScale }}>
          The list, search, and Add/Edit forms come in the next steps - this is just the screen shell for now.
        </AppText>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flex: 1, padding: 20 },
});
