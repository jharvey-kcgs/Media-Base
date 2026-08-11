// screens/VinylScreen.tsx
//
// Mirrors screens/BookScreen.tsx's full three-entry-method shape (scan,
// code-entry, title search) - the only prior category with all three,
// since Movies/TV Shows/Anime dropped scanning entirely and Music never
// had a real barcode option to begin with. Genuinely different from
// Books in a few ways:
//
// 1. No ISBN-style checksum/hyphen-formatting library exists for UPC/EAN
//    codes here (Books' isbn3 dependency is ISBN-specific) - the code
//    field just holds raw digits, and Discogs' own barcode search
//    reports back if nothing matches rather than this screen
//    pre-validating a checksum it has no library for.
// 2. Discogs bundles title/artist/genre/style/cover ALL in one search
//    response (see lib/discogsLookup.ts) - selecting a result fills
//    everything immediately, no async follow-up fetches the way Music
//    needed for cover art and genre separately.
// 3. Genre filter is a fixed, short list (VINYL_GENRE_FILTERS - the
//    person's own trimmed list, confirmed directly to keep this menu
//    easy to navigate) rather than a dynamic "genres in your
//    collection" list - matches Movies/TV's fixed-list approach, not
//    Books/Comics/Anime's dynamic one.
// 4. No "Where to Watch"/"Where to Listen"-style button at all - the
//    whole point of this category is a physical copy already owned,
//    not a pointer to somewhere else to access it.

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
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import AppText, { FONT_FAMILY } from '../components/AppText';
import ScreenHeader from '../components/ScreenHeader';
import SearchBar from '../components/SearchBar';
import CoverThumbnail from '../components/CoverThumbnail';
import CoverPicker from '../components/CoverPicker';
import { useTheme } from '../lib/theme';
import { getVinylCDs, addVinylCD, updateVinylCD, deleteVinylCD, deleteVinylCDs, newId } from '../lib/storage';
import {
  pickCoverFromLibraryStaged,
  takeCoverPhotoStaged,
  downloadRemoteCoverStaged,
  pickCoverFromLibrary,
  takeCoverPhoto,
  downloadRemoteCover,
  deleteCover,
  commitPendingCover,
  discardPendingCover,
} from '../lib/coverStorage';
import { looksLikeIsbn } from '../lib/movieLookup';
import { searchDiscogsByBarcode, DiscogsSearchResult } from '../lib/discogsLookup';
import { searchVinylCDByTitle } from '../lib/titleSearch';
import TitleSearchInput from '../components/TitleSearchInput';
import { useAlphabetScroll } from '../lib/useAlphabetScroll';
import { VinylCD, VinylCDSortField, VINYL_GENRE_FILTERS } from '../types/models';

const SORT_FIELDS: { field: VinylCDSortField; label: string }[] = [
  { field: 'title', label: 'Title' },
  { field: 'artist', label: 'Artist' },
  { field: 'listened', label: 'Listened?' },
  { field: 'rating', label: 'Rating' },
];

const ALPHA_FIELDS: VinylCDSortField[] = ['title', 'artist'];
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

function sortRecords(records: VinylCD[], field: VinylCDSortField): VinylCD[] {
  const copy = [...records];
  copy.sort((a, b) => {
    if (field === 'listened') return Number(a.listened) - Number(b.listened);
    // Descending - 5 stars first, unrated (null) sinks to the very
    // bottom rather than sorting as if it were a 0-star rating.
    if (field === 'rating') return (b.rating ?? -1) - (a.rating ?? -1);
    if (field === 'genre') return (a.genres[0] ?? '').localeCompare(b.genres[0] ?? '');
    return String(a[field]).localeCompare(String(b[field]));
  });
  return copy;
}

