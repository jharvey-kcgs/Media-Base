# Media Base

A personal media collection & tracker app - books, movies, TV shows, anime, music, vinyl, comics/manga, puzzles, and board games. Companion app to Home Base and League Base, same stack, independent codebase and theme.

See `Media-Base-Roadmap.md` for the full design decisions and build order.

## Setup

Requires Node v20.20 and Expo SDK 54 (matching Home Base / League Base).

```
npm install
npx expo install --fix   # reconciles dependency versions against SDK 54
npm start
```

You'll also need to drop a real `assets/icon.png` in before the app will build cleanly - this scaffold doesn't include one yet.

## Status

First working slice: Onboarding, Home, Settings (+ Profile/Theme/Data/About/FAQ sub-pages), and Books. Every other category widget shows "Coming soon" on Home until its screen is built, following the confirmed build order (Books → Comics/Manga → Puzzles → Music → Movies → TV Shows → Anime → Vinyl → Board Games).

Barcode scanning is stubbed (shows an alert) - the actual camera integration comes in a later pass, per category, once `expo-camera` is added.
