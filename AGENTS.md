# Repository Guidelines

## Project Structure & Module Organization
- `src/visual.ts` houses visual logic (rendering, selection, tooltips, formatting sync/reset) and `src/settings.ts` defines formatting settings exposed to Power BI.
- `style/visual.less` contains visual styling; build outputs land in `.tmp/` during dev and `dist/` after packaging.
- Metadata lives in `pbiviz.json` and `capabilities.json`; localization strings in `stringResources/en-US/`; assets (icons, etc.) in `assets/`.

## Build, Test, and Development Commands
- `npm install` — install deps (requires Node and `powerbi-visuals-tools`; install globally via `npm install -g powerbi-visuals-tools` if missing).
- `npm run start` — start pbiviz dev server (localhost:8080) for live-reload testing in Power BI Desktop (Developer Mode).
- `npm run package` — build and emit `dist/streamLinks2024A1B2C3D4E5F6G7.1.1.0.0.pbiviz` (current tagged output).
- `npm run lint` — run ESLint with Power BI visuals ruleset.

## Visual Defaults & Presets
- Initial style matches the Soft White preset (rounded rects, fixed blue palette, gradient links).
- Available presets: `professionalBlue`, `vibrantSpectrum`, `neon`, `pastel`, `angularTech`, `gradientFlow`, `midnightPro`, `popArt`, `auroraFlow`, `offwhite`, `modernApp`, `gradientPill`, `outlinedGradient`, `softWhite`. High Contrast and Corporate presets were removed.
- Colors card exposes direct level pickers only; no auto-color toggle.

## Formatting & Reset Behavior
- Settings load from the current preset defaults each update, then apply only persisted metadata properties; untouched properties stay at preset defaults.
- “Reset to default” per card uses preset defaults; full reset preserves the active preset. Color resets restore the preset palette without changing other cards.

## Coding Style & Naming Conventions
- TypeScript targeting ES2022; 4-space indentation, double quotes, trailing semicolons.
- PascalCase for classes/interfaces, camelCase for functions/variables, UPPER_SNAKE_CASE only for exported constants.
- Keep formatting-related models in `VisualFormattingSettingsModel`; keep styles in LESS with kebab-case class names.

## Testing Guidelines
- No automated tests; rely on manual checks in Power BI Desktop with `npm run start` or the packaged PBIVIZ.
- Validate: data mapping across levels, node/link styling and color overrides per level, selection & cross-filtering, tooltips, keyboard navigation, high-contrast mode, drill levels, and reset-to-default behavior for every card.

## Commit, Tag & Release Guidance
- Use concise, present-tense commit messages (imperative mood); separate unrelated changes.
- Tag releases when stable; current tag: `v1.0.0` (“official v1”) on commit `ebd777e`.
- Before PRs/releases: run `npm run lint` and include updated screenshots/GIFs plus manual test notes for user-facing changes.

## Security & Configuration Tips
- Do not commit generated certificates (`pbiviz-certs/`) or temporary build outputs under `.tmp/`/`dist/`; keep secrets and tenant IDs out of source/config.
- Validate third-party additions against Power BI visuals policy and document any new capabilities in `capabilities.json`.
