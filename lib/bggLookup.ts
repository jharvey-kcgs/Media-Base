// lib/bggLookup.ts
//
// Tabletop Games' title-search lookup - BoardGameGeek's XML API2.
//
// CORRECTION: originally written assuming this was free and keyless for
// basic search/thing lookups - that was wrong, confirmed via BGG's own
// registration guide (https://boardgamegeek.com/using_the_xml_api) after
// a direct request: "Registration and authorization is required for use
// of the XML API" for essentially any real use case, not an edge case.
// Needs a BGG_APPLICATION_TOKEN (lib/config.ts) sent as
// `Authorization: Bearer <token>` on every request - without it, BGG's
// own docs say the API simply won't work at all, not just rate-limited.
// Getting a token is a genuinely slower process than TMDb/Discogs ever
// were: register an application at boardgamegeek.com/applications,
// choose "Non-commercial", then wait for approval - BGG's own docs say
// this can take a week or more, not the instant self-service tokens
// those other two services gave.
//
// Rate limit is unofficial (BGG doesn't document one directly) but
// commonly cited as ~2 requests/second - real, but the search-then-fetch
// flow below only ever needs 2 requests per selection, well under that.
//
// Two genuine differences from every other lookup in this app, both
// confirmed via real research before writing this, not guessed:
//
// 1. This is a two-step lookup, not a single bundled response like
//    Discogs. BGG's search endpoint only returns id/title/year -
//    getting genre, cover art, or player count requires a SECOND
//    request (the "thing" endpoint) once a specific result is picked.
//    Same shape as Music's async fetch-after-selection, not Vinyl/CD's
//    instant everything-at-once fill.
// 2. BGG's API returns XML, not JSON - the first lookup in this app
//    that isn't. Confirmed via a real verified response sample before
//    writing any parsing logic:
//      <name type="primary" value="Brass: Birmingham"/>
//      <minplayers value="2"/>
//      <maxplayers value="4"/>
//      <link type="boardgamecategory" value="Economic"/>
//      <thumbnail>https://cf.geekdo-images.com/...</thumbnail>
//    Most fields live in a `value` attribute on a self-closing tag -
//    except the cover image, which is plain text inside its own tag,
//    a real inconsistency worth getting right rather than assuming one
//    pattern covers everything.
//
// Deliberately hand-rolled regex extraction below, not a real XML
// parser library - this sandbox's npm registry access was down when
// this was written (confirmed via a direct, isolated `npm view` request
// failing with the same error, not just a full-install issue), so a new
// dependency couldn't be installed and verified working in this
// environment. The extraction functions below are narrowly scoped to
// the exact, verified shape above rather than general-purpose XML
// parsing, to keep that risk contained.
//
// UPDATE: now confirmed network-tested against BGG's live API, once a
// real BGG_APPLICATION_TOKEN was approved and added. That testing found
// two real bugs, both fixed: decodeXmlEntities() didn't handle numeric
// character references (BGG's own data uses one for an apostrophe -
// "Children&#039;s Game" was showing up literally, undecoded, in the
// Edit form), and a short, common title like "Uno" or "Clue" returned
// hundreds of loosely-related results rather than the well-known game
// itself, since BGG's plain query search matches a term anywhere in a
// title/description/alternate name with no exact-match ranking -
// searchBggByTitle() now tries BGG's own documented `exact` parameter
// first, falling back to the broad search only when that finds nothing.

import { BGG_APPLICATION_TOKEN } from './config';

const USER_AGENT = 'MediaBase/1.0 +https://github.com/JHarvey/Media-Base';

function authHeaders(): Record<string, string> {
  return {
    'User-Agent': USER_AGENT,
    ...(BGG_APPLICATION_TOKEN ? { Authorization: `Bearer ${BGG_APPLICATION_TOKEN}` } : {}),
  };
}

export interface BggSearchResult {
  key: string; // BGG's numeric item id, as a string
  bggId: number;
  title: string;
  releaseYear?: string;
}

