// screens/BookScreen.tsx

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  TouchableOpacity,
  FlatList,
  TextInput,
  StyleSheet,
  Switch,
  Alert,
  Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import AppText, { FONT_FAMILY } from '../components/AppText';
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

function sortBooks(books: Book[], field: BookSortField): Book[] {
  const copy = [...books];
  copy.sort((a, b) => {
    if (field === 'pageCount') return (a.pageCount ?? 0) - (b.pageCount ?? 0);
    if (field === 'read') return Number(a.read) - Number(b.read);
    return String(a[field]).localeCompare(String(b[field]));
  });
  return copy;
}

interface DraftState {
  title: string;
  genre: string;
  author: string;
  pageCount: string;
  read: boolean;
  rating: number;
  review: string;
}

const EMPTY_DRAFT: DraftState = { title: '', genre: '', author: '', pageCount: '', read: false, rating: 0, review: '' };

const INPUT_FONT = { fontFamily: FONT_FAMILY.body };

export default function BookScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [books, setBooks] = useState<Book[]>([]);
  const [sortField, setSortField] = useState<BookSortField>('title');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);

  const load = useCallback(async () => {
    setBooks(await getBooks());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const sorted = useMemo(() => sortBooks(books, sortField), [books, sortField]);

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
      read: book.read,
      rating: book.rating ?? 0,
      review: book.review,
    });
    setModalVisible(true);
  };

  const handleScanPress = () => {
    // Scanning itself (camera + barcode lookup + the confirm/edit screen
    // it feeds into) isn't wired up yet - this is a placeholder so the
    // button exists and manual entry is never blocked on it landing.
    Alert.alert('Barcode scanning', "Scanning is coming in a future update - for now, just enter the details below.");
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

    const payload = {
      title: draft.title.trim(),
      genre: draft.genre.trim(),
      author: draft.author.trim(),
      pageCount,
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

  const handleDelete = (id: string) => {
    Alert.alert('Delete this book?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
          await deleteBook(id);
          load();
        } },
    ]);
  };

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <AppText style={{ color: theme.colors.accent, fontSize: 15 * theme.fontScale }}>‹ Home</AppText>
        </TouchableOpacity>
        <AppText variant="header" style={[styles.title, { color: theme.colors.text, fontSize: 20 * theme.fontScale }]}>
          Books
        </AppText>
        <TouchableOpacity onPress={openAdd}>
          <AppText style={{ color: theme.colors.accent, fontSize: 15 * theme.fontScale }}>+ Add</AppText>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sortRow} contentContainerStyle={{ paddingHorizontal: 20 }}>
        {SORT_FIELDS.map((opt) => (
          <TouchableOpacity
            key={opt.field}
            onPress={() => setSortField(opt.field)}
            style={[
              styles.sortChip,
              {
                backgroundColor: sortField === opt.field ? theme.colors.accent : theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <AppText
              style={{
                color: sortField === opt.field ? theme.colors.accentText : theme.colors.text,
                fontSize: 13 * theme.fontScale,
              }}
            >
              {opt.label}
            </AppText>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={sorted}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <AppText style={{ color: theme.colors.textMuted, fontSize: 15 * theme.fontScale, padding: 20 }}>
            No books yet. Tap + Add to track your first one.
          </AppText>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => openEdit(item)}
            onLongPress={() => handleDelete(item.id)}
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
        )}
      />

      <Modal visible={modalVisible} animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <SafeAreaView style={[styles.flex, { backgroundColor: theme.colors.background }]}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <AppText style={{ color: theme.colors.accent, fontSize: 15 * theme.fontScale }}>Cancel</AppText>
            </TouchableOpacity>
            <AppText variant="header" style={[styles.title, { color: theme.colors.text, fontSize: 18 * theme.fontScale }]}>
              {editingId ? 'Edit book' : 'Add book'}
            </AppText>
            <TouchableOpacity onPress={handleSave}>
              <AppText style={{ color: theme.colors.accent, fontSize: 15 * theme.fontScale }}>Save</AppText>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.form}>
            <TouchableOpacity
              onPress={handleScanPress}
              style={[styles.scanButton, { borderColor: theme.colors.accent }]}
            >
              <AppText style={{ color: theme.colors.accent, fontSize: 15 * theme.fontScale }}>📷 Scan barcode instead</AppText>
            </TouchableOpacity>

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
              <AppText style={{ color: theme.colors.text, fontSize: 15 * theme.fontScale }}>Read this? *</AppText>
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
                      <AppText style={{ fontSize: 28, color: n <= draft.rating ? theme.colors.accent : theme.colors.border }}>
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
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  title: {},
  sortRow: { flexGrow: 0, marginBottom: 8 },
  sortChip: { borderWidth: 1, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12, marginRight: 8 },
  list: { padding: 20, paddingTop: 0 },
  card: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 10 },
  form: { padding: 20 },
  field: { marginBottom: 14 },
  label: { marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 8, padding: 10 },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  starRow: { flexDirection: 'row', gap: 8 },
  scanButton: { borderWidth: 1, borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginBottom: 18 },
});
