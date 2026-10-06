# Brand colours and fonts

Applies the True Ultimate Training colours and fonts across the app. Nothing else changes: no layout, copy, logo or feature changes.

## What changed
- **tailwind.config.ts**: `brand` is now the cone orange (#F47A20) with helpers for hover, text-on-orange, orange text, tints and asphalt; Tailwind's `slate` greys are replaced by the brand greys at matching contrast; fonts are Barlow (body), Barlow Condensed (`font-display`) and IBM Plex Mono (`font-mono`).
- **app/layout.tsx**: loads the three fonts with `next/font/google` (self-hosted by Next at build time; no extra package needed).
- **app/globals.css**: page background is chalk (#F5F3EF); h1 and h2 use Barlow Condensed, h1 in uppercase.
- **app/** and **components/** pages (22 files): class swaps only.
  - Orange buttons use near-black text (`text-brand-on`), because white on orange is hard to read.
  - Orange links and labels use the darker text orange (`text-brand-text`).
  - Blue hover and selected-card tints are now orange (`hover:bg-brand-hover`, `bg-brand-tint`).
  - The rest timer label is orange.
  - The blue "phase change coming up" items on the coach dashboard stay blue on purpose, because blue is the brand's info colour.

## How to apply
Copy these files into the repo at the same paths (replace the existing files), commit, and push. Vercel will rebuild.