export interface BggGameDetails {
  genres: string[]; // boardgamecategory links only, not mechanics/designers/etc.
  players: string; // combined min-max, e.g. "2-6" or just "4" when min equals max
  coverUrl: string | null;
}

/** Extracts every occurrence of a self-closing tag's `value` attribute
 * for a given tag name - covers <name value="..."/>, <yearpublished
 * value="..."/>, <minplayers value="..."/>, etc. Returns every match, in
 * document order, since some tags (like <link>) appear multiple times
 * per item. */
function extractValueAttrs(xml: string, tagName: string): string[] {
  const re = new RegExp(`<${tagName}\\b[^>]*\\bvalue="([^"]*)"`, 'g');
  const matches: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    matches.push(m[1]);
  }
  return matches;
}

/** Same idea, but only for a <link> tag matching a specific `type`
 * attribute (e.g. type="boardgamecategory") - link tags carry several
 * different kinds of data (category, mechanic, designer, publisher...)
 * all under the same tag name, distinguished only by type. */
function extractLinkValuesByType(xml: string, linkType: string): string[] {
  const re = new RegExp(`<link\\b[^>]*\\btype="${linkType}"[^>]*\\bvalue="([^"]*)"`, 'g');
  const matches: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    matches.push(m[1]);
  }
  return matches;
}

/** Extracts the text content of the first occurrence of a plain tag
 * (not self-closing, not a `value` attribute) - covers <thumbnail>...
 * </thumbnail> and <image>...</image>, the one real exception to the
 * value-attribute pattern everything else here follows. */
function extractTagText(xml: string, tagName: string): string | null {
  const re = new RegExp(`<${tagName}>([^<]*)</${tagName}>`);
  const m = re.exec(xml);
  return m ? m[1].trim() : null;
}

// XML entities BGG's data can genuinely contain in a title or category
// name (an ampersand in "Sports & ...", a stray quote in a game's own
// title) - decoded so stored text reads naturally rather than showing
// literal &amp;/&quot; to the person using the app.
// Confirmed real bug via testing: this only handled named entities
// (&amp;, &apos;, etc.) - BGG's actual data uses NUMERIC character
// references for at least an apostrophe ("Children&#039;s Game" -
// decimal code 39, not the named &apos;), which passed through
// undecoded before this fix. Handles both decimal (&#39;) and hex
// (&#x27;) forms, since XML permits either.
function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_match, code) => String.fromCharCode(parseInt(code, 16)));
}

/** Splits BGG's <items>...<item type="..." id="...">...</item>...
 * </items> search response into each individual item's own XML chunk,
 * so extraction functions above can be run against one item at a time
 * rather than accidentally matching across item boundaries (a search
 * result's <name value="..."/> needs to stay paired with that same
 * result's own id, not whichever one happens to be nearest in a global
 * regex match). */
function splitItems(xml: string): { id: number; chunk: string }[] {
  const re = /<item\b[^>]*\bid="(\d+)"[^>]*>([\s\S]*?)<\/item>/g;
  const items: { id: number; chunk: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    items.push({ id: Number(m[1]), chunk: m[2] });
  }
  return items;
}

/** Title search - BGG's search endpoint, id/title/year only. Selecting
 * a result needs a follow-up fetchBggGameDetails() call for genre/
 * cover/players - see the file header for why. */
