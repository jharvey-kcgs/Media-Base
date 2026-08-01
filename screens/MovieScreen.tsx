// screens/MovieScreen.tsx
//
// Built on the same shared foundation as Books/Comics
// (lib/useAlphabetScroll.ts for the A-Z index), but the entry-assist
// pipeline is genuinely different: movies aren't catalogued with ISBNs,
// so this uses a UPC -> rough title (UPCitemdb) -> real movie metadata
// (TMDb) pipeline instead - see lib/upcLookup.ts for the full story,
// including the free TMDb API key it needs (lib/config.ts) that Books/
// Comics' ISBN lookup never required.
//
// Deliberately simpler than Book/Comic in one way: no author/director
// field at all - not part of the requested spec for this screen.

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  TouchableOpacity,
  FlatList,
  SectionList,
  TextInput,
  StyleSheet,
  Switch,
  Alert,
  AlertButton,
  Modal,
  ScrollView,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import AppText, { FONT_FAMILY } from '../components/AppText';
import ScreenHeader from '../components/ScreenHeader';
import { useTheme } from '../lib/theme';
import { getMovies, addMovie, updateMovie, deleteMovie, deleteMovies } from '../lib/storage';
import { runUpcMovieLookup, TMDB_GENRE_NAMES } from '../lib/upcLookup';
import { useAlphabetScroll } from '../lib/useAlphabetScroll';
import { Movie, MovieSortField } from '../types/models';

// Genre isn't listed here - "Filter by genre..." (its own menu item,
// below) is the dedicated place to interact with genre.
const SORT_FIELDS: { field: MovieSortField; label: string }[] = [
  { field: 'title', label: 'Title' },
  { field: 'watched', label: 'Watched?' },
];

// Only 'title' - no author/director field on this screen to sort by.
const ALPHA_FIELDS: MovieSortField[] = ['title'];
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

function sortMovies(movies: Movie[], field: MovieSortField): Movie[] {
  const copy = [...movies];
  copy.sort((a, b) => {
    if (field === 'watched') return Number(a.watched) - Number(b.watched);
    if (field === 'genre') return (a.genres[0] ?? '').localeCompare(b.genres[0] ?? '');
    return String(a[field]).localeCompare(String(b[field]));
  });
  return copy;
}

function groupByFirstLetter(sorted: Movie[], field: 'title' | 'genre'): { title: string; data: Movie[] }[] {
  const getKey = (item: Movie) => (field === 'genre' ? item.genres[0] ?? '' : String(item[field] ?? ''));
  const groups: Record<string, Movie[]> = {};
  for (const item of sorted) {
    const raw = getKey(item).trim();
    const letter = raw[0]?.toUpperCase() ?? '#';
    const key = /[A-Z]/.test(letter) ? letter : '#';
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }
  return Object.keys(groups)
    .sort()
    .map((letter) => ({ title: letter, data: groups[letter] }));
}

// Standard UPC-A check-digit algorithm: odd positions (1-indexed) x3,
// even positions x1, check digit = (10 - (sum mod 10)) mod 10. No
// external library for this the way isbn3 handles ISBN - UPC's checksum
// is simple enough to inline, and there's no hyphenation/group data to
// look up the way isbn3 provides for ISBNs.
function isValidUpcA(digits: string): boolean {
  if (digits.length !== 12 || !/^\d{12}$/.test(digits)) return false;
  const sum = digits
    .slice(0, 11)
    .split('')
    .reduce((acc, d, i) => acc + Number(d) * (i % 2 === 0 ? 3 : 1), 0);
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === Number(digits[11]);
}

interface DraftState {
  title: string;
  genresText: string;
  upc: string;
  watched: boolean;
  rating: number;
  review: string;
}

const EMPTY_DRAFT: DraftState = {
  title: '',
  genresText: '',
  upc: '',
  watched: false,
  rating: 0,
  review: '',
};

const INPUT_FONT = { fontFamily: FONT_FAMILY.body };
const REQUIRED_SWITCH_LABEL = 'Have you watched this movie?\u00A0*';

