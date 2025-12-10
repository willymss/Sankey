# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Power BI Custom Visual** project for an Advanced Sankey Chart. The visual displays hierarchical flow diagrams (Sankey diagrams) with extensive customization options for nodes, links, colors, and interactivity features.

**Key Capabilities:**
- Multi-level hierarchical data visualization (up to 10 levels)
- Customizable node shapes (rectangle, rounded rectangle, pill, ellipse, diamond, hexagon, parallelogram)
- Interactive selection with cross-filtering support
- Keyboard navigation and accessibility features (screen reader support, high contrast mode)
- Pan and zoom controls
- Custom tooltips for the last hierarchy level
- Advanced styling with preset layouts

## Development Commands

### Starting Development Server
```bash
npm start
# or
pbiviz start
```
Starts the Power BI visuals development server on https://localhost:8080. This serves the visual for testing in Power BI Service with developer mode enabled.

### Building the Visual
```bash
npm run package
# or
pbiviz package
```
Creates a distributable `.pbiviz` package file in the `dist/` folder that can be imported into Power BI.

### Linting
```bash
npm run lint
```
Runs ESLint using the Power BI visuals plugin configuration. The project follows the recommended Power BI visuals linting rules.

### Debugging
To debug the visual:
1. Start the development server with `npm start`
2. Open Power BI Service with developer mode enabled
3. Attach Chrome debugger on port 9222 (configured in `.vscode/launch.json`)

## Architecture

### Core Visual Implementation

**Main Visual Class** (`src/visual.ts`):
- `Visual` class implements the `IVisual` interface (required by Power BI)
- `AdvancedSankeyChart` extends `Visual` (export class for the visual)

**Key Lifecycle Methods:**
- `constructor(options: VisualConstructorOptions)`: Initializes DOM, services, and event handlers
- `update(options: VisualUpdateOptions)`: Main render loop called by Power BI when data/settings change
- `getFormattingModel()`: Returns formatting pane configuration for Power BI settings

### Data Flow

1. **Data Extraction** (`extractData`): Parses Power BI table data into internal `TableData` format
2. **Data Processing** (`processData`): Builds nodes and links from raw data
   - Creates unique node IDs using `makeId(levelIndex, value)`
   - Builds `SankeyNode` objects with positions, colors, selection IDs
   - Creates `SankeyLink` objects connecting nodes
   - Calculates neighbor counts for connection badges
3. **Layout Calculation** (`calculateLayout`): Positions nodes based on levels and spacing settings
4. **Rendering** (`render`): Orchestrates SVG rendering of all visual elements

### Key Data Structures

**SankeyNode:**
- `id`: Unique identifier (hash of level + value)
- `level`: The hierarchy level name
- `levelIndex`: Numeric position in hierarchy (0-based)
- `value`: Display value for the node
- `count`: Number of occurrences
- `color`: Fill color
- `x, y`: Calculated position
- `selectionId`: Power BI selection ID for cross-filtering
- `highlighted`: Whether node is highlighted in current selection

**SankeyLink:**
- `source`: Source node ID
- `target`: Target node ID
- `count`: Number of connections
- `color`: Link color
- `sourceColor`: Optional source node color for gradients
- `targetColor`: Optional target node color for gradients

### Settings Architecture

The visual uses Power BI's FormattingSettingsService for the settings pane:

**Settings Structure** (`src/settings.ts`):
- Settings are organized into "Cards" (top-level categories)
- Cards contain "Slices" (individual settings)
- Two types of cards:
  - `SimpleCard`: Single-level settings groups
  - `CompositeCard`: Contains nested sub-cards

**Main Setting Cards:**
1. **Style Presets** (`StylePresetsCard`): Pre-configured layout styles
2. **Node Settings** (`NodeSettingsCard`): Composite card with sub-cards:
   - Size and Spacing
   - Shape
   - Border
   - Text
   - Connection Counts (badges)
3. **Link Settings** (`LinkSettingsCard`): Composite card with:
   - Style
   - Opacity
   - Color
   - Start Marker
   - End Marker
   - Marker Colors
