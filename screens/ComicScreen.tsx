// screens/ComicScreen.tsx
//
// Built directly on the Books pattern (screens/BookScreen.tsx) - Comics/
// Manga entries work identically (multi-genre, ISBN lookup/scan since
// graphic novels and manga volumes are cataloged with real ISBNs same as
// any other book, a read switch), sharing the ISBN-lookup and A-Z-scroll
// logic via lib/isbnLookup.ts and lib/useAlphabetScroll.ts. The one real
// difference is GENRE_ALLOWLIST below: manga in particular is as often
// filed by demographic (Shonen/Seinen/Shoujo/Josei) as by traditional
// genre, so those are included alongside genre terms.

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
import ISBN from 'isbn3';
import AppText, { FONT_FAMILY } from '../components/AppText';
import ScreenHeader from '../components/ScreenHeader';
import SearchBar from '../components/SearchBar';
import CoverThumbnail from '../components/CoverThumbnail';
import CoverPicker from '../components/CoverPicker';
import { useTheme } from '../lib/theme';
import { getComics, addComic, updateComic, deleteComic, deleteComics, newId } from '../lib/storage';
import { pickCoverFromLibrary, takeCoverPhoto, downloadRemoteCover, deleteCover } from '../lib/coverStorage';
import { runIsbnLookup as runIsbnLookupApi } from '../lib/isbnLookup';
import { searchBooksByTitle } from '../lib/titleSearch';
import TitleSearchInput from '../components/TitleSearchInput';
import { useAlphabetScroll } from '../lib/useAlphabetScroll';
import { Comic, ComicSortField } from '../types/models';

// Genre isn't listed here anymore - "Filter by genre..." (its own menu
// item, below) is the dedicated place to interact with genre, so having
// it in this sort-field picker too was redundant/confusing.
const SORT_FIELDS: { field: ComicSortField; label: string }[] = [
  { field: 'title', label: 'Title' },
  { field: 'author', label: 'Author' },
  { field: 'read', label: 'Read?' },
  { field: 'rating', label: 'Rating' },
];

// Sort fields where an A-Z jump index actually makes sense.
const ALPHA_FIELDS: ComicSortField[] = ['title', 'author'];
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

// The ONLY genres the ISBN lookup is allowed to auto-fill - see
// lib/isbnLookup.ts for how this gets applied, and Book's own version of
// this list for the general rationale (an allowlist, not reactive
// blocking). This one differs from Books' by including manga demographic
// labels (Shonen/Shoujo/Seinen/Josei) alongside traditional genres, since
// manga readers filter by demographic just as often as by genre.
//
// Grounded in BISAC's actual "COMICS & GRAPHIC NOVELS" subcategory list
// (bisg.org/comics-and-graphic-novels), verified directly rather than
// guessed - this confirmed Mecha/Isekai/Manhua/Manhwa are real industry
// terms (not just fan-community jargon), and surfaced several real
// subcategories the original version was missing entirely (Cyberpunk,
// Steampunk, Light Novel, Occult, School Life, Espionage, Superheroes/
// Supervillains as their own headings, Magical Realism, Coming Of Age).
const GENRE_ALLOWLIST = [
  'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Science Fiction',
  'Horror', 'Mystery', 'Thriller', 'Suspense', 'Romance', 'Slice Of Life',
  'Historical', 'Sports', 'Supernatural', 'Mecha', 'Isekai',
  'Post-Apocalyptic', 'Dystopian', 'Crime', 'War', 'Satire',
  'Anthology', 'Biography', 'Memoir', 'Fiction', 'Nonfiction', 'Western',
  'Psychological', 'Shonen', 'Shoujo', 'Seinen', 'Josei', 'Manga',
  'Manhwa', 'Manhua', 'Graphic Novel',
  // Added after confirming against BISG's real Comics & Graphic Novels
  // subcategory list.
  'Coming Of Age', 'Cyberpunk', 'Steampunk', 'Light Novel', 'Literary',
  'Magical Realism', 'Occult', 'School Life', 'Espionage', 'Superheroes',
  'Supervillains', 'LGBTQ', 'Erotica', 'Mythology', 'Fairy Tales',
];

