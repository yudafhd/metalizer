# Adobe Stock Metadata Generator

Local-first desktop application for generating, reviewing, validating, and exporting Adobe Stock metadata in batches.

## Stack

- Tauri v2 + Rust native core
- React 19 + TypeScript + Vite
- Tailwind CSS
- Gemini API with `gemini-2.5-flash` as the default model
- Tauri Stronghold for the Gemini API key
- Tauri Store for application preferences
- Rust `image` contact-sheet processing
- Rust `csv` writer for escaped Adobe-compatible CSV output

## Core workflow

1. Import JPG, JPEG, PNG, or WebP files or recursively scan a folder.
2. Create stable UUID asset records and small thumbnail previews.
3. Group assets into configurable batches of 1–6.
4. Build a labeled contact sheet without cropping or stretching source images.
5. Send one composite image plus an internal panel-ID mapping to Gemini through Rust.
6. Validate returned IDs, retry transient failures, and retry missing panels independently.
7. Normalize keywords, score metadata, and expose warnings for review.
8. Edit titles, categories, keyword order, content-source flag, and bulk metadata.
9. Export correctly escaped UTF-8 CSV with `Filename,Title,Keywords,Category` headers.

## Run locally

Install the Tauri prerequisites for your operating system, including Rust, Cargo, and the native WebView dependencies. Then:

```bash
npm install
npm run tauri dev
```

For a production bundle:

```bash
npm run tauri build
```

The frontend can also be previewed independently with `npm run dev`, but file import, Stronghold, native image processing, and Gemini generation require the Tauri desktop runtime.

## Security and privacy

- The Gemini API key is written to the Tauri Stronghold vault and is never placed in `localStorage`, `.env`, or the preferences JSON.
- Rust owns the in-memory API key used for Gemini requests.
- Original image files are read-only; contact sheets are temporary files under the application cache and are cleaned after each request.
- No account, cloud database, telemetry, Adobe login, scraping, or automatic upload is included.

## Verification

```bash
npm run build
npm test
```

The included unit tests cover 1, 6, 13, and 100-image batching, panel IDs, keyword normalization, validation, scoring, and CSV escaping.
