// lib/musicLookup.ts
//
// Music's title-search lookup - MusicBrainz (musicbrainz.org) for
// search/metadata, Cover Art Archive (coverartarchive.org) for album
// art. Both free and fully keyless - no signup, no API key, no login,
// just a User-Agent header identifying this app, which MusicBrainz asks
// every client to send as a courtesy, not a real access barrier.
//
// Deliberately NOT Spotify for this part, despite the original roadmap
// note assuming Spotify - their Web API changed in February 2026,
// explicitly moving away from allowing simple, no-login "Client
// Credentials" access to metadata endpoints (search, album/track
// lookup) for free-tier developer apps. Spotify still has a role below,
// just not for data - see spotifySearchUrl().
//
// Album is the tracked unit here (same "one release = one entry"
// philosophy as every other category), but the search box accepts
// EITHER a song title or an album title - MusicBrainz calls these
// "recordings" and "releases" respectively, and both get searched
// together. Whichever matches, the result resolves to that song's
// album: Artist/Album fill in at the album level, not the individual
// song - a true single still works fine here, since in MusicBrainz's
// model it's just its own release (type "Single" rather than "Album"),
// not a special case needing extra handling.
//
// Genre and cover art are BOTH separate follow-up calls after a result
// is selected, not part of the initial search results - MusicBrainz's
// search endpoint doesn't include genre tags directly (they're
// community-voted folksonomy tags, only returned via a specific
// ?inc=genres lookup on the exact release), and cover art is a wholly
// separate service. Same pattern already used for cover-photo auto-fill
// everywhere else in this app: search returns the essentials, a
// background fetch fills in the rest once something's actually
// selected. Both are real but inconsistent - a release without enough
// contributor votes/uploads just won't have one or the other, same as
// "not every book has a cover" elsewhere in this app - not a bug.
//
// NOTE: not network-tested from the sandbox this was written in.

const USER_AGENT = 'MediaBase/1.0 ( https://github.com/JHarvey/Media-Base )';

export interface MusicSearchResult {
  key: string; // MusicBrainz release MBID - stable, unique regardless of whether this matched as an album or a song
  releaseId: string; // same value as key, named separately for clarity at call sites that fetch genre/cover art next
  title: string; // the album title
  artist: string;
  releaseYear?: string;
}

async function searchReleases(query: string, maxResults: number): Promise<MusicSearchResult[]> {
  try {
    const res = await fetch(
      `https://musicbrainz.org/ws/2/release/?query=${encodeURIComponent(`release:"${query}"`)}&fmt=json&limit=${maxResults}`,
      { headers: { 'User-Agent': USER_AGENT } },
    );
    if (!res.ok) {
      console.warn('Media Base: MusicBrainz release search returned', res.status);
      return [];
    }
    const json = await res.json();
    const items = Array.isArray(json?.releases) ? json.releases : [];
    const mapped = items
      .filter((r: any) => r?.id && r?.title)
      .map((r: any) => ({
        key: r.id,
        releaseId: r.id,
        title: r.title as string,
        artist: r['artist-credit']?.[0]?.name ?? 'Unknown artist',
        releaseYear: r.date ? String(r.date).slice(0, 4) : undefined,
      }));
    console.warn('Media Base: MusicBrainz release search', `"${query}"`, '->', items.length, 'raw,', mapped.length, 'usable, first releaseId:', mapped[0]?.releaseId);
    return mapped;
  } catch (err) {
    console.warn('Media Base: MusicBrainz release search threw', err);
    return [];
  }
}

async function searchRecordings(query: string, maxResults: number): Promise<MusicSearchResult[]> {
  try {
    const res = await fetch(
      `https://musicbrainz.org/ws/2/recording/?query=${encodeURIComponent(`recording:"${query}"`)}&fmt=json&limit=${maxResults}`,
      { headers: { 'User-Agent': USER_AGENT } },
    );
    if (!res.ok) {
      console.warn('Media Base: MusicBrainz recording search returned', res.status);
      return [];
    }
    const json = await res.json();
    const items = Array.isArray(json?.recordings) ? json.recordings : [];
    const results: MusicSearchResult[] = [];
    for (const rec of items) {
      // A recording can appear on several releases (the original album,
      // a greatest-hits compilation, a remaster...) - take the first,
      // same good-enough-not-perfect approach as picking the first
      // search result generally; the person can always pick a
      // different result from the dropdown if this isn't the one they
      // meant.
      const release = Array.isArray(rec?.releases) ? rec.releases[0] : null;
      if (!release?.id || !release?.title) continue;
      results.push({
        key: release.id,
        releaseId: release.id,
        title: release.title as string,
        artist: rec['artist-credit']?.[0]?.name ?? 'Unknown artist',
        releaseYear: release.date ? String(release.date).slice(0, 4) : undefined,
      });
    }
    return results;
  } catch (err) {
    console.warn('Media Base: MusicBrainz recording search threw', err);
    return [];
  }
}