const MovieCard = React.memo(function MovieCard({
  movie,
  selected,
  selectionMode,
  onPress,
  onLayout,
}: {
  movie: Movie;
  selected: boolean;
  selectionMode: boolean;
  onPress: (movie: Movie) => void;
  onLayout?: (e: any) => void;
}) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      onPress={() => onPress(movie)}
      onLayout={onLayout}
      style={[
        styles.card,
        { borderColor: selected ? theme.colors.accentReadable : theme.colors.border, backgroundColor: theme.colors.surface },
        selected && styles.cardSelected,
      ]}
    >
      <View style={styles.cardRow}>
        {selectionMode && (
          <Ionicons
            name={selected ? 'checkmark-circle' : 'ellipse-outline'}
            size={22}
            color={selected ? theme.colors.accentReadable : theme.colors.textMuted}
            style={styles.cardCheckbox}
          />
        )}
        <View style={styles.flex}>
          <AppText
            variant="header"
            numberOfLines={1}
            ellipsizeMode="tail"
            style={{ color: theme.colors.text, fontSize: 16 * theme.fontScale }}
          >
            {movie.title}
          </AppText>
          <AppText
            numberOfLines={1}
            ellipsizeMode="tail"
            style={{ color: theme.colors.textSecondary, fontSize: 13 * theme.fontScale, marginTop: 2 }}
          >
            {movie.genres.slice(0, 2).join(', ')}
            {movie.genres.length > 2 ? ` +${movie.genres.length - 2}` : ''}
          </AppText>
          <AppText
            numberOfLines={1}
            style={{ color: movie.watched ? theme.colors.success : theme.colors.textMuted, fontSize: 13 * theme.fontScale, marginTop: 4 }}
          >
            {movie.watched ? `Watched${movie.rating ? ` · ${movie.rating}★` : ''}` : 'Not watched yet'}
          </AppText>
        </View>
      </View>
    </TouchableOpacity>
  );
});

const AlphabetBar = React.memo(function AlphabetBar({
  color,
  fontScale,
  onPressLetter,
}: {
  color: string;
  fontScale: number;
  onPressLetter: (letter: string) => void;
}) {
  return (
    <View style={styles.azBar} pointerEvents="box-none">
      {ALPHABET.map((letter) => (
        <TouchableOpacity key={letter} onPress={() => onPressLetter(letter)} hitSlop={{ top: 1, bottom: 1, left: 6, right: 6 }}>
          <AppText style={{ color, fontSize: 10 * fontScale }}>{letter}</AppText>
        </TouchableOpacity>
      ))}
    </View>
  );
});