function groupByFirstLetter(sorted: VinylCD[], field: 'title' | 'artist' | 'genre'): { title: string; data: VinylCD[] }[] {
  const getKey = (item: VinylCD) => (field === 'genre' ? item.genres[0] ?? '' : String(item[field] ?? ''));
  const groups: Record<string, VinylCD[]> = {};
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

interface DraftState {
  title: string;
  artist: string;
  genresText: string;
  coverImage: string | null;
  discogsUrl: string | null;
  listened: boolean;
  rating: number;
  review: string;
}

const EMPTY_DRAFT: DraftState = {
  title: '',
  artist: '',
  genresText: '',
  coverImage: null,
  discogsUrl: null,
  listened: false,
  rating: 0,
  review: '',
};

const INPUT_FONT = { fontFamily: FONT_FAMILY.body };
const REQUIRED_SWITCH_LABEL = 'Have you listened to this?\u00A0*';

const VinylCard = React.memo(function VinylCard({
  record,
  selected,
  selectionMode,
  onPress,
  onLongPress,
  onArtistPress,
  onLayout,
}: {
  record: VinylCD;
  selected: boolean;
  selectionMode: boolean;
  onPress: (record: VinylCD) => void;
  onLongPress: (record: VinylCD) => void;
  onArtistPress: (artist: string) => void;
  onLayout?: (e: any) => void;
}) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      onPress={() => onPress(record)}
      onLongPress={() => onLongPress(record)}
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
        <CoverThumbnail uri={record.coverImage} iconName="disc-outline" />
        <View style={styles.flex}>
          <AppText
            variant="header"
            numberOfLines={1}
            ellipsizeMode="tail"
            style={{ color: theme.colors.text, fontSize: 16 * theme.fontScale }}
          >
            {record.title}
          </AppText>
          <View style={styles.artistGenreRow}>
            {record.artist ? (
              <TouchableOpacity
                disabled={selectionMode}
                onPress={() => onArtistPress(record.artist)}
                hitSlop={{ top: 4, bottom: 4, left: 0, right: 0 }}
              >
                <AppText
                  numberOfLines={1}
                  style={{ color: selectionMode ? theme.colors.textSecondary : theme.colors.accentReadable, fontSize: 13 * theme.fontScale }}
                >
                  {record.artist}
                </AppText>
              </TouchableOpacity>
            ) : null}
            <AppText
              numberOfLines={1}
              ellipsizeMode="tail"
              style={{ color: theme.colors.textSecondary, fontSize: 13 * theme.fontScale, flexShrink: 1 }}
            >
              {record.artist ? ' · ' : ''}
              {record.genres.slice(0, 2).join(', ')}
              {record.genres.length > 2 ? ` +${record.genres.length - 2}` : ''}
            </AppText>
          </View>
          <AppText
            numberOfLines={1}
            style={{ color: record.listened ? theme.colors.success : theme.colors.textMuted, fontSize: 13 * theme.fontScale, marginTop: 4 }}
          >
            {record.listened ? `Listened${record.rating ? ` · ${record.rating}★` : ''}` : 'Not listened yet'}
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

export default function VinylScreen({ navigation }: any) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [records, setRecords] = useState<VinylCD[]>([]);
  const [sortField, setSortField] = useState<VinylCDSortField>('title');
  const [genreFilter, setGenreFilter] = useState<string | null>(null);
  const [artistFilter, setArtistFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [modalVisible, setModalVisible] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const scanLockRef = useRef(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [originalCoverImage, setOriginalCoverImage] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [barcodeText, setBarcodeText] = useState('');
  const [lookingUp, setLookingUp] = useState(false);

  const load = useCallback(async () => {
    setRecords(await getVinylCDs());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const filteredRecords = useMemo(() => {
    let result = genreFilter
      ? records.filter((r) => r.genres.some((g) => g.toLowerCase().includes(genreFilter.toLowerCase())))
      : records;
    if (artistFilter) {
      result = result.filter((r) => r.artist.toLowerCase() === artistFilter.toLowerCase());
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter((r) => r.title.toLowerCase().includes(q) || r.artist.toLowerCase().includes(q));
    }
    return result;
  }, [records, genreFilter, artistFilter, searchQuery]);

  const sorted = useMemo(() => sortRecords(filteredRecords, sortField), [filteredRecords, sortField]);
  const sortLabel = SORT_FIELDS.find((f) => f.field === sortField)?.label ?? 'Title';
  const isAlpha = ALPHA_FIELDS.includes(sortField);
  const sections = useMemo(
    () => (isAlpha ? groupByFirstLetter(sorted, sortField as 'title' | 'artist' | 'genre') : []),
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
    setActiveItemId(newId());
    setOriginalCoverImage(null);
    setDraft(EMPTY_DRAFT);
    setBarcodeText('');
    setModalVisible(true);
  };

  const openEdit = (item: VinylCD) => {
    setEditingId(item.id);
    setActiveItemId(item.id);
    setOriginalCoverImage(item.coverImage ?? null);
    setDraft({
      title: item.title,
      artist: item.artist,
      genresText: item.genres.join(', '),
      coverImage: item.coverImage ?? null,
      discogsUrl: item.discogsUrl ?? null,
      listened: item.listened,
      rating: item.rating ?? 0,
      review: item.review,
    });
    setBarcodeText('');
    setModalVisible(true);
  };

  const confirmDelete = (id: string, title: string) => {
    Alert.alert(`Delete "${title}"?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteVinylCD(id);
          load();
        },
      },
    ]);
  };

  const handleCoverPress = () => {
    const isEditing = !!editingId;
    const buttons: AlertButton[] = [
      { text: 'Take Photo', onPress: async () => {
        if (!activeItemId) return;
        const uri = isEditing
          ? await takeCoverPhotoStaged('vinyl', activeItemId)
          : await takeCoverPhoto('vinyl', activeItemId);
        if (uri) setDraft((d) => ({ ...d, coverImage: uri }));
      } },
      { text: 'Choose from Library', onPress: async () => {
        if (!activeItemId) return;
        const uri = isEditing
          ? await pickCoverFromLibraryStaged('vinyl', activeItemId)
          : await pickCoverFromLibrary('vinyl', activeItemId);
        if (uri) setDraft((d) => ({ ...d, coverImage: uri }));
      } },
    ];
    if (draft.coverImage) {
      buttons.push({
        text: 'Remove Photo',
        style: 'destructive',
        onPress: async () => {
          if (!isEditing && activeItemId) await deleteCover('vinyl', activeItemId);
          setDraft((d) => ({ ...d, coverImage: null }));
        },
      });
    }
    buttons.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Cover photo', undefined, buttons);
  };

  const handleCancelForm = () => {
    if (!editingId && draft.coverImage && activeItemId) {
      deleteCover('vinyl', activeItemId).catch(() => {});
    } else if (editingId && draft.coverImage !== originalCoverImage) {
      discardPendingCover(draft.coverImage).catch(() => {});
    }
    setModalVisible(false);
  };

  const enterSelectionMode = (itemId: string) => {
    setSelectedIds(new Set([itemId]));
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
    Alert.alert(`Delete ${count} ${count === 1 ? 'record' : 'records'}?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteVinylCDs(Array.from(selectedIds));
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

  // Fixed, short list (VINYL_GENRE_FILTERS) - not a "genres in your
  // collection" dynamic menu, confirmed directly to keep this easy to
  // navigate. Clears any active artist filter when a genre is picked,
  // same reasoning as every other category: a stray tap from one
  // origin shouldn't leave an unintended combined-filter state.
  const openGenreFilterMenu = () => {
    const buttons: AlertButton[] = [
      { text: 'All genres', onPress: () => setGenreFilter(null) },
      ...VINYL_GENRE_FILTERS.map((g) => ({
        text: g,
        onPress: () => {
          setArtistFilter(null);
          setGenreFilter(g);
        },
      })),
      { text: 'Cancel', style: 'cancel' },
    ];
    Alert.alert('Filter by genre', 'A record shows up if this genre appears anywhere in its own genre/style tags.', buttons);
  };

  const openMenu = () => {
    Alert.alert('Vinyl/CD', undefined, [
      { text: '+ Add entry', onPress: openAdd },
      { text: 'Filter by...', onPress: openSortMenu },
      { text: 'Filter by genre...', onPress: openGenreFilterMenu },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleArtistPress = useCallback((artist: string) => {
    setGenreFilter(null);
    setArtistFilter(artist);
  }, []);

  // Discogs bundles title/artist/genre/cover ALL in one result - no
  // async follow-up fetches needed the way Music required for cover art
  // and genre separately. Applied immediately, in full, on selection.
  // Sets discogsUrl here too, not just the visible fields - covers both
  // call sites (title search and barcode scan), since both resolve
  // through this same function and both are genuinely "found via
  // Discogs" cases needing the same attribution. Confirmed required by
  // Discogs' own API Terms of Use: "Data provided by Discogs" displayed
  // next to any Discogs-sourced data, hyperlinked to the specific page
  // it came from - see lib/discogsLookup.ts's DiscogsSearchResult
  // comment for the exact requirement. null (the default) for anything
  // typed in entirely by hand, which never touched Discogs' data at
  // all - same graceful-hide reasoning as Movies/TV/Anime's tmdbId-
  // gated Where to Watch button.
  const applyDiscogsResult = (r: DiscogsSearchResult) => {
    setDraft((d) => ({
      ...d,
      title: r.title || d.title,
      artist: r.artist || d.artist,
      genresText: r.genres.length > 0 ? r.genres.join(', ') : d.genresText,
      discogsUrl: r.discogsUrl,
    }));
    if (r.coverUrl && activeItemId) {
      const download = editingId
        ? downloadRemoteCoverStaged('vinyl', activeItemId, r.coverUrl)
        : downloadRemoteCover('vinyl', activeItemId, r.coverUrl);
      download.then((uri) => {
        if (uri) setDraft((d) => ({ ...d, coverImage: uri }));
      });
    }
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
      'Camera access was turned off outside the app - open Phone Settings to turn it back on, or use the barcode field below instead.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Phone Settings', onPress: () => Linking.openSettings() },
      ],
    );
  };

  const runBarcodeLookup = async (digits: string) => {
    // Reused from lib/movieLookup.ts, kept there specifically for this
    // reuse case - a Vinyl/CD box set can bundle a booklet with its own
    // ISBN barcode printed right next to the disc's real UPC, and
    // scanning the wrong one by mistake is a real failure mode, not a
    // hypothetical one (Movies hit this same ambiguity with bundled
    // print material first).
    if (looksLikeIsbn(digits)) {
      Alert.alert(
        "That looks like a book's ISBN",
        "This looks like an ISBN, not this release's own barcode - box sets sometimes bundle a booklet with its own ISBN printed right next to the disc's real UPC. Try scanning the disc or sleeve's own barcode instead, or search by title below.",
      );
      return;
    }
    setLookingUp(true);
    try {
      const results = await searchDiscogsByBarcode(digits);
      if (results.length === 0) {
        Alert.alert("Couldn't find that barcode", 'No Discogs match for that code - you can still fill in the fields by hand, or try title search below.');
        return;
      }
      applyDiscogsResult(results[0]);
    } catch (err) {
      console.warn('Media Base: barcode lookup threw', err);
      Alert.alert('Something went wrong', 'Please try again, or fill in the fields by hand.');
    } finally {
      setLookingUp(false);
    }
  };

  // Locked with a ref (not state, which wouldn't update fast enough) so
  // a single barcode sitting in frame doesn't fire this dozens of times
  // per second - onBarcodeScanned keeps firing continuously while a code
  // is visible, unlike a one-shot "take photo" action.
  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (scanLockRef.current) return;
    const digits = data.replace(/[^0-9]/g, '');
    if (digits.length < 8) return;
    scanLockRef.current = true;
    setScannerVisible(false);
    setBarcodeText(digits);
    runBarcodeLookup(digits);
  };

  const handleBarcodeFieldSubmit = () => {
    const digits = barcodeText.replace(/[^0-9]/g, '');
    if (digits.length < 8) return;
    runBarcodeLookup(digits);
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

    const isDuplicate = records.some(
      (r) => r.id !== editingId && r.title.trim().toLowerCase() === draft.title.trim().toLowerCase(),
    );
    if (isDuplicate) {
      Alert.alert('Already tracking this one', 'A record with this title is already in your collection.');
      return;
    }

    let finalCoverImage = draft.coverImage;
    if (editingId) {
      if (draft.coverImage === originalCoverImage) {
        // untouched this session
      } else if (draft.coverImage) {
        finalCoverImage = await commitPendingCover('vinyl', editingId, draft.coverImage);
      } else if (originalCoverImage) {
        await deleteCover('vinyl', editingId);
        finalCoverImage = null;
      }
    }

    const payload = {
      title: draft.title.trim(),
      artist: draft.artist.trim(),
      genres,
      coverImage: finalCoverImage,
      discogsUrl: draft.discogsUrl,
      listened: draft.listened,
      rating: draft.listened ? draft.rating || null : null,
      review: draft.listened ? draft.review : '',
    };

    if (editingId) {
      await updateVinylCD(editingId, payload);
    } else {
      await addVinylCD(payload, activeItemId ?? undefined);
    }
    setModalVisible(false);
    load();
  };

  const handleCardPress = useCallback(
    (item: VinylCD) => {
      if (selectionMode) {
        toggleSelected(item.id);
      } else {
        openEdit(item);
      }
    },
    [selectionMode],
  );

  const handleCardLongPress = useCallback(
    (item: VinylCD) => {
      if (!selectionMode) enterSelectionMode(item.id);
    },
    [selectionMode],
  );

  const renderItem = useCallback(
    ({ item }: { item: VinylCD }) => (
      <VinylCard
        record={item}
        selected={selectedIds.has(item.id)}
        selectionMode={selectionMode}
        onPress={handleCardPress}
        onLongPress={handleCardLongPress}
        onArtistPress={handleArtistPress}
        onLayout={(e) => recordRowHeight(e.nativeEvent.layout.height)}
      />
    ),
    [selectedIds, selectionMode, handleCardPress, handleCardLongPress, handleArtistPress, recordRowHeight],
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
      {searchQuery.trim()
        ? `No records match "${searchQuery.trim()}".`
        : artistFilter
          ? `No records by "${artistFilter}" yet.`
          : genreFilter
            ? `No records tagged "${genreFilter}" yet.`
            : 'Nothing here yet. Tap ••• to add your first record.'}
    </AppText>
  );

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.colors.background }]} edges={['left', 'right', 'bottom']}>
      <ScreenHeader
        title={selectionMode ? `${selectedIds.size} selected` : 'Vinyl/CD'}
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
        {artistFilter && (
          <TouchableOpacity onPress={() => setArtistFilter(null)}>
            <AppText style={{ color: theme.colors.accentReadable, fontSize: 12 * theme.fontScale, marginLeft: 8 }}>
              · Artist: {artistFilter} ✕
            </AppText>
          </TouchableOpacity>
        )}
      </View>

      <SearchBar value={searchQuery} onChangeText={setSearchQuery} placeholder="Search your collection..." />

      <View style={styles.flex} onLayout={onListLayout}>
        {isAlpha ? (
          <SectionList<VinylCD, { title: string }>
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
          // Rendered inside the SAME Modal as the form, not a second
          // separate <Modal> - iOS doesn't reliably present two
          // independent modals at once, same fix already proven on
          // BookScreen.tsx.
          <View style={styles.scannerRoot}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['ean13', 'upc_a'] }}
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
                Line up the barcode on the sleeve or disc
              </AppText>
            </View>
          </View>
        ) : (
        <SafeAreaView style={[styles.flex, { backgroundColor: theme.colors.background }]} edges={['left', 'right', 'bottom']}>
          <ScreenHeader
            title={editingId ? 'Edit Entry' : 'Add Entry'}
            left={
              <TouchableOpacity onPress={handleCancelForm} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <AppText style={{ color: theme.colors.accentReadable, fontSize: 15 * theme.fontScale }}>Cancel</AppText>
              </TouchableOpacity>
            }
            right={
              <TouchableOpacity onPress={handleSave} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <AppText style={{ color: theme.colors.accentReadable, fontSize: 15 * theme.fontScale }}>Save</AppText>
              </TouchableOpacity>
            }
          />

          <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <ScrollView
              contentContainerStyle={styles.form}
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets
            >
              <AppText style={{ color: theme.colors.textMuted, fontSize: 12 * theme.fontScale, marginBottom: 16 }}>
                * required
              </AppText>

              <CoverPicker uri={draft.coverImage} onPress={handleCoverPress} iconName="disc-outline" />

              <TouchableOpacity
                onPress={handleScanPress}
                style={[styles.scanButton, { borderColor: theme.colors.accentReadable }]}
              >
                <AppText style={{ color: theme.colors.accentReadable, fontSize: 15 * theme.fontScale }}>📷 Scan Barcode</AppText>
              </TouchableOpacity>

              <View style={styles.field}>
                <AppText style={[styles.label, { color: theme.colors.textSecondary, fontSize: 13 * theme.fontScale }]}>
                  Barcode (optional - fills in the fields below automatically)
                </AppText>
                <TextInput
                  value={barcodeText}
                  onChangeText={setBarcodeText}
                  onSubmitEditing={handleBarcodeFieldSubmit}
                  onBlur={handleBarcodeFieldSubmit}
                  keyboardType="number-pad"
                  returnKeyType="search"
                  placeholder="e.g. 075678302126"
                  placeholderTextColor={theme.colors.textMuted}
                  style={[styles.input, INPUT_FONT, { color: theme.colors.text, borderColor: theme.colors.border }]}
                />
                {lookingUp && (
                  <AppText style={{ color: theme.colors.textMuted, fontSize: 12 * theme.fontScale, marginTop: 6 }}>
                    Looking that up…
                  </AppText>
                )}
              </View>

              <View style={[styles.field, { zIndex: 20 }]}>
                <AppText style={[styles.label, { color: theme.colors.textSecondary, fontSize: 13 * theme.fontScale }]}>
                  Title * (type to search and auto-fill, or "Artist - Title" for a common title)
                </AppText>
                <TitleSearchInput
                  value={draft.title}
                  onChangeText={(text) => setDraft((d) => ({ ...d, title: text }))}
                  search={(query) => searchVinylCDByTitle(query)}
                  getKey={(r) => r.key}
                  getLabel={(r) => r.title ?? 'Untitled'}
                  getSubtitle={(r) => (r.artist ? `${r.artist}${r.releaseYear ? ` · ${r.releaseYear}` : ''}` : r.releaseYear)}
                  onSelect={(r) => applyDiscogsResult(r)}
                />
              </View>

              <View style={styles.field}>
                <AppText style={[styles.label, { color: theme.colors.textSecondary, fontSize: 13 * theme.fontScale }]}>
                  Artist
                </AppText>
                <TextInput
                  value={draft.artist}
                  onChangeText={(text) => setDraft((d) => ({ ...d, artist: text }))}
                  style={[styles.input, INPUT_FONT, { color: theme.colors.text, borderColor: theme.colors.border }]}
                />
              </View>

              <View style={styles.field}>
                <AppText style={[styles.label, { color: theme.colors.textSecondary, fontSize: 13 * theme.fontScale }]}>
                  Genre(s) * (comma-separated, e.g. Rock, Hard Rock)
                </AppText>
                <TextInput
                  value={draft.genresText}
                  onChangeText={(text) => setDraft((d) => ({ ...d, genresText: text }))}
                  style={[styles.input, INPUT_FONT, { color: theme.colors.text, borderColor: theme.colors.border }]}
                />
                {draft.discogsUrl && (
                  <TouchableOpacity
                    onPress={() => {
                      Linking.openURL(draft.discogsUrl!).catch((err) => {
                        console.warn('Media Base: failed to open Discogs URL', err);
                        Alert.alert("Couldn't open that", 'Something went wrong opening Discogs - please try again.');
                      });
                    }}
                    style={{ marginTop: 8 }}
                  >
                    <AppText style={{ color: theme.colors.textMuted, fontSize: 12 * theme.fontScale }}>
                      Data provided by{' '}
                      <AppText style={{ color: theme.colors.accentReadable, fontSize: 12 * theme.fontScale }}>Discogs</AppText>
                    </AppText>
                  </TouchableOpacity>
                )}
              </View>

              <View style={[styles.row, { marginTop: 8 }]}>
                <AppText style={{ color: theme.colors.text, fontSize: 15 * theme.fontScale, flex: 1, paddingRight: 12 }}>
                  {REQUIRED_SWITCH_LABEL}
                </AppText>
                <Switch
                  value={draft.listened}
                  onValueChange={(listened) => setDraft((d) => ({ ...d, listened }))}
                  trackColor={{ true: theme.colors.accent, false: theme.colors.border }}
                />
              </View>

              {draft.listened && (
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
  artistGenreRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
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
  scanButton: { borderWidth: 1, borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginBottom: 14 },
  deleteButton: { borderWidth: 1, borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 28 },
  scannerRoot: { flex: 1, backgroundColor: '#000' },
  scannerOverlay: { flex: 1, alignItems: 'center', paddingHorizontal: 24 },
  scannerCancel: { position: 'absolute', right: 16 },
  scannerFrame: {
    flex: 1,
    width: '80%',
    maxHeight: 200,
    marginTop: 60,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: 12,
  },
});
