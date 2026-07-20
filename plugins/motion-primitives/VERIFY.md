# MotionPrimitives Skill Verification

> **FOR AI AGENTS:** Complete this checklist AFTER installation. Every file check must pass before declaring the pack installed. Dependency checks are informational only.

---

## File Verification

### Check SKILL.md exists

```bash
CLAUDE_DIR="$HOME/.claude"
[ -f "$CLAUDE_DIR/skills/motion-primitives/SKILL.md" ] && echo "OK SKILL.md" || echo "MISSING SKILL.md"
```

**Expected:** SKILL.md present at `~/.claude/skills/motion-primitives/SKILL.md`.

### Check directories exist

```bash
CLAUDE_DIR="$HOME/.claude"
[ -d "$CLAUDE_DIR/skills/motion-primitives/reference" ] && echo "OK reference/" || echo "MISSING reference/"
```

### Check key files exist

```bash
CLAUDE_DIR="$HOME/.claude"
[ -f "$CLAUDE_DIR/skills/motion-primitives/CHANGELOG.md" ] && echo "OK CHANGELOG.md" || echo "MISSING CHANGELOG.md"
[ -f "$CLAUDE_DIR/skills/motion-primitives/SKILL.md" ] && echo "OK SKILL.md" || echo "MISSING SKILL.md"
[ -f "$CLAUDE_DIR/skills/motion-primitives/extension.yaml" ] && echo "OK extension.yaml" || echo "MISSING extension.yaml"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/INDEX.md" ] && echo "OK reference/INDEX.md" || echo "MISSING reference/INDEX.md"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/LICENCE.md" ] && echo "OK reference/LICENCE.md" || echo "MISSING reference/LICENCE.md"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/README.md" ] && echo "OK reference/README.md" || echo "MISSING reference/README.md"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/accordion/accordion.tsx" ] && echo "OK reference/components/accordion/accordion.tsx" || echo "MISSING reference/components/accordion/accordion.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/accordion/examples/accordion-basic.tsx" ] && echo "OK reference/components/accordion/examples/accordion-basic.tsx" || echo "MISSING reference/components/accordion/examples/accordion-basic.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/accordion/examples/accordion-icons.tsx" ] && echo "OK reference/components/accordion/examples/accordion-icons.tsx" || echo "MISSING reference/components/accordion/examples/accordion-icons.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/accordion/examples/accordion-variant.tsx" ] && echo "OK reference/components/accordion/examples/accordion-variant.tsx" || echo "MISSING reference/components/accordion/examples/accordion-variant.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/accordion/page.mdx" ] && echo "OK reference/components/accordion/page.mdx" || echo "MISSING reference/components/accordion/page.mdx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/animated-background/animated-background.tsx" ] && echo "OK reference/components/animated-background/animated-background.tsx" || echo "MISSING reference/components/animated-background/animated-background.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/animated-background/examples/animated-card-background-hover.tsx" ] && echo "OK reference/components/animated-background/examples/animated-card-background-hover.tsx" || echo "MISSING reference/components/animated-background/examples/animated-card-background-hover.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/animated-background/examples/animated-tabs-hover.tsx" ] && echo "OK reference/components/animated-background/examples/animated-tabs-hover.tsx" || echo "MISSING reference/components/animated-background/examples/animated-tabs-hover.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/animated-background/examples/animated-tabs.tsx" ] && echo "OK reference/components/animated-background/examples/animated-tabs.tsx" || echo "MISSING reference/components/animated-background/examples/animated-tabs.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/animated-background/examples/segmented-control.tsx" ] && echo "OK reference/components/animated-background/examples/segmented-control.tsx" || echo "MISSING reference/components/animated-background/examples/segmented-control.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/animated-background/page.mdx" ] && echo "OK reference/components/animated-background/page.mdx" || echo "MISSING reference/components/animated-background/page.mdx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/animated-group/animated-group.tsx" ] && echo "OK reference/components/animated-group/animated-group.tsx" || echo "MISSING reference/components/animated-group/animated-group.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/animated-group/examples/animated-group-custom-variants-2.tsx" ] && echo "OK reference/components/animated-group/examples/animated-group-custom-variants-2.tsx" || echo "MISSING reference/components/animated-group/examples/animated-group-custom-variants-2.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/animated-group/examples/animated-group-custom-variants.tsx" ] && echo "OK reference/components/animated-group/examples/animated-group-custom-variants.tsx" || echo "MISSING reference/components/animated-group/examples/animated-group-custom-variants.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/animated-group/examples/animated-group-preset.tsx" ] && echo "OK reference/components/animated-group/examples/animated-group-preset.tsx" || echo "MISSING reference/components/animated-group/examples/animated-group-preset.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/animated-group/page.mdx" ] && echo "OK reference/components/animated-group/page.mdx" || echo "MISSING reference/components/animated-group/page.mdx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/animated-number/animated-number.tsx" ] && echo "OK reference/components/animated-number/animated-number.tsx" || echo "MISSING reference/components/animated-number/animated-number.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/animated-number/examples/animated-number-basic.tsx" ] && echo "OK reference/components/animated-number/examples/animated-number-basic.tsx" || echo "MISSING reference/components/animated-number/examples/animated-number-basic.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/animated-number/examples/animated-number-counter.tsx" ] && echo "OK reference/components/animated-number/examples/animated-number-counter.tsx" || echo "MISSING reference/components/animated-number/examples/animated-number-counter.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/animated-number/examples/animated-number-in-view.tsx" ] && echo "OK reference/components/animated-number/examples/animated-number-in-view.tsx" || echo "MISSING reference/components/animated-number/examples/animated-number-in-view.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/animated-number/page.mdx" ] && echo "OK reference/components/animated-number/page.mdx" || echo "MISSING reference/components/animated-number/page.mdx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/border-trail/border-trail.tsx" ] && echo "OK reference/components/border-trail/border-trail.tsx" || echo "MISSING reference/components/border-trail/border-trail.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/border-trail/examples/border-trail-card-1.tsx" ] && echo "OK reference/components/border-trail/examples/border-trail-card-1.tsx" || echo "MISSING reference/components/border-trail/examples/border-trail-card-1.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/border-trail/examples/border-trail-card-2.tsx" ] && echo "OK reference/components/border-trail/examples/border-trail-card-2.tsx" || echo "MISSING reference/components/border-trail/examples/border-trail-card-2.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/border-trail/examples/border-trail-textarea.tsx" ] && echo "OK reference/components/border-trail/examples/border-trail-textarea.tsx" || echo "MISSING reference/components/border-trail/examples/border-trail-textarea.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/border-trail/page.mdx" ] && echo "OK reference/components/border-trail/page.mdx" || echo "MISSING reference/components/border-trail/page.mdx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/carousel/carousel.tsx" ] && echo "OK reference/components/carousel/carousel.tsx" || echo "MISSING reference/components/carousel/carousel.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/carousel/examples/carousel-basic.tsx" ] && echo "OK reference/components/carousel/examples/carousel-basic.tsx" || echo "MISSING reference/components/carousel/examples/carousel-basic.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/carousel/examples/carousel-custom-indicator.tsx" ] && echo "OK reference/components/carousel/examples/carousel-custom-indicator.tsx" || echo "MISSING reference/components/carousel/examples/carousel-custom-indicator.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/carousel/examples/carousel-custom-sizes.tsx" ] && echo "OK reference/components/carousel/examples/carousel-custom-sizes.tsx" || echo "MISSING reference/components/carousel/examples/carousel-custom-sizes.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/carousel/examples/carousel-spacing.tsx" ] && echo "OK reference/components/carousel/examples/carousel-spacing.tsx" || echo "MISSING reference/components/carousel/examples/carousel-spacing.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/carousel/page.mdx" ] && echo "OK reference/components/carousel/page.mdx" || echo "MISSING reference/components/carousel/page.mdx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/cursor/cursor.tsx" ] && echo "OK reference/components/cursor/cursor.tsx" || echo "MISSING reference/components/cursor/cursor.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/cursor/examples/cursor-1.tsx" ] && echo "OK reference/components/cursor/examples/cursor-1.tsx" || echo "MISSING reference/components/cursor/examples/cursor-1.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/cursor/examples/cursor-2.tsx" ] && echo "OK reference/components/cursor/examples/cursor-2.tsx" || echo "MISSING reference/components/cursor/examples/cursor-2.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/cursor/examples/cursor-3.tsx" ] && echo "OK reference/components/cursor/examples/cursor-3.tsx" || echo "MISSING reference/components/cursor/examples/cursor-3.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/cursor/page.mdx" ] && echo "OK reference/components/cursor/page.mdx" || echo "MISSING reference/components/cursor/page.mdx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/dialog/dialog.tsx" ] && echo "OK reference/components/dialog/dialog.tsx" || echo "MISSING reference/components/dialog/dialog.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/dialog/examples/dialog-basic.tsx" ] && echo "OK reference/components/dialog/examples/dialog-basic.tsx" || echo "MISSING reference/components/dialog/examples/dialog-basic.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/dialog/examples/dialog-controlled.tsx" ] && echo "OK reference/components/dialog/examples/dialog-controlled.tsx" || echo "MISSING reference/components/dialog/examples/dialog-controlled.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/dialog/examples/dialog-custom-backdrop.tsx" ] && echo "OK reference/components/dialog/examples/dialog-custom-backdrop.tsx" || echo "MISSING reference/components/dialog/examples/dialog-custom-backdrop.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/dialog/examples/dialog-custom-exit.tsx" ] && echo "OK reference/components/dialog/examples/dialog-custom-exit.tsx" || echo "MISSING reference/components/dialog/examples/dialog-custom-exit.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/dialog/examples/dialog-custom-variants-transtion.tsx" ] && echo "OK reference/components/dialog/examples/dialog-custom-variants-transtion.tsx" || echo "MISSING reference/components/dialog/examples/dialog-custom-variants-transtion.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/dialog/page.mdx" ] && echo "OK reference/components/dialog/page.mdx" || echo "MISSING reference/components/dialog/page.mdx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/disclosure/disclosure.tsx" ] && echo "OK reference/components/disclosure/disclosure.tsx" || echo "MISSING reference/components/disclosure/disclosure.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/disclosure/examples/disclosure-basic.tsx" ] && echo "OK reference/components/disclosure/examples/disclosure-basic.tsx" || echo "MISSING reference/components/disclosure/examples/disclosure-basic.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/disclosure/examples/disclosure-card.tsx" ] && echo "OK reference/components/disclosure/examples/disclosure-card.tsx" || echo "MISSING reference/components/disclosure/examples/disclosure-card.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/disclosure/page.mdx" ] && echo "OK reference/components/disclosure/page.mdx" || echo "MISSING reference/components/disclosure/page.mdx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/dock/dock.tsx" ] && echo "OK reference/components/dock/dock.tsx" || echo "MISSING reference/components/dock/dock.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/dock/examples/apple-style-dock.tsx" ] && echo "OK reference/components/dock/examples/apple-style-dock.tsx" || echo "MISSING reference/components/dock/examples/apple-style-dock.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/dock/page.mdx" ] && echo "OK reference/components/dock/page.mdx" || echo "MISSING reference/components/dock/page.mdx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/glow-effect/examples/glow-effect-button.tsx" ] && echo "OK reference/components/glow-effect/examples/glow-effect-button.tsx" || echo "MISSING reference/components/glow-effect/examples/glow-effect-button.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/glow-effect/examples/glow-effect-card-background.tsx" ] && echo "OK reference/components/glow-effect/examples/glow-effect-card-background.tsx" || echo "MISSING reference/components/glow-effect/examples/glow-effect-card-background.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/glow-effect/examples/glow-effect-card-mode.tsx" ] && echo "OK reference/components/glow-effect/examples/glow-effect-card-mode.tsx" || echo "MISSING reference/components/glow-effect/examples/glow-effect-card-mode.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/glow-effect/glow-effect.tsx" ] && echo "OK reference/components/glow-effect/glow-effect.tsx" || echo "MISSING reference/components/glow-effect/glow-effect.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/glow-effect/page.mdx" ] && echo "OK reference/components/glow-effect/page.mdx" || echo "MISSING reference/components/glow-effect/page.mdx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/image-comparison/examples/image-comparison-basic.tsx" ] && echo "OK reference/components/image-comparison/examples/image-comparison-basic.tsx" || echo "MISSING reference/components/image-comparison/examples/image-comparison-basic.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/image-comparison/examples/image-comparison-custom-slider.tsx" ] && echo "OK reference/components/image-comparison/examples/image-comparison-custom-slider.tsx" || echo "MISSING reference/components/image-comparison/examples/image-comparison-custom-slider.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/image-comparison/examples/image-comparison-hover.tsx" ] && echo "OK reference/components/image-comparison/examples/image-comparison-hover.tsx" || echo "MISSING reference/components/image-comparison/examples/image-comparison-hover.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/image-comparison/examples/image-comparison-spring.tsx" ] && echo "OK reference/components/image-comparison/examples/image-comparison-spring.tsx" || echo "MISSING reference/components/image-comparison/examples/image-comparison-spring.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/image-comparison/image-comparison.tsx" ] && echo "OK reference/components/image-comparison/image-comparison.tsx" || echo "MISSING reference/components/image-comparison/image-comparison.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/image-comparison/page.mdx" ] && echo "OK reference/components/image-comparison/page.mdx" || echo "MISSING reference/components/image-comparison/page.mdx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/in-view/examples/in-view-basic-multiple.tsx" ] && echo "OK reference/components/in-view/examples/in-view-basic-multiple.tsx" || echo "MISSING reference/components/in-view/examples/in-view-basic-multiple.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/in-view/examples/in-view-basic.tsx" ] && echo "OK reference/components/in-view/examples/in-view-basic.tsx" || echo "MISSING reference/components/in-view/examples/in-view-basic.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/in-view/examples/in-view-images-grid.tsx" ] && echo "OK reference/components/in-view/examples/in-view-images-grid.tsx" || echo "MISSING reference/components/in-view/examples/in-view-images-grid.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/in-view/in-view.tsx" ] && echo "OK reference/components/in-view/in-view.tsx" || echo "MISSING reference/components/in-view/in-view.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/in-view/page.mdx" ] && echo "OK reference/components/in-view/page.mdx" || echo "MISSING reference/components/in-view/page.mdx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/infinite-slider/examples/infinite-slider-basic.tsx" ] && echo "OK reference/components/infinite-slider/examples/infinite-slider-basic.tsx" || echo "MISSING reference/components/infinite-slider/examples/infinite-slider-basic.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/infinite-slider/examples/infinite-slider-hover-speed.tsx" ] && echo "OK reference/components/infinite-slider/examples/infinite-slider-hover-speed.tsx" || echo "MISSING reference/components/infinite-slider/examples/infinite-slider-hover-speed.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/infinite-slider/examples/infinite-slider-vertical.tsx" ] && echo "OK reference/components/infinite-slider/examples/infinite-slider-vertical.tsx" || echo "MISSING reference/components/infinite-slider/examples/infinite-slider-vertical.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/infinite-slider/infinite-slider.tsx" ] && echo "OK reference/components/infinite-slider/infinite-slider.tsx" || echo "MISSING reference/components/infinite-slider/infinite-slider.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/infinite-slider/page.mdx" ] && echo "OK reference/components/infinite-slider/page.mdx" || echo "MISSING reference/components/infinite-slider/page.mdx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/magnetic/examples/magnetic-basic.tsx" ] && echo "OK reference/components/magnetic/examples/magnetic-basic.tsx" || echo "MISSING reference/components/magnetic/examples/magnetic-basic.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/magnetic/examples/magnetic-nested.tsx" ] && echo "OK reference/components/magnetic/examples/magnetic-nested.tsx" || echo "MISSING reference/components/magnetic/examples/magnetic-nested.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/magnetic/magnetic.tsx" ] && echo "OK reference/components/magnetic/magnetic.tsx" || echo "MISSING reference/components/magnetic/magnetic.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/magnetic/page.mdx" ] && echo "OK reference/components/magnetic/page.mdx" || echo "MISSING reference/components/magnetic/page.mdx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/morphing-dialog/examples/morphing-dialog-basic-1.tsx" ] && echo "OK reference/components/morphing-dialog/examples/morphing-dialog-basic-1.tsx" || echo "MISSING reference/components/morphing-dialog/examples/morphing-dialog-basic-1.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/morphing-dialog/examples/morphing-dialog-basic-2.tsx" ] && echo "OK reference/components/morphing-dialog/examples/morphing-dialog-basic-2.tsx" || echo "MISSING reference/components/morphing-dialog/examples/morphing-dialog-basic-2.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/morphing-dialog/examples/morphing-dialog-image.tsx" ] && echo "OK reference/components/morphing-dialog/examples/morphing-dialog-image.tsx" || echo "MISSING reference/components/morphing-dialog/examples/morphing-dialog-image.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/morphing-dialog/morphing-dialog.tsx" ] && echo "OK reference/components/morphing-dialog/morphing-dialog.tsx" || echo "MISSING reference/components/morphing-dialog/morphing-dialog.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/morphing-dialog/page.mdx" ] && echo "OK reference/components/morphing-dialog/page.mdx" || echo "MISSING reference/components/morphing-dialog/page.mdx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/morphing-popover/examples/morphing-popover-basic.tsx" ] && echo "OK reference/components/morphing-popover/examples/morphing-popover-basic.tsx" || echo "MISSING reference/components/morphing-popover/examples/morphing-popover-basic.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/morphing-popover/examples/morphing-popover-custom-transition-variants.tsx" ] && echo "OK reference/components/morphing-popover/examples/morphing-popover-custom-transition-variants.tsx" || echo "MISSING reference/components/morphing-popover/examples/morphing-popover-custom-transition-variants.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/morphing-popover/examples/morphing-popover-textarea.tsx" ] && echo "OK reference/components/morphing-popover/examples/morphing-popover-textarea.tsx" || echo "MISSING reference/components/morphing-popover/examples/morphing-popover-textarea.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/morphing-popover/morphing-popover.tsx" ] && echo "OK reference/components/morphing-popover/morphing-popover.tsx" || echo "MISSING reference/components/morphing-popover/morphing-popover.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/morphing-popover/page.mdx" ] && echo "OK reference/components/morphing-popover/page.mdx" || echo "MISSING reference/components/morphing-popover/page.mdx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/progressive-blur/examples/progressive-blur-basic.tsx" ] && echo "OK reference/components/progressive-blur/examples/progressive-blur-basic.tsx" || echo "MISSING reference/components/progressive-blur/examples/progressive-blur-basic.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/progressive-blur/examples/progressive-blur-hover.tsx" ] && echo "OK reference/components/progressive-blur/examples/progressive-blur-hover.tsx" || echo "MISSING reference/components/progressive-blur/examples/progressive-blur-hover.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/progressive-blur/examples/progressive-blur-slider.tsx" ] && echo "OK reference/components/progressive-blur/examples/progressive-blur-slider.tsx" || echo "MISSING reference/components/progressive-blur/examples/progressive-blur-slider.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/progressive-blur/page.mdx" ] && echo "OK reference/components/progressive-blur/page.mdx" || echo "MISSING reference/components/progressive-blur/page.mdx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/progressive-blur/progressive-blur.tsx" ] && echo "OK reference/components/progressive-blur/progressive-blur.tsx" || echo "MISSING reference/components/progressive-blur/progressive-blur.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/scroll-progress/examples/scroll-progress-basic-1.tsx" ] && echo "OK reference/components/scroll-progress/examples/scroll-progress-basic-1.tsx" || echo "MISSING reference/components/scroll-progress/examples/scroll-progress-basic-1.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/scroll-progress/examples/scroll-progress-basic-2.tsx" ] && echo "OK reference/components/scroll-progress/examples/scroll-progress-basic-2.tsx" || echo "MISSING reference/components/scroll-progress/examples/scroll-progress-basic-2.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/scroll-progress/examples/scroll-progress-basic-3.tsx" ] && echo "OK reference/components/scroll-progress/examples/scroll-progress-basic-3.tsx" || echo "MISSING reference/components/scroll-progress/examples/scroll-progress-basic-3.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/scroll-progress/page.mdx" ] && echo "OK reference/components/scroll-progress/page.mdx" || echo "MISSING reference/components/scroll-progress/page.mdx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/scroll-progress/scroll-progress.tsx" ] && echo "OK reference/components/scroll-progress/scroll-progress.tsx" || echo "MISSING reference/components/scroll-progress/scroll-progress.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/sliding-number/examples/clock.tsx" ] && echo "OK reference/components/sliding-number/examples/clock.tsx" || echo "MISSING reference/components/sliding-number/examples/clock.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/sliding-number/examples/sliding-basic.tsx" ] && echo "OK reference/components/sliding-number/examples/sliding-basic.tsx" || echo "MISSING reference/components/sliding-number/examples/sliding-basic.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/sliding-number/examples/sliding-slider.tsx" ] && echo "OK reference/components/sliding-number/examples/sliding-slider.tsx" || echo "MISSING reference/components/sliding-number/examples/sliding-slider.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/sliding-number/page.mdx" ] && echo "OK reference/components/sliding-number/page.mdx" || echo "MISSING reference/components/sliding-number/page.mdx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/sliding-number/sliding-number.tsx" ] && echo "OK reference/components/sliding-number/sliding-number.tsx" || echo "MISSING reference/components/sliding-number/sliding-number.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/spinning-text/examples/spinning-text-basic.tsx" ] && echo "OK reference/components/spinning-text/examples/spinning-text-basic.tsx" || echo "MISSING reference/components/spinning-text/examples/spinning-text-basic.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/spinning-text/examples/spinning-text-custom-transition.tsx" ] && echo "OK reference/components/spinning-text/examples/spinning-text-custom-transition.tsx" || echo "MISSING reference/components/spinning-text/examples/spinning-text-custom-transition.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/spinning-text/examples/spinning-text-custom-variants.tsx" ] && echo "OK reference/components/spinning-text/examples/spinning-text-custom-variants.tsx" || echo "MISSING reference/components/spinning-text/examples/spinning-text-custom-variants.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/spinning-text/page.mdx" ] && echo "OK reference/components/spinning-text/page.mdx" || echo "MISSING reference/components/spinning-text/page.mdx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/spinning-text/spinning-text.tsx" ] && echo "OK reference/components/spinning-text/spinning-text.tsx" || echo "MISSING reference/components/spinning-text/spinning-text.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/spotlight/examples/spotlight-basic.tsx" ] && echo "OK reference/components/spotlight/examples/spotlight-basic.tsx" || echo "MISSING reference/components/spotlight/examples/spotlight-basic.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/spotlight/examples/spotlight-border.tsx" ] && echo "OK reference/components/spotlight/examples/spotlight-border.tsx" || echo "MISSING reference/components/spotlight/examples/spotlight-border.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/spotlight/examples/spotlight-custom-color.tsx" ] && echo "OK reference/components/spotlight/examples/spotlight-custom-color.tsx" || echo "MISSING reference/components/spotlight/examples/spotlight-custom-color.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/spotlight/page.mdx" ] && echo "OK reference/components/spotlight/page.mdx" || echo "MISSING reference/components/spotlight/page.mdx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/spotlight/spotlight.tsx" ] && echo "OK reference/components/spotlight/spotlight.tsx" || echo "MISSING reference/components/spotlight/spotlight.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-effect/examples/text-effect-custom-delay.tsx" ] && echo "OK reference/components/text-effect/examples/text-effect-custom-delay.tsx" || echo "MISSING reference/components/text-effect/examples/text-effect-custom-delay.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-effect/examples/text-effect-exit.tsx" ] && echo "OK reference/components/text-effect/examples/text-effect-exit.tsx" || echo "MISSING reference/components/text-effect/examples/text-effect-exit.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-effect/examples/text-effect-line.tsx" ] && echo "OK reference/components/text-effect/examples/text-effect-line.tsx" || echo "MISSING reference/components/text-effect/examples/text-effect-line.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-effect/examples/text-effect-per-char.tsx" ] && echo "OK reference/components/text-effect/examples/text-effect-per-char.tsx" || echo "MISSING reference/components/text-effect/examples/text-effect-per-char.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-effect/examples/text-effect-per-word.tsx" ] && echo "OK reference/components/text-effect/examples/text-effect-per-word.tsx" || echo "MISSING reference/components/text-effect/examples/text-effect-per-word.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-effect/examples/text-effect-preset.tsx" ] && echo "OK reference/components/text-effect/examples/text-effect-preset.tsx" || echo "MISSING reference/components/text-effect/examples/text-effect-preset.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-effect/examples/text-effect-speed.tsx" ] && echo "OK reference/components/text-effect/examples/text-effect-speed.tsx" || echo "MISSING reference/components/text-effect/examples/text-effect-speed.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-effect/examples/text-effect-variants.tsx" ] && echo "OK reference/components/text-effect/examples/text-effect-variants.tsx" || echo "MISSING reference/components/text-effect/examples/text-effect-variants.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-effect/page.mdx" ] && echo "OK reference/components/text-effect/page.mdx" || echo "MISSING reference/components/text-effect/page.mdx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-effect/text-effect.tsx" ] && echo "OK reference/components/text-effect/text-effect.tsx" || echo "MISSING reference/components/text-effect/text-effect.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-loop/examples/text-loop-basic.tsx" ] && echo "OK reference/components/text-loop/examples/text-loop-basic.tsx" || echo "MISSING reference/components/text-loop/examples/text-loop-basic.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-loop/examples/text-loop-custom-variants-transition.tsx" ] && echo "OK reference/components/text-loop/examples/text-loop-custom-variants-transition.tsx" || echo "MISSING reference/components/text-loop/examples/text-loop-custom-variants-transition.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-loop/examples/text-loop-on-index.tsx" ] && echo "OK reference/components/text-loop/examples/text-loop-on-index.tsx" || echo "MISSING reference/components/text-loop/examples/text-loop-on-index.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-loop/page.mdx" ] && echo "OK reference/components/text-loop/page.mdx" || echo "MISSING reference/components/text-loop/page.mdx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-loop/text-loop.tsx" ] && echo "OK reference/components/text-loop/text-loop.tsx" || echo "MISSING reference/components/text-loop/text-loop.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-morph/examples/text-morph-button.tsx" ] && echo "OK reference/components/text-morph/examples/text-morph-button.tsx" || echo "MISSING reference/components/text-morph/examples/text-morph-button.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-morph/examples/text-morph-input.tsx" ] && echo "OK reference/components/text-morph/examples/text-morph-input.tsx" || echo "MISSING reference/components/text-morph/examples/text-morph-input.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-morph/page.mdx" ] && echo "OK reference/components/text-morph/page.mdx" || echo "MISSING reference/components/text-morph/page.mdx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-morph/text-morph.tsx" ] && echo "OK reference/components/text-morph/text-morph.tsx" || echo "MISSING reference/components/text-morph/text-morph.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-roll/examples/text-roll-basic.tsx" ] && echo "OK reference/components/text-roll/examples/text-roll-basic.tsx" || echo "MISSING reference/components/text-roll/examples/text-roll-basic.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-roll/examples/text-roll-custom-transition-delay.tsx" ] && echo "OK reference/components/text-roll/examples/text-roll-custom-transition-delay.tsx" || echo "MISSING reference/components/text-roll/examples/text-roll-custom-transition-delay.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-roll/examples/text-roll-custom-variants.tsx" ] && echo "OK reference/components/text-roll/examples/text-roll-custom-variants.tsx" || echo "MISSING reference/components/text-roll/examples/text-roll-custom-variants.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-roll/page.mdx" ] && echo "OK reference/components/text-roll/page.mdx" || echo "MISSING reference/components/text-roll/page.mdx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-roll/text-roll.tsx" ] && echo "OK reference/components/text-roll/text-roll.tsx" || echo "MISSING reference/components/text-roll/text-roll.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-scramble/examples/text-scramble-basic.tsx" ] && echo "OK reference/components/text-scramble/examples/text-scramble-basic.tsx" || echo "MISSING reference/components/text-scramble/examples/text-scramble-basic.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-scramble/examples/text-scramble-custom-char-duration.tsx" ] && echo "OK reference/components/text-scramble/examples/text-scramble-custom-char-duration.tsx" || echo "MISSING reference/components/text-scramble/examples/text-scramble-custom-char-duration.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-scramble/examples/text-scramble-custom-trigger.tsx" ] && echo "OK reference/components/text-scramble/examples/text-scramble-custom-trigger.tsx" || echo "MISSING reference/components/text-scramble/examples/text-scramble-custom-trigger.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-scramble/page.mdx" ] && echo "OK reference/components/text-scramble/page.mdx" || echo "MISSING reference/components/text-scramble/page.mdx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-scramble/text-scramble.tsx" ] && echo "OK reference/components/text-scramble/text-scramble.tsx" || echo "MISSING reference/components/text-scramble/text-scramble.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-shimmer-wave/examples/text-shimmer-wave-basic.tsx" ] && echo "OK reference/components/text-shimmer-wave/examples/text-shimmer-wave-basic.tsx" || echo "MISSING reference/components/text-shimmer-wave/examples/text-shimmer-wave-basic.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-shimmer-wave/examples/text-shimmer-wave-color.tsx" ] && echo "OK reference/components/text-shimmer-wave/examples/text-shimmer-wave-color.tsx" || echo "MISSING reference/components/text-shimmer-wave/examples/text-shimmer-wave-color.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-shimmer-wave/page.mdx" ] && echo "OK reference/components/text-shimmer-wave/page.mdx" || echo "MISSING reference/components/text-shimmer-wave/page.mdx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-shimmer-wave/text-shimmer-wave.tsx" ] && echo "OK reference/components/text-shimmer-wave/text-shimmer-wave.tsx" || echo "MISSING reference/components/text-shimmer-wave/text-shimmer-wave.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-shimmer/examples/text-shimmer-basic.tsx" ] && echo "OK reference/components/text-shimmer/examples/text-shimmer-basic.tsx" || echo "MISSING reference/components/text-shimmer/examples/text-shimmer-basic.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-shimmer/examples/text-shimmer-color.tsx" ] && echo "OK reference/components/text-shimmer/examples/text-shimmer-color.tsx" || echo "MISSING reference/components/text-shimmer/examples/text-shimmer-color.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-shimmer/page.mdx" ] && echo "OK reference/components/text-shimmer/page.mdx" || echo "MISSING reference/components/text-shimmer/page.mdx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-shimmer/text-shimmer.tsx" ] && echo "OK reference/components/text-shimmer/text-shimmer.tsx" || echo "MISSING reference/components/text-shimmer/text-shimmer.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/tilt/examples/tilt-card-1.tsx" ] && echo "OK reference/components/tilt/examples/tilt-card-1.tsx" || echo "MISSING reference/components/tilt/examples/tilt-card-1.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/tilt/examples/tilt-spotlight.tsx" ] && echo "OK reference/components/tilt/examples/tilt-spotlight.tsx" || echo "MISSING reference/components/tilt/examples/tilt-spotlight.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/tilt/page.mdx" ] && echo "OK reference/components/tilt/page.mdx" || echo "MISSING reference/components/tilt/page.mdx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/tilt/tilt.tsx" ] && echo "OK reference/components/tilt/tilt.tsx" || echo "MISSING reference/components/tilt/tilt.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/toolbar-dynamic/page.mdx" ] && echo "OK reference/components/toolbar-dynamic/page.mdx" || echo "MISSING reference/components/toolbar-dynamic/page.mdx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/toolbar-dynamic/toolbar-dynamic.tsx" ] && echo "OK reference/components/toolbar-dynamic/toolbar-dynamic.tsx" || echo "MISSING reference/components/toolbar-dynamic/toolbar-dynamic.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/toolbar-expandable/page.mdx" ] && echo "OK reference/components/toolbar-expandable/page.mdx" || echo "MISSING reference/components/toolbar-expandable/page.mdx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/toolbar-expandable/toolbar-expandable.tsx" ] && echo "OK reference/components/toolbar-expandable/toolbar-expandable.tsx" || echo "MISSING reference/components/toolbar-expandable/toolbar-expandable.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/transition-panel/examples/transition-panel-card.tsx" ] && echo "OK reference/components/transition-panel/examples/transition-panel-card.tsx" || echo "MISSING reference/components/transition-panel/examples/transition-panel-card.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/transition-panel/examples/transition-panel-tabs.tsx" ] && echo "OK reference/components/transition-panel/examples/transition-panel-tabs.tsx" || echo "MISSING reference/components/transition-panel/examples/transition-panel-tabs.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/transition-panel/page.mdx" ] && echo "OK reference/components/transition-panel/page.mdx" || echo "MISSING reference/components/transition-panel/page.mdx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/components/transition-panel/transition-panel.tsx" ] && echo "OK reference/components/transition-panel/transition-panel.tsx" || echo "MISSING reference/components/transition-panel/transition-panel.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/getting-started.mdx" ] && echo "OK reference/getting-started.mdx" || echo "MISSING reference/getting-started.mdx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/installation.mdx" ] && echo "OK reference/installation.mdx" || echo "MISSING reference/installation.mdx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/registry/accordion.json" ] && echo "OK reference/registry/accordion.json" || echo "MISSING reference/registry/accordion.json"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/registry/animated-background.json" ] && echo "OK reference/registry/animated-background.json" || echo "MISSING reference/registry/animated-background.json"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/registry/animated-group.json" ] && echo "OK reference/registry/animated-group.json" || echo "MISSING reference/registry/animated-group.json"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/registry/animated-number.json" ] && echo "OK reference/registry/animated-number.json" || echo "MISSING reference/registry/animated-number.json"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/registry/border-trail.json" ] && echo "OK reference/registry/border-trail.json" || echo "MISSING reference/registry/border-trail.json"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/registry/carousel.json" ] && echo "OK reference/registry/carousel.json" || echo "MISSING reference/registry/carousel.json"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/registry/cursor.json" ] && echo "OK reference/registry/cursor.json" || echo "MISSING reference/registry/cursor.json"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/registry/dialog.json" ] && echo "OK reference/registry/dialog.json" || echo "MISSING reference/registry/dialog.json"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/registry/disclosure.json" ] && echo "OK reference/registry/disclosure.json" || echo "MISSING reference/registry/disclosure.json"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/registry/dock.json" ] && echo "OK reference/registry/dock.json" || echo "MISSING reference/registry/dock.json"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/registry/glow-effect.json" ] && echo "OK reference/registry/glow-effect.json" || echo "MISSING reference/registry/glow-effect.json"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/registry/image-comparison.json" ] && echo "OK reference/registry/image-comparison.json" || echo "MISSING reference/registry/image-comparison.json"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/registry/in-view.json" ] && echo "OK reference/registry/in-view.json" || echo "MISSING reference/registry/in-view.json"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/registry/infinite-slider.json" ] && echo "OK reference/registry/infinite-slider.json" || echo "MISSING reference/registry/infinite-slider.json"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/registry/magnetic.json" ] && echo "OK reference/registry/magnetic.json" || echo "MISSING reference/registry/magnetic.json"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/registry/morphing-dialog.json" ] && echo "OK reference/registry/morphing-dialog.json" || echo "MISSING reference/registry/morphing-dialog.json"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/registry/morphing-popover.json" ] && echo "OK reference/registry/morphing-popover.json" || echo "MISSING reference/registry/morphing-popover.json"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/registry/progressive-blur.json" ] && echo "OK reference/registry/progressive-blur.json" || echo "MISSING reference/registry/progressive-blur.json"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/registry/registry.json" ] && echo "OK reference/registry/registry.json" || echo "MISSING reference/registry/registry.json"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/registry/scroll-progress.json" ] && echo "OK reference/registry/scroll-progress.json" || echo "MISSING reference/registry/scroll-progress.json"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/registry/sliding-number.json" ] && echo "OK reference/registry/sliding-number.json" || echo "MISSING reference/registry/sliding-number.json"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/registry/spinning-text.json" ] && echo "OK reference/registry/spinning-text.json" || echo "MISSING reference/registry/spinning-text.json"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/registry/spotlight.json" ] && echo "OK reference/registry/spotlight.json" || echo "MISSING reference/registry/spotlight.json"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/registry/text-effect.json" ] && echo "OK reference/registry/text-effect.json" || echo "MISSING reference/registry/text-effect.json"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/registry/text-loop.json" ] && echo "OK reference/registry/text-loop.json" || echo "MISSING reference/registry/text-loop.json"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/registry/text-morph.json" ] && echo "OK reference/registry/text-morph.json" || echo "MISSING reference/registry/text-morph.json"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/registry/text-roll.json" ] && echo "OK reference/registry/text-roll.json" || echo "MISSING reference/registry/text-roll.json"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/registry/text-scramble.json" ] && echo "OK reference/registry/text-scramble.json" || echo "MISSING reference/registry/text-scramble.json"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/registry/text-shimmer-wave.json" ] && echo "OK reference/registry/text-shimmer-wave.json" || echo "MISSING reference/registry/text-shimmer-wave.json"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/registry/text-shimmer.json" ] && echo "OK reference/registry/text-shimmer.json" || echo "MISSING reference/registry/text-shimmer.json"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/registry/tilt.json" ] && echo "OK reference/registry/tilt.json" || echo "MISSING reference/registry/tilt.json"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/registry/toolbar-dynamic.json" ] && echo "OK reference/registry/toolbar-dynamic.json" || echo "MISSING reference/registry/toolbar-dynamic.json"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/registry/toolbar-expandable.json" ] && echo "OK reference/registry/toolbar-expandable.json" || echo "MISSING reference/registry/toolbar-expandable.json"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/registry/transition-panel.json" ] && echo "OK reference/registry/transition-panel.json" || echo "MISSING reference/registry/transition-panel.json"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/shared/hooks/useClickOutside.tsx" ] && echo "OK reference/shared/hooks/useClickOutside.tsx" || echo "MISSING reference/shared/hooks/useClickOutside.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/shared/hooks/usePreventScroll.tsx" ] && echo "OK reference/shared/hooks/usePreventScroll.tsx" || echo "MISSING reference/shared/hooks/usePreventScroll.tsx"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/shared/lib/browser.ts" ] && echo "OK reference/shared/lib/browser.ts" || echo "MISSING reference/shared/lib/browser.ts"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/shared/lib/code.ts" ] && echo "OK reference/shared/lib/code.ts" || echo "MISSING reference/shared/lib/code.ts"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/shared/lib/custom-theme.ts" ] && echo "OK reference/shared/lib/custom-theme.ts" || echo "MISSING reference/shared/lib/custom-theme.ts"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/shared/lib/shiki.ts" ] && echo "OK reference/shared/lib/shiki.ts" || echo "MISSING reference/shared/lib/shiki.ts"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/shared/lib/theme-css-variables.ts" ] && echo "OK reference/shared/lib/theme-css-variables.ts" || echo "MISSING reference/shared/lib/theme-css-variables.ts"
[ -f "$CLAUDE_DIR/skills/motion-primitives/reference/shared/lib/utils.ts" ] && echo "OK reference/shared/lib/utils.ts" || echo "MISSING reference/shared/lib/utils.ts"
```