/** Searches MusicBrainz for albums (releases) AND songs (recordings)
 * matching the query, merging both into one result list - whichever a
 * person picks, it's already resolved to an album-level candidate (a
 * song match already carries its parent release's title/artist/id, not
 * the song's own). Reused directly by lib/titleSearch.ts's
 * searchMusicByTitle().
 *
 * Sequential, not Promise.all - MusicBrainz enforces a real, documented
 * rate limit (~1 request/second per IP, on average; anything over gets
 * a 503, and the IP stays throttled until the rate drops, per their own
 * rate-limiting docs). Firing both search types in the same instant was
 * already tight against that limit on its own, and this app also fires
 * a follow-up genre request right after a result gets selected -
 * running these one after another rather than simultaneously leaves
 * more headroom before that follow-up call, at the cost of the search
 * itself taking a bit longer. Confirmed via real testing that the
 * parallel version was measurably slower than every other category's
 * search - this is the direct fix for that. */
export async function searchMusicBrainz(query: string, maxResults: number): Promise<MusicSearchResult[]> {
  const albumResults = await searchReleases(query, maxResults);
  const trackResults = await searchRecordings(query, maxResults);

  // Dedupe by release id - a song match and an album match can easily
  // resolve to the exact same release (e.g. searching "Abbey Road" the
  // album and "Come Together" the song off it), and showing the same
  // album twice in one dropdown would just be confusing.
  const seen = new Set<string>();
  const merged: MusicSearchResult[] = [];
  for (const r of [...albumResults, ...trackResults]) {
    if (seen.has(r.key)) continue;
    seen.add(r.key);
    merged.push(r);
  }
  return merged.slice(0, maxResults);
}

/** Cover Art Archive lookup for a release - returns the front cover
 * image URL, or null if this release has no contributed art (a real,
 * expected outcome - not every release has one, see the file header).
 *
 * Logs unconditionally (not just on failure) - a real report from
 * testing showed cover art never loading across several different
 * albums, a rate far higher than "sometimes missing" should produce.
 * That could genuinely be sparse contributor coverage, or it could be
 * this function misreading the response shape - not verified from the
 * sandbox this was written in, so rather than guess again, this logs
 * enough on every call to tell the two apart on the next real test:
 * the exact URL, status, and what (if anything) was extracted. */
export async function fetchCoverArtUrl(releaseId: string): Promise<string | null> {
  const url = `https://coverartarchive.org/release/${releaseId}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn('Media Base: Cover Art Archive', url, '->', res.status, res.status === 404 ? '(no art contributed for this release)' : '(unexpected)');
      return null;
    }
    const json = await res.json();
    const images = Array.isArray(json?.images) ? json.images : [];
    const front = images.find((img: any) => img?.front);
    const result = front?.image ?? images[0]?.image ?? null;
    console.warn('Media Base: Cover Art Archive', url, '->', images.length, 'image(s), using', result);
    return result;
  } catch (err) {
    console.warn('Media Base: Cover Art Archive lookup threw', url, err);
    return null;
  }
}

/** Genre lookup for a release - a separate follow-up call, not part of
 * search results (see file header). Returns an empty array if this
 * release has no community-voted genre tags yet - a real, expected
 * outcome given genres are folksonomy tags, not always present.
 *
 * This is also the request most exposed to MusicBrainz's rate limit in
 * practice: it fires right after the two search requests
 * searchMusicBrainz() already made to the same musicbrainz.org host, so
 * a burst of album lookups in a short session (exactly what real
 * testing did - several albums tried back to back) is a real way to hit
 * a 503 here specifically. Logs unconditionally so the next real test
 * shows whether that's what's actually happening versus a release that
 * genuinely has no genre tags. */
export async function fetchReleaseGenres(releaseId: string): Promise<string[]> {
  const url = `https://musicbrainz.org/ws/2/release/${releaseId}?inc=genres&fmt=json`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) {
      console.warn('Media Base: MusicBrainz genre lookup', url, '->', res.status, res.status === 503 ? '(rate limited)' : '');
      return [];
    }
    const json = await res.json();
    const genres = Array.isArray(json?.genres) ? json.genres : [];
    const names = genres.map((g: any) => g?.name).filter(Boolean);
    console.warn('Media Base: MusicBrainz genre lookup', url, '->', names.length, 'genre(s):', names);
    return names;
  } catch (err) {
    console.warn('Media Base: MusicBrainz genre lookup threw', url, err);
    return [];
  }
}

/** The URL "Where to Listen" opens - a plain Spotify search, not a
 * precise deep link to a specific album, since that would need
 * Spotify's own API access (meaningfully restricted for this exact use
 * case as of February 2026 - see the file header). No API access needed
 * at all here - the person taps this, lands on Spotify's own search
 * results for the artist+album, and picks the right match themselves.
 * Deliberately always shown wherever this is used, unlike Where to
 * Watch's tmdbId-gated button - this needs no external id, just the
 * artist/album text every entry already has regardless of how it was
 * added (search or typed by hand). */
export function spotifySearchUrl(artist: string, album: string): string {
  return `https://open.spotify.com/search/${encodeURIComponent(`${artist} ${album}`)}`;
}
