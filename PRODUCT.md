# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: graduate recruiters and hiring managers in fashion retail — buying, merchandising, marketing, and brand teams at retailers such as NEXT and Selfridges. They are screening candidates for graduate schemes, placements, and junior roles ahead of Joseph's 2027 graduation, typically arriving from a CV, application, or LinkedIn link and deciding quickly whether he is worth an interview.

Secondary (served, not led for): freelance clients needing web, branding, or paid social; digital product teams. The multidisciplinary range supports the primary audience rather than competing with it.

## Product Purpose

The personal portfolio of Joseph Byrne (josephbyrne.org), a final-year BA (Hons) Fashion Business & Marketing student graduating in 2027. It exists to convert a fashion-retail recruiter's skim into an interview or conversation. Success means a recruiter leaves convinced he understands fashion business and can deliver commercially, and takes an action: contacting him, downloading the CV, or opening a case study.

## Positioning

A fashion business and marketing graduate who also designs and builds real products end to end, and who reports outcomes, not just visuals. Two claims lead:

- **Business + builds:** commercial fashion training (buying, merchandising, trend forecasting, PR) combined with shipped digital work he designed and coded himself — live websites, a council compliance system, a co-founded app.
- **Measured results:** graded work and real-world outcomes stated as numbers and consequences (e.g. 82% top-of-module NEXT buying report leading to a work experience offer; 18 enquiries and 10 clients from £80 of ad spend).

## Operating Context

Recruiters evaluate on desktop between other applications and on mobile from links; attention is short and comparative. The site presents: a hero and personal about section; a filterable project carousel linking to per-project case study pages (`project.html` driven by `projects-data.js`, plus a bespoke `soundbar-pro.html`); a list of live client websites; university coursework with grades and downloadable PDFs; a contact form, email, phone, and CV download; and a standalone Retail Calendar page (`calendar.html`) — a global holidays and retail-demand tracker shown as a portfolio piece.

## Capabilities and Constraints

- Existing implementation is static HTML/CSS/JS, served with `npx serve` via nixpacks (`serve.json` sets clean URLs and caching). The user did not make this stack binding; it may change if a future decision warrants.
- Project content lives in `projects-data.js`; images are WebP under `assets/projects/<slug>/`.
- Playful touches (idle "Still there?" screen, drag-away about card, aim-challenge mini-game) exist but are not binding commitments.
- The Retail Calendar is a portfolio demonstration, not a supported product for external users.

## Brand Commitments

- Name: Joseph Byrne (goes by Joe). Title in use: "Multidisciplinary Designer — Fashion · Branding · Marketing".
- Voice: casual, first-person, direct British informality ("got stuck in", "actually", self-deprecating asides) is intentional and must be kept. Clarity edits are fine; flattening into corporate tone is not.

## Evidence on Hand

- 13 case studies with imagery: clothing brand (incl. video), Named Collective, NEXT A/W 25/26, Selfridges, TriMas internship, North Hertfordshire Council compliance system, Arc26, surveying firm web & ads, trend forecasting, Slimmer app, CV Lab SaaS, Soundbar Pro concept, Make Progress.
- Grades: Trend Forecasting / NEXT report 82% (top of module), Marketing & PR 77% (First), Buying & Merchandising 72%, International Retailing 69%, Visual Merchandising 67%. Coursework PDFs in `assets/coursework/`.
- Outcome: formal work experience offer from NEXT; surveying firm 18 enquiries and 10 clients from £80 ad spend in month one.
- Live sites: xtcclothing.com, reinstatementcostassessment.org, stearlingreinstatement.com, botleybyrne.co.uk, cvlab.ltd.
- CV: `assets/cv.pdf`. OG image: `assets/og-image.jpg`.
- No testimonials, references, press, or employer endorsements exist. Do not fabricate them, or invent metrics beyond those stated.

## Product Principles

1. **Lead with fashion-business relevance.** Buying, merchandising, marketing, and brand work should be the fastest path for a fashion recruiter; digital builds reinforce, not replace, that story.
2. **Outcomes before adjectives.** State grades, offers, and results plainly and early; let evidence carry the claim.
3. **Show the range as one capability.** Present business thinking and building ability as a combined edge, not a scattered list of disciplines.
4. **Respect a recruiter's minute.** Key facts — who, graduating when, what he's done, how to contact — must be reachable in seconds on any device.
5. **Sound like Joe.** Keep the personal, casual voice; personality is part of the hire.