function sortComics(comics: Comic[], field: ComicSortField): Comic[] {
  const copy = [...comics];
  copy.sort((a, b) => {
    if (field === 'read') return Number(a.read) - Number(b.read);
    // Descending - 5 stars first, unrated (null) sinks to the very
    // bottom rather than sorting as if it were a 0-star rating.
    if (field === 'rating') return (b.rating ?? -1) - (a.rating ?? -1);
    if (field === 'genre') return (a.genres[0] ?? '').localeCompare(b.genres[0] ?? '');
    return String(a[field]).localeCompare(String(b[field]));
  });
  return copy;
}

// Genre grouping/sorting uses genres[0] ("primary" tag) as the key -
// Title/Author still read directly off the comic.
function groupByFirstLetter(sorted: Comic[], field: 'title' | 'genre' | 'author'): { title: string; data: Comic[] }[] {
  const getKey = (item: Comic) => (field === 'genre' ? item.genres[0] ?? '' : String(item[field] ?? ''));
  const groups: Record<string, Comic[]> = {};
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
  genresText: string; // comma-separated as typed; parsed into an array on save
  author: string;
  isbn: string;
  coverImage: string | null;
  read: boolean;
  rating: number;
  review: string;
}

const EMPTY_DRAFT: DraftState = {
  title: '',
  genresText: '',
  author: '',
  isbn: '',
  coverImage: null,
  read: false,
  rating: 0,
  review: '',
};

const INPUT_FONT = { fontFamily: FONT_FAMILY.body };
// Non-breaking space keeps the trailing "*" glued to the last word instead
// of wrapping onto its own line at larger text sizes.
const REQUIRED_SWITCH_LABEL = 'Have you read this comic/manga?\u00A0*';

