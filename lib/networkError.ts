// lib/networkError.ts
//
// Confirmed real gap, flagged directly: every lookup function across
// every source (TMDb, Discogs, BoardGameGeek, Open Library, Google
// Books) caught its own fetch errors internally and returned an empty
// result, identical to a genuine "no matches for that title" outcome.
// Someone searching with no internet connection at all saw "no results
// found" - reading as "this title doesn't exist" rather than "couldn't
// reach the service", which is a meaningfully different, more
// actionable thing to tell someone.
//
// isNetworkError() distinguishes the two cases: React Native's fetch()
// throws a TypeError (message containing "Network request failed" on
// iOS/Android, or "Failed to fetch" on web) specifically when the
// device can't reach the network at all - genuinely different from a
// non-200 HTTP response (the service responded, just said no or wasn't
// found), which every lookup file already handles separately via its
// own `if (!res.ok)` check and correctly treats as "no matches", not a
// connectivity problem.
//
// Deliberately narrow: only fetch-level TypeErrors match, not every
// possible error a lookup function could throw (a JSON parse failure,
// for instance, isn't "the internet is down" and shouldn't be reported
// as one).
export function isNetworkError(err: unknown): boolean {
  if (!(err instanceof TypeError)) return false;
  const message = err.message.toLowerCase();
  return message.includes('network request failed') || message.includes('failed to fetch');
}

// Thrown by a lookup function specifically when isNetworkError() is
// true for the underlying error, instead of swallowing it into an
// empty return - lets any caller (TitleSearchInput.tsx, a barcode scan
// handler) tell "couldn't connect" apart from "genuinely no matches"
// and show the right message for each.
export class NetworkUnavailableError extends Error {
  constructor() {
    super('Could not reach the network - check your connection and try again.');
    this.name = 'NetworkUnavailableError';
  }
}
