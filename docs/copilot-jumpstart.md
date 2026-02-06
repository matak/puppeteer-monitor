# Jumpstart your project with Copilot (optional)

Text for **Tell Copilot coding agent what you want to build** when configuring this repository.

## Full variant (use in README and for full context)

**What it is:** Puppeteer Monitor lets you capture the live state of a browser—console output, network requests, cookies, screenshot, and the current page DOM—and write it all to files. You (or an LLM agent) can then read those files instead of asking someone to copy-paste from DevTools or the browser.

**Why it’s useful:** When debugging a frontend app or feeding context to an AI assistant, you need the real console, the real DOM, and the real network traffic. Manual copy-paste is slow and error-prone. This tool connects to Chrome via Puppeteer, records everything in one place, and exposes a simple “dump” so the next step is always “read the files” instead of “please open the browser and copy this.”

**Who needs it:** Frontend and full-stack developers who debug in the browser; teams using LLM coding agents that need up-to-date DOM and network data; anyone who wants a repeatable way to snapshot browser state for logs, tests, or AI context. If you’ve ever asked a colleague to “send me what you see in the console” or “paste the HTML of that element,” you need this. Without it, getting a reliable, one-command snapshot of the live browser is much harder.

## Short variant (≤500 chars, for intro / Copilot field)

Puppeteer Monitor captures live browser state (console, network, DOM, screenshot) and writes it to files. You or an LLM read those files instead of copy-pasting from DevTools. For debugging or feeding context to AI you need the real console, DOM, and traffic—this tool gives a one-command snapshot. Frontend devs and teams using LLM agents need it; without it, a reliable live-browser snapshot is much harder. Essential for E2E and for feeding DOM and network data to LLM agents.
