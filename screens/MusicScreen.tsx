// screens/MusicScreen.tsx
//
// Mirrors screens/AnimeScreen.tsx's shape (dynamic genre filter, same
// cover/staging system, hold-to-select) with screens/BookScreen.tsx's
// tap-an-artist-to-filter pattern extended from "author" - a natural
// fit, same reasoning that justified it for Books/Comics. Two genuine
// differences from every prior category screen, not just renames:
//
// 1. Selecting a title-search result only fills Title/Artist
//    immediately - cover art and genre are BOTH separate follow-up
//    calls (lib/musicLookup.ts's fetchCoverArtUrl()/fetchReleaseGenresAndLink()),
//    not included in the search result itself. Same pattern as
//    cover-photo auto-fill everywhere else, just extended to two
//    background fetches instead of one, and either can come back empty
//    - a real, expected outcome (community-tagged genres, community-
//    contributed art), not a bug.
// 2. "Where to Listen" always shows, unlike Where to Watch's tmdbId-
//    gated button - it's a plain Spotify search built from artist+title
//    text every entry already has, not a precise deep link needing an
//    external id.

import React, { useCallback, useMemo, useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import AppText, { FONT_FAMILY } from '../components/AppText';
import ScreenHeader from '../components/ScreenHeader';
import SearchBar from '../components/SearchBar';
import CoverThumbnail from '../components/CoverThumbnail';
import CoverPicker from '../components/CoverPicker';
import { useTheme } from '../lib/theme';
import { getMusicAlbums, addMusicAlbum, updateMusicAlbum, deleteMusicAlbum, deleteMusicAlbums, newId } from '../lib/storage';
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
import { fetchCoverArtUrl, fetchReleaseGenresAndLink, spotifySearchUrl } from '../lib/musicLookup';
import { searchMusicByTitle } from '../lib/titleSearch';
import TitleSearchInput from '../components/TitleSearchInput';
import { useAlphabetScroll } from '../lib/useAlphabetScroll';
import { MusicAlbum, MusicAlbumSortField } from '../types/models';

// Genre isn't listed here - "Filter by genre..." (its own menu item,
// below) is the dedicated place to interact with genre.
const SORT_FIELDS: { field: MusicAlbumSortField; label: string }[] = [
  { field: 'title', label: 'Album' },
  { field: 'artist', label: 'Artist' },
  { field: 'listened', label: 'Listened?' },
  { field: 'rating', label: 'Rating' },
];

const ALPHA_FIELDS: MusicAlbumSortField[] = ['title', 'artist'];
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

function sortAlbums(albums: MusicAlbum[], field: MusicAlbumSortField): MusicAlbum[] {
  const copy = [...albums];
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

function groupByFirstLetter(sorted: MusicAlbum[], field: 'title' | 'artist' | 'genre'): { title: string; data: MusicAlbum[] }[] {
  const getKey = (item: MusicAlbum) => (field === 'genre' ? item.genres[0] ?? '' : String(item[field] ?? ''));
  const groups: Record<string, MusicAlbum[]> = {};
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
  spotifyUrl: string | null;
  listened: boolean;
  rating: number;
  review: string;
}

const EMPTY_DRAFT: DraftState = {
  title: '',
  artist: '',
  genresText: '',
  coverImage: null,
  spotifyUrl: null,
  listened: false,
  rating: 0,
  review: '',
};

const INPUT_FONT = { fontFamily: FONT_FAMILY.body };
const REQUIRED_SWITCH_LABEL = 'Have you listened to this album?\u00A0*';

const MusicCard = React.memo(function MusicCard({
  album,
  selected,
  selectionMode,
  onPress,
  onLongPress,
  onArtistPress,
  onLayout,
}: {
  album: MusicAlbum;
  selected: boolean;
  selectionMode: boolean;
  onPress: (album: MusicAlbum) => void;
  onLongPress: (album: MusicAlbum) => void;
  onArtistPress: (artist: string) => void;
  onLayout?: (e: any) => void;
}) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      onPress={() => onPress(album)}
      onLongPress={() => onLongPress(album)}
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
        <CoverThumbnail uri={album.coverImage} iconName="musical-notes-outline" />
        <View style={styles.flex}>
          <AppText
            variant="header"
            numberOfLines={1}
            ellipsizeMode="tail"
            style={{ color: theme.colors.text, fontSize: 16 * theme.fontScale }}
          >
            {album.title}
          </AppText>
          <View style={styles.artistGenreRow}>
            {album.artist ? (
              <TouchableOpacity
                disabled={selectionMode}
                onPress={() => onArtistPress(album.artist)}
                hitSlop={{ top: 4, bottom: 4, left: 0, right: 0 }}
              >
                <AppText
                  numberOfLines={1}
                  style={{ color: selectionMode ? theme.colors.textSecondary : theme.colors.accentReadable, fontSize: 13 * theme.fontScale }}
                >
                  {album.artist}
                </AppText>
              </TouchableOpacity>
            ) : null}
            <AppText
              numberOfLines={1}
              ellipsizeMode="tail"
              style={{ color: theme.colors.textSecondary, fontSize: 13 * theme.fontScale, flexShrink: 1 }}
            >
              {album.artist ? ' · ' : ''}
              {album.genres.slice(0, 2).join(', ')}
              {album.genres.length > 2 ? ` +${album.genres.length - 2}` : ''}
            </AppText>
          </View>
          <AppText
            numberOfLines={1}
            style={{ color: album.listened ? theme.colors.success : theme.colors.textMuted, fontSize: 13 * theme.fontScale, marginTop: 4 }}
          >
            {album.listened ? `Listened${album.rating ? ` · ${album.rating}★` : ''}` : 'Not listened yet'}
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

export default function MusicScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [albums, setAlbums] = useState<MusicAlbum[]>([]);
  const [sortField, setSortField] = useState<MusicAlbumSortField>('title');
  const [genreFilter, setGenreFilter] = useState<string | null>(null);
  const [artistFilter, setArtistFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [originalCoverImage, setOriginalCoverImage] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  // Genre auto-fill can genuinely take 5-10 seconds (a release lookup,
  // sometimes followed by an artist-level fallback lookup - see
  // lib/musicLookup.ts's fetchReleaseGenresAndLink()) - confirmed via real
  // testing that a silent wait that long looks broken even when it
  // isn't. This only drives a small, transient "Looking up genre..."
  // label shown next to the field while waiting, not a permanent part
  // of the form.
  const [genreLookupInProgress, setGenreLookupInProgress] = useState(false);

  const load = useCallback(async () => {
    setAlbums(await getMusicAlbums());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Dynamic, not a fixed list - MusicBrainz's genre tags are
  // community-voted folksonomy, not a clean fixed taxonomy the way
  // TMDb's is, so "genres actually in your list" (same approach
  // Books/Comics/Anime already use) is the only one that fits here.
  const allGenres = useMemo(() => {
    const set = new Set<string>();
    albums.forEach((a) => a.genres.forEach((g) => set.add(g)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [albums]);

  const filteredAlbums = useMemo(() => {
    let result = genreFilter
      ? albums.filter((a) => a.genres.some((g) => g.toLowerCase() === genreFilter.toLowerCase()))
      : albums;
    if (artistFilter) {
      result = result.filter((a) => a.artist.toLowerCase() === artistFilter.toLowerCase());
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter((a) => a.title.toLowerCase().includes(q) || a.artist.toLowerCase().includes(q));
    }
    return result;
  }, [albums, genreFilter, artistFilter, searchQuery]);

  const sorted = useMemo(() => sortAlbums(filteredAlbums, sortField), [filteredAlbums, sortField]);
  const sortLabel = SORT_FIELDS.find((f) => f.field === sortField)?.label ?? 'Album';
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
    setGenreLookupInProgress(false);
    setModalVisible(true);
  };

  const openEdit = (item: MusicAlbum) => {
    setEditingId(item.id);
    setActiveItemId(item.id);
    setOriginalCoverImage(item.coverImage ?? null);
    setDraft({
      title: item.title,
      artist: item.artist,
      genresText: item.genres.join(', '),
      coverImage: item.coverImage ?? null,
      spotifyUrl: item.spotifyUrl ?? null,
      listened: item.listened,
      rating: item.rating ?? 0,
      review: item.review,
    });
    setGenreLookupInProgress(false);
    setModalVisible(true);
  };

  const confirmDelete = (id: string, title: string) => {
    Alert.alert(`Delete "${title}"?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteMusicAlbum(id);
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
          ? await takeCoverPhotoStaged('music', activeItemId)
          : await takeCoverPhoto('music', activeItemId);
        if (uri) setDraft((d) => ({ ...d, coverImage: uri }));
      } },
      { text: 'Choose from Library', onPress: async () => {
        if (!activeItemId) return;
        const uri = isEditing
          ? await pickCoverFromLibraryStaged('music', activeItemId)
          : await pickCoverFromLibrary('music', activeItemId);
        if (uri) setDraft((d) => ({ ...d, coverImage: uri }));
      } },
    ];
    if (draft.coverImage) {
      buttons.push({
        text: 'Remove Photo',
        style: 'destructive',
        onPress: async () => {
          if (!isEditing && activeItemId) await deleteCover('music', activeItemId);
          setDraft((d) => ({ ...d, coverImage: null }));
        },
      });
    }
    buttons.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Cover photo', undefined, buttons);
  };

  const handleCancelForm = () => {
    if (!editingId && draft.coverImage && activeItemId) {
      deleteCover('music', activeItemId).catch(() => {});
    } else if (editingId && draft.coverImage !== originalCoverImage) {
      discardPendingCover(draft.coverImage).catch(() => {});
    }
    setModalVisible(false);
  };

  // Entered via long-press on a card, not a "..." menu item - matches
  // iOS's own long-press-to-select pattern (Photos, Mail, Files).
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
    Alert.alert(`Delete ${count} ${count === 1 ? 'album' : 'albums'}?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteMusicAlbums(Array.from(selectedIds));
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

  // Dynamic, not a fixed list - see the allGenres comment above. Clears
  // any active artist filter when an actual genre is picked, same
  // reasoning as Books/Comics: a stray tap from one origin shouldn't
  // leave an unintended combined-filter state.
  const openGenreFilterMenu = () => {
    if (allGenres.length === 0) {
      Alert.alert('No genres yet', 'Add an album with a genre first.');
      return;
    }
    const buttons: AlertButton[] = [
      { text: 'All genres', onPress: () => setGenreFilter(null) },
      ...allGenres.map((g) => ({
        text: g,
        onPress: () => {
          setArtistFilter(null);
          setGenreFilter(g);
        },
      })),
      { text: 'Cancel', style: 'cancel' },
    ];
    Alert.alert('Filter by genre', 'An album shows up if it has this genre among its tags.', buttons);
  };

  const openMenu = () => {
    Alert.alert('Music', undefined, [
      { text: '+ Add entry', onPress: openAdd },
      { text: 'Filter by...', onPress: openSortMenu },
      { text: 'Filter by genre...', onPress: openGenreFilterMenu },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // Tapping an artist's name - same pattern as Books/Comics' author tap,
  // extended here since Artist is Music's direct equivalent. Clears any
  // active genre filter, same reasoning as the genre menu clearing
  // artist above - the two filters clear each other rather than
  // combining.
  const handleArtistPress = useCallback((artist: string) => {
    setGenreFilter(null);
    setArtistFilter(artist);
  }, []);

  // Prefers a real, direct Spotify album page when one was found via
  // MusicBrainz's community-contributed relationship data
  // (draft.spotifyUrl - see lib/musicLookup.ts's
  // fetchReleaseGenresAndLink()) - falls back to a plain search
  // (spotifySearchUrl()) when none was recorded, or for an entry typed
  // in entirely by hand. Always available either way (no gating), since
  // the fallback only needs the artist/title text every entry already
  // has.
  const handleWhereToListen = () => {
    if (draft.spotifyUrl) {
      Linking.openURL(draft.spotifyUrl).catch((err) => {
        console.warn('Media Base: failed to open Spotify album URL', err);
        Alert.alert("Couldn't open that", 'Something went wrong opening Spotify - please try again.');
      });
      return;
    }
    if (!draft.artist.trim() && !draft.title.trim()) return;
    Linking.openURL(spotifySearchUrl(draft.artist, draft.title)).catch((err) => {
      console.warn('Media Base: failed to open Where to Listen URL', err);
      Alert.alert("Couldn't open that", 'Something went wrong opening Spotify - please try again.');
    });
  };

  const handleSave = async () => {
    const genres = draft.genresText
      .split(',')
      .map((g) => g.trim())
      .filter(Boolean);

    if (!draft.title.trim() || genres.length === 0) {
      Alert.alert('Missing info', 'Album and at least one genre are both required.');
      return;
    }

    const isDuplicate = albums.some(
      (a) => a.id !== editingId && a.title.trim().toLowerCase() === draft.title.trim().toLowerCase(),
    );
    if (isDuplicate) {
      Alert.alert('Already tracking this album', 'An album with this title is already in your list.');
      return;
    }

    let finalCoverImage = draft.coverImage;
    if (editingId) {
      if (draft.coverImage === originalCoverImage) {
        // untouched this session
      } else if (draft.coverImage) {
        finalCoverImage = await commitPendingCover('music', editingId, draft.coverImage);
      } else if (originalCoverImage) {
        await deleteCover('music', editingId);
        finalCoverImage = null;
      }
    }

    const payload = {
      title: draft.title.trim(),
      artist: draft.artist.trim(),
      genres,
      coverImage: finalCoverImage,
      spotifyUrl: draft.spotifyUrl,
      listened: draft.listened,
      rating: draft.listened ? draft.rating || null : null,
      review: draft.listened ? draft.review : '',
    };

    if (editingId) {
      await updateMusicAlbum(editingId, payload);
    } else {
      await addMusicAlbum(payload, activeItemId ?? undefined);
    }
    setModalVisible(false);
    load();
  };

  const handleCardPress = useCallback(
    (item: MusicAlbum) => {
      if (selectionMode) {
        toggleSelected(item.id);
      } else {
        openEdit(item);
      }
    },
    [selectionMode],
  );

  const handleCardLongPress = useCallback(
    (item: MusicAlbum) => {
      if (!selectionMode) enterSelectionMode(item.id);
    },
    [selectionMode],
  );

  const renderItem = useCallback(
    ({ item }: { item: MusicAlbum }) => (
      <MusicCard
        album={item}
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
        ? `No albums match "${searchQuery.trim()}".`
        : artistFilter
          ? `No albums by "${artistFilter}" yet.`
          : genreFilter
            ? `No albums tagged "${genreFilter}" yet.`
            : 'No music yet. Tap ••• to add your first album.'}
    </AppText>
  );

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.colors.background }]} edges={['left', 'right', 'bottom']}>
      <ScreenHeader
        title={selectionMode ? `${selectedIds.size} selected` : 'Music'}
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

      <SearchBar value={searchQuery} onChangeText={setSearchQuery} placeholder="Search your music..." />

      <View style={styles.flex} onLayout={onListLayout}>
        {isAlpha ? (
          <SectionList<MusicAlbum, { title: string }>
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

              <CoverPicker uri={draft.coverImage} onPress={handleCoverPress} iconName="musical-notes-outline" />

              <View style={[styles.field, { zIndex: 20 }]}>
                <AppText style={[styles.label, { color: theme.colors.textSecondary, fontSize: 13 * theme.fontScale }]}>
                  Album * (or a song from it, or "Artist - Album" for a common title - type to search and auto-fill)
                </AppText>
                <TitleSearchInput
                  value={draft.title}
                  onChangeText={(text) => setDraft((d) => ({ ...d, title: text }))}
                  search={(query) => searchMusicByTitle(query)}
                  debounceMs={900}
                  getKey={(r) => r.key}
                  getLabel={(r) => r.title ?? 'Untitled album'}
                  getSubtitle={(r) => (r.artist ? `${r.artist}${r.releaseYear ? ` · ${r.releaseYear}` : ''}` : r.releaseYear)}
                  onSelect={(r) => {
                    setDraft((d) => ({
                      ...d,
                      title: r.title || d.title,
                      artist: r.artist || d.artist,
                      // Cleared immediately, not just left stale - if
                      // this is a re-selection of a different result
                      // after an earlier one already set a link, that
                      // old link shouldn't survive until the new lookup
                      // resolves.
                      spotifyUrl: null,
                    }));
                    // Cover art and genre/link are BOTH separate
                    // follow-up calls - see the file header for why.
                    // Either can come back empty; that's expected, not
                    // an error.
                    if (activeItemId) {
                      fetchCoverArtUrl(r.releaseId).then((url) => {
                        if (!url || !activeItemId) return;
                        const download = editingId
                          ? downloadRemoteCoverStaged('music', activeItemId, url)
                          : downloadRemoteCover('music', activeItemId, url);
                        download.then((uri) => {
                          if (uri) setDraft((d) => ({ ...d, coverImage: uri }));
                        });
                      });
                    }
                    setGenreLookupInProgress(true);
                    fetchReleaseGenresAndLink(r.releaseId)
                      .then(({ genres, spotifyUrl }) => {
                        setDraft((d) => ({
                          ...d,
                          genresText: genres.length > 0 ? genres.join(', ') : d.genresText,
                          spotifyUrl,
                        }));
                      })
                      .finally(() => setGenreLookupInProgress(false));
                  }}
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
                  Genre(s) * (comma-separated, e.g. Rock, Indie)
                </AppText>
                {genreLookupInProgress && (
                  <AppText style={{ color: theme.colors.textMuted, fontSize: 12 * theme.fontScale, marginBottom: 6 }}>
                    Looking up genre - can take several seconds…
                  </AppText>
                )}
                <TextInput
                  value={draft.genresText}
                  onChangeText={(text) => setDraft((d) => ({ ...d, genresText: text }))}
                  style={[styles.input, INPUT_FONT, { color: theme.colors.text, borderColor: theme.colors.border }]}
                />
              </View>

              <TouchableOpacity
                onPress={handleWhereToListen}
                style={[styles.watchButton, { borderColor: theme.colors.accentReadable }]}
              >
                <AppText style={{ color: theme.colors.accentReadable, fontSize: 15 * theme.fontScale }}>
                  🎧 Where to Listen
                </AppText>
              </TouchableOpacity>

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
  watchButton: { borderWidth: 1, borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginBottom: 14 },
  deleteButton: { borderWidth: 1, borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 28 },
});
