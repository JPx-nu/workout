# Triathlon AI — Liquid Glass Design System

> Reference for all design tokens, components, and patterns.  
> Source of truth: [`globals.css`](../apps/web/src/app/globals.css)

---

## 1. Color Tokens

All colors use **oklch** for perceptual uniformity across themes.

### Brand
| Token | Value | Usage |
|---|---|---|
| `--color-brand` | `oklch(0.65 0.18 170)` | Primary actions, active states |
| `--color-brand-light` | `oklch(0.75 0.15 170)` | Hover accents, gradients |
| `--color-brand-dark` | `oklch(0.45 0.15 170)` | Pressed states, gradient ends |

### Discipline
| Token | Hue | Usage |
|---|---|---|
| `--color-swim` | 220 (blue) | Swim badges, charts |
| `--color-bike` | 45 (amber) | Bike badges, charts |
| `--color-run` | 25 (red-orange) | Run badges, charts |
| `--color-strength` | 310 (purple) | Strength badges |

### Status
| Token | Usage |
|---|---|
| `--color-success` | Positive indicators, completed states |
| `--color-warning` | Caution indicators, elevated values |
| `--color-danger` | Error states, injury markers |

### Surface & Glass (theme-dependent)
| Token | Dark Theme | Light Theme |
|---|---|---|
| `--color-surface` | `oklch(0.08 ...)` | `oklch(0.965 ...)` |
| `--color-glass-bg` | `oklch(0.14 ... / 0.55)` | `oklch(0.99 ... / 0.55)` |
| `--color-glass-border` | `oklch(0.95 ... / 0.1)` | `oklch(0.3 ... / 0.12)` |
| `--color-text-primary` | `oklch(0.95 ...)` | `oklch(0.15 ...)` |
| `--color-text-secondary` | `oklch(0.7 ...)` | `oklch(0.35 ...)` |
| `--color-text-muted` | `oklch(0.5 ...)` | `oklch(0.5 ...)` |

---

## 2. Glass Components

### `.glass-card`
Frosted glass card with backdrop blur, subtle border, hover lift, and refraction glow.

```css
background: var(--color-glass-bg);
backdrop-filter: blur(24px) saturate(1.4);
border: 1px solid var(--color-glass-border);
border-radius: 1.25rem;
```

**Hover**: background brightens, border activates, shadow deepens, `translateY(-1px)`.

### `.glass-sidebar`
Navigation sidebar with stronger blur (`32px`) and subtle right border.

### `.glass-input`
Form input with glass background, brand-colored focus ring.

---

## 3. Button Variants

| Class | Style | Usage |
|---|---|---|
| `.btn-primary` | Brand gradient, white text, shadow glow | Primary actions |
| `.btn-ghost` | Transparent, subtle hover background | Secondary actions |

---

## 4. Badge Variants

Pill-shaped badges with discipline-specific background tints:

| Class | Color Token |
|---|---|
| `.badge-swim` | `--color-swim` background at 20% opacity |
| `.badge-bike` | `--color-bike` background at 20% opacity |
| `.badge-run` | `--color-run` background at 20% opacity |
| `.badge-strength` | `--color-strength` background at 20% opacity |

---

## 5. Animation Utilities

| Class | Effect | Duration |
|---|---|---|
| `.animate-fade-in` | Fade up from 8px below | 0.5s ease-out |
| `.animate-slide-in` | Slide from 12px left | 0.4s ease-out |
| `.animate-pulse-glow` | Pulsing brand-colored shadow | 2s infinite |
| `.stagger-children` | Sequential fade-in of children (60ms delay per child) | 0.4s each |

---

## 6. Typography

- **Font**: Inter (Google Fonts), system-ui fallback
- **Heading sizes**: Use Tailwind `text-2xl`/`text-lg`/`text-sm`
- **Font weights**: 400 (body), 500 (medium labels), 600 (semibold buttons), 700 (bold headings)
- **Text gradient**: `.text-gradient` applies brand gradient as text color

---

## 7. Layout Patterns

- **Dashboard**: Collapsible sidebar (260px / 72px) + scrollable main content
- **Max content width**: `max-w-7xl` (1280px) with `p-6 lg:p-8`
- **Mobile**: Full-width with hamburger menu overlay
- **Cards**: Use `.glass-card` with `p-6` padding, `space-y-4` for stacked content

---

## 8. Theming

- **Dark mode** (default): `color-scheme: dark` on `:root`
- **Light mode**: Triggered by `html[data-theme="light"]`
- **Switching**: Managed by `next-themes` via `<ThemeProvider>` + `<ThemeToggle>`
- **Background**: Mesh gradient overlay (`--mesh-gradient`) with SVG noise grain

---

## 9. Accessibility Requirements

- **Focus rings**: All interactive elements MUST have visible `:focus-visible` styles
- **Contrast**: Text on glass surfaces must meet WCAG 2.1 AA (4.5:1 for body, 3:1 for large text)
- **Motion**: Wrap animations in `@media (prefers-reduced-motion: no-preference)`
- **ARIA**: All icon-only buttons need `aria-label`; sidebar nav links use semantic `<nav>`
- **Keyboard**: All interactive elements must be keyboard-accessible
- **Screen readers**: Use semantic HTML (`<main>`, `<nav>`, `<aside>`) with proper heading hierarchy

---

## 10. Icons

- Library: **Lucide React** (`lucide-react`)
- Default size: `18px` for inline, `20px` for standalone
- Color: inherit from parent via `currentColor`
- Always use `shrink-0` class to prevent icon squishing in flex layouts

---

## Rules for Developers

1. **Never hardcode colors** — always use CSS variables
2. **Never use inline oklch** — reference design tokens
3. **Always use glass component classes** — don't reinvent card styles
4. **Test both themes** — verify UI in dark and light mode
5. **Respect motion preferences** — check `prefers-reduced-motion`
6. **Keep badge consistency** — use discipline-specific badge classes