// Confirmed real bug via testing: searching a short, common title like
// "Uno" or "Clue" returned hundreds of loosely-related results (BGG's
// own logs showed 211 for one such search) rather than the well-known
// game itself - BGG's plain query search matches the term anywhere in a
// title, description, or alternate name, with no ranking that favors an
// exact title match. BGG's own search endpoint supports a real, documented
// `exact` parameter for exactly this case (confirmed via several
// independent third-party API clients, not guessed) - this tries that
// first, and only falls back to the broad, unrestricted search if the
// exact match finds nothing, same "try precise first, fall back
// broader" shape already proven for Music's "Artist - Title" parsing
// and Anime's TMDb-then-Jikan fallback.
async function fetchBggSearchResults(query: string, exact: boolean): Promise<BggSearchResult[]> {
  const url = `https://boardgamegeek.com/xmlapi2/search?query=${encodeURIComponent(query)}&type=boardgame${exact ? '&exact=1' : ''}`;
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) {
    console.warn('Media Base: BGG search returned', res.status, url, res.status === 401 || res.status === 403 ? '(check BGG_APPLICATION_TOKEN is valid and approved)' : '');
    return [];
  }
  const xml = await res.text();
  const items = splitItems(xml);
  const results: BggSearchResult[] = [];
  for (const { id, chunk } of items) {
    const nameValues = extractValueAttrs(chunk, 'name');
    if (nameValues.length === 0) continue;
    const yearValues = extractValueAttrs(chunk, 'yearpublished');
    results.push({
      key: String(id),
      bggId: id,
      title: decodeXmlEntities(nameValues[0]),
      releaseYear: yearValues[0] || undefined,
    });
  }
  console.warn('Media Base: BGG search', `"${query}"`, exact ? '(exact)' : '(broad)', '->', items.length, 'raw,', results.length, 'usable');
  return results;
}

export async function searchBggByTitle(query: string): Promise<BggSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  if (!BGG_APPLICATION_TOKEN) {
    console.warn('Media Base: BGG_APPLICATION_TOKEN is not set in lib/config.ts - Tabletop Games lookup is unavailable until it is (registration + approval required, see the file header)');
    return [];
  }
  try {
    const exactResults = await fetchBggSearchResults(trimmed, true);
    if (exactResults.length > 0) return exactResults.slice(0, 8);
    const broadResults = await fetchBggSearchResults(trimmed, false);
    return broadResults.slice(0, 8);
  } catch (err) {
    console.warn('Media Base: BGG search threw', err);
    return [];
  }
}

/** Full details for one specific game, fetched after a search result is
 * selected - genre (boardgamecategory links only), players
 * (min-max combined into one string), and cover art. */
export async function fetchBggGameDetails(bggId: number): Promise<BggGameDetails> {
  if (!BGG_APPLICATION_TOKEN) {
    console.warn('Media Base: BGG_APPLICATION_TOKEN is not set in lib/config.ts - Tabletop Games lookup is unavailable until it is');
    return { genres: [], players: '', coverUrl: null };
  }
  const url = `https://boardgamegeek.com/xmlapi2/thing?id=${bggId}`;
  try {
    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) {
      console.warn('Media Base: BGG thing lookup returned', res.status, url, res.status === 401 || res.status === 403 ? '(check BGG_APPLICATION_TOKEN is valid and approved)' : '');
      return { genres: [], players: '', coverUrl: null };
    }
    const xml = await res.text();
    const genres = extractLinkValuesByType(xml, 'boardgamecategory').map(decodeXmlEntities);
    const minPlayers = extractValueAttrs(xml, 'minplayers')[0];
    const maxPlayers = extractValueAttrs(xml, 'maxplayers')[0];
    let players = '';
    if (minPlayers && maxPlayers) {
      players = minPlayers === maxPlayers ? minPlayers : `${minPlayers}-${maxPlayers}`;
    } else {
      players = minPlayers || maxPlayers || '';
    }
    const coverUrl = extractTagText(xml, 'image') || extractTagText(xml, 'thumbnail');
    console.warn('Media Base: BGG thing lookup', url, '->', genres.length, 'genre(s):', genres, '| players:', players || '(none)', '| cover:', coverUrl ?? '(none)');
    return { genres, players, coverUrl };
  } catch (err) {
    console.warn('Media Base: BGG thing lookup threw', url, err);
    return { genres: [], players: '', coverUrl: null };
  }
}
