# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Power BI Custom Visual** project for **StreamLinks**. The visual displays hierarchical flow diagrams with extensive customization options for nodes, links, colors, and interactivity features.

**Key Capabilities:**
- Multi-level hierarchical data visualization (up to 10 levels)
- Customizable node shapes (rectangle, rounded rectangle, pill, ellipse, diamond, hexagon, parallelogram)
- Interactive selection with cross-filtering support
- Keyboard navigation and accessibility features (screen reader support, high contrast mode)
- Pan and zoom controls
- Custom tooltips for the last hierarchy level
- Advanced styling with preset layouts

For contributor guidelines and development workflow, see `AGENTS.md`.

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

### Debugging and Testing Workflow

**Development Server:**
1. Start with `npm start` or `pbiviz start`
2. Server runs on https://localhost:8080
3. Generates `.pbiviz` file in `dist/` directory
4. Enable Developer Mode in Power BI Desktop/Service to use local visual
5. Import the visual from Developer Visual section in Power BI

**Testing the Visual:**
1. Enable Developer Mode: File → Options → Preview features → Developer visual
2. Add sample hierarchical data (2-10 columns for hierarchy levels)
3. Test interactions: selection, cross-filtering, keyboard navigation
4. Verify settings changes apply immediately via `update()` calls
5. Check accessibility: high contrast mode, screen reader, keyboard focus

**Debugging with Chrome DevTools:**
1. Start dev server with `npm start`
2. Open Power BI Desktop or Power BI Service
3. Add the developer visual to a report
4. Attach Chrome debugger on port 9222 (configured in `.vscode/launch.json`)
5. Set breakpoints in TypeScript source (source maps are generated)
6. Use `console.log()` or debugger statements in `visual.ts`

**Hot Reload:**
- Changes to `visual.ts`, `settings.ts`, or `visual.less` rebuild automatically
- Refresh the visual in Power BI to see changes
- Settings pane updates require re-opening the format pane
- Changes to `capabilities.json` require restarting the dev server

## Architecture

### Core Visual Implementation

**Main Visual Class** (`src/visual.ts`):
- `Visual` class implements the `IVisual` interface (required by Power BI)
- `StreamLinks` extends `Visual` (export class for the visual)

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

**Dual Settings Pattern:**
- `SankeySettings` interface: Flat object with all settings values (used by rendering code)
- `VisualFormattingSettingsModel`: Hierarchical FormattingSettingsModel for Power BI pane
- Settings flow: FormattingSettingsModel → `updateSettingsFromModel()` → flat SankeySettings object

**Settings Structure** (`src/settings.ts`):
- Settings are organized into "Cards" (top-level categories)
- Cards contain "Slices" (individual settings)
- Two types of cards:
  - `SimpleCard`: Single-level settings groups
  - `CompositeCard`: Contains nested sub-cards (e.g., Node Settings has Shape, Border, Text sub-cards)

**Main Setting Cards:**
1. **Style Presets** (`StylePresetsCard`): Pre-configured layout styles (dropdown selector)
2. **Node Settings** (`NodeSettingsCard`): Composite card with sub-cards:
   - Size and Spacing (width, height, level spacing, node spacing)
   - Shape (node shape, corner radius)
   - Fill (fill type, color override, opacity)
   - Border (border style, width, type, custom color)
   - Shadow (enabled, color, opacity, blur, offset X/Y)
   - Text (font size, family, color, wrap settings, show values)
   - Connection Counts (badges: position, padding, font settings, count mode)
3. **Link Settings** (`LinkSettingsCard`): Composite card with:
   - Style (opacity, width, curve style, link style)
   - Color (color mode, custom color)
   - Start Marker (show, type, size)
   - End Marker (show, type, size)
   - Marker Colors (custom colors for markers)
4. **Color Settings** (`ColorSettingsCard`): 10 level color pickers (no auto-color toggle)
5. **Display Settings** (`DisplaySettingsCard`): Header (title, counters), controls (show/hide), empty state

**Settings Flow:**
- Power BI calls `getFormattingModel()` to render settings pane
- User changes trigger `update()` with new settings in `options.dataViews[0].metadata.objects`
- `updateSettingsFromModel()` extracts values from FormattingSettingsModel into flat `SankeySettings` object
- Preset defaults are loaded first, then persisted metadata properties override them

**Settings Categorization (Preset Reset Behavior):**