**Expected:** All 210 files present.

### Check frontmatter is valid

```bash
CLAUDE_DIR="$HOME/.claude"
if [ -f "$CLAUDE_DIR/skills/motion-primitives/SKILL.md" ]; then
  head -1 "$CLAUDE_DIR/skills/motion-primitives/SKILL.md" | grep -q "^---" && echo "OK SKILL.md has frontmatter opener" || echo "ERROR SKILL.md missing frontmatter"
  grep -q "^name:" "$CLAUDE_DIR/skills/motion-primitives/SKILL.md" && echo "OK SKILL.md has name field" || echo "ERROR SKILL.md missing name field"
  grep -q "^description:" "$CLAUDE_DIR/skills/motion-primitives/SKILL.md" && echo "OK SKILL.md has description field" || echo "ERROR SKILL.md missing description"
  grep -q "^visibility:" "$CLAUDE_DIR/skills/motion-primitives/SKILL.md" && echo "OK SKILL.md has visibility field (RFC-0011 §6)" || echo "ERROR SKILL.md missing visibility"
fi
```

**Expected:** Frontmatter present with name, description, and visibility fields.

## Dependency Checks (Informational)

```bash
echo "Dependencies:"
if command -v bun &> /dev/null; then
  echo "  AVAILABLE Bun runtime: $(bun --version)"
else
  echo "  UNAVAILABLE Bun runtime"
fi

```

---

## Installation Checklist

```markdown
## MotionPrimitives Skill Installation Verification

### Files
- [ ] SKILL.md installed at ~/.claude/skills/motion-primitives/SKILL.md
- [ ] SKILL.md has valid YAML frontmatter
- [ ] All source files copied per VERIFY.md

### Functional (manual test)
- [ ] Workflow triggers route correctly per SKILL.md "Workflow Routing"

```

---

## Verification Complete

When all file checks pass:

1. **Confirm to user:** "motion-primitives skill installation verified successfully"
2. **Note:** "Customizations live at `~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/MotionPrimitives/`"
