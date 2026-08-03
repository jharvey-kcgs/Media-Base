// screens/TVScreen.tsx
//
// Steps 5-7 of the TV Shows build: full list view, Add Entry, Edit
// Entry. Structurally simpler than MovieScreen.tsx in one real way -
// no camera/scanner at all, since TV Shows has no barcode/number entry
// of any kind (confirmed design). Title search is the ONE and only
// entry-assist method, so this screen leads with it directly rather
// than demoting it below a scan option the way Movies does.
//
// Where to Watch (step 8) isn't built yet - tmdbId is still captured
// and stored on every entry added/edited through title search, so that
// step can use it later without needing to backfill existing entries.

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
import { getTVShows, addTVShow, updateTVShow, deleteTVShow, deleteTVShows, newId } from '../lib/storage';
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
import { TMDB_TV_GENRE_NAMES } from '../lib/tvLookup';
import { searchTVShowsByTitle } from '../lib/titleSearch';
import TitleSearchInput from '../components/TitleSearchInput';
import { useAlphabetScroll } from '../lib/useAlphabetScroll';
import { TVShow, TVShowSortField } from '../types/models';

// Genre isn't listed here - "Filter by genre..." (its own menu item,
// below) is the dedicated place to interact with genre.
const SORT_FIELDS: { field: TVShowSortField; label: string }[] = [
  { field: 'title', label: 'Title' },
  { field: 'watched', label: 'Watched?' },
  { field: 'rating', label: 'Rating' },
];

// Only 'title' - no author field on this screen to sort by.
const ALPHA_FIELDS: TVShowSortField[] = ['title'];
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

