// screens/BookScreen.tsx
//
// This is the reference pattern for every future category screen
// (Comics/Manga, Movies, TV Shows, etc.): a clean list with all actions
// tucked behind a "•••" menu (Add / Filter by sort field / Filter by
// genre / Delete) rather than visible buttons/chips, tap-to-edit on any
// row (with Delete living inside that edit screen too), a same-title
// duplicate guard on save, multi-genre entries (a book can carry more
// than one genre tag, and a genre filter matches if any tag fits), and -
// for alphabetical sort fields - a right-edge A-Z index for jumping
// around a long list.

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
import { useTheme } from '../lib/theme';
import { getBooks, addBook, updateBook, deleteBook, deleteBooks } from '../lib/storage';
import { runIsbnLookup as runIsbnLookupApi } from '../lib/isbnLookup';
import { useAlphabetScroll } from '../lib/useAlphabetScroll';
import { Book, BookSortField } from '../types/models';

// Genre isn't listed here anymore - "Filter by genre..." (its own menu
// item, below) is the dedicated place to interact with genre, so having
// it in this sort-field picker too was redundant/confusing.
const SORT_FIELDS: { field: BookSortField; label: string }[] = [
  { field: 'title', label: 'Title' },
  { field: 'author', label: 'Author' },
  { field: 'read', label: 'Read?' },
];

// Sort fields where an A-Z jump index actually makes sense.
const ALPHA_FIELDS: BookSortField[] = ['title', 'author'];
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

// The ONLY genres the ISBN lookup is allowed to auto-fill - anything a
// lookup returns that isn't on this list gets dropped entirely, no matter
// how it's phrased. See lib/isbnLookup.ts for how this gets applied
// (shared with Comics/Manga and any future ISBN-based category, each with
// its own allowlist here).
//
// Grounded in BISAC (Book Industry Standards and Communications) - the
// real classification system the US book trade actually uses, and what
// Google Books' own `categories` field is drawn from - rather than an
// improvised list. Verified against BISG's official 2025 top-level
// heading list (bisg.org/complete-bisac-subject-headings-list) directly.
// A few real headings are deliberately left out or shortened here: full
// compound BISAC headings like "Business & Economics" rarely appear
// verbatim in Open Library/Google Books subject data, so this uses the
// shorter core term each concept is actually likely to show up as
// ("Economics" rather than "Business & Economics"). A couple of common
// single words that are real BISAC categories (GAMES & ACTIVITIES,
// HOUSE & HOME) were left out specifically because "Games" or "Home"
// alone risk matching unrelated proper-noun tags (e.g. "The Hunger
// Games" as a thematic keyword) - a real precision/recall tradeoff,
// flagged rather than silently decided.
const GENRE_ALLOWLIST = [
  'Fiction', 'Nonfiction', 'Romance', 'Mystery', 'Thriller', 'Suspense',
  'Science Fiction', 'Fantasy', 'Horror', 'Historical Fiction', 'Contemporary',
  'Literary Fiction', 'Young Adult', 'New Adult', "Children's", 'Classics',
  'Adventure', 'Crime', 'Dystopian', 'Post-Apocalyptic', 'Paranormal',
  'Magical Realism', 'Coming Of Age', 'LGBTQ', 'Biography', 'Memoir',
  'Self-Help', 'Poetry', 'Humor', 'Satire', 'Anthology', 'Graphic Novel',
  'Comics', 'Short Stories', 'Essays', 'True Crime', 'Western', 'War',
  'Drama', 'Philosophy', 'Psychology', 'Sociology', 'Religion',
  'Spirituality', 'History', 'Science', 'Nature', 'Business',
  'Personal Finance', 'Parenting', 'Health', 'Cooking', 'Travel', 'Art',
  'Music', 'Sports', 'Politics', 'Technology',
  // Added after confirming against BISG's real 2025 BISAC list - mostly
  // nonfiction top-level categories that had zero coverage before.
  'Antiques', 'Architecture', 'Bibles', 'Economics', 'Computers', 'Crafts',
  'Design', 'Education', 'Family', 'Relationships', 'Gardening', 'Fitness',
  'Language', 'Law', 'Literary Criticism', 'Mathematics', 'Medical',
  'Performing Arts', 'Pets', 'Photography', 'Reference', 'Study Aids',
  'Transportation', 'Juvenile', 'Engineering', 'Espionage', 'Occult',
  'Mythology', 'Fairy Tales', 'Cyberpunk', 'Steampunk', 'Erotica',
];

