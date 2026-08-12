// lib/config.ts
//
// REAL BUG FIX: this used to be a git-ignored file holding the actual
// token values directly, which worked fine for local development but
// broke EAS cloud builds outright - EAS Build clones the repo from
// GitHub to build on its own remote servers, and a git-ignored file
// that was never committed simply doesn't exist there. Confirmed via a
// real build failure: "Unable to resolve module ./config from
// .../lib/tvLookup.ts" - not a flaky build, a file that genuinely
// wasn't present.
//
// Rewritten to read from environment variables instead - this file
// itself now contains no secrets at all, so it's safe to commit (and
// is committed, unlike its predecessor). The actual token values live
// in two places instead, both outside of git history:
//   1. A local .env file (git-ignored, see .env.example for the
//      template) - read by Metro during local development
//      (`npx expo start`) and picked up automatically.
//   2. EAS environment variables (`eas env:create`, or the expo.dev
//      dashboard) - read during EAS cloud builds. Confirmed via
//      Expo's own documentation before writing this, not guessed:
//      EXPO_PUBLIC_-prefixed variables are inlined into the client
//      bundle at build time from whichever of these two sources is
//      active, and this project's User-Agent strings will still end
//      up carrying the actual token value either way, same as the
//      previous hardcoded-in-lib/config.ts approach did - the goal
//      here was never "hide this from someone who decompiles the
//      compiled app" (not achievable for a client app calling these
//      APIs directly, confirmed via Expo's own docs: "Secrets do not
//      provide any additional security for values that you end up
//      embedding in your application itself"), it was "keep it out of
//      the public repo's own source code history," which this
//      achieves the same way the git-ignored file did before.
//
// Every constant below falls back to an empty string when the
// corresponding env var isn't set, matching each lookup library's own
// existing "not set yet" graceful-degrade check (they each already log
// a clear warning and return no results rather than firing a request
// that would fail anyway).

export const TMDB_READ_ACCESS_TOKEN = process.env.EXPO_PUBLIC_TMDB_READ_ACCESS_TOKEN ?? '';
export const DISCOGS_USER_TOKEN = process.env.EXPO_PUBLIC_DISCOGS_USER_TOKEN ?? '';
export const BGG_APPLICATION_TOKEN = process.env.EXPO_PUBLIC_BGG_APPLICATION_TOKEN ?? '';
