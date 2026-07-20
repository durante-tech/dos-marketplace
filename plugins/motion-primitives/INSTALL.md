# MotionPrimitives v1.0.0 — Installation Guide

**This guide is designed for AI agents installing this pack into a user's infrastructure.**

---

## AI Agent Instructions

**This is a wizard-style installation.** Use Claude Code's native tools to guide the user through installation:

1. **AskUserQuestion** — for user decisions and confirmations
2. **TodoWrite** — for progress tracking
3. **Bash/Read/Write** — for actual installation
4. **VERIFY.md** — for final validation

### Welcome Message

Before starting, greet the user:

```
"I'm installing MotionPrimitives v1.0.0 — Catalog of 33 production-grade animated UI components (Motion / Framer Motion + Tailwind CSS) from Motion Primitives, with copy-paste source, official docs, and usage examples bundled offline.

This pack installs 210 files across 1 directory.

Let me analyze your system and guide you through installation."
```

---

## Phase 1: System Analysis

**Execute this analysis BEFORE any file operations.**

### 1.1 Run These Commands

```bash
CLAUDE_DIR="$HOME/.claude"
echo "Claude directory: $CLAUDE_DIR"

if [ -d "$CLAUDE_DIR/skills/MotionPrimitives" ]; then
  echo "WARNING Existing motion-primitives skill found at: $CLAUDE_DIR/skills/MotionPrimitives"
  ls -la "$CLAUDE_DIR/skills/motion-primitives/" 2>/dev/null
else
  echo "OK No existing motion-primitives skill (clean install)"
fi

if [ -d "$CLAUDE_DIR/skills" ]; then
  echo "OK Skills directory exists at: $CLAUDE_DIR/skills"
else
  echo "INFO Skills directory does not exist (will be created)"
fi

if command -v bun &> /dev/null; then
  echo "OK Bun runtime available: $(bun --version)"
else
  echo "WARNING Bun runtime not found (install: curl -fsSL https://bun.sh/install | bash)"
fi
```

### 1.2 Present Findings

Tell the user what you found.

---

## Phase 2: User Questions

### Question 1: Conflict Resolution (only if existing skill found)

```json
{
  "header": "Conflict — Existing MotionPrimitives Skill",
  "question": "An existing motion-primitives skill was found. How should I proceed?",
  "multiSelect": false,
  "options": [
    {"label": "Backup and Replace (Recommended)", "description": "Creates timestamped backup, then installs new version"},
    {"label": "Replace Without Backup", "description": "Overwrites existing skill"},
    {"label": "Abort Installation", "description": "Cancel installation, keep existing skill"}
  ]
}
```

### Question 2: Final Confirmation

```json
{
  "header": "Install",
  "question": "Ready to install MotionPrimitives v1.0.0?",
  "multiSelect": false,
  "options": [
    {"label": "Yes, install now (Recommended)", "description": "Copies skill files to ~/.claude/skills/motion-primitives/"},
    {"label": "Show me what will change", "description": "Lists all files and directories that will be created"},
    {"label": "Cancel", "description": "Abort installation"}
  ]
}
```

---

## Phase 3: Backup (If Needed)

**Only execute if user chose "Backup and Replace":**

```bash
CLAUDE_DIR="$HOME/.claude"
BACKUP_DIR="$CLAUDE_DIR/Backups/motionprimitives-skill-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
[ -d "$CLAUDE_DIR/skills/MotionPrimitives" ] && cp -r "$CLAUDE_DIR/skills/MotionPrimitives" "$BACKUP_DIR/MotionPrimitives"
echo "Backup created at: $BACKUP_DIR"
```

---

## Phase 4: Installation

### 4.1 Create Skill Directory Structure

```bash
CLAUDE_DIR="$HOME/.claude"
mkdir -p "$CLAUDE_DIR/skills/MotionPrimitives"
mkdir -p "$CLAUDE_DIR/skills/motion-primitives/reference"
echo "Created motion-primitives skill directory structure"
```

### 4.2 Copy Skill Files

