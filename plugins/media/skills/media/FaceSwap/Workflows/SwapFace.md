---
name: Swap Face
description: 
status: STABLE
---

# Swap Face Workflow

**Swap one person's face onto another image using AI.**

## Voice Notification

```bash
bash "$DOS_DIR/DOS/Tools/voice.sh" main "Running the SwapFace workflow in the FaceSwap skill to swap faces"
```

Running **SwapFace** in **FaceSwap**...

---

## Purpose

Replace faces between images:
- Put your face onto a different photo
- Replace a face in a headshot or group photo
- Fun face swaps between two people
- Face replacement for creative projects

---

## Workflow Steps

### Step 1: Verify Both Images

Confirm both target and source images exist:

```bash
ls -lh /path/to/target-image.jpg
ls -lh /path/to/source-face.jpg
```

Supported formats: PNG, JPEG, WebP.

- **Target image**: The photo where the face will be replaced (keeps the body/scene)
- **Source image**: The photo containing the face to swap in

### Step 2: Run Face Swap

```bash
bun run ~/.claude/skills/media/FaceSwap/Tools/Swap.ts \
  --target ~/Downloads/target-photo.jpg \
  --source ~/Downloads/source-face.jpg \
  --output ~/Downloads/face-swapped.png
```

### Step 3: Compare Output

Open both original and swapped images side by side:

```bash
open ~/Downloads/target-photo.jpg ~/Downloads/face-swapped.png
```

Check that:
- Face replacement looks natural
- Lighting and skin tone blend well
- No artifacts around face edges

### Step 4: Iterate if Needed

If the result is not satisfactory:
- Try a different source image with a clearer face
- Ensure the source face is well-lit and front-facing
- Try a source image with similar angle to the target

---

## Examples

**Example 1: Basic face swap**
```bash
bun run ~/.claude/skills/media/FaceSwap/Tools/Swap.ts \
  --target ~/Downloads/group-photo.jpg \
  --source ~/Downloads/my-face.jpg \
  --output ~/Downloads/swapped-result.png
```

**Example 2: Face swap with URL inputs**
```bash
bun run ~/.claude/skills/media/FaceSwap/Tools/Swap.ts \
  --target https://example.com/target.jpg \
  --source https://example.com/face.jpg \
  --output ~/Downloads/url-swap.png
```

**Example 3: Batch face swap**
```bash
for img in ~/Downloads/targets-*.jpg; do
  output="${img%.jpg}-swapped.png"
  bun run ~/.claude/skills/media/FaceSwap/Tools/Swap.ts \
    --target "$img" --source ~/Downloads/my-face.jpg --output "$output"
done
```

---

## Integration with Other Workflows

- **ImageRestoration/RestoreImage**: Restore a damaged photo first, then swap faces
- **BackgroundRemoval/RemoveBackground**: Swap face, then remove background
- **Video/ImageToVideo**: Swap face on a still, then animate