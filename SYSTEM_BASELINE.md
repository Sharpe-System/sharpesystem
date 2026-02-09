# SharpeSystem — Baseline (Read First)

## Purpose
SharpeSystem provides decision-support and procedural orientation. It is NOT legal advice and not a substitute for an attorney.

## Tone
Calm, factual, non-reassuring, authoritative-with-care. No pep talk. No moralizing.

## Product boundaries (non-negotiable)
- No legal advice
- No strategy on evading consequences or “winning”
- No drafting filings by default
- Decision trees must show dead ends explicitly
- Safety-first language on high-conflict content

## Architecture
- Public site = orientation + decision trees
- Portal = attorney/client workspace (documents, timeline, packet export)
- Shared navigation via /partials/header.html
- One global stylesheet: /styles.css
- Risk Awareness page aesthetic is the baseline for the whole public site

## Public pages (current IA)
- / (landing)
- /home.html
- /trees.html
- /triage.html
- /status.html
- /amicable.html
- /high-conflict-risk-awareness.html

## Styling contract
- Dark, soothing, professional
- Consistent spacing + typographic hierarchy
- Components: panel, note, callout, button, link-row, template-box
- No per-page inline styles unless explicitly required

## Portal MVP (Sequence 1)
- Matter Dashboard
- Upload & Index
- Timeline Builder
- Export / Packet Builder

## Current priority
1) Triage page in Risk aesthetic
2) Portal skeleton prototype
3) Portal MVP features
