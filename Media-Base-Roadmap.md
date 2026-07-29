# Media-Base — Project Roadmap

A personal media collection & tracker app. Companion to [Home Base](https://github.com/jharvey-kcgs/Home-Base) and [League Base](https://github.com/jharvey-kcgs/League-Base), same stack, independent codebase.

## Stack
- Expo / React Native (matching Home Base & League Base — Expo Go for free dev, EAS Build later)
- TypeScript
- `@react-navigation/native` + native-stack (drawer not needed — no regions here)
- `@react-native-async-storage/async-storage` for local persistence (no custom backend, same as the other two apps)
- Bundle ID: `com.JHarvey.MediaBase` (following the `com.JHarvey.<AppName>` convention)
- Repo: `Media-Base` (GitHub, public, mirrors the other two repos' README/App-Store-Info doc structure)

## v1 categories
Books, Movies, Music, Puzzles, Board Games, TV Shows, Comics/Manga, Vinyl/Records, Anime.
(Video Games intentionally excluded — Steam already covers that.)

## Screens

### OnboardingScreen
First launch only. User picks which of the 9 categories they want — selections drive which widgets appear on Home. Re-visitable later via Settings → Profile.

### HomeScreen
One widget per selected category. Each widget shows:
- Today's random "not done" suggestion for that category (see Recommendation logic below)
- Quick-add entry point

### CategoryScreen (one per category)
List of that category's items, with sort/filter controls specific to the category (see table below). Tapping an item opens its detail/rating view.

### SettingsScreen (nested sub-pages, matching Home Base's pattern)
- **Profile** — toggle categories on/off. Turning one off hides its Home widget but keeps its data; turning it back on restores the widget with data intact.
- **Theme** — Text size (small/default/large), Theme color, Light/Dark mode. Independent from Home Base and League Base's theme settings (confirmed — not shared).
- **Data** — Export, Import, Delete (all-or-nothing wipe, no per-category delete — confirmed).
- **About** — explains Profile, every screen/setting, why items appear on Home, and the Data section.
- **FAQ** — separate page from About (same split as Home Base).

## Entry flow, per category

Every entry screen supports full manual entry by default — scanning is always optional, never required to add an item. A small camera icon sits next to the relevant fields; tapping it is what triggers the OS camera-permission prompt (requested lazily on first tap, not upfront on app launch or screen load, same pattern as Home Base's notification-permission timing). Whether the user scans or types, all required fields for that category must be filled before the entry can be saved.

All barcode/link-based entries go through a **confirm/edit screen before saving** — never silent auto-save — since none of the lookups below are 100% reliable.

| Category | Entry method | Fields | Lookup source (best available) |
|---|---|---|---|
| Books | Enter or scan (ISBN barcode) | Title, genre, author, page count, read switch | Open Library / Google Books API — reliable |
| Comics/Manga | Enter or scan (ISBN barcode) | Title, genre, author/illustrator, volume/page count, read switch | Same as Books — comics/manga have ISBNs, reliable |
| Movies | Enter or scan (UPC barcode) | Title, genre, runtime, watched switch | UPC lookup → title match against OMDb/TMDb — decent, not perfect |
| TV Shows | Enter only (no scan) | Title, genre, seasons/episodes, watched switch | N/A — manual entry; see "where to watch" below |
| Anime | Enter only (no scan) | Title, genre, episodes, watched switch | N/A — manual entry; see "where to watch" below |
| Vinyl/Records | Enter or scan (UPC barcode) | Title, genre, artist, listened switch | Discogs API — has strong UPC-to-release lookup, best barcode match of the physical-media categories |
| Music (digital) | Enter or paste Spotify/Apple/YouTube link | Genre, artist, title, listened switch | Public catalog API (developer key, not user OAuth) — genre often missing at song level, so expect manual edits here often; see "where to listen" below |
| Puzzles | Enter only (no scan) | Genre (people/place/animal/food), pieces, completed switch | No barcode database exists for jigsaw puzzles |
| Board Games | Enter or scan (UPC barcode) | Title, manufacturer, genre, players, play time, played switch | UPC lookup → name match against BoardGameGeek — weakest match of the barcode categories, expect frequent manual correction |

Every entry screen has a manual-entry path as the default; scanning/link-pasting is always an optional shortcut, never required. The camera icon only requests OS camera permission when tapped (lazy, not on screen load), matching Home Base's lazy notification-permission pattern. Regardless of entry method, all required fields for that category must be filled before saving.

## Confirmed add-on: "Listen on Spotify" / "Where to Watch"
Not part of the core entry flow, layered on top once basic entries exist for each category:
- **Music** — each entry gets a "Listen on Spotify" link. Spotify's Web API supports catalog search via an app-level developer key (Client Credentials — no user login), so even manually-typed title/artist can resolve to a link.
- **TV Shows & Anime** — each entry gets a "Where to Watch" button that opens a popup listing the streaming apps/links carrying that title, sourced from TMDb's free `watch/providers` endpoint (region-aware). Most mainstream-popular anime is also catalogued in TMDb as a TV show, so this can likely share one lookup path for both categories. Caveat: regional data, and niche/older titles may be missing or come back empty.

## Recommendation & rating logic
- Switch = **No** (not read/watched/listened/played) → that category's widget shows one random not-done item as "try this today," refreshed daily, one per widget (not one global pick).
- Switch = **Yes** → opens rating (1–5 stars) + text review; item drops off the Home widget once rated.
- **Share** button opens the native OS share sheet (Mail, Messages, Snapchat, Copy Link, whatever's installed) — no custom per-platform integration needed.

## Filters per category screen
- Movies: Title / Genre / Runtime / Watched
- TV Shows: Title / Genre / Seasons / Watched
- Anime: Title / Genre / Episodes / Watched
- Books: Title / Genre / Page Count / Author / Read
- Comics/Manga: Title / Genre / Volume Count / Author / Read
- Puzzles: Piece Count / Genre / Manufacturer / Completed
- Music: Title / Genre / Artist / Listened
- Vinyl/Records: Title / Genre / Artist / Listened
- Board Games: Genre / Play Time / Manufacturer / Title / Played

## Build order
1. **Books** — most reliable lookup, simplest way to prove the entry → confirm → rate → recommend pattern end to end
2. Comics/Manga (same ISBN pattern, near-zero extra lookup work)
3. Puzzles (manual-only, good simple second target)
4. Music (link-paste + developer API keys)
5. Movies → TV Shows → Anime (same UPC/title-search family)
6. Vinyl/Records → Board Games (UPC-with-fuzzy-match family, most correction-prone)

## Open items not yet decided
- Exact API/developer accounts to register (Google Books, OMDb/TMDb, Discogs, Spotify developer keys) — can be done incrementally per widget as you build it, not all upfront
- Whether TV Shows/Anime need a distinct "in progress" state beyond the binary watched switch (e.g. partway through a season) — flagged for later, not blocking v1 build