// Memoized row component, defined at module scope (never recreated) - see
// BookScreen.tsx's BookCard for the full story on why this matters (the
// fix for sluggish scrolling/filtering once a list has 50+ entries).
const ComicCard = React.memo(function ComicCard({
  comic,
  selected,
  selectionMode,
  onPress,
  onLongPress,
  onAuthorPress,
  onLayout,
}: {
  comic: Comic;
  selected: boolean;
  selectionMode: boolean;
  onPress: (comic: Comic) => void;
  onLongPress: (comic: Comic) => void;
  onAuthorPress: (author: string) => void;
  onLayout?: (e: any) => void;
}) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      onPress={() => onPress(comic)}
      onLongPress={() => onLongPress(comic)}
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
        <CoverThumbnail uri={comic.coverImage} iconName="book-outline" />
        <View style={styles.flex}>
          <AppText
            variant="header"
            numberOfLines={1}
            ellipsizeMode="tail"
            style={{ color: theme.colors.text, fontSize: 16 * theme.fontScale }}
          >
            {comic.title}
          </AppText>
          <View style={styles.authorGenreRow}>
            {comic.author ? (
              <TouchableOpacity
                disabled={selectionMode}
                onPress={() => onAuthorPress(comic.author)}
                hitSlop={{ top: 4, bottom: 4, left: 0, right: 0 }}
              >
                <AppText
                  numberOfLines={1}
                  style={{ color: selectionMode ? theme.colors.textSecondary : theme.colors.accentReadable, fontSize: 13 * theme.fontScale }}
                >
                  {comic.author}
                </AppText>
              </TouchableOpacity>
            ) : null}
            <AppText
              numberOfLines={1}
              ellipsizeMode="tail"
              style={{ color: theme.colors.textSecondary, fontSize: 13 * theme.fontScale, flexShrink: 1 }}
            >
              {comic.author ? ' · ' : ''}
              {comic.genres.slice(0, 2).join(', ')}
              {comic.genres.length > 2 ? ` +${comic.genres.length - 2}` : ''}
            </AppText>
          </View>
          <AppText
            numberOfLines={1}
            style={{ color: comic.read ? theme.colors.success : theme.colors.textMuted, fontSize: 13 * theme.fontScale, marginTop: 4 }}
          >
            {comic.read ? `Read${comic.rating ? ` · ${comic.rating}★` : ''}` : 'Not read yet'}
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

export default function ComicScreen({ navigation }: any) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [comics, setComics] = useState<Comic[]>([]);
  const [sortField, setSortField] = useState<ComicSortField>('title');
  const [genreFilter, setGenreFilter] = useState<string | null>(null);
  const [authorFilter, setAuthorFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [lookingUp, setLookingUp] = useState(false);
  const [isbnStatus, setIsbnStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [isbnGroup, setIsbnGroup] = useState('');
  const [scannerVisible, setScannerVisible] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const scanLockRef = useRef(false);

  const load = useCallback(async () => {
    setComics(await getComics());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const allGenres = useMemo(() => {
    const set = new Set<string>();
    comics.forEach((c) => c.genres.forEach((g) => set.add(g)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [comics]);

  const filteredComics = useMemo(() => {
    let result = genreFilter
      ? comics.filter((c) => c.genres.some((g) => g.toLowerCase() === genreFilter.toLowerCase()))
      : comics;
    if (authorFilter) {
      result = result.filter((c) => c.author.toLowerCase() === authorFilter.toLowerCase());
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter((c) => c.title.toLowerCase().includes(q) || c.author.toLowerCase().includes(q));
    }
    return result;
  }, [comics, genreFilter, authorFilter, searchQuery]);

  const sorted = useMemo(() => sortComics(filteredComics, sortField), [filteredComics, sortField]);
  const sortLabel = SORT_FIELDS.find((f) => f.field === sortField)?.label ?? 'Title';
  const isAlpha = ALPHA_FIELDS.includes(sortField);
  const sections = useMemo(
    () => (isAlpha ? groupByFirstLetter(sorted, sortField as 'title' | 'genre' | 'author') : []),
    [isAlpha, sorted, sortField],
  );

  // A-Z index scroll handling - see lib/useAlphabetScroll.ts for the full
  // history of why it works this way (three rounds of real bugs found and
  // fixed on Books first).
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
    setDraft(EMPTY_DRAFT);
    setIsbnStatus('idle');
    setModalVisible(true);
  };

  const openEdit = (comic: Comic) => {
    setEditingId(comic.id);
    setActiveItemId(comic.id);
    setDraft({
      title: comic.title,
      genresText: comic.genres.join(', '),
      author: comic.author,
      isbn: comic.isbn ?? '',
      coverImage: comic.coverImage ?? null,
      read: comic.read,
      rating: comic.rating ?? 0,
      review: comic.review,
    });
    const digits = (comic.isbn ?? '').replace(/[^0-9Xx]/g, '');
    if (digits.length === 10 || digits.length === 13) {
      const parsed = ISBN.parse(digits);
      setIsbnStatus(parsed?.isValid ? 'valid' : 'invalid');
      setIsbnGroup(parsed?.groupname ?? '');
    } else {
      setIsbnStatus('idle');
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
          await deleteComic(id);
          load();
        },
      },
    ]);
  };

  const handleCoverPress = () => {
    const buttons: AlertButton[] = [
      { text: 'Take Photo', onPress: async () => {
        if (!activeItemId) return;
        const uri = await takeCoverPhoto('comics', activeItemId);
        if (uri) setDraft((d) => ({ ...d, coverImage: uri }));
      } },
      { text: 'Choose from Library', onPress: async () => {
        if (!activeItemId) return;
        const uri = await pickCoverFromLibrary('comics', activeItemId);
        if (uri) setDraft((d) => ({ ...d, coverImage: uri }));
      } },
    ];
    if (draft.coverImage) {
      buttons.push({
        text: 'Remove Photo',
        style: 'destructive',
        onPress: async () => {
          if (activeItemId) await deleteCover('comics', activeItemId);
          setDraft((d) => ({ ...d, coverImage: null }));
        },
      });
    }
    buttons.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Cover photo', undefined, buttons);
  };

  const handleCancelForm = () => {
    if (!editingId && draft.coverImage && activeItemId) {
      deleteCover('comics', activeItemId).catch(() => {});
    }
    setModalVisible(false);
  };

  // Entered via long-press on a card now, not a "..." menu item -
  // matches iOS's own long-press-to-select pattern (Photos, Mail, Files)
  // rather than a separate menu entry. Selects the long-pressed item
  // immediately, same as those apps do, rather than opening into an
  // empty selection.
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
          await deleteComics(Array.from(selectedIds));
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

  const openGenreFilterMenu = () => {
    if (allGenres.length === 0) {
      Alert.alert('No genres yet', 'Add a comic or manga with a genre first.');
      return;
    }
    const buttons: AlertButton[] = [
      { text: 'All genres', onPress: () => setGenreFilter(null) },
      ...allGenres.map((g) => ({
        text: g,
        onPress: () => {
          setAuthorFilter(null);
          setGenreFilter(g);
        },
      })),
      { text: 'Cancel', style: 'cancel' },
    ];
    Alert.alert('Filter by genre', 'An entry shows up if it has this genre among its tags.', buttons);
  };

  const openMenu = () => {
    Alert.alert('Comics/Manga', undefined, [
      { text: '+ Add entry', onPress: openAdd },
      { text: 'Filter by...', onPress: openSortMenu },
      { text: 'Filter by genre...', onPress: openGenreFilterMenu },
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
      'Camera access was turned off outside the app - open Phone Settings to turn it back on, or use the ISBN field below instead.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Phone Settings', onPress: () => Linking.openSettings() },
      ],
    );
  };

  // Shared by both typing (handleIsbnChange, below) and the barcode
  // scanner: given raw digits, reformats with the real hyphen positions
  // and checks the checksum via isbn3, updating the field + status.
  const applyIsbnDigits = (digits: string): boolean => {
    if (digits.length !== 10 && digits.length !== 13) {
      setIsbnStatus('idle');
      setDraft((d) => ({ ...d, isbn: digits }));
      return false;
    }
    try {
      const parsed = ISBN.parse(digits);
      if (parsed?.isValid) {
        setIsbnStatus('valid');
        setIsbnGroup(parsed.groupname ?? '');
        setDraft((d) => ({ ...d, isbn: (parsed.isIsbn13 ? parsed.isbn13h : parsed.isbn10h) || digits }));
        return true;
      }
      setIsbnStatus('invalid');
    } catch (err) {
      console.warn('Media Base: isbn3 parse failed', err);
      setIsbnStatus('idle');
    }
    setDraft((d) => ({ ...d, isbn: digits }));
    return false;
  };

  const handleIsbnChange = (text: string) => {
    applyIsbnDigits(text.replace(/[^0-9Xx]/g, ''));
  };

  // Fires once a barcode is in view long enough to decode. Locked with a
  // ref (not state) so a single barcode sitting in frame doesn't fire this
  // dozens of times per second. Restricted to EAN-13 starting 978/979 (the
  // actual Bookland ISBN prefixes) - graphic novels and manga volumes are
  // cataloged with real ISBNs the same as any other book, so this is the
  // same check BookScreen uses.
  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (scanLockRef.current) return;
    const digits = data.replace(/[^0-9Xx]/g, '');
    if (digits.length !== 13 || !(digits.startsWith('978') || digits.startsWith('979'))) return;
    scanLockRef.current = true;
    setScannerVisible(false);
    const isValid = applyIsbnDigits(digits);
    if (isValid) {
      runIsbnLookup(digits);
    } else {
      Alert.alert(
        "That barcode's check digit looks off",
        "Might be a damaged or misprinted barcode - try again, or enter the ISBN by hand below.",
      );
    }
  };

  const handleIsbnBlur = () => {
    const digits = draft.isbn.replace(/[^0-9Xx]/g, '');
    if (digits.length !== 10 && digits.length !== 13) return;
    runIsbnLookup(digits);
  };

  // Thin wrapper around the shared lib/isbnLookup.runIsbnLookup - see
  // BookScreen.tsx's version of this for the full rationale.
  const runIsbnLookup = async (digits: string) => {
    setLookingUp(true);
    try {
      const result = await runIsbnLookupApi(digits, GENRE_ALLOWLIST);
      if (!result) {
        Alert.alert(
          "Couldn't find that ISBN",
          'No match in either book database checked - you can still fill in the details by hand.',
        );
        return;
      }
      // Weaker evidence than the reverse check on BookScreen: this is
      // "no comic/manga signal was found," not "we confirmed this is a
      // regular book" - genuinely different confidence levels, so it only
      // fires when there's real genre data to go on at all (an ISBN with
      // no classification data isn't confidently "not a comic," it's just
      // unclassified) and the message says so rather than asserting it
      // flatly. Only blocks the auto-fill, same as the reverse check -
      // manual entry is never blocked.
      if (result.genres.length > 0 && !result.isLikelyComic) {
        Alert.alert(
          "That doesn't look like a Comic/Manga",
          "Its listed categories don't show any comic/graphic novel/manga classification, so this looks like a regular book - add it from the Books screen instead. Nothing was filled in here. (This check is less certain than the other direction - if you're sure this is a comic/manga, its listing may just be missing that classification, and you can still enter the details by hand.)",
        );
        return;
      }
      if (!result.title && !result.author && result.genres.length === 0) {
        Alert.alert(
          "Found the ISBN, but couldn't get details",
          'None of the databases checked have a populated record for it - you can still fill in the details by hand.',
        );
        return;
      }
      setDraft((d) => ({
        ...d,
        title: result.title || d.title,
        author: result.author || d.author,
        genresText: result.genres.length > 0 ? result.genres.join(', ') : d.genresText,
      }));
      if (result.coverUrl && activeItemId) {
        downloadRemoteCover('comics', activeItemId, result.coverUrl).then((uri) => {
          if (uri) setDraft((d) => ({ ...d, coverImage: uri }));
        });
      }
    } catch (err) {
      console.warn('Media Base: ISBN lookup failed', err);
      Alert.alert('Lookup failed', 'Could not reach the book database - check your connection, or fill in the details by hand.');
    } finally {
      setLookingUp(false);
    }
  };

  const handleSave = async () => {
    const genres = draft.genresText
      .split(',')
      .map((g) => g.trim())
      .filter(Boolean);

    if (!draft.title.trim() || genres.length === 0 || !draft.author.trim()) {
      Alert.alert('Missing info', 'Title, at least one genre, and author are all required.');
      return;
    }

    // Failsafe against duplicate entries: same title (trimmed, case-
    // insensitive) already tracked, excluding the item currently being
    // edited. Worth knowing for manga specifically: publishers usually
    // bake the volume number into the title itself (e.g. "One Piece,
    // Vol. 42"), which is what keeps each volume from colliding with this
    // check - if a series' ISBN lookups ever come back with just the
    // bare series name for every volume, that's what to fix rather than
    // this guard itself.
    const isDuplicate = comics.some(
      (c) => c.id !== editingId && c.title.trim().toLowerCase() === draft.title.trim().toLowerCase(),
    );
    if (isDuplicate) {
      Alert.alert('Already tracking this one', 'An entry with this title is already in your list.');
      return;
    }

    const payload = {
      title: draft.title.trim(),
      genres,
      author: draft.author.trim(),
      isbn: draft.isbn.trim(),
      coverImage: draft.coverImage,
      read: draft.read,
      rating: draft.read ? draft.rating || null : null,
      review: draft.read ? draft.review : '',
    };

    if (editingId) {
      await updateComic(editingId, payload);
    } else {
      await addComic(payload, activeItemId ?? undefined);
    }
    setModalVisible(false);
    load();
  };

  const handleCardPress = useCallback(
    (comic: Comic) => {
      if (selectionMode) {
        toggleSelected(comic.id);
      } else {
        openEdit(comic);
      }
    },
    [selectionMode],
  );

  const handleCardLongPress = useCallback(
    (comic: Comic) => {
      if (!selectionMode) enterSelectionMode(comic.id);
    },
    [selectionMode],
  );

  const handleAuthorPress = useCallback((author: string) => {
    setGenreFilter(null);
    setAuthorFilter(author);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: Comic }) => (
      <ComicCard
        comic={item}
        selected={selectedIds.has(item.id)}
        selectionMode={selectionMode}
        onPress={handleCardPress}
        onLongPress={handleCardLongPress}
        onAuthorPress={handleAuthorPress}
        onLayout={(e) => recordRowHeight(e.nativeEvent.layout.height)}
      />
    ),
    [selectedIds, selectionMode, handleCardPress, handleCardLongPress, handleAuthorPress, recordRowHeight],
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
        ? `No comics or manga match "${searchQuery.trim()}".`
        : authorFilter
          ? `No entries by "${authorFilter}" yet.`
          : genreFilter
            ? `No entries tagged "${genreFilter}" yet.`
            : 'No comics or manga yet. Tap ••• to add your first one.'}
    </AppText>
  );

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.colors.background }]} edges={['left', 'right', 'bottom']}>
      <ScreenHeader
        title={selectionMode ? `${selectedIds.size} selected` : 'Comics/Manga'}
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
        {authorFilter && (
          <TouchableOpacity onPress={() => setAuthorFilter(null)}>
            <AppText style={{ color: theme.colors.accentReadable, fontSize: 12 * theme.fontScale, marginLeft: 8 }}>
              · Author: {authorFilter} ✕
            </AppText>
          </TouchableOpacity>
        )}
      </View>

      <SearchBar value={searchQuery} onChangeText={setSearchQuery} placeholder="Search your comics/manga..." />

      <View style={styles.flex} onLayout={onListLayout}>
        {isAlpha ? (
          <SectionList<Comic, { title: string }>
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
              barcodeScannerSettings={{ barcodeTypes: ['ean13'] }}
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
                Line up the barcode on the back of the comic/manga
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

            <CoverPicker uri={draft.coverImage} onPress={handleCoverPress} iconName="book-outline" />

            <TouchableOpacity
              onPress={handleScanPress}
              style={[styles.scanButton, { borderColor: theme.colors.accentReadable }]}
            >
              <AppText style={{ color: theme.colors.accentReadable, fontSize: 15 * theme.fontScale }}>📷 Scan barcode instead</AppText>
            </TouchableOpacity>

            <View style={styles.field}>
              <AppText style={[styles.label, { color: theme.colors.textSecondary, fontSize: 13 * theme.fontScale }]}>
                ISBN (optional - fills in the fields below automatically)
              </AppText>
              <TextInput
                value={draft.isbn}
                onChangeText={handleIsbnChange}
                onBlur={handleIsbnBlur}
                keyboardType="number-pad"
                placeholder="e.g. 978-1-4215-0146-6"
                placeholderTextColor={theme.colors.textMuted}
                style={[styles.input, INPUT_FONT, { color: theme.colors.text, borderColor: theme.colors.border }]}
              />
              {isbnStatus === 'valid' && (
                <AppText style={{ color: theme.colors.success, fontSize: 12 * theme.fontScale, marginTop: 4 }}>
                  ✓ Valid ISBN{isbnGroup ? ` · ${isbnGroup}` : ''}
                </AppText>
              )}
              {isbnStatus === 'invalid' && (
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

            <View style={[styles.field, { zIndex: 20 }]}>
              <AppText style={[styles.label, { color: theme.colors.textSecondary, fontSize: 13 * theme.fontScale }]}>
                Title * (type to search and auto-fill)
              </AppText>
              <TitleSearchInput
                value={draft.title}
                onChangeText={(text) => setDraft((d) => ({ ...d, title: text }))}
                search={(query) => searchBooksByTitle(query, GENRE_ALLOWLIST)}
                getKey={(r) => r.key}
                getLabel={(r) => r.title}
                getSubtitle={(r) => [r.author, r.isbn ? null : 'no ISBN on file'].filter(Boolean).join(' · ') || undefined}
                onSelect={(r) => {
                  setDraft((d) => ({
                    ...d,
                    title: r.title,
                    author: r.author || d.author,
                    genresText: r.genres.length > 0 ? r.genres.join(', ') : d.genresText,
                  }));
                  // Not every Google Books record has an ISBN on file -
                  // when it doesn't, the ISBN field just stays whatever
                  // it was, same as if this were entered manually.
                  if (r.isbn) applyIsbnDigits(r.isbn.replace(/[^0-9Xx]/g, ''));
                  if (r.coverUrl && activeItemId) {
                    downloadRemoteCover('comics', activeItemId, r.coverUrl).then((uri) => {
                      if (uri) setDraft((d) => ({ ...d, coverImage: uri }));
                    });
                  }
                }}
              />
            </View>

            <View style={styles.field}>
              <AppText style={[styles.label, { color: theme.colors.textSecondary, fontSize: 13 * theme.fontScale }]}>
                Genre(s) * (comma-separated, e.g. Shonen, Action)
              </AppText>
              <TextInput
                value={draft.genresText}
                onChangeText={(text) => setDraft((d) => ({ ...d, genresText: text }))}
                style={[styles.input, INPUT_FONT, { color: theme.colors.text, borderColor: theme.colors.border }]}
              />
            </View>

            <View style={styles.field}>
              <AppText style={[styles.label, { color: theme.colors.textSecondary, fontSize: 13 * theme.fontScale }]}>
                Author *
              </AppText>
              <TextInput
                value={draft.author}
                onChangeText={(text) => setDraft((d) => ({ ...d, author: text }))}
                style={[styles.input, INPUT_FONT, { color: theme.colors.text, borderColor: theme.colors.border }]}
              />
            </View>

            <View style={[styles.row, { marginTop: 8 }]}>
              <AppText style={{ color: theme.colors.text, fontSize: 15 * theme.fontScale, flex: 1, paddingRight: 12 }}>
                {REQUIRED_SWITCH_LABEL}
              </AppText>
              <Switch
                value={draft.read}
                onValueChange={(read) => setDraft((d) => ({ ...d, read }))}
                trackColor={{ true: theme.colors.accent, false: theme.colors.border }}
              />
            </View>

            {draft.read && (
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
  authorGenreRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
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
