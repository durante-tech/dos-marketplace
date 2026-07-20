---
disable-model-invocation: true
name: Documents
description: Read, write, convert, and analyze documents — routes DOCX, PDF, XLSX, PPTX work to the official Anthropic document-skills plugin and keeps DOS-local workflows for consulting reports, large PDFs, and HTML-to-PPTX. USE WHEN document, process file, create document, convert format, extract text, PDF, DOCX, XLSX, PPTX, Word, Excel, spreadsheet, PowerPoint, presentation, slides, consulting report, large PDF, merge PDF, fill form, tracked changes, redlining.
role: executor
accepts:
  - file:pdf
  - file:docx
  - file:xlsx
  - file:pptx
roots: []
visibility: public
capabilities:
  - customization.cascade
  - voice.emit
---
<!-- generated-from: SKILL.partials.md — DO NOT EDIT directly. Run: bun Tools/dos-build.ts skill <path> -->
## Customization

**Before executing, check for user customizations at:**
`~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/Documents/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# Documents Skill

## 🎯 Load Full DOS Context

**Before starting any task with this skill, load complete DOS context:**

`read ~/.claude/DOS/SKILL.md`

## What This Skill Is Now

This cluster is a **router plus DOS-local workflows**. The per-format document
skill bodies (DOCX, PDF, PPTX, XLSX) that previously lived here as vendored
copies of Anthropic's document skills were retired on 2026-07-11 (Prospector
Gen 40, operator-signed 2026-07-10): the upstream skills are proprietary
(no-derivatives, no-distribution license) and are now consumed the supported
way — as the official **document-skills plugin**.

**Prerequisite for format-specific work:** the official plugin must be installed:

```
/plugin marketplace add anthropics/skills
/plugin install document-skills@anthropic-agent-skills
```

If the plugin is not installed, tell the user to run the two commands above —
do not reimplement the format workflows inline.

## Workflow Routing

| Request Pattern | Route To |
|---|---|
| Consulting report, McKinsey report, assessment report, professional PDF | `Workflows/ConsultingReport.md` |
| Large PDF, process big PDF, Gemini PDF | `Workflows/ProcessLargePdfGemini3.md` |
| HTML slides to PowerPoint, html2pptx, pixel-accurate slide conversion | `html2pptx.md` (local `Scripts/html2pptx.js` library) |
| Word document, DOCX, tracked changes, redlining | `docx` skill (document-skills plugin) |
| PDF create/merge/split/extract/fill form | `pdf` skill (document-skills plugin) |
| Presentation, PPTX, slides, speaker notes, templates | `pptx` skill (document-skills plugin) |
| Spreadsheet, XLSX, Excel, formulas, financial model | `xlsx` skill (document-skills plugin) |

## DOS-Local Capabilities (kept in this cluster)

### Consulting Reports (HTML + Playwright PDF)

**Reference Documentation:**
- `Workflows/ConsultingReport.md` - Complete consulting report generation workflow

**Routing Logic:**
- "Create consulting report", "generate report PDF" → ConsultingReport workflow
- "Build assessment report", "strategic assessment" → ConsultingReport workflow
- "McKinsey-style report", "professional report PDF" → ConsultingReport workflow

**Pipeline:** Report Artifacts → Structured HTML → Playwright PDF

**Key Capabilities:**
- Parse report directories with mixed content (markdown, TypeScript data, images)
- Professional CSS typography (Georgia serif body, Inter sans headings)
- Color-coded callout boxes (red/amber/green) and severity badges
- Auto-generated linked Table of Contents
- Cover page with classification marking
- Headers/footers with CONFIDENTIAL and page numbers
- Image compression pipeline (PNG → JPEG, max 1200px)
- A4 format with Playwright for pixel-perfect PDF output

### Large PDF Processing (Gemini)

**Reference Documentation:**
- `Workflows/ProcessLargePdfGemini3.md` - Process and extract content from large PDFs via Gemini 3 Pro

### HTML → PowerPoint (html2pptx)

**Reference Documentation:**
- `html2pptx.md` - Creating presentations from HTML with accurate positioning
- `Scripts/html2pptx.js` - The DOS-local conversion library (authored here; not part of the upstream plugin)

**Routing Logic:**
- "Convert HTML slides to PPTX", "pixel-accurate slides from HTML" → html2pptx guide
- General PPTX creation/editing beyond the HTML pipeline → `pptx` skill (document-skills plugin)

## Examples

**Example 1: Create proposal with tracked changes**
```
User: "Create a consulting proposal doc with redlining"
→ Routes to the plugin docx skill (tracked-changes workflow)
```

**Example 2: Generate professional consulting report PDF**
```
User: "Create a consulting report from the assessment data"
→ Routes to ConsultingReport workflow (DOS-local)
→ Parses report directory, compresses images, generates styled HTML
→ Converts to PDF via Playwright with headers/footers
```

**Example 3: HTML slides to PowerPoint**
```
User: "Turn these HTML slides into a PPTX"
→ Routes to html2pptx.md + Scripts/html2pptx.js (DOS-local)
```

## 🔗 Integration with Other Skills

### Feeds Into:
- **writing** skill - Creating documents for blog posts and newsletters
- **business** skill - Creating consulting proposals and financial models
- **research** skill - Extracting data from research documents

### Uses:
- **document-skills plugin** (official) - All per-format DOCX/PDF/PPTX/XLSX work
- **media** skill - Creating images for document illustrations
- **development** skill - Building document processing automation

## Credits

Per-format document processing is provided by Anthropic's official
[document-skills](https://github.com/anthropics/skills) plugin
(`document-skills@anthropic-agent-skills`). DOS previously vendored an older
vintage of those skills here (PAI heritage); the vendored copies were retired
in favor of the supported plugin because their license permits neither
derivative works nor redistribution. The ConsultingReport and
ProcessLargePdfGemini3 workflows and the html2pptx library are DOS-authored.

## Summary

**The Documents cluster routes document work to the right surface:**

- **DOCX / PDF / PPTX / XLSX** → official document-skills plugin (install prerequisite above)
- **Consulting reports** → DOS-local HTML + Playwright pipeline
- **Large PDFs** → DOS-local Gemini 3 workflow
- **HTML → PPTX** → DOS-local html2pptx library

**Routing is automatic** — analyze user intent, route per the table above.