function sortBooks(books: Book[], field: BookSortField): Book[] {
  const copy = [...books];
  copy.sort((a, b) => {
    if (field === 'read') return Number(a.read) - Number(b.read);
    if (field === 'genre') return (a.genres[0] ?? '').localeCompare(b.genres[0] ?? '');
    return String(a[field]).localeCompare(String(b[field]));
  });
  return copy;
}

// Genre grouping/sorting uses genres[0] ("primary" tag) as the key -
// Title/Author still read directly off the book.
function groupByFirstLetter(sorted: Book[], field: 'title' | 'genre' | 'author'): { title: string; data: Book[] }[] {
  const getKey = (item: Book) => (field === 'genre' ? item.genres[0] ?? '' : String(item[field] ?? ''));
  const groups: Record<string, Book[]> = {};
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
  read: boolean;
  rating: number;
  review: string;
}

const EMPTY_DRAFT: DraftState = {
  title: '',
  genresText: '',
  author: '',
  isbn: '',
  read: false,
  rating: 0,
  review: '',
};

const INPUT_FONT = { fontFamily: FONT_FAMILY.body };
// Non-breaking space keeps the trailing "*" glued to the last word instead
// of wrapping onto its own line at larger text sizes.
const REQUIRED_SWITCH_LABEL = 'Have you read this book?\u00A0*';

// Memoized row component, defined at module scope (never recreated) - this
// is the actual fix for the "large list slow to update" warning and
// sluggish scrolling/filtering at 65+ books. The previous version defined
// row rendering as a plain function inside BookScreen's body, recreated on
// every render; even though FlatList/SectionList's data itself was
// memoized, a fresh renderItem function identity on every parent render
// (from any state change anywhere on the screen, including typing in a
// filter) meant every visible row got fully re-rendered every time, not
// just the ones that actually changed. Wrapping the row itself in
// React.memo means a row only re-renders when ITS OWN props (book, selected,
// selectionMode) actually change - unaffected rows are skipped even if the
// list's outer renderItem callback gets a new identity.
const BookCard = React.memo(function BookCard({
  book,
  selected,
  selectionMode,
  onPress,
}: {
  book: Book;
  selected: boolean;
  selectionMode: boolean;
  onPress: (book: Book) => void;
}) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      onPress={() => onPress(book)}
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
          <AppText variant="header" style={{ color: theme.colors.text, fontSize: 16 * theme.fontScale }}>
            {book.title}
          </AppText>
          <AppText style={{ color: theme.colors.textSecondary, fontSize: 13 * theme.fontScale, marginTop: 2 }}>
            {book.author} · {book.genres.join(', ')}
          </AppText>
          <AppText style={{ color: book.read ? theme.colors.success : theme.colors.textMuted, fontSize: 13 * theme.fontScale, marginTop: 4 }}>
            {book.read ? `Read${book.rating ? ` · ${book.rating}★` : ''}` : 'Not read yet'}
          </AppText>
        </View>
      </View>
    </TouchableOpacity>
  );
});

