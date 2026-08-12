// screens/TabletopScreen.tsx
//
// Mirrors screens/MusicScreen.tsx's shape (title-search-only, with an
// async follow-up fetch and a transient "looking this up" indicator)
// rather than screens/VinylScreen.tsx's three-entry-method shape -
// confirmed directly: no scan/barcode at all for this category, since
// BGG's API has no barcode field, and any UPC-to-BGG bridge would need
// a third-party service of unverified reliability, the same structural
// risk that already got Movies' original UPC approach removed once.
//
// Two things genuinely different from every prior title-search-only
// screen:
// 1. Selecting a search result only fills Title immediately -
//    lib/bggLookup.ts's fetchBggGameDetails() is a required follow-up
//    call for genre/players/cover, not an optional enrichment the way
//    Music's genre/cover fetches were. BGG's search endpoint alone only
//    ever returns id/title/year.
// 2. No artist-equivalent field at all, so no tap-to-filter-by-artist
//    the way Books/Comics/Vinyl-CD have. Genre filter is a fixed,
//    confirmed 20-item list (TABLETOP_GENRE_FILTERS), same fixed-list
//    approach as Vinyl/CD, not a dynamic "genres in your collection"
//    list.
//
// No "Where to Watch"/"Where to Listen"-style button here either, same
// reasoning as Vinyl/CD - the whole point of this category is a
// physical copy already owned, not a pointer to somewhere else to
// access it.

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
  Image,
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
import { getTabletopGames, addTabletopGame, updateTabletopGame, deleteTabletopGame, deleteTabletopGames, newId } from '../lib/storage';
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
import { fetchBggGameDetails } from '../lib/bggLookup';
import { searchTabletopGameByTitle } from '../lib/titleSearch';
import TitleSearchInput from '../components/TitleSearchInput';
import { useAlphabetScroll } from '../lib/useAlphabetScroll';
import { TabletopGame, TabletopGameSortField, TABLETOP_GENRE_FILTERS } from '../types/models';

const SORT_FIELDS: { field: TabletopGameSortField; label: string }[] = [
  { field: 'title', label: 'Title' },
  { field: 'played', label: 'Played?' },
  { field: 'rating', label: 'Rating' },
];

const ALPHA_FIELDS: TabletopGameSortField[] = ['title'];
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

function sortGames(games: TabletopGame[], field: TabletopGameSortField): TabletopGame[] {
  const copy = [...games];
  copy.sort((a, b) => {
    if (field === 'played') return Number(a.played) - Number(b.played);
    // Descending - 5 stars first, unrated (null) sinks to the very
    // bottom rather than sorting as if it were a 0-star rating.
    if (field === 'rating') return (b.rating ?? -1) - (a.rating ?? -1);
    if (field === 'genre') return (a.genres[0] ?? '').localeCompare(b.genres[0] ?? '');
    return String(a[field]).localeCompare(String(b[field]));
  });
  return copy;
}

