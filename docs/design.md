# Ve — Design Document

## 1. Design Philosophy
Ve should feel like it belongs to Windows, not like a third-party app bolted on. The popup should feel as native as the wifi/battery flyouts it sits beside — same weight, same restraint. Priorities, in order: **legibility, speed of scanning, calm** (not flashy). This is a tool used many times a day for seconds at a time — it should never demand visual attention it hasn't earned.

## 2. Theming Strategy
- **Follow system theme by default**: detect Windows light/dark mode setting (via `UISettings`/registry) and match it automatically on launch.
- **Manual override available** in settings: Light / Dark / System (default).
- Avoid a hardcoded "brand look" that fights the OS — Ve should look like it was designed by the same team that designed Windows' own flyouts, using Mica/Acrylic-style translucency where the framework supports it (WinUI 3 supports this natively).

## 3. Color Palette

### Dark theme (primary — matches most Windows flyout defaults)
| Token | Hex | Usage |
|---|---|---|
| `bg-primary` | `#1F1F1F` | Popup window background (with acrylic/blur if available) |
| `bg-elevated` | `#2B2B2B` | Chat bubble (assistant messages), input bar background |
| `bg-user-bubble` | `#3A3A3A` | User message bubble |
| `accent` | `#5B8DEF` | Primary accent — mic active state, send button, links, focus rings |
| `accent-hover` | `#7BA3F2` | Hover/active state of accent elements |
| `text-primary` | `#F2F2F2` | Main text |
| `text-secondary` | `#A0A0A0` | Timestamps, placeholder text, subtle labels |
| `success` | `#4CAF7D` | Successful action confirmation |
| `error` | `#E5484D` | Failed action / error state |
| `border-subtle` | `#3A3A3A` | Dividers, input bar outline |

### Light theme
| Token | Hex | Usage |
|---|---|---|
| `bg-primary` | `#FAFAFA` | Popup window background |
| `bg-elevated` | `#FFFFFF` | Chat bubble (assistant), input bar background |
| `bg-user-bubble` | `#E8EEFD` | User message bubble |
| `accent` | `#3A6FE0` | Primary accent |
| `accent-hover` | `#2D5AC4` | Hover/active accent state |
| `text-primary` | `#1A1A1A` | Main text |
| `text-secondary` | `#6B6B6B` | Timestamps, placeholder, subtle labels |
| `success` | `#2E9E63` | Successful action |
| `error` | `#D5393E` | Failed action |
| `border-subtle` | `#E0E0E0` | Dividers, input outline |

**Accent color rationale**: a calm blue (`#5B8DEF` / `#3A6FE0`) — reads as "assistant/intelligent" without being as generic as Microsoft's own blue, and works fine on both light and dark backgrounds without feeling neon or attention-grabbing.

## 4. Typography
- **Primary typeface**: **Segoe UI Variable** (Windows 11's native system font) — using it makes Ve feel OS-native for free, and avoids bundling/licensing a custom font.
- **Fallback**: Segoe UI → system default sans-serif.
- **Monospace** (for any logs/debug text, if ever shown): Cascadia Code / Consolas.

| Style | Size | Weight | Usage |
|---|---|---|---|
| Body | 14px | Regular (400) | Chat messages |
| Body emphasis | 14px | Semibold (600) | Skill/action names in confirmations |
| Caption | 12px | Regular (400) | Timestamps, secondary labels |
| Input text | 14px | Regular (400) | Text entry bar |
| Popup title (if used) | 16px | Semibold (600) | Optional header, likely omitted for minimalism |

## 5. Layout & Spacing
- Popup width: ~360–400px (comparable to Windows Quick Settings flyout width)
- Popup max height: ~500px before scrolling kicks in on chat history
- Corner radius: 8px on popup container, 12px on chat bubbles (matches Windows 11's rounded-corner language)
- Padding: 12px internal padding standard, 8px between chat bubbles
- Chat panel from the tray: anchored near the tray, like a native flyout.
- Chat panel from the floating launcher: positioned next to the launcher and flipped as needed to stay on-screen.

### Floating launcher mode
- The floating launcher is Ve's primary visible entry point while the app is running. The system tray remains the background/minimized state and recovery route.
- Use a compact, recognizable Ve mark (about 44–48 px as an initial design target) that stays legible over light and dark desktop backgrounds. Keep the surface quiet and visually light.
- Place the orb at a user-selected point, persist its display-relative placement, and clamp it to the current usable display bounds. If the display disappears or changes scale, restore it to a visible edge.
- A click opens a small menu with icon plus label for **Chat**, **Voice**, and **Hide to tray**. A drag moves the orb; movement past a small threshold cancels the click. The panel opens toward available screen space. Hiding the orb keeps Ve running in the tray; tray click or hotkey restores it.
- Show hover/focus treatment without pulsing or drawing attention. Do not steal keyboard focus just because the orb is visible.
- Keep the microphone action visibly unavailable until voice works. Never show a fake active/listening state.

## 6. Iconography
- Tray icon: simple, monochrome-adaptable glyph (must read clearly at 16x16px tray size) — avoid detailed illustration, it won't survive scaling down
- Floating launcher: simplified Ve brand mark that remains recognizable at small sizes and has adequate contrast on arbitrary desktop backgrounds
- Mic icon: standard filled mic glyph; changes to an animated "listening" state (pulsing accent-colored ring) when active
- Chat action: simple chat bubble glyph; Hide-to-tray action: minimize/chevron glyph. Use icon plus accessible text label in the menu.
- Send button: simple arrow or paper-plane glyph, accent-colored
- Use **Segoe Fluent Icons** font/glyph set where possible for native consistency, rather than a custom icon library

## 7. Motion
- Popup open/close: quick fade + slight scale (150–200ms), matching native Windows flyout motion — no bouncy/elastic easing
- Mic listening state: subtle pulsing ring animation, not a jarring flash
- Message appearance: simple fade-in, no slide/bounce — keep it calm per the philosophy in §1
- Respect Windows' "reduce motion" accessibility setting if detectable

## 8. States to Design For
- Empty state (popup just opened, no messages yet) — maybe a single subtle placeholder line like "Type or speak a command"
- Listening (mic active)
- Processing (thinking/waiting on LLM or automation) — subtle typing-indicator-style animation, not a spinner that feels heavy
- Success confirmation
- Failure/error with suggested next step
- Startup suggestion popup (v3) — visually distinct from the main chat popup (smaller, more like a native toast/notification) so it doesn't get confused with the main assistant window

## 9. Accessibility Notes
- Maintain WCAG AA contrast minimum for text against backgrounds in both themes (values above were chosen to clear this, but verify against final rendering)
- All interactive elements (mic, send, dismiss) need visible focus states for keyboard navigation
- Floating launcher actions need accessible names, keyboard activation and repositioning, and a way to reach all actions without dragging
- Respect system reduce-motion and high-contrast settings; don't rely on hover or color alone to distinguish disabled voice from active voice
- Respect system font-size scaling settings rather than hardcoding pixel values where the framework allows
