// lib/bggLookup.ts
//
// Tabletop Games' title-search lookup - BoardGameGeek's XML API2. Free
// and keyless for basic search/thing lookups (no personal token needed
// the way Discogs required) - "Application Tokens" mentioned in BGG's
// own docs are for a different, higher-volume use case this app isn't
// in. Rate limit is unofficial (BGG doesn't document one directly) but
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
// NOTE: not network-tested from the sandbox this was written in.

const USER_AGENT = 'MediaBase/1.0 +https://github.com/JHarvey/Media-Base';

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
function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
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
export async function searchBggByTitle(query: string): Promise<BggSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const url = `https://boardgamegeek.com/xmlapi2/search?query=${encodeURIComponent(trimmed)}&type=boardgame`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) {
      console.warn('Media Base: BGG search returned', res.status, url);
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
    console.warn('Media Base: BGG search', `"${trimmed}"`, '->', items.length, 'raw,', results.length, 'usable');
    return results.slice(0, 8);
  } catch (err) {
    console.warn('Media Base: BGG search threw', err);
    return [];
  }
}

/** Full details for one specific game, fetched after a search result is
 * selected - genre (boardgamecategory links only), players
 * (min-max combined into one string), and cover art. */
export async function fetchBggGameDetails(bggId: number): Promise<BggGameDetails> {
  const url = `https://boardgamegeek.com/xmlapi2/thing?id=${bggId}`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) {
      console.warn('Media Base: BGG thing lookup returned', res.status, url);
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
