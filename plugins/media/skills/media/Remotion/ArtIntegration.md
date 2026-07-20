# Art Skill Integration

**MANDATORY:** This skill inherits visual theming from the Art skill.

## Before Creating Any Video Content

1. **Load Art preferences:**
   ```
   ~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/Art/PREFERENCES.md
   ```

2. **Apply the DOS Theme** derived from Art preferences:

| Art Preference | Remotion Application |
|----------------|---------------------|
| Core aesthetic (charcoal architectural) | Dark backgrounds, sketch-like feel |
| Primary accent (purple/violet) | Accent colors, highlights, CTAs |
| Cool atmospheric washes | Background gradients, overlays |
| Paper ground (#F5F5F0) | Light text, subtle backgrounds |
| Human-scale in vast spaces | Typography hierarchy, spacing |

3. **Use Theme Constants:**
   ```
   ~/.claude/skills/media/Remotion/Tools/Theme.ts
   ```

4. **Reference images** (when visual style reference needed):
   ```
   ~/.claude/skills/media/Art/Examples/
   ```

## DOS Theme Quick Reference

```typescript
import { DOS_THEME } from '~/.claude/skills/media/Remotion/Tools/Theme'

// Colors
DOS_THEME.colors.background    // #0f172a - Deep slate
DOS_THEME.colors.accent        // #8b5cf6 - Purple/violet
DOS_THEME.colors.text          // #f1f5f9 - Light text
DOS_THEME.colors.textMuted     // #94a3b8 - Muted text

// Typography
DOS_THEME.typography.title     // { fontSize: 72, fontWeight: 'bold' }
DOS_THEME.typography.subtitle  // { fontSize: 36 }
DOS_THEME.typography.body      // { fontSize: 24 }

// Animation
DOS_THEME.animation.springDefault  // { damping: 12, stiffness: 100 }
DOS_THEME.animation.fadeFrames     // 30 frames (~1 second)
DOS_THEME.animation.staggerDelay   // 10 frames

// Spacing
DOS_THEME.spacing.page         // 100px edge padding
DOS_THEME.spacing.section      // 60px between sections
DOS_THEME.spacing.element      // 30px between elements
```

## Using the Theme in Components

```typescript
import { DOS_THEME, titleScreenStyle, fadeInterpolation } from '~/.claude/skills/media/Remotion/Tools/Theme'

export const MyScene: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const opacity = interpolate(
    frame,
    fadeInterpolation().inputRange,
    fadeInterpolation().outputRange,
    { extrapolateRight: 'clamp' }
  )

  const scale = spring({
    frame, fps,
    config: DOS_THEME.animation.springDefault
  })

  return (
    <AbsoluteFill style={titleScreenStyle}>
      <h1 style={{
        ...DOS_THEME.typography.title,
        color: DOS_THEME.colors.text,
        opacity,
        transform: `scale(${scale})`
      }}>
        Title Here
      </h1>
    </AbsoluteFill>
  )
}
```

**All videos MUST use this theme unless explicitly overridden.**
