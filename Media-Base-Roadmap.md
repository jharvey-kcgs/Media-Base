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
Books, Movies, Tabletop Games, TV Shows, Comics/Manga, Vinyl/CD, Anime.
(Video Games intentionally excluded — Steam already covers that.
Music (digital, via streaming) was tried and removed — see the
project README's top overview for why; it didn't fit this project's
physical/owned-media philosophy. Vinyl/CD above is the version
of "music" that actually fits it. Puzzles was dropped from the plan
before ever being built — no real assisted-entry story existed for it
in the first place, and on reflection it wasn't something worth
tracking here.)

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
- **Permissions** — camera access status/toggle plus a direct link to the phone's own Settings app (apps can't grant or revoke OS permissions on their own, so this is a status display + deep link, not a real in-app toggle).
- **About** — explains Profile, every screen/setting, why items appear on Home, and the Data section.
- **FAQ** — separate page from About (same split as Home Base).

## Entry flow, per category

Every entry screen supports full manual entry by default — scanning is always optional, never required to add an item. A small camera icon sits next to the relevant fields; tapping it is what triggers the OS camera-permission prompt (requested lazily on first tap, not upfront on app launch or screen load, same pattern as Home Base's notification-permission timing). Whether the user scans or types, all required fields for that category must be filled before the entry can be saved.

All barcode/link-based entries go through a **confirm/edit screen before saving** — never silent auto-save — since none of the lookups below are 100% reliable.

| Category | Entry method | Fields | Lookup source (best available) |
|---|---|---|---|
| Books | Enter or scan (ISBN barcode) | Title, genre, author, read switch | Open Library / Google Books API — reliable |
| Comics/Manga | Enter or scan (ISBN barcode) | Title, genre, author, read switch | Same as Books — comics/manga have ISBNs, reliable |
| Movies | Enter or search by title ✅ done | Title, genre, watched switch | Title search only (TMDb, free credential required) - originally planned with UPC scanning too, removed after real testing confirmed it was unreliable |
| TV Shows | Enter or search by title ✅ done | Title, genre, watched switch | Title search only (TMDb, free credential required) - confirmed design from the start, no scan/number-entry ever planned |
| Anime | Enter or search by title ✅ done | Title, genre, watched switch | Title search, TMDb primary + Jikan (MyAnimeList, free/keyless) fallback - same multi-source resilience pattern as Books/Comics |
| Vinyl/CD | Enter, scan, or search by title ✅ done | Title, genre, artist, listened switch, rating | Discogs API — has a real, direct barcode search parameter, not a fuzzy multi-hop chain; confirmed via real research before building. Genre filter uses a short, fixed 13-item list (the user's own trimmed-down version of Discogs' official genre list), not a dynamic "genres in your collection" list, kept deliberately small and easy to navigate |
| Tabletop Games | Enter or search by title ✅ done | Title, genre, players, played switch, rating | BoardGameGeek XML API2, free/keyless. Covers card games too (Uno, Phase 10, etc.), not just board games, per explicit request - confirmed both are real, catalogued BGG entries, not just a hopeful assumption. Scan/barcode confirmed dropped entirely - BGG's API has no barcode field at all, and any UPC-to-BGG bridge would need a third-party service of unverified reliability, the same structural risk that already got Movies' original UPC approach removed once. Genre filter uses a fixed 20-item list (the user's own trim of BGG's real ~60-category list), not a dynamic "genres in your collection" list, after weighing both approaches directly. Manufacturer and Play Time both confirmed dropped; Players is a single free-text field, not separate min/max numbers |

Every entry screen has a manual-entry path as the default; scanning/link-pasting is always an optional shortcut, never required. The camera icon only requests OS camera permission when tapped (lazy, not on screen load), matching Home Base's lazy notification-permission pattern. Regardless of entry method, all required fields for that category must be filled before saving.

**Added after Books/Comics/Movies were built:** a third entry method, "type a title, get real candidates back, tap one to fill in every field it has" (`lib/titleSearch.ts` + `components/TitleSearchInput.tsx`, shared across categories). For the cases scan/number-entry can't cover - no working camera, a damaged/unreadable barcode, a thrifted book with a sticker over part of it. Books/Comics lead with scan since ISBN uniquely identifies an edition, keeping all three methods. Movies originally demoted scan/UPC below title search the same way, then dropped it entirely once real testing confirmed that UPC lookup chain (UPC → messy retail title → TMDb search) was unreliable in practice - title search is now Movies' only entry-assist method, same as TV Shows was from the start. Worth applying the same "which method should lead, or whether one should exist at all" judgment call to each future category rather than defaulting to scan-first everywhere.

## "Where to Watch"
Not part of the core entry flow, layered on top once basic entries exist for each category:
- **Movies, TV Shows & Anime** ✅ done — each entry added through title search gets a "Where to Watch" button. Built simpler than originally planned here: rather than a custom in-app popup listing providers (which would need ongoing JustWatch attribution everywhere it's shown, not just once in Credits), the button opens TMDb's own watch page directly (`tmdbMovieWatchUrl()` / `tmdbWatchUrl()`) - that page already has correct JustWatch branding built in, so nothing needed to be built or maintained for it. Region-aware but not yet configurable (defaults to US). Only shows on an entry with a stored `tmdbId` (came from title search) - a graceful hide, not a disabled button, for anything typed in by hand. Anime reuses this exact approach (its title search is TMDb-primary, same `tmdbId`), but with one real added case: an entry found only through Anime's Jikan fallback (MyAnimeList doesn't cross-reference TMDb) also won't have this button - same graceful hide, just triggered by which source actually found it.
- **Vinyl/CD and Tabletop Games both deliberately have no equivalent** - the whole point of these categories is a physical copy already owned, not a pointer to somewhere else to access it. Adding a "Where to Listen"/"Where to Play" button back in would quietly reintroduce the exact category mismatch that got the since-removed digital Music category pulled entirely.

## Recommendation & rating logic
- Switch = **No** (not read/watched/listened/played) → that category's widget shows one random not-done item as "try this today," refreshed daily, one per widget (not one global pick).
- Switch = **Yes** → opens rating (1–5 stars) + text review; item drops off the Home widget once rated.
- **Share** button opens the native OS share sheet (Mail, Messages, Snapchat, Copy Link, whatever's installed) — no custom per-platform integration needed.

## Filters per category screen
- Movies: Title / Genre / Watched / Rating
- TV Shows: Title / Genre / Watched / Rating
- Anime: Title / Genre / Watched / Rating
- Books: Title / Genre / Author / Read / Rating
- Comics/Manga: Title / Genre / Author / Read / Rating
- Vinyl/CD: Title / Genre / Artist / Listened / Rating
- Tabletop Games: Title / Genre / Players / Played / Rating

## Build order
1. **Books** — most reliable lookup, simplest way to prove the entry → confirm → rate → recommend pattern end to end ✅ done
2. **Comics/Manga** (same ISBN pattern, near-zero extra lookup work) ✅ done — built on shared lib/isbnLookup.ts and lib/useAlphabetScroll.ts rather than a second copy, with its own genre allowlist that adds manga demographic labels (Shonen/Shoujo/Seinen/Josei) alongside standard genres
3. **Movies** ✅ done, built out of the original planned order per explicit request - originally had its own UPC/barcode scanning too (lib/upcLookup.ts), removed later after real testing confirmed that lookup chain was unreliable in practice. Now title-search only, via lib/movieLookup.ts. Needs a free TMDb credential added to lib/config.ts before title-search auto-fill will work; manual entry works regardless.
4. **TV Shows** ✅ done, also built out of the original planned order per explicit request - title-search only from the start (lib/tvLookup.ts, its own genre taxonomy genuinely different from Movies'). Structural twin of Movies now that Movies dropped its own scan/UPC entry - both share the same "Where to Watch" approach (see above).
5. **Anime** ✅ done - title search, TMDb primary + Jikan fallback, same shape as Movies/TV Shows
6. **Vinyl/CD** ✅ done - title search/barcode via Discogs, a real direct match unlike the UPC-fuzzy-match family this was originally grouped with
7. **Tabletop Games** ✅ done - title search only via BGG, scan confirmed dropped entirely - see the table row above for why

## Open items not yet decided
- Exact API/developer accounts to register (OMDb/TMDb, Discogs developer keys) — Movies, TV Shows, and Anime all need a free TMDb credential in lib/config.ts for their title-search auto-fill to work; Vinyl/CD needs its own separate Discogs personal token, also in lib/config.ts. Tabletop Games needs neither - BGG's basic search/thing lookups are free and keyless.
- Whether TV Shows/Anime need a distinct "in progress" state beyond the binary watched switch (e.g. partway through a season) — flagged for later, not blocking v1 build. TV Shows shipped with the same simple Watched toggle as Movies rather than resolving this question.