function groupByFirstLetter(sorted: TabletopGame[]): { title: string; data: TabletopGame[] }[] {
  const groups: Record<string, TabletopGame[]> = {};
  for (const item of sorted) {
    const raw = item.title.trim();
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
  players: string;
  coverImage: string | null;
  played: boolean;
  rating: number;
  review: string;
}

const EMPTY_DRAFT: DraftState = {
  title: '',
  genresText: '',
  players: '',
  coverImage: null,
  played: false,
  rating: 0,
  review: '',
};

const INPUT_FONT = { fontFamily: FONT_FAMILY.body };
const REQUIRED_SWITCH_LABEL = 'Have you played this?\u00A0*';
// Not verified from the sandbox this was written in that this exact
// Ionicons name renders correctly - worth a visual check on device,
// same caveat already noted for sparkles-outline/tv-outline elsewhere.
const CATEGORY_ICON = 'extension-puzzle-outline';

const TabletopCard = React.memo(function TabletopCard({
  game,
  selected,
  selectionMode,
  onPress,
  onLongPress,
  onLayout,
}: {
  game: TabletopGame;
  selected: boolean;
  selectionMode: boolean;
  onPress: (game: TabletopGame) => void;
  onLongPress: (game: TabletopGame) => void;
  onLayout?: (e: any) => void;
}) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      onPress={() => onPress(game)}
      onLongPress={() => onLongPress(game)}
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
        <CoverThumbnail uri={game.coverImage} iconName={CATEGORY_ICON} />
        <View style={styles.flex}>
          <AppText
            variant="header"
            numberOfLines={1}
            ellipsizeMode="tail"
            style={{ color: theme.colors.text, fontSize: 16 * theme.fontScale }}
          >
            {game.title}
          </AppText>
          <View style={styles.metaRowInline}>
            {game.players ? (
              <AppText
                numberOfLines={1}
                style={{ color: theme.colors.textSecondary, fontSize: 13 * theme.fontScale }}
              >
                {game.players}
              </AppText>
            ) : null}
            <AppText
              numberOfLines={1}
              ellipsizeMode="tail"
              style={{ color: theme.colors.textSecondary, fontSize: 13 * theme.fontScale, flexShrink: 1 }}
            >
              {game.players ? ' · ' : ''}
              {game.genres.slice(0, 2).join(', ')}
              {game.genres.length > 2 ? ` +${game.genres.length - 2}` : ''}
            </AppText>
          </View>
          <AppText
            numberOfLines={1}
            style={{ color: game.played ? theme.colors.success : theme.colors.textMuted, fontSize: 13 * theme.fontScale, marginTop: 4 }}
          >
            {game.played ? `Played${game.rating ? ` · ${game.rating}★` : ''}` : 'Not played yet'}
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

export default function TabletopScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [games, setGames] = useState<TabletopGame[]>([]);
  const [sortField, setSortField] = useState<TabletopGameSortField>('title');
  const [genreFilter, setGenreFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [originalCoverImage, setOriginalCoverImage] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  // BGG's search alone only ever returns id/title/year - genre/players/
  // cover all require this follow-up fetch, and it can genuinely take a
  // few seconds. A silent wait that long looked broken in Music's
  // testing even when it wasn't - same fix here from the start rather
  // than waiting to rediscover the same UX gap.
  const [detailsLoading, setDetailsLoading] = useState(false);

  const load = useCallback(async () => {
    setGames(await getTabletopGames());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const filteredGames = useMemo(() => {
    let result = genreFilter
      ? games.filter((g) => g.genres.some((genre) => genre.toLowerCase().includes(genreFilter.toLowerCase())))
      : games;
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter((g) => g.title.toLowerCase().includes(q));
    }
    return result;
  }, [games, genreFilter, searchQuery]);

  const sorted = useMemo(() => sortGames(filteredGames, sortField), [filteredGames, sortField]);
  const sortLabel = SORT_FIELDS.find((f) => f.field === sortField)?.label ?? 'Title';
  const isAlpha = ALPHA_FIELDS.includes(sortField);
  const sections = useMemo(() => (isAlpha ? groupByFirstLetter(sorted) : []), [isAlpha, sorted]);

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
    setDetailsLoading(false);
    setModalVisible(true);
  };

  const openEdit = (item: TabletopGame) => {
    setEditingId(item.id);
    setActiveItemId(item.id);
    setOriginalCoverImage(item.coverImage ?? null);
    setDraft({
      title: item.title,
      genresText: item.genres.join(', '),
      players: item.players,
      coverImage: item.coverImage ?? null,
      played: item.played,
      rating: item.rating ?? 0,
      review: item.review,
    });
    setDetailsLoading(false);
    setModalVisible(true);
  };

  const confirmDelete = (id: string, title: string) => {
    Alert.alert(`Delete "${title}"?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteTabletopGame(id);
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
          ? await takeCoverPhotoStaged('tabletop', activeItemId)
          : await takeCoverPhoto('tabletop', activeItemId);
        if (uri) setDraft((d) => ({ ...d, coverImage: uri }));
      } },
      { text: 'Choose from Library', onPress: async () => {
        if (!activeItemId) return;
        const uri = isEditing
          ? await pickCoverFromLibraryStaged('tabletop', activeItemId)
          : await pickCoverFromLibrary('tabletop', activeItemId);
        if (uri) setDraft((d) => ({ ...d, coverImage: uri }));
      } },
    ];
    if (draft.coverImage) {
      buttons.push({
        text: 'Remove Photo',
        style: 'destructive',
        onPress: async () => {
          if (!isEditing && activeItemId) await deleteCover('tabletop', activeItemId);
          setDraft((d) => ({ ...d, coverImage: null }));
        },
      });
    }
    buttons.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Cover photo', undefined, buttons);
  };

  const handleCancelForm = () => {
    if (!editingId && draft.coverImage && activeItemId) {
      deleteCover('tabletop', activeItemId).catch(() => {});
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
    Alert.alert(`Delete ${count} ${count === 1 ? 'game' : 'games'}?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteTabletopGames(Array.from(selectedIds));
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

  // Fixed, confirmed 20-item list (TABLETOP_GENRE_FILTERS) - not a
  // "genres in your collection" dynamic menu, same approach as Vinyl/CD,
  // chosen directly after weighing both options.
  const openGenreFilterMenu = () => {
    const buttons: AlertButton[] = [
      { text: 'All genres', onPress: () => setGenreFilter(null) },
      ...TABLETOP_GENRE_FILTERS.map((g) => ({ text: g, onPress: () => setGenreFilter(g) })),
      { text: 'Cancel', style: 'cancel' },
    ];
    Alert.alert('Filter by genre', 'A game shows up if this genre appears anywhere in its own genre tags.', buttons);
  };

  const openMenu = () => {
    Alert.alert('Tabletop Games', undefined, [
      { text: '+ Add entry', onPress: openAdd },
      { text: 'Filter by...', onPress: openSortMenu },
      { text: 'Filter by genre...', onPress: openGenreFilterMenu },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleOpenBgg = () => {
    Linking.openURL('https://boardgamegeek.com').catch((err) => {
      console.warn('Media Base: failed to open BoardGameGeek URL', err);
      Alert.alert("Couldn't open that", 'Something went wrong opening BoardGameGeek - please try again.');
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

    const isDuplicate = games.some(
      (g) => g.id !== editingId && g.title.trim().toLowerCase() === draft.title.trim().toLowerCase(),
    );
    if (isDuplicate) {
      Alert.alert('Already tracking this one', 'A game with this title is already in your collection.');
      return;
    }

    let finalCoverImage = draft.coverImage;
    if (editingId) {
      if (draft.coverImage === originalCoverImage) {
        // untouched this session
      } else if (draft.coverImage) {
        finalCoverImage = await commitPendingCover('tabletop', editingId, draft.coverImage);
      } else if (originalCoverImage) {
        await deleteCover('tabletop', editingId);
        finalCoverImage = null;
      }
    }

    const payload = {
      title: draft.title.trim(),
      genres,
      players: draft.players.trim(),
      coverImage: finalCoverImage,
      played: draft.played,
      rating: draft.played ? draft.rating || null : null,
      review: draft.played ? draft.review : '',
    };

    if (editingId) {
      await updateTabletopGame(editingId, payload);
    } else {
      await addTabletopGame(payload, activeItemId ?? undefined);
    }
    setModalVisible(false);
    load();
  };

  const handleCardPress = useCallback(
    (item: TabletopGame) => {
      if (selectionMode) {
        toggleSelected(item.id);
      } else {
        openEdit(item);
      }
    },
    [selectionMode],
  );

  const handleCardLongPress = useCallback(
    (item: TabletopGame) => {
      if (!selectionMode) enterSelectionMode(item.id);
    },
    [selectionMode],
  );

  const renderItem = useCallback(
    ({ item }: { item: TabletopGame }) => (
      <TabletopCard
        game={item}
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
        ? `No games match "${searchQuery.trim()}".`
        : genreFilter
          ? `No games tagged "${genreFilter}" yet.`
          : 'Nothing here yet. Tap ••• to add your first game.'}
    </AppText>
  );

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.colors.background }]} edges={['left', 'right', 'bottom']}>
      <ScreenHeader
        title={selectionMode ? `${selectedIds.size} selected` : 'Tabletop Games'}
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

      <SearchBar value={searchQuery} onChangeText={setSearchQuery} placeholder="Search your games..." />

      <View style={styles.flex} onLayout={onListLayout}>
        {isAlpha ? (
          <SectionList<TabletopGame, { title: string }>
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

      {/* BGG's own terms require crediting them "in all uses of the BGG
          XML API" and displaying this logo "in public-facing uses" -
          read as a screen-level requirement (this whole category uses
          their API), not gated to whichever specific entries happened
          to come from a BGG search the way the Discogs link on
          Vinyl/CD's Edit screen is. Always shown here, regardless of
          how any individual entry was added. */}
      <TouchableOpacity onPress={handleOpenBgg} style={styles.bggFooter} accessibilityLabel="Powered by BGG - opens BoardGameGeek">
        <Image source={require('../assets/powered-by-bgg.png')} style={styles.bggLogo} resizeMode="contain" />
      </TouchableOpacity>

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

              <CoverPicker uri={draft.coverImage} onPress={handleCoverPress} iconName={CATEGORY_ICON} />

              <View style={[styles.field, { zIndex: 20 }]}>
                <AppText style={[styles.label, { color: theme.colors.textSecondary, fontSize: 13 * theme.fontScale }]}>
                  Title * (type to search and auto-fill)
                </AppText>
                <TitleSearchInput
                  value={draft.title}
                  onChangeText={(text) => setDraft((d) => ({ ...d, title: text }))}
                  search={(query) => searchTabletopGameByTitle(query)}
                  getKey={(r) => r.key}
                  getLabel={(r) => r.title ?? 'Untitled'}
                  getSubtitle={(r) => r.releaseYear}
                  onSelect={(r) => {
                    setDraft((d) => ({ ...d, title: r.title || d.title }));
                    // BGG's search alone only returns id/title/year -
                    // genre/players/cover all need this follow-up call,
                    // not an optional enrichment. See the file header.
                    setDetailsLoading(true);
                    fetchBggGameDetails(r.bggId)
                      .then(({ genres, players, coverUrl }) => {
                        setDraft((d) => ({
                          ...d,
                          genresText: genres.length > 0 ? genres.join(', ') : d.genresText,
                          players: players || d.players,
                        }));
                        if (coverUrl && activeItemId) {
                          const download = editingId
                            ? downloadRemoteCoverStaged('tabletop', activeItemId, coverUrl)
                            : downloadRemoteCover('tabletop', activeItemId, coverUrl);
                          download.then((uri) => {
                            if (uri) setDraft((d) => ({ ...d, coverImage: uri }));
                          });
                        }
                      })
                      .finally(() => setDetailsLoading(false));
                  }}
                />
              </View>

              <View style={styles.field}>
                <AppText style={[styles.label, { color: theme.colors.textSecondary, fontSize: 13 * theme.fontScale }]}>
                  Genre(s) * (comma-separated, e.g. Party Game, Card Game)
                </AppText>
                {detailsLoading && (
                  <AppText style={{ color: theme.colors.textMuted, fontSize: 12 * theme.fontScale, marginBottom: 6 }}>
                    Looking that up - can take a few seconds…
                  </AppText>
                )}
                <TextInput
                  value={draft.genresText}
                  onChangeText={(text) => setDraft((d) => ({ ...d, genresText: text }))}
                  style={[styles.input, INPUT_FONT, { color: theme.colors.text, borderColor: theme.colors.border }]}
                />
              </View>

              <View style={styles.field}>
                <AppText style={[styles.label, { color: theme.colors.textSecondary, fontSize: 13 * theme.fontScale }]}>
                  Players (optional - however you'd honestly describe it, e.g. "2-6" or "Party")
                </AppText>
                <TextInput
                  value={draft.players}
                  onChangeText={(text) => setDraft((d) => ({ ...d, players: text }))}
                  style={[styles.input, INPUT_FONT, { color: theme.colors.text, borderColor: theme.colors.border }]}
                />
              </View>

              <View style={[styles.row, { marginTop: 8 }]}>
                <AppText style={{ color: theme.colors.text, fontSize: 15 * theme.fontScale, flex: 1, paddingRight: 12 }}>
                  {REQUIRED_SWITCH_LABEL}
                </AppText>
                <Switch
                  value={draft.played}
                  onValueChange={(played) => setDraft((d) => ({ ...d, played }))}
                  trackColor={{ true: theme.colors.accent, false: theme.colors.border }}
                />
              </View>

              {draft.played && (
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
  metaRowInline: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
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
  bggFooter: { alignItems: 'center', paddingVertical: 10 },
  // Matches the source image's real 368x108 aspect ratio (≈3.41:1),
  // scaled down while staying legible per BGG's own sizing guidance.
  bggLogo: { width: 140, height: 41 },
});
