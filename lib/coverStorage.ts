// lib/coverStorage.ts
//
// One storage system for cover images, regardless of where they came
// from - a photo taken with the camera, one picked from the photo
// library, or one auto-fetched from Open Library/Google Books/TMDb all
// end up saved the exact same way: resized, compressed, and written to
// this app's own private file storage. Nothing is ever saved to the
// device's Photos app (the camera call below explicitly disables that),
// and nothing is ever saved anywhere outside this app's own sandboxed
// folder - no other app, and no Files app browsing, can see these.
//
// Every item's cover lives at a predictable path derived from its own
// id, so once a Book/Comic/Movie record has an id, its cover (if any)
// can always be found without needing to store a separate lookup table.
//
// NOTE: not network-tested from the sandbox this was written in -
// expo-image-picker's exact API shape (the mediaTypes option in
// particular) has changed across SDK versions, so if picking/taking a
// photo throws or behaves unexpectedly, that's the first surface worth
// checking against whatever version actually installs.

import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

const COVERS_DIR = `${FileSystem.documentDirectory}covers/`;

function categoryDir(category: string): string {
  return `${COVERS_DIR}${category}/`;
}

function coverPath(category: string, id: string): string {
  return `${categoryDir(category)}${id}.jpg`;
}

async function ensureDirExists(dir: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
}

/** The local file URI an item's cover would live at, whether or not
 * anything has actually been saved there yet - callers check the
 * resulting <Image> for a load failure (nothing saved yet) and fall
 * back to a placeholder, rather than needing a separate existence check
 * first. */
export function getCoverUri(category: string, id: string): string {
  return coverPath(category, id);
}

// Resizes down to a sensible width and compresses before writing to the
// permanent per-item path - a photo straight from a phone camera can be
// several megabytes, and a cover thumbnail doesn't need anywhere near
// that. Shared by every path below (manual and auto-fetched alike), so
// storage footprint stays reasonable regardless of source.
async function saveResizedCover(category: string, id: string, sourceUri: string): Promise<string> {
  await ensureDirExists(categoryDir(category));
  const manipulated = await ImageManipulator.manipulateAsync(
    sourceUri,
    [{ resize: { width: 400 } }], // covers are viewed small (list thumbnail) or medium (edit screen) - never need to be huge
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
  );
  const dest = coverPath(category, id);
  // Overwrite semantics: copyAsync doesn't require the destination to
  // not exist, so re-adding/replacing a cover for the same id just works.
  await FileSystem.copyAsync({ from: manipulated.uri, to: dest });
  return dest;
}

/** Opens the photo library picker. Returns the new cover's local URI, or
 * null if the person cancelled or denied permission - callers don't need
 * to distinguish those cases, both just mean "nothing changed." */
export async function pickCoverFromLibrary(category: string, id: string): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.8,
    allowsEditing: true,
    aspect: [2, 3], // matches typical book/movie cover proportions
  });
  if (result.canceled || !result.assets?.[0]?.uri) return null;
  return saveResizedCover(category, id, result.assets[0].uri);
}

/** Opens the camera. saveToPhotos is explicitly false - a cover photo
 * taken here is saved only within Media Base's own private storage,
 * never added to the device's Photos app. */
export async function takeCoverPhoto(category: string, id: string): Promise<string | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return null;
  const result = await ImagePicker.launchCameraAsync({
    quality: 0.8,
    allowsEditing: true,
    aspect: [2, 3],
    saveToPhotos: false,
  });
  if (result.canceled || !result.assets?.[0]?.uri) return null;
  return saveResizedCover(category, id, result.assets[0].uri);
}

/** Downloads a remote cover URL (Open Library/Google Books/TMDb) and
 * stores it through the exact same resize/save path a manually taken or
 * picked photo goes through - one system, regardless of source. Returns
 * null if the download fails, which isn't treated as an app error - it's
 * the same "genuinely not available" case already handled for missing
 * genre data, not every book/movie has cover art indexed anywhere. */
export async function downloadRemoteCover(category: string, id: string, url: string): Promise<string | null> {
  try {
    await ensureDirExists(categoryDir(category));
    const tempUri = `${FileSystem.cacheDirectory}temp-cover-${category}-${id}.jpg`;
    const result = await FileSystem.downloadAsync(url, tempUri);
    if (result.status !== 200) return null;
    return await saveResizedCover(category, id, result.uri);
  } catch (err) {
    console.warn('Media Base: cover download failed', err);
    return null;
  }
}

/** Deletes one item's stored cover, if it has one - called whenever that
 * item itself is deleted, so covers for removed entries don't pile up as
 * orphaned files. idempotent: true means this doesn't throw if there was
 * never a cover saved for this id in the first place. */
export async function deleteCover(category: string, id: string): Promise<void> {
  await FileSystem.deleteAsync(coverPath(category, id), { idempotent: true }).catch(() => {});
}

/** Wipes every saved cover across every category - used by Settings >
 * Data > Delete all data, so a full reset actually removes everything,
 * not just the text records. */
export async function deleteAllCovers(): Promise<void> {
  await FileSystem.deleteAsync(COVERS_DIR, { idempotent: true }).catch(() => {});
}