Settings are organized into three categories that determine reset behavior when switching presets:

- **Category A (29 settings)**: Functional settings always preserved across preset changes
  - Sizing: node width/height, level spacing, node spacing
  - Badges: position, padding, font settings, count mode
  - Measures: show measure values, measure settings
  - Toggles: show controls, show headers, show level headers
  - Labels: show node labels, label settings

- **Category B (47 settings)**: Visual styling that resets when changing presets
  - Colors: level colors, link colors, text colors, border colors
  - Shapes: node shape, corner radius
  - Fonts: font families, sizes (for nodes and headers)
  - Borders: border styles, widths, types

- **Category C (11 settings)**: Visual effects preserved only if explicitly customized
  - Background: background color, background opacity
  - Shadows: shadow enabled, shadow color, shadow opacity, blur, offsets
  - Fill types: solid vs gradient fills
  - Border types: solid vs gradient borders

This categorization ensures that functional settings and explicit customizations are preserved while allowing presets to control the visual style.

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

- `src/visual.ts`: Main visual logic (~2,800+ lines) - all rendering, interaction, and layout
- `src/settings.ts`: Formatting pane settings model with preset definitions
- `capabilities.json`: Visual capabilities, data role definitions, and object properties
- `pbiviz.json`: Visual metadata (name: advancedSankeyChart, display: StreamLinks)
- `style/visual.less`: LESS styles for controls, headers, and base elements
- `stringResources/en-US/resources.resjson`: Localization strings for settings pane

## Critical Development Patterns

### Adding New Settings

When adding a new setting:
1. Add property to `SankeySettings` interface in `visual.ts`
2. Add corresponding property definition to `capabilities.json` under appropriate object
3. Create new slice in appropriate card class in `settings.ts`
4. Update `updateSettingsFromModel()` to extract the value from FormattingSettingsModel
5. Update all preset definitions with default values for the new setting
6. Use the setting in rendering code

### Working with SVG Effects

**Filter/Gradient Reapplication Pattern:**
- SVG filters and gradients must be recreated when settings change
- Always call `ensureSoftShadowFilter()` before applying shadow to nodes
- Call `createNodeGradients()` before rendering if using gradient fill or border
- After selection/highlight changes, call `applyShadowToAllNodes()` to reapply filters

**Why reapplication is needed:**
- Highlight state changes modify node opacity
- Opacity changes can make filters appear incorrect
- Filters must be explicitly reapplied to maintain visual consistency

### Power BI Visual Update Cycle

Every time data or settings change, Power BI calls `update(options)`:
1. Check `options.type` for update reason (data, resize, viewMode, etc.)
2. Extract data via `extractData()` if data changed
3. Update settings via `updateSettingsFromModel()`
4. Process data into nodes/links via `processData()`
5. Full re-render via `render()`
6. Apply any selection state via `highlightConnections()`

**Performance considerations:**
- The visual clears and recreates all SVG on each update
- Animation uses CSS transitions to smooth position changes
- `previousNodePositions` map enables smooth transitions between layouts

### Debugging Common Issues

**Selection not working:**
- Verify selection IDs are created from table row indices, not node IDs
- Check that `rowSelectionByIndex`, `nodeSelectionById`, and `nodeRowIndexById` maps are populated during `processData()`
- Ensure `selectRowsForSelectedNodes()` is called after node selection

**Gradients not showing:**
- Verify `fillType` or `borderType` is set to "gradient"
- Check that `createNodeGradients()` is called before `renderNodes()`
- Gradient IDs must match pattern: `node-gradient-{nodeId}` or `node-border-gradient-{nodeId}`

**Shadows disappearing on selection:**
- Shadow filter must be reapplied after opacity changes
- Call `applyShadowToAllNodes()` after highlight state changes
- Do not reduce opacity when shadow is enabled (prevents shadow from being visible)

**Preset reset not working:**
- Verify the preset object has values for all settings
- Check that `updateSettingsFromModel()` uses preset defaults as base values
- Ensure metadata persistence isn't overriding reset values

## Data Roles

The visual accepts:
- **group**: Hierarchy Levels (max 10) - Categorical columns defining the flow hierarchy
- **values**: Measure (Flow Values) (max 1) - Optional measure for flow calculations
- **tooltips**: Tooltips (max 5) - Measures shown in tooltips for last level only

