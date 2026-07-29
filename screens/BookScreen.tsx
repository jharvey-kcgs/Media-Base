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
  Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import ISBN from 'isbn3';
import AppText, { FONT_FAMILY } from '../components/AppText';
import ScreenHeader from '../components/ScreenHeader';
import { useTheme } from '../lib/theme';
import { getBooks, addBook, updateBook, deleteBook } from '../lib/storage';
import { Book, BookSortField } from '../types/models';

const SORT_FIELDS: { field: BookSortField; label: string }[] = [
  { field: 'title', label: 'Title' },
  { field: 'genre', label: 'Genre' },
  { field: 'pageCount', label: 'Page count' },
  { field: 'author', label: 'Author' },
  { field: 'read', label: 'Read?' },
];

// Sort fields where an A-Z jump index actually makes sense.
const ALPHA_FIELDS: BookSortField[] = ['title', 'genre', 'author'];
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

// Broad classifications that should sort *after* more specific genre tags
// (e.g. a book auto-tagged "Fiction, Romance, Contemporary" should show as
// "Romance, Contemporary, Fiction" - Fiction on its own tells you nothing
// useful once you already have a more specific tag).
const GENERIC_GENRE_TERMS = new Set(['fiction', 'nonfiction', 'non-fiction']);

function titleCaseTag(tag: string): string {
  return tag
    .trim()
    .split(' ')
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

// Turns whatever a lookup API returned into a clean, ordered genre list.
// Google Books often returns one BISAC-style string per entry ("Fiction /
// Romance / Contemporary") - those get split apart. Open Library's subject
// list is long and noisy (bestseller-list mentions, character/setting
// keywords, foreign-language duplicates of the same tag) with the
// genuinely useful genre tags consistently appearing first for mainstream
// titles, so this caps to the first few raw entries rather than pulling in
// the whole list.
function normalizeGenres(rawCategories: string[] | undefined): string[] {
  if (!rawCategories || rawCategories.length === 0) return [];
  const flattened = rawCategories.flatMap((c) => c.split('/').map((part) => part.trim()).filter(Boolean));
  const capped = flattened.slice(0, 3);
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const tag of capped) {
    const cased = titleCaseTag(tag);
    const key = cased.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(cased);
    }
  }
  const specific = deduped.filter((t) => !GENERIC_GENRE_TERMS.has(t.toLowerCase()));
  const generic = deduped.filter((t) => GENERIC_GENRE_TERMS.has(t.toLowerCase()));
  return [...specific, ...generic];
}

