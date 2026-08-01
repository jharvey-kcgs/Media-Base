// lib/config.ts
//
// Movies' UPC lookup needs a free TMDb (The Movie Database) API key -
// unlike Books/Comics' ISBN lookup (Open Library + Google Books, both
// fully keyless), there's no keyless source for real movie metadata.
// UPCitemdb (the UPC -> rough product title step, see lib/upcLookup.ts)
// doesn't need a key either - only this second step does.
//
// Get one free at https://www.themoviedb.org/settings/api (just needs
// an email signup, no payment, no credit card) and paste it below.
// Until this is filled in, scanning/entering a UPC for a movie will show
// a clear error explaining why instead of a confusing network failure -
// manual entry (typing in title/genre by hand) always works regardless.
export const TMDB_API_KEY = '';
