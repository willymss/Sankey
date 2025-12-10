# Repository Guidelines

## Project Structure & Module Organization
- `src/visual.ts` holds the Sankey visual logic (rendering, selection, tooltips) and `src/settings.ts` defines formatting settings exposed to Power BI.
- `style/visual.less` contains the visual theme; compiled output and PBIVIZ package artifacts land in `.tmp/` during builds and `dist/` after packaging.
- Metadata lives in `pbiviz.json` and `capabilities.json`; localization strings sit under `stringResources/en-US/`; icons and other assets are under `assets/`.

## Build, Test, and Development Commands
- `npm install` — install dependencies (requires Node and the Power BI visuals CLI; install globally with `npm install -g powerbi-visuals-tools` if missing).
- `npm run start` — start the pbiviz dev server on localhost:8080 for live-reload testing in Power BI Desktop (Developer Mode).
- `npm run package` — produce `dist/advancedSankeyChart.pbiviz` for distribution or manual import.
- `npm run lint` — run ESLint using the Power BI visuals recommended ruleset.

## Coding Style & Naming Conventions
- TypeScript targeting ES2022; prefer 4-space indentation, double quotes, and trailing semicolons to match existing files.
- Use PascalCase for classes/interfaces, camelCase for functions and variables, and UPPER_SNAKE_CASE only for exported constants.
- Keep formatting-related models in `VisualFormattingSettingsModel` and reuse the shared formatting utilities; keep visual styles in LESS with kebab-case class names.

## Testing Guidelines
- No automated tests are present; rely on manual checks in Power BI Desktop while running `npm run start` or with the packaged PBIVIZ file.
- Validate key paths: data mapping consistency, node/link styling options, selection & cross-filtering, tooltip content, keyboard navigation, and high-contrast mode.
- Use representative datasets with multiple categories/levels to spot layout regressions and text wrapping issues.

## Commit & Pull Request Guidelines
- Write concise, present-tense commit messages (imperative mood) and group unrelated changes into separate commits.
- Before opening a PR, run `npm run lint` and, if user-facing changes occur, attach updated screenshots/GIFs and list manual test cases executed.
- Reference related issues, describe breaking changes or new capabilities, and keep PR descriptions scoped and clear.

## Security & Configuration Tips
- Do not commit generated certificates (`pbiviz-certs/`) or temporary build outputs under `.tmp/`; keep secrets and tenant IDs out of source and config files.
- Validate third-party script additions with the Power BI visuals policy and document any new capabilities in `capabilities.json`.
