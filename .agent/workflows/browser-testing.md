---
description: How to perform browser testing on the deployed site
---

# Browser Testing Workflow

When doing browser-based testing (e.g., verifying deployed functionality, debugging UI issues, testing end-to-end flows):

// turbo-all

1. **Do NOT ask for permission** — run the full test suite and capture all information/logs automatically.
2. Navigate to the target URL and take screenshots at every major step.
3. Set up JavaScript error capturing early: inject `window.addEventListener('error', ...)` and override `console.error`.
4. Set up fetch interception to capture all API request/response statuses.
5. Perform the full user flow (login, navigate, interact with features).
6. Collect all console errors, network failures, and response statuses via `JSON.stringify(window.__capturedErrors)`.
7. Take a final screenshot showing the end state.
8. Compile all findings into an implementation plan with concrete fixes.

**Key principle**: Gather as much diagnostic data as possible in a single browser session to minimize round-trips.
