# Motion Primitives — Component Reference

> Local mirror of the [motion-primitives.com/docs](https://motion-primitives.com/docs) component library by [Ibelick](https://github.com/ibelick/motion-primitives).
> Animated React components built with **Motion** (Framer Motion) + **Tailwind CSS**. Use this as the canonical best-practices catalog when building custom animated UI.

**Source:** github.com/ibelick/motion-primitives (`main`) · **Mirrored:** 2026-06-09 · **License:** see [LICENCE.md](./LICENCE.md)

## How to use this folder

- Each component lives in `components/<name>/`:
  - `page.mdx` — the official documentation (description, usage, props/API)
  - `<name>.tsx` — the copy-paste-ready core implementation (`components/core` upstream)
  - `examples/*.tsx` — usage variants demonstrated in the docs
- `shared/hooks/` and `shared/lib/` — supporting utilities some components import
- `registry/<name>.json` — shadcn-style installable bundle (deps + files) per component
- `installation.mdx` / `getting-started.mdx` — setup + intro docs

Install upstream: `npx motion-primitives@latest add <name>` (or shadcn registry at `registry/<name>.json`).

---

## Core Components

| Component | Description | Source | Examples |
|---|---|---|---|
| [Accordion](./components/accordion/page.mdx) | A vertically stacked set of collapsible containers allowing users to toggle content visibility. Customize the animation effects with variants and transitions for expanding/collapsing the sections. | `accordion.tsx` | 3 |
| [Animated Background](./components/animated-background/page.mdx) | Visually highlights selected items by sliding a background into view when hovered over or clicked. This smooth transition helps users focus on the active item, making it ideal for interactive lists, menus, or navigations where clear selection feedback is important. | `animated-background.tsx` | 4 |
| [Animated Group](./components/animated-group/page.mdx) | A wrapper that adds animated transitions to a group of child elements. Perfect for creating staggered animations for lists, grids, or any collection of components. | `animated-group.tsx` | 3 |
| [Border Trail](./components/border-trail/page.mdx) | Animated border effect that moves along the edges of its parent container. | `border-trail.tsx` | 3 |
| [Carousel](./components/carousel/page.mdx) | A flexible and easy-to-use carousel with customizable navigation and indicators. | `carousel.tsx` | 4 |
| [Cursor](./components/cursor/page.mdx) | A custom cursor component with optional spring animations. It can be globally applied to the page or attached specifically to a parent element. | `cursor.tsx` | 3 |
| [Dialog](./components/dialog/page.mdx) | A window overlaid on either the primary window or another dialog window, rendering the content underneath inert. Customize the dialog with variants and transition. | `dialog.tsx` | 5 |
| [Disclosure](./components/disclosure/page.mdx) | The Disclosure component allows users to toggle the visibility of content, either collapsed or expanded. | `disclosure.tsx` | 2 |
| [In View](./components/in-view/page.mdx) | Easily animate elements when they come into view. You can apply animations to elements when they enter the viewport, or when they are fully visible. | `in-view.tsx` | 3 |
| [Infinite Slider](./components/infinite-slider/page.mdx) | Infinite scrolling slider component that smoothly loops through its children. It supports both horizontal and vertical directions, with customizable speed and speed on hover. Ideal for creating continuous carousels, marquee displays, or dynamic content showcases. | `infinite-slider.tsx` | 3 |
| [Transition Panel](./components/transition-panel/page.mdx) | Easy way to switch between different pieces of content with enter and exit animations. Ideal for onboarding cards, settings, or any interactive content needing a visual transition between states. | `transition-panel.tsx` | 2 |

## Text Effects

| Component | Description | Source | Examples |
|---|---|---|---|
| [Text Effect](./components/text-effect/page.mdx) | Easily animate text content with various effects. You can apply animations per character or per word, and customize the animation effects using custom variants or preset animations. | `text-effect.tsx` | 8 |
| [Text Loop](./components/text-loop/page.mdx) | Text animation that transitions between multiple items, creating an engaging looping effect. | `text-loop.tsx` | 3 |
| [Text Morph](./components/text-morph/page.mdx) | Animates text by morphing shared letters between words, creating fluid transitions. | `text-morph.tsx` | 2 |
| [Text Roll](./components/text-roll/page.mdx) | A text roll component that rotates each character, fully customizable for nice text animations. | `text-roll.tsx` | 3 |
| [Text Scramble](./components/text-scramble/page.mdx) | Text animation that transforms text by randomly cycling through characters before settling on the final content, creating an engaging cryptographic effect. | `text-scramble.tsx` | 3 |
| [Text Shimmer](./components/text-shimmer/page.mdx) | Shimmer effect on text. Easily adjust the duration and the spread of the shimmer effect. | `text-shimmer.tsx` | 2 |
| [Text Shimmer Wave](./components/text-shimmer-wave/page.mdx) | Shimmer wave effect on text. Easily adjust the wave effect, spread, duration, and more. | `text-shimmer-wave.tsx` | 2 |

## Number Effects

| Component | Description | Source | Examples |
|---|---|---|---|
| [Animated Number](./components/animated-number/page.mdx) | Easily animate numbers. | `animated-number.tsx` | 3 |
| [Sliding Number](./components/sliding-number/page.mdx) | A component that slides numbers. | `sliding-number.tsx` | 3 |

## Interactive Elements

| Component | Description | Source | Examples |
|---|---|---|---|
| [Dock](./components/dock/page.mdx) | A versatile UI element that provides a flexible and customizable way to organize and display menu items within your application. | `dock.tsx` | 1 |
| [Glow Effect](./components/glow-effect/page.mdx) | A customizable glow effect with animation modes, colors, blur-sm, and transitions. | `glow-effect.tsx` | 3 |
| [Image Comparison](./components/image-comparison/page.mdx) | Interactively compare two images with a draggable slider to reveal differences. | `image-comparison.tsx` | 4 |
| [Scroll Progress](./components/scroll-progress/page.mdx) | Animated scroll progress for your web pages. | `scroll-progress.tsx` | 3 |
| [Spotlight](./components/spotlight/page.mdx) | A dynamic spotlight effect component that follows cursor movement. | `spotlight.tsx` | 3 |
| [Spinning Text](./components/spinning-text/page.mdx) | Easily animate text circularly. Customize the animation with variants and transitions. | `spinning-text.tsx` | 3 |
| [Tilt](./components/tilt/page.mdx) | 3D tilt effect that responds to mouse movement, enhancing UI elements with a dynamic depth effect, customizable rotation factors and spring options. | `tilt.tsx` | 2 |

## Toolbars

| Component | Description | Source | Examples |
|---|---|---|---|
| [Toolbar Dynamic](./components/toolbar-dynamic/page.mdx) | Adjusts width dynamically to accommodate varying tool requirements. Starts small and expands to offer more tools as needed. | `toolbar-dynamic.tsx` | 0 |
| [Toolbar Expandable](./components/toolbar-expandable/page.mdx) | Changes height based on content, expanding to display more tools and shrinking to save space. Keeps your screen organized and efficient. | `toolbar-expandable.tsx` | 0 |

## Advanced Effects

| Component | Description | Source | Examples |
|---|---|---|---|
| [Magnetic](./components/magnetic/page.mdx) | A magnetic effect for elements that allows them to be attracted to the mouse cursor. | `magnetic.tsx` | 2 |
| [Morphing Dialog](./components/morphing-dialog/page.mdx) | A dialog that uses layout animations to transition content into a focused view. It supports click-outside and escape key functionalities for closing. | `morphing-dialog.tsx` | 3 |
| [Morphing Popover](./components/morphing-popover/page.mdx) | A popover that transforms from its trigger into the content using layout animations. It visually morphs instead of appearing as a separate element. | `morphing-popover.tsx` | 3 |
| [Progressive Blur](./components/progressive-blur/page.mdx) | A Progressive Blur component creates a layered blur effect using motion and gradient masks. It progressively blurs layers based on direction and intensity, adding visual depth. | `progressive-blur.tsx` | 3 |

---

_Total: 33 components mirrored. Getting started: [getting-started.mdx](./getting-started.mdx) · [installation.mdx](./installation.mdx)._
