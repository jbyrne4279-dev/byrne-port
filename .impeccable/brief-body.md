## Scope & mode

Surface: `calendar.html` (The Ultimate Calendar — global holidays & retail demand tracker). Mode: Operate. Full visual-world replacement, user-pinned. Product truth, content, and behavior (event data, filters, agenda, legal note) are preserved; only the visual system changes.

## Audience, job, constraints

Audience: portfolio visitors (recruiters, retail planners as a demonstrated persona) scanning a working tool, not reading prose. Job: scan today's date, filter by type/impact, check upcoming events, trust the data. Constraints: keep all existing functionality (filters, legend, agenda list, footer disclaimer), keep semantics/accessibility, keep the "Back to Portfolio" nav consistent with the rest of the site's dark aesthetic.

## Direction contract

**THESIS:** A black, glass-paned control surface — Apple's visionOS/macOS Big Sur liquid-glass language applied to a data tool — refuses the flat, single-accent "dashboard card" default most calendar UIs ship.

**OWN-WORLD:** True black (#000–#0a0a0c) base. Frosted glass panels: `backdrop-filter: blur()` + translucent white overlay (6–12% alpha) + 1px hairline border (12–20% white) + soft top specular highlight + layered drop shadow, applied to the calendar grid, sidebar, legend chips, agenda cards, and modals — never the page background itself. Multi-color accent system: each event category/impact level carries its own saturated hue (red/orange = high impact, blue = cultural, green = go-ahead/low impact, purple = religious/moon-based, etc.), used on category dots, icons, badges, and active/selected states — never as full-surface color washes. Typography: system/SF-style sans for UI chrome (labels, controls), a confident display weight for the month/date headline.

**STORY:** Visitor opens the calendar, immediately reads it as a "real Apple product" — precise, dark, glassy — then trusts the data because the craft signals rigor.

**FIRST VIEWPORT:** Black canvas. Top: glass nav bar (Back to Portfolio + page title) sitting above the black. Below: glass toolbar strip with Today button, month/date nav, and legend/filter chips as pill-shaped glass segments with colored dots. Below that: the glass calendar grid as the dominant panel, each day cell a subtle glass tile, event dots/badges colored by category, "today" cell carrying a bright accent ring.

**FORM:** User-pinned direction (Apple liquid glass, black ground, multi-hue category accents, glass scoped to cards/panels). No concept-seed roll: brief explicitly pins world and material.

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Unresolved decisions

None outstanding — build path is code-led (no image generation available in this environment).
