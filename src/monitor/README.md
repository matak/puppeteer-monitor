# Monitor submodule

Sdílené moduly pro režimy join a open.

- **open-mode.mjs** – spuštění nového Chrome.
- **join-mode.mjs** – připojení k běžícímu Chrome.
- **page-monitoring.mjs** – připojení console/network listenerů na stránku.
- **tab-selection.mjs** – výběr tabu (askUserToSelectPage, ensureKeypressEvents).

## shared/

Společné utility používané oběma režimy:

- **user-page-filter.mjs** – filtruje interní Chrome stránky (chrome://, devtools://, extension://).
- **monitoring-wrapper.mjs** – factory pro setupPageMonitoring s vazbou na session state.
- **help.mjs** – periodický help reminder + full in-session help (h key).
- **http-state-setup.mjs** – napojení sharedHttpState callbacků na mode-local state.
- **tab-switching.mjs** – interaktivní přepínání tabů (t key).
- **cleanup.mjs** – cleanup funkce + signal handlery (SIGINT, SIGTERM, uncaughtException).
- **keyboard-handler.mjs** – keyboard input handler (d, c, q, k, s, p, t, h).
- **index.mjs** – barrel re-exporty všech shared modulů.

Veřejné API (`runJoinMode`, `runOpenMode`) se importuje přímo z jednotlivých souborů v `cli.mjs`.