```bash
PACK_DIR="$(pwd)"
CLAUDE_DIR="$HOME/.claude"

cp "$PACK_DIR/src/CHANGELOG.md" "$CLAUDE_DIR/skills/motion-primitives/CHANGELOG.md"
cp "$PACK_DIR/src/SKILL.md" "$CLAUDE_DIR/skills/motion-primitives/SKILL.md"
cp "$PACK_DIR/src/extension.yaml" "$CLAUDE_DIR/skills/motion-primitives/extension.yaml"
cp "$PACK_DIR/src/reference/INDEX.md" "$CLAUDE_DIR/skills/motion-primitives/reference/INDEX.md"
cp "$PACK_DIR/src/reference/LICENCE.md" "$CLAUDE_DIR/skills/motion-primitives/reference/LICENCE.md"
cp "$PACK_DIR/src/reference/README.md" "$CLAUDE_DIR/skills/motion-primitives/reference/README.md"
cp "$PACK_DIR/src/reference/components/accordion/accordion.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/accordion/accordion.tsx"
cp "$PACK_DIR/src/reference/components/accordion/examples/accordion-basic.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/accordion/examples/accordion-basic.tsx"
cp "$PACK_DIR/src/reference/components/accordion/examples/accordion-icons.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/accordion/examples/accordion-icons.tsx"
cp "$PACK_DIR/src/reference/components/accordion/examples/accordion-variant.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/accordion/examples/accordion-variant.tsx"
cp "$PACK_DIR/src/reference/components/accordion/page.mdx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/accordion/page.mdx"
cp "$PACK_DIR/src/reference/components/animated-background/animated-background.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/animated-background/animated-background.tsx"
cp "$PACK_DIR/src/reference/components/animated-background/examples/animated-card-background-hover.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/animated-background/examples/animated-card-background-hover.tsx"
cp "$PACK_DIR/src/reference/components/animated-background/examples/animated-tabs-hover.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/animated-background/examples/animated-tabs-hover.tsx"
cp "$PACK_DIR/src/reference/components/animated-background/examples/animated-tabs.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/animated-background/examples/animated-tabs.tsx"
cp "$PACK_DIR/src/reference/components/animated-background/examples/segmented-control.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/animated-background/examples/segmented-control.tsx"
cp "$PACK_DIR/src/reference/components/animated-background/page.mdx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/animated-background/page.mdx"
cp "$PACK_DIR/src/reference/components/animated-group/animated-group.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/animated-group/animated-group.tsx"
cp "$PACK_DIR/src/reference/components/animated-group/examples/animated-group-custom-variants-2.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/animated-group/examples/animated-group-custom-variants-2.tsx"
cp "$PACK_DIR/src/reference/components/animated-group/examples/animated-group-custom-variants.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/animated-group/examples/animated-group-custom-variants.tsx"
cp "$PACK_DIR/src/reference/components/animated-group/examples/animated-group-preset.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/animated-group/examples/animated-group-preset.tsx"
cp "$PACK_DIR/src/reference/components/animated-group/page.mdx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/animated-group/page.mdx"
cp "$PACK_DIR/src/reference/components/animated-number/animated-number.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/animated-number/animated-number.tsx"
cp "$PACK_DIR/src/reference/components/animated-number/examples/animated-number-basic.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/animated-number/examples/animated-number-basic.tsx"
cp "$PACK_DIR/src/reference/components/animated-number/examples/animated-number-counter.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/animated-number/examples/animated-number-counter.tsx"
cp "$PACK_DIR/src/reference/components/animated-number/examples/animated-number-in-view.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/animated-number/examples/animated-number-in-view.tsx"
cp "$PACK_DIR/src/reference/components/animated-number/page.mdx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/animated-number/page.mdx"
cp "$PACK_DIR/src/reference/components/border-trail/border-trail.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/border-trail/border-trail.tsx"
cp "$PACK_DIR/src/reference/components/border-trail/examples/border-trail-card-1.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/border-trail/examples/border-trail-card-1.tsx"
cp "$PACK_DIR/src/reference/components/border-trail/examples/border-trail-card-2.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/border-trail/examples/border-trail-card-2.tsx"
cp "$PACK_DIR/src/reference/components/border-trail/examples/border-trail-textarea.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/border-trail/examples/border-trail-textarea.tsx"
cp "$PACK_DIR/src/reference/components/border-trail/page.mdx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/border-trail/page.mdx"
cp "$PACK_DIR/src/reference/components/carousel/carousel.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/carousel/carousel.tsx"
cp "$PACK_DIR/src/reference/components/carousel/examples/carousel-basic.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/carousel/examples/carousel-basic.tsx"
cp "$PACK_DIR/src/reference/components/carousel/examples/carousel-custom-indicator.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/carousel/examples/carousel-custom-indicator.tsx"
cp "$PACK_DIR/src/reference/components/carousel/examples/carousel-custom-sizes.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/carousel/examples/carousel-custom-sizes.tsx"
cp "$PACK_DIR/src/reference/components/carousel/examples/carousel-spacing.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/carousel/examples/carousel-spacing.tsx"
cp "$PACK_DIR/src/reference/components/carousel/page.mdx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/carousel/page.mdx"
cp "$PACK_DIR/src/reference/components/cursor/cursor.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/cursor/cursor.tsx"
cp "$PACK_DIR/src/reference/components/cursor/examples/cursor-1.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/cursor/examples/cursor-1.tsx"
cp "$PACK_DIR/src/reference/components/cursor/examples/cursor-2.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/cursor/examples/cursor-2.tsx"
cp "$PACK_DIR/src/reference/components/cursor/examples/cursor-3.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/cursor/examples/cursor-3.tsx"
cp "$PACK_DIR/src/reference/components/cursor/page.mdx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/cursor/page.mdx"
cp "$PACK_DIR/src/reference/components/dialog/dialog.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/dialog/dialog.tsx"
cp "$PACK_DIR/src/reference/components/dialog/examples/dialog-basic.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/dialog/examples/dialog-basic.tsx"
cp "$PACK_DIR/src/reference/components/dialog/examples/dialog-controlled.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/dialog/examples/dialog-controlled.tsx"
cp "$PACK_DIR/src/reference/components/dialog/examples/dialog-custom-backdrop.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/dialog/examples/dialog-custom-backdrop.tsx"
cp "$PACK_DIR/src/reference/components/dialog/examples/dialog-custom-exit.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/dialog/examples/dialog-custom-exit.tsx"
cp "$PACK_DIR/src/reference/components/dialog/examples/dialog-custom-variants-transtion.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/dialog/examples/dialog-custom-variants-transtion.tsx"
cp "$PACK_DIR/src/reference/components/dialog/page.mdx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/dialog/page.mdx"
cp "$PACK_DIR/src/reference/components/disclosure/disclosure.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/disclosure/disclosure.tsx"
cp "$PACK_DIR/src/reference/components/disclosure/examples/disclosure-basic.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/disclosure/examples/disclosure-basic.tsx"
cp "$PACK_DIR/src/reference/components/disclosure/examples/disclosure-card.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/disclosure/examples/disclosure-card.tsx"
cp "$PACK_DIR/src/reference/components/disclosure/page.mdx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/disclosure/page.mdx"
cp "$PACK_DIR/src/reference/components/dock/dock.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/dock/dock.tsx"
cp "$PACK_DIR/src/reference/components/dock/examples/apple-style-dock.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/dock/examples/apple-style-dock.tsx"
cp "$PACK_DIR/src/reference/components/dock/page.mdx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/dock/page.mdx"
cp "$PACK_DIR/src/reference/components/glow-effect/examples/glow-effect-button.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/glow-effect/examples/glow-effect-button.tsx"
cp "$PACK_DIR/src/reference/components/glow-effect/examples/glow-effect-card-background.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/glow-effect/examples/glow-effect-card-background.tsx"
cp "$PACK_DIR/src/reference/components/glow-effect/examples/glow-effect-card-mode.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/glow-effect/examples/glow-effect-card-mode.tsx"
cp "$PACK_DIR/src/reference/components/glow-effect/glow-effect.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/glow-effect/glow-effect.tsx"
cp "$PACK_DIR/src/reference/components/glow-effect/page.mdx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/glow-effect/page.mdx"
cp "$PACK_DIR/src/reference/components/image-comparison/examples/image-comparison-basic.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/image-comparison/examples/image-comparison-basic.tsx"
cp "$PACK_DIR/src/reference/components/image-comparison/examples/image-comparison-custom-slider.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/image-comparison/examples/image-comparison-custom-slider.tsx"
cp "$PACK_DIR/src/reference/components/image-comparison/examples/image-comparison-hover.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/image-comparison/examples/image-comparison-hover.tsx"
cp "$PACK_DIR/src/reference/components/image-comparison/examples/image-comparison-spring.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/image-comparison/examples/image-comparison-spring.tsx"
cp "$PACK_DIR/src/reference/components/image-comparison/image-comparison.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/image-comparison/image-comparison.tsx"
cp "$PACK_DIR/src/reference/components/image-comparison/page.mdx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/image-comparison/page.mdx"
cp "$PACK_DIR/src/reference/components/in-view/examples/in-view-basic-multiple.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/in-view/examples/in-view-basic-multiple.tsx"
cp "$PACK_DIR/src/reference/components/in-view/examples/in-view-basic.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/in-view/examples/in-view-basic.tsx"
cp "$PACK_DIR/src/reference/components/in-view/examples/in-view-images-grid.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/in-view/examples/in-view-images-grid.tsx"
cp "$PACK_DIR/src/reference/components/in-view/in-view.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/in-view/in-view.tsx"
cp "$PACK_DIR/src/reference/components/in-view/page.mdx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/in-view/page.mdx"
cp "$PACK_DIR/src/reference/components/infinite-slider/examples/infinite-slider-basic.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/infinite-slider/examples/infinite-slider-basic.tsx"
cp "$PACK_DIR/src/reference/components/infinite-slider/examples/infinite-slider-hover-speed.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/infinite-slider/examples/infinite-slider-hover-speed.tsx"
cp "$PACK_DIR/src/reference/components/infinite-slider/examples/infinite-slider-vertical.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/infinite-slider/examples/infinite-slider-vertical.tsx"
cp "$PACK_DIR/src/reference/components/infinite-slider/infinite-slider.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/infinite-slider/infinite-slider.tsx"
cp "$PACK_DIR/src/reference/components/infinite-slider/page.mdx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/infinite-slider/page.mdx"
cp "$PACK_DIR/src/reference/components/magnetic/examples/magnetic-basic.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/magnetic/examples/magnetic-basic.tsx"
cp "$PACK_DIR/src/reference/components/magnetic/examples/magnetic-nested.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/magnetic/examples/magnetic-nested.tsx"
cp "$PACK_DIR/src/reference/components/magnetic/magnetic.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/magnetic/magnetic.tsx"
cp "$PACK_DIR/src/reference/components/magnetic/page.mdx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/magnetic/page.mdx"
cp "$PACK_DIR/src/reference/components/morphing-dialog/examples/morphing-dialog-basic-1.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/morphing-dialog/examples/morphing-dialog-basic-1.tsx"
cp "$PACK_DIR/src/reference/components/morphing-dialog/examples/morphing-dialog-basic-2.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/morphing-dialog/examples/morphing-dialog-basic-2.tsx"
cp "$PACK_DIR/src/reference/components/morphing-dialog/examples/morphing-dialog-image.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/morphing-dialog/examples/morphing-dialog-image.tsx"
cp "$PACK_DIR/src/reference/components/morphing-dialog/morphing-dialog.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/morphing-dialog/morphing-dialog.tsx"
cp "$PACK_DIR/src/reference/components/morphing-dialog/page.mdx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/morphing-dialog/page.mdx"
cp "$PACK_DIR/src/reference/components/morphing-popover/examples/morphing-popover-basic.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/morphing-popover/examples/morphing-popover-basic.tsx"
cp "$PACK_DIR/src/reference/components/morphing-popover/examples/morphing-popover-custom-transition-variants.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/morphing-popover/examples/morphing-popover-custom-transition-variants.tsx"
cp "$PACK_DIR/src/reference/components/morphing-popover/examples/morphing-popover-textarea.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/morphing-popover/examples/morphing-popover-textarea.tsx"
cp "$PACK_DIR/src/reference/components/morphing-popover/morphing-popover.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/morphing-popover/morphing-popover.tsx"
cp "$PACK_DIR/src/reference/components/morphing-popover/page.mdx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/morphing-popover/page.mdx"
cp "$PACK_DIR/src/reference/components/progressive-blur/examples/progressive-blur-basic.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/progressive-blur/examples/progressive-blur-basic.tsx"
cp "$PACK_DIR/src/reference/components/progressive-blur/examples/progressive-blur-hover.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/progressive-blur/examples/progressive-blur-hover.tsx"
cp "$PACK_DIR/src/reference/components/progressive-blur/examples/progressive-blur-slider.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/progressive-blur/examples/progressive-blur-slider.tsx"
cp "$PACK_DIR/src/reference/components/progressive-blur/page.mdx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/progressive-blur/page.mdx"
cp "$PACK_DIR/src/reference/components/progressive-blur/progressive-blur.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/progressive-blur/progressive-blur.tsx"
cp "$PACK_DIR/src/reference/components/scroll-progress/examples/scroll-progress-basic-1.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/scroll-progress/examples/scroll-progress-basic-1.tsx"
cp "$PACK_DIR/src/reference/components/scroll-progress/examples/scroll-progress-basic-2.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/scroll-progress/examples/scroll-progress-basic-2.tsx"
cp "$PACK_DIR/src/reference/components/scroll-progress/examples/scroll-progress-basic-3.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/scroll-progress/examples/scroll-progress-basic-3.tsx"
cp "$PACK_DIR/src/reference/components/scroll-progress/page.mdx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/scroll-progress/page.mdx"
cp "$PACK_DIR/src/reference/components/scroll-progress/scroll-progress.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/scroll-progress/scroll-progress.tsx"
cp "$PACK_DIR/src/reference/components/sliding-number/examples/clock.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/sliding-number/examples/clock.tsx"
cp "$PACK_DIR/src/reference/components/sliding-number/examples/sliding-basic.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/sliding-number/examples/sliding-basic.tsx"
cp "$PACK_DIR/src/reference/components/sliding-number/examples/sliding-slider.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/sliding-number/examples/sliding-slider.tsx"
cp "$PACK_DIR/src/reference/components/sliding-number/page.mdx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/sliding-number/page.mdx"
cp "$PACK_DIR/src/reference/components/sliding-number/sliding-number.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/sliding-number/sliding-number.tsx"
cp "$PACK_DIR/src/reference/components/spinning-text/examples/spinning-text-basic.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/spinning-text/examples/spinning-text-basic.tsx"
cp "$PACK_DIR/src/reference/components/spinning-text/examples/spinning-text-custom-transition.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/spinning-text/examples/spinning-text-custom-transition.tsx"
cp "$PACK_DIR/src/reference/components/spinning-text/examples/spinning-text-custom-variants.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/spinning-text/examples/spinning-text-custom-variants.tsx"
cp "$PACK_DIR/src/reference/components/spinning-text/page.mdx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/spinning-text/page.mdx"
cp "$PACK_DIR/src/reference/components/spinning-text/spinning-text.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/spinning-text/spinning-text.tsx"
cp "$PACK_DIR/src/reference/components/spotlight/examples/spotlight-basic.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/spotlight/examples/spotlight-basic.tsx"
cp "$PACK_DIR/src/reference/components/spotlight/examples/spotlight-border.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/spotlight/examples/spotlight-border.tsx"
cp "$PACK_DIR/src/reference/components/spotlight/examples/spotlight-custom-color.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/spotlight/examples/spotlight-custom-color.tsx"
cp "$PACK_DIR/src/reference/components/spotlight/page.mdx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/spotlight/page.mdx"
cp "$PACK_DIR/src/reference/components/spotlight/spotlight.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/spotlight/spotlight.tsx"
cp "$PACK_DIR/src/reference/components/text-effect/examples/text-effect-custom-delay.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-effect/examples/text-effect-custom-delay.tsx"
cp "$PACK_DIR/src/reference/components/text-effect/examples/text-effect-exit.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-effect/examples/text-effect-exit.tsx"
cp "$PACK_DIR/src/reference/components/text-effect/examples/text-effect-line.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-effect/examples/text-effect-line.tsx"
cp "$PACK_DIR/src/reference/components/text-effect/examples/text-effect-per-char.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-effect/examples/text-effect-per-char.tsx"
cp "$PACK_DIR/src/reference/components/text-effect/examples/text-effect-per-word.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-effect/examples/text-effect-per-word.tsx"
cp "$PACK_DIR/src/reference/components/text-effect/examples/text-effect-preset.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-effect/examples/text-effect-preset.tsx"
cp "$PACK_DIR/src/reference/components/text-effect/examples/text-effect-speed.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-effect/examples/text-effect-speed.tsx"
cp "$PACK_DIR/src/reference/components/text-effect/examples/text-effect-variants.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-effect/examples/text-effect-variants.tsx"
cp "$PACK_DIR/src/reference/components/text-effect/page.mdx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-effect/page.mdx"
cp "$PACK_DIR/src/reference/components/text-effect/text-effect.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-effect/text-effect.tsx"
cp "$PACK_DIR/src/reference/components/text-loop/examples/text-loop-basic.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-loop/examples/text-loop-basic.tsx"
cp "$PACK_DIR/src/reference/components/text-loop/examples/text-loop-custom-variants-transition.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-loop/examples/text-loop-custom-variants-transition.tsx"
cp "$PACK_DIR/src/reference/components/text-loop/examples/text-loop-on-index.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-loop/examples/text-loop-on-index.tsx"
cp "$PACK_DIR/src/reference/components/text-loop/page.mdx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-loop/page.mdx"
cp "$PACK_DIR/src/reference/components/text-loop/text-loop.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-loop/text-loop.tsx"
cp "$PACK_DIR/src/reference/components/text-morph/examples/text-morph-button.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-morph/examples/text-morph-button.tsx"
cp "$PACK_DIR/src/reference/components/text-morph/examples/text-morph-input.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-morph/examples/text-morph-input.tsx"
cp "$PACK_DIR/src/reference/components/text-morph/page.mdx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-morph/page.mdx"
cp "$PACK_DIR/src/reference/components/text-morph/text-morph.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-morph/text-morph.tsx"
cp "$PACK_DIR/src/reference/components/text-roll/examples/text-roll-basic.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-roll/examples/text-roll-basic.tsx"
cp "$PACK_DIR/src/reference/components/text-roll/examples/text-roll-custom-transition-delay.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-roll/examples/text-roll-custom-transition-delay.tsx"
cp "$PACK_DIR/src/reference/components/text-roll/examples/text-roll-custom-variants.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-roll/examples/text-roll-custom-variants.tsx"
cp "$PACK_DIR/src/reference/components/text-roll/page.mdx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-roll/page.mdx"
cp "$PACK_DIR/src/reference/components/text-roll/text-roll.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-roll/text-roll.tsx"
cp "$PACK_DIR/src/reference/components/text-scramble/examples/text-scramble-basic.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-scramble/examples/text-scramble-basic.tsx"
cp "$PACK_DIR/src/reference/components/text-scramble/examples/text-scramble-custom-char-duration.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-scramble/examples/text-scramble-custom-char-duration.tsx"
cp "$PACK_DIR/src/reference/components/text-scramble/examples/text-scramble-custom-trigger.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-scramble/examples/text-scramble-custom-trigger.tsx"
cp "$PACK_DIR/src/reference/components/text-scramble/page.mdx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-scramble/page.mdx"
cp "$PACK_DIR/src/reference/components/text-scramble/text-scramble.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-scramble/text-scramble.tsx"
cp "$PACK_DIR/src/reference/components/text-shimmer-wave/examples/text-shimmer-wave-basic.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-shimmer-wave/examples/text-shimmer-wave-basic.tsx"
cp "$PACK_DIR/src/reference/components/text-shimmer-wave/examples/text-shimmer-wave-color.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-shimmer-wave/examples/text-shimmer-wave-color.tsx"
cp "$PACK_DIR/src/reference/components/text-shimmer-wave/page.mdx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-shimmer-wave/page.mdx"
cp "$PACK_DIR/src/reference/components/text-shimmer-wave/text-shimmer-wave.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-shimmer-wave/text-shimmer-wave.tsx"
cp "$PACK_DIR/src/reference/components/text-shimmer/examples/text-shimmer-basic.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-shimmer/examples/text-shimmer-basic.tsx"
cp "$PACK_DIR/src/reference/components/text-shimmer/examples/text-shimmer-color.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-shimmer/examples/text-shimmer-color.tsx"
cp "$PACK_DIR/src/reference/components/text-shimmer/page.mdx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-shimmer/page.mdx"
cp "$PACK_DIR/src/reference/components/text-shimmer/text-shimmer.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/text-shimmer/text-shimmer.tsx"
cp "$PACK_DIR/src/reference/components/tilt/examples/tilt-card-1.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/tilt/examples/tilt-card-1.tsx"
cp "$PACK_DIR/src/reference/components/tilt/examples/tilt-spotlight.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/tilt/examples/tilt-spotlight.tsx"
cp "$PACK_DIR/src/reference/components/tilt/page.mdx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/tilt/page.mdx"
cp "$PACK_DIR/src/reference/components/tilt/tilt.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/tilt/tilt.tsx"
cp "$PACK_DIR/src/reference/components/toolbar-dynamic/page.mdx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/toolbar-dynamic/page.mdx"
cp "$PACK_DIR/src/reference/components/toolbar-dynamic/toolbar-dynamic.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/toolbar-dynamic/toolbar-dynamic.tsx"
cp "$PACK_DIR/src/reference/components/toolbar-expandable/page.mdx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/toolbar-expandable/page.mdx"
cp "$PACK_DIR/src/reference/components/toolbar-expandable/toolbar-expandable.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/toolbar-expandable/toolbar-expandable.tsx"
cp "$PACK_DIR/src/reference/components/transition-panel/examples/transition-panel-card.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/transition-panel/examples/transition-panel-card.tsx"
cp "$PACK_DIR/src/reference/components/transition-panel/examples/transition-panel-tabs.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/transition-panel/examples/transition-panel-tabs.tsx"
cp "$PACK_DIR/src/reference/components/transition-panel/page.mdx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/transition-panel/page.mdx"
cp "$PACK_DIR/src/reference/components/transition-panel/transition-panel.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/components/transition-panel/transition-panel.tsx"
cp "$PACK_DIR/src/reference/getting-started.mdx" "$CLAUDE_DIR/skills/motion-primitives/reference/getting-started.mdx"
cp "$PACK_DIR/src/reference/installation.mdx" "$CLAUDE_DIR/skills/motion-primitives/reference/installation.mdx"
cp "$PACK_DIR/src/reference/registry/accordion.json" "$CLAUDE_DIR/skills/motion-primitives/reference/registry/accordion.json"
cp "$PACK_DIR/src/reference/registry/animated-background.json" "$CLAUDE_DIR/skills/motion-primitives/reference/registry/animated-background.json"
cp "$PACK_DIR/src/reference/registry/animated-group.json" "$CLAUDE_DIR/skills/motion-primitives/reference/registry/animated-group.json"
cp "$PACK_DIR/src/reference/registry/animated-number.json" "$CLAUDE_DIR/skills/motion-primitives/reference/registry/animated-number.json"
cp "$PACK_DIR/src/reference/registry/border-trail.json" "$CLAUDE_DIR/skills/motion-primitives/reference/registry/border-trail.json"
cp "$PACK_DIR/src/reference/registry/carousel.json" "$CLAUDE_DIR/skills/motion-primitives/reference/registry/carousel.json"
cp "$PACK_DIR/src/reference/registry/cursor.json" "$CLAUDE_DIR/skills/motion-primitives/reference/registry/cursor.json"
cp "$PACK_DIR/src/reference/registry/dialog.json" "$CLAUDE_DIR/skills/motion-primitives/reference/registry/dialog.json"
cp "$PACK_DIR/src/reference/registry/disclosure.json" "$CLAUDE_DIR/skills/motion-primitives/reference/registry/disclosure.json"
cp "$PACK_DIR/src/reference/registry/dock.json" "$CLAUDE_DIR/skills/motion-primitives/reference/registry/dock.json"
cp "$PACK_DIR/src/reference/registry/glow-effect.json" "$CLAUDE_DIR/skills/motion-primitives/reference/registry/glow-effect.json"
cp "$PACK_DIR/src/reference/registry/image-comparison.json" "$CLAUDE_DIR/skills/motion-primitives/reference/registry/image-comparison.json"
cp "$PACK_DIR/src/reference/registry/in-view.json" "$CLAUDE_DIR/skills/motion-primitives/reference/registry/in-view.json"
cp "$PACK_DIR/src/reference/registry/infinite-slider.json" "$CLAUDE_DIR/skills/motion-primitives/reference/registry/infinite-slider.json"
cp "$PACK_DIR/src/reference/registry/magnetic.json" "$CLAUDE_DIR/skills/motion-primitives/reference/registry/magnetic.json"
cp "$PACK_DIR/src/reference/registry/morphing-dialog.json" "$CLAUDE_DIR/skills/motion-primitives/reference/registry/morphing-dialog.json"
cp "$PACK_DIR/src/reference/registry/morphing-popover.json" "$CLAUDE_DIR/skills/motion-primitives/reference/registry/morphing-popover.json"
cp "$PACK_DIR/src/reference/registry/progressive-blur.json" "$CLAUDE_DIR/skills/motion-primitives/reference/registry/progressive-blur.json"
cp "$PACK_DIR/src/reference/registry/registry.json" "$CLAUDE_DIR/skills/motion-primitives/reference/registry/registry.json"
cp "$PACK_DIR/src/reference/registry/scroll-progress.json" "$CLAUDE_DIR/skills/motion-primitives/reference/registry/scroll-progress.json"
cp "$PACK_DIR/src/reference/registry/sliding-number.json" "$CLAUDE_DIR/skills/motion-primitives/reference/registry/sliding-number.json"
cp "$PACK_DIR/src/reference/registry/spinning-text.json" "$CLAUDE_DIR/skills/motion-primitives/reference/registry/spinning-text.json"
cp "$PACK_DIR/src/reference/registry/spotlight.json" "$CLAUDE_DIR/skills/motion-primitives/reference/registry/spotlight.json"
cp "$PACK_DIR/src/reference/registry/text-effect.json" "$CLAUDE_DIR/skills/motion-primitives/reference/registry/text-effect.json"
cp "$PACK_DIR/src/reference/registry/text-loop.json" "$CLAUDE_DIR/skills/motion-primitives/reference/registry/text-loop.json"
cp "$PACK_DIR/src/reference/registry/text-morph.json" "$CLAUDE_DIR/skills/motion-primitives/reference/registry/text-morph.json"
cp "$PACK_DIR/src/reference/registry/text-roll.json" "$CLAUDE_DIR/skills/motion-primitives/reference/registry/text-roll.json"
cp "$PACK_DIR/src/reference/registry/text-scramble.json" "$CLAUDE_DIR/skills/motion-primitives/reference/registry/text-scramble.json"
cp "$PACK_DIR/src/reference/registry/text-shimmer-wave.json" "$CLAUDE_DIR/skills/motion-primitives/reference/registry/text-shimmer-wave.json"
cp "$PACK_DIR/src/reference/registry/text-shimmer.json" "$CLAUDE_DIR/skills/motion-primitives/reference/registry/text-shimmer.json"
cp "$PACK_DIR/src/reference/registry/tilt.json" "$CLAUDE_DIR/skills/motion-primitives/reference/registry/tilt.json"
cp "$PACK_DIR/src/reference/registry/toolbar-dynamic.json" "$CLAUDE_DIR/skills/motion-primitives/reference/registry/toolbar-dynamic.json"
cp "$PACK_DIR/src/reference/registry/toolbar-expandable.json" "$CLAUDE_DIR/skills/motion-primitives/reference/registry/toolbar-expandable.json"
cp "$PACK_DIR/src/reference/registry/transition-panel.json" "$CLAUDE_DIR/skills/motion-primitives/reference/registry/transition-panel.json"
cp "$PACK_DIR/src/reference/shared/hooks/useClickOutside.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/shared/hooks/useClickOutside.tsx"
cp "$PACK_DIR/src/reference/shared/hooks/usePreventScroll.tsx" "$CLAUDE_DIR/skills/motion-primitives/reference/shared/hooks/usePreventScroll.tsx"
cp "$PACK_DIR/src/reference/shared/lib/browser.ts" "$CLAUDE_DIR/skills/motion-primitives/reference/shared/lib/browser.ts"
cp "$PACK_DIR/src/reference/shared/lib/code.ts" "$CLAUDE_DIR/skills/motion-primitives/reference/shared/lib/code.ts"
cp "$PACK_DIR/src/reference/shared/lib/custom-theme.ts" "$CLAUDE_DIR/skills/motion-primitives/reference/shared/lib/custom-theme.ts"
cp "$PACK_DIR/src/reference/shared/lib/shiki.ts" "$CLAUDE_DIR/skills/motion-primitives/reference/shared/lib/shiki.ts"
cp "$PACK_DIR/src/reference/shared/lib/theme-css-variables.ts" "$CLAUDE_DIR/skills/motion-primitives/reference/shared/lib/theme-css-variables.ts"
cp "$PACK_DIR/src/reference/shared/lib/utils.ts" "$CLAUDE_DIR/skills/motion-primitives/reference/shared/lib/utils.ts"

echo "Copied 210 MotionPrimitives files"
```

