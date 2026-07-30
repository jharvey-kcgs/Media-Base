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
6. [Color accessibility](#6-color-accessibility)
7. [Known setup gotchas](#7-known-setup-gotchas)
8. [Status](#8-status)
9. [Roadmap (genuinely open, not yet built)](#9-roadmap-genuinely-open-not-yet-built)

Media Base is a personal media collection & tracker — a Home screen made
of widgets, one per media category the user opts into during Onboarding
(Books, Comics/Manga, Movies, TV Shows, Anime, Music, Vinyl/Records,
Puzzles, Board Games), each with its own dedicated screen for adding,
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
two categories - Books and Comics/Manga - are working end-to-end (add,
edit, sort/filter, rate, review, delete, real barcode scanning). Every
other category widget shows "Coming soon" until its own screen is built,
following the confirmed build order in
[Media-Base-Roadmap.md](./Media-Base-Roadmap.md). ISBN lookup and the
A-Z index are shared between Books and Comics/Manga via `lib/isbnLookup.ts`
and `lib/useAlphabetScroll.ts` rather than duplicated - see the Category
screen pattern section for what to reuse vs. rebuild per category.

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
                                    category, daily per-widget suggestion
  OnboardingScreen.tsx             First-launch category picker

  BookScreen.tsx                   Books (widget 1 - working)
  ComicScreen.tsx                  Comics/Manga (widget 2 - working) -
                                     built on the same shared
                                     lib/isbnLookup.ts and
                                     lib/useAlphabetScroll.ts as Books,
                                     with its own genre allowlist that
                                     adds manga demographic labels
                                     (Shonen/Shoujo/Seinen/Josei)
  [category]Screen.tsx             One screen per remaining category,
                                    built in the order in the Roadmap doc

  SettingsScreen.tsx               Settings nav list
  ProfileSettingsScreen.tsx        Toggle which categories show on Home
  ThemeSettingsScreen.tsx          Theme color, Light/Dark, text size
  DataSettingsScreen.tsx           Export / import / delete-all - both
                                     import and delete-all call
                                     refreshSettings() from ThemeContext
                                     afterward, since restoring/wiping
                                     settings on disk doesn't by itself
                                     update the app's already-loaded,
                                     in-memory copy (theme color, Light/
                                     Dark mode, text size, enabled Home
                                     categories all live there)
  PermissionsSettingsScreen.tsx    Camera access status + Phone Settings link
  AboutScreen.tsx                  What each setting/screen does
  FAQScreen.tsx                    Common questions, split out from About

lib/
  storage.ts                       Every piece of data logic - one
                                     function per action. Read this file
                                     first to understand the data model.
  theme.tsx                        App-wide theme via React Context -
                                     colors, Light/Dark mode, font scale.
                                     Independent from Home Base/League Base.
  notifications.ts                 Schedules/cancels the daily 10am
                                     "check today's recommendations"
                                     reminder (Settings > Permissions).
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
                                     was probably fine."

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
building the remaining categories (Movies, TV Shows, etc.) - and
`screens/ComicScreen.tsx` is a real example of that copy already done,
built on the same two extracted shared modules
(`lib/isbnLookup.ts`, `lib/useAlphabetScroll.ts`) rather than a second
copy of that logic, with only the genre allowlist and user-facing wording
actually differing between the two. A future category screen should
follow that same split: reuse the shared modules for ISBN lookup and the
A-Z index, and only duplicate what's genuinely category-specific (the
form fields, the row component, the allowlist).
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
  it shows **+ Add entry / Filter by... / Filter by genre... / - Delete
  entries**. "Add"/"Filter by..."/"Filter by genre..." each open a
  second native picker (`Alert.alert` with one button per option).
  "Delete entries" instead switches the whole screen into a **selection
  mode**: the header becomes Cancel / "N selected" / Delete, tapping a
  row toggles a checkmark instead of opening it for editing, and Delete
  bulk-removes everything selected in one call
  (`storage.deleteBooks(ids)` - one read/write instead of one per item).
  This replaced an earlier version where "Delete entries" opened a
  picker listing up to 10 book titles as buttons, one delete at a time -
  selection mode is both more capable (delete many at once) and doesn't
  hit the same Android `Alert.alert` 3-button cap that a long title list
  would.
- **Tapping any row opens it for editing** (outside selection mode) -
  every field is editable, and a **Delete** button lives inside that same
  edit screen for removing just that one entry.
- **No duplicate entries**: on save, a same-title match (trimmed,
  case-insensitive) against anything already tracked - other than the
  item currently being edited - blocks the save with an alert instead of
  creating a second copy.
- **Multi-genre entries**: a book can carry more than one genre tag
  (entered comma-separated, e.g. "Romance, Contemporary"). Genre isn't
  one of the "Filter by..." **sort** options (Title/Author/Read?) - it
  used to be, but that was redundant/confusing once genre got its own
  dedicated menu item: **"Filter by genre..."** in the ••• menu shows
  every distinct tag currently in use and narrows the list to books that
  have that tag *anywhere* in their list, not just a "primary" one. The
  active filter shows next to "Sorted by X" and clears with a tap.
  (`genres[0]` is still tracked internally as the nominal first tag, but
  nothing in the UI sorts or groups by it anymore.)
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
shortcut when adding an entry (Books, Comics/Manga, Movies, Vinyl, Board
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

---

## 6. Color accessibility

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

## 7. Known setup gotchas

Carried over from Home Base/League Base's setup experience, since this
project uses the identical Node/Expo stack — nothing below has needed
fixing here specifically yet, but all of it applies equally.

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

---

## 8. Status

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
  see [Section 6](#6-color-accessibility).
- **Data safety**: export/import/delete-all all implemented in Settings
  → Data, not yet tested end-to-end on-device.
- **Permissions**: camera status + Phone Settings link implemented.
  Real barcode scanning is wired up for both Books and Comics/Manga
  (EAN-13, Bookland-prefix ISBN barcodes, shared via `lib/isbnLookup.ts`)
  - see the Category screen pattern section above. Other categories that
  called for scanning (Movies, Vinyl, Board Games) still need their own
  barcode-type/lookup wiring since their codes and data sources differ
  from ISBN.
- **Notifications**: daily 10am reminder implemented (Settings →
  Permissions → Daily reminder), not yet device-tested from this sandbox.
- **Home screen**: generalized to load widget data (count + daily pick)
  for any implemented category rather than a Books-only special case,
  now that Comics/Manga is a second one.
- **TypeScript**: not yet verified with `npx tsc --noEmit` (no network
  access when this scaffold was generated, so dependencies haven't been
  installed or type-checked yet — do this first before building further).
- **Apple Developer Program enrollment**: in progress, tracked
  separately.

---

## 9. Roadmap (genuinely open, not yet built)

See [Media-Base-Roadmap.md](./Media-Base-Roadmap.md) for the full
category-by-category build order and entry-method decisions. At a
glance, still open:
- Puzzles → Music → Movies → TV Shows → Anime → Vinyl → Board Games, in
  that order (Books and Comics/Manga are both done)
- Real barcode scanning for Movies, Vinyl, Board Games (Books and
  Comics/Manga are done, sharing `lib/isbnLookup.ts` - see the Category
  screen pattern section above for the reference implementation to adapt)
- "Listen on Spotify" (Music) and "Where to Watch" popup (TV Shows,
  Anime)
- Share sheet wiring (native OS share, per item)
