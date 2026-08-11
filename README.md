# Media Base — Developer Guide & Documentation

*A solo-built project — this doc serves as both working documentation for
myself (commands, structure, decisions, what's still open) and an overview
for anyone else looking at the repo. Still early — will keep growing
alongside the in-app About/FAQ screens as more categories get built.*

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Install](#2-install)
3. [Running the dev server](#3-running-the-dev-server)
4. [What's here — project structure](#4-whats-here--project-structure)
5. [Permissions](#5-permissions)
6. [Cover photos](#6-cover-photos)
7. [Color accessibility](#7-color-accessibility)
8. [Known setup gotchas](#8-known-setup-gotchas)
9. [Status](#9-status)
10. [Roadmap (genuinely open, not yet built)](#10-roadmap-genuinely-open-not-yet-built)

Media Base is a personal media collection & tracker — a Home screen made
of widgets, one per media category the user opts into during Onboarding
(Books, Comics/Manga, Movies, TV Shows, Anime, Vinyl/CD,
Tabletop Games), each with its own dedicated screen for adding,
rating, and reviewing entries, plus a Settings area covering Profile,
Theme, Data (backup/restore/delete), Permissions, About, and FAQ.

Built with React Native + Expo, same setup as [Home Base](https://github.com/jharvey-kcgs/Home-Base)
and [League Base](https://github.com/jharvey-kcgs/League-Base) — no Mac
required for local development. Everything runs and stores locally
on-device; there's no account, no backend, and nothing this app collects
or transmits about you.

**What's actually in here, for anyone skimming this for the first time:**
- Onboarding picks which categories show up as widgets on Home — every
  category's data is kept even if its widget is later hidden
- Every entry supports full manual typing; scanning (barcode) or pasting a
  link is always an optional shortcut, never required
- A daily "try this today" suggestion per widget, pulled from whatever's
  marked not-yet-read/watched/listened/played/completed
- Marking something done opens a place to rate (1–5 stars) and review it,
  and it drops off the day's suggestions
- Independent theming (color, Light/Dark, text size) — deliberately not
  shared with Home Base or League Base
- A complete local backup system — export, import, and a two-step-confirm
  full reset, all in Settings → Data
- A Permissions page showing camera-access status with a direct link to
  Phone Settings, since apps can't grant or revoke OS permissions on
  their own

**Where this stands right now:** Onboarding, Home, all of Settings, and
three categories - Books, Comics/Manga, and Movies - are working
end-to-end: add, edit, sort/filter, search, cover photos, rate, review,
delete. Every item can be added three ways - real barcode scanning,
typing the ISBN/UPC directly, or searching by title and picking a real
result - and every category now shows a cover photo (auto-fetched where
one's available, or added by hand) both in its list and its Edit screen.
Settings → Data backs up everything, covers included, to one real file
rather than pasted text. Every other category widget shows "Coming soon"
until its own screen is built - Movies, TV Shows, Anime, and Vinyl/CD
were all built out of the original planned order in
[Media-Base-Roadmap.md](./Media-Base-Roadmap.md) per explicit request,
so the remaining order there is just Tabletop Games now (Music,
originally next in that order, was built and later removed entirely -
see below; Puzzles was dropped from the plan before ever being built).
`lib/useAlphabetScroll.ts` (A-Z
index) and `components/TitleSearchInput.tsx`/`components/SearchBar.tsx`/
`components/CoverThumbnail.tsx`/`components/CoverPicker.tsx` (title
search, local search, and cover photos) are shared across all six
implemented categories; `lib/isbnLookup.ts` is Books/Comics-specific,
since both use ISBN lookup directly - Movies, TV Shows, and Anime are
all TMDb-backed instead (`lib/movieLookup.ts`, `lib/tvLookup.ts`, and
Anime reuses tvLookup.ts directly), and title-search-only, having no
ISBN/barcode concept at all. Vinyl/CD sits in neither camp - its own
`lib/discogsLookup.ts`, and unlike Movies/TV/Anime it does support a
real barcode (a direct match via Discogs, not the ISBN checksum/
formatting Books/Comics have via `isbn3` - no equivalent library exists
for UPC/EAN codes, so that field just holds raw digits) - see the
Category screen pattern section for what to reuse vs. rebuild per
category.
**Movies, TV Shows, and Anime need a one-time setup step Books/Comics
never did**: a free TMDb credential in `lib/config.ts` (see that file's
own comments for exactly what's needed and where to get it), or their
title-search auto-fill won't return anything (manual entry always works
regardless). **Vinyl/CD needs its own separate credential** the same
way - a free Discogs personal token, also in `lib/config.ts`
(`DISCOGS_USER_TOKEN`).

**All six implemented categories are fully working** - Books,
Comics/Manga, Movies, TV Shows, Anime, and Vinyl/CD all have working
list/search/genre filter/A-Z index/hold-to-select and full Add/Edit.
Movies, TV Shows, and Anime are structural twins: all TMDb-backed (Anime
with a Jikan/MyAnimeList fallback when TMDb has nothing), all
title-search-only (no camera/scanner, no barcode/number entry of any
kind - confirmed design, not a gap), all with a "Where to Watch" button
that opens TMDb's
own watch page. That button only shows on an entry added through title
search (needs a stored `tmdbId` to link to anything) - not shown at all
for an entry typed in by hand, a graceful hide rather than a disabled
button. Movies didn't start this way - it originally had UPC/barcode
scanning like Books/Comics, removed later after real testing confirmed
that multi-hop lookup chain was unreliable in practice, with Title
Search already being the reliable path being used - see
`lib/movieLookup.ts`'s header comment for the full story.

**Anime is fully working** - `screens/AnimeScreen.tsx` (list, search,
genre filter, A-Z index, hold-to-select, full Add/Edit) and the Home
widget are both built now, on top of the data layer (`types/models.ts`'s
`Anime`, full CRUD in `lib/storage.ts` including backup/cover wiring,
and the two-source lookup - `lib/tvLookup.ts` primary,
`lib/jikanLookup.ts` fallback, both orchestrated by
`lib/titleSearch.ts`'s `searchAnimeByTitle()`). Anime is a real,
deliberate two-source design, not a reluctant one: TMDb catalogues most
mainstream-popular anime as a regular TV show already, so it's the
primary source (genre filter uses the same dynamic "genres actually in
your list" approach Books/Comics already use, rather than either
source's fixed list, since TMDb and Jikan use different genre
vocabularies) - Jikan (MyAnimeList data, free and keyless) only gets
tried when TMDb comes back with nothing. One real, deliberate
consequence worth knowing: **an entry found only through the Jikan
fallback won't have a Where to Watch button** - MyAnimeList doesn't
cross-reference TMDb, so there's no `tmdbId` to build that link from,
the same graceful-hide behavior already used for a hand-typed entry.

**Music (digital, via streaming) was built, then removed.** It reached
a fully working state - MusicBrainz + Cover Art Archive for search/
metadata/cover art, a direct Spotify album link when one existed via
MusicBrainz's community-contributed relationship data, five real bugs
found and fixed through real device testing - but even working well,
it never fit this project's core: physical, owned media (or, for TV
Shows/Anime, a complete work you watched in full, not a disc but still
the same *kind* of thing). An album pointed at a streaming service you
don't own anything on is a genuinely different category of entry than
everything else here, and no amount of reliability fixes changes that.
Removed by explicit request rather than left in as a lesser-used
category. If digital Music is ever reconsidered, Vinyl/CD (still
on the Roadmap) is the version of "music" that actually fits this
project's philosophy - tracking records and CDs you physically own,
not a streaming pointer.

**Vinyl/CD is fully working** - `screens/VinylScreen.tsx` (list, search,
fixed genre filter, A-Z index, hold-to-select, full Add/Edit with all
three entry methods) and the Home widget are both built now, on top of
the data layer (`types/models.ts`'s `VinylCD` and `VINYL_GENRE_FILTERS`,
full CRUD in `lib/storage.ts` including backup/cover wiring, and the
lookup in `lib/discogsLookup.ts`, orchestrated by `lib/titleSearch.ts`'s
`searchVinylCDByTitle()`). Confirmed design: all three entry methods
(scan, code-entry, title search) via Discogs - unlike Movies' old UPC
approach, barcode search there is a real, direct match rather than a
fuzzy chain, closer in spirit to Books' ISBN lookup. No ISBN-style
checksum/hyphen-formatting library exists for UPC/EAN codes the way
Books has `isbn3` - the barcode field just holds raw digits, and
Discogs' own search reports back if nothing matches rather than this
screen pre-validating a checksum it has no library for. Selecting a
title-search result fills everything at once (title/artist/genre/cover)
- no async follow-up fetches the way Music needed for cover art and
genre separately, since Discogs bundles all of it in one response.
Genre and style both get stored together on each entry for richness,
but the Filter-by-Genre menu uses a separate, deliberately short fixed
list (`VINYL_GENRE_FILTERS`) instead of a dynamic "genres in your
collection" list, since that would grow unbounded given how specific
Discogs' combined data can get. Deliberately no "Where to Listen"-style
button - the whole point of this category is a physical copy already
owned, not a pointer to somewhere else to access it. The barcode scan
path reuses `lib/movieLookup.ts`'s `looksLikeIsbn()` guard, kept there
specifically for this reuse case - a box set can bundle a booklet with
its own ISBN barcode right next to the disc's real UPC, and scanning the
wrong one by mistake is a real failure mode, not a hypothetical one.

---

## 1. Prerequisites

- **Node.js 20 LTS — `20.20` specifically.** Matches Home Base and League
  Base exactly, for the same reason documented in both of those repos: a
  newer Node (22+) crashes the Expo dev server outright. See
  [Gotcha #1](#gotcha-1-node-version) below.
- [VS Code](https://code.visualstudio.com) (or any editor)
- The **Expo Go** app on an iPhone, from the App Store — lets you preview
  the app live during development with no build step.
- An **Apple Developer account** ($99/year) once past local testing and
  moving toward TestFlight — not started yet for this app.

Confirm your Node version with:

```powershell
node -v
```

---

## 2. Install

```powershell
cd Media-Base
npm install
npx expo install --fix
```

`package.json` lists every dependency this project currently needs, so a
plain `npm install` pulls all of them in one shot. Running
`npx expo install --fix` afterward reconciles exact versions against
SDK 54 — worth doing every time, since I hand-wrote the dependency
versions here rather than generating them from a live `expo install`.
**If `npm install` throws `ERESOLVE` errors**, see
[Gotcha #2](#gotcha-2-eresolve-peer-dependency-errors) below.

### What's actually installed, and why

| Package | What it's for |
|---|---|
| `expo`, `react`, `react-native` | Core framework |
| `@react-navigation/native`, `@react-navigation/native-stack` | Screen navigation |
| `react-native-screens` | Required by React Navigation |
| `react-native-safe-area-context` | `SafeAreaProvider` (wraps the whole app in App.tsx), `SafeAreaView`, and `useSafeAreaInsets` - used directly throughout, not just by React Navigation |
| `@react-native-async-storage/async-storage` | All local data storage — the entire app's data layer runs on this |
| `react-native-get-random-values`, `uuid` | Generates unique IDs for every stored item |
| `expo-camera` | Camera access + permission status for the optional barcode-scan shortcut and the Permissions settings page |
| `expo-notifications` | The daily 10am "check today's recommendations" reminder (Settings → Permissions → Daily reminder toggle) |
| `expo-image-picker` | Cover photos - taking a new one or choosing an existing one from the photo library (`lib/coverStorage.ts`) |
| `expo-file-system` | Saving cover photos to this app's own private storage, and deleting them again when an entry is deleted |
| `expo-image-manipulator` | Resizing/compressing every cover photo before it's saved - keeps storage footprint reasonable regardless of source (camera, picked, or auto-fetched) |
| `expo-sharing` | "Save Backup File" (Settings → Data) - hands the built backup file to the OS share sheet |
| `expo-document-picker` | "Choose Backup File" (Settings → Data) - picking a real backup file to restore, instead of pasting text |
| `isbn3` | Real ISBN validation/hyphenation for the Books ISBN field - bundles the official ISBN-agency range data, since hyphen placement isn't a fixed pattern that could be hand-written |
| `@expo/vector-icons` | Icons used in headers/menus - Home screen's cog (Settings) and play (refresh), Books' "•••" menu |
| `expo-font`, `@expo-google-fonts/jetbrains-mono` | The app's JetBrains Mono typeface (Extra Bold for titles/headers, Regular for everything else) |
| `expo-splash-screen` | Holds the launch splash until JetBrains Mono finishes loading, so there's no flash of the system font |

If you ever need to add a **new** native dependency, always use
`npx expo install <package>` rather than plain `npm install` — it picks
the exact version compatible with the current Expo SDK.

---

## 3. Running the dev server

```powershell
npx expo start
```

Scan the QR code with the iPhone's Camera app — it offers to open in
Expo Go, and the app runs live on the phone. Saving any code change shows
up in about a second.

---

## 4. What's here — project structure

```
App.tsx                          Navigation entry point, SafeAreaProvider,
                                   ThemeProvider, first-launch onboarding
                                   gate

screens/
  HomeScreen.tsx                  The dashboard - one widget per selected
                                    category, daily per-widget suggestion,
                                    now with that suggestion's cover photo
                                    (reuses components/CoverThumbnail.tsx,
                                    same fixed-size/placeholder behavior
                                    as every category screen's list rows).
                                    Widget text ("77 Books Tracked",
                                    "Try Today: ...") is deliberately
                                    Title Case here specifically, per
                                    explicit request - the same unit
                                    words (book/books, entry/entries,
                                    movie/movies, show/shows) are passed
                                    in lowercase since they're reused
                                    elsewhere in lowercase contexts, and
                                    only capitalized at this specific
                                    display point via a small
                                    capitalize() helper. TV Shows is the
                                    4th implemented category as of this
                                    writing - wired in as its own step,
                                    deliberately separate from
                                    screens/TVScreen.tsx itself, since the
                                    screen existing and being reachable
                                    from Home are two different things.
  OnboardingScreen.tsx             First-launch category picker

  BookScreen.tsx                   Books (widget 1 - working)
  ComicScreen.tsx                  Comics/Manga (widget 2 - working) -
                                     built on the same shared
                                     lib/isbnLookup.ts and
                                     lib/useAlphabetScroll.ts as Books,
                                     with its own genre allowlist that
                                     adds manga demographic labels
                                     (Shonen/Shoujo/Seinen/Josei)
  MovieScreen.tsx                  Movies (widget 3 - fully working).
                                     Originally built with UPC/barcode
                                     scanning like Books/Comics
                                     (lib/upcLookup.ts, a genuinely
                                     different two-step shape from
                                     lib/isbnLookup.ts) - removed later,
                                     after real testing confirmed that
                                     multi-hop lookup chain was unreliable
                                     in practice, with Title Search
                                     already being the reliable path being
                                     used. Rebuilt to match TVScreen.tsx's
                                     structure exactly: no camera/scanner
                                     at all, no number-entry field, title
                                     search (lib/titleSearch.ts's
                                     searchMoviesByTitle(), via
                                     lib/movieLookup.ts) is the only
                                     entry-assist method. No author/
                                     director field either - not part of
                                     the requested spec. Genre filter
                                     shows TMDb's full fixed 19-genre list
                                     directly rather than only genres
                                     currently in use, unlike Books/Comics
                                     - a deliberate difference, not an
                                     oversight. "Where to Watch"
                                     (lib/movieLookup.ts's
                                     tmdbMovieWatchUrl()) sits between
                                     Genre and the Watched toggle, same
                                     placement and reasoning as
                                     TVScreen.tsx below - only shows on an
                                     entry with a stored tmdbId (came from
                                     title search), a graceful hide rather
                                     than a disabled button for anything
                                     typed in by hand.
  TVScreen.tsx                      TV Shows (widget 4 - fully working).
                                     Structurally simple in the same way
                                     Movies later became: no camera/
                                     scanner at all, no number-entry
                                     field, no author field - title search
                                     (lib/titleSearch.ts's
                                     searchTVShowsByTitle()) is the only
                                     entry-assist method that exists for
                                     this category. Genre
                                     filter shows TMDb's own fixed TV
                                     genre list (lib/tvLookup.ts's
                                     TMDB_TV_GENRE_NAMES) - a genuinely
                                     different 16-genre set from Movies',
                                     not the same list reused. "Where to
                                     Watch" (lib/tvLookup.ts's
                                     tmdbWatchUrl(), opened via
                                     Linking.openURL) sits between Genre
                                     and the Watched toggle deliberately -
                                     splits the form into identity info
                                     (Cover/Title/Genre), a quick external
                                     action, then personal tracking
                                     (Watched/Rating/Review), and stays
                                     reachable without scrolling past
                                     Rating/Review, which can grow tall
                                     once Watched is on. Only rendered
                                     when the entry has a stored tmdbId
                                     (came from title search) - a
                                     graceful hide, not a disabled
                                     button, for anything typed in by
                                     hand instead.
  AnimeScreen.tsx                   Anime (widget 5 - fully working).
                                     Mirrors TVScreen.tsx's structure
                                     closely, with two genuine
                                     differences: title search
                                     (lib/titleSearch.ts's
                                     searchAnimeByTitle()) orchestrates
                                     TWO sources - TMDb primary, Jikan
                                     (MyAnimeList) fallback only when
                                     TMDb comes back empty, same
                                     multi-source resilience pattern as
                                     Books/Comics. Genre filter is
                                     dynamic ("genres actually in your
                                     list", same pattern as Books/Comics)
                                     rather than either source's fixed
                                     list, since TMDb and Jikan use
                                     genuinely different genre
                                     vocabularies. Where to Watch only
                                     renders when draft.tmdbId is set -
                                     never true for an entry found only
                                     through the Jikan fallback, a real
                                     and deliberate consequence of the
                                     two-source design, not a bug.
  VinylScreen.tsx                   Vinyl/CD (widget 6 - fully working).
                                     Mirrors BookScreen.tsx's full
                                     three-entry-method shape (scan,
                                     code-entry, title search) - the only
                                     other category with all three, since
                                     Movies/TV Shows/Anime dropped
                                     scanning entirely and Music never
                                     had a real barcode option. Genuinely
                                     different from Books in three ways:
                                     no ISBN-style checksum/hyphen-
                                     formatting library exists for UPC/EAN
                                     codes (Books' isbn3 dependency is
                                     ISBN-specific) - the barcode field
                                     just holds raw digits, and Discogs'
                                     own search reports back if nothing
                                     matches rather than this screen
                                     pre-validating a checksum it has no
                                     library for; Discogs bundles title/
                                     artist/genre/style/cover ALL in one
                                     search response (see
                                     lib/discogsLookup.ts), so selecting a
                                     result fills everything immediately
                                     with no async follow-up fetches the
                                     way Music needed for cover art and
                                     genre separately; and the genre
                                     filter is a fixed, short list
                                     (VINYL_GENRE_FILTERS - confirmed
                                     directly to keep it easy to
                                     navigate) rather than a dynamic
                                     "genres in your collection" list,
                                     matching Movies/TV's fixed-list
                                     approach rather than Books/Comics/
                                     Anime's dynamic one. Deliberately no
                                     "Where to Watch"/"Where to Listen"-
                                     style button at all - the whole
                                     point of this category is a physical
                                     copy already owned, not a pointer to
                                     somewhere else to access it. The
                                     barcode scan path checks
                                     lib/movieLookup.ts's looksLikeIsbn()
                                     first - a box set can bundle a
                                     booklet with its own ISBN barcode
                                     right next to the disc's real UPC,
                                     and scanning the wrong one by
                                     mistake is a real failure mode, not
                                     a hypothetical one.
  [category]Screen.tsx             One screen per remaining category,
                                    built in the order in the Roadmap doc

  SettingsScreen.tsx               Settings nav list
  ProfileSettingsScreen.tsx        Toggle which categories show on Home
  ThemeSettingsScreen.tsx          Theme color, Light/Dark, text size
  DataSettingsScreen.tsx           Save Backup File / Choose Backup
                                     File / delete-all - Export/Import
                                     moved from pasteable text to a real
                                     file (see Section 6, Cover photos,
                                     for the full reasoning: one JSON
                                     file with cover photos embedded as
                                     base64, not a .zip that would need
                                     unzipping first). Both import and
                                     delete-all call refreshSettings()
                                     from ThemeContext afterward, since
                                     restoring/wiping settings on disk
                                     doesn't by itself update the app's
                                     already-loaded, in-memory copy
                                     (theme color, Light/Dark mode, text
                                     size, enabled Home categories all
                                     live there)
  PermissionsSettingsScreen.tsx    Camera access status + Phone Settings link
  AboutScreen.tsx                  What each setting/screen does. Also
                                     has the Credits section required by
                                     TMDb's API terms of use to keep
                                     using their free (non-commercial)
                                     key - the required text notice is
                                     there, but their terms also call for
                                     the actual TMDb logo somewhere in
                                     this section, which needs their
                                     approved image asset downloaded from
                                     themoviedb.org's brand page and
                                     added manually - not something
                                     fetchable from this sandbox. TMDb's
                                     own free tier is genuinely fine for
                                     this app long-term as long as it
                                     stays free/non-commercial (confirmed
                                     directly against their API terms and
                                     community answers) - the $149/mo
                                     commercial key is only required once
                                     an app generates revenue, not merely
                                     for being distributed on the App
                                     Store.
  FAQScreen.tsx                    Common questions, split out from About

lib/
  storage.ts                       Every piece of data logic - one
                                     function per action. Read this file
                                     first to understand the data model.
                                     addBook/addComic/addMovie accept an
                                     optional pre-generated id (see
                                     coverStorage.ts below for why), and
                                     every delete function - single, bulk,
                                     and Delete all data - also cleans up
                                     that item's saved cover photo, so
                                     nothing orphaned is left behind.
  coverStorage.ts                   The unified cover-photo storage
                                     system - one system regardless of
                                     whether a cover came from the camera,
                                     the photo library, or was
                                     auto-fetched from Open Library/
                                     Google Books/TMDb. Every cover is
                                     resized/compressed then saved to this
                                     app's own private, sandboxed storage
                                     (never the device's Photos app -
                                     takeCoverPhoto() explicitly disables
                                     that) at a path derived from the
                                     item's own id, so once an item has an
                                     id its cover (if any) can always be
                                     found without a separate lookup
                                     table. Confirmed real, on-device:
                                     the exact risk flagged before testing
                                     ("expo-file-system's exact API shape
                                     has changed across SDK versions") -
                                     the promise-based API this file uses
                                     throughout (getInfoAsync,
                                     makeDirectoryAsync, downloadAsync,
                                     copyAsync, deleteAsync) was
                                     deprecated in the SDK 54 version
                                     actually installed, and it wasn't
                                     just a console warning - it actually
                                     threw, breaking every cover download.
                                     Fixed by importing from
                                     `expo-file-system/legacy` instead of
                                     the bare package - Expo deliberately
                                     kept the exact old API stable there
                                     specifically for this migration, so
                                     this was a one-line import fix, not a
                                     rewrite. expo-image-picker/
                                     expo-image-manipulator's own APIs
                                     haven't been exercised yet (the
                                     failure happened earlier in the
                                     pipeline, before either ever ran) -
                                     still worth treating with the same
                                     caution if a future error traces to
                                     either of those specifically.

                                     **A second real bug, found by
                                     re-reading this code rather than a
                                     live report**: editing an existing
                                     item and changing or removing its
                                     cover, then hitting Cancel, did NOT
                                     actually undo it - pickCoverFromLibrary()/
                                     takeCoverPhoto()/deleteCover() all
                                     wrote straight to the item's
                                     permanent path immediately, the
                                     moment a photo was picked or removed,
                                     not deferred until Save the way every
                                     other field already was. Fixed with
                                     staged variants -
                                     pickCoverFromLibraryStaged()/
                                     takeCoverPhotoStaged()/
                                     downloadRemoteCoverStaged() - that
                                     write to a temporary location instead;
                                     commitPendingCover() (called on Save)
                                     is what actually replaces the
                                     permanent file, and
                                     discardPendingCover() (called on
                                     Cancel) just deletes the temp file,
                                     leaving the real one exactly as it
                                     was. Adding a brand new item still
                                     uses the direct-write functions
                                     unchanged - there's no pre-existing
                                     file to protect there, and cancelling
                                     an Add session already cleans up a
                                     newly-created cover correctly, so
                                     that path was never actually broken.
                                     Each screen now tracks
                                     `originalCoverImage` (captured when
                                     the form opens) specifically to tell
                                     these cases apart on Save/Cancel:
                                     unchanged (matches the original,
                                     nothing to do), replaced (a new
                                     staged file - commit it), or removed
                                     (null, original was non-null - delete
                                     now, not when it was tapped).

                                     **Two further real bugs, found via
                                     testing before Music was removed,
                                     but fixed in this shared file and
                                     still relevant to every category's
                                     cover downloads.** First:
                                     downloadRemoteCover()/
                                     downloadRemoteCoverStaged() used to
                                     hardcode their temp download file to
                                     a `.jpg` extension regardless of the
                                     actual format being downloaded - a
                                     PNG source image being written into
                                     a file literally named `.jpg` could
                                     silently fail the image-processing
                                     step that runs next. Both functions
                                     now derive the real extension from
                                     the URL itself
                                     (`extensionFromUrl()`), falling back
                                     to `.jpg` only when the URL doesn't
                                     make the format clear. Second: both
                                     download functions now retry once
                                     after a short delay specifically on
                                     a 500 response
                                     (`downloadWithRetryOn500()`) - never
                                     on a 404, which is a clean "no art
                                     available" signal a retry would
                                     never help with. Some image hosts
                                     are known to be flaky under load, and
                                     a 500 from one is often transient -
                                     the same request can succeed seconds
                                     later. Also added logging on a
                                     non-200 download status, previously
                                     a completely silent `return null`
                                     with no trace at all.
  theme.tsx                        App-wide theme via React Context -
                                     colors, Light/Dark mode, font scale.
                                     Independent from Home Base/League Base.
  notifications.ts                 Schedules/cancels the daily 10am
                                     "check today's recommendations"
                                     reminder (Settings > Permissions).
                                     Two separate call sites -
                                     App.tsx re-runs the schedule call on
                                     every launch (keeps the
                                     notification's content in sync with
                                     the current code, since a scheduled
                                     notification doesn't retroactively
                                     update itself), and
                                     PermissionsSettingsScreen.tsx calls
                                     it when the toggle is switched on.
                                     Both do a "cancel everything, then
                                     schedule one" sequence - confirmed
                                     via a real, recurring report that
                                     this can duplicate the notification
                                     if two calls ever overlap (a
                                     launch-effect call still in flight
                                     when a toggle call starts, or the
                                     app relaunched/force-quit mid-call),
                                     since each call's own cancel can run
                                     before the OTHER call's schedule.
                                     Both exported functions now go
                                     through a module-level serialize()
                                     lock - every call waits for whatever
                                     is already in flight to finish
                                     first, so two cancel+schedule
                                     sequences can never run at once
                                     regardless of which call site (or
                                     combination) triggers it.
  isbnLookup.ts                     Category-agnostic ISBN lookup (Open
                                     Library primary, Google Books
                                     fallback, Open Library search-index
                                     as a third genre-only fallback) plus
                                     the genre-allowlist matching engine.
                                     Extracted out of BookScreen.tsx so
                                     Comics/Manga (and any future
                                     ISBN-based category) share the same
                                     already-debugged logic instead of a
                                     second copy needing every future fix
                                     applied twice. Each category still
                                     supplies its own genre allowlist.
                                     NOT used by Movies or TV Shows - see
                                     movieLookup.ts/tvLookup.ts below. Also
                                     captures a
                                     coverUrl when available (Open
                                     Library's own edition cover data,
                                     Google Books' thumbnail, or a
                                     directly-constructed Open Library
                                     ISBN-covers-API URL as a last
                                     resort) - fed straight into
                                     coverStorage.ts's downloadRemoteCover(),
                                     no extra lookup call needed.
  config.ts                         Git-ignored (this repo is public) -
                                     holds the real TMDB_READ_ACCESS_TOKEN.
                                     Movies' and TV Shows' title-search
                                     auto-fill both need this free
                                     credential from themoviedb.org, since
                                     unlike Open Library/Google Books
                                     there's no keyless source for real
                                     movie/TV metadata. Specifically the
                                     "API Read Access Token" (v4 auth, a
                                     long JWT-style string, used via a
                                     `Authorization: Bearer` header) -
                                     not the shorter "API Key" (v3 auth,
                                     used via `?api_key=`) shown on the
                                     same TMDb settings page. Switched to
                                     the v4 token after the v3 key
                                     returned a real, confirmed 401
                                     (verified independent of this app,
                                     via a plain browser request) even
                                     once TMDb's account page showed it
                                     as registered - TMDb's own community
                                     has documented cases where the Read
                                     Access Token validates successfully
                                     before the API Key does, during the
                                     same account-side propagation
                                     window. movieLookup.ts/tvLookup.ts
                                     both log a clear
                                     console warning (not a silent
                                     failure) if a lookup is attempted
                                     before this is filled in.
  config.example.ts                 The tracked template - what actually
                                     stays in the public repo. Copy this
                                     to config.ts and paste your own
                                     token in for a fresh clone.
  movieLookup.ts                    Movies' TMDb integration - renamed
                                     from upcLookup.ts after Movies
                                     dropped barcode/UPC scanning
                                     entirely. Real testing confirmed the
                                     old UPC pipeline (UPC -> a rough
                                     retail title via UPCitemdb -> a
                                     title-cleaning regex -> a TMDb
                                     search) was unreliable in practice -
                                     always the structurally weaker path
                                     here, since it was three hops deep
                                     versus Books/Comics' direct ISBN
                                     lookup or TV Shows' direct title
                                     search. Title Search was already the
                                     reliable path being used, so it's
                                     now the only entry-assist method,
                                     matching TV Shows exactly. Kept what
                                     was still needed - TMDB_GENRE_NAMES
                                     (TMDb's own fixed, official 19-genre
                                     list, verified directly against
                                     their live API response),
                                     tmdbSearchMovies() (reused by
                                     lib/titleSearch.ts's
                                     searchMoviesByTitle()), and
                                     looksLikeIsbn() (not Movies-specific
                                     logic, kept for any future UPC-based
                                     category - Vinyl/CD, Tabletop Games
                                     - that could hit the same bundled-
                                     print-material ambiguity). Removed the
                                     UPCitemdb lookup and title-cleaning
                                     regex as genuinely dead code rather
                                     than leaving them unused. Added
                                     tmdbMovieWatchUrl(), mirroring
                                     lib/tvLookup.ts's tmdbWatchUrl()
                                     exactly, for the new "Where to
                                     Watch" button - links to TMDb's own
                                     watch page rather than a custom
                                     in-app provider list, same
                                     JustWatch-attribution reasoning as
                                     TV Shows below.
  tvLookup.ts                       TV Shows' TMDb integration - a
                                     separate file from movieLookup.ts
                                     despite both using TMDb, since TV has
                                     its own official genre taxonomy
                                     (confirmed via TMDb's live API - no
                                     separate Horror/Thriller/Romance, but
                                     Kids/News/Reality/Soap/Talk exist
                                     here that don't for movies) and
                                     TMDb's TV endpoints use different
                                     field names entirely (`name` instead
                                     of `title`, `first_air_date` instead
                                     of `release_date`). No number-entry
                                     pipeline at all - confirmed design,
                                     title search is TV Shows' only
                                     assisted entry method, and Movies
                                     later became the same way once its
                                     own barcode/UPC entry was removed -
                                     the two are structural twins in this
                                     specific respect now, though this
                                     file stayed separate regardless,
                                     since the genre/field-name
                                     differences above are real and
                                     unrelated to that later change. Just
                                     tmdbSearchTVShows() (reused directly
                                     by lib/titleSearch.ts's
                                     searchTVShowsByTitle(), same split as
                                     Movies) and tmdbWatchUrl() for the
                                     "Where to Watch" button. That button
                                     deliberately links to TMDb's own
                                     watch page rather than building a
                                     custom in-app provider list - that
                                     data is licensed from JustWatch and
                                     requires attribution everywhere it's
                                     shown, not just once in Credits;
                                     linking to TMDb's own page (which
                                     already has correct JustWatch
                                     branding) sidesteps needing to build
                                     and maintain that ourselves. Defaults
                                     to the US region - not yet
                                     configurable, worth revisiting if
                                     international support is ever needed.
  jikanLookup.ts                    Anime's fallback data source -
                                     MyAnimeList data via Jikan
                                     (api.jikan.moe), a free, keyless REST
                                     wrapper. Tried only when TMDb (Anime's
                                     primary source, reusing
                                     tvLookup.ts's tmdbSearchTVShows() -
                                     most mainstream-popular anime is
                                     catalogued there as a regular TV
                                     show) comes back with nothing - same
                                     multi-source resilience pattern
                                     already established for Books/Comics
                                     (Google Books primary, Open Library
                                     fallback). Genuinely different result
                                     shape from TMDb: MyAnimeList's own
                                     genre taxonomy (Isekai, Mecha,
                                     Shounen, etc. - meaningfully more
                                     anime-specific than TMDb's generic TV
                                     genres) and different field names
                                     (mal_id instead of id,
                                     images.jpg.large_image_url instead of
                                     poster_path). A Jikan-sourced result
                                     never carries a tmdbId - MyAnimeList
                                     doesn't cross-reference TMDb, so an
                                     anime found only through this
                                     fallback gets real title/genre/cover
                                     data but no Where to Watch button, a
                                     real and deliberate consequence of
                                     this design, not an oversight.
  discogsLookup.ts                  Vinyl/CD's barcode and title-search
                                     lookup - Discogs' database API.
                                     Needs a personal user-token
                                     (lib/config.ts's
                                     DISCOGS_USER_TOKEN, not the
                                     app-level Consumer Key/Secret Discogs
                                     also issues - that's for a full
                                     OAuth 1.0a login flow other users
                                     would go through, which this
                                     personal-use app doesn't need). Rate
                                     limit is 60 requests/minute
                                     authenticated - real, but far more
                                     workable than MusicBrainz's ~1/second
                                     ever was for the since-removed Music
                                     category, especially for a personal
                                     app adding entries one at a time.
                                     Confirmed via real research before
                                     writing this, not guessed: search
                                     results return a COMBINED
                                     "Artist - Title" string in the title
                                     field (splitDiscogsTitle()), not
                                     separate fields the way TMDb/
                                     MusicBrainz results are - every
                                     result needs splitting apart. Genre
                                     and style are both arrays (Discogs'
                                     own hierarchy - genre is the broad
                                     grouping, style the specific
                                     sub-genre) and get combined into this
                                     app's single genre field
                                     (combineGenres()), matching every
                                     other category's one-genre-field
                                     convention - see
                                     types/models.ts's VinylCD comment for
                                     why there's no separate style field.
                                     Cover art comes bundled directly in
                                     the search response - no separate
                                     cover-art service needed, unlike
                                     Music's whole Cover Art Archive saga
                                     (wrong image format, missing
                                     headers, flaky 500s). The barcode
                                     param is a real, direct search
                                     filter, not a fuzzy multi-hop chain
                                     the way Movies' old UPC approach
                                     turned out to be - closer in spirit
                                     to Books' ISBN lookup than to Board
                                     Games' still-planned "UPC then fuzzy
                                     name match" approach. Exports
                                     searchDiscogsByBarcode() (the
                                     scan/code-entry path - caller is
                                     responsible for checking
                                     looksLikeIsbn() first, exported from
                                     lib/movieLookup.ts specifically for
                                     this reuse, since a Vinyl/CD box set
                                     can bundle a booklet with its own
                                     ISBN barcode right next to the
                                     disc's real UPC) and
                                     searchDiscogsByTitle() (splits an
                                     "Artist - Title" pattern typed into
                                     the search box into separate query
                                     params for a more precise match on a
                                     common title, same trick already
                                     proven for Music's search).
  titleSearch.ts                     The third entry method (alongside
                                     scan and number-entry): type a
                                     title, get real candidates back, tap
                                     one to fill in every field it has.
                                     For the cases scan/number-entry
                                     can't cover - no working camera, a
                                     damaged/unreadable barcode, a
                                     thrifted book with a sticker over
                                     part of it. Books/Comics search
                                     Google Books by title (reuses
                                     normalizeGenres() from
                                     isbnLookup.ts, so results go through
                                     the same genre-allowlist matching).
                                     **Real bug, found and fixed**: the
                                     first version required every result
                                     to have an ISBN before showing it
                                     ("the whole point is filling that
                                     field in too") - but Google Books'
                                     title-search results frequently omit
                                     that field entirely, even for
                                     extremely well-known titles, which
                                     was silently discarding every single
                                     result and caused a genuine 100%
                                     failure rate on real searches
                                     (confirmed on Harry Potter, The
                                     Hunger Games, and others). ISBN is
                                     now optional on a result - ISBN_13
                                     falls back to ISBN_10 falls back to
                                     `''`, and screens only fill the ISBN
                                     field when one's actually present,
                                     same as manual entry otherwise.
                                     Every search also logs a raw-vs-
                                     usable result count via
                                     console.warn, to make "why no
                                     matches" easy to diagnose going
                                     forward without re-deriving this
                                     from scratch. That logging paid off
                                     immediately: a follow-up report of
                                     zero results with zero console
                                     output turned out to be Google
                                     Books returning 429 (rate-limited) -
                                     the logging had been suppressing 429
                                     specifically, copying reasoning from
                                     isbnLookup.ts's occasional ISBN-blur
                                     lookup that doesn't hold for title
                                     search, which fires on nearly every
                                     keystroke pause and hits that same
                                     free keyless quota far harder. Fixed
                                     two ways: the suppression is gone
                                     (429 now always logs), and
                                     Open Library is now a genuine
                                     independent fallback - tried
                                     whenever Google Books comes back
                                     with nothing at all, including when
                                     rate-limited, since it's a
                                     completely separate service with
                                     its own quota. Same multi-source
                                     resilience pattern isbnLookup.ts
                                     already uses for ISBN lookup, now
                                     applied here too. Movies reuses
                                     movieLookup.ts's tmdbSearchMovies()
                                     directly, its only entry-assist
                                     method now that barcode/UPC scanning
                                     has been removed (confirmed
                                     unreliable via real testing). TV
                                     Shows reuses tvLookup.ts's
                                     tmdbSearchTVShows() the same way -
                                     neither category's results carry a
                                     UPC or barcode field at all anymore.
                                     Paired with
                                     `components/TitleSearchInput.tsx` -
                                     the shared debounced-search +
                                     dropdown UI, generic over the result
                                     type so each screen plugs in its own
                                     search function/result shape rather
                                     than four separate copies of the
                                     debounce/dropdown logic itself.
  useAlphabetScroll.ts              The A-Z index jump hook, also
                                     extracted out of BookScreen.tsx -
                                     carries forward three rounds of real
                                     React Native bugs found and fixed
                                     there (two different scrollToLocation
                                     bugs on itemIndex:0, then a
                                     scroll-overshoot rubber-band bounce
                                     on letters near the end of the
                                     alphabet). Any future category with
                                     an A-Z index should use this rather
                                     than reimplementing it. Important
                                     TypeScript detail if you do: the
                                     hook's SectionList ref is typed
                                     `SectionList<T, { title: string }>` -
                                     the `<SectionList>` JSX tag in the
                                     screen using it MUST declare that
                                     same second generic parameter
                                     (`<SectionList<Book, { title: string }>>`),
                                     or TypeScript doesn't know the
                                     sections have a `title` field and
                                     `renderSectionHeader` fails to
                                     type-check ("Property 'title' is
                                     missing in type SectionBase<...>").
                                     A fourth round of scroll issues (real
                                     jumpiness reported specifically near
                                     the END of the alphabet, on Comics/
                                     Manga at 45 entries) traced to the
                                     row-height used in the jump estimate
                                     being a hardcoded guess rather than a
                                     real measurement - guess-error
                                     compounds with every row summed, so
                                     it's worst exactly at the letters
                                     with the most rows counted before
                                     them. Fixed by measuring real
                                     rendered rows (`recordRowHeight`,
                                     wired to an `onLayout` on each row in
                                     both screens' `renderItem`) and using
                                     the running average instead of the
                                     guess - any future category screen
                                     should wire this the same way rather
                                     than skipping it "since the guess
                                     was probably fine." That fix itself
                                     then caused a fifth, separate scroll
                                     bug: it wired `recordRowHeight` via
                                     an extra `<View onLayout={...}>`
                                     wrapped around each row, and that
                                     extra native view plus an `onLayout`
                                     dispatch per row as cells recycle
                                     during scroll was enough to cause
                                     real continuous stutter while
                                     actively scrolling (reported right
                                     after, same screen). Fixed two ways:
                                     `recordRowHeight` now caps itself at
                                     `MAX_ROW_HEIGHT_SAMPLES` instead of
                                     doing this work for the screen's
                                     whole lifetime, and `BookCard`/
                                     `ComicCard` now accept `onLayout` as
                                     a prop and attach it directly to
                                     their existing outer `TouchableOpacity`
                                     - a prop on an element that already
                                     exists, instead of an entirely new
                                     native view per row. Any future
                                     category's card component should
                                     accept `onLayout` the same way rather
                                     than reintroducing a wrapper. Even
                                     after that, real stutter persisted
                                     specifically on Comics/Manga - a
                                     sixth fix, and the one that actually
                                     addressed the true root cause:
                                     without `getItemLayout`, RN has to
                                     *measure* each row as it scrolls into
                                     view rather than calculate its
                                     position, and Comics/Manga rows
                                     genuinely varied in height far more
                                     than Books' - 3-4 genres wrapping to
                                     a second line was common (manga
                                     format + genre + demographic tags
                                     naturally co-occur on real subject
                                     data), plus a real duplicate-genre
                                     bug ("Superheroes, Superhero, Fiction"
                                     - both singular and plural forms of
                                     the same BISAC term ended up on the
                                     allowlist) was inflating that further.
                                     Fixed at the source in
                                     `BookCard`/`ComicCard`: removed the
                                     redundant `'Superhero'` from Comics'
                                     allowlist (kept `'Superheroes'`, the
                                     actual BISAC term), capped the
                                     genre display to 2 (`+N` for the
                                     rest - full list still shown/
                                     editable in the Add/Edit form), and
                                     added `numberOfLines={1}` to all
                                     three text lines on every card. That
                                     last part is the real fix - it
                                     forces every row to a genuinely
                                     fixed height instead of a shorter
                                     *average* one, which is what
                                     virtualized-list measurement
                                     actually needs to stay smooth
                                     without `getItemLayout`. Deliberate
                                     visible tradeoff: long titles/
                                     author-genre lines now truncate with
                                     an ellipsis instead of wrapping.

                                     That confident "this is the real fix"
                                     claim turned out to be wrong too - a
                                     clean --clear build confirmed it
                                     genuinely didn't help, and the report
                                     got more specific: the screen went
                                     fully **blank** while scrolling, and
                                     specifically failed jumping to
                                     letters near the end (S-Z). The
                                     diagnostic that actually cracked it,
                                     seventh round: sorting by "Read?"
                                     (which renders the exact same
                                     `ComicCard`/`renderItem` via plain
                                     `FlatList` - no sections, no sticky
                                     headers, no A-Z bar at all) scrolled
                                     perfectly fine. Since the ROWS are
                                     identical in both list modes, that
                                     single test proved the rows were
                                     never the problem - all three prior
                                     rounds (the onLayout wrapper, then
                                     row-height uniformity) had been
                                     fixing the wrong layer. The real
                                     differentiator is `SectionList`
                                     itself: **sticky section headers**
                                     have real overhead that scales with
                                     how many section boundaries you
                                     cross while scrolling, not with row
                                     content - and Comics/Manga's real
                                     data has many more small sections
                                     (mostly 1-2 items per starting
                                     letter, per a real screenshot) than
                                     Books' denser, more clustered
                                     sections, making it a genuinely
                                     harder case for sticky headers
                                     specifically even with identical row
                                     rendering. Fixed with
                                     `stickySectionHeadersEnabled={false}`
                                     on both `<SectionList>` tags (Books
                                     included, for consistency and in
                                     case its own section distribution
                                     ever spreads out more). Lesson for
                                     next time a symptom doesn't match
                                     the fix: compare the two list modes
                                     BEFORE changing anything, rather
                                     than reasoning from code alone - the
                                     three earlier rounds could have been
                                     skipped entirely with that one test
                                     upfront.

components/
  AppText.tsx                      Drop-in replacement for RN's <Text> -
                                     applies JetBrains Mono (Extra Bold for
                                     variant="header", Regular by default).
                                     Every screen imports Text from here,
                                     not from 'react-native'. TextInputs
                                     aren't covered by this (RN doesn't
                                     route TextInput through Text) - they
                                     get `fontFamily: FONT_FAMILY.body`
                                     set directly instead.
  ScreenHeader.tsx                  Every screen's header goes through
                                     this - centered title (same size
                                     everywhere), a smaller back link on
                                     the left (or a custom left/right node
                                     for icons/Cancel/Save), and safe-area
                                     padding read directly via
                                     useSafeAreaInsets rather than relying
                                     only on the parent SafeAreaView. That
                                     second part matters: SafeAreaView's
                                     automatic inset isn't reliable inside
                                     a <Modal> on iOS, which is what made
                                     Cancel/Save unreachable under the
                                     status bar on the Add/Edit Book
                                     screen before this existed. The back
                                     label and title columns are also
                                     width-capped against each other
                                     (SIDE_MAX_WIDTH / TITLE_INSET) - a
                                     long back label ("Settings") and a
                                     long title ("Permissions") together
                                     at larger text sizes could otherwise
                                     visually run into each other with no
                                     gap, since the title paints on top.
  TitleSearchInput.tsx              The shared "type a title, get real
                                     candidates back, tap one to fill in
                                     everything" dropdown - the third
                                     entry method, paired with
                                     lib/titleSearch.ts. Generic over the
                                     result type (`<T>`) so Books/Comics/
                                     Movies each plug in their own search
                                     function and result shape without a
                                     separate copy of the debounce +
                                     dropdown UI. Renders as a drop-in
                                     replacement for a plain TextInput -
                                     the results dropdown is absolutely
                                     positioned below it, so the field
                                     using it needs `zIndex` bumped above
                                     whatever form fields come after it
                                     (see how BookScreen/ComicScreen/
                                     MovieScreen's Title field wraps
                                     itself in `{ zIndex: 20 }`), or
                                     later fields would paint over the
                                     dropdown instead of the other way
                                     around. Debounce delay is
                                     configurable via an optional
                                     `debounceMs` prop (defaults to
                                     400ms) - added for a since-removed
                                     category (Music) whose data source
                                     had a real, tight rate limit
                                     (~1 request/second per IP); no
                                     current category needs a
                                     non-default value, but the prop
                                     stays available for a future
                                     category that might.
  SearchBar.tsx                     Simple inline search filter for
                                     narrowing an already-loaded list by
                                     title (+ author on Books/Comics,
                                     which have that field) - entirely
                                     local/offline, no network calls at
                                     all. Not to be confused with
                                     TitleSearchInput.tsx above, which
                                     searches external catalogs to help
                                     fill in a NEW entry; this one only
                                     ever filters what's already in your
                                     library. Added once Books/Comics
                                     crossed 50-80 entries and the genre
                                     filter alone wasn't enough to
                                     quickly find one specific item by
                                     name. Sits directly below the
                                     "Sorted by X" row on every category
                                     screen, combined with the genre
                                     filter (both narrow the same
                                     underlying list together, not
                                     either/or).
  CoverThumbnail.tsx                Small, FIXED-SIZE cover for list rows
                                     - same dimensions whether a real
                                     cover loaded, is still loading, or
                                     doesn't exist. That fixed size is
                                     deliberate, not a style choice - see
                                     Section 6 (Cover photos) for why it
                                     matters for scroll performance.
                                     Resets its own load-failure state on
                                     every uri change, not just on mount,
                                     since VirtualizedList recycles row
                                     components rather than always
                                     mounting fresh ones.
  CoverPicker.tsx                   Larger, tappable cover for the
                                     Add/Edit form - purely presentational
                                     (shows current state, forwards the
                                     tap), same split as AlphabetBar: the
                                     actual Take Photo/Choose from
                                     Library/Remove Photo action-sheet
                                     logic lives in each screen, not here.
                                     The "Add cover photo" placeholder
                                     text has an explicit `textAlign:
                                     'center'` - `alignItems: 'center'`
                                     on the parent only centers a wrapped
                                     multi-line text block as a whole, not
                                     each individual line within it, which
                                     is what was actually causing a real
                                     reported "not centered" look once
                                     that text wrapped to two lines.

types/models.ts                   Every TypeScript type and shared
                                    constant - the category list, Book
                                    shape, AppSettings. Add a field here
                                    first when changing what an item
                                    stores.

assets/
  icon.png                         App icon (1024x1024)
```

### Category screen pattern (applies to every future category, not just Books)

`screens/BookScreen.tsx` is the reference implementation to copy when
building the remaining categories (Vinyl/CD, Tabletop Games) -
`screens/ComicScreen.tsx`, `screens/MovieScreen.tsx`, and
`screens/TVScreen.tsx` are three real examples of that copy already
done, showing genuinely different degrees of reuse:
- **Comics/Manga** is the closest copy - same shape entirely (multi-genre,
  ISBN lookup/scan, a read switch), built on the same two shared modules
  (`lib/isbnLookup.ts`, `lib/useAlphabetScroll.ts`), with only the genre
  allowlist and wording actually differing.
- **Movies and TV Shows** share `lib/useAlphabetScroll.ts` but don't
  share `lib/isbnLookup.ts` at all - both are TMDb-backed
  (`lib/movieLookup.ts`, `lib/tvLookup.ts`) rather than ISBN-catalogued,
  and TMDb needs a free Read Access Token (`lib/config.ts`) that the
  ISBN path never did. Neither has an author/director field (not part of
  the requested spec for either), and both genre filters show TMDb's own
  full fixed genre list directly rather than only genres currently in
  use - a deliberate difference from Books/Comics' dynamic list, not an
  oversight. **Neither has a scan or number-entry method at all** - title
  search is the only entry-assist method for both, confirmed design for
  TV Shows from the start, and true for Movies too after its original
  UPC/barcode scanning was removed once real testing showed that
  multi-hop lookup chain (UPC → messy retail title via UPCitemdb → TMDb
  search) was unreliable in practice, with Title Search already being
  the reliable path being used. Movies and TV Shows are structural twins
  now in every way that matters here - same entry-assist shape, same
  "Where to Watch" button (`tmdbMovieWatchUrl()` / `tmdbWatchUrl()`,
  same placement between Genre and the Watched toggle, same graceful-hide
  behavior when an entry has no stored `tmdbId`) - genuinely different
  only in their genre taxonomies and a couple of TMDb field names
  (`name`/`first_air_date` vs `title`/`release_date`).
- **Books/Comics still offer three entry methods** - scan, number-entry
  (ISBN), and title search (`lib/titleSearch.ts` +
  `components/TitleSearchInput.tsx` - type a title, get real candidates
  back, tap one to fill in every field it has) - leading with scan since
  it's genuinely reliable there (ISBN uniquely identifies a specific
  edition). **Movies and TV Shows only ever offer title search** - not a
  reduced/fallback version of the three-method pattern, a deliberate,
  confirmed-correct design for a category with no reliable
  number-lookup path to begin with.

A future category screen should follow this same split: reuse
`lib/useAlphabetScroll.ts` unconditionally (any category with an A-Z
index benefits from its four rounds of bug fixes), reuse
`lib/isbnLookup.ts` only if the category actually has ISBNs (Books,
Comics/Manga - not Movies, TV Shows, Vinyl/CD, Tabletop Games, which all
need their own lookup shape per the Roadmap doc), reuse
`components/TitleSearchInput.tsx` for the title-search entry method
regardless of category (only the search function/result shape passed
into it differs), and only duplicate what's genuinely category-specific
(the form fields, the row component, the allowlist or genre source).
- **The row component (`BookCard`) is defined at module scope and wrapped
  in `React.memo`** - not as a plain function inside the screen's body.
  This is what actually fixes React Native's "VirtualizedList: You have a
  large list that is slow to update" warning and genuinely sluggish
  scrolling/filtering once the list has 50+ entries: with a plain inline
  render function, every visible row re-rendered from scratch on *any*
  state change anywhere on the screen (typing in a filter, toggling
  selection, even just scrolling), because the list's `renderItem`
  callback got a new identity every render. `renderItem` itself is still
  a `useCallback` (its own identity does still change when things like
  `selectedIds` change), but because `BookCard` is memoized, React skips
  re-rendering any individual row whose actual props (`book`, `selected`,
  `selectionMode`) didn't change, even when the outer `renderItem`
  reference did. The row's `onPress` handler (`handleCardPress`)
  deliberately only depends on `selectionMode` - not `selectedIds` or
  `books` - by receiving the full `book` object rather than an id to look
  up, so routine sorting/filtering/data-reloading never invalidates it.
  Any future category screen copying this pattern should keep its own
  row component defined the same way (module-scope, `React.memo`) rather
  than reverting to an inline render function for convenience.
- Header right slot is a **"•••" menu** (`Ionicons ellipsis-horizontal`),
  not a persistent "+ Add" button or a visible filter-chip row - tapping
  it shows **+ Add entry / Filter by... / Filter by genre...**.
  Each opens a second native picker (`Alert.alert` with one button per
  option). Deleting multiple entries is **not** one of this menu's
  options, deliberately - see the next bullet.
- **Press and hold any row to bulk-delete** - matches iOS's own
  long-press-to-select pattern (Photos, Mail, Files), rather than a
  `•••` menu entry. Switches the whole screen into a **selection
  mode**: the header becomes Cancel / "N selected" / Delete, the row
  actually held is already checked (same as those native apps do -
  never opens into an empty selection), tapping other rows toggles a
  checkmark instead of opening them for editing, and Delete bulk-removes
  everything selected in one call (`storage.deleteBooks(ids)` - one
  read/write instead of one per item). `enterSelectionMode(itemId)` now
  requires the id of whatever was held, rather than being callable with
  no argument. This went through two earlier versions before landing
  here: first a picker listing up to 10 book titles as buttons (hit
  Android's `Alert.alert` 3-button cap with a long title list), then a
  "- Delete entries" `•••` menu item - removed specifically to keep that
  menu from growing further, once long-press was available as a more
  standard, more discoverable path to the exact same selection mode.
- **Tapping any row opens it for editing** (outside selection mode) -
  every field is editable, and a **Delete** button lives inside that same
  edit screen for removing just that one entry.
- **No duplicate entries**: on save, a same-title match (trimmed,
  case-insensitive) against anything already tracked - other than the
  item currently being edited - blocks the save with an alert instead of
  creating a second copy.
- **Multi-genre entries**: a book can carry more than one genre tag
  (entered comma-separated, e.g. "Romance, Contemporary"). Genre isn't
  one of the "Filter by..." **sort** options (Title/Author/Read?/Rating)
  - it used to be, but that was redundant/confusing once genre got its
  own dedicated menu item: **"Filter by genre..."** in the ••• menu shows
  every distinct tag currently in use and narrows the list to books that
  have that tag *anywhere* in their list, not just a "primary" one. The
  active filter shows next to "Sorted by X" and clears with a tap.
  (`genres[0]` is still tracked internally as the nominal first tag, but
  nothing in the UI sorts or groups by it anymore.)
- **Rating sort**: descending - 5 stars first, then 4, 3, 2, 1. Unrated
  items (`rating: null`) sink to the very bottom rather than sorting as
  if they were a 0-star rating, which would otherwise put every
  not-yet-rated book ahead of a genuine 1-star one. Same flat-list
  treatment as Read?/Watched? (no A-Z index - not in `ALPHA_FIELDS`),
  since it isn't alphabetical either. The star count is already visible
  on every row regardless of sort (`Read · 4★`), so no card changes were
  needed to make this sort useful to look at.
- **Tap an author's name to filter to just their books (Books/Comics
  only - Movies has no author field)**: deliberately *not* a new
  `•••` menu item, per explicit request to avoid growing that menu
  further - the author name in each card is its own nested
  `TouchableOpacity`, disabled during selection mode so a tap there
  just toggles selection like everywhere else on the card. Mirrors
  genre's existing filter chip exactly (shown next to "Sorted by X",
  clears with a tap), and the two filters clear each other rather than
  combining - tapping an author clears any active genre filter, and
  picking an actual genre from "Filter by genre..." clears any active
  author filter - so a stray tap from one origin can't leave you in a
  confusing combined-filter state you didn't intend. The author/genre
  text line, previously one combined string, is now a `View` row with
  the author as its own tappable segment (styled in the accent color to
  look tappable) followed by a genre `AppText` that starts with the
  separator only when an author is actually present.
- **Real barcode scanning (Books specifically)**: "📷 Scan barcode
  instead" switches the Add/Edit Book modal's content over to a
  full-screen `expo-camera` `CameraView` restricted to `ean13` codes -
  deliberately *within the same `<Modal>`* rather than as a second,
  separate one. iOS doesn't reliably present two independent modals at
  once; stacking a second `<Modal>` on top of the Add/Edit one meant the
  scanner's presentation got silently queued until the first was
  dismissed, so it only ever seemed to open right after tapping Cancel.
  The scanner's own Cancel button positions itself with `insets.top`
  from `useSafeAreaInsets` directly rather than a `SafeAreaView` - same
  fix as `ScreenHeader`: `SafeAreaView`'s automatic inset isn't reliable
  inside a `Modal` on iOS, which had been pinning that Cancel button up
  under the status bar/notch where it couldn't be tapped at all. Camera
  permission is requested lazily right here (not on app launch) via
  `useCameraPermissions` - if already denied outside the app, it routes
  straight to Phone Settings instead of a native prompt that wouldn't
  appear anyway, same pattern as Settings → Permissions. Scans are
  filtered to codes starting `978`/`979` (the real Bookland ISBN
  prefixes) so scanning something unrelated (a snack wrapper, a shipping
  label) can't silently fill in wrong data. A `useRef` lock stops
  `onBarcodeScanned` from firing dozens of times while the same code
  sits in frame - `useState` would be too slow for that. A valid scan
  runs through the exact same `applyIsbnDigits`/`runIsbnLookup` path as
  typing an ISBN by hand, just triggered immediately instead of waiting
  for the field to lose focus (there's no "blur" event from a scan). Not
  device-tested from the sandbox this was built in - the `expo-camera`
  API surface is stable and well-documented for this SDK, but a real
  scan-to-fill run-through is worth doing before relying on it for bulk
  entry.
- **Live ISBN formatting/validation (Books specifically)**: as digits are
  typed, once there are 10 or 13 of them the field reformats itself with
  the real, official hyphen positions (via `isbn3`, which bundles the
  actual ISBN-agency range data - there's no fixed pattern like a phone
  number that could be hand-written for this) and checks the checksum
  digit, showing "✓ Valid ISBN" or a "check digit doesn't look right"
  warning immediately - catching a mistyped digit before it ever reaches
  the lookup below. This doesn't block saving; it's advisory only.
- **Optional ISBN field (Books specifically)**: filling it in and moving
  to the next field (or a successful scan) triggers an automatic lookup
  against Open Library and Google Books **in parallel**, merging the two
  field by field rather than treating the second as an all-or-nothing
  fallback - if one source has the title but not the author, the other
  gets checked for just that field instead of being skipped entirely.
  This is deliberate: an earlier "only check the second source if the
  first came back completely empty" version was why some books ended up
  with a blank title even though one of the two databases actually had
  it. Genre specifically prefers Google Books' categories when available
  (usually one or two clean BISAC-style entries like "Fiction / Romance")
  over Open Library's much noisier subject list. Whichever source's genre
  data gets used goes through `normalizeGenres()`, which strips
  Library-of-Congress-style parenthetical qualifiers and trailing
  era/decade suffixes ("Poetry (poetic works by one author)" → "Poetry",
  "Fiction, 21st century" → "Fiction") and then matches what's left
  against `GENRE_ALLOWLIST` - a fixed, curated list of real genre terms.
  **Only a match against that list can ever become a filled-in genre** -
  everything else gets dropped, no matter how it's phrased. This replaced
  an earlier approach of reactively blocking known-bad patterns
  (bestseller-list stamps, administrative tags) one at a time as new bad
  examples turned up, which was still letting real subject-heading noise
  through - confirmed real examples: "Futurology," "Girl Next Door,"
  "Hieros Gamos," "Mechanical Hound," "Mob Mentality" - because Open
  Library's raw subject data mixes plot keywords, character names, and
  settings in with actual genres, with no reliable way to tell them apart
  algorithmically. An allowlist sidesteps that entirely: whatever's in
  `GENRE_ALLOWLIST` (in `screens/BookScreen.tsx`) is what can show up,
  full stop - adding a missing genre or removing one you don't want is a
  one-line edit to that array, not a new filtering rule to write and
  test.

  Both `GENRE_ALLOWLIST`s (Books' and Comics/Manga's in
  `screens/ComicScreen.tsx`) are grounded in **BISAC** (Book Industry
  Standards and Communications) - the real classification system the US
  book trade actually uses, and what Google Books' own `categories` field
  is drawn from - verified directly against BISG's official 2025 heading
  lists rather than improvised. The first version of Books' list covered
  mainstream fiction well but was missing most nonfiction categories
  entirely (no Architecture, Computers, Crafts, Gardening, Law,
  Mathematics, Medical, Nature, Pets, Photography, Reference, and more) -
  a real coverage gap raised directly, fixed by cross-checking against
  BISG's actual top-level list. A couple of real BISAC categories were
  deliberately left out or shortened: full compound headings like
  "Business & Economics" rarely appear verbatim in real subject data, so
  the shorter core term is used instead ("Economics"); and a couple of
  single common words that are technically real BISAC categories (Games,
  Home) were left out because they risk matching unrelated proper-noun
  tags (e.g. "Games" inside "The Hunger Games" as a thematic keyword) -
  a genuine precision/recall tradeoff, flagged here rather than silently
  decided either way.

  **If genre is still missing after merging those two**, a third source
  gets tried: Open Library's *search index* (`search.json?isbn=...`)
  rather than its single-edition record. The search index is aggregated
  across every edition/printing of a work, so it's often populated with
  a genre even when this specific ISBN's own edition record is sparse -
  though sometimes a book genuinely has no genre data in any of the
  three sources (confirmed on a real example: Open Library's own edition
  page for it had a completely empty Subjects section), which isn't a
  bug, just a real gap in free bibliographic data. This third lookup
  only fires when actually needed, since it costs an extra network round
  trip.

  **Cross-category ISBN mismatch detection**: scanning/entering a comic
  or manga's ISBN inside Books gets denied ("That looks like a
  Comic/Manga"), and vice versa inside Comics/Manga - in both cases
  nothing gets auto-filled, and the alert points at the correct screen.
  This works off `isLikelyComic` in `IsbnLookupResult`
  (`lib/isbnLookup.ts`), computed by checking the RAW category/subject
  strings for an explicit comics/graphic-novel/manga signal
  (`COMIC_SIGNAL_PATTERN`) - deliberately checked against the raw,
  unfiltered data rather than the already-allowlist-matched genre list,
  since that list is a much weaker signal in both directions: Books'
  allowlist legitimately includes "Graphic Novel"/"Comics" (a prose book
  *about* comics could have that genre), and Comics/Manga's allowlist
  legitimately includes general fiction genres like "Romance"/"Fantasy"
  that a real comic could equally have. **The two directions have
  genuinely different confidence levels** - flagged honestly rather than
  treated as symmetric: a *positive* comic-signal match (Books' side) is
  reliable, since publishers consistently tag comics/graphic novels/manga
  with BISAC's own "COMICS & GRAPHIC NOVELS" heading. The *absence* of
  that signal (Comics/Manga's side) is weaker evidence - it only means
  "no comic classification was found," not "this is confirmed to be a
  regular book" - so that check only fires when there's real genre data
  to go on at all (an ISBN with no classification data isn't confidently
  "not a comic," it's just unclassified), and its alert says so rather
  than asserting it flatly. Both directions only block the *auto-fill* -
  manual entry is never blocked, same as everywhere else in this app.

  Not network-testable from the sandbox this was built in - not every
  book is indexed in either free database, especially older or less
  mainstream titles, so an occasional genuine "couldn't find that ISBN"
  is an expected limitation rather than a bug; API errors and "genuinely
  no match" both log a `console.warn('Media Base: ...')` to help tell
  those apart. One exception: Google Books returning a 429 (rate-limited)
  is deliberately *not* logged - it happens routinely during a bulk
  scanning session since there's no API key (a shared, low quota), and
  Open Library is the primary source anyway, so it isn't worth surfacing
  as if it were unexpected. Categories without a clean ISBN-equivalent
  (Movies use UPC, which is messier - see the Roadmap doc) will need
  their own lookup approach rather than copying this one directly.
- **A-Z index** on the right edge, only shown when sorted by an
  alphabetical field (Title/Author here). Tapping a letter scrolls the
  underlying `ScrollView` directly to an *estimated* pixel offset
  (`estimateSectionOffset()`, based on rough row/header height guesses),
  rather than using `SectionList.scrollToLocation` at all. Two rounds of
  real React Native bugs in that API led here:
  `scrollToLocation({ itemIndex: 0 })` - which every letter-jump needs to
  pass, since jumping to the *start* of a section is the whole point -
  is documented as either silently doing nothing
  (facebook/react-native#50143) or unconditionally snapping to the
  *first* section regardless of which one was requested
  (facebook/react-native#48032). A "call it twice" workaround was tried
  first and didn't reliably scroll; a version after that added a
  delayed follow-up `scrollToLocation` call meant to correct estimate
  drift once the target section was measured - that call was hitting the
  #48032 bug specifically, which is why the list would jump to the right
  letter and then immediately spring back to the very top a moment
  later. Removing that follow-up call entirely (keeping only the direct
  `ScrollView.scrollTo` estimate) is what actually works. Tradeoff: it's
  an estimate, so it can land a little short/long, especially for long
  book titles that wrap to two lines - there's no further "precision
  correction" pass anymore, since that's exactly what was breaking it.

  One more real bug this surfaced: the per-row height estimate's error
  accumulates with every row summed, so a letter near the **end** of the
  alphabet (where most rows have already been counted) can accumulate
  enough error to land the target way past the list's actual scrollable
  height - jumping to "T" on a 65-book list was overshooting badly enough
  that iOS's rubber-band bounce made it look like the app was "freaking
  out" (confirmed from a screen recording: slides down, then violently
  snaps back). Fixed by tracking the real measured content height
  (`onContentSizeChange`) and viewport height (`onLayout` on the
  container) in refs, and clamping the estimated target to
  `Math.max(0, contentHeight - viewportHeight)` before scrolling - the
  estimate can still be imprecise, but it can never ask for more scroll
  distance than actually exists, so it can't overshoot into that bounce
  regardless of how far off the per-row guess is.

  A follow-up report (75 books, most starting with "T") showed *manual*
  finger-drag scrolling was also jumpy/resistant specifically around that
  large section - a different problem from the jump-overshoot above,
  since dragging never calls `jumpToLetter` at all. Two real causes,
  both about `SectionList` doing more repeated work than it needed to:
  1. `renderSectionHeader` was an inline arrow function, given a new
     identity on every render. `SectionList` keeps the current section's
     header "stuck" at the top while you scroll through it
     (`stickySectionHeadersEnabled` defaults to true), so that header was
     re-rendering continuously for the *entire* time spent scrolling
     through a section - fine for a small section, a real cost for a
     77-row one. Fixed the same way `renderItem` already was: a stable
     `useCallback`.
  2. Default `FlatList`/`SectionList` virtualization settings render a
     fairly generous window of off-screen content ahead/behind - fine
     normally, but scrolling fast through a dense section means a burst of
     brand-new rows mounting (not just re-rendering) in a short window,
     which is real work even with `BookCard` memoized (memoization
     avoids unnecessary *re-renders*, not the cost of an *initial* mount).
     Tuned `windowSize={11}`, `maxToRenderPerBatch={12}`,
     `updateCellsBatchingPeriod={50}`, and `initialNumToRender={12}`
     (down from React Native's defaults) on both lists to smooth that
     out - smaller, more frequent render batches instead of large,
     infrequent ones.

  If list performance is still an issue as the book count grows well
  past this, the next lever to pull is `getItemLayout` (lets
  `FlatList`/`SectionList` skip measuring entirely) - not attempted yet
  since row height genuinely varies with title/genre-list wrapping, and
  a wrong `getItemLayout` value causes visible gaps/overlaps rather than
  just imprecision, so it needs real on-device measurement data to do
  safely rather than another guess.

  Not shown for the non-alphabetical Read? sort.
- **Keyboard doesn't cover fields while typing**: the Add/Edit form is
  wrapped in React Native's built-in `KeyboardAvoidingView`
  (`behavior="padding"` on iOS, `"height"` on Android) plus the
  `ScrollView`'s `automaticallyAdjustKeyboardInsets` prop, so fields
  further down the form (like Author) stay reachable/visible instead of
  being hidden behind the keyboard. Deliberately used React Native's core
  component here rather than adding a third-party keyboard-avoiding
  library, matching this project's preference for reaching for what's
  already built in before adding a new dependency. `DataSettingsScreen`
  needed the exact same fix for the same reason - its backup-import
  paste box was inside a plain `View` with no scroll at all, so with the
  keyboard up there was no way to reach the Import button below it *or*
  dismiss the keyboard by tapping away. Fixed the same way, plus a
  `TouchableWithoutFeedback` wrapping the screen's content that calls
  `Keyboard.dismiss()` on an outside tap (the Add/Edit form doesn't need
  this addition since Cancel/Save in its header are always reachable
  regardless of keyboard state).

**Known limitation worth knowing before relying on this further:**
`Alert.alert` shows unlimited buttons on iOS but caps at 3 on Android -
fine for now since only iOS is targeted, but the Filter/Filter-by-genre/
Delete menus (3, "however many distinct genre tags exist", and
up-to-10 options respectively) will need a real action-sheet component
(e.g. `@expo/react-native-action-sheet`) before this app could support
Android.

### Home screen daily recommendation

The "Try today" suggestion on each widget is meant to stay fixed for the
whole calendar day, not re-roll on every refresh/app reopen - handled by
`getDailyPick`/`saveDailyPick` in `lib/storage.ts` (generic, keyed by
category, so future categories can reuse it rather than each rolling
their own version) plus `toLocalDateString()`, which is a plain local
Y-M-D string rather than `toISOString()` - the same UTC-rollover bug
documented in Home Base's README applies here too. `HomeScreen.tsx`'s
`load()` reuses today's stored pick if it's still valid (same date,
book still exists and still unread), and only rolls a new one if the day
has changed or the previous pick got marked read/deleted since.

### Where to make common changes

- **Add or change a category's screen** → its file in `screens/`, plus a
  matching type in `types/models.ts` and functions in `lib/storage.ts`
- **Change what data an item stores** → add the field in
  `types/models.ts`, then add/update the matching function in
  `lib/storage.ts`
- **Change global colors, Light/Dark mode, or text size** →
  `lib/theme.tsx`
- **Change onboarding or which categories exist at all** →
  `types/models.ts`'s `ALL_CATEGORIES`/`CATEGORY_LABELS`, plus
  `screens/OnboardingScreen.tsx`
- **Change camera/permission behavior** →
  `screens/PermissionsSettingsScreen.tsx`

---

## 5. Permissions

Camera access is used for exactly one thing: the optional barcode-scan
shortcut when adding an entry (Books, Comics/Manga, Vinyl/CD, Tabletop
Games). It is never required — every entry screen supports full manual
typing regardless of permission state.

**Permission is requested lazily**, the first time someone actually taps
the scan icon on an entry screen — never on app launch or on opening a
category screen. This matches the same contextual-permission pattern used
for notifications in Home Base.

**Settings → Permissions** shows the current camera-access status as a
switch. A couple of platform realities shape how that switch behaves,
worth knowing before changing anything in
`screens/PermissionsSettingsScreen.tsx`:
- **Apps cannot revoke their own permissions.** Turning the switch "off"
  can't actually do that from inside the app — it opens Phone Settings
  instead, where the OS-level toggle actually lives.
- **Once denied, an app can't re-prompt.** If the user said "don't
  allow" previously, `canAskAgain` comes back `false`, and tapping the
  switch back on also routes to Phone Settings rather than a native
  prompt that would never appear.

**Also on this screen: a "Daily reminder" toggle**, below Camera access.
One repeating local notification at 10:00 AM: `"Come check out today's
recommendations!"` - deliberately generic, no specific book/item named,
since it's a nudge to open the app rather than a preview of what's
there. Toggling it on requests notification permission if not already
granted (same lazy-request, route-to-Phone-Settings-if-denied pattern as
camera above) and calls `scheduleDailyRecommendationNotification()` from
`lib/notifications.ts`; toggling off cancels it. The enabled/disabled
state itself is stored in `AppSettings.notificationsEnabled` (not
derived from OS permission status), since the two can drift independently
- e.g. permission could be revoked externally later while the app still
"thinks" it's enabled, in which case the scheduled notification just
silently won't fire; nothing currently re-syncs that automatically.

**Confirmed working on a real device**: the notification itself fires
correctly at 10am with the right title/body. One thing it was initially
missing: the app icon's badge (the red number) never appeared, because
the scheduled notification never actually set one (`content.badge` was
absent) and the foreground handler in `App.tsx` had `shouldSetBadge`
explicitly set to `false`. Fixed by setting a flat `badge: 1` on the
notification - a "something's waiting" signal rather than a precise
unread count, since there's only ever this one notification type and
local (non-push) notifications on iOS can't reliably accumulate a real
count across multiple pending ones anyway, which is the same approach
Home Base already settled on for its own alerts - plus clearing the
badge back to 0 on cold launch and every time the app returns to the
foreground (`AppState` listener in `App.tsx`), so it doesn't just sit
there indefinitely once you've already seen it.

The badge still didn't appear after that fix, on-device, even though the
notification content/timing were both correct. Checked against Expo's
own current docs rather than assume it's a hard Expo Go limitation -
it isn't: local (non-push) notifications and badges are both explicitly
supported in Expo Go; only *remote* push notifications were dropped from
Expo Go in SDK 53+, which isn't what this app uses. The much more likely
explanation, at first: **Expo Go hosts every project you test under one
shared native app**, so iOS's notification permission - including the
separate "Badges" toggle - is granted to Expo Go itself, not
per-project. If a different project (e.g. Home Base) triggered the
permission prompt first without badges specifically included, this
app's own permission check already reads `'granted'` and never
re-prompts, since iOS won't automatically re-ask once a decision is on
file for that app. What the code *can* do regardless, and now does:
`requestPermissionsAsync` explicitly asks for `allowBadge: true` (rather
than relying on ambient defaults), and both that call and the
`AppState`-triggered `setBadgeCountAsync` in `App.tsx` now log a
`console.warn` pointing at Settings → Notifications → Expo Go → Badges
when the OS reports badge access isn't currently authorized - turning a
silent "it just never shows up" into an actual diagnostic signal.

That shared-permission theory was then directly ruled out: Home Base's
badge, also running under Expo Go, works fine - if the shared OS
permission itself were the blocker, Home Base's badge would fail too.
So the cause is something specific to this app's own notification code,
not a platform/permission-sharing quirk. Added an explicit
`Notifications.addNotificationReceivedListener` in `App.tsx` that calls
`setBadgeCountAsync(1)` directly the moment the notification fires - the
same class of fix already working for Home Base. Important honest
caveat noted in that same comment: this listener only fires if the app
happens to be open or recently backgrounded right when the notification
arrives. Per Expo's own notes, there's no way to react to a notification
via JS listeners when the app is fully closed/killed - which is exactly
the state the app is most likely in at 10am, since that's the whole
point of the reminder. For that case, the badge is applied entirely at
the OS level by reading the notification's own `content.badge` field,
with zero JS involvement - so if the badge is still missing specifically
when the app was fully closed at notification time, this listener
addition isn't what fixes that, and the real cause is more likely in how
`content.badge` itself gets read for a background-delivered *local* (not
push) notification specifically - not yet resolved as of this writing.

**A follow-up report ("notification fired correctly, but still no
badge") wasn't actually the same bug** - this is worth understanding
since it'll recur for any future change to the notification's
content/trigger otherwise. `scheduleNotificationAsync` is a one-time
registration with iOS - the OS doesn't re-check the app's JS code before
firing an already-scheduled notification each day, so updating the code
(like adding `badge: 1`) never retroactively touches a notification that
was scheduled *before* that change existed; only actually calling
`scheduleDailyRecommendationNotification()` again re-registers it with
whatever the current code says. Confirmed this wasn't a device/Expo Go
limitation first, since Home Base successfully shows badges in the exact
same dev environment. Fixed two ways: `ThemedApp` in `App.tsx` now
re-runs the schedule call on every app launch whenever the reminder is
enabled, so it can never drift more than one app-open behind the code -
and toggling Settings → Permissions → Daily reminder off and back on
does the same thing immediately, which is the fastest way to pick up any
future change to this notification without waiting for a relaunch.

**A third follow-up report: two identical notifications fired at the
same 10am trigger** (badge working correctly by this point). Given how
many times this feature had been toggled on/off and rebuilt across all
the rounds above, the most likely explanation was an orphaned scheduled
notification left over from an earlier test - possibly registered under
a different identifier, or from before `identifier` was even part of
this code - that `cancelDailyRecommendationNotification()` could never
have cleared, since it only cancelled `DAILY_NOTIFICATION_ID`
specifically. Fixed by switching both the schedule and cancel functions
to `Notifications.cancelAllScheduledNotificationsAsync()` instead -
clearing everything regardless of identifier before (re-)scheduling, or
before turning the reminder off. Safe since this app only ever schedules
this one notification type. Self-healing, not something needing a manual
toggle: the existing `App.tsx` effect above already re-runs the schedule
call on every launch while the reminder is enabled, so simply reopening
the app picks up this fix automatically and flushes any existing
duplicate - confirmed this superseded an earlier (wrong) instruction to
toggle the setting off and back on manually.

---

## 6. Cover photos

Every Book/Comic/Manga/Movie can have a cover image - a small thumbnail
in the list, a larger tappable one in the Add/Edit form. Designed across
a real back-and-forth before any code was written; worth knowing the
reasoning, not just the result.

**One storage system regardless of source.** A cover from the camera, a
cover picked from the photo library, and a cover auto-fetched from Open
Library/Google Books/TMDb all go through the exact same path in
`lib/coverStorage.ts`: resized/compressed, then saved to this app's own
private, sandboxed file storage. This was a deliberate simplification -
the alternative (storing a remote URL for auto-fetched covers, a local
file for manual ones) would mean two different code paths, two different
failure modes, and covers that stop working the moment there's no
internet connection. One system was simpler to build *and* better.

**Never the device's Photos app.** `takeCoverPhoto()` explicitly passes
`saveToPhotos: false` to the camera call - a photo taken through this
app exists only inside Media Base's own private storage, invisible to
the Photos app, the Files app, and every other app on the device. This
was a specific, direct requirement, not an assumption: plenty of apps
default to also saving a copy to the camera roll, but that's a choice
those apps make, not something the camera API requires.

**Auto-fetch reuses data already being fetched - no new API calls.**
Open Library's own book records already include cover URLs directly;
Google Books' search results already include a thumbnail link; TMDb's
search results already include a poster path. All four lookup
libraries (`isbnLookup.ts`, `movieLookup.ts`, `tvLookup.ts`,
`titleSearch.ts`) capture this as `coverUrl` on their existing result
types, so every entry method - scan/ISBN entry on Books/Comics, title
search everywhere - gets auto-fetch for free, with zero extra network
requests. The one place this genuinely
does cost an extra call is Books/Comics' ISBN-constructed fallback
(`https://covers.openlibrary.org/b/isbn/{ISBN}-L.jpg?default=false`),
tried only when neither primary source had its own cover data - cheap
and harmless to attempt even with no confirmation it exists, since a
404 there is treated the same as "no cover available" everywhere else in
this app (the same principle already established for missing genre
data - not every book/movie has one, and that's not a bug).

**Fixed-size thumbnails, on purpose.** `components/CoverThumbnail.tsx`
is always the exact same dimensions in the list, whether a real cover
loaded, is still loading, or doesn't exist at all. This app went through
several real rounds of scroll-performance bugs earlier (see
`lib/useAlphabetScroll.ts`) that all traced back to row height not being
perfectly uniform - a thumbnail whose size changed based on load state
would have reintroduced exactly that problem. A load failure is also
tracked with its own `useEffect` reset keyed to the `uri` prop
specifically, since `VirtualizedList` recycles row components for
different items as you scroll rather than always mounting fresh ones -
without that reset, a failure recorded for one item could incorrectly
persist onto a completely different item recycled into the same row.

**A pre-generated id solves "what if you add a photo before hitting
Save."** Every item's cover lives at a path derived from its own id -
but an item doesn't get a real id until it's actually saved. Rather than
storing a photo somewhere temporary and moving it once a real id exists,
each screen now pre-generates a real id (`newId()` from `lib/storage.ts`,
now exported) the moment the Add form opens, and uses that same id
consistently for cover operations *and* as the id actually passed to
`addBook`/`addComic`/`addMovie` on save. One id, from the start, no file
ever needs to move. If that Add session gets cancelled instead of saved,
and a photo was picked/taken during it, that orphaned file gets cleaned
up immediately (`handleCancelForm` in each screen) rather than sitting
around forever under an id that never became a real entry.

**Deletion cleans up after itself, everywhere.** Deleting a single item,
bulk-deleting a selection, and Settings → Data → Delete all data all now
remove the associated cover photo(s) too (`lib/storage.ts`), not just
the text record. No orphaned files left behind at any deletion path.

**Placeholder, not a blank box.** No cover yet shows a simple icon
(`book-outline` for Books/Comics, `film-outline` for Movies) rather than
an empty gray rectangle - same treatment in both the list thumbnail and
the larger Edit-form version, which also adds "Add cover photo" text so
the affordance is obvious.

**Where the manual option lives.** Tapping the cover itself (in the
Add/Edit form) opens "Take Photo / Choose from Library / Remove Photo" -
not a separate button elsewhere in the form. This was an explicit choice
between two reasonable options (the other being a dedicated button near
the read/watched switch) - tapping the image directly is the more
standard pattern (Goodreads, Letterboxd, etc.), and was the one that got
built.

**Export/Import is now a real backup file, including cover photos -
the deferred follow-up mentioned above, now built.** One JSON file with
every AsyncStorage key's data *and* every item's cover photo embedded
inside it as base64, produced by `exportAllData()` and restored by
`importAllData(fileUri)` in `lib/storage.ts`. Deliberately not a `.zip`
- that would mean the person has to unzip it themselves before
restoring, which is exactly the extra friction a single self-contained
file avoids. The accepted tradeoff: base64 inflates file size by
roughly a third over the raw photos, not a problem for a local save or
AirDrop, worth knowing if it ever needs to go through an email
attachment limit on a very large library. `screens/DataSettingsScreen.tsx`
replaced the old paste-text UI with "Save Backup File" (writes the
backup to temporary storage, then hands it to the OS share sheet via
`expo-sharing` - Files, AirDrop, Mail, whatever the person picks) and
"Choose Backup File" (`expo-document-picker`, picking a real file
instead of pasting text). `BackupPayload` bumped to `version: 2` with
the new `covers` field; `importAllData()` checks for that field rather
than assuming it, so an old version-1 (pasted-text, no photos) backup
still restores everything it actually has rather than failing outright.
Neither new dependency needs `app.json` plugin configuration - neither
requires a custom Info.plist permission string, unlike Camera/Photo
Library/Notifications.

**Permissions**: picking a photo from the library needs its own OS
permission, separate from Camera (already in this app for barcode
scanning) - not yet its own visible toggle on the Permissions settings
screen as of this writing (expo-image-picker requests it lazily,
on-demand, the same moment "Choose from Library" is actually tapped, so
the underlying feature works regardless) - a dedicated Photo Library
row on that screen, plus refreshing all three permission toggles on
every app-foreground return rather than only on first load, is a
confirmed but not-yet-built follow-up.

---

## 7. Color accessibility

The app supports a user-selected accent color (12 options, including
White and Black) across both Light and Dark mode, which means the same
color has to stay legible in combinations it was never individually
designed for - e.g. a "White" accent picked while in Light mode, or
"Black" picked while in Dark mode, would otherwise be invisible. The fix,
in `lib/theme.tsx`:

- **`accent`** - the user's true, unmodified color choice. Use ONLY for
  filled backgrounds (buttons, active chips/switches, the swatch tile
  itself in Theme settings) - not as a text or icon color.
- **`accentText`** - text/icons placed on top of a *filled* `accent`
  background. Picks whichever of black/white has the actual higher WCAG
  contrast ratio against that specific accent, not a brightness guess.
- **`accentReadable`** - the accent color used as *plain* text, an icon,
  or a border directly on the screen's own background (back links, the
  Home screen's cog/play icons, star ratings, "Try today" text). If the
  raw accent color doesn't hit 4.5:1 against the current background, this
  walks its HSL *lightness* toward the background (preserving hue) until
  it does - so a "Yellow" pick still reads as recognizably yellow, just a
  shade deep enough to be legible, rather than silently becoming plain
  black or white. White and Black themselves land here too: picked as an
  accent against a same-shade background, this is what keeps them from
  disappearing entirely.

Every screen was audited to use `accentReadable` for foreground use and
`accent` only for fills - not yet re-verified against all 12 colors ×
Light/Dark on a real device the way Home Base's equivalent system was.

---

## 8. Known setup gotchas

Carried over from Home Base/League Base's setup experience, since this
project uses the identical Node/Expo stack - #1 through #5 haven't
needed fixing here specifically, but all of them apply equally. #6 is
genuinely specific to this project, not inherited.

### Gotcha #1: Node version

Node 22+ enabled experimental automatic TypeScript stripping, which
crashes `npx expo start` outright once an Expo package ships `.ts` source
under `node_modules` (Node refuses to strip types there). Fix: Node 20
LTS specifically.

### Gotcha #2: ERESOLVE peer dependency errors

If `npm install` refuses to resolve the dependency tree, add a `.npmrc`
file in the project root:

```
legacy-peer-deps=true
```

### Gotcha #3: Expo Go SDK mismatches

"Project is incompatible with this version of Expo Go" usually means the
project's SDK is newer than what's currently on the App Store, not a
setup mistake. This project targets **SDK 54** for exactly that reason.

### Gotcha #4: `.tsx` vs `.ts`

Any file with JSX syntax (`<Component>` tags) must use `.tsx`.
`lib/theme.tsx` is named that way specifically because it renders a
`<Context.Provider>`.

### Gotcha #5: "No safe area value available"

`[Error: No safe area value available. Make sure you are rendering
<SafeAreaProvider> at the top of your app.]` on launch means exactly
what it says - `App.tsx` needs to wrap everything in `<SafeAreaProvider>`
(from `react-native-safe-area-context`), above `ThemeProvider`. Nearly
every screen in this app uses `SafeAreaView` or `useSafeAreaInsets`
directly (not just React Navigation internally), so this isn't optional
scaffolding - the app can't render at all without it. This was actually
missing from the very first scaffold and only surfaced once enough
screens depended on it to trip the error; if this ever comes back after
a merge or a copy-paste of `App.tsx`, this is the first thing to check.

### Gotcha #6: Expo SDK type drift - real, project-specific, not carried over

Unlike gotchas #1-5, this one wasn't inherited from Home Base/League
Base - it's specific to this project's dependencies, found through
manual code review (checking `.tsx` files directly against the actual
installed package types) rather than a runtime crash report. Two
confirmed cases so far, both `expo-notifications`/`expo-image-picker`
API surfaces that shifted out from under existing code:

- **`App.tsx`'s notification handler**: `shouldShowAlert` was replaced
  by `shouldShowBanner` + `shouldShowList` in the installed
  `expo-notifications` version - confirmed via Expo's own GitHub history
  (PR #36361: "Replaced shouldShowAlert with shouldShowBanner and
  shouldShowList"), not a guess. Fixed directly - both new fields set to
  `true` to match the original `shouldShowAlert: true` behavior as
  closely as possible.
- **`lib/coverStorage.ts`'s camera calls**: `saveToPhotos` (the flag
  keeping a taken cover photo out of the device's Photos app -
  confirmed, tested behavior this app specifically relies on) no longer
  appears in `launchCameraAsync`'s TypeScript option types. Handled
  differently from the notification fix, deliberately: rather than
  removing the option outright on unclear typing evidence - which risks
  silently reintroducing photos being saved to the Photos app, a real
  privacy regression - the option is kept with an `as any` cast
  suppressing just the type error, on the reasoning that a type
  declaration lagging behind actual native capability is far more likely
  here than a genuinely removed, still-fundamental camera control. Not
  verified from this sandbox - worth a real on-device check (take a
  cover photo, confirm nothing new appears in the Photos app) rather
  than trusting that reasoning alone.

This project has already hit three other cases of the same underlying
pattern - `expo-camera`'s standalone permission functions not actually
existing (fixed by switching to the `useCameraPermissions` hook),
`expo-file-system`'s promise-based API being deprecated in favor of new
File/Directory classes (fixed by importing from the `/legacy` subpath),
and TMDb's v3 API Key getting stuck while the v4 Read Access Token
worked (an account-side issue, not a types issue, but the same instinct
- verify against the actual installed/live behavior rather than assume
docs or memory are current). Worth treating any TypeScript error in this
project the same way going forward: check what's actually installed and
what its current API really looks like, rather than assume the original
code was simply wrong.

---

## 9. Status

- **Bundle identifier**: set (`com.JHarvey.MediaBase`, both iOS and
  Android, in `app.json`).
- **App icon**: added (`assets/icon.png`, 1024x1024) - also used as the
  Android adaptive icon foreground and the splash screen image, both on a
  black background matching the logo's own background.
- **Typography**: JetBrains Mono throughout - Extra Bold for titles and
  section headers, Regular for everything else, via `components/AppText.tsx`.
- **Header consistency & contrast**: every screen uses
  `components/ScreenHeader.tsx` (centered title, consistent size, safe-area
  fix for the Modal issue) and `accentReadable` for foreground color -
  see [Section 7](#7-color-accessibility).
- **Data safety**: export/import/delete-all all implemented in Settings
  → Data. Import/delete-all confirmed working on-device for the original
  text-based format, including a fixed bug where restored/reset settings
  (theme, dark mode, text size) didn't visibly take effect until
  refreshSettings() was added to both. Export/Import rebuilt since as a
  real backup file including cover photos (`expo-sharing` +
  `expo-document-picker`, see Section 6) - not yet device-tested in that
  new form specifically.
- **Permissions**: camera status + Phone Settings link implemented.
  Real barcode scanning is wired up for Books/Comics/Manga only (EAN-13,
  Bookland-prefix ISBN barcodes, shared via `lib/isbnLookup.ts`) - see
  the Category screen pattern section above. Movies originally had its
  own UPC/barcode scanning too, removed after real testing confirmed it
  was unreliable; TV Shows never had it at all (confirmed design from
  the start). Both are title-search only now. Vinyl/CD and Tabletop
  Games still need their own barcode-type/lookup wiring since their
  data sources differ again.
- **Notifications**: daily 10am reminder confirmed working on-device,
  including the badge (fixed - the scheduled notification wasn't
  setting one at all).
- **Home screen**: generalized to load widget data (count + daily pick)
  for any implemented category rather than a Books-only special case -
  the "done" field's name differs per category (Books/Comics: `read`,
  Movies: `watched`), so this takes an `isDone` accessor function rather
  than assuming a field name, unlike the first version of this
  generalization.
- **TypeScript**: can't be run directly from this sandbox (no network
  access to install dependencies), but real errors have been caught via
  VS Code's own checking and fixed as they came up - an `Alert.alert`
  button-array typing issue, and a `SectionList` generic-parameter issue
  affecting both `BookScreen`/`ComicScreen`. Worth an occasional
  `npx tsc --noEmit` locally to catch anything that slips through
  between VS Code sessions.
- **Apple Developer Program enrollment**: in progress, tracked
  separately.

---

## 10. Roadmap (genuinely open, not yet built)

See [Media-Base-Roadmap.md](./Media-Base-Roadmap.md) for the full
category-by-category build order and entry-method decisions. At a
glance, still open:
- Tabletop Games, the one remaining category (Books,
  Comics/Manga, Movies, TV Shows, Anime, and Vinyl/CD are all done -
  Movies, TV Shows, Anime, and Vinyl/CD all built out of the original
  planned sequence per explicit request; Music was also built out of
  sequence, reached a fully working state, and was later removed
  entirely - see the top overview and Section 6 for why; Puzzles was
  dropped from the plan before ever being built, on reflection not
  something worth tracking)
- Real barcode scanning for Tabletop Games (Books/Comics
  share `lib/isbnLookup.ts` for this - Movies originally had its own
  `lib/upcLookup.ts` too, removed after real testing confirmed it was
  unreliable; Movies, TV Shows, and Anime are all title-search only now,
  and Vinyl/CD's own barcode lookup is done via Discogs
  - see the Category screen pattern section above for what each
  category actually reuses)
- Share sheet wiring (native OS share, per item)
