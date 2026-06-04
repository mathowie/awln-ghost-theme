# AWLN — a Ghost theme for A Whole Lotta Nothing

An editorial Ghost theme focused on **readable typography** and **large-format
photography**. Warm paper-cream background, Fraunces serif body, text column
capped at 640px, feature images that break out of the column to full width,
and a homepage that alternates one full-width featured story with rows of
three smaller cards.

## Requirements

- Ghost **5.0** or later
- Ghost API **v5**

## Installation

1. Build a Ghost-uploadable zip:
   ```sh
   ./package.sh
   ```
   The zip lands in `dist/awln-v<version>.zip` (version is read from
   `package.json`). Git, README, LICENSE and the build script itself are
   excluded automatically.
2. In Ghost admin, go to **Settings → Design → Change theme → Upload theme**.
3. Upload the zip, then click **Activate**.

For local development, symlink this folder into your Ghost install's
`content/themes/` and run `ghost restart`.

## Setting up your site

### Navigation

Under **Settings → Navigation** in Ghost admin, set up the primary nav. The
suggested items, matching the design:

| Label     | URL                                |
|-----------|------------------------------------|
| Archives  | `/archive/` (or your tag list)     |
| About     | `/about/`                          |
| Contact   | `mailto:you@example.com`           |
| Mastodon  | `https://mastodon.social/@you`     |
| RSS       | `/rss/`                            |

External URLs (Mastodon, Contact, RSS) work automatically — Ghost passes them
straight through. No `.hbs` files needed for those.

You can also set a **secondary navigation** which renders in the footer.

### Social accounts

The footer renders a row of social icons fed by **Settings → General →
Social accounts** (Ghost 5.x+). Connect any of: X, Facebook, LinkedIn,
Bluesky, Threads, Mastodon, TikTok, YouTube, Instagram. Empty platforms
are skipped automatically.

Icons live in `partials/icons/<type>.hbs`. The footer uses Handlebars'
block-form dynamic partial pattern, so if Ghost adds a new platform before
this theme ships an icon for it, the row falls back to a small text chip
labelled with the platform name instead of throwing a page error.

### Site title

The nav and footer pull from your site title. The accent-colored italic word
trick (e.g. "A Whole Lotta *Nothing*") only works if you wrap the word in a
span in your title — Ghost doesn't allow HTML in site titles, so the theme
falls back to "A Whole Lotta Nothing" as plain text when you set the title in
admin. If you want the styled version, leave the site title blank and the
theme will render the styled fallback.

### Subscribe button

The pill-shaped Subscribe button in the nav opens Ghost Portal automatically.
Configure your members tiers in **Settings → Membership** before going live.

## Customization options

Under **Settings → Design → Customize**:

- **Show dropcap** *(toggle, default on)* — Large drop cap on the first
  paragraph of every post.
- **Header tagline** *(text)* — Italic tagline shown next to the homepage
  title. Default: "Notes on woodworking, homelabs, EVs, and whatever else
  holds my attention this month."
- **Header title word** *(text)* — The accent-colored italic word in the
  homepage header. Default: "writing" (renders as "Latest *writing*").

## How posts render

### Recommended fields

- **Feature image** *(strongly recommended)* — Used as the 16:9 hero on each
  post and as the 21:9 image on the homepage featured slot, or 4:3 on smaller
  cards.
- **Feature image alt text** — For accessibility.
- **Feature image caption** — Rendered as italic caption under the hero.
- **Custom excerpt** — Rendered as the italic deck under the post title. If
  empty, no deck is shown on posts (it's only used as a fallback for the
  homepage featured card excerpt).

### Koenig editor cards

All built-in Ghost cards are styled to match:

- **Image** (Regular / Wide / Full) — Wide breaks to 960px, Full to 1280px.
  Both use viewport-anchored centering that's safe in Safari at all font sizes.
- **Gallery** — Multi-image grid layout.
- **Bookmark** — Horizontal preview card.
- **Callout** — Paper-dim background with accent left border.
- **Button** — Ink-colored pill, accent on hover.
- **Blockquote** — Accent left border, italic.
- **Code block** — Dark theme with JetBrains Mono.
- **Horizontal rule** — Replaced with a decorative diamond glyph.

## How the homepage layout works

Every page of posts renders as up to **3 cycles** of:
- **1 featured card** (full-width, 21:9 image, title + excerpt + reading time)
- **3 trio cards** (3-column grid, 4:3 images)

That's 12 posts per page, matching `posts_per_page` in `package.json`. Cycles
gracefully omit themselves if a page has fewer posts (e.g. the last page of
your archive).

If you change `posts_per_page`, you'll want to add or remove cycles in
`index.hbs` — the cycle count is hardcoded for clarity since Ghost's
Handlebars doesn't support modulo arithmetic.

## Members & subscribe

- The nav Subscribe button opens Ghost Portal.
- Posts include an inline subscribe form at the end for non-members. It posts
  to `/members/api/send-magic-link/` and shows a confirmation state.
- The nav button switches to "Account" when a member is signed in.

## File structure

```
awln/
├── assets/
│   ├── css/screen.css
│   └── js/main.js
├── partials/
│   ├── featured-card.hbs    — homepage featured slot
│   ├── post-card.hbs        — trio + tag/author archive cards + further reading
│   ├── site-nav.hbs
│   └── site-footer.hbs
├── default.hbs              — base layout
├── index.hbs                — homepage (featured + trio repeating)
├── post.hbs                 — single post
├── page.hbs                 — static page
├── tag.hbs                  — tag archive (uniform grid)
├── author.hbs               — author archive (uniform grid)
├── error.hbs                — 404 / error pages
├── package.json
└── README.md
```

## Fonts

Loaded from Google Fonts:
- **Fraunces** — variable serif for display + body
- **Inter** — UI, bylines, kickers
- **JetBrains Mono** — inline + block code

To self-host, drop font files into `assets/fonts/` and replace the Google
Fonts `<link>` tag in `default.hbs` with local `@font-face` rules.

## Validation

Before uploading to production, run Ghost's official validator:

```sh
npx gscan /path/to/awln
```

## License

MIT.
