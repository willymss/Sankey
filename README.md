# StreamLinks (Power BI Visual)

Flow diagram custom visual with configurable nodes, links, labels, accessibility support, and Power BI cross-filtering. (Formerly Advanced Sankey Chart.)

## Requirements
- Node.js 18+ and npm
- Power BI visuals tools: `npm install -g powerbi-visuals-tools`
- Power BI Desktop (for testing the dev server output)

## Quick Start
1) Install deps: `npm install`
2) Start live dev server: `npm run start` (hosts on http://localhost:8080). Import the generated `.pbiviz` from the `dist/` folder into Power BI Desktop (Developer Mode) for hot-reload.
3) Package for distribution: `npm run package` (outputs `.pbiviz` in `dist/`).
4) Lint before commits: `npm run lint`.

## Project Structure
- `src/visual.ts` — visual rendering, selections, tooltips, accessibility hooks.
- `src/settings.ts` — formatting model exposed to the Power BI pane.
- `style/visual.less` — styling for nodes, links, and labels.
- `capabilities.json` — data roles, objects, and view mappings.
- `stringResources/` — localized strings.
- `assets/` — icons and static assets.
- `.tmp/` — build output (ignored); `dist/` — packaged visuals (ignored for source control).

## Development Notes
- Use TypeScript (ES2022) with the provided `tsconfig.json`. Keep styles in LESS and formatting logic in the formatting model classes.
- Validate accessibility: keyboard navigation, high-contrast mode, tooltip contents, and multi-select behaviors.
- Test with varied datasets (multiple levels/categories) to check layout, wrapping, and link scaling.

## Contributing
- Follow `AGENTS.md` and `CLAUDE.md` for contributor guidance.
- Keep commits scoped and in imperative mood; include screenshots/GIFs for user-facing changes.
- Do not commit build artifacts (`dist/`, `.tmp/`), certificates (`pbiviz-certs/`), or secrets.