---

## Phase 5: Verification

**Execute all checks from VERIFY.md.**

---

## Success/Failure Messages

### On Success

```
"MotionPrimitives v1.0.0 installed successfully.

What's available:
- See SKILL.md for available capabilities.

Customization: Add your own overrides at:
  ~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/MotionPrimitives/"
```

### On Failure

```
"Installation encountered issues. Here's what to check:
1. Ensure ~/.claude/ directory exists
2. Check write permissions on ~/.claude/skills/
3. Run the verification commands in VERIFY.md
Need help? Open an issue at https://github.com/durante-tech/dos/issues"
```

---

## What's Included

- `src/CHANGELOG.md`
- `src/SKILL.md`
- `src/extension.yaml`
- `src/reference/INDEX.md`
- `src/reference/LICENCE.md`
- `src/reference/README.md`
- `src/reference/components/accordion/accordion.tsx`
- `src/reference/components/accordion/examples/accordion-basic.tsx`
- `src/reference/components/accordion/examples/accordion-icons.tsx`
- `src/reference/components/accordion/examples/accordion-variant.tsx`
- `src/reference/components/accordion/page.mdx`
- `src/reference/components/animated-background/animated-background.tsx`
- `src/reference/components/animated-background/examples/animated-card-background-hover.tsx`
- `src/reference/components/animated-background/examples/animated-tabs-hover.tsx`
- `src/reference/components/animated-background/examples/animated-tabs.tsx`
- `src/reference/components/animated-background/examples/segmented-control.tsx`
- `src/reference/components/animated-background/page.mdx`
- `src/reference/components/animated-group/animated-group.tsx`
- `src/reference/components/animated-group/examples/animated-group-custom-variants-2.tsx`
- `src/reference/components/animated-group/examples/animated-group-custom-variants.tsx`
- `src/reference/components/animated-group/examples/animated-group-preset.tsx`
- `src/reference/components/animated-group/page.mdx`
- `src/reference/components/animated-number/animated-number.tsx`
- `src/reference/components/animated-number/examples/animated-number-basic.tsx`
- `src/reference/components/animated-number/examples/animated-number-counter.tsx`
- `src/reference/components/animated-number/examples/animated-number-in-view.tsx`
- `src/reference/components/animated-number/page.mdx`
- `src/reference/components/border-trail/border-trail.tsx`
- `src/reference/components/border-trail/examples/border-trail-card-1.tsx`
- `src/reference/components/border-trail/examples/border-trail-card-2.tsx`
- `src/reference/components/border-trail/examples/border-trail-textarea.tsx`
- `src/reference/components/border-trail/page.mdx`
- `src/reference/components/carousel/carousel.tsx`
- `src/reference/components/carousel/examples/carousel-basic.tsx`
- `src/reference/components/carousel/examples/carousel-custom-indicator.tsx`
- `src/reference/components/carousel/examples/carousel-custom-sizes.tsx`
- `src/reference/components/carousel/examples/carousel-spacing.tsx`
- `src/reference/components/carousel/page.mdx`
- `src/reference/components/cursor/cursor.tsx`
- `src/reference/components/cursor/examples/cursor-1.tsx`
- `src/reference/components/cursor/examples/cursor-2.tsx`
- `src/reference/components/cursor/examples/cursor-3.tsx`
- `src/reference/components/cursor/page.mdx`
- `src/reference/components/dialog/dialog.tsx`
- `src/reference/components/dialog/examples/dialog-basic.tsx`
- `src/reference/components/dialog/examples/dialog-controlled.tsx`
- `src/reference/components/dialog/examples/dialog-custom-backdrop.tsx`
- `src/reference/components/dialog/examples/dialog-custom-exit.tsx`
- `src/reference/components/dialog/examples/dialog-custom-variants-transtion.tsx`
- `src/reference/components/dialog/page.mdx`
- `src/reference/components/disclosure/disclosure.tsx`
- `src/reference/components/disclosure/examples/disclosure-basic.tsx`
- `src/reference/components/disclosure/examples/disclosure-card.tsx`
- `src/reference/components/disclosure/page.mdx`
- `src/reference/components/dock/dock.tsx`
- `src/reference/components/dock/examples/apple-style-dock.tsx`
- `src/reference/components/dock/page.mdx`
- `src/reference/components/glow-effect/examples/glow-effect-button.tsx`
- `src/reference/components/glow-effect/examples/glow-effect-card-background.tsx`
- `src/reference/components/glow-effect/examples/glow-effect-card-mode.tsx`
- `src/reference/components/glow-effect/glow-effect.tsx`
- `src/reference/components/glow-effect/page.mdx`
- `src/reference/components/image-comparison/examples/image-comparison-basic.tsx`
- `src/reference/components/image-comparison/examples/image-comparison-custom-slider.tsx`
- `src/reference/components/image-comparison/examples/image-comparison-hover.tsx`
- `src/reference/components/image-comparison/examples/image-comparison-spring.tsx`
- `src/reference/components/image-comparison/image-comparison.tsx`
- `src/reference/components/image-comparison/page.mdx`
- `src/reference/components/in-view/examples/in-view-basic-multiple.tsx`
- `src/reference/components/in-view/examples/in-view-basic.tsx`
- `src/reference/components/in-view/examples/in-view-images-grid.tsx`
- `src/reference/components/in-view/in-view.tsx`
- `src/reference/components/in-view/page.mdx`
- `src/reference/components/infinite-slider/examples/infinite-slider-basic.tsx`
- `src/reference/components/infinite-slider/examples/infinite-slider-hover-speed.tsx`
- `src/reference/components/infinite-slider/examples/infinite-slider-vertical.tsx`
- `src/reference/components/infinite-slider/infinite-slider.tsx`
- `src/reference/components/infinite-slider/page.mdx`
- `src/reference/components/magnetic/examples/magnetic-basic.tsx`
- `src/reference/components/magnetic/examples/magnetic-nested.tsx`
- `src/reference/components/magnetic/magnetic.tsx`
- `src/reference/components/magnetic/page.mdx`
- `src/reference/components/morphing-dialog/examples/morphing-dialog-basic-1.tsx`
- `src/reference/components/morphing-dialog/examples/morphing-dialog-basic-2.tsx`
- `src/reference/components/morphing-dialog/examples/morphing-dialog-image.tsx`
- `src/reference/components/morphing-dialog/morphing-dialog.tsx`
- `src/reference/components/morphing-dialog/page.mdx`
- `src/reference/components/morphing-popover/examples/morphing-popover-basic.tsx`
- `src/reference/components/morphing-popover/examples/morphing-popover-custom-transition-variants.tsx`
- `src/reference/components/morphing-popover/examples/morphing-popover-textarea.tsx`
- `src/reference/components/morphing-popover/morphing-popover.tsx`
- `src/reference/components/morphing-popover/page.mdx`
- `src/reference/components/progressive-blur/examples/progressive-blur-basic.tsx`
- `src/reference/components/progressive-blur/examples/progressive-blur-hover.tsx`
- `src/reference/components/progressive-blur/examples/progressive-blur-slider.tsx`
- `src/reference/components/progressive-blur/page.mdx`
- `src/reference/components/progressive-blur/progressive-blur.tsx`
- `src/reference/components/scroll-progress/examples/scroll-progress-basic-1.tsx`
- `src/reference/components/scroll-progress/examples/scroll-progress-basic-2.tsx`
- `src/reference/components/scroll-progress/examples/scroll-progress-basic-3.tsx`
- `src/reference/components/scroll-progress/page.mdx`
- `src/reference/components/scroll-progress/scroll-progress.tsx`
- `src/reference/components/sliding-number/examples/clock.tsx`
- `src/reference/components/sliding-number/examples/sliding-basic.tsx`
- `src/reference/components/sliding-number/examples/sliding-slider.tsx`
- `src/reference/components/sliding-number/page.mdx`
- `src/reference/components/sliding-number/sliding-number.tsx`
- `src/reference/components/spinning-text/examples/spinning-text-basic.tsx`
- `src/reference/components/spinning-text/examples/spinning-text-custom-transition.tsx`
- `src/reference/components/spinning-text/examples/spinning-text-custom-variants.tsx`
- `src/reference/components/spinning-text/page.mdx`
- `src/reference/components/spinning-text/spinning-text.tsx`
- `src/reference/components/spotlight/examples/spotlight-basic.tsx`
- `src/reference/components/spotlight/examples/spotlight-border.tsx`
- `src/reference/components/spotlight/examples/spotlight-custom-color.tsx`
- `src/reference/components/spotlight/page.mdx`
- `src/reference/components/spotlight/spotlight.tsx`
- `src/reference/components/text-effect/examples/text-effect-custom-delay.tsx`
- `src/reference/components/text-effect/examples/text-effect-exit.tsx`
- `src/reference/components/text-effect/examples/text-effect-line.tsx`
- `src/reference/components/text-effect/examples/text-effect-per-char.tsx`
- `src/reference/components/text-effect/examples/text-effect-per-word.tsx`
- `src/reference/components/text-effect/examples/text-effect-preset.tsx`
- `src/reference/components/text-effect/examples/text-effect-speed.tsx`
- `src/reference/components/text-effect/examples/text-effect-variants.tsx`
- `src/reference/components/text-effect/page.mdx`
- `src/reference/components/text-effect/text-effect.tsx`
- `src/reference/components/text-loop/examples/text-loop-basic.tsx`
- `src/reference/components/text-loop/examples/text-loop-custom-variants-transition.tsx`
- `src/reference/components/text-loop/examples/text-loop-on-index.tsx`
- `src/reference/components/text-loop/page.mdx`
- `src/reference/components/text-loop/text-loop.tsx`
- `src/reference/components/text-morph/examples/text-morph-button.tsx`
- `src/reference/components/text-morph/examples/text-morph-input.tsx`
- `src/reference/components/text-morph/page.mdx`
- `src/reference/components/text-morph/text-morph.tsx`
- `src/reference/components/text-roll/examples/text-roll-basic.tsx`
- `src/reference/components/text-roll/examples/text-roll-custom-transition-delay.tsx`
- `src/reference/components/text-roll/examples/text-roll-custom-variants.tsx`
- `src/reference/components/text-roll/page.mdx`
- `src/reference/components/text-roll/text-roll.tsx`
- `src/reference/components/text-scramble/examples/text-scramble-basic.tsx`
- `src/reference/components/text-scramble/examples/text-scramble-custom-char-duration.tsx`
- `src/reference/components/text-scramble/examples/text-scramble-custom-trigger.tsx`
- `src/reference/components/text-scramble/page.mdx`
- `src/reference/components/text-scramble/text-scramble.tsx`
- `src/reference/components/text-shimmer-wave/examples/text-shimmer-wave-basic.tsx`
- `src/reference/components/text-shimmer-wave/examples/text-shimmer-wave-color.tsx`
- `src/reference/components/text-shimmer-wave/page.mdx`
- `src/reference/components/text-shimmer-wave/text-shimmer-wave.tsx`
- `src/reference/components/text-shimmer/examples/text-shimmer-basic.tsx`
- `src/reference/components/text-shimmer/examples/text-shimmer-color.tsx`
- `src/reference/components/text-shimmer/page.mdx`
- `src/reference/components/text-shimmer/text-shimmer.tsx`
- `src/reference/components/tilt/examples/tilt-card-1.tsx`
- `src/reference/components/tilt/examples/tilt-spotlight.tsx`
- `src/reference/components/tilt/page.mdx`
- `src/reference/components/tilt/tilt.tsx`
- `src/reference/components/toolbar-dynamic/page.mdx`
- `src/reference/components/toolbar-dynamic/toolbar-dynamic.tsx`
- `src/reference/components/toolbar-expandable/page.mdx`
- `src/reference/components/toolbar-expandable/toolbar-expandable.tsx`
- `src/reference/components/transition-panel/examples/transition-panel-card.tsx`
- `src/reference/components/transition-panel/examples/transition-panel-tabs.tsx`
- `src/reference/components/transition-panel/page.mdx`
- `src/reference/components/transition-panel/transition-panel.tsx`
- `src/reference/getting-started.mdx`
- `src/reference/installation.mdx`
- `src/reference/registry/accordion.json`
- `src/reference/registry/animated-background.json`
- `src/reference/registry/animated-group.json`
- `src/reference/registry/animated-number.json`
- `src/reference/registry/border-trail.json`
- `src/reference/registry/carousel.json`
- `src/reference/registry/cursor.json`
- `src/reference/registry/dialog.json`
- `src/reference/registry/disclosure.json`
- `src/reference/registry/dock.json`
- `src/reference/registry/glow-effect.json`
- `src/reference/registry/image-comparison.json`
- `src/reference/registry/in-view.json`
- `src/reference/registry/infinite-slider.json`
- `src/reference/registry/magnetic.json`
- `src/reference/registry/morphing-dialog.json`
- `src/reference/registry/morphing-popover.json`
- `src/reference/registry/progressive-blur.json`
- `src/reference/registry/registry.json`
- `src/reference/registry/scroll-progress.json`
- `src/reference/registry/sliding-number.json`
- `src/reference/registry/spinning-text.json`
- `src/reference/registry/spotlight.json`
- `src/reference/registry/text-effect.json`
- `src/reference/registry/text-loop.json`
- `src/reference/registry/text-morph.json`
- `src/reference/registry/text-roll.json`
- `src/reference/registry/text-scramble.json`
- `src/reference/registry/text-shimmer-wave.json`
- `src/reference/registry/text-shimmer.json`
- `src/reference/registry/tilt.json`
- `src/reference/registry/toolbar-dynamic.json`
- `src/reference/registry/toolbar-expandable.json`
- `src/reference/registry/transition-panel.json`
- `src/reference/shared/hooks/useClickOutside.tsx`
- `src/reference/shared/hooks/usePreventScroll.tsx`
- `src/reference/shared/lib/browser.ts`
- `src/reference/shared/lib/code.ts`
- `src/reference/shared/lib/custom-theme.ts`
- `src/reference/shared/lib/shiki.ts`
- `src/reference/shared/lib/theme-css-variables.ts`
- `src/reference/shared/lib/utils.ts`
- `plugin.json` — RFC-0011 §5.2 distribution manifest
