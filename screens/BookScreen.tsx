// screens/BookScreen.tsx
//
// This is the reference pattern for every future category screen
// (Comics/Manga, Movies, TV Shows, etc.): a clean list with all actions
// tucked behind a "•••" menu (Add / Filter by / Delete) rather than
// visible buttons/chips, tap-to-edit on any row (with Delete living
// inside that edit screen too), a same-title duplicate guard on save,
// and - for alphabetical sort fields - a right-edge A-Z index for
// jumping around a long list.

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

function sortBooks(books: Book[], field: BookSortField): Book[] {
  const copy = [...books];
  copy.sort((a, b) => {
    if (field === 'pageCount') return (a.pageCount ?? 0) - (b.pageCount ?? 0);
    if (field === 'read') return Number(a.read) - Number(b.read);
    return String(a[field]).localeCompare(String(b[field]));
  });
  return copy;
}

function groupByFirstLetter(sorted: Book[], field: 'title' | 'genre' | 'author'): { title: string; data: Book[] }[] {
  const groups: Record<string, Book[]> = {};
  for (const item of sorted) {
    const raw = String(item[field] ?? '').trim();
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
  genre: string;
  author: string;
  pageCount: string;
  isbn: string;
  read: boolean;
  rating: number;
  review: string;
}

const EMPTY_DRAFT: DraftState = {
  title: '',
  genre: '',
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
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [lookingUp, setLookingUp] = useState(false);
  const sectionListRef = useRef<SectionList<Book>>(null);

  const load = useCallback(async () => {
    setBooks(await getBooks());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const sorted = useMemo(() => sortBooks(books, sortField), [books, sortField]);
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
    setModalVisible(true);
  };

  const openEdit = (book: Book) => {
    setEditingId(book.id);
    setDraft({
      title: book.title,
      genre: book.genre,
      author: book.author,
      pageCount: book.pageCount != null ? String(book.pageCount) : '',
      isbn: book.isbn ?? '',
      read: book.read,
      rating: book.rating ?? 0,
      review: book.review,
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
          await deleteBook(id);
          load();
        },
      },
    ]);
  };

  const openFilterMenu = () => {
    Alert.alert(
      'Filter by',
      undefined,
      SORT_FIELDS.map((opt) => ({ text: opt.label, onPress: () => setSortField(opt.field) })).concat([
        { text: 'Cancel', style: 'cancel' as const, onPress: () => {} },
      ]),
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
      { text: 'Filter by...', onPress: openFilterMenu },
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

  // Fires when the (optional) ISBN field loses focus, if it looks like a
  // real ISBN. Uses the Google Books API - free, no key required for a
  // lookup like this. NOTE: not network-testable from the sandbox this
  // was written in: worth confirming on-device that the response shape
  // (items[0].volumeInfo.{title,authors,categories,pageCount}) still
  // matches, since Google could change it without notice.
  const handleIsbnBlur = async () => {
    const digits = draft.isbn.replace(/[^0-9Xx]/g, '');
    if (digits.length !== 10 && digits.length !== 13) return;

    setLookingUp(true);
    try {
      const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${digits}`);
      const json = await res.json();
      const info = json?.items?.[0]?.volumeInfo;
      if (!info) {
        Alert.alert("Couldn't find that ISBN", 'No match in the book database - you can still fill in the details by hand.');
        return;
      }
      setDraft((d) => ({
        ...d,
        title: info.title || d.title,
        author: (info.authors && info.authors[0]) || d.author,
        genre: (info.categories && info.categories[0]) || d.genre,
        pageCount: info.pageCount ? String(info.pageCount) : d.pageCount,
      }));
    } catch {
      Alert.alert('Lookup failed', 'Could not reach the book database - check your connection, or fill in the details by hand.');
    } finally {
      setLookingUp(false);
    }
  };

  const handleSave = async () => {
    if (!draft.title.trim() || !draft.genre.trim() || !draft.author.trim() || !draft.pageCount.trim()) {
      Alert.alert('Missing info', 'Title, genre, author, and page count are all required.');
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
      genre: draft.genre.trim(),
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
        {item.author} · {item.genre} · {item.pageCount} pages
      </AppText>
      <AppText style={{ color: item.read ? theme.colors.success : theme.colors.textMuted, fontSize: 13 * theme.fontScale, marginTop: 4 }}>
        {item.read ? `Read${item.rating ? ` · ${item.rating}★` : ''}` : 'Not read yet'}
      </AppText>
    </TouchableOpacity>
  );

  const emptyState = (
    <AppText style={{ color: theme.colors.textMuted, fontSize: 15 * theme.fontScale, padding: 20 }}>
      No books yet. Tap ••• to add your first one.
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

      <AppText style={[styles.sortLabel, { color: theme.colors.textMuted, fontSize: 12 * theme.fontScale }]}>
        Sorted by {sortLabel}
      </AppText>

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
                onChangeText={(text) => setDraft((d) => ({ ...d, isbn: text }))}
                onBlur={handleIsbnBlur}
                keyboardType="number-pad"
                placeholder="e.g. 9781398710390"
                placeholderTextColor={theme.colors.textMuted}
                style={[styles.input, INPUT_FONT, { color: theme.colors.text, borderColor: theme.colors.border }]}
              />
              {lookingUp && (
                <AppText style={{ color: theme.colors.textMuted, fontSize: 12 * theme.fontScale, marginTop: 4 }}>
                  Looking up...
                </AppText>
              )}
            </View>

            {(['title', 'genre', 'author'] as const).map((field) => (
              <View key={field} style={styles.field}>
                <AppText style={[styles.label, { color: theme.colors.textSecondary, fontSize: 13 * theme.fontScale }]}>
                  {field[0].toUpperCase() + field.slice(1)} *
                </AppText>
                <TextInput
                  value={draft[field]}
                  onChangeText={(text) => setDraft((d) => ({ ...d, [field]: text }))}
                  style={[styles.input, INPUT_FONT, { color: theme.colors.text, borderColor: theme.colors.border }]}
                />
              </View>
            ))}

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
  sortLabel: { paddingHorizontal: 20, marginBottom: 8 },
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