function sortTVShows(tvShows: TVShow[], field: TVShowSortField): TVShow[] {
  const copy = [...tvShows];
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

function groupByFirstLetter(sorted: TVShow[], field: 'title' | 'genre'): { title: string; data: TVShow[] }[] {
  const getKey = (item: TVShow) => (field === 'genre' ? item.genres[0] ?? '' : String(item[field] ?? ''));
  const groups: Record<string, TVShow[]> = {};
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
const REQUIRED_SWITCH_LABEL = 'Have you watched this show?\u00A0*';

const TVCard = React.memo(function TVCard({
  tvShow,
  selected,
  selectionMode,
  onPress,
  onLongPress,
  onLayout,
}: {
  tvShow: TVShow;
  selected: boolean;
  selectionMode: boolean;
  onPress: (tvShow: TVShow) => void;
  onLongPress: (tvShow: TVShow) => void;
  onLayout?: (e: any) => void;
}) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      onPress={() => onPress(tvShow)}
      onLongPress={() => onLongPress(tvShow)}
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
        <CoverThumbnail uri={tvShow.coverImage} iconName="tv-outline" />
        <View style={styles.flex}>
          <AppText
            variant="header"
            numberOfLines={1}
            ellipsizeMode="tail"
            style={{ color: theme.colors.text, fontSize: 16 * theme.fontScale }}
          >
            {tvShow.title}
          </AppText>
          <AppText
            numberOfLines={1}
            ellipsizeMode="tail"
            style={{ color: theme.colors.textSecondary, fontSize: 13 * theme.fontScale, marginTop: 2 }}
          >
            {tvShow.genres.slice(0, 2).join(', ')}
            {tvShow.genres.length > 2 ? ` +${tvShow.genres.length - 2}` : ''}
          </AppText>
          <AppText
            numberOfLines={1}
            style={{ color: tvShow.watched ? theme.colors.success : theme.colors.textMuted, fontSize: 13 * theme.fontScale, marginTop: 4 }}
          >
            {tvShow.watched ? `Watched${tvShow.rating ? ` · ${tvShow.rating}★` : ''}` : 'Not watched yet'}
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

export default function TVScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [tvShows, setTVShows] = useState<TVShow[]>([]);
  const [sortField, setSortField] = useState<TVShowSortField>('title');
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
    setTVShows(await getTVShows());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const filteredTVShows = useMemo(() => {
    let result = genreFilter
      ? tvShows.filter((t) => t.genres.some((g) => g.toLowerCase() === genreFilter.toLowerCase()))
      : tvShows;
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter((t) => t.title.toLowerCase().includes(q));
    }
    return result;
  }, [tvShows, genreFilter, searchQuery]);

  const sorted = useMemo(() => sortTVShows(filteredTVShows, sortField), [filteredTVShows, sortField]);
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

  const openEdit = (tvShow: TVShow) => {
    setEditingId(tvShow.id);
    setActiveItemId(tvShow.id);
    setOriginalCoverImage(tvShow.coverImage ?? null);
    setDraft({
      title: tvShow.title,
      genresText: tvShow.genres.join(', '),
      coverImage: tvShow.coverImage ?? null,
      tmdbId: tvShow.tmdbId ?? null,
      watched: tvShow.watched,
      rating: tvShow.rating ?? 0,
      review: tvShow.review,
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
          await deleteTVShow(id);
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
          ? await takeCoverPhotoStaged('tvshows', activeItemId)
          : await takeCoverPhoto('tvshows', activeItemId);
        if (uri) setDraft((d) => ({ ...d, coverImage: uri }));
      } },
      { text: 'Choose from Library', onPress: async () => {
        if (!activeItemId) return;
        const uri = isEditing
          ? await pickCoverFromLibraryStaged('tvshows', activeItemId)
          : await pickCoverFromLibrary('tvshows', activeItemId);
        if (uri) setDraft((d) => ({ ...d, coverImage: uri }));
      } },
    ];
    if (draft.coverImage) {
      buttons.push({
        text: 'Remove Photo',
        style: 'destructive',
        onPress: async () => {
          if (!isEditing && activeItemId) await deleteCover('tvshows', activeItemId);
          setDraft((d) => ({ ...d, coverImage: null }));
        },
      });
    }
    buttons.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Cover photo', undefined, buttons);
  };

  const handleCancelForm = () => {
    if (!editingId && draft.coverImage && activeItemId) {
      deleteCover('tvshows', activeItemId).catch(() => {});
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
    Alert.alert(`Delete ${count} ${count === 1 ? 'show' : 'shows'}?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteTVShows(Array.from(selectedIds));
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

  // Same reasoning as Movies: shows TMDb's full, fixed genre list
  // directly rather than only genres currently in use - a stable,
  // predictable set of filter options regardless of what's been added.
  const openGenreFilterMenu = () => {
    const buttons: AlertButton[] = [
      { text: 'All genres', onPress: () => setGenreFilter(null) },
      ...TMDB_TV_GENRE_NAMES.map((g) => ({ text: g, onPress: () => setGenreFilter(g) })),
      { text: 'Cancel', style: 'cancel' },
    ];
    Alert.alert('Filter by genre', 'A show shows up if it has this genre among its tags.', buttons);
  };

  const openMenu = () => {
    Alert.alert('TV Shows', undefined, [
      { text: '+ Add entry', onPress: openAdd },
      { text: 'Filter by...', onPress: openSortMenu },
      { text: 'Filter by genre...', onPress: openGenreFilterMenu },
      { text: 'Cancel', style: 'cancel' },
    ]);
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

    const isDuplicate = tvShows.some(
      (t) => t.id !== editingId && t.title.trim().toLowerCase() === draft.title.trim().toLowerCase(),
    );
    if (isDuplicate) {
      Alert.alert('Already tracking this show', 'A show with this title is already in your list.');
      return;
    }

    let finalCoverImage = draft.coverImage;
    if (editingId) {
      if (draft.coverImage === originalCoverImage) {
        // untouched this session
      } else if (draft.coverImage) {
        finalCoverImage = await commitPendingCover('tvshows', editingId, draft.coverImage);
      } else if (originalCoverImage) {
        await deleteCover('tvshows', editingId);
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
      await updateTVShow(editingId, payload);
    } else {
      await addTVShow(payload, activeItemId ?? undefined);
    }
    setModalVisible(false);
    load();
  };

  const handleCardPress = useCallback(
    (tvShow: TVShow) => {
      if (selectionMode) {
        toggleSelected(tvShow.id);
      } else {
        openEdit(tvShow);
      }
    },
    [selectionMode],
  );

  const handleCardLongPress = useCallback(
    (tvShow: TVShow) => {
      if (!selectionMode) enterSelectionMode(tvShow.id);
    },
    [selectionMode],
  );

  const renderItem = useCallback(
    ({ item }: { item: TVShow }) => (
      <TVCard
        tvShow={item}
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
        ? `No shows match "${searchQuery.trim()}".`
        : genreFilter
          ? `No shows tagged "${genreFilter}" yet.`
          : 'No TV shows yet. Tap ••• to add your first one.'}
    </AppText>
  );

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.colors.background }]} edges={['left', 'right', 'bottom']}>
      <ScreenHeader
        title={selectionMode ? `${selectedIds.size} selected` : 'TV Shows'}
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

      <SearchBar value={searchQuery} onChangeText={setSearchQuery} placeholder="Search your TV shows..." />

      <View style={styles.flex} onLayout={onListLayout}>
        {isAlpha ? (
          <SectionList<TVShow, { title: string }>
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

              <CoverPicker uri={draft.coverImage} onPress={handleCoverPress} iconName="tv-outline" />

              <View style={[styles.field, { zIndex: 20 }]}>
                <AppText style={[styles.label, { color: theme.colors.textSecondary, fontSize: 13 * theme.fontScale }]}>
                  Title * (type to search and auto-fill)
                </AppText>
                <TitleSearchInput
                  value={draft.title}
                  onChangeText={(text) => setDraft((d) => ({ ...d, title: text }))}
                  search={(query) => searchTVShowsByTitle(query)}
                  getKey={(r) => (r.tmdbId != null ? String(r.tmdbId) : `${r.title}-${r.firstAirYear}`)}
                  getLabel={(r) => r.title ?? 'Untitled'}
                  getSubtitle={(r) => r.firstAirYear}
                  onSelect={(r) => {
                    setDraft((d) => ({
                      ...d,
                      title: r.title || d.title,
                      genresText: r.genres.length > 0 ? r.genres.join(', ') : d.genresText,
                      tmdbId: r.tmdbId ?? d.tmdbId,
                    }));
                    if (r.coverUrl && activeItemId) {
                      const download = editingId
                        ? downloadRemoteCoverStaged('tvshows', activeItemId, r.coverUrl)
                        : downloadRemoteCover('tvshows', activeItemId, r.coverUrl);
                      download.then((uri) => {
                        if (uri) setDraft((d) => ({ ...d, coverImage: uri }));
                      });
                    }
                  }}
                />
              </View>

              <View style={styles.field}>
                <AppText style={[styles.label, { color: theme.colors.textSecondary, fontSize: 13 * theme.fontScale }]}>
                  Genre(s) * (comma-separated, e.g. Drama, Comedy)
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
  deleteButton: { borderWidth: 1, borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 28 },
});
