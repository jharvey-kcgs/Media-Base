// screens/AnimeScreen.tsx
//
// Mirrors screens/TVScreen.tsx's structure closely - same watched
// toggle, same rating sort, same cover/staging system, same hold-to-
// select. Two genuine differences, not just renames:
//
// 1. Title search uses lib/titleSearch.ts's searchAnimeByTitle(), which
//    orchestrates two sources - TMDb primary (most mainstream-popular
//    anime is catalogued there as a regular TV show), Jikan (MyAnimeList
//    data, free/keyless) as a fallback only when TMDb comes back empty.
//    Same multi-source resilience pattern as Books/Comics.
// 2. Genre filter shows genres actually in your list (same dynamic
//    pattern as Books/Comics), not either source's fixed list - TMDb and
//    Jikan use genuinely different genre vocabularies, so no single
//    fixed list would be complete once entries could come from either.
//
// An entry found only through the Jikan fallback won't have a Where to
// Watch button - MyAnimeList doesn't cross-reference TMDb, so there's no
// tmdbId to build that link from. Same graceful-hide behavior already
// used for a hand-typed entry, just triggered by which source actually
// found it here.

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
import { getAnime, addAnime, updateAnime, deleteAnime, deleteAnimeEntries, newId } from '../lib/storage';
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
import { tmdbWatchUrl } from '../lib/tvLookup';
import { searchAnimeByTitle } from '../lib/titleSearch';
import TitleSearchInput from '../components/TitleSearchInput';
import { useAlphabetScroll } from '../lib/useAlphabetScroll';
import { Anime, AnimeSortField } from '../types/models';

// Genre isn't listed here - "Filter by genre..." (its own menu item,
// below) is the dedicated place to interact with genre.
const SORT_FIELDS: { field: AnimeSortField; label: string }[] = [
  { field: 'title', label: 'Title' },
  { field: 'watched', label: 'Watched?' },
  { field: 'rating', label: 'Rating' },
];

// Only 'title' - no author field on this screen to sort by.
const ALPHA_FIELDS: AnimeSortField[] = ['title'];
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

function sortAnime(anime: Anime[], field: AnimeSortField): Anime[] {
  const copy = [...anime];
  copy.sort((a, b) => {
    if (field === 'watched') return Number(a.watched) - Number(b.watched);
    // Descending - 5 stars first, unrated (null) sinks to the very
    // bottom rather than sorting as if it were a 0-star rating.
    if (field === 'rating') return (b.rating ?? -1) - (a.rating ?? -1);
    if (field === 'genre') return (a.genres[0] ?? '').localeCompare(b.genres[0] ?? '');
    return String(a[field]).localeCompare(String(b[field]));
  });
  return copy;
}

function groupByFirstLetter(sorted: Anime[], field: 'title' | 'genre'): { title: string; data: Anime[] }[] {
  const getKey = (item: Anime) => (field === 'genre' ? item.genres[0] ?? '' : String(item[field] ?? ''));
  const groups: Record<string, Anime[]> = {};
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
  genresText: string;
  coverImage: string | null;
  tmdbId: number | null;
  watched: boolean;
  rating: number;
  review: string;
}

const EMPTY_DRAFT: DraftState = {
  title: '',
  genresText: '',
  coverImage: null,
  tmdbId: null,
  watched: false,
  rating: 0,
  review: '',
};

const INPUT_FONT = { fontFamily: FONT_FAMILY.body };
const REQUIRED_SWITCH_LABEL = 'Have you watched this?\u00A0*';

