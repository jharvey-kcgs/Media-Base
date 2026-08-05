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

// expo-file-system's promise-based API used throughout this file
// (getInfoAsync, makeDirectoryAsync, downloadAsync, copyAsync,
// deleteAsync) was deprecated in the SDK 54 version actually installed,
// in favor of new File/Directory classes - confirmed via a real "Method
// getInfoAsync is deprecated" thrown error during on-device testing, not
// just a console warning. Importing from the /legacy subpath instead of
// the bare package keeps the exact same API working, since Expo
// deliberately preserved it there for this migration rather than only
// offering the new class-based API.
import * as FileSystem from 'expo-file-system/legacy';
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

/** Ensures a category's cover directory exists - exported specifically
 * for lib/storage.ts's importAllData(), which needs to write cover files
 * directly (restoring a backup on a fresh install, where no cover has
 * ever been saved yet, so the directory itself may not exist). */
export async function ensureCoverDirExists(category: string): Promise<void> {
  await ensureDirExists(categoryDir(category));
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
 * never added to the device's Photos app. The `as any` cast below is
 * deliberate, not sloppy: TypeScript's current type declarations for
 * launchCameraAsync's options no longer list saveToPhotos, but this is
 * exactly the kind of case where a type declaration lagging behind
 * actual native capability is far more likely than the option being
 * truly gone - genuinely removing a documented, working privacy control
 * on unclear typing evidence risks silently reintroducing photos being
 * saved to the device's Photos app, which this app specifically tested
 * and confirmed doesn't happen. Worth a real on-device check (take a
 * photo, confirm nothing new appears in the Photos app) rather than
 * trusting this comment alone - not verified from this sandbox. */
export async function takeCoverPhoto(category: string, id: string): Promise<string | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return null;
  const result = await ImagePicker.launchCameraAsync({
    quality: 0.8,
    allowsEditing: true,
    aspect: [2, 3],
    saveToPhotos: false,
  } as any);
  if (result.canceled || !result.assets?.[0]?.uri) return null;
  return saveResizedCover(category, id, result.assets[0].uri);
}

/** Downloads a remote cover URL (Open Library/Google Books/TMDb) and
 * stores it through the exact same resize/save path a manually taken or
 * picked photo goes through - one system, regardless of source. Returns
 * null if the download fails, which isn't treated as an app error - it's
 * the same "genuinely not available" case already handled for missing
 * genre data, not every book/movie has cover art indexed anywhere. */
// Confirmed real issue via testing: every cover that ever successfully
// downloaded was a .jpg URL, and every one reported as failing (found a
// valid URL, logged "using [url]", but never actually appeared) was a
// .png. The temp file below used to be hardcoded to a .jpg extension
// regardless of what format was actually being downloaded - PNG bytes
// were being written into a file literally named .jpg, which some image
// processing steps use as a hint for how to decode the file rather than
// sniffing the actual content. This derives the real extension from the
// URL instead, falling back to .jpg only when the URL doesn't make it
// clear.
function extensionFromUrl(url: string): string {
  const match = url.match(/\.(jpe?g|png|webp|gif)(?:\?|$)/i);
  return match ? `.${match[1].toLowerCase()}` : '.jpg';
}

export async function downloadRemoteCover(category: string, id: string, url: string): Promise<string | null> {
  try {
    await ensureDirExists(categoryDir(category));
    const tempUri = `${FileSystem.cacheDirectory}temp-cover-${category}-${id}${extensionFromUrl(url)}`;
    const result = await FileSystem.downloadAsync(url, tempUri);
    if (result.status !== 200) {
      // Previously a silent return - the exact failure this was tracking
      // down (a confirmed URL never actually appearing) never printed
      // anything at all, since this wasn't logged before.
      console.warn('Media Base: cover download got non-200 status', result.status, url);
      return null;
    }
    return await saveResizedCover(category, id, result.uri);
  } catch (err) {
    console.warn('Media Base: cover download failed', url, err);
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

// --- Staged variants, used only while EDITING an existing item ---
//
// Adding a brand new item can safely write straight to its permanent
// path (the functions above) - there's no pre-existing file to protect,
// and cancelling an Add session already cleans up any newly-created
// cover correctly. Editing an EXISTING item is different: writing
// straight to that item's permanent path the moment a new photo is
// picked would silently destroy the original cover even if the edit is
// then cancelled, since nothing else about an edit takes effect until
// Save is actually pressed - a real bug, found by re-reading this code
// rather than a live report, since every other field is just draft
// state until Save, but a cover change is a real file write that was
// happening immediately regardless.
//
// The fix: these write to a temporary location instead. Only
// commitPendingCover() (called on Save) actually replaces the permanent
// file; discardPendingCover() (called on Cancel) just deletes the temp
// file, leaving the real one exactly as it was.

function stagedCoverPath(category: string, id: string): string {
  return `${FileSystem.cacheDirectory}pending-cover-${category}-${id}-${Date.now()}.jpg`;
}

async function saveResizedCoverTo(sourceUri: string, destUri: string): Promise<string> {
  const manipulated = await ImageManipulator.manipulateAsync(
    sourceUri,
    [{ resize: { width: 400 } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
  );
  await FileSystem.copyAsync({ from: manipulated.uri, to: destUri });
  return destUri;
}

export async function pickCoverFromLibraryStaged(category: string, id: string): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.8,
    allowsEditing: true,
    aspect: [2, 3],
  });
  if (result.canceled || !result.assets?.[0]?.uri) return null;
  return saveResizedCoverTo(result.assets[0].uri, stagedCoverPath(category, id));
}

export async function takeCoverPhotoStaged(category: string, id: string): Promise<string | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return null;
  const result = await ImagePicker.launchCameraAsync({
    quality: 0.8,
    allowsEditing: true,
    aspect: [2, 3],
    saveToPhotos: false,
  } as any);
  if (result.canceled || !result.assets?.[0]?.uri) return null;
  return saveResizedCoverTo(result.assets[0].uri, stagedCoverPath(category, id));
}

export async function downloadRemoteCoverStaged(category: string, id: string, url: string): Promise<string | null> {
  try {
    const tempSource = `${FileSystem.cacheDirectory}temp-source-cover-${category}-${id}${extensionFromUrl(url)}`;
    const result = await FileSystem.downloadAsync(url, tempSource);
    if (result.status !== 200) {
      console.warn('Media Base: staged cover download got non-200 status', result.status, url);
      return null;
    }
    return await saveResizedCoverTo(result.uri, stagedCoverPath(category, id));
  } catch (err) {
    console.warn('Media Base: staged cover download failed', url, err);
    return null;
  }
}

/** Commits a staged (temp) cover to its item's real, permanent path -
 * called on Save. */
export async function commitPendingCover(category: string, id: string, stagedUri: string): Promise<string> {
  await ensureDirExists(categoryDir(category));
  const dest = coverPath(category, id);
  await FileSystem.copyAsync({ from: stagedUri, to: dest });
  await FileSystem.deleteAsync(stagedUri, { idempotent: true }).catch(() => {});
  return dest;
}

/** Discards a staged (temp) cover - called on Cancel. Safe to call with
 * null (nothing was staged this session). */
export async function discardPendingCover(stagedUri: string | null): Promise<void> {
  if (!stagedUri) return;
  await FileSystem.deleteAsync(stagedUri, { idempotent: true }).catch(() => {});
}
