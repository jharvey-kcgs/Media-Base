// lib/jikanLookup.ts
//
// Anime's fallback lookup source - MyAnimeList data via Jikan
// (api.jikan.moe), a free, keyless REST wrapper. Tried only when TMDb
// (lib/tvLookup.ts's tmdbSearchTVShows(), the primary source - most
// mainstream-popular anime is catalogued there as a regular TV show)
// comes back with nothing. Same multi-source resilience pattern already
// established for Books/Comics (Google Books primary, Open Library
// fallback in lib/titleSearch.ts).
//
// Genuinely different result shape from TMDb, not a drop-in reuse:
// MyAnimeList's own genre taxonomy (Isekai, Mecha, Shounen, etc. -
// meaningfully more anime-specific than TMDb's generic TV genres),
// different field names (mal_id instead of id, images.jpg.large_image_url
// instead of poster_path, aired.from instead of first_air_date). No
// tmdbId on a Jikan-sourced result at all - MyAnimeList doesn't carry a
// TMDb cross-reference, so an anime found only through this fallback
// gets real title/genre/cover data but no Where to Watch button.
//
// NOTE: not network-tested from the sandbox this was written in.

export interface JikanLookupResult {
  key: string; // "jikan-{mal_id}" - distinguishes from a TMDb result's plain numeric key, since both feed into the same unified search
  title: string;
  genres: string[];
  releaseYear?: string;
  coverUrl?: string;
}

export async function searchJikanAnime(query: string, maxResults: number): Promise<JikanLookupResult[]> {
  const res = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=${maxResults}`);
  if (!res.ok) {
    // 429 is a real, documented possibility (Jikan proxies a shared,
    // rate-limited service) - logged unconditionally rather than
    // suppressed, same reasoning as Books/Comics' title search after
    // that exact silent-429 bug there.
    console.warn('Media Base: Jikan returned', res.status);
    return [];
  }
  const json = await res.json();
  const items = Array.isArray(json?.data) ? json.data : [];

  const results: JikanLookupResult[] = [];
  for (const item of items) {
    if (!item?.title || item?.mal_id == null) continue;
    const genres = Array.isArray(item.genres) ? item.genres.map((g: any) => g?.name).filter(Boolean) : [];
    results.push({
      key: `jikan-${item.mal_id}`,
      title: item.title as string,
      genres,
      releaseYear: item.aired?.from ? String(item.aired.from).slice(0, 4) : undefined,
      coverUrl: item.images?.jpg?.large_image_url ?? item.images?.jpg?.image_url ?? undefined,
    });
  }
  console.warn('Media Base: Jikan search for', `"${query}"`, '->', items.length, 'raw,', results.length, 'usable');
  return results;
}