const AnimeCard = React.memo(function AnimeCard({
  anime,
  selected,
  selectionMode,
  onPress,
  onLongPress,
  onLayout,
}: {
  anime: Anime;
  selected: boolean;
  selectionMode: boolean;
  onPress: (anime: Anime) => void;
  onLongPress: (anime: Anime) => void;
  onLayout?: (e: any) => void;
}) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      onPress={() => onPress(anime)}
      onLongPress={() => onLongPress(anime)}
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
        <CoverThumbnail uri={anime.coverImage} iconName="sparkles-outline" />
        <View style={styles.flex}>
          <AppText
            variant="header"
            numberOfLines={1}
            ellipsizeMode="tail"
            style={{ color: theme.colors.text, fontSize: 16 * theme.fontScale }}
          >
            {anime.title}
          </AppText>
          <AppText
            numberOfLines={1}
            ellipsizeMode="tail"
            style={{ color: theme.colors.textSecondary, fontSize: 13 * theme.fontScale, marginTop: 2 }}
          >
            {anime.genres.slice(0, 2).join(', ')}
            {anime.genres.length > 2 ? ` +${anime.genres.length - 2}` : ''}
          </AppText>
          <AppText
            numberOfLines={1}
            style={{ color: anime.watched ? theme.colors.success : theme.colors.textMuted, fontSize: 13 * theme.fontScale, marginTop: 4 }}
          >
            {anime.watched ? `Watched${anime.rating ? ` · ${anime.rating}★` : ''}` : 'Not watched yet'}
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

export default function AnimeScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [anime, setAnime] = useState<Anime[]>([]);
  const [sortField, setSortField] = useState<AnimeSortField>('title');
  const [genreFilter, setGenreFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [originalCoverImage, setOriginalCoverImage] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);

  const load = useCallback(async () => {
    setAnime(await getAnime());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Dynamic, not either source's fixed list - deliberately different
  // from Movies/TV Shows. TMDb and Jikan use genuinely different genre
  // vocabularies, so no single fixed list would be complete once entries
  // could come from either - same "genres actually in use" approach
  // Books/Comics already use, for the same underlying reason (their
  // sources' raw genre data isn't one clean shared vocabulary either).
  const allGenres = useMemo(() => {
    const set = new Set<string>();
    anime.forEach((a) => a.genres.forEach((g) => set.add(g)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [anime]);

  const filteredAnime = useMemo(() => {
    let result = genreFilter
      ? anime.filter((a) => a.genres.some((g) => g.toLowerCase() === genreFilter.toLowerCase()))
      : anime;
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter((a) => a.title.toLowerCase().includes(q));
    }
    return result;
  }, [anime, genreFilter, searchQuery]);

  const sorted = useMemo(() => sortAnime(filteredAnime, sortField), [filteredAnime, sortField]);
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
    setActiveItemId(newId());
    setOriginalCoverImage(null);
    setDraft(EMPTY_DRAFT);
    setModalVisible(true);
  };

  const openEdit = (item: Anime) => {
    setEditingId(item.id);
    setActiveItemId(item.id);
    setOriginalCoverImage(item.coverImage ?? null);
    setDraft({
      title: item.title,
      genresText: item.genres.join(', '),
      coverImage: item.coverImage ?? null,
      tmdbId: item.tmdbId ?? null,
      watched: item.watched,
      rating: item.rating ?? 0,
      review: item.review,
    });
    setModalVisible(true);
  };

  const confirmDelete = (id: string, title: string) => {
    Alert.alert(`Delete "${title}"?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteAnime(id);
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
          ? await takeCoverPhotoStaged('anime', activeItemId)
          : await takeCoverPhoto('anime', activeItemId);
        if (uri) setDraft((d) => ({ ...d, coverImage: uri }));
      } },
      { text: 'Choose from Library', onPress: async () => {
        if (!activeItemId) return;
        const uri = isEditing
          ? await pickCoverFromLibraryStaged('anime', activeItemId)
          : await pickCoverFromLibrary('anime', activeItemId);
        if (uri) setDraft((d) => ({ ...d, coverImage: uri }));
      } },
    ];
    if (draft.coverImage) {
      buttons.push({
        text: 'Remove Photo',
        style: 'destructive',
        onPress: async () => {
          if (!isEditing && activeItemId) await deleteCover('anime', activeItemId);
          setDraft((d) => ({ ...d, coverImage: null }));
        },
      });
    }
    buttons.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Cover photo', undefined, buttons);
  };

  const handleCancelForm = () => {
    if (!editingId && draft.coverImage && activeItemId) {
      deleteCover('anime', activeItemId).catch(() => {});
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
    Alert.alert(`Delete ${count} ${count === 1 ? 'entry' : 'entries'}?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteAnimeEntries(Array.from(selectedIds));
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

  // Dynamic - see the allGenres comment above for why this differs from
  // Movies/TV Shows' fixed-list approach.
  const openGenreFilterMenu = () => {
    if (allGenres.length === 0) {
      Alert.alert('No genres yet', 'Add an entry with a genre first.');
      return;
    }
    const buttons: AlertButton[] = [
      { text: 'All genres', onPress: () => setGenreFilter(null) },
      ...allGenres.map((g) => ({ text: g, onPress: () => setGenreFilter(g) })),
      { text: 'Cancel', style: 'cancel' },
    ];
    Alert.alert('Filter by genre', 'An entry shows up if it has this genre among its tags.', buttons);
  };

  const openMenu = () => {
    Alert.alert('Anime', undefined, [
      { text: '+ Add entry', onPress: openAdd },
      { text: 'Filter by...', onPress: openSortMenu },
      { text: 'Filter by genre...', onPress: openGenreFilterMenu },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // Opens TMDb's own watch page - reuses lib/tvLookup.ts's
  // tmdbWatchUrl() directly (same /tv/{id}/watch shape, since anime
  // found via the TMDb primary source is catalogued there as a regular
  // TV show). Only ever called when draft.tmdbId is set - never true for
  // an entry found only through the Jikan fallback, see the file header
  // for why.
  const handleWhereToWatch = () => {
    if (!draft.tmdbId) return;
    Linking.openURL(tmdbWatchUrl(draft.tmdbId)).catch((err) => {
      console.warn('Media Base: failed to open Where to Watch URL', err);
      Alert.alert("Couldn't open that", 'Something went wrong opening the watch page - please try again.');
    });
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

    const isDuplicate = anime.some(
      (a) => a.id !== editingId && a.title.trim().toLowerCase() === draft.title.trim().toLowerCase(),
    );
    if (isDuplicate) {
      Alert.alert('Already tracking this', 'An entry with this title is already in your list.');
      return;
    }

    let finalCoverImage = draft.coverImage;
    if (editingId) {
      if (draft.coverImage === originalCoverImage) {
        // untouched this session
      } else if (draft.coverImage) {
        finalCoverImage = await commitPendingCover('anime', editingId, draft.coverImage);
      } else if (originalCoverImage) {
        await deleteCover('anime', editingId);
        finalCoverImage = null;
      }
    }

    const payload = {
      title: draft.title.trim(),
      genres,
      coverImage: finalCoverImage,
      tmdbId: draft.tmdbId,
      watched: draft.watched,
      rating: draft.watched ? draft.rating || null : null,
      review: draft.watched ? draft.review : '',
    };

    if (editingId) {
      await updateAnime(editingId, payload);
    } else {
      await addAnime(payload, activeItemId ?? undefined);
    }
    setModalVisible(false);
    load();
  };

  const handleCardPress = useCallback(
    (item: Anime) => {
      if (selectionMode) {
        toggleSelected(item.id);
      } else {
        openEdit(item);
      }
    },
    [selectionMode],
  );

  const handleCardLongPress = useCallback(
    (item: Anime) => {
      if (!selectionMode) enterSelectionMode(item.id);
    },
    [selectionMode],
  );

  const renderItem = useCallback(
    ({ item }: { item: Anime }) => (
      <AnimeCard
        anime={item}
        selected={selectedIds.has(item.id)}
        selectionMode={selectionMode}
        onPress={handleCardPress}
        onLongPress={handleCardLongPress}
        onLayout={(e) => recordRowHeight(e.nativeEvent.layout.height)}
      />
    ),
    [selectedIds, selectionMode, handleCardPress, handleCardLongPress, recordRowHeight],
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
        ? `No entries match "${searchQuery.trim()}".`
        : genreFilter
          ? `No entries tagged "${genreFilter}" yet.`
          : 'No anime yet. Tap ••• to add your first one.'}
    </AppText>
  );

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.colors.background }]} edges={['left', 'right', 'bottom']}>
      <ScreenHeader
        title={selectionMode ? `${selectedIds.size} selected` : 'Anime'}
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

      <SearchBar value={searchQuery} onChangeText={setSearchQuery} placeholder="Search your anime..." />

      <View style={styles.flex} onLayout={onListLayout}>
        {isAlpha ? (
          <SectionList<Anime, { title: string }>
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

              <CoverPicker uri={draft.coverImage} onPress={handleCoverPress} iconName="sparkles-outline" />

              <View style={[styles.field, { zIndex: 20 }]}>
                <AppText style={[styles.label, { color: theme.colors.textSecondary, fontSize: 13 * theme.fontScale }]}>
                  Title * (type to search and auto-fill)
                </AppText>
                <TitleSearchInput
                  value={draft.title}
                  onChangeText={(text) => setDraft((d) => ({ ...d, title: text }))}
                  search={(query) => searchAnimeByTitle(query)}
                  getKey={(r) => r.key}
                  getLabel={(r) => r.title ?? 'Untitled'}
                  getSubtitle={(r) => r.releaseYear}
                  onSelect={(r) => {
                    setDraft((d) => ({
                      ...d,
                      title: r.title || d.title,
                      genresText: r.genres.length > 0 ? r.genres.join(', ') : d.genresText,
                      tmdbId: r.tmdbId ?? null,
                    }));
                    if (r.coverUrl && activeItemId) {
                      const download = editingId
                        ? downloadRemoteCoverStaged('anime', activeItemId, r.coverUrl)
                        : downloadRemoteCover('anime', activeItemId, r.coverUrl);
                      download.then((uri) => {
                        if (uri) setDraft((d) => ({ ...d, coverImage: uri }));
                      });
                    }
                  }}
                />
              </View>

              <View style={styles.field}>
                <AppText style={[styles.label, { color: theme.colors.textSecondary, fontSize: 13 * theme.fontScale }]}>
                  Genre(s) * (comma-separated, e.g. Shounen, Action)
                </AppText>
                <TextInput
                  value={draft.genresText}
                  onChangeText={(text) => setDraft((d) => ({ ...d, genresText: text }))}
                  style={[styles.input, INPUT_FONT, { color: theme.colors.text, borderColor: theme.colors.border }]}
                />
              </View>

              {draft.tmdbId && (
                <TouchableOpacity
                  onPress={handleWhereToWatch}
                  style={[styles.watchButton, { borderColor: theme.colors.accentReadable }]}
                >
                  <AppText style={{ color: theme.colors.accentReadable, fontSize: 15 * theme.fontScale }}>
                    📺 Where to Watch
                  </AppText>
                </TouchableOpacity>
              )}

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
  watchButton: { borderWidth: 1, borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginBottom: 14 },
  deleteButton: { borderWidth: 1, borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 28 },
});