export default function MovieScreen({ navigation }: any) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [movies, setMovies] = useState<Movie[]>([]);
  const [sortField, setSortField] = useState<MovieSortField>('title');
  const [genreFilter, setGenreFilter] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [lookingUp, setLookingUp] = useState(false);
  const [upcStatus, setUpcStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [scannerVisible, setScannerVisible] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const scanLockRef = useRef(false);

  const load = useCallback(async () => {
    setMovies(await getMovies());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const filteredMovies = useMemo(
    () =>
      genreFilter ? movies.filter((m) => m.genres.some((g) => g.toLowerCase() === genreFilter.toLowerCase())) : movies,
    [movies, genreFilter],
  );

  const sorted = useMemo(() => sortMovies(filteredMovies, sortField), [filteredMovies, sortField]);
  const sortLabel = SORT_FIELDS.find((f) => f.field === sortField)?.label ?? 'Title';
  const isAlpha = ALPHA_FIELDS.includes(sortField);
  const sections = useMemo(
    () => (isAlpha ? groupByFirstLetter(sorted, sortField as 'title' | 'genre') : []),
    [isAlpha, sorted, sortField],
  );

  const {
    listRef: sectionListRef,
    onLayout: onListLayout,
    onContentSizeChange,
    jumpToLetter,
    recordRowHeight,
  } = useAlphabetScroll(sections, theme.fontScale);

  const openAdd = () => {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setUpcStatus('idle');
    setModalVisible(true);
  };

  const openEdit = (movie: Movie) => {
    setEditingId(movie.id);
    setDraft({
      title: movie.title,
      genresText: movie.genres.join(', '),
      upc: movie.upc ?? '',
      watched: movie.watched,
      rating: movie.rating ?? 0,
      review: movie.review,
    });
    const digits = (movie.upc ?? '').replace(/\D/g, '');
    if (digits.length === 12 || digits.length === 13) {
      setUpcStatus(digits.length === 12 ? (isValidUpcA(digits) ? 'valid' : 'invalid') : 'valid');
    } else {
      setUpcStatus('idle');
    }
    setModalVisible(true);
  };

  const confirmDelete = (id: string, title: string) => {
    Alert.alert(`Delete "${title}"?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteMovie(id);
          load();
        },
      },
    ]);
  };

  const enterSelectionMode = () => {
    if (sorted.length === 0) {
      Alert.alert('No movies yet', 'Add a movie first.');
      return;
    }
    setSelectedIds(new Set());
    setSelectionMode(true);
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const confirmBulkDelete = () => {
    const count = selectedIds.size;
    if (count === 0) return;
    Alert.alert(`Delete ${count} ${count === 1 ? 'movie' : 'movies'}?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteMovies(Array.from(selectedIds));
          exitSelectionMode();
          load();
        },
      },
    ]);
  };

  const openSortMenu = () => {
    const buttons: AlertButton[] = [
      ...SORT_FIELDS.map((opt) => ({ text: opt.label, onPress: () => setSortField(opt.field) })),
      { text: 'Cancel', style: 'cancel' },
    ];
    Alert.alert('Sort by', undefined, buttons);
  };

  // Deliberately different from Books/Comics: shows TMDb's full, fixed
  // 19-genre list directly (the "limited list" requested) rather than
  // only genres currently in use among stored movies - a stable,
  // predictable set of filter options regardless of what's been added
  // so far.
  const openGenreFilterMenu = () => {
    const buttons: AlertButton[] = [
      { text: 'All genres', onPress: () => setGenreFilter(null) },
      ...TMDB_GENRE_NAMES.map((g) => ({ text: g, onPress: () => setGenreFilter(g) })),
      { text: 'Cancel', style: 'cancel' },
    ];
    Alert.alert('Filter by genre', 'A movie shows up if it has this genre among its tags.', buttons);
  };

  const openMenu = () => {
    Alert.alert('Movies', undefined, [
      { text: '+ Add entry', onPress: openAdd },
      { text: 'Filter by...', onPress: openSortMenu },
      { text: 'Filter by genre...', onPress: openGenreFilterMenu },
      { text: '- Delete entries', style: 'destructive', onPress: enterSelectionMode },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleScanPress = async () => {
    if (cameraPermission?.granted) {
      scanLockRef.current = false;
      setScannerVisible(true);
      return;
    }
    if (cameraPermission?.canAskAgain ?? true) {
      const result = await requestCameraPermission();
      if (result.granted) {
        scanLockRef.current = false;
        setScannerVisible(true);
      }
      return;
    }
    Alert.alert(
      'Camera access needed',
      'Camera access was turned off outside the app - open Phone Settings to turn it back on, or use the UPC field below instead.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Phone Settings', onPress: () => Linking.openSettings() },
      ],
    );
  };

  const applyUpcDigits = (digits: string): boolean => {
    if (digits.length !== 12 && digits.length !== 13) {
      setUpcStatus('idle');
      setDraft((d) => ({ ...d, upc: digits }));
      return false;
    }
    setDraft((d) => ({ ...d, upc: digits }));
    if (digits.length === 13) {
      // EAN-13 - common for some imported/international discs. No
      // check-digit validation implemented for this format (diminishing
      // returns for this app's scope), so this is treated as
      // plausible-length rather than confirmed-valid.
      setUpcStatus('valid');
      return true;
    }
    const valid = isValidUpcA(digits);
    setUpcStatus(valid ? 'valid' : 'invalid');
    return valid;
  };

  const handleUpcChange = (text: string) => {
    applyUpcDigits(text.replace(/\D/g, ''));
  };

  // Fires once a barcode is in view long enough to decode. Locked with a
  // ref (not state) so a single barcode sitting in frame doesn't fire
  // this dozens of times per second. UPC-A (12 digits) and EAN-13 (13
  // digits, common when a UPC is encoded with a leading 0 for GS1
  // compatibility) both accepted.
  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (scanLockRef.current) return;
    const digits = data.replace(/\D/g, '');
    if (digits.length !== 12 && digits.length !== 13) return;
    scanLockRef.current = true;
    setScannerVisible(false);
    const isValid = applyUpcDigits(digits);
    if (isValid) {
      runUpcLookup(digits);
    } else {
      Alert.alert(
        "That barcode's check digit looks off",
        'Might be a damaged or misprinted barcode - try again, or enter the UPC by hand below.',
      );
    }
  };

  const handleUpcBlur = () => {
    const digits = draft.upc.replace(/\D/g, '');
    if (digits.length !== 12 && digits.length !== 13) return;
    runUpcLookup(digits);
  };

  // Thin wrapper around lib/upcLookup.runUpcMovieLookup - see that file
  // for the full two-step (UPCitemdb -> TMDb) pipeline and its TMDb API
  // key requirement (lib/config.ts).
  const runUpcLookup = async (digits: string) => {
    setLookingUp(true);
    try {
      const result = await runUpcMovieLookup(digits);
      if (!result) {
        Alert.alert(
          "Couldn't find that UPC",
          "No match found - either the UPC database doesn't have this item, or lib/config.ts needs a free TMDb API key added (see that file). You can still fill in the details by hand.",
        );
        return;
      }
      if (!result.title && result.genres.length === 0) {
        Alert.alert(
          "Found the UPC, but couldn't get details",
          'The product was found but TMDb has no matching movie record - you can still fill in the details by hand.',
        );
        return;
      }
      setDraft((d) => ({
        ...d,
        title: result.title || d.title,
        genresText: result.genres.length > 0 ? result.genres.join(', ') : d.genresText,
      }));
    } catch (err) {
      console.warn('Media Base: UPC lookup failed', err);
      Alert.alert('Lookup failed', 'Could not reach the lookup services - check your connection, or fill in the details by hand.');
    } finally {
      setLookingUp(false);
    }
  };

  const handleSave = async () => {
    const genres = draft.genresText
      .split(',')
      .map((g) => g.trim())
      .filter(Boolean);

    if (!draft.title.trim() || genres.length === 0) {
      Alert.alert('Missing info', 'Title and at least one genre are both required.');
      return;
    }

    const isDuplicate = movies.some(
      (m) => m.id !== editingId && m.title.trim().toLowerCase() === draft.title.trim().toLowerCase(),
    );
    if (isDuplicate) {
      Alert.alert('Already tracking this movie', 'A movie with this title is already in your list.');
      return;
    }

    const payload = {
      title: draft.title.trim(),
      genres,
      upc: draft.upc.trim(),
      watched: draft.watched,
      rating: draft.watched ? draft.rating || null : null,
      review: draft.watched ? draft.review : '',
    };

    if (editingId) {
      await updateMovie(editingId, payload);
    } else {
      await addMovie(payload);
    }
    setModalVisible(false);
    load();
  };

  const handleCardPress = useCallback(
    (movie: Movie) => {
      if (selectionMode) {
        toggleSelected(movie.id);
      } else {
        openEdit(movie);
      }
    },
    [selectionMode],
  );

  const renderItem = useCallback(
    ({ item }: { item: Movie }) => (
      <MovieCard
        movie={item}
        selected={selectedIds.has(item.id)}
        selectionMode={selectionMode}
        onPress={handleCardPress}
        onLayout={(e) => recordRowHeight(e.nativeEvent.layout.height)}
      />
    ),
    [selectedIds, selectionMode, handleCardPress, recordRowHeight],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: { title: string } }) => (
      <AppText
        style={[
          styles.sectionHeader,
          { color: theme.colors.textMuted, fontSize: 12 * theme.fontScale, backgroundColor: theme.colors.background },
        ]}
      >
        {section.title}
      </AppText>
    ),
    [theme.colors.textMuted, theme.colors.background, theme.fontScale],
  );

  const emptyState = (
    <AppText style={{ color: theme.colors.textMuted, fontSize: 15 * theme.fontScale, padding: 20 }}>
      {genreFilter ? `No movies tagged "${genreFilter}" yet.` : 'No movies yet. Tap ••• to add your first one.'}
    </AppText>
  );

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.colors.background }]} edges={['left', 'right', 'bottom']}>
      <ScreenHeader
        title={selectionMode ? `${selectedIds.size} selected` : 'Movies'}
        onBack={selectionMode ? undefined : () => navigation.goBack()}
        backLabel="Home"
        left={
          selectionMode ? (
            <TouchableOpacity onPress={exitSelectionMode} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <AppText style={{ color: theme.colors.accentReadable, fontSize: 15 * theme.fontScale }}>Cancel</AppText>
            </TouchableOpacity>
          ) : undefined
        }
        right={
          selectionMode ? (
            <TouchableOpacity
              onPress={confirmBulkDelete}
              disabled={selectedIds.size === 0}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <AppText
                style={{
                  color: selectedIds.size === 0 ? theme.colors.textMuted : theme.colors.danger,
                  fontSize: 15 * theme.fontScale,
                }}
              >
                Delete
              </AppText>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={openMenu} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="ellipsis-horizontal" size={22} color={theme.colors.accentReadable} />
            </TouchableOpacity>
          )
        }
      />

      <View style={styles.metaRow}>
        <AppText style={{ color: theme.colors.textMuted, fontSize: 12 * theme.fontScale }}>Sorted by {sortLabel}</AppText>
        {genreFilter && (
          <TouchableOpacity onPress={() => setGenreFilter(null)}>
            <AppText style={{ color: theme.colors.accentReadable, fontSize: 12 * theme.fontScale, marginLeft: 8 }}>
              · Genre: {genreFilter} ✕
            </AppText>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.flex} onLayout={onListLayout}>
        {isAlpha ? (
          <SectionList<Movie, { title: string }>
            ref={sectionListRef}
            sections={sections}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[styles.list, { paddingRight: 20 + 22 }]}
            ListEmptyComponent={emptyState}
            onContentSizeChange={onContentSizeChange}
            renderSectionHeader={renderSectionHeader}
            renderItem={renderItem}
            initialNumToRender={12}
            maxToRenderPerBatch={12}
            updateCellsBatchingPeriod={50}
            windowSize={11}
            stickySectionHeadersEnabled={false}
          />
        ) : (
          <FlatList
            data={sorted}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={emptyState}
            renderItem={renderItem}
            initialNumToRender={12}
            maxToRenderPerBatch={12}
            updateCellsBatchingPeriod={50}
            windowSize={11}
          />
        )}

        {isAlpha && sections.length > 0 && (
          <AlphabetBar color={theme.colors.accentReadable} fontScale={theme.fontScale} onPressLetter={jumpToLetter} />
        )}
      </View>

      <Modal visible={modalVisible} animationType="slide" onRequestClose={() => setModalVisible(false)}>
        {scannerVisible ? (
          <View style={styles.scannerRoot}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['upc_a', 'upc_e', 'ean13'] }}
              onBarcodeScanned={handleBarcodeScanned}
            />
            <View style={[styles.scannerOverlay, { paddingTop: insets.top + 16 }]}>
              <TouchableOpacity
                onPress={() => setScannerVisible(false)}
                style={[styles.scannerCancel, { top: insets.top + 16 }]}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <AppText style={{ color: '#FFFFFF', fontSize: 15 * theme.fontScale }}>Cancel</AppText>
              </TouchableOpacity>
              <View style={styles.scannerFrame} />
              <AppText style={{ color: '#FFFFFF', fontSize: 14 * theme.fontScale, textAlign: 'center', marginTop: 16 }}>
                Line up the barcode on the back of the movie case
              </AppText>
            </View>
          </View>
        ) : (
          <SafeAreaView style={[styles.flex, { backgroundColor: theme.colors.background }]} edges={['left', 'right', 'bottom']}>
          <ScreenHeader
            title={editingId ? 'Edit Entry' : 'Add Entry'}
            left={
              <TouchableOpacity onPress={() => setModalVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <AppText style={{ color: theme.colors.accentReadable, fontSize: 15 * theme.fontScale }}>Cancel</AppText>
              </TouchableOpacity>
            }
            right={
              <TouchableOpacity onPress={handleSave} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <AppText style={{ color: theme.colors.accentReadable, fontSize: 15 * theme.fontScale }}>Save</AppText>
              </TouchableOpacity>
            }
          />

          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <ScrollView
              contentContainerStyle={styles.form}
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets
            >
            <AppText style={{ color: theme.colors.textMuted, fontSize: 12 * theme.fontScale, marginBottom: 16 }}>
              * required
            </AppText>

            <TouchableOpacity
              onPress={handleScanPress}
              style={[styles.scanButton, { borderColor: theme.colors.accentReadable }]}
            >
              <AppText style={{ color: theme.colors.accentReadable, fontSize: 15 * theme.fontScale }}>📷 Scan barcode instead</AppText>
            </TouchableOpacity>

            <View style={styles.field}>
              <AppText style={[styles.label, { color: theme.colors.textSecondary, fontSize: 13 * theme.fontScale }]}>
                UPC (optional - fills in the fields below automatically)
              </AppText>
              <TextInput
                value={draft.upc}
                onChangeText={handleUpcChange}
                onBlur={handleUpcBlur}
                keyboardType="number-pad"
                placeholder="e.g. 024543611473"
                placeholderTextColor={theme.colors.textMuted}
                style={[styles.input, INPUT_FONT, { color: theme.colors.text, borderColor: theme.colors.border }]}
              />
              {upcStatus === 'valid' && (
                <AppText style={{ color: theme.colors.success, fontSize: 12 * theme.fontScale, marginTop: 4 }}>
                  ✓ Looks like a valid UPC
                </AppText>
              )}
              {upcStatus === 'invalid' && (
                <AppText style={{ color: theme.colors.danger, fontSize: 12 * theme.fontScale, marginTop: 4 }}>
                  ⚠ That check digit doesn't look right - double-check the numbers
                </AppText>
              )}
              {lookingUp && (
                <AppText style={{ color: theme.colors.textMuted, fontSize: 12 * theme.fontScale, marginTop: 4 }}>
                  Looking up...
                </AppText>
              )}
            </View>

            <View style={styles.field}>
              <AppText style={[styles.label, { color: theme.colors.textSecondary, fontSize: 13 * theme.fontScale }]}>
                Title *
              </AppText>
              <TextInput
                value={draft.title}
                onChangeText={(text) => setDraft((d) => ({ ...d, title: text }))}
                style={[styles.input, INPUT_FONT, { color: theme.colors.text, borderColor: theme.colors.border }]}
              />
            </View>

            <View style={styles.field}>
              <AppText style={[styles.label, { color: theme.colors.textSecondary, fontSize: 13 * theme.fontScale }]}>
                Genre(s) * (comma-separated, e.g. Action, Comedy)
              </AppText>
              <TextInput
                value={draft.genresText}
                onChangeText={(text) => setDraft((d) => ({ ...d, genresText: text }))}
                style={[styles.input, INPUT_FONT, { color: theme.colors.text, borderColor: theme.colors.border }]}
              />
            </View>

            <View style={[styles.row, { marginTop: 8 }]}>
              <AppText style={{ color: theme.colors.text, fontSize: 15 * theme.fontScale, flex: 1, paddingRight: 12 }}>
                {REQUIRED_SWITCH_LABEL}
              </AppText>
              <Switch
                value={draft.watched}
                onValueChange={(watched) => setDraft((d) => ({ ...d, watched }))}
                trackColor={{ true: theme.colors.accent, false: theme.colors.border }}
              />
            </View>

            {draft.watched && (
              <>
                <AppText style={[styles.label, { color: theme.colors.textSecondary, fontSize: 13 * theme.fontScale, marginTop: 16 }]}>
                  Rating
                </AppText>
                <View style={styles.starRow}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <TouchableOpacity key={n} onPress={() => setDraft((d) => ({ ...d, rating: n }))}>
                      <AppText style={{ fontSize: 28, color: n <= draft.rating ? theme.colors.accentReadable : theme.colors.border }}>
                        ★
                      </AppText>
                    </TouchableOpacity>
                  ))}
                </View>

                <AppText style={[styles.label, { color: theme.colors.textSecondary, fontSize: 13 * theme.fontScale, marginTop: 16 }]}>
                  Review
                </AppText>
                <TextInput
                  value={draft.review}
                  onChangeText={(text) => setDraft((d) => ({ ...d, review: text }))}
                  multiline
                  style={[styles.input, styles.multiline, INPUT_FONT, { color: theme.colors.text, borderColor: theme.colors.border }]}
                />
              </>
            )}

            {editingId && (
              <TouchableOpacity
                onPress={() => {
                  setModalVisible(false);
                  confirmDelete(editingId, draft.title || 'this entry');
                }}
                style={[styles.deleteButton, { borderColor: theme.colors.danger }]}
              >
                <AppText style={{ color: theme.colors.danger, fontSize: 15 * theme.fontScale }}>Delete entry</AppText>
              </TouchableOpacity>
            )}
          </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
        )}
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 8, flexWrap: 'wrap' },
  list: { padding: 20, paddingTop: 0 },
  sectionHeader: { paddingVertical: 4, marginBottom: 4 },
  card: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 10 },
  cardSelected: { borderWidth: 2 },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start' },
  cardCheckbox: { marginRight: 10, marginTop: 2 },
  azBar: {
    position: 'absolute',
    right: 4,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  form: { padding: 20 },
  field: { marginBottom: 14 },
  label: { marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 8, padding: 10 },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  starRow: { flexDirection: 'row', gap: 8 },
  scanButton: { borderWidth: 1, borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginBottom: 8 },
  deleteButton: { borderWidth: 1, borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 28 },
  scannerRoot: { flex: 1, backgroundColor: '#000000' },
  scannerOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  scannerCancel: { position: 'absolute', top: 16, left: 20 },
  scannerFrame: {
    width: '80%',
    height: 140,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: 12,
  },
});
