# JME Child theme

Storefront child theme that applies the JME design system to WordPress + WooCommerce. Every value comes from `assets/css/tokens/*.css`, which are byte-for-byte copies of the design-system token files. When the design system changes, re-copy those five files; do not hand-edit them here.

## Install

```bash
wp theme install storefront --activate      # parent
cp -r jme-child wp-content/themes/jme-child
wp theme activate jme-child
```

Then in **Appearance → Customize → Site Identity** upload `assets/img/jme-logo-full-source.jpg` as the logo. Create a page with slug `request-list` (YITH's quote-list shortcode) so the header "Request list" button resolves.

## What it does

- Loads fonts (Barlow Condensed / Barlow / JetBrains Mono), tokens, and `components.css` (the design system's `core.css`) ahead of `style.css`.
- Maps Storefront, WooCommerce, YITH Request a Quote and FiboSearch markup onto the tokens (dark digital surface).
- Removes every price, sale flash, rating, stock string and cart from output and from structured data (`functions.php` §2). `style.css` §7 hides them again in case a plugin prints its own.
- Prints a status-band badge from `_jme_status_band` product meta (seven approved bands, never a quantity).
- Adds the header contact bar: phone `(269) 659-0093`, `parts@jmequipment.net`, Request list.
- `/console/*` and `/internal/*` get `noindex,nofollow`, an `X-Robots-Tag`, and the light surface system (`body.jme-console`).
- Block editor limited to the brand palette and the type scale.

## Product meta expected from the Stage A export

| Meta key | Values |
| --- | --- |
| `_jme_price_status` | `quote_only` (all import-eligible rows) |
| `_jme_status_band` | `in-stock`, `ships-quickly`, `short-lead`, `lead-time`, `made-to-order`, `confirm-fitment`, `contact-parts-desk` |

## Component classes available in content

`.jme-btn` (`--ghost`, `--gold`, `--sm`, `--lg`, `--block`), `.jme-tag`, `.jme-badge`, `.jme-card`, `.jme-plate`, `.jme-eyebrow`, `.jme-cutline`, `.jme-chrome-rule`, `.jme-mark`, `.jme-mono`, `.on-light` wrapper for document surfaces. See `assets/css/components.css`.

## Swapping the parent theme

Only `style.css` §2 (header) and §9 (footer) and the `storefront_header` hooks in `functions.php` are Storefront-specific. Everything else targets WooCommerce / plugin markup and carries over.

## Offline fonts

For a fully self-hosted build, download the three families as `.woff2`, add `@font-face` rules to a new `assets/css/tokens/fonts.css`, enqueue it in place of `jme-fonts`, and remove the `fonts.gstatic.com` preconnect.