function sortBooks(books: Book[], field: BookSortField): Book[] {
  const copy = [...books];
  copy.sort((a, b) => {
    if (field === 'pageCount') return (a.pageCount ?? 0) - (b.pageCount ?? 0);
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
  pageCount: string;
  isbn: string;
  read: boolean;
  rating: number;
  review: string;
}

const EMPTY_DRAFT: DraftState = {
  title: '',
  genresText: '',
  author: '',
  pageCount: '',
  isbn: '',
  read: false,
  rating: 0,
  review: '',
};

const INPUT_FONT = { fontFamily: FONT_FAMILY.body };
// Non-breaking space keeps the trailing "*" glued to the last word instead
// of wrapping onto its own line at larger text sizes.
const REQUIRED_SWITCH_LABEL = 'Have you read this book?\u00A0*';

export default function BookScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [books, setBooks] = useState<Book[]>([]);
  const [sortField, setSortField] = useState<BookSortField>('title');
  const [genreFilter, setGenreFilter] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [lookingUp, setLookingUp] = useState(false);
  const [isbnStatus, setIsbnStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [isbnGroup, setIsbnGroup] = useState('');
  const sectionListRef = useRef<SectionList<Book>>(null);

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

  const jumpToLetter = (letter: string) => {
    const index = sections.findIndex((s) => s.title >= letter);
    const target = index === -1 ? sections.length - 1 : index;
    if (target < 0 || !sections[target]) return;
    sectionListRef.current?.scrollToLocation({ sectionIndex: target, itemIndex: 0, animated: true, viewOffset: 0 });
  };

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
      pageCount: book.pageCount != null ? String(book.pageCount) : '',
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

  const openSortMenu = () => {
    Alert.alert(
      'Sort by',
      undefined,
      SORT_FIELDS.map((opt) => ({ text: opt.label, onPress: () => setSortField(opt.field) })).concat([
        { text: 'Cancel', style: 'cancel' as const, onPress: () => {} },
      ]),
    );
  };

  const openGenreFilterMenu = () => {
    if (allGenres.length === 0) {
      Alert.alert('No genres yet', 'Add a book with a genre first.');
      return;
    }
    Alert.alert(
      'Filter by genre',
      'A book shows up if it has this genre among its tags.',
      [{ text: 'All genres', onPress: () => setGenreFilter(null) }]
        .concat(allGenres.map((g) => ({ text: g, onPress: () => setGenreFilter(g) })))
        .concat([{ text: 'Cancel', style: 'cancel' as const, onPress: () => {} }]),
    );
  };

  const openDeleteMenu = () => {
    if (sorted.length === 0) {
      Alert.alert('No books yet', 'Add a book first.');
      return;
    }
    Alert.alert(
      'Delete which book?',
      undefined,
      sorted
        .slice(0, 10)
        .map((b) => ({ text: b.title, style: 'destructive' as const, onPress: () => confirmDelete(b.id, b.title) }))
        .concat([{ text: 'Cancel', style: 'cancel' as const, onPress: () => {} }]),
    );
  };

  const openMenu = () => {
    Alert.alert('Books', undefined, [
      { text: '+ Add entry', onPress: openAdd },
      { text: 'Filter by...', onPress: openSortMenu },
      { text: 'Filter by genre...', onPress: openGenreFilterMenu },
      { text: '- Delete entry', style: 'destructive', onPress: openDeleteMenu },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleScanPress = () => {
    // Scanning itself (camera + barcode lookup + the confirm/edit screen
    // it feeds into) isn't wired up yet - this is a placeholder so the
    // button exists and manual entry is never blocked on it landing.
    Alert.alert('Barcode scanning', "Scanning is coming in a future update - for now, try the ISBN field below, or enter the details by hand.");
  };

  // Fires on every keystroke in the ISBN field. Once there are enough
  // digits for a real ISBN (10 or 13), reformats with the *official*
  // hyphen positions via isbn3 (which bundles the real ISBN-agency range
  // data - hand-rolling this wasn't possible since hyphen placement isn't
  // a fixed pattern) and checks the checksum digit, so a typo shows up
  // immediately rather than only failing later at lookup/save time.
  const handleIsbnChange = (text: string) => {
    const digits = text.replace(/[^0-9Xx]/g, '');
    if (digits.length !== 10 && digits.length !== 13) {
      setIsbnStatus('idle');
      setDraft((d) => ({ ...d, isbn: digits }));
      return;
    }
    try {
      const parsed = ISBN.parse(digits);
      if (parsed?.isValid) {
        setIsbnStatus('valid');
        setIsbnGroup(parsed.groupname ?? '');
        setDraft((d) => ({ ...d, isbn: (parsed.isIsbn13 ? parsed.isbn13h : parsed.isbn10h) || digits }));
        return;
      }
      setIsbnStatus('invalid');
    } catch (err) {
      console.warn('Media Base: isbn3 parse failed', err);
      setIsbnStatus('idle');
    }
    setDraft((d) => ({ ...d, isbn: digits }));
  };

  // Fires when the (optional) ISBN field loses focus, if it looks like a
  // real ISBN. Tries Open Library first, then Google Books as a fallback.
  // Open Library is the primary source deliberately: verified via a real
  // lookup that it has clean, complete data for a real ISBN that Google
  // Books came back empty for. Open Library's docs also ask every caller
  // to send a descriptive User-Agent - without one, requests can be
  // silently rate-limited/blocked, which is exactly the kind of failure
  // that looks identical to "not found" unless it's logged separately.
  // NOTE: not network-testable from the sandbox this was written in - if
  // this still comes back empty for an ISBN you know is real, check the
  // Metro/dev console for the "Media Base:" warnings this logs; that'll
  // show whether it's an API error/block versus neither database
  // actually having that specific edition indexed.
  const OPEN_LIBRARY_USER_AGENT = 'MediaBase/1.0 (contact: JHarvey.appdeveloper@gmail.com)';

  const lookupOpenLibrary = async (digits: string) => {
    const res = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${digits}&format=json&jscmd=data`, {
      headers: { 'User-Agent': OPEN_LIBRARY_USER_AGENT },
    });
    if (!res.ok) {
      console.warn('Media Base: Open Library returned', res.status);
      return null;
    }
    const json = await res.json();
    const info = json?.[`ISBN:${digits}`];
    if (!info) return null; // genuinely not indexed - not an error worth logging
    return {
      title: info.title as string | undefined,
      authors: Array.isArray(info.authors) ? info.authors.map((a: any) => a.name).filter(Boolean) : undefined,
      categories: Array.isArray(info.subjects) ? info.subjects.map((s: any) => s.name).filter(Boolean) : undefined,
      pageCount: info.number_of_pages as number | undefined,
    };
  };

  const lookupGoogleBooks = async (digits: string) => {
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${digits}`);
    if (!res.ok) {
      console.warn('Media Base: Google Books returned', res.status);
      return null;
    }
    const json = await res.json();
    if (json?.error) {
      console.warn('Media Base: Google Books API error', json.error);
      return null;
    }
    return json?.items?.[0]?.volumeInfo ?? null;
  };

  const handleIsbnBlur = async () => {
    const digits = draft.isbn.replace(/[^0-9Xx]/g, '');
    if (digits.length !== 10 && digits.length !== 13) return;

    setLookingUp(true);
    try {
      let info = await lookupOpenLibrary(digits).catch((err) => {
        console.warn('Media Base: Open Library lookup threw', err);
        return null;
      });
      if (!info) {
        info = await lookupGoogleBooks(digits).catch((err) => {
          console.warn('Media Base: Google Books lookup threw', err);
          return null;
        });
      }
      if (!info) {
        Alert.alert(
          "Couldn't find that ISBN",
          'No match in either book database checked - you can still fill in the details by hand.',
        );
        return;
      }
      const genres = normalizeGenres(info.categories);
      setDraft((d) => ({
        ...d,
        title: info.title || d.title,
        author: (info.authors && info.authors[0]) || d.author,
        genresText: genres.length > 0 ? genres.join(', ') : d.genresText,
        pageCount: info.pageCount ? String(info.pageCount) : d.pageCount,
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

    if (!draft.title.trim() || genres.length === 0 || !draft.author.trim() || !draft.pageCount.trim()) {
      Alert.alert('Missing info', 'Title, at least one genre, author, and page count are all required.');
      return;
    }
    const pageCount = parseInt(draft.pageCount, 10);
    if (Number.isNaN(pageCount)) {
      Alert.alert('Invalid page count', 'Page count needs to be a number.');
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
      pageCount,
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

  const renderCard = (item: Book) => (
    <TouchableOpacity
      onPress={() => openEdit(item)}
      style={[styles.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}
    >
      <AppText variant="header" style={{ color: theme.colors.text, fontSize: 16 * theme.fontScale }}>
        {item.title}
      </AppText>
      <AppText style={{ color: theme.colors.textSecondary, fontSize: 13 * theme.fontScale, marginTop: 2 }}>
        {item.author} · {item.genres.join(', ')} · {item.pageCount} pages
      </AppText>
      <AppText style={{ color: item.read ? theme.colors.success : theme.colors.textMuted, fontSize: 13 * theme.fontScale, marginTop: 4 }}>
        {item.read ? `Read${item.rating ? ` · ${item.rating}★` : ''}` : 'Not read yet'}
      </AppText>
    </TouchableOpacity>
  );

  const emptyState = (
    <AppText style={{ color: theme.colors.textMuted, fontSize: 15 * theme.fontScale, padding: 20 }}>
      {genreFilter ? `No books tagged "${genreFilter}" yet.` : 'No books yet. Tap ••• to add your first one.'}
    </AppText>
  );

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.colors.background }]} edges={['left', 'right', 'bottom']}>
      <ScreenHeader
        title="Books"
        onBack={() => navigation.goBack()}
        backLabel="Home"
        right={
          <TouchableOpacity onPress={openMenu} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="ellipsis-horizontal" size={22} color={theme.colors.accentReadable} />
          </TouchableOpacity>
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

      <View style={styles.flex}>
        {isAlpha ? (
          <SectionList
            ref={sectionListRef}
            sections={sections}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[styles.list, { paddingRight: 20 + 22 }]}
            ListEmptyComponent={emptyState}
            renderSectionHeader={({ section }) => (
              <AppText style={[styles.sectionHeader, { color: theme.colors.textMuted, fontSize: 12 * theme.fontScale, backgroundColor: theme.colors.background }]}>
                {section.title}
              </AppText>
            )}
            renderItem={({ item }) => renderCard(item)}
            onScrollToIndexFailed={() => {}}
          />
        ) : (
          <FlatList
            data={sorted}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={emptyState}
            renderItem={({ item }) => renderCard(item)}
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

          <ScrollView contentContainerStyle={styles.form}>
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

            <View style={styles.field}>
              <AppText style={[styles.label, { color: theme.colors.textSecondary, fontSize: 13 * theme.fontScale }]}>
                Page count *
              </AppText>
              <TextInput
                value={draft.pageCount}
                onChangeText={(text) => setDraft((d) => ({ ...d, pageCount: text }))}
                keyboardType="number-pad"
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
});