4. **Color Settings** (`ColorSettingsCard`): Auto colors and custom color palette
5. **Display Settings** (`DisplaySettingsCard`): Header, controls, empty state

**Settings Flow:**
- Power BI calls `getFormattingModel()` to render settings pane
- User changes trigger `update()` with new settings
- `updateSettingsFromModel()` extracts values from FormattingSettingsModel into flat `SankeySettings` object

### Selection and Interactivity

**Selection Management:**
- Uses Power BI's `ISelectionManager` for cross-filtering
- Maintains three selection maps:
  - `rowSelectionByIndex`: Maps table row indices to selection IDs
  - `nodeSelectionById`: Maps node IDs to selection IDs
  - `nodeRowIndexById`: Maps node IDs to original row indices

**Selection Behavior:**
- Single click: Selects node and propagates to Power BI
- Ctrl+click: Multi-select nodes
- Click background: Clears selection
- Double-click background: Resets zoom

**Highlight Flow:**
- Node selection triggers `highlightConnections()`
- Collects upstream and downstream connected nodes
- Updates visual highlighting
- Calls `selectRowsForSelectedNodes()` to sync with Power BI

### Rendering Pipeline

**Main Rendering Flow** (`render`):
1. Clear and recreate SVG structure
2. `createMarkerDefinitions()`: Create arrow markers for links
3. `renderHeader()`: Optional title header
4. `calculateLayout()`: Position all nodes
5. `renderLinks()`: Draw connection paths
6. `renderLevelHeaders()`: Draw column headers for each level
7. `renderNodes()`: Draw node shapes with text and badges
8. `renderControls()`: Zoom/pan controls
9. Apply any highlight state

**Node Rendering** (`renderNodes`):
- For each node, create SVG group (`<g>`)
- `createNodeShape()`: Draw shape based on `nodeShape` setting
- `renderNodeText()`: Add text labels with wrapping
- `renderNodeBadge()`: Add connection count badges
- `renderNodeLabel()`: Optional custom labels
- Attach event handlers for clicks, keyboard, tooltips

**Link Rendering** (`renderLinks`):
- Draws paths between connected nodes
- `generateLinkPath()`: Creates curved or straight paths based on `linkCurveStyle`
- Supports different link color modes (gradient, source, target, custom)
- Adds markers (arrows) at start/end if enabled

### Accessibility Features

- **Keyboard Navigation**: Arrow keys navigate between nodes, Tab/Shift+Tab for level jumping
- **Focus Management**: Visual focus ring on keyboard-focused nodes
- **Screen Reader**: ARIA labels and live announcements via `announceToScreenReader()`
- **High Contrast Mode**: Detects and applies high contrast colors from Power BI theme

### Zoom and Pan

- **Pan**: Click and drag background
- **Zoom**: Mouse wheel or control buttons
- **Fit to Screen**: Auto-scales to viewport
- Transform applied via SVG `transform` attribute on `mainGroup`

## Key Files

- `src/visual.ts`: Main visual logic (~2,366 lines)
- `src/settings.ts`: Formatting pane settings model
- `capabilities.json`: Visual capabilities and data role definitions
- `pbiviz.json`: Visual metadata and configuration
- `style/visual.less`: LESS styles for the visual
- `stringResources/en-US/resources.resjson`: Localization strings

## Data Roles

The visual accepts:
- **group**: Hierarchy Levels (max 10) - Categorical columns defining the flow hierarchy
- **tooltips**: Tooltips (max 5) - Measures shown in tooltips for last level only

Data reduction limit: 30,000 rows

## Important Notes

- The visual class must be exported twice: `export class Visual` (implementation) and `export class AdvancedSankeyChart extends Visual {}` (Power BI entry point)
- TypeScript compilation target is ES2022
- The visual supports landing page, empty state, and edit mode
- Selection IDs must be created from table rows for proper cross-filtering
- All SVG rendering is manual (custom implementation)
- The project uses D3 v7.9.0 for utilities, but does not use D3's built-in sankey layout library
- The visual uses FormattingSettingsService from `powerbi-visuals-utils-formattingmodel` v6.0.4 for settings management