export default function BookScreen({ navigation }: any) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [books, setBooks] = useState<Book[]>([]);
  const [sortField, setSortField] = useState<BookSortField>('title');
  const [genreFilter, setGenreFilter] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [lookingUp, setLookingUp] = useState(false);
  const [isbnStatus, setIsbnStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [isbnGroup, setIsbnGroup] = useState('');
  const [scannerVisible, setScannerVisible] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const scanLockRef = useRef(false);

  const load = useCallback(async () => {
    setBooks(await getBooks());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const allGenres = useMemo(() => {
    const set = new Set<string>();
    books.forEach((b) => b.genres.forEach((g) => set.add(g)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [books]);

  const filteredBooks = useMemo(
    () =>
      genreFilter ? books.filter((b) => b.genres.some((g) => g.toLowerCase() === genreFilter.toLowerCase())) : books,
    [books, genreFilter],
  );

  const sorted = useMemo(() => sortBooks(filteredBooks, sortField), [filteredBooks, sortField]);
  const sortLabel = SORT_FIELDS.find((f) => f.field === sortField)?.label ?? 'Title';
  const isAlpha = ALPHA_FIELDS.includes(sortField);
  const sections = useMemo(
    () => (isAlpha ? groupByFirstLetter(sorted, sortField as 'title' | 'genre' | 'author') : []),
    [isAlpha, sorted, sortField],
  );

  // A-Z index scroll handling (estimate + overshoot-safe clamping, plus the
  // fixes for two real React Native scrollToLocation bugs along the way)
  // now lives in a shared hook - see lib/useAlphabetScroll.ts for the full
  // history of why it works this way.
  const { listRef: sectionListRef, onLayout: onListLayout, onContentSizeChange, jumpToLetter } = useAlphabetScroll(
    sections,
    theme.fontScale,
  );

  const openAdd = () => {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setIsbnStatus('idle');
    setModalVisible(true);
  };

  const openEdit = (book: Book) => {
    setEditingId(book.id);
    setDraft({
      title: book.title,
      genresText: book.genres.join(', '),
      author: book.author,
      isbn: book.isbn ?? '',
      read: book.read,
      rating: book.rating ?? 0,
      review: book.review,
    });
    const digits = (book.isbn ?? '').replace(/[^0-9Xx]/g, '');
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
          await deleteBook(id);
          load();
        },
      },
    ]);
  };

  const enterSelectionMode = () => {
    if (sorted.length === 0) {
      Alert.alert('No books yet', 'Add a book first.');
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
    Alert.alert(`Delete ${count} ${count === 1 ? 'book' : 'books'}?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteBooks(Array.from(selectedIds));
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
      Alert.alert('No genres yet', 'Add a book with a genre first.');
      return;
    }
    const buttons: AlertButton[] = [
      { text: 'All genres', onPress: () => setGenreFilter(null) },
      ...allGenres.map((g) => ({ text: g, onPress: () => setGenreFilter(g) })),
      { text: 'Cancel', style: 'cancel' },
    ];
    Alert.alert('Filter by genre', 'A book shows up if it has this genre among its tags.', buttons);
  };

  const openMenu = () => {
    Alert.alert('Books', undefined, [
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
  // Returns whether the result was a fully-valid ISBN, so callers (the
  // scanner specifically) know whether it's safe to fire the lookup
  // immediately rather than waiting for onBlur, which never happens when
  // a value arrives from a scan instead of typing.
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

  // Fires on every keystroke in the ISBN field. Once there are enough
  // digits for a real ISBN (10 or 13), reformats with the *official*
  // hyphen positions via isbn3 (which bundles the real ISBN-agency range
  // data - hand-rolling this wasn't possible since hyphen placement isn't
  // a fixed pattern) and checks the checksum digit, so a typo shows up
  // immediately rather than only failing later at lookup/save time.
  const handleIsbnChange = (text: string) => {
    applyIsbnDigits(text.replace(/[^0-9Xx]/g, ''));
  };

  // Fires once a barcode is in view long enough to decode. Locked with a
  // ref (not state, which wouldn't update fast enough) so a single
  // barcode sitting in frame doesn't fire this dozens of times per
  // second - onBarcodeScanned keeps firing continuously while a code is
  // visible, unlike a one-shot "take photo" action. Restricted to EAN-13
  // starting 978/979 (the actual Bookland ISBN prefixes) so scanning some
  // unrelated barcode (a snack wrapper, a shipping label) doesn't get
  // mistaken for a book and silently fill in wrong data.
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

  // ISBN lookup itself (Open Library primary, Google Books fallback, Open
  // Library search-index as a third genre-only fallback) now lives in
  // lib/isbnLookup.ts, shared with Comics/Manga and any future ISBN-based
  // category - see runIsbnLookup below for the screen-specific wrapper.

  const handleIsbnBlur = () => {
    const digits = draft.isbn.replace(/[^0-9Xx]/g, '');
    if (digits.length !== 10 && digits.length !== 13) return;
    runIsbnLookup(digits);
  };

  // Thin wrapper around the shared lib/isbnLookup.runIsbnLookup: this is
  // just the screen-specific part (loading state, populating the draft,
  // deciding which alert to show), all the actual network/merge/fallback
  // logic lives in the shared module now so Comics/Manga (and any future
  // ISBN-based category) get the same behavior for free.
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
    // insensitive) already tracked, excluding the item currently being edited.
    const isDuplicate = books.some(
      (b) => b.id !== editingId && b.title.trim().toLowerCase() === draft.title.trim().toLowerCase(),
    );
    if (isDuplicate) {
      Alert.alert('Already tracking this book', 'A book with this title is already in your list.');
      return;
    }

    const payload = {
      title: draft.title.trim(),
      genres,
      author: draft.author.trim(),
      isbn: draft.isbn.trim(),
      read: draft.read,
      rating: draft.read ? draft.rating || null : null,
      review: draft.read ? draft.review : '',
    };

    if (editingId) {
      await updateBook(editingId, payload);
    } else {
      await addBook(payload);
    }
    setModalVisible(false);
    load();
  };

  const handleCardPress = useCallback(
    (book: Book) => {
      if (selectionMode) {
        toggleSelected(book.id);
      } else {
        openEdit(book);
      }
    },
    // Deliberately just selectionMode - not selectedIds, books, or anything
    // that changes during routine scrolling/sorting/filtering, since any of
    // those would give renderItem (below) a new identity on every such
    // interaction and defeat BookCard's memoization for no reason. Taking
    // the full `book` object (rather than an id to look up in `books`)
    // is what makes leaving `books` out of this list safe.
    [selectionMode],
  );

  const renderItem = useCallback(
    ({ item }: { item: Book }) => (
      <BookCard book={item} selected={selectedIds.has(item.id)} selectionMode={selectionMode} onPress={handleCardPress} />
    ),
    [selectedIds, selectionMode, handleCardPress],
  );

  // Stable for the same reason renderItem is: SectionList keeps the current
  // section header "stuck" at the top while you scroll through that
  // section's rows (stickySectionHeadersEnabled defaults to true) - an
  // inline version of this was getting a new identity on every render,
  // which meant that sticky header was re-rendering continuously for the
  // entire time you scrolled through a section, not just once. For a large
  // section (75 books, most starting with "T") that's a much longer stretch
  // of continuous unnecessary re-rendering than for a small one, which
  // lines up with scrolling specifically feeling jumpy/resistant there.
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
      {genreFilter ? `No books tagged "${genreFilter}" yet.` : 'No books yet. Tap ••• to add your first one.'}
    </AppText>
  );

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.colors.background }]} edges={['left', 'right', 'bottom']}>
      <ScreenHeader
        title={selectionMode ? `${selectedIds.size} selected` : 'Books'}
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
          <SectionList<Book, { title: string }>
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
          <View style={styles.azBar} pointerEvents="box-none">
            {ALPHABET.map((letter) => (
              <TouchableOpacity key={letter} onPress={() => jumpToLetter(letter)} hitSlop={{ top: 1, bottom: 1, left: 6, right: 6 }}>
                <AppText style={{ color: theme.colors.accentReadable, fontSize: 10 * theme.fontScale }}>{letter}</AppText>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <Modal visible={modalVisible} animationType="slide" onRequestClose={() => setModalVisible(false)}>
        {scannerVisible ? (
          // Rendered inside the SAME Modal as the form rather than as a second,
          // separate <Modal> - iOS doesn't reliably present two independent
          // modals at once, which was why this used to only open once you'd
          // already dismissed the Add/Edit form. Switching content within one
          // modal avoids that entirely.
          <View style={styles.scannerRoot}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['ean13'] }}
              onBarcodeScanned={handleBarcodeScanned}
            />
            {/* Cancel's position uses insets.top directly rather than a SafeAreaView -
                same fix as ScreenHeader: SafeAreaView's automatic inset isn't reliable
                inside a Modal on iOS, which was pinning this button up under the
                status bar/notch where it couldn't be tapped. */}
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
                Line up the barcode on the back of the book
              </AppText>
            </View>
          </View>
        ) : (
          <SafeAreaView style={[styles.flex, { backgroundColor: theme.colors.background }]} edges={['left', 'right', 'bottom']}>
          <ScreenHeader
            title={editingId ? 'Edit Book' : 'Add Book'}
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
                ISBN (optional - fills in the fields below automatically)
              </AppText>
              <TextInput
                value={draft.isbn}
                onChangeText={handleIsbnChange}
                onBlur={handleIsbnBlur}
                keyboardType="number-pad"
                placeholder="e.g. 978-1-4767-5318-8"
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
                Genre(s) * (comma-separated, e.g. Romance, Contemporary)
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
                  confirmDelete(editingId, draft.title || 'this book');
                }}
                style={[styles.deleteButton, { borderColor: theme.colors.danger }]}
              >
                <AppText style={{ color: theme.colors.danger, fontSize: 15 * theme.fontScale }}>Delete book</AppText>
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
