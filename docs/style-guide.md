# JPX Workout — UI Style Guide

> **Purpose:** Ensure consistent visual design across AI-assisted and manual development.
> All tokens are defined in [`globals.css`](../apps/web/src/app/globals.css).

---

## 1. Brand Colors

The brand palette is **teal/cyan**, not purple or blue.

| Token                | Value                  | Usage                        |
|----------------------|------------------------|------------------------------|
| `--color-brand`      | `oklch(0.65 0.18 170)` | Primary buttons, accents     |
| `--color-brand-light`| `oklch(0.75 0.15 170)` | Hover highlights, badges     |
| `--color-brand-dark` | `oklch(0.45 0.15 170)` | Gradient endpoints, shadows  |

> [!CAUTION]
> **Never hardcode color values.** Always use CSS variables. Hardcoded `oklch()` or `#hex` values break theming and lead to visual inconsistency.

### Discipline Colors

| Token               | Hue  | Sport     |
|----------------------|------|-----------|
| `--color-swim`       | 220  | Swimming  |
| `--color-bike`       | 45   | Cycling   |
| `--color-run`        | 25   | Running   |
| `--color-strength`   | 310  | Strength  |

### Status Colors

| Token              | Usage   |
|--------------------|---------|
| `--color-success`  | Green — positive actions, completion |
| `--color-warning`  | Amber — caution states              |
| `--color-danger`   | Red — destructive actions, errors   |

---

## 2. Surfaces & Glass

The design system uses a **Liquid Glass** aesthetic with translucent layers.

### Surface Tokens

| Token                     | Usage                             |
|---------------------------|-----------------------------------|
| `--color-surface`          | Page background                  |
| `--color-surface-raised`   | Elevated content areas           |
| `--color-glass-bg`         | Glass card background            |
| `--color-glass-bg-hover`   | Glass card hover state           |
| `--color-glass-border`     | Default glass border             |
| `--color-glass-border-active` | Active/focused border         |
| `--color-glass-highlight`  | Inset top highlight              |
| `--color-glass-shadow`     | Default drop shadow              |

---

## 3. Component Classes

Use these predefined classes instead of assembling ad-hoc styles:

### Cards

```html
<div class="glass-card">...</div>
<div class="glass-card glass-card-spotlight">...</div>  <!-- cursor glow -->
```

### Buttons

| Class         | Style                                  |
|---------------|----------------------------------------|
| `btn-primary` | Brand gradient, white text, glow shadow |
| `btn-ghost`   | Transparent, subtle hover border       |

```html
<button class="btn-primary">Save</button>
<button class="btn-ghost">Cancel</button>
```

### Inputs

```html
<input class="glass-input" placeholder="Email" />
```

### Badges

```html
<span class="badge badge-swim">🏊 Swim</span>
<span class="badge badge-bike">🚴 Bike</span>
<span class="badge badge-run">🏃 Run</span>
<span class="badge badge-strength">💪 Strength</span>
```

### Layout

| Class               | Usage                       |
|----------------------|-----------------------------|
| `glass-sidebar`     | Desktop side navigation     |
| `glass-bottom-bar`  | Mobile bottom navigation    |

---

## 4. Typography

- **Primary font:** Inter (loaded via `next/font/google`)
- **Mono font:** Geist Mono (for code/data)
- Use Tailwind text utilities: `text-sm`, `text-base`, `text-lg`, `text-xl`

### Text Color Tokens

| Token                    | Usage                    |
|--------------------------|--------------------------|
| `--color-text-primary`   | Headings, body text      |
| `--color-text-secondary` | Descriptions, subtitles  |
| `--color-text-muted`     | Placeholders, metadata   |

---

## 5. Spacing

- Use Tailwind spacing scale: `p-4`, `gap-3`, `space-y-2`, etc.
- Sidebar width: `--spacing-sidebar: 260px`
- Card border-radius: `1.25rem` (20px)
- Button/input border-radius: `0.75rem` (12px)

---

## 6. Animations

| Keyframe         | Effect                        | Usage                  |
|------------------|-------------------------------|------------------------|
| `fade-in`        | Opacity + translateY(8px)     | Page/card enter        |
| `slide-in-left`  | Opacity + translateX(-12px)   | Sidebar/nav items      |
| `pulse-glow`     | Box-shadow pulse              | Active/loading states  |

---

## 7. Dark / Light Theming

- **Dark mode** is the default (`:root`)
- **Light mode** is activated via `html[data-theme="light"]`
- All surface/glass/text tokens have light-theme overrides
- **Never assume one theme.** Test both.

> [!IMPORTANT]
> When adding new UI, verify it looks correct in both dark and light themes by toggling `data-theme` on the `<html>` element.

---

## 8. Rules for AI-Assisted Development

1. ✅ **Always use CSS variables** from `globals.css` — never hardcode `oklch()`, `rgb()`, or hex
2. ✅ **Use component classes** (`glass-card`, `btn-primary`, etc.) before writing custom styles
3. ✅ **Test both themes** — dark and light
4. ✅ **Use discipline tokens** for sport-specific UI (swim = blue, bike = amber, run = coral)
5. ❌ **Don't invent new colors** — extend the token system if needed
6. ❌ **Don't use purple/blue as brand** — the brand is teal (hue 170)
7. ❌ **Don't bypass the glass aesthetic** — no flat opaque cards
