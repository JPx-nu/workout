---
description: Research best practices before implementing any plan. Always run after creating an implementation plan and before execution.
---

# Research Workflow

After creating any implementation plan, and before moving to EXECUTION mode, always follow these steps:

## 1. Context7 Research
// turbo-all
Use the Context7 MCP tools (`resolve-library-id` → `query-docs`) to research best practices for the key technologies in the plan. Focus on:
- The **newest recommended patterns** for each library/framework involved
- Any **deprecations or breaking changes** in the latest versions
- **Security best practices** specific to the stack

## 2. Cross-platform Considerations
This project targets **both web (Next.js) and native mobile (Capacitor/iOS + Android)**. When implementing anything, always consider:
- Will this work in a Capacitor WebView context?
- Are there platform-specific APIs that need polyfills or alternatives?
- Does the approach work offline or with intermittent connectivity?
- Are native capabilities (camera, GPS, health data) considered where relevant?

## 3. Update Plan If Needed
If Context7 research or cross-platform review reveals a better approach:
- Update the implementation plan before proceeding
- Document why the approach changed
- Re-request user review if the change is significant

## Key Rule
**Never use generic/default colors or patterns.** Always check the project's design system (`globals.css`, `docs/style-guide.md`) before writing any UI code. The brand color is teal, not purple/blue.

## Search Year Rule
**Always use the current year (2026) when searching for best practices, trends, or documentation.** Never search for 2025 or older years unless specifically looking at historical context.
