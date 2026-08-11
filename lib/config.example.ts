// lib/config.example.ts
//
// TEMPLATE - copy this file to lib/config.ts (which is git-ignored,
// since this repo is public) and paste your own token in. lib/config.ts
// itself is never committed - if you're setting this project up fresh,
// this is the file you edit first.
//
// Movies' and TV Shows' title-search auto-fill both need a free TMDb
// (The Movie Database) credential - unlike Books/Comics' ISBN lookup
// (Open Library + Google Books, both fully keyless), there's no keyless
// source for real movie/TV metadata.
// Specifically the "API Read Access Token" (v4 auth, a long JWT-style
// string) - not the shorter "API Key" (v3 auth) shown on the same page.
// Both authenticate the same underlying access; this app's code is built
// around Bearer-token auth (Authorization: Bearer <token>), which is
// what the Read Access Token is for.
//
// Get one free at https://www.themoviedb.org/settings/api (just needs
// an email signup, no payment, no credit card) and paste it below in
// your own lib/config.ts. Until that's filled in, searching for a movie
// or TV show by title will show a clear error explaining why instead of
// a confusing network failure - manual entry (typing in title/genre by
// hand) always works regardless.
export const TMDB_READ_ACCESS_TOKEN = '';

// Vinyl/CD's title-search and barcode lookup both need a Discogs
// personal token - unlike Books/Comics' ISBN lookup, there's no keyless
// source for real vinyl/CD release metadata.
//
// Get one at https://www.discogs.com/settings/developers - create an
// application first (Application Name/Description required, Homepage
// URL optional, leave Callback URL blank - that field's for a full
// OAuth 1.0a login flow other users would go through, which this app
// doesn't need), then generate a personal token from that same
// Developer settings page. That personal token is what goes below - not
// the Consumer Key/Secret the application itself gets, which is for a
// different auth flow this app isn't using. Until this is filled in,
// searching or scanning a barcode for Vinyl/CD will show a clear error
// explaining why instead of a confusing network failure - manual entry
// always works regardless.
export const DISCOGS_USER_TOKEN = '';
