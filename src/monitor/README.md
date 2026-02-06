# Monitor submodule

Sdílené moduly pro režimy join, open a interactive.

- **page-monitoring.mjs** – připojení console/network listenerů na stránku (sdílené pro join i open).
- **tab-selection.mjs** – výběr tabu (askUserToSelectPage, ensureKeypressEvents).
- **interactive-mode.mjs** – interaktivní menu (o = open, j = join, q = quit), výběr projektového adresáře, výběr Chrome instance.
- **index.mjs** – re-exporty pro přehled API.

Veřejné API (`runJoinMode`, `runOpenMode`, `runInteractiveMode`) zůstává v `../monitor.mjs` kvůli absenci cyklických závislostí.
