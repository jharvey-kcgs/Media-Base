// lib/config.example.ts
//
// TEMPLATE - copy this file to lib/config.ts (which is git-ignored,
// since this repo is public) and paste your own token in. lib/config.ts
// itself is never committed - if you're setting this project up fresh,
// this is the file you edit first.
//
// Movies' UPC lookup needs a free TMDb (The Movie Database) credential -
// unlike Books/Comics' ISBN lookup (Open Library + Google Books, both
// fully keyless), there's no keyless source for real movie metadata.
// Specifically the "API Read Access Token" (v4 auth, a long JWT-style
// string) - not the shorter "API Key" (v3 auth) shown on the same page.
// Both authenticate the same underlying access; this app's code is built
// around Bearer-token auth (Authorization: Bearer <token>), which is
// what the Read Access Token is for.
//
// Get one free at https://www.themoviedb.org/settings/api (just needs
// an email signup, no payment, no credit card) and paste it below in
// your own lib/config.ts. Until that's filled in, scanning/entering a
// UPC for a movie will show a clear error explaining why instead of a
// confusing network failure - manual entry (typing in title/genre by
// hand) always works regardless.
export const TMDB_READ_ACCESS_TOKEN = '';
