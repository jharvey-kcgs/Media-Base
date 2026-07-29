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

**Where this stands right now:** first working slice covers Onboarding,
Home, all of Settings, and Books end-to-end (add, edit, sort/filter, rate,
review, delete). Every other category widget shows "Coming soon" until
its own screen is built, following the confirmed build order in
[Media-Base-Roadmap.md](./Media-Base-Roadmap.md). Barcode scanning itself
is stubbed (shows an alert) — the actual camera + lookup wiring comes in
a later pass, per category.

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
| `react-native-screens`, `react-native-safe-area-context` | Required by React Navigation |
| `@react-native-async-storage/async-storage` | All local data storage — the entire app's data layer runs on this |
| `react-native-get-random-values`, `uuid` | Generates unique IDs for every stored item |
| `expo-camera` | Camera access + permission status for the optional barcode-scan shortcut and the Permissions settings page |
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
App.tsx                          Navigation entry point, ThemeProvider,
                                   first-launch onboarding gate

screens/
  HomeScreen.tsx                  The dashboard - one widget per selected
                                    category, daily per-widget suggestion
  OnboardingScreen.tsx             First-launch category picker

  BookScreen.tsx                   Books (widget 1 - working)
  [category]Screen.tsx             One screen per remaining category,
                                    built in the order in the Roadmap doc

  SettingsScreen.tsx               Settings nav list
  ProfileSettingsScreen.tsx        Toggle which categories show on Home
  ThemeSettingsScreen.tsx          Theme color, Light/Dark, text size
  DataSettingsScreen.tsx           Export / import / delete-all
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
                                     screen before this existed.

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
building Comics/Manga, Movies, etc.:
- Header right slot is a **"•••" menu** (`Ionicons ellipsis-horizontal`),
  not a persistent "+ Add" button or a visible filter-chip row - tapping
  it shows **+ Add entry / Filter by... / - Delete entry**, keeping the
  main list screen clean. "Filter by..." and "- Delete entry" each open a
  second native picker (also `Alert.alert` with one button per option).
- **Tapping any row opens it for editing** - every field is editable, and
  a **Delete** button lives inside that same edit screen.
- **No duplicate entries**: on save, a same-title match (trimmed,
  case-insensitive) against anything already tracked - other than the
  item currently being edited - blocks the save with an alert instead of
  creating a second copy.
- **Live ISBN formatting/validation (Books specifically)**: as digits are
  typed, once there are 10 or 13 of them the field reformats itself with
  the real, official hyphen positions (via `isbn3`, which bundles the
  actual ISBN-agency range data - there's no fixed pattern like a phone
  number that could be hand-written for this) and checks the checksum
  digit, showing "✓ Valid ISBN" or a "check digit doesn't look right"
  warning immediately - catching a mistyped digit before it ever reaches
  the lookup below. This doesn't block saving; it's advisory only.
- **Optional ISBN field (Books specifically)**: filling it in and moving
  to the next field triggers an automatic lookup - Open Library first
  (verified reliable for exact-ISBN matches; requires the descriptive
  `User-Agent` header their API asks for, or requests can be silently
  rate-limited), falling back to Google Books if Open Library has no
  match - and fills
  Title/Author/Genre/Page count. Same end result as scanning, without
  needing the camera wired up yet. Neither database has 100% ISBN
  coverage on its own (a specific printing/edition can be missing from
  one but not the other), which is why both get checked rather than
  just one. Not network-testable from the sandbox this was built in -
  API errors and "genuinely no match" both log a `console.warn('Media
  Base: ...')` to help tell those apart if it still comes back empty for
  a real ISBN. Categories without a clean ISBN-equivalent (Movies use
  UPC, which is messier - see the Roadmap doc) will need their own lookup
  approach rather than copying this one directly.
- **A-Z index** on the right edge, only shown when sorted by an
  alphabetical field (Title/Genre/Author here) - tapping a letter jumps
  to the nearest section at or after it. Not shown for non-alphabetical
  sorts like Page count or Read?.

**Known limitation worth knowing before relying on this further:**
`Alert.alert` shows unlimited buttons on iOS but caps at 3 on Android -
fine for now since only iOS is targeted, but the Filter/Delete menus (5
and up-to-10 options respectively) will need a real action-sheet
component (e.g. `@expo/react-native-action-sheet`) before this app could
support Android.

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
- **Permissions**: camera status + Phone Settings link implemented;
  actual barcode scanning is still stubbed.
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
- Comics/Manga → Puzzles → Music → Movies → TV Shows → Anime → Vinyl →
  Board Games, in that order
- Real barcode scanning + confirm/edit screen (Books, Comics, Movies,
  Vinyl, Board Games)
- "Listen on Spotify" (Music) and "Where to Watch" popup (TV Shows,
  Anime)
- Share sheet wiring (native OS share, per item)
