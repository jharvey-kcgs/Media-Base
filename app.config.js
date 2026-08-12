// Replaces the old static app.json. Two real, separate App Store Connect
// apps share this one codebase — UAT (TestFlight, all regular builds) and
// Store (App Store submission only) — distinguished purely by the
// APP_VARIANT env var eas.json's "store" build profile sets. Pattern
// adapted from Home Base's app.config.js (same underlying approach,
// Expo's own recommended pattern for multiple app variants from one
// codebase), not copied verbatim - several details below are corrected
// for Media Base's own actual config rather than inherited from Home
// Base's, see the notes at each one.
//
// Default (no env var — this is what a plain `eas build`, with no
// --profile flag, has always done and continues to do): UAT.
//   name: "Media Base (UAT)"
//   bundleIdentifier / package: com.JHarvey.MediaBase (unchanged — this
//     already has a real Apple Developer account and bundle ID behind
//     it; nothing about it changes here)
//
// APP_VARIANT=production (only ever set by `eas build --profile store`):
// Store.
//   name: "Media Base" - a placeholder, not a verified-available public
//     name the way Home Base's "Home Base: Plans & Habits" was (that
//     name came from a real check against existing App Store apps,
//     since plain "Home Base" and "My Home Base" were both already
//     taken - this hasn't gone through that same check yet, so confirm
//     "Media Base" is actually available before a real submission).
//   bundleIdentifier / package: com.JHarvey.MediaBaseStore (new —
//     register fresh, only ever used for real App Store submissions)
//
// This is Expo's own recommended pattern for multiple app variants from
// one codebase — one EAS project (one projectId below) can produce builds
// for either bundle identifier; it's not tied permanently to one.

const IS_STORE = process.env.APP_VARIANT === 'production';

module.exports = {
  expo: {
    name: IS_STORE ? 'Media Base' : 'Media Base (UAT)',
    slug: 'media-base',
    // Declares which Expo account this project belongs to explicitly,
    // rather than relying on EAS to resolve that unambiguously on its
    // own the way it apparently did for Home Base/League Base without
    // this being set.
    owner: 'jharvey.expo',
    version: '1.0.0',
    orientation: 'portrait',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    assetBundlePatterns: ['**/*'],
    icon: './assets/icon.png',
    ios: {
      // Deliberately left as the existing false, not changed to true the
      // way Home Base's was - that fix addressed a real, confirmed bug
      // there (an already-built tablet layout silently never rendering
      // because of this exact setting). Media Base has no tablet-specific
      // layout work done at all, so there's nothing this would unlock -
      // flipping it now would just let the existing phone-only layout
      // run unscaled on a much bigger screen, not fix anything.
      supportsTablet: false,
      // Answers App Store Connect's encryption-compliance prompt
      // permanently, in the binary itself, instead of needing to answer
      // it manually on every future submission. The reasoning is
      // different from Home Base's own version of this comment, which
      // said "makes no network requests" - not true for Media Base,
      // which makes plenty (TMDb, Discogs, BoardGameGeek, Open Library,
      // Google Books). `false` is still the accurate value regardless -
      // standard HTTPS/TLS is exempt from this declaration either way -
      // it's specifically about custom or proprietary encryption, which
      // this app doesn't implement any of.
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
      bundleIdentifier: IS_STORE ? 'com.JHarvey.MediaBaseStore' : 'com.JHarvey.MediaBase',
    },
    android: {
      package: IS_STORE ? 'com.JHarvey.MediaBaseStore' : 'com.JHarvey.MediaBase',
      adaptiveIcon: {
        foregroundImage: './assets/icon.png',
        // Matches Media Base's own icon background (black, per the
        // original icon design - a neon-blue shield outline on black),
        // not Home Base's cream (#F7F3EC) - carrying that over verbatim
        // would have been visibly wrong for this app's own icon.
        backgroundColor: '#000000',
      },
    },
    plugins: [
      // Both of these were present in the previous app.json and are
      // still genuinely needed - Media Base uses the camera for barcode
      // scanning (Books/Comics/Vinyl-CD) and image-picker for cover
      // photos across every category. Neither was in the app.config.js
      // pattern as shared (Home Base doesn't use either), so carrying
      // them forward here, unchanged, rather than dropping them in the
      // switch from app.json.
      [
        'expo-camera',
        {
          cameraPermission:
            'Media Base uses the camera to scan barcodes so you can add media without typing everything by hand. This is always optional - you can enter items manually instead.',
        },
      ],
      [
        'expo-image-picker',
        {
          photosPermission:
            'Media Base uses your photo library so you can add a cover photo for a book, comic, or movie - only ever used when you choose to add one, and only the photo you pick is used.',
          cameraPermission:
            'Media Base uses the camera so you can take a cover photo for a book, comic, or movie. This photo is saved privately within Media Base only - it is never added to your Photos app.',
        },
      ],
      [
        'expo-notifications',
        {
          color: '#007AFF',
        },
      ],
      'expo-font',
      [
        'expo-splash-screen',
        {
          image: './assets/icon.png',
          imageWidth: 220,
          resizeMode: 'contain',
          // Same reasoning as the Android adaptiveIcon color above -
          // Media Base's own icon background is black, not Home Base's
          // cream.
          backgroundColor: '#000000',
        },
      ],
    ],
    extra: {
      eas: {
        projectId: 'b39ac76a-1399-4fa2-b0b1-9ecda9de112e',
      },
    },
  },
};