Data reduction limit: 30,000 rows

### SVG Effects and Gradients

**Node Gradients** (`createNodeGradients`):
- Creates linear gradient definitions for each node when `fillType` or `borderType` is "gradient"
- Gradient IDs use format: `node-gradient-{nodeId}` and `node-border-gradient-{nodeId}`
- Called before rendering nodes if gradient mode is enabled

**Soft Shadow Filter** (`ensureSoftShadowFilter`):
- Creates SVG filter definition with ID `#node-shadow` when `nodeShadowEnabled` is true
- Uses feGaussianBlur, feOffset, feFlood, feComposite, and feMerge for realistic shadow
- Shadow properties: color, opacity, blur radius, X/Y offset are all configurable
- `applyShadowToAllNodes()` applies/removes shadow filter to all node shapes

**Marker Definitions** (`createMarkerDefinitions`):
- Creates SVG markers for link arrows (start/end)
- Supports arrow, circle, diamond, triangle marker types
- Marker colors can match link color or use custom colors

### Style Presets System

The visual has 14 built-in style presets that configure all visual settings at once:

**Preset Architecture:**
- Presets are defined in `visual.ts` via `applyStylePreset()` method (visual.ts:790)
- Base defaults come from `getDefaultSettings()` (visual.ts:353)
- Available presets: `professionalBlue`, `vibrantSpectrum`, `neon`, `pastel`, `angularTech`, `gradientFlow`, `midnightPro`, `popArt`, `auroraFlow`, `offwhite`, `modernApp`, `gradientPill`, `outlinedGradient`, `softWhite`
- Default preset is `softWhite` (as of v1.1.0; previously `professionalBlue`)

**Preset Loading Flow:**
1. `update()` loads base preset defaults via `updateSettingsFromModel()`
2. Only persisted properties override preset defaults
3. "Reset to default" per card restores preset defaults for that card
4. Full visual reset preserves the active preset

**Important Preset Behavior:**
- When switching presets, control toggles (show/hide settings) are preserved from previous state
- Color palette and styling are always replaced from the new preset
- Users can customize any individual setting after selecting a preset

### Animation and Transitions

**Node Position Transitions:**
- Nodes animate to new positions on layout changes
- Uses CSS transitions (`transform 0.3s ease`)
- `previousNodePositions` map tracks last positions for smooth transitions
- Applied via `requestAnimationFrame` for optimal performance

**Selection and Highlight Animations:**
- Highlight state updates trigger visual opacity/filter changes
- Non-highlighted nodes reduce opacity when selection exists
- Shadow filters reapply after selection changes via `applyShadowToAllNodes()`

### Recent Development Focus

Based on git history, recent work has focused on:
- Gradient link visibility improvements (stroke opacity adjustments)
- Badge styling and positioning (padding, font, color bindings)
- Preset system refinement (control toggle preservation, reset behavior)
- Shadow filter implementation for modern visual effects
- Visual rebranding from "Advanced Sankey Chart" to "StreamLinks"

## Important Notes

- **Class Export Requirement**: The visual class must be exported twice: `export class Visual` (implementation) and `export class StreamLinks extends Visual {}` (Power BI entry point). This dual export is critical for Power BI to recognize the visual.
- **TypeScript Target**: ES2022 compilation target
- **Power BI Capabilities**: Supports landing page, empty state, edit mode, highlight, keyboard focus, and multi-visual selection
- **Selection ID Pattern**: Selection IDs MUST be created from table row indices for proper cross-filtering. The pattern is: create selection from row → store in maps → use for node interaction.
- **Manual SVG Rendering**: All SVG rendering is custom implementation (no framework). DOM manipulation uses `document.createElementNS` for SVG elements.
- **D3 Usage**: The project uses D3 v7.9.0 for utilities (color scales, array operations) but does NOT use D3's built-in sankey layout - all layout logic is custom.
- **Formatting Model**: Uses FormattingSettingsService from `powerbi-visuals-utils-formattingmodel` v6.0.4. Settings are organized into Cards (categories) containing Slices (individual settings).
- **Build Artifacts**: Never commit `dist/`, `.tmp/`, or `pbiviz-certs/` directories.
- **Visual Identity**: The visual name in pbiviz.json remains "advancedSankeyChart" for upgrade compatibility, but display name is "Advanced Sankey Chart" (branded as StreamLinks).
