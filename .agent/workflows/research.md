---
description: Research best practices before implementing any plan. Always run after creating an implementation plan and before execution.
---

# Research Workflow

Run this workflow after creating an implementation plan and before starting execution.
The goal is to ground every proposed change in the latest, highest-quality guidance as of February 2026 (or later).

## Steps

1. **Extract topics from the plan** — Read the implementation plan and list the distinct technical topics that need research (e.g., "Next.js viewport export", "Supabase RLS policies", "React 19 suspense patterns").

2. **Google search (broad)** — For each topic, run a web search targeting the latest frameworks and best practices. Use queries like:
   - `<topic> best practices <current year>`
   - `<topic> latest implementation <framework version>`
   Capture key findings: recommended APIs, patterns to avoid, accessibility considerations, and any breaking changes.

3. **Context7 enrichment (code examples)** — For each topic that maps to a known library:
   - Call `resolve-library-id` to find the Context7 library ID.
   - Call `query-docs` with a specific query to retrieve code examples and API docs.
   This step turns broad guidance into concrete, copy-paste-ready patterns.

4. **Update the implementation plan** — Merge findings into the plan:
   - Add concrete code snippets under each proposed change.
   - Note any best-practice adjustments (e.g., "prefer CSS fix over viewport hack for accessibility").
   - Add links/sources where relevant.

5. **Request user review** — Present the enriched plan for approval before execution.