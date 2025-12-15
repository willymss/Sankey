import "./../style/visual.less";
import powerbi from "powerbi-visuals-api";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import { VisualFormattingSettingsModel } from "./settings";

import DataView = powerbi.DataView;
import IVisual = powerbi.extensibility.visual.IVisual;
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import ISelectionId = powerbi.visuals.ISelectionId;
import IVisualEventService = powerbi.extensibility.IVisualEventService;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;
import IColorPalette = powerbi.extensibility.IColorPalette;
import ILocalizationManager = powerbi.extensibility.ILocalizationManager;


interface SankeySettings {
    // Node settings
    nodeWidth: number;
    nodeHeight: number;
    nodeShape: string;
    cornerRadius: number;
    nodeFillOpacity: number;
    nodeBorderStyle: string;
    nodeBorderWidth: number;
    useCustomBorderColor: boolean;
    nodeBorderColor: string;
    levelSpacing: number;
    nodeSpacing: number;
    fontSize: number;
    fontFamily: string;
    textAlignment: string;
    textColor: string;
    wrapText: boolean;
    maxCharsPerLine: number;
    showValues: boolean;
    badgeTextSize: number;
    badgeTextColor: string;
    badgeFontFamily: string;
    badgePosition: string;
    badgePaddingTop: number;
    badgePaddingRight: number;
    badgePaddingBottom: number;
    badgePaddingLeft: number;
    countMode: string;
    showLabel: boolean;
    labelText: string;
    labelPosition: string;
    labelFontSize: number;
    labelPaddingTop: number;
    labelPaddingRight: number;
    labelPaddingBottom: number;
    labelPaddingLeft: number;

    // Link settings
    lineOpacity: number;
    linkWidth: number;
    highlightOpacity: number;
    linkStyle: string;
    linkColorMode: string;
    customLinkColor: string;
    linkCurveStyle: string;
    showStartMarker: boolean;
    startMarkerType: string;
    startMarkerSize: number;
    showEndMarker: boolean;
    endMarkerType: string;
    endMarkerSize: number;
    useCustomMarkerColors: boolean;
    startMarkerColor: string;
    endMarkerColor: string;

    // Color settings
    colors: string[];

    // Display settings
    backgroundColor: string;
    showEmptyPlaceholder: boolean;
    showCounters: boolean;
    headerCounterFontSize: number;
    headerCounterFontFamily: string;
    headerCounterFontWeight: string;
    headerCounterAlignment: string;
    headerCounterColor: string;
    headerCounterSeparator: string;
    headerTitleColor: string;
    headerTitleMatchNode: boolean;
    headerTitleSize: number;
    headerTitleFontFamily: string;
    showControls: boolean;
    // Modern Theme Settings
    fillType: "solid" | "gradient";
    fillColorOverride?: string;
    borderType: "solid" | "gradient";
    showIcons: boolean;
    nodeShadowEnabled: boolean;
    nodeShadowColor: string;
    nodeShadowOpacity: number;
    nodeShadowBlur: number;
    nodeShadowOffsetX: number;
    nodeShadowOffsetY: number;

    // Measure settings
    measureAggregation: string;
    measureDisplayMode: string;
    linkSizingMode: string;
    linkMinWidth: number;
    linkMaxWidth: number;
    measureFormat: string;
    measureDecimals: number;
}

interface SankeyNode {
    id: string;
    level: string;
    levelIndex: number;
    value: string;
    count: number;
    color: string;
    x: number;
    y: number;
    selectionId?: ISelectionId;
    highlighted?: boolean;
    measureValue?: number;      // Aggregated measure value
    displayValue?: number;      // Value for display (either measureValue or count)
}

interface SankeyLink {
    source: string;
    target: string;
    count: number;
    color: string;
    sourceColor?: string;
    targetColor?: string;
    measureValue?: number;      // Aggregated measure value for this link
    flowValue?: number;         // Value for width calculation (either measureValue or count)
}

interface TableData {
    columns: string[];
    rows: any[][];
    highlights?: any[][];
    measureColumnIndex?: number;
}

interface MeasureData {
    columnIndex: number;
    aggregationMethod: string;
    valuesByRowIndex: Map<number, number>;
}

export class Visual implements IVisual {
    private target: HTMLElement;
    private host: IVisualHost;
    private selectionManager: ISelectionManager;
    private colorPalette: IColorPalette;
    private localizationManager: ILocalizationManager;
    private rowSelectionByIndex: Map<number, ISelectionId> = new Map();
    private nodeSelectionById: Map<string, ISelectionId> = new Map();
    private nodeRowIndexById: Map<string, number> = new Map();
    private settings: SankeySettings;
    private events: IVisualEventService;
    private container: HTMLElement;
    private svg: SVGSVGElement;
    private defs: SVGDefsElement;
    private mainGroup: SVGGElement;
    private fixedHeader: SVGGElement;
    private formattingSettings: VisualFormattingSettingsModel;
    private formattingSettingsService: FormattingSettingsService;
    private currentData: TableData | null = null;
    private nodes: Map<string, SankeyNode> = new Map();
    private links: SankeyLink[] = [];
    private measureData: MeasureData | null = null;
    private hasMeasure: boolean = false;
    private measureColumnMetadata: powerbi.DataViewMetadataColumn | null = null;
    private nodeToRowIndices: Map<string, number[]> = new Map();
    private currentDataView: powerbi.DataView | null = null;
    private readonly presetIds: string[] = [
        "professionalBlue",
        "vibrantSpectrum",
        "neon",
        "pastel",
        "angularTech",
        "gradientFlow",
        "midnightPro",
        "popArt",
        "auroraFlow",
        "offwhite",
        "modernApp",
        "gradientPill",
        "outlinedGradient",
        "softWhite"
    ];

    private lastClickedNode: string | null = null;
    private zoomScale: number = 1;
    private translateX: number = 0;
    private translateY: number = 0;
    private isPanning: boolean = false;
    private startPanX: number = 0;
    private startPanY: number = 0;
    private movedDuringPan: boolean = false;
    private lastBgClickAt: number = 0;
    private selectedNodes: Set<string> = new Set();
    private connectedNodes: Set<string> = new Set();
    private focusedNodeId: string | null = null;
    private nodeElements: Map<string, SVGGElement> = new Map();
    private isHighContrastMode: boolean = false;
    private highContrastColors: { foreground: string; background: string; foregroundSelected: string; hyperlink: string } | null = null;
    private isLandingPageOn: boolean = false;
    private landingPageElement: HTMLElement | null = null;
    private allowInteractions: boolean = true;
    private markerIdCounter: number = 0;
    private previousPreset: string = "softWhite";
    private copyHandler: ((e: ClipboardEvent) => void) | null = null;
    private currentDrillLevel: number = 0;
    private maxDrillLevel: number = 0;
    private isDrillMode: boolean = false;
    private previousFieldCount: number = 0;
    private lastViewportWidth: number = 0;
    private lastViewportHeight: number = 0;
    private justSwitchedPreset: boolean = false;
    private previousNodePositions: Map<string, { x: number; y: number }> = new Map();

    constructor(options: VisualConstructorOptions) {
        this.target = options.element;
        this.host = options.host;
        this.selectionManager = this.host.createSelectionManager();
        this.colorPalette = this.host.colorPalette;
        this.localizationManager = this.host.createLocalizationManager();
        this.events = options.host.eventService;
        this.formattingSettingsService = new FormattingSettingsService();
        this.handleHighContrastMode();
        this.settings = this.getDefaultSettings();
        this.initializeDOM();

        // Initialize drill state properties
        this.previousFieldCount = 0;
        this.currentDrillLevel = 0;
        this.maxDrillLevel = 0;
        this.isDrillMode = false;

        this.selectionManager.registerOnSelectCallback((ids: ISelectionId[]) => {
            this.handleExternalSelection(ids);
        });

        this.svg.addEventListener("contextmenu", (ev: MouseEvent) => {
            ev.preventDefault();
            this.selectionManager.showContextMenu({}, { x: ev.clientX, y: ev.clientY });
        });
    }

    public destroy(): void {
        // Clean up copy handler if it exists
        if (this.copyHandler) {
            document.removeEventListener('copy', this.copyHandler);
            this.copyHandler = null;
        }
    }

    private setupCustomCopyHandler(node: SankeyNode): void {
        // Remove any existing copy handler
        if (this.copyHandler) {
            document.removeEventListener('copy', this.copyHandler);
        }

        // Create new handler with node value
        this.copyHandler = (e: ClipboardEvent) => {
            if (e.clipboardData) {
                // Copy the actual display value, not the hash
                e.clipboardData.setData('text/plain', node.value);
                e.preventDefault();

                // Clean up after copy
                setTimeout(() => {
                    if (this.copyHandler) {
                        document.removeEventListener('copy', this.copyHandler);
                        this.copyHandler = null;
                    }
                }, 100);
            }
        };

        // Attach handler
        document.addEventListener('copy', this.copyHandler);

        // Also use Clipboard API for keyboard shortcut (Ctrl+C / Cmd+C)
        // This works even when Power BI's context menu doesn't trigger copy event
        const keyHandler = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                // Use Clipboard API to copy the node value
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(node.value).then(() => {
                        console.log('Copied node value:', node.value);
                    }).catch(err => {
                        console.warn('Failed to copy node value:', err);
                    });
                }
            }
        };

        // Attach keyboard handler
        document.addEventListener('keydown', keyHandler);

        // Clean up both handlers after 5 seconds
        setTimeout(() => {
            if (this.copyHandler) {
                document.removeEventListener('copy', this.copyHandler);
                this.copyHandler = null;
            }
            document.removeEventListener('keydown', keyHandler);
        }, 5000);
    }

    private handleHighContrastMode(): void {
        const colorPalette = this.host.colorPalette;
        if (colorPalette.isHighContrast) {
            this.isHighContrastMode = true;
            this.highContrastColors = {
                foreground: colorPalette.foreground?.value || "#000000",
                background: colorPalette.background?.value || "#ffffff",
                foregroundSelected: colorPalette.foregroundSelected?.value || "#0078d4",
                hyperlink: colorPalette.hyperlink?.value || "#0000ff"
            };
        } else {
            this.isHighContrastMode = false;
            this.highContrastColors = null;
        }
    }

    private handleExternalSelection(ids: ISelectionId[]): void {
        if (!this.allowInteractions) return;
        if (ids.length === 0) {
            this.resetHighlight();
            return;
        }
        this.selectedNodes.clear();
        this.applyHighlightEffect();
    }

    private selectRowsForSelectedNodes(): void {
        if (!this.allowInteractions) return;
        if (!this.currentData || this.selectedNodes.size === 0) {
            this.selectionManager.clear();
            return;
        }

        const matches: ISelectionId[] = [];
        const rows = this.currentData.rows;

        for (let r = 0; r < rows.length; r++) {
            let rowMatches = false;
            for (const selectedId of this.selectedNodes) {
                const selectedNode = this.nodes.get(selectedId);
                if (selectedNode) {
                    const v = this.normalizeValue(rows[r][selectedNode.levelIndex]);
                    if (v === selectedNode.value) {
                        rowMatches = true;
                        break;
                    }
                }
            }
            if (rowMatches) {
                const sel = this.rowSelectionByIndex.get(r);
                if (sel) matches.push(sel);
            }
        }

        if (matches.length) {
            this.selectionManager.select(matches, false);
        } else {
            this.selectionManager.clear();
        }
    }

    private getDefaultSettings(): SankeySettings {
        return {
            nodeWidth: 200,
            nodeHeight: 50,
            nodeShape: "roundedRect",
            cornerRadius: 8,
            nodeFillOpacity: 90,
            nodeBorderStyle: "solid",
            nodeBorderWidth: 2,
            useCustomBorderColor: true,
            nodeBorderColor: "#003B5C",
            levelSpacing: 280,
            nodeSpacing: 60,
            fontSize: 10,
            fontFamily: "Segoe UI",
            textAlignment: "center",
            textColor: this.isHighContrastMode && this.highContrastColors ? this.highContrastColors.foreground : "#ffffff",
            wrapText: true,
            maxCharsPerLine: 28,
            showValues: true,
            badgeTextSize: 8,
            badgeTextColor: this.isHighContrastMode && this.highContrastColors ? this.highContrastColors.foreground : "#000000",
            badgeFontFamily: "Segoe UI",
            badgePosition: "top-right",
            badgePaddingTop: 15,
            badgePaddingRight: 6,
            badgePaddingBottom: 0,
            badgePaddingLeft: 0,
            countMode: "out",
            showLabel: false,
            labelText: "",
            labelPosition: "top-left",
            labelFontSize: 10,
            labelPaddingTop: 0,
            labelPaddingRight: 0,
            labelPaddingBottom: 0,
            labelPaddingLeft: 0,
            lineOpacity: 30,
            linkWidth: 2,
            highlightOpacity: 80,
            linkStyle: "solid",
            linkColorMode: "gradient",
            customLinkColor: "#888888",
            linkCurveStyle: "bezier",
            showStartMarker: false,
            startMarkerType: "circle",
            startMarkerSize: 8,
            showEndMarker: true,
            endMarkerType: "arrow",
            endMarkerSize: 8,
            useCustomMarkerColors: false,
            startMarkerColor: "#0078D4",
            endMarkerColor: "#0078D4",
            colors: ["#0078D4", "#009CDC", "#106EBE", "#005A9E", "#74B4E7", "#004578", "#96C9F4", "#003B5C"],
            backgroundColor: "#FFFFFF",
            showEmptyPlaceholder: true,
            showCounters: true,
            headerCounterFontSize: 11,
            headerCounterFontFamily: "Segoe UI",
            headerCounterFontWeight: "bold",
            headerCounterAlignment: "left",
            headerCounterColor: "#000000",
            headerCounterSeparator: "|",
            headerTitleColor: this.isHighContrastMode && this.highContrastColors ? this.highContrastColors.foreground : "#000000",
            headerTitleMatchNode: false,
            headerTitleSize: 14,
            headerTitleFontFamily: "Segoe UI",
            showControls: true,

            fillType: "solid",
            borderType: "solid",
            showIcons: false,

            nodeShadowEnabled: true,
            nodeShadowColor: "#111111",
            nodeShadowOpacity: 10,
            nodeShadowBlur: 6,
            nodeShadowOffsetX: 0,
            nodeShadowOffsetY: 4,

            measureAggregation: "sum",
            measureDisplayMode: "badge",
            linkSizingMode: "fixed",
            linkMinWidth: 1,
            linkMaxWidth: 20,
            measureFormat: "auto",
            measureDecimals: 0
        };
    }

    private getPresetDefaults(presetId?: string): SankeySettings {
        // Build a fresh settings object for the given preset without mutating current state
        const originalSettings = this.settings;
        const baseDefaults = this.getDefaultSettings();
        const targetPreset = this.resolvePresetId(presetId ?? this.getCurrentStylePresetId());

        this.settings = { ...baseDefaults, colors: [...baseDefaults.colors] };
        this.applyStylePreset(targetPreset);

        const presetDefaults = { ...this.settings, colors: [...this.settings.colors] };
        this.settings = originalSettings;

        return presetDefaults;
    }

    private initializeDOM(): void {
        this.container = document.createElement("div");
        this.container.style.cssText = `
            width: 100%;
            height: 100%;
            overflow: hidden;
            position: relative;
        `;
        this.container.setAttribute("tabindex", "0");
        this.container.setAttribute("role", "application");
        this.container.setAttribute("aria-label", this.localizationManager.getDisplayName("Visual_LandingPage_Title") || "StreamLinks");

        this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        this.svg.style.cssText = "width: 100%; height: 100%; display: block;";
        this.svg.setAttribute("role", "img");
        this.svg.setAttribute("aria-label", "StreamLinks visualization");

        this.defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
        this.svg.appendChild(this.defs);

        this.fixedHeader = document.createElementNS("http://www.w3.org/2000/svg", "g");
        this.fixedHeader.setAttribute("class", "fixed-header");

        this.mainGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        this.mainGroup.setAttribute("id", "mainGroup");

        this.svg.appendChild(this.fixedHeader);
        this.svg.appendChild(this.mainGroup);
        this.container.appendChild(this.svg);
        this.target.appendChild(this.container);

        this.svg.addEventListener("mousedown", (e) => this.handleMouseDown(e));
        this.svg.addEventListener("mousemove", (e) => this.handleMouseMove(e));
        this.svg.addEventListener("mouseup", () => this.handleMouseUp());
        this.svg.addEventListener("mouseleave", () => this.handleMouseUp());
        this.svg.addEventListener("wheel", (e) => this.handleWheel(e));
        this.svg.addEventListener("click", (e) => {
            if (e.target !== this.svg) return;
            if (this.movedDuringPan) return;
            const now = performance.now();
            if (now - this.lastBgClickAt <= 300) {
                this.resetHighlight();
            }
            this.lastBgClickAt = now;
        });
        this.container.addEventListener("keydown", (e) => this.handleKeyDown(e));
    }

    private handleKeyDown(e: KeyboardEvent): void {
        if (!this.allowInteractions) return;
        const nodeIds = Array.from(this.nodes.keys());
        if (nodeIds.length === 0) return;

        switch (e.key) {
            case "Tab":
                e.preventDefault();
                this.navigateNodes(e.shiftKey ? -1 : 1);
                break;
            case "ArrowRight":
                e.preventDefault();
                this.navigateToNextLevel(1);
                break;
            case "ArrowLeft":
                e.preventDefault();
                this.navigateToNextLevel(-1);
                break;
            case "ArrowDown":
                e.preventDefault();
                this.navigateWithinLevel(1);
                break;
            case "ArrowUp":
                e.preventDefault();
                this.navigateWithinLevel(-1);
                break;
            case "Enter":
            case " ":
                e.preventDefault();
                if (this.focusedNodeId) {
                    this.highlightConnections(this.focusedNodeId, e.ctrlKey);
                    this.selectRowsForSelectedNodes();
                }
                break;
            case "Escape":
                e.preventDefault();
                this.resetHighlight();
                this.focusedNodeId = null;
                this.updateFocusVisual();
                break;
        }
    }

    private navigateNodes(direction: number): void {
        const nodeIds = Array.from(this.nodes.keys());
        if (nodeIds.length === 0) return;
        if (!this.focusedNodeId) {
            this.focusedNodeId = nodeIds[0];
        } else {
            const currentIndex = nodeIds.indexOf(this.focusedNodeId);
            const newIndex = (currentIndex + direction + nodeIds.length) % nodeIds.length;
            this.focusedNodeId = nodeIds[newIndex];
        }
        this.updateFocusVisual();
    }

    private navigateToNextLevel(direction: number): void {
        if (!this.focusedNodeId || !this.currentData) return;
        const currentNode = this.nodes.get(this.focusedNodeId);
        if (!currentNode) return;
        const targetLevel = currentNode.levelIndex + direction;
        if (targetLevel < 0 || targetLevel >= this.currentData.columns.length) return;
        for (const [id, node] of this.nodes) {
            if (node.levelIndex === targetLevel) {
                this.focusedNodeId = id;
                this.updateFocusVisual();
                break;
            }
        }
    }

    private navigateWithinLevel(direction: number): void {
        if (!this.focusedNodeId) return;
        const currentNode = this.nodes.get(this.focusedNodeId);
        if (!currentNode) return;
        const levelNodes = Array.from(this.nodes.values())
            .filter(n => n.levelIndex === currentNode.levelIndex)
            .sort((a, b) => a.y - b.y);
        const currentIndex = levelNodes.findIndex(n => n.id === this.focusedNodeId);
        const newIndex = (currentIndex + direction + levelNodes.length) % levelNodes.length;
        this.focusedNodeId = levelNodes[newIndex].id;
        this.updateFocusVisual();
    }

    private updateFocusVisual(): void {
        this.nodeElements.forEach((el) => {
            el.classList.remove("focused");
            const shape = el.querySelector(".node-shape");
            if (shape) shape.removeAttribute("stroke-dasharray");
        });
        if (this.focusedNodeId) {
            const focusedElement = this.nodeElements.get(this.focusedNodeId);
            if (focusedElement) {
                focusedElement.classList.add("focused");
                const shape = focusedElement.querySelector(".node-shape");
                if (shape) {
                    shape.setAttribute("stroke-dasharray", "4,2");
                    shape.setAttribute("stroke-width", "3");
                }
                const node = this.nodes.get(this.focusedNodeId);
                if (node) {
                    this.announceToScreenReader(`${node.value}, ${node.level}, ${node.count} connections`);
                }
            }
        }
    }

    private announceToScreenReader(message: string): void {
        const announcement = document.createElement("div");
        announcement.setAttribute("aria-live", "polite");
        announcement.setAttribute("aria-atomic", "true");
        announcement.style.cssText = "position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden;";
        announcement.textContent = message;
        this.container.appendChild(announcement);
        setTimeout(() => announcement.remove(), 1000);
    }

    private handleMouseDown(e: MouseEvent): void {
        if (e.target === this.svg || (e.target as Element).closest("#mainGroup")) {
            this.isPanning = true;
            this.movedDuringPan = false;
            this.startPanX = e.clientX - this.translateX;
            this.startPanY = e.clientY - this.translateY;
            this.svg.style.cursor = "grabbing";
        }
    }

    private handleMouseMove(e: MouseEvent): void {
        if (this.isPanning) {
            this.movedDuringPan = true;
            this.translateX = e.clientX - this.startPanX;
            this.translateY = Math.min(75, e.clientY - this.startPanY);
            this.updateTransform();
        }
    }

    private handleMouseUp(): void {
        this.isPanning = false;
        this.svg.style.cursor = "default";
    }

    private handleWheel(e: WheelEvent): void {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        this.zoomScale = Math.max(0.05, Math.min(8, this.zoomScale * delta));
        this.updateTransform();
    }

    private updateTransform(): void {
        this.mainGroup.setAttribute("transform", `translate(${this.translateX},${this.translateY}) scale(${this.zoomScale})`);
    }

    private handleLandingPage(options: VisualUpdateOptions): boolean {
        if (!options.dataViews || !options.dataViews[0] || !options.dataViews[0].table || options.dataViews[0].table.rows.length === 0) {
            if (!this.isLandingPageOn) {
                this.isLandingPageOn = true;
                this.renderLandingPage();
            }
            return true;
        }
        if (this.isLandingPageOn) {
            this.isLandingPageOn = false;
            this.removeLandingPage();
        }
        return false;
    }

    private renderLandingPage(): void {
        this.removeLandingPage();
        const title = this.localizationManager.getDisplayName("Visual_LandingPage_Title") || "StreamLinks";
        const description = this.localizationManager.getDisplayName("Visual_LandingPage_Description") || "Add hierarchy levels to the data field to visualize connections and data flow.";
        this.landingPageElement = document.createElement("div");
        this.landingPageElement.style.cssText = `display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 20px; text-align: center; color: ${this.isHighContrastMode && this.highContrastColors ? this.highContrastColors.foreground : '#666'}; font-family: "Segoe UI", sans-serif;`;
        const icon = document.createElement("div");
        icon.style.cssText = "font-size: 48px; margin-bottom: 16px; opacity: 0.6;";
        icon.textContent = "📊";
        const titleEl = document.createElement("h2");
        titleEl.style.cssText = `margin: 0 0 8px 0; font-size: 18px; font-weight: 600; color: ${this.isHighContrastMode && this.highContrastColors ? this.highContrastColors.foreground : '#333'};`;
        titleEl.textContent = title;
        const descEl = document.createElement("p");
        descEl.style.cssText = "margin: 0; font-size: 14px; max-width: 300px;";
        descEl.textContent = description;
        this.landingPageElement.appendChild(icon);
        this.landingPageElement.appendChild(titleEl);
        this.landingPageElement.appendChild(descEl);
        this.container.appendChild(this.landingPageElement);
        this.svg.style.display = "none";
    }

    private removeLandingPage(): void {
        if (this.landingPageElement) {
            this.landingPageElement.remove();
            this.landingPageElement = null;
        }
        this.svg.style.display = "block";
    }

    public update(options: VisualUpdateOptions): void {
        this.events.renderingStarted(options);
        try {
            const editMode = (options as any).editMode;
            this.allowInteractions = editMode === undefined || editMode === 0;
            this.handleHighContrastMode();
            const dataView = options.dataViews?.[0];
            if (this.handleLandingPage(options)) {
                this.events.renderingFinished(options);
                return;
            }
            if (!dataView) {
                this.renderEmptyState();
                this.events.renderingFinished(options);
                return;
            }

            // Detect drill state and field changes
            const metadata = dataView?.metadata;
            const categoryMetadata = metadata?.columns?.filter(c => c.roles?.['group']);
            const currentFieldCount = categoryMetadata?.length || 0;
            const isInFocus = (options as any).isInFocus || false;

            // Track field count changes
            this.previousFieldCount = currentFieldCount;
            this.maxDrillLevel = currentFieldCount - 1;

            // Track drill mode state (set by Power BI's drill buttons)
            this.isDrillMode = isInFocus;

            // When in drill mode, track the current drill level
            // When NOT in drill mode, show all levels (auto-expand behavior)
            if (!this.isDrillMode) {
                this.currentDrillLevel = this.maxDrillLevel; // Show all levels
            }

            this.formattingSettings = this.formattingSettingsService.populateFormattingSettingsModel(VisualFormattingSettingsModel, dataView);
            this.updateSettingsFromModel(dataView);

            // Extract measure data
            this.measureData = this.extractMeasureData(dataView);
            this.hasMeasure = this.measureData !== null;
            if (this.measureData) {
                this.measureData.aggregationMethod = this.settings.measureAggregation;
            }
            this.validateMeasureData();

            // Apply background color
            this.container.style.backgroundColor = this.isHighContrastMode && this.highContrastColors
                ? this.highContrastColors.background
                : this.settings.backgroundColor;

            this.rowSelectionByIndex.clear();
            this.nodeSelectionById.clear();
            if (dataView.table) {
                for (let r = 0; r < dataView.table.rows.length; r++) {
                    const sel = this.host.createSelectionIdBuilder().withTable(dataView.table, r).createSelectionId();
                    this.rowSelectionByIndex.set(r, sel);
                }
            }
            const tableData = this.extractData(options.dataViews);
            if (tableData && tableData.rows.length > 0) {
                this.currentData = tableData;
                this.processData(tableData, dataView);
                // Store viewport dimensions for potential re-renders
                this.lastViewportWidth = options.viewport.width;
                this.lastViewportHeight = options.viewport.height;
                this.render(options.viewport.width, options.viewport.height);
                if (tableData.highlights) {
                    this.applyHighlightData(tableData.highlights);
                }
            } else {
                this.renderEmptyState();
            }
            this.events.renderingFinished(options);
        } catch (error) {
            console.error("Error updating visual:", error);
            const errorMessage = error && (error as any).message ? (error as any).message : String(error);
            this.renderError(errorMessage);
            this.events.renderingFailed(options);
        }
    }

    private applyHighlightData(highlights: any[][]): void {
        const hasHighlights = highlights.some(row => row.some(cell => cell !== null));
        if (!hasHighlights) return;
        const allNodes = this.mainGroup.querySelectorAll(".node");
        allNodes.forEach(node => {
            const id = node.getAttribute("data-node-id");
            if (id) {
                const nodeData = this.nodes.get(id);
                if (nodeData && !nodeData.highlighted) {
                    const shape = node.querySelector(".node-shape");
                    const texts = node.querySelectorAll("text");
                    const circles = node.querySelectorAll("circle");
                    if (shape) shape.setAttribute("opacity", "0.3");
                    texts.forEach(t => t.setAttribute("opacity", "0.4"));
                    circles.forEach(c => c.setAttribute("opacity", "0.4"));
                }
            }
        });
    }

    private applyStylePreset(presetValue: string): void {
        const preserveShowControls = this.settings.showControls;
        const preserveShowCounters = this.settings.showCounters;

        // Base defaults for text and badge readability across presets
        this.settings.textColor = "#ffffff";
        this.settings.badgeTextColor = "#000000";
        this.settings.headerTitleColor = "#000000";

        switch (presetValue) {
            case "professionalBlue":
                // Professional Blue - Clean, corporate, Microsoft-inspired
                this.settings.colors = ["#0078D4", "#009CDC", "#106EBE", "#005A9E", "#74B4E7", "#004578", "#96C9F4", "#003B5C"];
                this.settings.nodeShape = "roundedRect";
                this.settings.cornerRadius = 8;
                this.settings.nodeFillOpacity = 90;
                this.settings.nodeBorderStyle = "none";
                this.settings.nodeBorderWidth = 0;
                this.settings.useCustomBorderColor = false;
                this.settings.nodeBorderColor = "#003B5C";
                this.settings.textColor = "#ffffff";
                this.settings.fontSize = 10;
                this.settings.fontFamily = "Segoe UI";
                this.settings.nodeHeight = 50;
                this.settings.nodeSpacing = 60;
                this.settings.levelSpacing = 280;
                this.settings.linkCurveStyle = "bezier";
                this.settings.linkColorMode = "gradient";
                this.settings.lineOpacity = 30;
                this.settings.linkWidth = 2;
                this.settings.linkStyle = "solid";
                this.settings.showStartMarker = false;
                this.settings.showEndMarker = true;
                this.settings.endMarkerType = "arrow";
                this.settings.endMarkerSize = 8;
                this.settings.useCustomMarkerColors = false;
                this.settings.badgeTextColor = "#000000";
                this.settings.headerTitleColor = "#000000";
                this.settings.showControls = true;
                this.settings.showValues = true;
                this.settings.measureAggregation = "sum";
                this.settings.measureDisplayMode = "badge";
                this.settings.linkSizingMode = "fixed";
                this.settings.linkMinWidth = 1;
                this.settings.linkMaxWidth = 20;
                this.settings.measureFormat = "auto";
                this.settings.measureDecimals = 0;
                break;

            case "vibrantSpectrum":
                // Vibrant Spectrum - Eye-catching, diverse, rainbow progression
                this.settings.colors = ["#E74856", "#FF8C00", "#FFB900", "#00CC6A", "#00B7C3", "#0078D4", "#8764B8", "#E3008C"];
                this.settings.nodeShape = "pill";
                this.settings.nodeFillOpacity = 95;
                this.settings.nodeBorderStyle = "none";
                this.settings.nodeBorderWidth = 0;
                this.settings.useCustomBorderColor = false;
                this.settings.nodeBorderColor = "#000000";
                this.settings.textColor = "#ffffff";
                this.settings.fontSize = 11;
                this.settings.fontFamily = "Segoe UI";
                this.settings.nodeHeight = 50;
                this.settings.nodeSpacing = 60;
                this.settings.levelSpacing = 280;
                this.settings.linkCurveStyle = "bezier";
                this.settings.linkColorMode = "source";
                this.settings.lineOpacity = 35;
                this.settings.linkWidth = 2.5;
                this.settings.linkStyle = "solid";
                this.settings.showStartMarker = false;
                this.settings.showEndMarker = true;
                this.settings.endMarkerType = "arrow";
                this.settings.endMarkerSize = 8;
                this.settings.useCustomMarkerColors = false;
                this.settings.badgeTextColor = "#000000";
                this.settings.headerTitleColor = "#000000";
                this.settings.showControls = true;
                this.settings.showValues = true;
                this.settings.measureAggregation = "sum";
                this.settings.measureDisplayMode = "badge";
                this.settings.linkSizingMode = "fixed";
                this.settings.linkMinWidth = 1;
                this.settings.linkMaxWidth = 20;
                this.settings.measureFormat = "auto";
                this.settings.measureDecimals = 0;
                break;

            case "neon":
                // Neon Dark Mode - Dark background-friendly, glowing effect
                this.settings.colors = ["#00F5FF", "#39FF14", "#FF10F0", "#00D1FF", "#FF006E", "#8A2BE2", "#FF4500", "#00FFFF"];
                this.settings.nodeShape = "pill";
                this.settings.nodeFillOpacity = 90;
                this.settings.nodeBorderStyle = "none";
                this.settings.nodeBorderWidth = 0;
                this.settings.useCustomBorderColor = false;
                this.settings.textColor = "#ffffff";
                this.settings.fontSize = 10;
                this.settings.fontFamily = "Segoe UI";
                this.settings.nodeHeight = 50;
                this.settings.nodeSpacing = 80;
                this.settings.levelSpacing = 320;
                this.settings.linkCurveStyle = "bezier";
                this.settings.linkColorMode = "gradient";
                this.settings.lineOpacity = 80;
                this.settings.highlightOpacity = 95;
                this.settings.linkWidth = 2.5;
                this.settings.linkStyle = "solid";
                this.settings.showStartMarker = false;
                this.settings.startMarkerType = "arrow";
                this.settings.startMarkerSize = 8;
                this.settings.showEndMarker = true;
                this.settings.endMarkerType = "arrow";
                this.settings.endMarkerSize = 8;
                this.settings.useCustomMarkerColors = false;
                this.settings.badgeTextColor = "#000000";
                this.settings.headerTitleColor = "#ffffff";
                this.settings.headerCounterColor = "#ffffff";
                this.settings.showControls = true;
                this.settings.showValues = true;
                this.settings.measureAggregation = "sum";
                this.settings.measureDisplayMode = "badge";
                this.settings.linkSizingMode = "fixed";
                this.settings.linkMinWidth = 1;
                this.settings.linkMaxWidth = 20;
                this.settings.measureFormat = "auto";
                this.settings.measureDecimals = 0;
                break;

            case "pastel":
                // Pastel Soft - Gentle, easy on eyes, dashboard-friendly
                this.settings.colors = ["#B39DDB", "#90CAF9", "#80CBC4", "#A5D6A7", "#FFF59D", "#FFAB91", "#F48FB1", "#CE93D8"];
                this.settings.nodeShape = "pill";
                this.settings.nodeFillOpacity = 75;
                this.settings.nodeBorderStyle = "none";
                this.settings.nodeBorderWidth = 0;
                this.settings.useCustomBorderColor = false;
                this.settings.nodeBorderColor = "#9E9E9E";
                this.settings.textColor = "#000000";
                this.settings.fontSize = 10;
                this.settings.fontFamily = "Segoe UI";
                this.settings.nodeHeight = 50;
                this.settings.nodeSpacing = 60;
                this.settings.levelSpacing = 280;
                this.settings.linkCurveStyle = "bezier";
                this.settings.linkColorMode = "gradient";
                this.settings.lineOpacity = 35;
                this.settings.linkWidth = 2.0;
                this.settings.linkStyle = "solid";
                this.settings.showStartMarker = true;
                this.settings.startMarkerType = "circle";
                this.settings.startMarkerSize = 8;
                this.settings.showEndMarker = true;
                this.settings.endMarkerType = "circle";
                this.settings.endMarkerSize = 8;
                this.settings.useCustomMarkerColors = false;
                this.settings.showControls = true;
                this.settings.showValues = true;
                this.settings.measureAggregation = "sum";
                this.settings.measureDisplayMode = "badge";
                this.settings.linkSizingMode = "fixed";
                this.settings.linkMinWidth = 1;
                this.settings.linkMaxWidth = 20;
                this.settings.measureFormat = "auto";
                this.settings.measureDecimals = 0;
                break;

            case "angularTech":
                // Angular Tech - Sharp, geometric, tech-forward
                this.settings.colors = ["#00BCD4", "#009688", "#4CAF50", "#8BC34A", "#CDDC39", "#FFC107", "#FF9800", "#FF5722"];
                this.settings.nodeShape = "rectangle";
                this.settings.cornerRadius = 0;
                this.settings.nodeFillOpacity = 92;
                this.settings.nodeBorderStyle = "none";
                this.settings.nodeBorderWidth = 0;
                this.settings.useCustomBorderColor = false;
                this.settings.nodeBorderColor = "#263238";
                this.settings.textColor = "#ffffff";
                this.settings.fontSize = 10;
                this.settings.fontFamily = "Consolas";
                this.settings.nodeHeight = 48;
                this.settings.nodeSpacing = 55;
                this.settings.levelSpacing = 270;
                this.settings.linkCurveStyle = "step";
                this.settings.linkColorMode = "target";
                this.settings.lineOpacity = 40;
                this.settings.linkWidth = 2;
                this.settings.linkStyle = "solid";
                this.settings.showStartMarker = false;
                this.settings.startMarkerType = "circle";
                this.settings.startMarkerSize = 8;
                this.settings.showEndMarker = true;
                this.settings.endMarkerType = "arrow";
                this.settings.endMarkerSize = 8;
                this.settings.useCustomMarkerColors = false;
                this.settings.showControls = true;
                this.settings.showValues = true;
                this.settings.measureAggregation = "sum";
                this.settings.measureDisplayMode = "badge";
                this.settings.linkSizingMode = "fixed";
                this.settings.linkMinWidth = 1;
                this.settings.linkMaxWidth = 20;
                this.settings.measureFormat = "auto";
                this.settings.measureDecimals = 0;
                break;

            case "gradientFlow":
                // Gradient Flow - Smooth color transitions, modern aesthetic
                this.settings.colors = ["#667EEA", "#764BA2", "#F093FB", "#4FACFE", "#00F2FE", "#43E97B", "#38F9D7", "#FA709A"];
                this.settings.nodeShape = "pill";
                this.settings.nodeFillOpacity = 88;
                this.settings.nodeBorderStyle = "none";
                this.settings.nodeBorderWidth = 0;
                this.settings.useCustomBorderColor = false;
                this.settings.textColor = "#ffffff";
                this.settings.fontSize = 10;
                this.settings.fontFamily = "Segoe UI";
                this.settings.nodeHeight = 52;
                this.settings.nodeSpacing = 70;
                this.settings.levelSpacing = 300;
                this.settings.linkCurveStyle = "bezier";
                this.settings.linkColorMode = "gradient";
                this.settings.lineOpacity = 50;
                this.settings.linkWidth = 2.5;
                this.settings.linkStyle = "solid";
                this.settings.showStartMarker = false;
                this.settings.showEndMarker = true;
                this.settings.endMarkerType = "arrow";
                this.settings.endMarkerSize = 8;
                this.settings.useCustomMarkerColors = false;
                this.settings.showControls = true;
                this.settings.showValues = true;
                this.settings.headerTitleColor = "#ffffff";
                this.settings.headerCounterColor = "#ffffff";
                this.settings.measureAggregation = "sum";
                this.settings.measureDisplayMode = "badge";
                this.settings.linkSizingMode = "fixed";
                this.settings.linkMinWidth = 1;
                this.settings.linkMaxWidth = 20;
                this.settings.measureFormat = "auto";
                this.settings.measureDecimals = 0;
                break;

            case "midnightPro":
                // Midnight Pro - Deep indigos, SaaS dark-mode inspired
                this.settings.colors = ["#5E6AD2", "#8B5CF6", "#3B82F6", "#6366F1", "#2563EB", "#1D4ED8", "#1E40AF", "#1E3A8A"];
                this.settings.nodeShape = "roundedRect";
                this.settings.cornerRadius = 6;
                this.settings.nodeFillOpacity = 100;
                this.settings.nodeBorderStyle = "none";
                this.settings.nodeBorderWidth = 0;
                this.settings.useCustomBorderColor = false;
                this.settings.nodeBorderColor = "#4338CA";
                this.settings.textColor = "#ffffff";
                this.settings.fontSize = 11;
                this.settings.fontFamily = "Inter, sans-serif";
                this.settings.nodeHeight = 46;
                this.settings.nodeSpacing = 60;
                this.settings.levelSpacing = 280;
                this.settings.linkCurveStyle = "bezier";
                this.settings.linkColorMode = "gradient";
                this.settings.lineOpacity = 40;
                this.settings.linkWidth = 1.5;
                this.settings.linkStyle = "solid";
                this.settings.showStartMarker = false;
                this.settings.showEndMarker = true;
                this.settings.endMarkerType = "arrow";
                this.settings.endMarkerSize = 8;
                this.settings.useCustomMarkerColors = false;
                this.settings.showControls = true;
                this.settings.showValues = true;
                this.settings.headerTitleColor = "#ffffff";
                this.settings.headerCounterColor = "#ffffff";
                this.settings.measureAggregation = "sum";
                this.settings.measureDisplayMode = "badge";
                this.settings.linkSizingMode = "fixed";
                this.settings.linkMinWidth = 1;
                this.settings.linkMaxWidth = 20;
                this.settings.measureFormat = "auto";
                this.settings.measureDecimals = 0;
                break;

            case "popArt":
                // Pop Art - Bold, playful colors and heavy outlines
                this.settings.colors = ["#FF4785", "#1EA7FD", "#00C6BA", "#FFA600", "#6F2CAC", "#2D2D2D", "#FF005C", "#F9C80E"];
                this.settings.nodeShape = "roundedRect";
                this.settings.cornerRadius = 12;
                this.settings.nodeFillOpacity = 100;
                this.settings.nodeBorderStyle = "solid";
                this.settings.nodeBorderWidth = 1;
                this.settings.useCustomBorderColor = true;
                this.settings.nodeBorderColor = "#000000";
                this.settings.textColor = "#ffffff";
                this.settings.fontSize = 12;
                this.settings.fontFamily = "Quicksand, sans-serif";
                this.settings.nodeHeight = 54;
                this.settings.nodeSpacing = 65;
                this.settings.levelSpacing = 280;
                this.settings.linkCurveStyle = "bezier";
                this.settings.linkColorMode = "source";
                this.settings.lineOpacity = 100;
                this.settings.linkWidth = 2.5;
                this.settings.linkStyle = "solid";
                this.settings.showStartMarker = false;
                this.settings.showEndMarker = true;
                this.settings.endMarkerType = "arrow";
                this.settings.endMarkerSize = 8;
                this.settings.useCustomMarkerColors = false;
                this.settings.showControls = true;
                this.settings.showValues = true;
                this.settings.measureAggregation = "sum";
                this.settings.measureDisplayMode = "badge";
                this.settings.linkSizingMode = "fixed";
                this.settings.linkMinWidth = 1;
                this.settings.linkMaxWidth = 20;
                this.settings.measureFormat = "auto";
                this.settings.measureDecimals = 0;
                break;

            case "cyberDeck":
                // Cyber Deck - Neon wireframe, techy edges
                this.settings.colors = ["#00FF94", "#FF0055", "#00E5FF", "#BD00FF", "#F7DF1E", "#FF5F1F", "#00FF00", "#FF0099"];
                this.settings.nodeShape = "roundedRect";
                this.settings.cornerRadius = 0;
                this.settings.nodeFillOpacity = 10;
                this.settings.nodeBorderStyle = "solid";
                this.settings.nodeBorderWidth = 1;
                this.settings.useCustomBorderColor = true;
                this.settings.nodeBorderColor = "#00FF94";
                this.settings.textColor = "#ffffff";
                this.settings.fontSize = 10;
                this.settings.fontFamily = "JetBrains Mono, monospace";
                this.settings.nodeHeight = 44;
                this.settings.nodeSpacing = 80;
                this.settings.levelSpacing = 320;
                this.settings.linkCurveStyle = "step";
                this.settings.linkColorMode = "target";
                this.settings.lineOpacity = 60;
                this.settings.linkWidth = 1.0;
                this.settings.linkStyle = "solid";
                this.settings.showStartMarker = false;
                this.settings.startMarkerType = "square";
                this.settings.startMarkerSize = 8;
                this.settings.showEndMarker = true;
                this.settings.endMarkerType = "arrow";
                this.settings.endMarkerSize = 8;
                this.settings.useCustomMarkerColors = true;
                this.settings.startMarkerColor = this.settings.nodeBorderColor;
                this.settings.endMarkerColor = this.settings.nodeBorderColor;
                this.settings.showControls = true;
                this.settings.showValues = true;
                this.settings.headerTitleColor = "#ffffff";
                this.settings.headerCounterColor = "#ffffff";
                break;

            case "auroraFlow":
                // Aurora Flow - Vibrant gradients, smooth flow
                this.settings.colors = ["#845EC2", "#D65DB1", "#FF6F91", "#FF9671", "#FFC75F", "#F9F871", "#0081CF", "#00C9A7"];
                this.settings.nodeShape = "pill";
                this.settings.cornerRadius = 20;
                this.settings.nodeFillOpacity = 100;
                this.settings.nodeBorderStyle = "none";
                this.settings.nodeBorderWidth = 0;
                this.settings.useCustomBorderColor = false;
                this.settings.textColor = "#ffffff";
                this.settings.fontSize = 11;
                this.settings.fontFamily = "Montserrat, sans-serif";
                this.settings.nodeHeight = 52;
                this.settings.nodeSpacing = 70;
                this.settings.levelSpacing = 300;
                this.settings.linkCurveStyle = "bezier";
                this.settings.linkColorMode = "gradient";
                this.settings.lineOpacity = 50;
                this.settings.linkWidth = 4;
                this.settings.linkStyle = "solid";
                this.settings.showStartMarker = false;
                this.settings.showEndMarker = false;
                this.settings.useCustomMarkerColors = false;
                this.settings.showControls = true;
                this.settings.showValues = true;
                this.settings.measureAggregation = "sum";
                this.settings.measureDisplayMode = "badge";
                this.settings.linkSizingMode = "fixed";
                this.settings.linkMinWidth = 1;
                this.settings.linkMaxWidth = 20;
                this.settings.measureFormat = "auto";
                this.settings.measureDecimals = 0;
                break;

            case "offwhite":
                // Offwhite - Clean neutral palette with black borders and links
                this.settings.colors = ["#FFFFFF", "#F9F9F9", "#F2F2F2", "#EDEDED", "#E5E5E5", "#DDDDDD", "#D5D5D5", "#CDCDCD"];
                this.settings.nodeShape = "roundedRect";
                this.settings.cornerRadius = 8;
                this.settings.nodeFillOpacity = 100;
                this.settings.nodeBorderStyle = "solid";
                this.settings.nodeBorderWidth = 2;
                this.settings.useCustomBorderColor = true;
                this.settings.nodeBorderColor = "#000000";
                this.settings.textColor = "#000000";
                this.settings.fontSize = 11;
                this.settings.fontFamily = "Segoe UI, -apple-system, BlinkMacSystemFont, sans-serif";
                this.settings.nodeHeight = 50;
                this.settings.nodeSpacing = 60;
                this.settings.levelSpacing = 280;
                this.settings.linkCurveStyle = "bezier";
                this.settings.linkColorMode = "custom";
                this.settings.customLinkColor = "#555555";
                this.settings.lineOpacity = 60;
                this.settings.linkWidth = 2;
                this.settings.linkStyle = "solid";
                this.settings.showStartMarker = false;
                this.settings.showEndMarker = true;
                this.settings.endMarkerType = "arrow";
                this.settings.endMarkerSize = 8;
                this.settings.useCustomMarkerColors = true;
                this.settings.endMarkerColor = "#555555";
                this.settings.badgeTextColor = "#000000";
                this.settings.badgeFontFamily = "Segoe UI, -apple-system, BlinkMacSystemFont, sans-serif";
                this.settings.showControls = preserveShowControls;
                this.settings.showCounters = preserveShowCounters;
                this.settings.showValues = true;
                this.settings.measureAggregation = "sum";
                this.settings.measureDisplayMode = "badge";
                this.settings.linkSizingMode = "fixed";
                this.settings.linkMinWidth = 1;
                this.settings.linkMaxWidth = 20;
                this.settings.measureFormat = "auto";
                this.settings.measureDecimals = 0;
                break;

            case "modernApp":
                this.settings.colors = ["#3B82F6", "#10B981", "#8B5CF6", "#F59E0B", "#EF4444", "#EC4899"];
                this.settings.nodeShape = "pill";
                this.settings.cornerRadius = 12;
                this.settings.nodeHeight = 50;
                this.settings.nodeSpacing = 60;
                this.settings.nodeFillOpacity = 100;
                this.settings.nodeBorderStyle = "none";
                this.settings.nodeBorderWidth = 0;
                this.settings.lineOpacity = 40;
                this.settings.linkWidth = 2;
                this.settings.textColor = "#ffffff";
                this.settings.fontSize = 11;
                this.settings.fontFamily = "Inter, sans-serif";

                // Modern Features - Default Modern
                this.settings.fillType = "gradient";
                this.settings.borderType = "solid";
                this.settings.showIcons = false;

                this.settings.linkColorMode = "gradient";
                this.settings.showValues = true;
                this.settings.badgePosition = "top-right";
                this.settings.badgeTextSize = 10;
                this.settings.showControls = preserveShowControls;
                this.settings.showCounters = preserveShowCounters;
                this.settings.measureAggregation = "sum";
                this.settings.measureDisplayMode = "badge";
                this.settings.linkSizingMode = "fixed";
                this.settings.linkMinWidth = 1;
                this.settings.linkMaxWidth = 20;
                this.settings.measureFormat = "auto";
                this.settings.measureDecimals = 0;
                break;
            case "gradientPill":
                this.settings.colors = ["#D946EF", "#8B5CF6", "#6366F1"];
                this.settings.nodeShape = "pill";
                this.settings.cornerRadius = 0;
                this.settings.nodeFillOpacity = 100;
                this.settings.nodeBorderWidth = 0;
                this.settings.nodeBorderStyle = "none";
                this.settings.textColor = "#FFFFFF";
                this.settings.fontFamily = "Inter, sans-serif";
                this.settings.nodeHeight = 50;
                this.settings.fillType = "gradient";
                this.settings.borderType = "solid";
                this.settings.linkCurveStyle = "bezier";
                this.settings.linkColorMode = "gradient";
                this.settings.lineOpacity = 50;
                this.settings.linkWidth = 2;
                this.settings.linkStyle = "solid";
                this.settings.showStartMarker = false;
                this.settings.showEndMarker = true;
                this.settings.endMarkerType = "arrow";
                this.settings.endMarkerSize = 8;
                this.settings.levelSpacing = 280;
                this.settings.nodeSpacing = 60;
                this.settings.showControls = preserveShowControls;
                this.settings.showCounters = preserveShowCounters;
                this.settings.measureAggregation = "sum";
                this.settings.measureDisplayMode = "badge";
                this.settings.linkSizingMode = "fixed";
                this.settings.linkMinWidth = 1;
                this.settings.linkMaxWidth = 20;
                this.settings.measureFormat = "auto";
                this.settings.measureDecimals = 0;
                break;
            case "outlinedGradient":
                this.settings.colors = ["#D946EF", "#8B5CF6", "#6366F1"];
                this.settings.nodeShape = "pill";
                this.settings.cornerRadius = 0;
                this.settings.nodeFillOpacity = 100;
                this.settings.nodeBorderWidth = 2;
                this.settings.nodeBorderStyle = "solid";
                this.settings.useCustomBorderColor = true;
                this.settings.nodeBorderColor = "transparent";
                this.settings.textColor = "#6366F1";
                this.settings.fontFamily = "Inter, sans-serif";
                this.settings.nodeHeight = 50;
                this.settings.fillType = "solid";
                this.settings.fillColorOverride = "#FFFFFF";
                this.settings.borderType = "gradient";
                this.settings.linkCurveStyle = "bezier";
                this.settings.linkColorMode = "gradient";
                this.settings.lineOpacity = 40;
                this.settings.linkWidth = 2;
                this.settings.linkStyle = "solid";
                this.settings.showStartMarker = false;
                this.settings.showEndMarker = true;
                this.settings.endMarkerType = "arrow";
                this.settings.endMarkerSize = 8;
                this.settings.levelSpacing = 280;
                this.settings.nodeSpacing = 60;
                this.settings.showControls = preserveShowControls;
                this.settings.showCounters = preserveShowCounters;
                this.settings.measureAggregation = "sum";
                this.settings.measureDisplayMode = "badge";
                this.settings.linkSizingMode = "fixed";
                this.settings.linkMinWidth = 1;
                this.settings.linkMaxWidth = 20;
                this.settings.measureFormat = "auto";
                this.settings.measureDecimals = 0;
                break;

            case "softWhite":
                this.settings.colors = ["#8B5CF6", "#6366F1"];
                this.settings.nodeShape = "pill";
                this.settings.cornerRadius = 0;
                this.settings.nodeFillOpacity = 100;
                this.settings.nodeBorderWidth = 1.5;
                this.settings.nodeBorderStyle = "solid";
                this.settings.useCustomBorderColor = true;
                this.settings.nodeBorderColor = "#E5E7EB";
                this.settings.textColor = "#5B6DE2";
                this.settings.fontFamily = "Inter, sans-serif";
                this.settings.nodeHeight = 50;
                this.settings.fillType = "solid";
                this.settings.fillColorOverride = "#FFFFFF";
                this.settings.borderType = "solid";
                this.settings.linkCurveStyle = "bezier";
                this.settings.linkColorMode = "source";
                this.settings.lineOpacity = 50;
                this.settings.linkWidth = 2.5;
                this.settings.linkStyle = "solid";
                this.settings.showStartMarker = false;
                this.settings.showEndMarker = true;
                this.settings.endMarkerType = "arrow";
                this.settings.endMarkerSize = 8;
                this.settings.levelSpacing = 280;
                this.settings.nodeSpacing = 60;
                this.settings.showControls = preserveShowControls;
                this.settings.showCounters = preserveShowCounters;
                this.settings.nodeShadowEnabled = true;
                this.settings.nodeShadowColor = "#000000";
                this.settings.nodeShadowOpacity = 20;
                this.settings.nodeShadowBlur = 3;
                this.settings.nodeShadowOffsetX = 0;
                this.settings.nodeShadowOffsetY = 0;
                this.settings.measureAggregation = "sum";
                this.settings.measureDisplayMode = "badge";
                this.settings.linkSizingMode = "fixed";
                this.settings.linkMinWidth = 1;
                this.settings.linkMaxWidth = 20;
                this.settings.measureFormat = "auto";
                this.settings.measureDecimals = 0;
                break;


            default:
                // If unknown preset, use professionalBlue
                this.applyStylePreset("professionalBlue");
                break;
        }

        // Restore persisted toggles for controls/counters after preset switch
        this.settings.showControls = preserveShowControls;
        this.settings.showCounters = preserveShowCounters;
    }

    private resolvePresetId(presetId: string): string {
        return this.presetIds.includes(presetId) ? presetId : "professionalBlue";
    }

    private getCurrentStylePresetId(): string {
        const presetValue = this.formattingSettings?.stylePresets?.stylePreset?.value;
        const rawPreset = String((presetValue as any)?.value ?? presetValue ?? this.previousPreset ?? "professionalBlue");
        return this.resolvePresetId(rawPreset);
    }

    private resetSettingsToPreset(presetId: string): void {
        const resolvedPreset = this.resolvePresetId(presetId);

        // === CATEGORY A: FUNCTIONAL SETTINGS (29) - ALWAYS PRESERVE ===

        // Sizing & Spacing (4)
        const preservedNodeWidth = this.settings?.nodeWidth;
        const preservedNodeHeight = this.settings?.nodeHeight;
        const preservedLevelSpacing = this.settings?.levelSpacing;
        const preservedNodeSpacing = this.settings?.nodeSpacing;

        // Text Config (4)
        const preservedWrapText = this.settings?.wrapText;
        const preservedMaxCharsPerLine = this.settings?.maxCharsPerLine;
        const preservedTextAlignment = this.settings?.textAlignment;
        const preservedShowValues = this.settings?.showValues;

        // Badge Config (8)
        const preservedBadgePosition = this.settings?.badgePosition;
        const preservedBadgePaddingTop = this.settings?.badgePaddingTop;
        const preservedBadgePaddingRight = this.settings?.badgePaddingRight;
        const preservedBadgePaddingBottom = this.settings?.badgePaddingBottom;
        const preservedBadgePaddingLeft = this.settings?.badgePaddingLeft;
        const preservedCountMode = this.settings?.countMode;
        const preservedBadgeTextSize = this.settings?.badgeTextSize;
        const preservedBadgeFontFamily = this.settings?.badgeFontFamily;

        // Display Toggles (3)
        const preservedShowControls = this.settings?.showControls;
        const preservedShowCounters = this.settings?.showCounters;
        const preservedShowEmptyPlaceholder = this.settings?.showEmptyPlaceholder;

        // Measure Settings (7)
        const preservedMeasureAggregation = this.settings?.measureAggregation;
        const preservedMeasureDisplayMode = this.settings?.measureDisplayMode;
        const preservedLinkSizingMode = this.settings?.linkSizingMode;
        const preservedLinkMinWidth = this.settings?.linkMinWidth;
        const preservedLinkMaxWidth = this.settings?.linkMaxWidth;
        const preservedMeasureFormat = this.settings?.measureFormat;
        const preservedMeasureDecimals = this.settings?.measureDecimals;

        // Label Settings (3)
        const preservedShowLabel = this.settings?.showLabel;
        const preservedLabelText = this.settings?.labelText;
        const preservedLabelPosition = this.settings?.labelPosition;

        // === CATEGORY C: VISUAL EFFECTS (11) - PRESERVE IF CUSTOMIZED ===

        // Access metadata.objects to detect explicit user customization
        const objects = this.currentDataView?.metadata?.objects;
        const displayObjects = objects?.["displaySettings"];
        const nodeObjects = objects?.["nodeSettings"];
        const shadowObjects = objects?.["nodeShadow"] || nodeObjects;

        // Background (1) - preserve if explicitly customized
        const preservedBackgroundColor = displayObjects?.["backgroundColor"] !== undefined
            ? this.settings?.backgroundColor
            : undefined;

        // Shadows (6) - preserve if ANY shadow property was customized
        const shadowCustomized =
            shadowObjects?.["nodeShadowEnabled"] !== undefined ||
            shadowObjects?.["nodeShadowColor"] !== undefined ||
            shadowObjects?.["nodeShadowOpacity"] !== undefined ||
            shadowObjects?.["nodeShadowBlur"] !== undefined ||
            shadowObjects?.["nodeShadowOffsetX"] !== undefined ||
            shadowObjects?.["nodeShadowOffsetY"] !== undefined;

        const preservedShadowEnabled = shadowCustomized ? this.settings?.nodeShadowEnabled : undefined;
        const preservedShadowColor = shadowCustomized ? this.settings?.nodeShadowColor : undefined;
        const preservedShadowOpacity = shadowCustomized ? this.settings?.nodeShadowOpacity : undefined;
        const preservedShadowBlur = shadowCustomized ? this.settings?.nodeShadowBlur : undefined;
        const preservedShadowOffsetX = shadowCustomized ? this.settings?.nodeShadowOffsetX : undefined;
        const preservedShadowOffsetY = shadowCustomized ? this.settings?.nodeShadowOffsetY : undefined;

        // Modern Features (4) - preserve if customized
        const preservedFillType = nodeObjects?.["fillType"] !== undefined
            ? this.settings?.fillType
            : undefined;
        const preservedFillColorOverride = nodeObjects?.["fillColorOverride"] !== undefined
            ? this.settings?.fillColorOverride
            : undefined;
        const preservedBorderType = nodeObjects?.["borderType"] !== undefined
            ? this.settings?.borderType
            : undefined;
        const preservedShowIcons = nodeObjects?.["showIcons"] !== undefined
            ? this.settings?.showIcons
            : undefined;

        // === APPLY PRESET DEFAULTS (RESETS CATEGORY B) ===
        this.settings = this.getPresetDefaults(resolvedPreset);

        // === RESTORE CATEGORY A: FUNCTIONAL SETTINGS (29) ===

        // Sizing & Spacing (4)
        if (preservedNodeWidth !== undefined) {
            this.settings.nodeWidth = preservedNodeWidth;
        }
        if (preservedNodeHeight !== undefined) {
            this.settings.nodeHeight = preservedNodeHeight;
        }
        if (preservedLevelSpacing !== undefined) {
            this.settings.levelSpacing = preservedLevelSpacing;
        }
        if (preservedNodeSpacing !== undefined) {
            this.settings.nodeSpacing = preservedNodeSpacing;
        }

        // Text Config (4)
        if (preservedWrapText !== undefined) {
            this.settings.wrapText = preservedWrapText;
        }
        if (preservedMaxCharsPerLine !== undefined) {
            this.settings.maxCharsPerLine = preservedMaxCharsPerLine;
        }
        if (preservedTextAlignment !== undefined) {
            this.settings.textAlignment = preservedTextAlignment;
        }
        if (preservedShowValues !== undefined) {
            this.settings.showValues = preservedShowValues;
        }

        // Badge Config (8)
        if (preservedBadgePosition !== undefined) {
            this.settings.badgePosition = preservedBadgePosition;
        }
        if (preservedBadgePaddingTop !== undefined) {
            this.settings.badgePaddingTop = preservedBadgePaddingTop;
        }
        if (preservedBadgePaddingRight !== undefined) {
            this.settings.badgePaddingRight = preservedBadgePaddingRight;
        }
        if (preservedBadgePaddingBottom !== undefined) {
            this.settings.badgePaddingBottom = preservedBadgePaddingBottom;
        }
        if (preservedBadgePaddingLeft !== undefined) {
            this.settings.badgePaddingLeft = preservedBadgePaddingLeft;
        }
        if (preservedCountMode !== undefined) {
            this.settings.countMode = preservedCountMode;
        }
        if (preservedBadgeTextSize !== undefined) {
            this.settings.badgeTextSize = preservedBadgeTextSize;
        }
        if (preservedBadgeFontFamily !== undefined) {
            this.settings.badgeFontFamily = preservedBadgeFontFamily;
        }

        // Display Toggles (3)
        if (preservedShowControls !== undefined) {
            this.settings.showControls = preservedShowControls;
        }
        if (preservedShowCounters !== undefined) {
            this.settings.showCounters = preservedShowCounters;
        }
        if (preservedShowEmptyPlaceholder !== undefined) {
            this.settings.showEmptyPlaceholder = preservedShowEmptyPlaceholder;
        }

        // Measure Settings (7)
        if (preservedMeasureAggregation !== undefined) {
            this.settings.measureAggregation = preservedMeasureAggregation;
        }
        if (preservedMeasureDisplayMode !== undefined) {
            this.settings.measureDisplayMode = preservedMeasureDisplayMode;
        }
        if (preservedLinkSizingMode !== undefined) {
            this.settings.linkSizingMode = preservedLinkSizingMode;
        }
        if (preservedLinkMinWidth !== undefined) {
            this.settings.linkMinWidth = preservedLinkMinWidth;
        }
        if (preservedLinkMaxWidth !== undefined) {
            this.settings.linkMaxWidth = preservedLinkMaxWidth;
        }
        if (preservedMeasureFormat !== undefined) {
            this.settings.measureFormat = preservedMeasureFormat;
        }
        if (preservedMeasureDecimals !== undefined) {
            this.settings.measureDecimals = preservedMeasureDecimals;
        }

        // Label Settings (3)
        if (preservedShowLabel !== undefined) {
            this.settings.showLabel = preservedShowLabel;
        }
        if (preservedLabelText !== undefined) {
            this.settings.labelText = preservedLabelText;
        }
        if (preservedLabelPosition !== undefined) {
            this.settings.labelPosition = preservedLabelPosition;
        }

        // === RESTORE CATEGORY C: VISUAL EFFECTS (11) - IF CUSTOMIZED ===

        // Background (1)
        if (preservedBackgroundColor !== undefined) {
            this.settings.backgroundColor = preservedBackgroundColor;
        }

        // Shadows (6)
        if (preservedShadowEnabled !== undefined) {
            this.settings.nodeShadowEnabled = preservedShadowEnabled;
        }
        if (preservedShadowColor !== undefined) {
            this.settings.nodeShadowColor = preservedShadowColor;
        }
        if (preservedShadowOpacity !== undefined) {
            this.settings.nodeShadowOpacity = preservedShadowOpacity;
        }
        if (preservedShadowBlur !== undefined) {
            this.settings.nodeShadowBlur = preservedShadowBlur;
        }
        if (preservedShadowOffsetX !== undefined) {
            this.settings.nodeShadowOffsetX = preservedShadowOffsetX;
        }
        if (preservedShadowOffsetY !== undefined) {
            this.settings.nodeShadowOffsetY = preservedShadowOffsetY;
        }

        // Modern Features (4)
        if (preservedFillType !== undefined) {
            this.settings.fillType = preservedFillType;
        }
        if (preservedFillColorOverride !== undefined) {
            this.settings.fillColorOverride = preservedFillColorOverride;
        }
        if (preservedBorderType !== undefined) {
            this.settings.borderType = preservedBorderType;
        }
        if (preservedShowIcons !== undefined) {
            this.settings.showIcons = preservedShowIcons;
        }

        this.previousPreset = resolvedPreset;
    }

    private getLevelColor(levelIndex: number): string {
        if (this.isHighContrastMode && this.highContrastColors) {
            return this.highContrastColors.foreground;
        }
        if (this.settings.colors && this.settings.colors.length > 0) {
            return this.settings.colors[levelIndex % this.settings.colors.length];
        }
        return "#888888";
    }

    private normalizeOpacity(value: number): number {
        return Math.max(0, Math.min(value ?? 0, 100)) / 100;
    }

    private getLinkOpacity(): number {
        const base = this.normalizeOpacity(this.settings.lineOpacity);
        if (this.settings.linkColorMode === "gradient") {
            return Math.max(base, 0.65);
        }
        return base;
    }

    private updateSettingsFromModel(dataView: powerbi.DataView): void {
        // Store dataView for preservation logic
        this.currentDataView = dataView;

        // Check if the preset was explicitly changed
        const sp = this.formattingSettings?.stylePresets;

        if (sp?.stylePreset?.value) {
            const currentPreset = this.getCurrentStylePresetId();

            // Determine if this is a real preset switch
            const isPresetSwitch = currentPreset !== this.previousPreset;

            if (isPresetSwitch) {
                // Apply preset defaults (clean slate) and persist the active preset id
                this.resetSettingsToPreset(currentPreset);

                // Clear persisted overrides by requesting full reset for the preset change
                this.requestPresetResetInPowerBI(currentPreset);

                // Keep formatting model in sync with the new preset so pane shows correct defaults
                this.syncFormattingModelWithSettings();

                // Set flag to prevent reading individual settings on next update
                this.justSwitchedPreset = true;

                return; // Exit early - preset applies all settings
            }

            // If we just switched presets, skip reading individual settings this cycle
            // to allow persistProperties to take effect
            if (this.justSwitchedPreset) {
                this.justSwitchedPreset = false;
                return;
            }
        }

        const defaults = this.getPresetDefaults();
        // Start from preset defaults each cycle to ensure resets work even when objects are cleared
        this.settings = { ...defaults, colors: [...defaults.colors] };

        // Use metadata objects (persisted props) to decide what to override
        const objects = dataView?.metadata?.objects;
        const nodeObjects = objects?.["nodeSettings"] as any;
        const linkObjects = objects?.["linkSettings"] as any;
        const colorObjects = objects?.["colorSettings"] as any;
        const displayObjects = objects?.["displaySettings"] as any;
        const ns = this.formattingSettings?.nodeSettings;
        const ls = this.formattingSettings?.linkSettings;
        const cs = this.formattingSettings?.colorSettings;
        const ds = this.formattingSettings?.displaySettings;

        // Node settings
        if (ns && nodeObjects) {
            const shadowObjects = (objects?.["nodeShadow"] as any) || nodeObjects;
            const size = ns.sizeAndSpacing;
            if (nodeObjects["nodeWidth"] !== undefined) this.settings.nodeWidth = size?.nodeWidth?.value ?? defaults.nodeWidth;
            if (nodeObjects["nodeHeight"] !== undefined) this.settings.nodeHeight = size?.nodeHeight?.value ?? defaults.nodeHeight;
            if (nodeObjects["levelSpacing"] !== undefined) this.settings.levelSpacing = size?.levelSpacing?.value ?? defaults.levelSpacing;
            if (nodeObjects["nodeSpacing"] !== undefined) this.settings.nodeSpacing = size?.nodeSpacing?.value ?? defaults.nodeSpacing;

            const shape = ns.shape as any;
            if (nodeObjects["nodeShape"] !== undefined) this.settings.nodeShape = shape?.nodeShape?.value?.value ?? shape?.nodeShape?.value ?? defaults.nodeShape;
            if (nodeObjects["cornerRadius"] !== undefined) this.settings.cornerRadius = shape?.cornerRadius?.value ?? defaults.cornerRadius;
            if (nodeObjects["nodeFillOpacity"] !== undefined) this.settings.nodeFillOpacity = shape?.nodeFillOpacity?.value ?? defaults.nodeFillOpacity;

            const border = ns.border as any;
            if (nodeObjects["nodeBorderStyle"] !== undefined) this.settings.nodeBorderStyle = border?.nodeBorderStyle?.value?.value ?? border?.nodeBorderStyle?.value ?? defaults.nodeBorderStyle;
            if (nodeObjects["nodeBorderWidth"] !== undefined) this.settings.nodeBorderWidth = border?.nodeBorderWidth?.value ?? defaults.nodeBorderWidth;
            if (nodeObjects["useCustomBorderColor"] !== undefined) this.settings.useCustomBorderColor = border?.useCustomBorderColor?.value ?? defaults.useCustomBorderColor;
            if (nodeObjects["nodeBorderColor"] !== undefined) this.settings.nodeBorderColor = border?.nodeBorderColor?.value?.value ?? defaults.nodeBorderColor;


            const shadow = (ns as any).shadow as any;
            if (shadow) {
                if (shadowObjects["nodeShadowEnabled"] !== undefined) this.settings.nodeShadowEnabled = shadow?.nodeShadowEnabled?.value ?? defaults.nodeShadowEnabled;
                if (shadowObjects["nodeShadowColor"] !== undefined) this.settings.nodeShadowColor = shadow?.nodeShadowColor?.value?.value ?? defaults.nodeShadowColor;
                if (shadowObjects["nodeShadowOpacity"] !== undefined) this.settings.nodeShadowOpacity = shadow?.nodeShadowOpacity?.value ?? defaults.nodeShadowOpacity;
                if (shadowObjects["nodeShadowBlur"] !== undefined) this.settings.nodeShadowBlur = shadow?.nodeShadowBlur?.value ?? defaults.nodeShadowBlur;
                if (shadowObjects["nodeShadowOffsetX"] !== undefined) this.settings.nodeShadowOffsetX = shadow?.nodeShadowOffsetX?.value ?? defaults.nodeShadowOffsetX;
                if (shadowObjects["nodeShadowOffsetY"] !== undefined) this.settings.nodeShadowOffsetY = shadow?.nodeShadowOffsetY?.value ?? defaults.nodeShadowOffsetY;
            }

            const text = ns.text as any;
            if (nodeObjects["fontSize"] !== undefined) this.settings.fontSize = text?.fontSize?.value ?? defaults.fontSize;
            if (nodeObjects["fontFamily"] !== undefined) this.settings.fontFamily = text?.fontFamily?.value?.value ?? text?.fontFamily?.value ?? defaults.fontFamily;
            if (nodeObjects["textAlignment"] !== undefined) this.settings.textAlignment = text?.textAlignment?.value?.value ?? text?.textAlignment?.value ?? defaults.textAlignment;
            if (nodeObjects["textColor"] !== undefined) this.settings.textColor = text?.textColor?.value?.value ?? defaults.textColor;
            if (nodeObjects["wrapText"] !== undefined) this.settings.wrapText = text?.wrapText?.value ?? defaults.wrapText;
            if (nodeObjects["maxCharsPerLine"] !== undefined) this.settings.maxCharsPerLine = text?.maxCharsPerLine?.value ?? defaults.maxCharsPerLine;

            const counts = ns.connectionCounts as any;
            if (nodeObjects["showValues"] !== undefined) this.settings.showValues = counts?.showValues?.value ?? defaults.showValues;
            if (nodeObjects["badgeTextSize"] !== undefined) this.settings.badgeTextSize = counts?.badgeTextSize?.value ?? defaults.badgeTextSize;
            if (nodeObjects["badgeTextColor"] !== undefined) this.settings.badgeTextColor = counts?.badgeTextColor?.value?.value ?? defaults.badgeTextColor;
            if (nodeObjects["badgeFontFamily"] !== undefined) this.settings.badgeFontFamily = counts?.badgeFontFamily?.value?.value ?? counts?.badgeFontFamily?.value ?? defaults.badgeFontFamily;
            if (nodeObjects["badgePosition"] !== undefined) this.settings.badgePosition = counts?.badgePosition?.value?.value ?? counts?.badgePosition?.value ?? defaults.badgePosition;
            if (nodeObjects["countMode"] !== undefined) this.settings.countMode = counts?.countMode?.value?.value ?? counts?.countMode?.value ?? defaults.countMode;
            if (nodeObjects["badgePaddingTop"] !== undefined) this.settings.badgePaddingTop = counts?.badgePaddingTop?.value ?? defaults.badgePaddingTop;
            if (nodeObjects["badgePaddingRight"] !== undefined) this.settings.badgePaddingRight = counts?.badgePaddingRight?.value ?? defaults.badgePaddingRight;
            if (nodeObjects["badgePaddingBottom"] !== undefined) this.settings.badgePaddingBottom = counts?.badgePaddingBottom?.value ?? defaults.badgePaddingBottom;
            if (nodeObjects["badgePaddingLeft"] !== undefined) this.settings.badgePaddingLeft = counts?.badgePaddingLeft?.value ?? defaults.badgePaddingLeft;
        }

        // Apply formatting model values even if metadata object is missing (for new properties)
        if (ns?.text?.textAlignment) {
            this.settings.textAlignment = (ns.text.textAlignment as any).value?.value ?? (ns.text.textAlignment as any).value ?? this.settings.textAlignment;
        }

        // Link settings
        if (ls && linkObjects) {
            const opacity = ls.opacity;
            if (linkObjects["lineOpacity"] !== undefined) this.settings.lineOpacity = opacity?.lineOpacity?.value ?? defaults.lineOpacity;
            if (linkObjects["highlightOpacity"] !== undefined) this.settings.highlightOpacity = opacity?.highlightOpacity?.value ?? defaults.highlightOpacity;

            const style = ls.style as any;
            if (linkObjects["linkWidth"] !== undefined) this.settings.linkWidth = style?.linkWidth?.value ?? defaults.linkWidth;
            if (linkObjects["linkStyle"] !== undefined) this.settings.linkStyle = style?.linkStyle?.value?.value ?? style?.linkStyle?.value ?? defaults.linkStyle;
            if (linkObjects["linkCurveStyle"] !== undefined) this.settings.linkCurveStyle = style?.linkCurveStyle?.value?.value ?? style?.linkCurveStyle?.value ?? defaults.linkCurveStyle;

            const color = ls.color as any;
            if (linkObjects["linkColorMode"] !== undefined) this.settings.linkColorMode = color?.linkColorMode?.value?.value ?? color?.linkColorMode?.value ?? defaults.linkColorMode;
            if (linkObjects["customLinkColor"] !== undefined) this.settings.customLinkColor = color?.customLinkColor?.value?.value ?? defaults.customLinkColor;

            const start = ls.startMarker as any;
            if (linkObjects["showStartMarker"] !== undefined) this.settings.showStartMarker = start?.showStartMarker?.value ?? defaults.showStartMarker;
            if (linkObjects["startMarkerType"] !== undefined) this.settings.startMarkerType = start?.startMarkerType?.value?.value ?? start?.startMarkerType?.value ?? defaults.startMarkerType;
            if (linkObjects["startMarkerSize"] !== undefined) this.settings.startMarkerSize = start?.startMarkerSize?.value ?? defaults.startMarkerSize;

            const end = ls.endMarker as any;
            if (linkObjects["showEndMarker"] !== undefined) this.settings.showEndMarker = end?.showEndMarker?.value ?? defaults.showEndMarker;
            if (linkObjects["endMarkerType"] !== undefined) this.settings.endMarkerType = end?.endMarkerType?.value?.value ?? end?.endMarkerType?.value ?? defaults.endMarkerType;
            if (linkObjects["endMarkerSize"] !== undefined) this.settings.endMarkerSize = end?.endMarkerSize?.value ?? defaults.endMarkerSize;

            const markerColors = ls.markerColors;
            if (linkObjects["useCustomMarkerColors"] !== undefined) this.settings.useCustomMarkerColors = markerColors?.useCustomMarkerColors?.value ?? defaults.useCustomMarkerColors;
            if (linkObjects["startMarkerColor"] !== undefined) this.settings.startMarkerColor = markerColors?.startMarkerColor?.value?.value ?? defaults.startMarkerColor;
            if (linkObjects["endMarkerColor"] !== undefined) this.settings.endMarkerColor = markerColors?.endMarkerColor?.value?.value ?? defaults.endMarkerColor;
        }

        // Color settings - always read from formatting model (includes defaults when reset)
        if (cs && colorObjects) {
            if (colorObjects["level0Color"] !== undefined) this.settings.colors[0] = cs.level0Color?.value?.value ?? this.settings.colors[0];
            if (colorObjects["level1Color"] !== undefined) this.settings.colors[1] = cs.level1Color?.value?.value ?? this.settings.colors[1];
            if (colorObjects["level2Color"] !== undefined) this.settings.colors[2] = cs.level2Color?.value?.value ?? this.settings.colors[2];
            if (colorObjects["level3Color"] !== undefined) this.settings.colors[3] = cs.level3Color?.value?.value ?? this.settings.colors[3];
            if (colorObjects["level4Color"] !== undefined) this.settings.colors[4] = cs.level4Color?.value?.value ?? this.settings.colors[4];
            if (colorObjects["level5Color"] !== undefined) this.settings.colors[5] = cs.level5Color?.value?.value ?? this.settings.colors[5];
            if (colorObjects["level6Color"] !== undefined) this.settings.colors[6] = cs.level6Color?.value?.value ?? this.settings.colors[6];
            if (colorObjects["level7Color"] !== undefined) this.settings.colors[7] = cs.level7Color?.value?.value ?? this.settings.colors[7];
        }

        // Display settings
        if (ds && displayObjects) {
            if (displayObjects["backgroundColor"] !== undefined) this.settings.backgroundColor = ds.backgroundColor?.value?.value ?? defaults.backgroundColor;
            if (displayObjects["showEmptyPlaceholder"] !== undefined) this.settings.showEmptyPlaceholder = ds.showEmptyPlaceholder?.value ?? defaults.showEmptyPlaceholder;
            if (displayObjects["showCounters"] !== undefined) this.settings.showCounters = ds.showCounters?.value ?? defaults.showCounters;
            if (displayObjects["counterFontSize"] !== undefined) this.settings.headerCounterFontSize = ds.counterFontSize?.value ?? defaults.headerCounterFontSize;
            if (displayObjects["counterFontFamily"] !== undefined) this.settings.headerCounterFontFamily = (ds.counterFontFamily as any)?.value?.value ?? (ds.counterFontFamily as any)?.value ?? defaults.headerCounterFontFamily;
            if (displayObjects["counterFontWeight"] !== undefined) this.settings.headerCounterFontWeight = (ds.counterFontWeight as any)?.value?.value ?? (ds.counterFontWeight as any)?.value ?? defaults.headerCounterFontWeight;
            if (displayObjects["counterAlignment"] !== undefined) this.settings.headerCounterAlignment = (ds.counterAlignment as any)?.value?.value ?? (ds.counterAlignment as any)?.value ?? defaults.headerCounterAlignment;
            if (displayObjects["counterColor"] !== undefined) this.settings.headerCounterColor = ds.counterColor?.value?.value ?? defaults.headerCounterColor;
            if (displayObjects["counterSeparator"] !== undefined) this.settings.headerCounterSeparator = ds.counterSeparator?.value ?? defaults.headerCounterSeparator;
            if (displayObjects["headerTitleMatchNode"] !== undefined) this.settings.headerTitleMatchNode = ds.headerTitleMatchNode?.value ?? defaults.headerTitleMatchNode;
            if (displayObjects["headerTitleColor"] !== undefined) this.settings.headerTitleColor = ds.headerTitleColor?.value?.value ?? defaults.headerTitleColor;
            if (displayObjects["headerTitleSize"] !== undefined) this.settings.headerTitleSize = ds.headerTitleSize?.value ?? defaults.headerTitleSize;
            if (displayObjects["headerTitleFontFamily"] !== undefined) this.settings.headerTitleFontFamily = (ds.headerTitleFontFamily as any)?.value?.value ?? (ds.headerTitleFontFamily as any)?.value ?? defaults.headerTitleFontFamily;
            if (displayObjects["showControls"] !== undefined) this.settings.showControls = ds.showControls?.value ?? defaults.showControls;
        }

        // Measure configuration settings
        const ms = this.formattingSettings?.measureSettings;
        const measureObjects = objects?.["measureSettings"] as any;

        if (ms && measureObjects) {
            if (measureObjects["measureAggregation"] !== undefined) this.settings.measureAggregation = (ms.measureAggregation as any)?.value?.value ?? (ms.measureAggregation as any)?.value ?? defaults.measureAggregation;
            if (measureObjects["measureDisplayMode"] !== undefined) this.settings.measureDisplayMode = (ms.measureDisplayMode as any)?.value?.value ?? (ms.measureDisplayMode as any)?.value ?? defaults.measureDisplayMode;
            if (measureObjects["linkSizingMode"] !== undefined) this.settings.linkSizingMode = (ms.linkSizingMode as any)?.value?.value ?? (ms.linkSizingMode as any)?.value ?? defaults.linkSizingMode;
            if (measureObjects["linkMinWidth"] !== undefined) this.settings.linkMinWidth = ms.linkMinWidth?.value ?? defaults.linkMinWidth;
            if (measureObjects["linkMaxWidth"] !== undefined) this.settings.linkMaxWidth = ms.linkMaxWidth?.value ?? defaults.linkMaxWidth;
            if (measureObjects["measureFormat"] !== undefined) this.settings.measureFormat = (ms.measureFormat as any)?.value?.value ?? (ms.measureFormat as any)?.value ?? defaults.measureFormat;
            if (measureObjects["measureDecimals"] !== undefined) this.settings.measureDecimals = ms.measureDecimals?.value ?? defaults.measureDecimals;
        }

        // Apply formatting model values even if metadata object is missing (for new properties)
        if (ds?.counterAlignment) {
            this.settings.headerCounterAlignment = (ds.counterAlignment as any).value?.value ?? (ds.counterAlignment as any).value ?? this.settings.headerCounterAlignment;
        }

        if (this.isHighContrastMode && this.highContrastColors) {
            this.settings.textColor = this.highContrastColors.background;
            this.settings.headerCounterColor = this.highContrastColors.foreground;
            this.settings.badgeTextColor = this.highContrastColors.foreground;
            this.settings.headerTitleColor = this.highContrastColors.foreground;
        }
    }

    private requestPresetResetInPowerBI(presetId: string, resetAllCards: boolean = false): void {
        // This method uses Power BI's persistence API to clear individual overrides
        // when a preset is activated

        // Use Power BI's settings service to persist the reset
        // This requires using the host's persistProperties method
        if (!this.host || !(this.host as any).persistProperties) {
            return;
        }

        const removeEntries: any[] = [
            {
                objectName: "nodeSettings",
                selector: null,
                properties: this.getNodeSettingsProperties()
            },
            {
                objectName: "linkSettings",
                selector: null,
                properties: this.getLinkSettingsProperties()
            },
            {
                objectName: "colorSettings",
                selector: null,
                properties: this.getColorSettingsProperties()
            }
        ];

        if (resetAllCards) {
            removeEntries.push({
                objectName: "displaySettings",
                selector: null,
                properties: this.getDisplaySettingsProperties()
            });
        }

        const changes: any = {
            merge: [
                {
                    objectName: "stylePresets",
                    selector: null,
                    properties: {
                        stylePreset: presetId,
                        activePresetId: presetId
                    }
                }
            ],
            remove: removeEntries
        };

        (this.host as any).persistProperties(changes);
    }

    private syncFormattingModelWithSettings(): void {
        // Sync the formatting model (what shows in the pane) with actual settings values
        // This ensures the pane displays the correct current values after preset application

        if (!this.formattingSettings) return;

        const ns = this.formattingSettings.nodeSettings;
        const ls = this.formattingSettings.linkSettings;
        const cs = this.formattingSettings.colorSettings;
        const ds = this.formattingSettings.displaySettings;

        // Sync node settings
        if (ns) {
            if (ns.sizeAndSpacing) {
                ns.sizeAndSpacing.nodeWidth.value = this.settings.nodeWidth;
                ns.sizeAndSpacing.nodeHeight.value = this.settings.nodeHeight;
                ns.sizeAndSpacing.levelSpacing.value = this.settings.levelSpacing;
                ns.sizeAndSpacing.nodeSpacing.value = this.settings.nodeSpacing;
            }
            if (ns.shape) {
                ns.shape.nodeShape.value = { displayName: this.settings.nodeShape, value: this.settings.nodeShape } as any;
                ns.shape.cornerRadius.value = this.settings.cornerRadius;
                ns.shape.nodeFillOpacity.value = this.settings.nodeFillOpacity;
            }
            if (ns.border) {
                ns.border.nodeBorderStyle.value = { displayName: this.settings.nodeBorderStyle, value: this.settings.nodeBorderStyle } as any;
                ns.border.nodeBorderWidth.value = this.settings.nodeBorderWidth;
                ns.border.useCustomBorderColor.value = this.settings.useCustomBorderColor;
                ns.border.nodeBorderColor.value = { value: this.settings.nodeBorderColor };
            }
            if (ns.text) {
                ns.text.fontSize.value = this.settings.fontSize;
                ns.text.fontFamily.value = { displayName: this.settings.fontFamily, value: this.settings.fontFamily } as any;
                ns.text.textAlignment.value = { displayName: this.settings.textAlignment, value: this.settings.textAlignment } as any;
                ns.text.textColor.value = { value: this.settings.textColor };
                ns.text.wrapText.value = this.settings.wrapText;
                ns.text.maxCharsPerLine.value = this.settings.maxCharsPerLine;
            }
            if (ns.connectionCounts) {
                ns.connectionCounts.showValues.value = this.settings.showValues;
                ns.connectionCounts.badgeTextSize.value = this.settings.badgeTextSize;
                ns.connectionCounts.badgeTextColor.value = { value: this.settings.badgeTextColor };
                ns.connectionCounts.badgeFontFamily.value = { displayName: this.settings.badgeFontFamily, value: this.settings.badgeFontFamily } as any;
                ns.connectionCounts.badgePosition.value = { displayName: this.settings.badgePosition, value: this.settings.badgePosition } as any;
                ns.connectionCounts.countMode.value = { displayName: this.settings.countMode, value: this.settings.countMode } as any;
            }
            if (ns.shadow) {
                ns.shadow.nodeShadowEnabled.value = this.settings.nodeShadowEnabled;
                ns.shadow.nodeShadowColor.value = { value: this.settings.nodeShadowColor } as any;
                ns.shadow.nodeShadowOpacity.value = this.settings.nodeShadowOpacity;
                ns.shadow.nodeShadowBlur.value = this.settings.nodeShadowBlur;
                ns.shadow.nodeShadowOffsetX.value = this.settings.nodeShadowOffsetX;
                ns.shadow.nodeShadowOffsetY.value = this.settings.nodeShadowOffsetY;
            }
        }

        // Sync link settings
        if (ls) {
            if (ls.style) {
                ls.style.linkWidth.value = this.settings.linkWidth;
                ls.style.linkStyle.value = { displayName: this.settings.linkStyle, value: this.settings.linkStyle } as any;
                ls.style.linkCurveStyle.value = { displayName: this.settings.linkCurveStyle, value: this.settings.linkCurveStyle } as any;
            }
            if (ls.opacity) {
                ls.opacity.lineOpacity.value = this.settings.lineOpacity;
                ls.opacity.highlightOpacity.value = this.settings.highlightOpacity;
            }
            if (ls.color) {
                ls.color.linkColorMode.value = { displayName: this.settings.linkColorMode, value: this.settings.linkColorMode } as any;
                ls.color.customLinkColor.value = { value: this.settings.customLinkColor };
            }
            if (ls.startMarker) {
                ls.startMarker.showStartMarker.value = this.settings.showStartMarker;
                ls.startMarker.startMarkerType.value = { displayName: this.settings.startMarkerType, value: this.settings.startMarkerType } as any;
                ls.startMarker.startMarkerSize.value = this.settings.startMarkerSize;
            }
            if (ls.endMarker) {
                ls.endMarker.showEndMarker.value = this.settings.showEndMarker;
                ls.endMarker.endMarkerType.value = { displayName: this.settings.endMarkerType, value: this.settings.endMarkerType } as any;
                ls.endMarker.endMarkerSize.value = this.settings.endMarkerSize;
            }
            if (ls.markerColors) {
                ls.markerColors.useCustomMarkerColors.value = this.settings.useCustomMarkerColors;
                ls.markerColors.startMarkerColor.value = { value: this.settings.startMarkerColor };
                ls.markerColors.endMarkerColor.value = { value: this.settings.endMarkerColor };
            }
        }

        // Sync color settings
        if (cs) {
            cs.level0Color.value = { value: this.settings.colors[0] };
            cs.level1Color.value = { value: this.settings.colors[1] };
            cs.level2Color.value = { value: this.settings.colors[2] };
            cs.level3Color.value = { value: this.settings.colors[3] };
            cs.level4Color.value = { value: this.settings.colors[4] };
            cs.level5Color.value = { value: this.settings.colors[5] };
            cs.level6Color.value = { value: this.settings.colors[6] };
            cs.level7Color.value = { value: this.settings.colors[7] };
        }

        // Sync display settings
        if (ds) {
            ds.showEmptyPlaceholder.value = this.settings.showEmptyPlaceholder;
            ds.showCounters.value = this.settings.showCounters;
            ds.counterFontSize.value = this.settings.headerCounterFontSize;
            ds.counterFontFamily.value = { displayName: this.settings.headerCounterFontFamily, value: this.settings.headerCounterFontFamily } as any;
            ds.counterFontWeight.value = { displayName: this.settings.headerCounterFontWeight, value: this.settings.headerCounterFontWeight } as any;
            (ds as any).counterAlignment.value = { displayName: this.settings.headerCounterAlignment, value: this.settings.headerCounterAlignment } as any;
            ds.counterColor.value = { value: this.settings.headerCounterColor };
            ds.counterSeparator.value = this.settings.headerCounterSeparator;
            ds.headerTitleMatchNode.value = this.settings.headerTitleMatchNode;
            ds.headerTitleColor.value = { value: this.settings.headerTitleColor };
            ds.headerTitleSize.value = this.settings.headerTitleSize;
            ds.headerTitleFontFamily.value = { displayName: this.settings.headerTitleFontFamily, value: this.settings.headerTitleFontFamily } as any;
            ds.showControls.value = this.settings.showControls;
        }
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        // Sync formatting model with actual settings before displaying
        this.syncFormattingModelWithSettings();

        // Apply visibility logic before building model
        if (this.formattingSettings?.nodeSettings) {
            this.formattingSettings.nodeSettings.setVisibility();
        }
        if (this.formattingSettings?.linkSettings) {
            this.formattingSettings.linkSettings.setVisibility();
        }

        const model = this.formattingSettingsService.buildFormattingModel(this.formattingSettings);

        // Add revertToDefaultDescriptors to enable Reset button for each card
        if (model && model.cards) {
            model.cards.forEach(card => {
                // Type guard: check if card has 'name' property (it's a FormattingCard, not FormattingCardPlaceholder)
                if ('name' in card && card.name) {
                    const descriptors = this.getRevertToDefaultDescriptors(card.name as string);
                    if (descriptors && descriptors.length > 0) {
                        // Use type assertion since the type definitions don't include revertToDefaultDescriptors
                        (card as any).revertToDefaultDescriptors = descriptors;
                    }
                }
            });
        }

        return model;
    }

    private getRevertToDefaultDescriptors(cardName: string): any[] {
        switch (cardName) {
            case "stylePresets":
                return [
                    { objectName: "stylePresets", propertyName: "stylePreset" }
                ];

            case "nodeSettings":
                return this.getNodeSettingsProperties().map(prop => ({
                    objectName: "nodeSettings",
                    propertyName: prop
                }));

            case "nodeSizeAndSpacing":
                return [
                    { objectName: "nodeSettings", propertyName: "nodeWidth" },
                    { objectName: "nodeSettings", propertyName: "nodeHeight" },
                    { objectName: "nodeSettings", propertyName: "levelSpacing" },
                    { objectName: "nodeSettings", propertyName: "nodeSpacing" }
                ];

            case "nodeShape":
                return [
                    { objectName: "nodeSettings", propertyName: "nodeShape" },
                    { objectName: "nodeSettings", propertyName: "cornerRadius" },
                    { objectName: "nodeSettings", propertyName: "nodeFillOpacity" }
                ];

            case "nodeBorder":
                return [
                    { objectName: "nodeSettings", propertyName: "nodeBorderStyle" },
                    { objectName: "nodeSettings", propertyName: "nodeBorderWidth" },
                    { objectName: "nodeSettings", propertyName: "useCustomBorderColor" },
                    { objectName: "nodeSettings", propertyName: "nodeBorderColor" }
                ];

            case "nodeText":
                return [
                    { objectName: "nodeSettings", propertyName: "fontSize" },
                    { objectName: "nodeSettings", propertyName: "fontFamily" },
                    { objectName: "nodeSettings", propertyName: "textAlignment" },
                    { objectName: "nodeSettings", propertyName: "textColor" },
                    { objectName: "nodeSettings", propertyName: "wrapText" },
                    { objectName: "nodeSettings", propertyName: "maxCharsPerLine" }
                ];

            case "nodeConnectionCounts":
                return [
                    { objectName: "nodeSettings", propertyName: "showValues" },
                    { objectName: "nodeSettings", propertyName: "badgeTextSize" },
                    { objectName: "nodeSettings", propertyName: "badgeTextColor" },
                    { objectName: "nodeSettings", propertyName: "badgeFontFamily" },
                    { objectName: "nodeSettings", propertyName: "badgePosition" },
                    { objectName: "nodeSettings", propertyName: "badgePaddingTop" },
                    { objectName: "nodeSettings", propertyName: "badgePaddingRight" },
                    { objectName: "nodeSettings", propertyName: "badgePaddingBottom" },
                    { objectName: "nodeSettings", propertyName: "badgePaddingLeft" },
                    { objectName: "nodeSettings", propertyName: "countMode" }
                ];

            case "linkSettings":
                return this.getLinkSettingsProperties().map(prop => ({
                    objectName: "linkSettings",
                    propertyName: prop
                }));

            case "linkStyle":
                return [
                    { objectName: "linkSettings", propertyName: "linkStyle" },
                    { objectName: "linkSettings", propertyName: "linkWidth" },
                    { objectName: "linkSettings", propertyName: "linkCurveStyle" }
                ];

            case "linkOpacity":
                return [
                    { objectName: "linkSettings", propertyName: "lineOpacity" },
                    { objectName: "linkSettings", propertyName: "highlightOpacity" }
                ];

            case "linkColor":
                return [
                    { objectName: "linkSettings", propertyName: "linkColorMode" },
                    { objectName: "linkSettings", propertyName: "customLinkColor" }
                ];

            case "linkStartMarker":
                return [
                    { objectName: "linkSettings", propertyName: "showStartMarker" },
                    { objectName: "linkSettings", propertyName: "startMarkerType" },
                    { objectName: "linkSettings", propertyName: "startMarkerSize" }
                ];

            case "linkEndMarker":
                return [
                    { objectName: "linkSettings", propertyName: "showEndMarker" },
                    { objectName: "linkSettings", propertyName: "endMarkerType" },
                    { objectName: "linkSettings", propertyName: "endMarkerSize" }
                ];

            case "linkMarkerColors":
                return [
                    { objectName: "linkSettings", propertyName: "useCustomMarkerColors" },
                    { objectName: "linkSettings", propertyName: "startMarkerColor" },
                    { objectName: "linkSettings", propertyName: "endMarkerColor" }
                ];

            case "colorSettings":
                return this.getColorSettingsProperties().map(prop => ({
                    objectName: "colorSettings",
                    propertyName: prop
                }));

            case "displaySettings":
                return this.getDisplaySettingsProperties().map(prop => ({
                    objectName: "displaySettings",
                    propertyName: prop
                }));

            default:
                return [];
        }
    }

    /**
     * Called by Power BI when user clicks "Reset to default" in formatting pane
     */
    public resetSettings(objectName?: string): void {
        // objectName parameter indicates which settings card to reset
        // If undefined, reset ALL settings

        if (!objectName) {
            // Full reset - all settings
            this.resetAllSettings();
            this.requestResetPersistence(objectName);
        } else if (objectName === "stylePresets") {
            // Reset the currently selected preset and clear all dependent overrides
            const targetPreset = this.getCurrentStylePresetId();
            this.resetSettingsToPreset(targetPreset);
            this.requestPresetResetInPowerBI(targetPreset, true);
        } else {
            // Partial reset - specific card
            this.resetSettingsCard(objectName);
            // Request persistence update from Power BI
            this.requestResetPersistence(objectName);
        }

        // Sync formatting model to show reset values
        this.syncFormattingModelWithSettings();

        // Trigger immediate re-render if we have current data and viewport dimensions
        if (this.currentData && this.lastViewportWidth > 0 && this.lastViewportHeight > 0) {
            this.processData(this.currentData, null as any);
            this.render(this.lastViewportWidth, this.lastViewportHeight);
        }
    }

    private resetAllSettings(): void {
        const targetPreset = this.getCurrentStylePresetId();
        this.settings = this.getPresetDefaults(targetPreset);
        this.previousPreset = targetPreset;
    }

    private resetSettingsCard(cardName: string): void {
        const defaults = this.getPresetDefaults();

        switch (cardName) {
            case "stylePresets":
                // Reset to the currently selected preset
                this.resetSettingsToPreset(this.getCurrentStylePresetId());
                break;

            // ===== NODE SETTINGS - Parent and Sub-cards =====
            case "nodeSettings":
                // Reset all node-related settings (parent card resets all sub-cards)
                this.settings.nodeWidth = defaults.nodeWidth;
                this.settings.nodeHeight = defaults.nodeHeight;
                this.settings.nodeShape = defaults.nodeShape;
                this.settings.cornerRadius = defaults.cornerRadius;
                this.settings.nodeFillOpacity = defaults.nodeFillOpacity;
                this.settings.nodeBorderStyle = defaults.nodeBorderStyle;
                this.settings.nodeBorderWidth = defaults.nodeBorderWidth;
                this.settings.useCustomBorderColor = defaults.useCustomBorderColor;
                this.settings.nodeBorderColor = defaults.nodeBorderColor;
                this.settings.levelSpacing = defaults.levelSpacing;
                this.settings.nodeSpacing = defaults.nodeSpacing;
                this.settings.fontSize = defaults.fontSize;
                this.settings.fontFamily = defaults.fontFamily;
                this.settings.textAlignment = defaults.textAlignment;
                this.settings.textColor = defaults.textColor;
                this.settings.wrapText = defaults.wrapText;
                this.settings.maxCharsPerLine = defaults.maxCharsPerLine;
                this.settings.showValues = defaults.showValues;
                this.settings.badgeTextSize = defaults.badgeTextSize;
                this.settings.badgePosition = defaults.badgePosition;
                this.settings.badgePaddingTop = defaults.badgePaddingTop;
                this.settings.badgePaddingRight = defaults.badgePaddingRight;
                this.settings.badgePaddingBottom = defaults.badgePaddingBottom;
                this.settings.badgePaddingLeft = defaults.badgePaddingLeft;
                this.settings.countMode = defaults.countMode;
                break;

            case "nodeSizeAndSpacing":
                // Reset only Size and Spacing sub-card
                this.settings.nodeWidth = defaults.nodeWidth;
                this.settings.nodeHeight = defaults.nodeHeight;
                this.settings.levelSpacing = defaults.levelSpacing;
                this.settings.nodeSpacing = defaults.nodeSpacing;
                break;

            case "nodeShape":
                // Reset only Shape sub-card
                this.settings.nodeShape = defaults.nodeShape;
                this.settings.cornerRadius = defaults.cornerRadius;
                this.settings.nodeFillOpacity = defaults.nodeFillOpacity;
                break;

            case "nodeBorder":
                // Reset only Border sub-card
                this.settings.nodeBorderStyle = defaults.nodeBorderStyle;
                this.settings.nodeBorderWidth = defaults.nodeBorderWidth;
                this.settings.useCustomBorderColor = defaults.useCustomBorderColor;
                this.settings.nodeBorderColor = defaults.nodeBorderColor;
                break;

            case "nodeText":
                // Reset only Text sub-card
                this.settings.fontSize = defaults.fontSize;
                this.settings.fontFamily = defaults.fontFamily;
                this.settings.textAlignment = defaults.textAlignment;
                this.settings.textColor = defaults.textColor;
                this.settings.wrapText = defaults.wrapText;
                this.settings.maxCharsPerLine = defaults.maxCharsPerLine;
                break;

            case "nodeConnectionCounts":
                // Reset only Connection Counts sub-card
                this.settings.showValues = defaults.showValues;
                this.settings.badgeTextSize = defaults.badgeTextSize;
                this.settings.badgeTextColor = defaults.badgeTextColor;
                this.settings.badgeFontFamily = defaults.badgeFontFamily;
                this.settings.badgePosition = defaults.badgePosition;
                this.settings.badgePaddingTop = defaults.badgePaddingTop;
                this.settings.badgePaddingRight = defaults.badgePaddingRight;
                this.settings.badgePaddingBottom = defaults.badgePaddingBottom;
                this.settings.badgePaddingLeft = defaults.badgePaddingLeft;
                this.settings.countMode = defaults.countMode;
                break;

            // ===== LINK SETTINGS - Parent and Sub-cards =====
            case "linkSettings":
                // Reset all link-related settings (parent card resets all sub-cards)
                this.settings.lineOpacity = defaults.lineOpacity;
                this.settings.linkWidth = defaults.linkWidth;
                this.settings.highlightOpacity = defaults.highlightOpacity;
                this.settings.linkStyle = defaults.linkStyle;
                this.settings.linkColorMode = defaults.linkColorMode;
                this.settings.customLinkColor = defaults.customLinkColor;
                this.settings.linkCurveStyle = defaults.linkCurveStyle;
                this.settings.showStartMarker = defaults.showStartMarker;
                this.settings.startMarkerType = defaults.startMarkerType;
                this.settings.startMarkerSize = defaults.startMarkerSize;
                this.settings.showEndMarker = defaults.showEndMarker;
                this.settings.endMarkerType = defaults.endMarkerType;
                this.settings.endMarkerSize = defaults.endMarkerSize;
                this.settings.useCustomMarkerColors = defaults.useCustomMarkerColors;
                this.settings.startMarkerColor = defaults.startMarkerColor;
                this.settings.endMarkerColor = defaults.endMarkerColor;
                break;

            case "linkStyle":
                // Reset only Style sub-card
                this.settings.linkStyle = defaults.linkStyle;
                this.settings.linkWidth = defaults.linkWidth;
                this.settings.linkCurveStyle = defaults.linkCurveStyle;
                break;

            case "linkOpacity":
                // Reset only Opacity sub-card
                this.settings.lineOpacity = defaults.lineOpacity;
                this.settings.highlightOpacity = defaults.highlightOpacity;
                break;

            case "linkColor":
                // Reset only Color sub-card
                this.settings.linkColorMode = defaults.linkColorMode;
                this.settings.customLinkColor = defaults.customLinkColor;
                break;

            case "linkStartMarker":
                // Reset only Start Marker sub-card
                this.settings.showStartMarker = defaults.showStartMarker;
                this.settings.startMarkerType = defaults.startMarkerType;
                this.settings.startMarkerSize = defaults.startMarkerSize;
                break;

            case "linkEndMarker":
                // Reset only End Marker sub-card
                this.settings.showEndMarker = defaults.showEndMarker;
                this.settings.endMarkerType = defaults.endMarkerType;
                this.settings.endMarkerSize = defaults.endMarkerSize;
                break;

            case "linkMarkerColors":
                // Reset only Marker Colors sub-card
                this.settings.useCustomMarkerColors = defaults.useCustomMarkerColors;
                this.settings.startMarkerColor = defaults.startMarkerColor;
                this.settings.endMarkerColor = defaults.endMarkerColor;
                break;

            // ===== COLOR SETTINGS =====
            case "colorSettings":
                // Reset all color settings
                this.settings.colors = [...defaults.colors];
                break;

            // ===== DISPLAY SETTINGS =====
            case "displaySettings":
                // Reset all display settings
                this.settings.showEmptyPlaceholder = defaults.showEmptyPlaceholder;
                this.settings.showCounters = defaults.showCounters;
                this.settings.headerCounterFontSize = defaults.headerCounterFontSize;
                this.settings.headerCounterFontFamily = defaults.headerCounterFontFamily;
                this.settings.headerCounterFontWeight = defaults.headerCounterFontWeight;
                this.settings.headerCounterAlignment = defaults.headerCounterAlignment;
                this.settings.headerCounterColor = defaults.headerCounterColor;
                this.settings.headerCounterSeparator = defaults.headerCounterSeparator;
                this.settings.headerTitleMatchNode = defaults.headerTitleMatchNode;
                this.settings.headerTitleColor = defaults.headerTitleColor;
                this.settings.headerTitleSize = defaults.headerTitleSize;
                this.settings.headerTitleFontFamily = defaults.headerTitleFontFamily;
                this.settings.showControls = defaults.showControls;
                break;
        }
    }

    private requestResetPersistence(objectName?: string): void {
        // Use Power BI's API to clear persisted values
        if (!this.host || !(this.host as any).persistProperties) {
            return;
        }

        const changes: any = { remove: [] };

        if (!objectName) {
            // Remove all persisted settings
            changes.remove = [
                { objectName: "stylePresets", selector: null, properties: ["stylePreset", "activePresetId"] },
                { objectName: "nodeSettings", selector: null, properties: this.getNodeSettingsProperties() },
                { objectName: "linkSettings", selector: null, properties: this.getLinkSettingsProperties() },
                { objectName: "colorSettings", selector: null, properties: this.getColorSettingsProperties() },
                { objectName: "displaySettings", selector: null, properties: this.getDisplaySettingsProperties() }
            ];
        } else {
            // Remove specific card's persisted settings
            const properties = this.getPropertiesForCard(objectName);
            changes.remove = [
                { objectName, selector: null, properties }
            ];
        }

        (this.host as any).persistProperties(changes);
    }

    private getNodeSettingsProperties(): string[] {
        return [
            "nodeWidth", "nodeHeight", "nodeShape", "cornerRadius", "nodeFillOpacity",
            "nodeBorderStyle", "nodeBorderWidth", "useCustomBorderColor", "nodeBorderColor",
            "levelSpacing", "nodeSpacing", "fontSize", "fontFamily", "textAlignment", "textColor",
            "wrapText", "maxCharsPerLine", "showValues", "badgeTextSize", "badgeTextColor", "badgeFontFamily",
            "badgePosition", "badgePaddingTop", "badgePaddingRight",
            "badgePaddingBottom", "badgePaddingLeft", "countMode",
            "nodeShadowEnabled", "nodeShadowColor", "nodeShadowOpacity", "nodeShadowBlur", "nodeShadowOffsetX", "nodeShadowOffsetY"
        ];
    }

    private getLinkSettingsProperties(): string[] {
        return [
            "lineOpacity", "linkWidth", "highlightOpacity", "linkStyle", "linkColorMode",
            "customLinkColor", "linkCurveStyle", "showStartMarker", "startMarkerType",
            "startMarkerSize", "showEndMarker", "endMarkerType", "endMarkerSize",
            "useCustomMarkerColors", "startMarkerColor", "endMarkerColor"
        ];
    }

    private getColorSettingsProperties(): string[] {
        return [
            "level0Color", "level1Color", "level2Color", "level3Color",
            "level4Color", "level5Color", "level6Color", "level7Color"
        ];
    }

    private getDisplaySettingsProperties(): string[] {
        return [
            "showEmptyPlaceholder",
            "showCounters",
            "counterFontSize",
            "counterFontFamily",
            "counterAlignment",
            "counterFontWeight",
            "counterColor",
            "counterSeparator",
            "headerTitleMatchNode",
            "headerTitleColor",
            "headerTitleSize",
            "headerTitleFontFamily",
            "showControls"
        ];
    }

    private getPropertiesForCard(cardName: string): string[] {
        switch (cardName) {
            case "stylePresets":
                return ["stylePreset", "activePresetId"];

            // Node Settings - Parent and Sub-cards
            case "nodeSettings":
                return this.getNodeSettingsProperties();
            case "nodeSizeAndSpacing":
                return ["nodeWidth", "nodeHeight", "levelSpacing", "nodeSpacing"];
            case "nodeShape":
                return ["nodeShape", "cornerRadius", "nodeFillOpacity"];
            case "nodeBorder":
                return ["nodeBorderStyle", "nodeBorderWidth", "useCustomBorderColor", "nodeBorderColor"];
            case "nodeShadow":
                return ["nodeShadowEnabled", "nodeShadowColor", "nodeShadowOpacity", "nodeShadowBlur", "nodeShadowOffsetX", "nodeShadowOffsetY"];
            case "nodeText":
                return ["fontSize", "fontFamily", "textAlignment", "textColor", "wrapText", "maxCharsPerLine"];
            case "nodeConnectionCounts":
                return ["showValues", "badgeTextSize", "badgePosition", "badgePaddingTop",
                    "badgePaddingRight", "badgePaddingBottom", "badgePaddingLeft", "countMode", "badgeTextColor", "badgeFontFamily"];

            // Link Settings - Parent and Sub-cards
            case "linkSettings":
                return this.getLinkSettingsProperties();
            case "linkStyle":
                return ["linkStyle", "linkWidth", "linkCurveStyle"];
            case "linkOpacity":
                return ["lineOpacity", "highlightOpacity"];
            case "linkColor":
                return ["linkColorMode", "customLinkColor"];
            case "linkStartMarker":
                return ["showStartMarker", "startMarkerType", "startMarkerSize"];
            case "linkEndMarker":
                return ["showEndMarker", "endMarkerType", "endMarkerSize"];
            case "linkMarkerColors":
                return ["useCustomMarkerColors", "startMarkerColor", "endMarkerColor"];

            // Other Settings
            case "colorSettings":
                return this.getColorSettingsProperties();
            case "displaySettings":
                return this.getDisplaySettingsProperties();

            default:
                return [];
        }
    }

    private extractData(dataViews: DataView[]): TableData | null {
        if (!dataViews || !dataViews[0]) return null;
        const dataView = dataViews[0];
        if (!dataView.table || !dataView.table.columns || !dataView.table.rows) return null;

        const columns: string[] = [];
        const tooltipColumnIndices: number[] = [];
        const metadata = dataView.table.columns;

        // Collect all group columns
        const allGroupColumns: Array<{ index: number, name: string, metadata: any }> = [];
        for (let i = 0; i < metadata.length; i++) {
            const col = metadata[i];
            if (col?.roles?.['group']) {
                allGroupColumns.push({
                    index: i,
                    name: col?.displayName || col?.queryName || "Column " + (i + 1),
                    metadata: col
                });
            } else if (col?.roles?.['tooltips']) {
                tooltipColumnIndices.push(i);
            }
        }

        // Determine which columns to show based on drill state
        let columnsToShow = allGroupColumns;
        if (this.isDrillMode && this.currentDrillLevel >= 0) {
            // In drill mode: show only up to current drill level
            columnsToShow = allGroupColumns.slice(0, this.currentDrillLevel + 1);
        }
        // Otherwise: show all columns (normal behavior)

        // Build columns and indices arrays
        const groupColumnIndices: number[] = [];
        columnsToShow.forEach(col => {
            columns.push(col.name);
            groupColumnIndices.push(col.index);
        });

        (this as any).tooltipColumnIndices = tooltipColumnIndices;
        (this as any).allColumns = metadata;

        const filteredRows = dataView.table.rows.map((row, rowIdx) => {
            const groupData = groupColumnIndices.map(idx => row[idx]);
            (this as any)[`fullRow_${rowIdx}`] = row;
            return groupData;
        });

        let highlights: any[][] | undefined;
        if (dataView.table.rows && (dataView.table as any).highlights) {
            highlights = (dataView.table as any).highlights.map((row: any[]) =>
                groupColumnIndices.map(idx => row[idx])
            );
        }

        return { columns, rows: filteredRows, highlights };
    }

    private extractMeasureData(dataView: DataView): MeasureData | null {
        if (!dataView || !dataView.table || !dataView.table.columns || !dataView.table.rows) {
            return null;
        }

        const metadata = dataView.table.columns;
        let measureColumnIndex = -1;

        // Find the column with 'values' role
        for (let i = 0; i < metadata.length; i++) {
            const col = metadata[i];
            if (col?.roles?.['values']) {
                measureColumnIndex = i;
                this.measureColumnMetadata = col;
                break;
            }
        }

        // No measure column found
        if (measureColumnIndex === -1) {
            return null;
        }

        // Extract measure values by row index
        const valuesByRowIndex = new Map<number, number>();
        const rows = dataView.table.rows;

        for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
            const row = rows[rowIndex];
            const value = row[measureColumnIndex];

            // Only store non-null, numeric values
            if (value !== null && value !== undefined && typeof value === 'number' && !isNaN(value)) {
                valuesByRowIndex.set(rowIndex, value);
            }
        }

        // Return null if no valid measure values found
        if (valuesByRowIndex.size === 0) {
            return null;
        }

        return {
            columnIndex: measureColumnIndex,
            aggregationMethod: this.settings.measureAggregation || "sum",
            valuesByRowIndex: valuesByRowIndex
        };
    }

    private buildNodeTooltip(node: SankeyNode): VisualTooltipDataItem[] {
        const items: VisualTooltipDataItem[] = [];

        // Add measure value if available
        if (this.hasMeasure && node.measureValue !== undefined) {
            const aggregationLabel = this.settings.measureAggregation.toUpperCase();
            const measureName = this.measureColumnMetadata?.displayName || "Measure";
            items.push({
                header: node.value,
                displayName: `${aggregationLabel} of ${measureName}`,
                value: this.formatMeasureValue(node.measureValue)
            });
        }

        // Always show connection count
        items.push({ displayName: "Connections", value: String(node.count) });

        // Show tooltip fields for last level only
        const rowIndex = this.nodeRowIndexById.get(node.id);
        const fullRow = rowIndex !== undefined ? (this as any)[`fullRow_${rowIndex}`] : null;
        const tipCols: number[] = (this as any).tooltipColumnIndices || [];
        const colsMeta: any[] = (this as any).allColumns || [];
        if (fullRow && tipCols.length) {
            for (const idx of tipCols) {
                const col = colsMeta[idx];
                const label = col?.displayName || col?.queryName || `Field ${idx + 1}`;
                const val = fullRow[idx];
                items.push({ displayName: label, value: val == null ? "" : String(val) });
            }
        }
        return items;
    }

    private buildLinkTooltip(link: SankeyLink): VisualTooltipDataItem[] {
        const items: VisualTooltipDataItem[] = [];
        const source = this.nodes.get(link.source);
        const target = this.nodes.get(link.target);

        if (source && target) {
            const header = `${source.value} → ${target.value}`;

            // Add measure value if available
            if (this.hasMeasure && link.measureValue !== undefined) {
                const aggregationLabel = this.settings.measureAggregation.toUpperCase();
                const measureName = this.measureColumnMetadata?.displayName || "Measure";
                items.push({
                    header: header,
                    displayName: `${aggregationLabel} of ${measureName}`,
                    value: this.formatMeasureValue(link.measureValue)
                });
            } else {
                items.push({ header: header, displayName: "Count", value: String(link.count) });
            }
        }

        return items;
    }

    private normalizeValue(value: any): string {
        if (value === null || value === undefined) return '';
        return String(value).replace(/\r?\n/g, ' ').trim();
    }

    private makeId(levelIndex: number, value: string): string {
        return `L${levelIndex}_${this.hashString(value)}`;
    }

    private hashString(str: string): string {
        let hash = 2166136261;
        for (let i = 0; i < str.length; i++) {
            hash ^= str.charCodeAt(i);
            hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
        }
        return (hash >>> 0).toString(36);
    }

    private aggregateMeasureValues(values: number[], method: string): number {
        if (!values || values.length === 0) {
            return 0;
        }

        switch (method.toLowerCase()) {
            case "sum":
                return values.reduce((sum, val) => sum + val, 0);

            case "average":
                return values.reduce((sum, val) => sum + val, 0) / values.length;

            case "count":
                return values.length;

            case "min":
                return Math.min(...values);

            case "max":
                return Math.max(...values);

            default:
                // Default to sum
                return values.reduce((sum, val) => sum + val, 0);
        }
    }

    private formatMeasureValue(value: number): string {
        if (value === null || value === undefined || isNaN(value)) {
            return "0";
        }

        const decimals = this.settings.measureDecimals || 0;
        const format = this.settings.measureFormat || "auto";

        switch (format) {
            case "none":
                return value.toFixed(decimals);

            case "thousands":
                return (value / 1000).toFixed(decimals) + "K";

            case "millions":
                return (value / 1000000).toFixed(decimals) + "M";

            case "auto":
            default:
                // Auto-format based on magnitude
                const absValue = Math.abs(value);
                if (absValue >= 1000000) {
                    return (value / 1000000).toFixed(decimals) + "M";
                } else if (absValue >= 1000) {
                    return (value / 1000).toFixed(decimals) + "K";
                } else {
                    return value.toFixed(decimals);
                }
        }
    }

    private getFilteredRowIndices(filteredRows: any[][]): number[] {
        if (!this.currentData) return [];

        const indices: number[] = [];
        const allRows = this.currentData.rows;

        // Find indices of filtered rows in original data
        filteredRows.forEach(filteredRow => {
            const idx = allRows.findIndex(originalRow =>
                originalRow.every((val, i) => val === filteredRow[i])
            );
            if (idx !== -1) indices.push(idx);
        });

        return indices;
    }

    private calculateBadgeDisplayValue(
        nodeId: string,
        filteredRowIndices: number[],
        filteredNeighborCount: number
    ): string {
        const node = this.nodes.get(nodeId);
        if (!node) return String(filteredNeighborCount);

        // Check if we should display measures in badges
        const shouldShowMeasure = this.hasMeasure &&
                                 this.measureData &&
                                 (this.settings.measureDisplayMode === "badge" ||
                                  this.settings.measureDisplayMode === "both");

        if (!shouldShowMeasure) {
            return String(filteredNeighborCount);
        }

        // Aggregate measure values from filtered rows belonging to this node
        const measureValues: number[] = [];
        const nodeToRows = this.nodeToRowIndices.get(nodeId);

        if (nodeToRows) {
            // Find intersection of filtered rows and this node's rows
            const relevantRows = filteredRowIndices.filter(idx => nodeToRows.includes(idx));

            // Collect measure values from relevant rows
            relevantRows.forEach(rowIdx => {
                if (this.measureData!.valuesByRowIndex.has(rowIdx)) {
                    measureValues.push(this.measureData!.valuesByRowIndex.get(rowIdx)!);
                }
            });
        }

        // Aggregate and format
        if (measureValues.length > 0) {
            const aggregated = this.aggregateMeasureValues(
                measureValues,
                this.measureData!.aggregationMethod
            );
            return this.formatMeasureValue(aggregated);
        }

        // Fallback: no measures found for this node in filtered set
        return String(filteredNeighborCount);
    }

    private validateMeasureData(): void {
        if (!this.measureData || !this.hasMeasure) {
            return;
        }

        const values = Array.from(this.measureData.valuesByRowIndex.values());

        // Check for all zeros
        const allZeros = values.every(v => v === 0);
        if (allZeros) {
            console.warn("StreamLinks: All measure values are zero. Link widths will not vary.");
        }

        // Check for negative values
        const hasNegatives = values.some(v => v < 0);
        if (hasNegatives) {
            console.warn("StreamLinks: Measure contains negative values. Absolute values will be used for link sizing.");
        }

        // Check for very small variation (all values nearly identical)
        const uniqueValues = [...new Set(values)];
        if (uniqueValues.length === 1 && values.length > 1) {
            console.warn("StreamLinks: All measure values are identical. Link widths will not vary.");
        }
    }

    private titleCase(str: string): string {
        return str.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    private processData(data: TableData, dataView: DataView): void {
        this.nodes.clear();
        this.links = [];
        this.nodeRowIndexById.clear();
        this.nodeSelectionById.clear();
        this.nodeElements.clear();

        const { columns, rows, highlights } = data;

        // Step 1: Build node-to-rows mapping
        this.nodeToRowIndices.clear();
        const nodesByLevel: Map<string, Map<string, number>> = new Map();

        columns.forEach((level, levelIndex) => {
            const valueMap = new Map<string, number>();
            rows.forEach((row, rowIndex) => {
                const value = this.normalizeValue(row[levelIndex]);
                if (value !== '') {
                    valueMap.set(value, (valueMap.get(value) || 0) + 1);
                    const nodeId = this.makeId(levelIndex, value);

                    // Map node to row indices
                    if (!this.nodeToRowIndices.has(nodeId)) {
                        this.nodeToRowIndices.set(nodeId, []);
                    }
                    this.nodeToRowIndices.get(nodeId)!.push(rowIndex);

                    // Store first row index for selection
                    if (!this.nodeRowIndexById.has(nodeId)) {
                        this.nodeRowIndexById.set(nodeId, rowIndex);
                        if (dataView.table) {
                            const selectionId = this.host.createSelectionIdBuilder().withTable(dataView.table, rowIndex).createSelectionId();
                            this.nodeSelectionById.set(nodeId, selectionId);
                        }
                    }
                }
            });
            if (valueMap.size === 0 && this.settings.showEmptyPlaceholder) {
                valueMap.set("(Empty)", 0);
            }
            nodesByLevel.set(level, valueMap);
        });

        // Step 2: Process highlights
        const highlightedValues = new Set<string>();
        if (highlights) {
            highlights.forEach((row, rowIndex) => {
                columns.forEach((_, levelIndex) => {
                    if (row[levelIndex] !== null) {
                        const value = this.normalizeValue(rows[rowIndex][levelIndex]);
                        highlightedValues.add(`${levelIndex}_${value}`);
                    }
                });
            });
        }

        // Step 3: Create nodes with measure aggregation
        columns.forEach((level, levelIndex) => {
            const valueMap = nodesByLevel.get(level)!;
            const color = this.getLevelColor(levelIndex);
            valueMap.forEach((count, value) => {
                const id = this.makeId(levelIndex, value);
                const isHighlighted = highlights ? highlightedValues.has(`${levelIndex}_${value}`) : true;

                // Aggregate measure values for this node
                let measureValue: number | undefined;
                let displayValue: number = count;

                if (this.hasMeasure && this.measureData && this.nodeToRowIndices.has(id)) {
                    const rowIndices = this.nodeToRowIndices.get(id)!;
                    const measureValues: number[] = [];

                    // Collect measure values from rows associated with this node
                    for (const rowIdx of rowIndices) {
                        if (this.measureData.valuesByRowIndex.has(rowIdx)) {
                            measureValues.push(this.measureData.valuesByRowIndex.get(rowIdx)!);
                        }
                    }

                    // Aggregate measure values
                    if (measureValues.length > 0) {
                        measureValue = this.aggregateMeasureValues(measureValues, this.measureData.aggregationMethod);
                        displayValue = measureValue;
                    }
                }

                this.nodes.set(id, {
                    id,
                    level,
                    levelIndex,
                    value,
                    count,
                    color,
                    x: 0,
                    y: 0,
                    selectionId: this.nodeSelectionById.get(id),
                    highlighted: isHighlighted,
                    measureValue,
                    displayValue
                });
            });
        });

        // Step 4: Create links with measure aggregation
        for (let i = 0; i < columns.length - 1; i++) {
            // Map link pairs to row indices
            const linkToRowIndices = new Map<string, number[]>();

            rows.forEach((row, rowIndex) => {
                const sourceVal = this.normalizeValue(row[i]);
                const targetVal = this.normalizeValue(row[i + 1]);
                if (sourceVal !== '' && targetVal !== '') {
                    const sourceId = this.makeId(i, sourceVal);
                    const targetId = this.makeId(i + 1, targetVal);
                    const linkKey = `${sourceId}->${targetId}`;

                    if (!linkToRowIndices.has(linkKey)) {
                        linkToRowIndices.set(linkKey, []);
                    }
                    linkToRowIndices.get(linkKey)!.push(rowIndex);
                }
            });

            // Create links with aggregated measure values
            linkToRowIndices.forEach((rowIndices, linkKey) => {
                const [source, target] = linkKey.split('->');
                const sourceNode = this.nodes.get(source);
                const targetNode = this.nodes.get(target);
                const sourceColor = sourceNode?.color || this.getLevelColor(i);
                const targetColor = targetNode?.color || this.getLevelColor(i + 1);

                let measureValue: number | undefined;
                let flowValue: number = 1;

                // Aggregate measure values for this link
                if (this.hasMeasure && this.measureData) {
                    const measureValues: number[] = [];

                    for (const rowIdx of rowIndices) {
                        if (this.measureData.valuesByRowIndex.has(rowIdx)) {
                            measureValues.push(this.measureData.valuesByRowIndex.get(rowIdx)!);
                        }
                    }

                    if (measureValues.length > 0) {
                        measureValue = this.aggregateMeasureValues(measureValues, this.measureData.aggregationMethod);
                        flowValue = measureValue;
                    }
                }

                this.links.push({
                    source,
                    target,
                    count: rowIndices.length,
                    color: sourceColor,
                    sourceColor,
                    targetColor,
                    measureValue,
                    flowValue
                });
            });
        }

        // Step 5: Calculate neighbor counts (preserves existing behavior for connection badges)
        this.calculateNeighborCounts();
    }

    private calculateNeighborCounts(): void {
        const outNeighbors = new Map<string, Set<string>>();
        const inNeighbors = new Map<string, Set<string>>();
        this.nodes.forEach((_, id) => {
            outNeighbors.set(id, new Set());
            inNeighbors.set(id, new Set());
        });
        this.links.forEach(link => {
            outNeighbors.get(link.source)?.add(link.target);
            inNeighbors.get(link.target)?.add(link.source);
        });
        this.nodes.forEach((node, id) => {
            let count = 0;
            if (this.settings.countMode === 'out') count = outNeighbors.get(id)?.size || 0;
            else if (this.settings.countMode === 'in') count = inNeighbors.get(id)?.size || 0;
            else count = (outNeighbors.get(id)?.size || 0) + (inNeighbors.get(id)?.size || 0);
            node.count = count;
        });
    }

    private render(width: number, height: number): void {
        this.svg.setAttribute("width", String(width));
        this.svg.setAttribute("height", String(height));
        while (this.mainGroup.firstChild) this.mainGroup.removeChild(this.mainGroup.firstChild);
        while (this.fixedHeader.firstChild) this.fixedHeader.removeChild(this.fixedHeader.firstChild);
        while (this.defs.firstChild) this.defs.removeChild(this.defs.firstChild);

        this.markerIdCounter = 0;
        this.nodeElements.clear();
        this.calculateLayout(width, height);
        this.createMarkerDefinitions();
        this.renderLinks();
        this.renderLevelHeaders();
        this.renderNodes();
        this.renderHeader(width);
        if (this.settings.showControls) this.renderControls(width);
    }

    private createMarkerDefinitions(): void {
        if (this.settings.useCustomMarkerColors) {
            // Use custom marker colors
            if (this.settings.showStartMarker) {
                this.createMarker(this.settings.startMarkerColor, this.settings.startMarkerType, this.settings.startMarkerSize, "start");
            }
            if (this.settings.showEndMarker) {
                this.createMarker(this.settings.endMarkerColor, this.settings.endMarkerType, this.settings.endMarkerSize, "end");
            }
        } else {
            // Use link colors for markers
            const colors = new Set<string>();
            this.links.forEach(link => {
                colors.add(this.getLinkColor(link));
            });
            if (this.settings.linkColorMode === 'custom') {
                colors.add(this.settings.customLinkColor);
            }

            colors.forEach(color => {
                if (this.settings.showStartMarker) {
                    this.createMarker(color, this.settings.startMarkerType, this.settings.startMarkerSize, "start");
                }
                if (this.settings.showEndMarker) {
                    this.createMarker(color, this.settings.endMarkerType, this.settings.endMarkerSize, "end");
                }
            });
        }
    }

    private createMarker(color: string, type: string, size: number, position: "start" | "end"): void {
        const markerId = this.getMarkerId(color, type, position);
        const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
        marker.setAttribute("id", markerId);
        marker.setAttribute("markerUnits", "userSpaceOnUse");
        marker.setAttribute("markerWidth", String(size));
        marker.setAttribute("markerHeight", String(size));
        marker.setAttribute("orient", "auto");

        let shape: SVGElement;
        switch (type) {
            case "arrow":
                marker.setAttribute("refX", position === "end" ? String(size) : "0");
                marker.setAttribute("refY", String(size / 2));
                marker.setAttribute("viewBox", `0 0 ${size} ${size}`);
                shape = document.createElementNS("http://www.w3.org/2000/svg", "path");
                if (position === "end") {
                    shape.setAttribute("d", `M0,0 L${size},${size / 2} L0,${size} Z`);
                } else {
                    shape.setAttribute("d", `M${size},0 L0,${size / 2} L${size},${size} Z`);
                }
                shape.setAttribute("fill", color);
                break;
            case "arrowOutline":
                marker.setAttribute("refX", position === "end" ? String(size) : "0");
                marker.setAttribute("refY", String(size / 2));
                marker.setAttribute("viewBox", `0 0 ${size} ${size}`);
                shape = document.createElementNS("http://www.w3.org/2000/svg", "path");
                if (position === "end") {
                    shape.setAttribute("d", `M0,0 L${size},${size / 2} L0,${size}`);
                } else {
                    shape.setAttribute("d", `M${size},0 L0,${size / 2} L${size},${size}`);
                }
                shape.setAttribute("fill", "none");
                shape.setAttribute("stroke", color);
                shape.setAttribute("stroke-width", "1");
                break;
            case "circle":
                marker.setAttribute("refX", String(size / 2));
                marker.setAttribute("refY", String(size / 2));
                marker.setAttribute("viewBox", `0 0 ${size} ${size}`);
                shape = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                shape.setAttribute("cx", String(size / 2));
                shape.setAttribute("cy", String(size / 2));
                shape.setAttribute("r", String(size / 2 - 1));
                shape.setAttribute("fill", color);
                break;
            case "diamond":
                marker.setAttribute("refX", String(size / 2));
                marker.setAttribute("refY", String(size / 2));
                marker.setAttribute("viewBox", `0 0 ${size} ${size}`);
                shape = document.createElementNS("http://www.w3.org/2000/svg", "path");
                shape.setAttribute("d", `M${size / 2},0 L${size},${size / 2} L${size / 2},${size} L0,${size / 2} Z`);
                shape.setAttribute("fill", color);
                break;
            case "square":
            default:
                marker.setAttribute("refX", String(size / 2));
                marker.setAttribute("refY", String(size / 2));
                marker.setAttribute("viewBox", `0 0 ${size} ${size}`);
                shape = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                shape.setAttribute("x", "1");
                shape.setAttribute("y", "1");
                shape.setAttribute("width", String(size - 2));
                shape.setAttribute("height", String(size - 2));
                shape.setAttribute("fill", color);
                break;
        }

        marker.appendChild(shape);
        this.defs.appendChild(marker);
    }

    private getMarkerId(color: string, type: string, position: "start" | "end"): string {
        return `marker-${position}-${type}-${color.replace('#', '')}`;
    }

    private getLinkColor(link: SankeyLink): string {
        switch (this.settings.linkColorMode) {
            case "target":
                return link.targetColor || link.color;
            case "custom":
                return this.settings.customLinkColor;
            case "gradient":
            case "source":
            default:
                return link.sourceColor || link.color;
        }
    }

    private getBorderDashArray(): string {
        switch (this.settings.nodeBorderStyle) {
            case "dashed": return "8,4";
            case "dotted": return "2,2";
            case "none": return "";
            default: return "";
        }
    }

    private getLinkDashArray(): string {
        switch (this.settings.linkStyle) {
            case "dashed": return "8,4";
            case "dotted": return "2,2";
            default: return "";
        }
    }

    private calculateLayout(width: number, height: number): void {
        if (!this.currentData) return;
        const { columns } = this.currentData;
        const nodesByLevel = new Map<number, SankeyNode[]>();
        this.nodes.forEach(node => {
            if (!nodesByLevel.has(node.levelIndex)) nodesByLevel.set(node.levelIndex, []);
            nodesByLevel.get(node.levelIndex)!.push(node);
        });
        nodesByLevel.forEach(nodes => nodes.sort((a, b) => b.count - a.count));
        columns.forEach((_, levelIndex) => {
            const levelNodes = nodesByLevel.get(levelIndex) || [];
            const x = 100 + levelIndex * this.settings.levelSpacing;
            const totalHeight = levelNodes.length * this.settings.nodeSpacing;
            const startY = Math.max(100, (height - totalHeight) / 2);
            levelNodes.forEach((node, index) => {
                node.x = x;
                node.y = startY + index * this.settings.nodeSpacing;
            });
        });
    }

    private renderLinks(): void {
        const linkGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        linkGroup.setAttribute("class", "links");

        // Calculate min/max flow values for proportional sizing
        let minFlow = Infinity;
        let maxFlow = -Infinity;

        if (this.settings.linkSizingMode === "proportional" && this.hasMeasure) {
            this.links.forEach(link => {
                const flowValue = link.flowValue || 0;
                if (flowValue > 0) {
                    minFlow = Math.min(minFlow, flowValue);
                    maxFlow = Math.max(maxFlow, flowValue);
                }
            });
            // Handle edge cases
            if (minFlow === Infinity) minFlow = 0;
            if (maxFlow === -Infinity) maxFlow = 0;
        }

        // Function to calculate link width
        const calculateLinkWidth = (link: SankeyLink): number => {
            if (this.settings.linkSizingMode === "fixed" || !this.hasMeasure) {
                return this.settings.linkWidth;
            }

            const flowValue = Math.abs(link.flowValue || 0);

            // Handle zero or no variation
            if (flowValue === 0 || maxFlow === minFlow) {
                return this.settings.linkMinWidth;
            }

            // Normalize to [linkMinWidth, linkMaxWidth] range
            const normalized = (flowValue - minFlow) / (maxFlow - minFlow);
            const width = this.settings.linkMinWidth + (normalized * (this.settings.linkMaxWidth - this.settings.linkMinWidth));

            return Math.max(this.settings.linkMinWidth, Math.min(this.settings.linkMaxWidth, width));
        };

        this.links.forEach((link, index) => {
            const source = this.nodes.get(link.source);
            const target = this.nodes.get(link.target);
            if (!source || !target) return;

            const x1 = source.x + this.settings.nodeWidth;
            const y1 = source.y + this.settings.nodeHeight / 2;
            const x2 = target.x;
            const y2 = target.y + this.settings.nodeHeight / 2;

            const sourceColor = link.sourceColor || this.getLevelColor(source?.levelIndex ?? 0);
            const targetColor = link.targetColor || this.getLevelColor(target?.levelIndex ?? 0);
            const linkColor = this.getLinkColor({ ...link, sourceColor, targetColor });
            const baseOpacity = this.getLinkOpacity();
            const linkWidth = calculateLinkWidth(link);

            if (this.settings.linkColorMode === "gradient") {
                const gradientId = `gradient-${index}`;
                const gradient = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
                gradient.setAttribute("id", gradientId);
                gradient.setAttribute("gradientUnits", "userSpaceOnUse");
                gradient.setAttribute("x1", "0%");
                gradient.setAttribute("y1", "0%");
                gradient.setAttribute("x2", "100%");
                gradient.setAttribute("y2", "0%");
                const stop1 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
                stop1.setAttribute("offset", "0%");
                stop1.setAttribute("stop-color", sourceColor);
                stop1.setAttribute("stop-opacity", String(baseOpacity));
                const stop2 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
                stop2.setAttribute("offset", "100%");
                stop2.setAttribute("stop-color", targetColor);
                stop2.setAttribute("stop-opacity", String(baseOpacity));
                gradient.appendChild(stop1);
                gradient.appendChild(stop2);
                this.defs.appendChild(gradient);
            }

            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute("d", this.generateLinkPath(x1, y1, x2, y2));
            path.setAttribute("fill", "none");
            path.setAttribute("stroke", this.settings.linkColorMode === "gradient" ? `url(#gradient-${index})` : linkColor);
            path.setAttribute("stroke-width", String(linkWidth));
            path.setAttribute("stroke-opacity", String(baseOpacity));
            path.setAttribute("data-source", link.source);
            path.setAttribute("data-target", link.target);
            path.setAttribute("data-link-index", String(index));
            path.setAttribute("data-link-width", String(linkWidth));
            path.style.pointerEvents = "visibleStroke";
            path.style.cursor = "pointer";

            const dashArray = this.getLinkDashArray();
            if (dashArray) path.setAttribute("stroke-dasharray", dashArray);

            if (this.settings.showStartMarker) {
                const markerColor = this.settings.useCustomMarkerColors
                    ? this.settings.startMarkerColor
                    : (this.settings.linkColorMode === "gradient" ? sourceColor : linkColor);
                path.setAttribute("marker-start", `url(#${this.getMarkerId(markerColor, this.settings.startMarkerType, "start")})`);
            }
            if (this.settings.showEndMarker) {
                const markerColor = this.settings.useCustomMarkerColors
                    ? this.settings.endMarkerColor
                    : (this.settings.linkColorMode === "gradient" ? targetColor : linkColor);
                path.setAttribute("marker-end", `url(#${this.getMarkerId(markerColor, this.settings.endMarkerType, "end")})`);
            }

            path.addEventListener("mouseenter", () => {
                path.setAttribute("opacity", String(Math.min(baseOpacity + 0.15, 1)));
                path.setAttribute("stroke-width", String(linkWidth + 1));
            });
            path.addEventListener("mouseleave", () => {
                path.setAttribute("opacity", String(baseOpacity));
                path.setAttribute("stroke-width", String(linkWidth));
                this.host.tooltipService.hide({ isTouchEvent: false, immediately: true });
            });

            // Add tooltip support for links
            path.addEventListener("mousemove", (ev: MouseEvent) => {
                this.host.tooltipService.show({
                    coordinates: [ev.clientX, ev.clientY],
                    isTouchEvent: false,
                    dataItems: this.buildLinkTooltip(link),
                    identities: []
                });
            });

            linkGroup.appendChild(path);
        });

        this.mainGroup.appendChild(linkGroup);
    }

    private generateLinkPath(x1: number, y1: number, x2: number, y2: number): string {
        const midX = (x1 + x2) / 2;
        switch (this.settings.linkCurveStyle) {
            case "straight":
                return `M${x1},${y1} L${x2},${y2}`;
            case "step":
                return `M${x1},${y1} H${midX} V${y2} H${x2}`;
            case "arc":
                const radius = Math.abs(y2 - y1) / 2 || 20;
                const sweep = y2 > y1 ? 1 : 0;
                return `M${x1},${y1} H${midX - radius} A${radius},${radius} 0 0,${sweep} ${midX},${(y1 + y2) / 2} A${radius},${radius} 0 0,${sweep} ${midX + radius},${y2} H${x2}`;
            case "bezier":
            default:
                return `M${x1},${y1} C${midX},${y1} ${midX},${y2} ${x2},${y2}`;
        }
    }

    private renderLevelHeaders(): void {
        if (!this.currentData) return;
        const headerGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        headerGroup.setAttribute("class", "headers");
        this.currentData.columns.forEach((colName, index) => {
            const x = 100 + index * this.settings.levelSpacing + this.settings.nodeWidth / 2;
            const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
            text.setAttribute("x", String(x));
            text.setAttribute("y", "90");
            text.setAttribute("text-anchor", "middle");
            text.setAttribute("font-size", `${this.settings.headerTitleSize}px`);
            text.setAttribute("font-weight", "bold");
            text.setAttribute("font-family", this.settings.headerTitleFontFamily || this.settings.fontFamily);
            const levelColor = this.settings.colors[index % this.settings.colors.length];
            const chosenColor = this.settings.headerTitleMatchNode ? levelColor : this.settings.headerTitleColor;
            text.setAttribute("fill", this.isHighContrastMode && this.highContrastColors ? this.highContrastColors.foreground : chosenColor);
            text.textContent = this.titleCase(colName);
            headerGroup.appendChild(text);
        });
        this.mainGroup.appendChild(headerGroup);
    }

    private createNodeShape(node: SankeyNode): SVGElement {
        const w = this.settings.nodeWidth;
        const h = this.settings.nodeHeight;
        const nodeColor = this.isHighContrastMode && this.highContrastColors ? this.highContrastColors.foreground : node.color;
        const borderColor = this.settings.useCustomBorderColor ? this.settings.nodeBorderColor : nodeColor;

        const fillOpacity = this.settings.nodeFillOpacity / 100;
        const borderWidth = this.settings.nodeBorderStyle === "none" ? 0 : this.settings.nodeBorderWidth;
        const dashArray = this.getBorderDashArray();

        let shape: SVGElement;

        switch (this.settings.nodeShape) {
            case "rectangle":
                shape = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                shape.setAttribute("width", String(w));
                shape.setAttribute("height", String(h));
                shape.setAttribute("rx", "0");
                shape.setAttribute("ry", "0");
                break;
            case "pill":
                shape = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                shape.setAttribute("width", String(w));
                shape.setAttribute("height", String(h));
                shape.setAttribute("rx", String(h / 2));
                shape.setAttribute("ry", String(h / 2));
                break;
            case "ellipse":
                shape = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
                shape.setAttribute("cx", String(w / 2));
                shape.setAttribute("cy", String(h / 2));
                shape.setAttribute("rx", String(w / 2));
                shape.setAttribute("ry", String(h / 2));
                break;
            case "diamond":
                shape = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
                shape.setAttribute("points", `${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}`);
                break;
            case "hexagon":
                const hx = w * 0.15;
                shape = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
                shape.setAttribute("points", `${hx},0 ${w - hx},0 ${w},${h / 2} ${w - hx},${h} ${hx},${h} 0,${h / 2}`);
                break;
            case "parallelogram":
                const skew = w * 0.15;
                shape = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
                shape.setAttribute("points", `${skew},0 ${w},0 ${w - skew},${h} 0,${h}`);
                break;
            case "roundedRect":
            default:
                shape = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                shape.setAttribute("width", String(w));
                shape.setAttribute("height", String(h));
                shape.setAttribute("rx", String(this.settings.cornerRadius));
                shape.setAttribute("ry", String(this.settings.cornerRadius));
                break;
        }

        shape.setAttribute("class", "node-shape");
        shape.setAttribute("fill", nodeColor);
        shape.setAttribute("stroke", borderColor);
        shape.setAttribute("stroke-width", String(borderWidth));
        shape.setAttribute("opacity", String(fillOpacity));
        if (dashArray) shape.setAttribute("stroke-dasharray", dashArray);

        return shape;
    }

    private createNodeGradients(): void {
        this.settings.colors.forEach((color, i) => {
            const gradId = `node-grad-${i}`;
            // Check if exists
            if (this.defs.querySelector(`#${gradId}`)) return;

            const gradient = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
            gradient.setAttribute("id", gradId);
            gradient.setAttribute("x1", "0%");
            gradient.setAttribute("y1", "0%");
            gradient.setAttribute("x2", "100%");
            gradient.setAttribute("y2", "100%");

            const stop1 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
            stop1.setAttribute("offset", "0%");
            stop1.setAttribute("stop-color", color);
            stop1.setAttribute("stop-opacity", "1");

            // Darker bottom-right
            const stop2 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
            stop2.setAttribute("offset", "100%");
            // Simple logic for darker color: rely on CSS filter or just same color? 
            // Simulation used d3.color.darker(). Here we don't have d3-color easily available unless imported.
            // I'll assume same color but handled via CSS opacity or rely on the visual effect I added in .less (brightness).
            // Actually, let's use the start/end stops same color but rely on the CSS drop-shadow and border for depth?
            // The user simulation used a darker color. I'll mock it by just using the defined color here 
            // and letting the 'modernApp' preset logic (if I had d3) handle it. 
            // Wait, I can try to use a simple hex manipulation or just keep it flat gradient if no utils.
            // Actually, I can import d3-color if available. It's available via 'd3'.
            // But 'd3' might not be fully imported as namespace. The file imports are granular?
            // "import * as d3 from 'd3';" is NOT present.
            // I'll stick to a simple gradient where bottom-right is slightly transparent black overlay?
            stop2.setAttribute("stop-color", color);
            stop2.setAttribute("stop-opacity", "1");

            gradient.appendChild(stop1);
            gradient.appendChild(stop2);
            this.defs.appendChild(gradient);
        });
    }


    private ensureSoftShadowFilter(): void {
        const existing = this.defs.querySelector('#node-shadow');
        if (existing) existing.remove();

        const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
        filter.setAttribute('id', 'node-shadow');
        filter.setAttribute('x', '-20%');
        filter.setAttribute('y', '-20%');
        filter.setAttribute('width', '140%');
        filter.setAttribute('height', '140%');

        const blur = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
        blur.setAttribute('in', 'SourceAlpha');
        blur.setAttribute('stdDeviation', String(this.settings.nodeShadowBlur || 6));
        blur.setAttribute('result', 'blur');
        filter.appendChild(blur);

        const offset = document.createElementNS('http://www.w3.org/2000/svg', 'feOffset');
        offset.setAttribute('dx', String(this.settings.nodeShadowOffsetX || 0));
        offset.setAttribute('dy', String(this.settings.nodeShadowOffsetY || 4));
        offset.setAttribute('result', 'offsetBlur');
        filter.appendChild(offset);

        const flood = document.createElementNS('http://www.w3.org/2000/svg', 'feFlood');
        flood.setAttribute('flood-color', this.settings.nodeShadowColor || '#111111');
        const shadowOpacity = Math.max(0, Math.min(this.settings.nodeShadowOpacity ?? 10, 100)) / 100;
        flood.setAttribute('flood-opacity', shadowOpacity.toString());
        flood.setAttribute('result', 'shadowColor');
        filter.appendChild(flood);

        const composite = document.createElementNS('http://www.w3.org/2000/svg', 'feComposite');
        composite.setAttribute('in', 'shadowColor');
        composite.setAttribute('in2', 'offsetBlur');
        composite.setAttribute('operator', 'in');
        composite.setAttribute('result', 'shadow');
        filter.appendChild(composite);

        const merge = document.createElementNS('http://www.w3.org/2000/svg', 'feMerge');
        ['shadow', 'SourceGraphic'].forEach(input => {
            const node = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
            node.setAttribute('in', input);
            merge.appendChild(node);
        });
        filter.appendChild(merge);

        this.defs.appendChild(filter);
    }

    private applyShadowToAllNodes(): void {
        const shadowOn = this.settings.nodeShadowEnabled;
        const shapes = this.mainGroup.querySelectorAll<SVGElement>(".node .node-shape");
        if (shadowOn) {
            this.ensureSoftShadowFilter();
            shapes.forEach(s => s.setAttribute("filter", "url(#node-shadow)"));
        } else {
            shapes.forEach(s => s.removeAttribute("filter"));
        }
    }

    private renderNodes(): void {
        const nodeGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        nodeGroup.setAttribute("class", "nodes");

        // Ensure gradients exist if needed (fill OR border)
        if (this.settings.fillType === "gradient" || this.settings.borderType === "gradient") {
            this.createNodeGradients();
        }

        this.nodes.forEach(node => {
            const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
            g.setAttribute("class", "node");
            const targetTransform = `translate(${node.x},${node.y})`;
            const previous = this.previousNodePositions.get(node.id);
            if (previous) {
                g.setAttribute("transform", `translate(${previous.x},${previous.y})`);
                g.style.transition = "transform 0.3s ease";
                requestAnimationFrame(() => {
                    g.setAttribute("transform", targetTransform);
                });
            } else {
                g.setAttribute("transform", targetTransform);
            }
            g.style.cursor = this.allowInteractions ? "pointer" : "default";
            g.setAttribute("data-node-id", node.id);
            g.setAttribute("data-node-value", node.value);
            g.setAttribute("tabindex", "-1");
            g.setAttribute("role", "button");
            g.setAttribute("aria-label", `${node.value}, ${node.level}, ${node.count} connections`);

            this.nodeElements.set(node.id, g);
            this.previousNodePositions.set(node.id, { x: node.x, y: node.y });

            const shape = this.createNodeShape(node);

            // Handle Fill Type
            if (this.settings.fillType === "gradient") {
                const colorIndex = this.settings.colors.indexOf(node.color);
                if (colorIndex >= 0) {
                    shape.setAttribute("fill", `url(#node-grad-${colorIndex})`);
                }
            } else if (this.settings.fillColorOverride) {
                // Solid fill with override (e.g. White)
                shape.setAttribute("fill", this.settings.fillColorOverride);
            }

            // Handle Border Type
            if (this.settings.borderType === "gradient") {
                const colorIndex = this.settings.colors.indexOf(node.color);
                if (colorIndex >= 0) {
                    shape.setAttribute("stroke", `url(#node-grad-${colorIndex})`);
                    // Ensure width is at least 2 if likely meant to be outlined
                    if (this.settings.nodeBorderWidth === 0) {
                        shape.setAttribute("stroke-width", "2");
                    }
                }
            }

            // For Modern App or Pill styles, add subtle bevel if gradient fill
            if (this.settings.fillType === "gradient") {
                shape.setAttribute("stroke", "rgba(255,255,255,0.2)");
                shape.setAttribute("stroke-width", "1");
            }

            g.appendChild(shape);

            const applyShadow = this.settings.nodeShadowEnabled;
            if (applyShadow) {
                this.ensureSoftShadowFilter();
                shape.setAttribute('filter', 'url(#node-shadow)');
            } else {
                shape.removeAttribute('filter');
            }

            const isSoftWhitePreset = this.getCurrentStylePresetId() === 'softWhite';
            if (isSoftWhitePreset) {
                shape.setAttribute('stroke', '#E5E7EB');
                shape.setAttribute('stroke-width', '1.5');
            }

            // Mock Icon
            if (this.settings.showIcons) {
                const iconCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                iconCircle.setAttribute("cx", "20");
                iconCircle.setAttribute("cy", String(this.settings.nodeHeight / 2));
                iconCircle.setAttribute("r", "10");
                iconCircle.setAttribute("fill", "rgba(255,255,255,0.2)");

                const iconText = document.createElementNS("http://www.w3.org/2000/svg", "text");
                iconText.setAttribute("x", "20");
                iconText.setAttribute("y", String(this.settings.nodeHeight / 2));
                iconText.setAttribute("dy", "0.35em");
                iconText.setAttribute("text-anchor", "middle");
                iconText.setAttribute("fill", "white");
                iconText.style.fontFamily = "Segoe UI Emoji";
                iconText.textContent = "🔹";

                g.appendChild(iconCircle);
                g.appendChild(iconText);
            }

            this.renderNodeText(g, node);
            if (this.settings.showValues) this.renderNodeBadge(g, node);
            if (this.settings.showLabel) this.renderNodeLabel(g);

            const isLastLevel = this.currentData && node.levelIndex === this.currentData.columns.length - 1;
            if (isLastLevel) {
                g.addEventListener("mousemove", (ev: MouseEvent) => {
                    const rowIndex = this.nodeRowIndexById.get(node.id);
                    const selection = rowIndex !== undefined ? this.rowSelectionByIndex.get(rowIndex) : undefined;
                    this.host.tooltipService.show({
                        coordinates: [ev.clientX, ev.clientY],
                        isTouchEvent: false,
                        dataItems: this.buildNodeTooltip(node),
                        identities: selection ? [selection] : []
                    });
                });
                g.addEventListener("mouseleave", () => {
                    this.host.tooltipService.hide({ isTouchEvent: false, immediately: true });
                });
            }

            g.addEventListener("mouseenter", () => {
                shape.style.transition = "all 0.15s ease";
                if (this.selectedNodes.size > 0 && !this.connectedNodes.has(node.id)) {
                    shape.setAttribute("opacity", "0.75");
                    g.querySelectorAll("text").forEach(t => t.setAttribute("opacity", "0.85"));
                    g.querySelectorAll("circle").forEach(c => c.setAttribute("opacity", "0.85"));
                    this.highlightLinksForNode(node.id, true);
                } else {
                    // Apply hover effect via stroke enhancement (not CSS filter to preserve shadow)
                    const currentStrokeWidth = parseFloat(shape.getAttribute("stroke-width") || "0");
                    shape.setAttribute("data-original-stroke", String(currentStrokeWidth));
                    shape.setAttribute("stroke-width", String(currentStrokeWidth + 1.5));
                }
            });

            g.addEventListener("mouseleave", () => {
                // Remove CSS filter reference entirely - DO NOT use style.filter
                // (CSS inline styles override SVG filter attribute, breaking shadows)

                if (this.selectedNodes.size > 0 && !this.connectedNodes.has(node.id)) {
                    shape.setAttribute("opacity", "0.2");
                    shape.setAttribute("stroke-width", String(this.settings.nodeBorderWidth));
                    g.querySelectorAll("text").forEach(t => t.setAttribute("opacity", "0.3"));
                    g.querySelectorAll("circle").forEach(c => c.setAttribute("opacity", "0.3"));
                    this.highlightLinksForNode(node.id, false);
                } else {
                    // Restore original stroke width
                    const originalStroke = shape.getAttribute("data-original-stroke");
                    if (originalStroke) {
                        shape.setAttribute("stroke-width", originalStroke);
                        shape.removeAttribute("data-original-stroke");
                    } else {
                        // Fallback to settings value
                        const baseWidth = (this.settings.fillType === "gradient" || this.settings.borderType === "gradient") ? Math.max(1, this.settings.nodeBorderWidth) : this.settings.nodeBorderWidth;
                        shape.setAttribute("stroke-width", String(baseWidth));
                    }
                }

                // Safety: Ensure shadow filter persists
                if (this.settings.nodeShadowEnabled) {
                    shape.setAttribute("filter", "url(#node-shadow)");
                }
            });

            if (this.allowInteractions) {
                g.addEventListener("click", (e) => {
                    e.stopPropagation();
                    this.highlightConnections(node.id, e.ctrlKey || e.metaKey);
                    this.selectRowsForSelectedNodes();
                });
                g.addEventListener("contextmenu", (ev: MouseEvent) => {
                    ev.preventDefault();
                    ev.stopPropagation();

                    // Register custom copy handler
                    this.setupCustomCopyHandler(node);

                    const selectionId = this.nodeSelectionById.get(node.id);
                    this.selectionManager.showContextMenu(selectionId ? selectionId : {}, { x: ev.clientX, y: ev.clientY });
                });
            }

            nodeGroup.appendChild(g);
        });

        this.applyShadowToAllNodes();
        this.mainGroup.appendChild(nodeGroup);
    }

    private renderNodeText(g: SVGGElement, node: SankeyNode): void {
        const text = node.value;
        const lines = this.wrapText(text, this.settings.maxCharsPerLine);
        if (lines.length > 3) {
            lines.splice(3);
            lines[2] = lines[2].substring(0, this.settings.maxCharsPerLine - 3) + '...';
        }

        // Add measure value line if display mode is 'node' or 'both'
        if (this.hasMeasure && node.displayValue !== undefined &&
            (this.settings.measureDisplayMode === "node" || this.settings.measureDisplayMode === "both")) {
            const measureLine = this.formatMeasureValue(node.displayValue);
            lines.push(measureLine);
        }

        const textGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        textGroup.setAttribute("class", "node-text");
        textGroup.style.pointerEvents = "none";
        const lineHeight = 13;
        const startY = this.settings.nodeHeight / 2 - ((lines.length - 1) * lineHeight) / 2 + 4;
        const textColor = this.isHighContrastMode && this.highContrastColors ? this.highContrastColors.background : this.settings.textColor;

        let textX = this.settings.showIcons ? 40 : this.settings.nodeWidth / 2;
        let textAnchor = this.settings.showIcons ? "start" : "middle";
        switch (this.settings.textAlignment) {
            case "left":
                textAnchor = "start";
                textX = this.settings.showIcons ? 40 : 12;
                break;
            case "right":
                textAnchor = "end";
                textX = this.settings.nodeWidth - 12;
                break;
            default:
                if (this.settings.showIcons) {
                    textAnchor = "start";
                    textX = 40;
                } else {
                    textAnchor = "middle";
                    textX = this.settings.nodeWidth / 2;
                }
                break;
        }

        lines.forEach((line, i) => {
            const textEl = document.createElementNS("http://www.w3.org/2000/svg", "text");
            textEl.setAttribute("x", String(textX));
            textEl.setAttribute("y", String(startY + i * lineHeight));
            textEl.setAttribute("text-anchor", textAnchor);
            textEl.setAttribute("fill", textColor);
            textEl.setAttribute("font-size", `${this.settings.fontSize}px`);
            textEl.setAttribute("font-weight", "600");
            textEl.setAttribute("font-family", this.settings.fontFamily);
            textEl.textContent = line;
            textGroup.appendChild(textEl);
        });
        g.appendChild(textGroup);
    }

    private renderNodeBadge(g: SVGGElement, node: SankeyNode): void {
        const badgeColor = this.isHighContrastMode && this.highContrastColors ? this.highContrastColors.foreground : (this.settings.badgeTextColor || node.color);
        const badgeBg = this.isHighContrastMode && this.highContrastColors ? this.highContrastColors.background : "white";

        // Calculate badge size - circle size is proportional to text size (1.5x text size)
        const textSize = this.settings.badgeTextSize;
        const badgeRadius = textSize * 1.25; // Circle scales proportionally with text
        let cx = 0;
        let cy = 0;

        // Parse position (e.g., "top-right", "center", "bottom-left")
        const parts = this.settings.badgePosition.split("-");
        let vertical = parts.length === 2 ? parts[0] : "center";
        let horizontal = parts.length === 2 ? parts[1] : (parts[0] || "center");

        // Calculate horizontal position
        if (horizontal === "left") {
            cx = badgeRadius + this.settings.badgePaddingLeft;
        } else if (horizontal === "right") {
            cx = this.settings.nodeWidth - badgeRadius - this.settings.badgePaddingRight;
        } else {
            cx = this.settings.nodeWidth / 2;
        }

        // Calculate vertical position
        if (vertical === "top") {
            cy = badgeRadius + this.settings.badgePaddingTop;
        } else if (vertical === "bottom") {
            cy = this.settings.nodeHeight - badgeRadius - this.settings.badgePaddingBottom;
        } else if (vertical === "middle") {
            cy = this.settings.nodeHeight / 2;
        } else {
            // Default to center vertical for center position
            cy = this.settings.nodeHeight / 2;
        }

        // Create badge circle
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", String(cx));
        circle.setAttribute("cy", String(cy));
        circle.setAttribute("r", String(badgeRadius));
        circle.setAttribute("fill", badgeBg);
        circle.setAttribute("stroke", badgeColor);
        circle.setAttribute("stroke-width", "1.5");
        circle.style.pointerEvents = "none";

        // Create badge text - centered vertically in circle
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("class", "badge-count");
        text.setAttribute("x", String(cx));
        text.setAttribute("y", String(cy + textSize * 0.35)); // Optical centering
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("fill", badgeColor);
        text.setAttribute("font-size", textSize + "px");
        text.setAttribute("font-weight", "bold");
        text.setAttribute("font-family", this.settings.badgeFontFamily || this.settings.fontFamily);
        text.style.pointerEvents = "none";

        // Determine what to display based on measure settings
        let displayText = String(node.count);
        if (this.hasMeasure && node.displayValue !== undefined &&
            (this.settings.measureDisplayMode === "badge" || this.settings.measureDisplayMode === "both")) {
            displayText = this.formatMeasureValue(node.displayValue);
        }
        text.textContent = displayText;

        g.appendChild(circle);
        g.appendChild(text);
    }

    private renderNodeLabel(g: SVGGElement): void {
        if (!this.settings.labelText || this.settings.labelText.trim() === "") return;

        const labelColor = this.isHighContrastMode && this.highContrastColors ? this.highContrastColors.foreground : this.settings.textColor;
        let x = 0;
        let y = 0;
        let textAnchor = "start";

        // Parse position (e.g., "top-right", "center", "bottom-left")
        const [vertical, horizontal] = this.settings.labelPosition.split("-");

        // Calculate horizontal position
        if (horizontal === "left" || vertical === "left") {
            x = this.settings.labelPaddingLeft;
            textAnchor = "start";
        } else if (horizontal === "right" || vertical === "right") {
            x = this.settings.nodeWidth - this.settings.labelPaddingRight;
            textAnchor = "end";
        } else if (horizontal === "center" || vertical === "center") {
            x = this.settings.nodeWidth / 2;
            textAnchor = "middle";
        } else {
            // Default for middle-* positions
            if (vertical === "middle") {
                x = this.settings.nodeWidth - this.settings.labelPaddingRight;
                textAnchor = "end";
            } else {
                x = this.settings.nodeWidth / 2;
                textAnchor = "middle";
            }
        }

        // Calculate vertical position
        if (vertical === "top") {
            y = this.settings.labelFontSize + this.settings.labelPaddingTop;
        } else if (vertical === "bottom") {
            y = this.settings.nodeHeight - this.settings.labelPaddingBottom;
        } else if (vertical === "middle") {
            y = this.settings.nodeHeight / 2 + this.settings.labelFontSize * 0.35;
        } else {
            // Default to center vertical for center position
            y = this.settings.nodeHeight / 2 + this.settings.labelFontSize * 0.35;
        }

        // Create label text
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("class", "node-label");
        text.setAttribute("x", String(x));
        text.setAttribute("y", String(y));
        text.setAttribute("text-anchor", textAnchor);
        text.setAttribute("fill", labelColor);
        text.setAttribute("font-size", this.settings.labelFontSize + "px");
        text.setAttribute("font-weight", "bold");
        text.setAttribute("font-family", this.settings.fontFamily);
        text.style.pointerEvents = "none";
        text.textContent = this.settings.labelText;

        g.appendChild(text);
    }

    private wrapText(text: string, maxChars: number): string[] {
        if (!this.settings.wrapText || text.length <= maxChars) return [text];
        const lines: string[] = [];
        let remaining = text;
        while (remaining.length > 0) {
            if (remaining.length <= maxChars) { lines.push(remaining); break; }
            let breakPoint = maxChars;
            const searchStr = remaining.substring(0, maxChars + 1);
            const lastSpace = Math.max(searchStr.lastIndexOf(' '), searchStr.lastIndexOf('_'), searchStr.lastIndexOf('.'));
            if (lastSpace > maxChars * 0.6) breakPoint = lastSpace + 1;
            lines.push(remaining.substring(0, breakPoint).trim());
            remaining = remaining.substring(breakPoint).trim();
        }
        return lines;
    }

    private renderHeader(width: number): void {
        if (!this.currentData || !this.settings.showCounters) return;

        const rawSeparator = this.settings.headerCounterSeparator;
        const separator = rawSeparator === undefined || rawSeparator === null ? "|" : rawSeparator;
        const joiner = separator === "" ? " " : ` ${separator} `;
        const counterColor = this.isHighContrastMode && this.highContrastColors ? this.highContrastColors.foreground : this.settings.headerCounterColor;

        const stats: string[] = [];
        const nodesByLevel = new Map<number, number>();
        this.nodes.forEach(node => nodesByLevel.set(node.levelIndex, (nodesByLevel.get(node.levelIndex) || 0) + 1));
        this.currentData.columns.forEach((col, i) => stats.push(`${nodesByLevel.get(i) || 0} ${this.titleCase(col)}`));

        const totals = [`Nodes ${this.nodes.size}`, `Links ${this.links.length}`];
        const allCounters = [...totals, ...stats].filter(Boolean);

        if (!allCounters.length) return;

        const statsText = document.createElementNS("http://www.w3.org/2000/svg", "text");
        let statsX = 20;
        let statsAnchor: string = "start";
        if (this.settings.headerCounterAlignment === "center") {
            statsX = width / 2;
            statsAnchor = "middle";
        } else if (this.settings.headerCounterAlignment === "right") {
            statsX = width - 20;
            statsAnchor = "end";
        }
        statsText.setAttribute("x", String(statsX));
        statsText.setAttribute("y", "30");
        statsText.setAttribute("font-size", `${this.settings.headerCounterFontSize}px`);
        statsText.setAttribute("font-weight", this.settings.headerCounterFontWeight);
        statsText.setAttribute("font-family", this.settings.headerCounterFontFamily || this.settings.fontFamily);
        statsText.setAttribute("fill", counterColor);
        statsText.setAttribute("text-anchor", statsAnchor);
        statsText.textContent = allCounters.join(joiner);
        this.fixedHeader.appendChild(statsText);
    }

    private renderControls(width: number): void {
        const controlsGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        controlsGroup.setAttribute("class", "controls");
        controlsGroup.setAttribute("transform", `translate(${width - 200}, 10)`);

        const iconColor = this.isHighContrastMode && this.highContrastColors ? this.highContrastColors.foreground : "#64748b";
        const iconHoverColor = this.isHighContrastMode && this.highContrastColors ? this.highContrastColors.foreground : "#0078D4";

        const buttons = [
            {
                label: "Zoom In",
                action: () => this.zoomIn(),
                icon: "M12 5v14m-7-7h14" // Plus icon path
            },
            {
                label: "Zoom Out",
                action: () => this.zoomOut(),
                icon: "M5 12h14" // Minus icon path
            },
            {
                label: "Reset Zoom",
                action: () => this.resetZoom(),
                icon: "M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7c-2 0-3 1-3 3zm8 8V9m-3 3l3-3 3 3" // Reset icon
            },
            {
                label: "Fit to Screen",
                action: () => this.fitToScreen(),
                icon: "M4 8V6c0-1 0-2 2-2h2M4 16v2c0 1 0 2 2 2h2m8-16h2c1 0 2 0 2 2v2m0 8v2c0 1 0 2-2 2h-2" // Maximize icon
            }
        ];

        buttons.forEach((btn, i) => {
            const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
            g.setAttribute("transform", `translate(${i * 44}, 0)`);
            g.style.cursor = "pointer";
            g.setAttribute("tabindex", "0");
            g.setAttribute("role", "button");
            g.setAttribute("aria-label", btn.label);

            // Background circle
            const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circle.setAttribute("cx", "18");
            circle.setAttribute("cy", "18");
            circle.setAttribute("r", "16");
            circle.setAttribute("fill", this.isHighContrastMode && this.highContrastColors ? "none" : "#f8fafc");
            circle.setAttribute("stroke", this.isHighContrastMode && this.highContrastColors ? this.highContrastColors.foreground : "#e2e8f0");
            circle.setAttribute("stroke-width", "1.5");
            circle.setAttribute("opacity", "0.9");

            // Icon path
            const icon = document.createElementNS("http://www.w3.org/2000/svg", "path");
            icon.setAttribute("d", btn.icon);
            icon.setAttribute("stroke", iconColor);
            icon.setAttribute("stroke-width", "2");
            icon.setAttribute("stroke-linecap", "round");
            icon.setAttribute("stroke-linejoin", "round");
            icon.setAttribute("fill", "none");
            icon.setAttribute("transform", "translate(6, 6)");

            g.appendChild(circle);
            g.appendChild(icon);

            // Hover effects
            g.addEventListener("mouseenter", () => {
                circle.setAttribute("opacity", "1");
                circle.setAttribute("fill", this.isHighContrastMode && this.highContrastColors ? "none" : "#ffffff");
                circle.setAttribute("stroke", iconHoverColor);
                circle.setAttribute("stroke-width", "2");
                icon.setAttribute("stroke", iconHoverColor);
            });

            g.addEventListener("mouseleave", () => {
                circle.setAttribute("opacity", "0.9");
                circle.setAttribute("fill", this.isHighContrastMode && this.highContrastColors ? "none" : "#f8fafc");
                circle.setAttribute("stroke", this.isHighContrastMode && this.highContrastColors ? this.highContrastColors.foreground : "#e2e8f0");
                circle.setAttribute("stroke-width", "1.5");
                icon.setAttribute("stroke", iconColor);
            });

            g.addEventListener("click", btn.action);
            g.addEventListener("keydown", (e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    btn.action();
                }
            });

            controlsGroup.appendChild(g);
        });

        this.fixedHeader.appendChild(controlsGroup);
    }

    private updateLinkPaths(): void {
        const allLinks = this.mainGroup.querySelectorAll(".links path");
        allLinks.forEach(path => {
            const sourceId = path.getAttribute("data-source");
            const targetId = path.getAttribute("data-target");
            if (sourceId && targetId) {
                const source = this.nodes.get(sourceId);
                const target = this.nodes.get(targetId);
                if (source && target) {
                    const x1 = source.x + this.settings.nodeWidth;
                    const y1 = source.y + this.settings.nodeHeight / 2;
                    const x2 = target.x;
                    const y2 = target.y + this.settings.nodeHeight / 2;
                    path.setAttribute("d", this.generateLinkPath(x1, y1, x2, y2));
                }
            }
        });
    }

    private highlightLinksForNode(nodeId: string, highlight: boolean): void {
        const allLinks = this.mainGroup.querySelectorAll(".links path");
        allLinks.forEach(path => {
            const sourceId = path.getAttribute("data-source");
            const targetId = path.getAttribute("data-target");
            if (sourceId === nodeId || targetId === nodeId) {
                const storedWidth = path.getAttribute("data-link-width");
                const baseWidth = storedWidth ? parseFloat(storedWidth) : this.settings.linkWidth;
                if (highlight) {
                    path.setAttribute("opacity", "0.4");
                    path.setAttribute("stroke-width", String(baseWidth * 1.5));
                } else {
                    path.setAttribute("opacity", "0.05");
                    path.setAttribute("stroke-width", String(baseWidth));
                }
            }
        });
    }

    private applyHighlightEffect(): void {
        const allNodes = this.mainGroup.querySelectorAll(".node");
        const allLinks = this.mainGroup.querySelectorAll(".links path");
        if (this.selectedNodes.size === 0) {
            allNodes.forEach(node => {
                const shape = node.querySelector(".node-shape");
                const texts = node.querySelectorAll("text");
                const circles = node.querySelectorAll("circle");
                if (shape) { shape.setAttribute("opacity", String(this.settings.nodeFillOpacity / 100)); shape.setAttribute("stroke-width", String(this.settings.nodeBorderWidth)); }
                texts.forEach(t => t.setAttribute("opacity", "1"));
                circles.forEach(c => c.setAttribute("opacity", "1"));
            });
            allLinks.forEach(path => {
                const storedWidth = path.getAttribute("data-link-width");
                const width = storedWidth ? parseFloat(storedWidth) : this.settings.linkWidth;
                const linkOpacity = this.getLinkOpacity();
                path.setAttribute("opacity", String(linkOpacity));
                path.setAttribute("stroke-width", String(width));
            });
        }
    }

    private highlightConnections(nodeId: string, isCtrlClick: boolean = false): void {
        if (!this.allowInteractions) return;
        if (isCtrlClick) {
            if (this.selectedNodes.has(nodeId)) this.selectedNodes.delete(nodeId);
            else this.selectedNodes.add(nodeId);
            if (this.selectedNodes.size === 0) { this.resetHighlight(); return; }
        } else {
            if (this.selectedNodes.size === 1 && this.selectedNodes.has(nodeId)) { this.resetHighlight(); this.lastClickedNode = null; return; }
            this.selectedNodes.clear();
            this.selectedNodes.add(nodeId);
        }
        this.lastClickedNode = nodeId;
        if (!this.currentData) return;

        const filteredRows = this.currentData.rows.filter(row => {
            for (const selectedId of this.selectedNodes) {
                const selectedNode = this.nodes.get(selectedId);
                if (selectedNode) {
                    const valueAtLevel = this.normalizeValue(row[selectedNode.levelIndex]);
                    if (valueAtLevel === selectedNode.value) return true;
                }
            }
            return false;
        });

        // Get row indices for filtered rows (needed for measure aggregation)
        const filteredRowIndices = this.getFilteredRowIndices(filteredRows);

        const connected = new Set<string>();
        const filteredLinkPairs = new Set<string>();
        const columns = this.currentData.columns;

        filteredRows.forEach(row => {
            columns.forEach((_, levelIndex) => {
                const value = this.normalizeValue(row[levelIndex]);
                if (value !== '') connected.add(this.makeId(levelIndex, value));
            });
            for (let i = 0; i < columns.length - 1; i++) {
                const sourceVal = this.normalizeValue(row[i]);
                const targetVal = this.normalizeValue(row[i + 1]);
                if (sourceVal !== '' && targetVal !== '') {
                    filteredLinkPairs.add(`${this.makeId(i, sourceVal)}->${this.makeId(i + 1, targetVal)}`);
                }
            }
        });

        this.connectedNodes = connected;

        const filteredOutNeighbors = new Map<string, Set<string>>();
        const filteredInNeighbors = new Map<string, Set<string>>();
        connected.forEach(id => { filteredOutNeighbors.set(id, new Set()); filteredInNeighbors.set(id, new Set()); });
        filteredLinkPairs.forEach(pair => {
            const [sourceId, targetId] = pair.split('->');
            filteredOutNeighbors.get(sourceId)?.add(targetId);
            filteredInNeighbors.get(targetId)?.add(sourceId);
        });

        const height = parseFloat(this.svg.getAttribute("height") || "600");
        const nodesByLevel = new Map<number, SankeyNode[]>();
        this.nodes.forEach(node => {
            if (!nodesByLevel.has(node.levelIndex)) nodesByLevel.set(node.levelIndex, []);
            nodesByLevel.get(node.levelIndex)!.push(node);
        });

        columns.forEach((_, levelIndex) => {
            const levelNodes = nodesByLevel.get(levelIndex) || [];
            levelNodes.sort((a, b) => {
                const aConnected = connected.has(a.id);
                const bConnected = connected.has(b.id);
                if (aConnected && !bConnected) return -1;
                if (!aConnected && bConnected) return 1;
                return b.count - a.count;
            });
            const x = 100 + levelIndex * this.settings.levelSpacing;
            const totalHeight = levelNodes.length * this.settings.nodeSpacing;
            const startY = Math.max(100, (height - totalHeight) / 2);
            levelNodes.forEach((node, index) => { node.x = x; node.y = startY + index * this.settings.nodeSpacing; });
        });

        this.mainGroup.querySelectorAll(".node").forEach(nodeEl => {
            const id = nodeEl.getAttribute("data-node-id");
            if (id) {
                const node = this.nodes.get(id);
                if (node) (nodeEl as SVGGElement).setAttribute("transform", `translate(${node.x},${node.y})`);
            }
        });

        this.updateLinkPaths();

        const allNodes = this.mainGroup.querySelectorAll(".node");
        const shadowOn = this.settings.nodeShadowEnabled;
        if (shadowOn) this.ensureSoftShadowFilter();
        allNodes.forEach(node => {
            const shape = node.querySelector(".node-shape");
            const texts = node.querySelectorAll("text");
            const circles = node.querySelectorAll("circle");
            if (shape) {
                const low = shadowOn ? 1 : 0.2; // keep full opacity when shadows enabled to preserve glow
                shape.setAttribute("opacity", String(low));
                shape.setAttribute("stroke-width", String(this.settings.nodeBorderWidth));
                if (shadowOn) shape.setAttribute("filter", "url(#node-shadow)");
            }
            texts.forEach(t => t.setAttribute("opacity", "0.3"));
            circles.forEach(c => c.setAttribute("opacity", "0.3"));
        });

        const allLinks = this.mainGroup.querySelectorAll(".links path");
        allLinks.forEach(path => {
            const storedWidth = path.getAttribute("data-link-width");
            const width = storedWidth ? parseFloat(storedWidth) : this.settings.linkWidth;
            path.setAttribute("opacity", "0.05");
            path.setAttribute("stroke-width", String(width));
        });

        allNodes.forEach(node => {
            const id = node.getAttribute("data-node-id");
            if (id && connected.has(id)) {
                const shape = node.querySelector(".node-shape");
                const texts = node.querySelectorAll("text");
                const circles = node.querySelectorAll("circle");
                if (shape) {
                    shape.setAttribute("opacity", "1");
                    shape.setAttribute("stroke-width", this.selectedNodes.has(id) ? String(this.settings.nodeBorderWidth + 2) : String(this.settings.nodeBorderWidth + 1));
                    if (this.settings.nodeShadowEnabled) {
                        this.ensureSoftShadowFilter();
                        shape.setAttribute("filter", "url(#node-shadow)");
                    }
                }
                texts.forEach(t => t.setAttribute("opacity", "1"));
                circles.forEach(c => c.setAttribute("opacity", "1"));
                if (this.settings.showValues) {
                    const badgeText = node.querySelector(".badge-count") as SVGTextElement;
                    if (badgeText) {
                        let filteredCount = 0;
                        if (this.settings.countMode === 'out') filteredCount = filteredOutNeighbors.get(id)?.size || 0;
                        else if (this.settings.countMode === 'in') filteredCount = filteredInNeighbors.get(id)?.size || 0;
                        else filteredCount = (filteredOutNeighbors.get(id)?.size || 0) + (filteredInNeighbors.get(id)?.size || 0);

                        // Use helper to respect measure display mode
                        const displayValue = this.calculateBadgeDisplayValue(id, filteredRowIndices, filteredCount);
                        badgeText.textContent = displayValue;
                    }
                }
            }
        });

        allLinks.forEach(path => {
            const source = path.getAttribute("data-source");
            const target = path.getAttribute("data-target");
            if (source && target && filteredLinkPairs.has(`${source}->${target}`)) {
                const storedWidth = path.getAttribute("data-link-width");
                const baseWidth = storedWidth ? parseFloat(storedWidth) : this.settings.linkWidth;
                const highlightOpacity = Math.max(this.normalizeOpacity(this.settings.highlightOpacity), this.getLinkOpacity());
                path.setAttribute("opacity", String(highlightOpacity));
                path.setAttribute("stroke-width", String(baseWidth * 1.5));
            }
        });
        this.applyShadowToAllNodes();
    }

    private resetHighlight(): void {
        this.selectionManager.clear();
        this.lastClickedNode = null;
        this.selectedNodes.clear();
        this.connectedNodes.clear();

        if (this.currentData) {
            const height = parseFloat(this.svg.getAttribute("height") || "600");
            const columns = this.currentData.columns;
            const nodesByLevel = new Map<number, SankeyNode[]>();
            this.nodes.forEach(node => {
                if (!nodesByLevel.has(node.levelIndex)) nodesByLevel.set(node.levelIndex, []);
                nodesByLevel.get(node.levelIndex)!.push(node);
            });
            nodesByLevel.forEach(nodes => nodes.sort((a, b) => b.count - a.count));
            columns.forEach((_, levelIndex) => {
                const levelNodes = nodesByLevel.get(levelIndex) || [];
                const x = 100 + levelIndex * this.settings.levelSpacing;
                const totalHeight = levelNodes.length * this.settings.nodeSpacing;
                const startY = Math.max(100, (height - totalHeight) / 2);
                levelNodes.forEach((node, index) => { node.x = x; node.y = startY + index * this.settings.nodeSpacing; });
            });
            this.mainGroup.querySelectorAll(".node").forEach(nodeEl => {
                const id = nodeEl.getAttribute("data-node-id");
                if (id) {
                    const node = this.nodes.get(id);
                    if (node) (nodeEl as SVGGElement).setAttribute("transform", `translate(${node.x},${node.y})`);
                }
            });
            this.updateLinkPaths();
        }

        const allNodes = this.mainGroup.querySelectorAll(".node");
        const shadowOn = this.settings.nodeShadowEnabled;
        if (shadowOn) this.ensureSoftShadowFilter();
        allNodes.forEach(node => {
            const shape = node.querySelector(".node-shape");
            const texts = node.querySelectorAll("text");
            const circles = node.querySelectorAll("circle");
            if (shape) {
                shape.setAttribute("opacity", String(this.settings.nodeFillOpacity / 100));
                shape.setAttribute("stroke-width", String(this.settings.nodeBorderWidth));
                if (shadowOn) shape.setAttribute("filter", "url(#node-shadow)");
            }
            texts.forEach(t => t.setAttribute("opacity", "1"));
            circles.forEach(c => c.setAttribute("opacity", "1"));
            if (this.settings.showValues) {
                const id = node.getAttribute("data-node-id");
                const badgeText = node.querySelector(".badge-count") as SVGTextElement;
                if (id && badgeText) {
                    const originalNode = this.nodes.get(id);
                    if (originalNode) {
                        // Respect measure display mode
                        const shouldShowMeasure = this.hasMeasure &&
                                                 originalNode.displayValue !== undefined &&
                                                 (this.settings.measureDisplayMode === "badge" ||
                                                  this.settings.measureDisplayMode === "both");

                        badgeText.textContent = shouldShowMeasure
                            ? this.formatMeasureValue(originalNode.displayValue)
                            : String(originalNode.count);
                    }
                }
            }
        });

        const allLinks = this.mainGroup.querySelectorAll(".links path");
        allLinks.forEach(path => {
            const storedWidth = path.getAttribute("data-link-width");
            const width = storedWidth ? parseFloat(storedWidth) : this.settings.linkWidth;
            path.setAttribute("opacity", String(this.getLinkOpacity()));
            path.setAttribute("stroke-width", String(width));
        });
        this.applyShadowToAllNodes();
    }

    private zoomIn(): void { this.zoomScale = Math.min(8, this.zoomScale * 1.3); this.updateTransform(); }
    private zoomOut(): void { this.zoomScale = Math.max(0.05, this.zoomScale * 0.7); this.updateTransform(); }
    private resetZoom(): void { this.zoomScale = 1; this.translateX = 0; this.translateY = 0; this.updateTransform(); }

    private fitToScreen(): void {
        const bbox = this.mainGroup.getBBox();
        const width = parseFloat(this.svg.getAttribute("width") || "0");
        const height = parseFloat(this.svg.getAttribute("height") || "0");
        if (bbox.width === 0 || bbox.height === 0) return;
        const scale = 0.85 / Math.max(bbox.width / width, bbox.height / height);
        this.zoomScale = scale;
        this.translateX = width / 2 - scale * (bbox.x + bbox.width / 2);
        this.translateY = height / 2 - scale * (bbox.y + bbox.height / 2);
        this.updateTransform();
    }

    private renderEmptyState(): void {
        while (this.mainGroup.firstChild) this.mainGroup.removeChild(this.mainGroup.firstChild);
        while (this.fixedHeader.firstChild) this.fixedHeader.removeChild(this.fixedHeader.firstChild);
        const width = parseFloat(this.svg.getAttribute("width") || "800");
        const height = parseFloat(this.svg.getAttribute("height") || "600");
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", String(width / 2));
        text.setAttribute("y", String(height / 2));
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("font-size", "16px");
        text.setAttribute("font-family", this.settings.fontFamily);
        text.setAttribute("fill", this.isHighContrastMode && this.highContrastColors ? this.highContrastColors.foreground : "#666");
        text.textContent = this.localizationManager.getDisplayName("Visual_NoData") || "No data available. Please add fields to the visual.";
        this.mainGroup.appendChild(text);
    }

    private renderError(message: string): void {
        while (this.mainGroup.firstChild) this.mainGroup.removeChild(this.mainGroup.firstChild);
        while (this.fixedHeader.firstChild) this.fixedHeader.removeChild(this.fixedHeader.firstChild);
        const width = parseFloat(this.svg.getAttribute("width") || "800");
        const height = parseFloat(this.svg.getAttribute("height") || "600");
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", String(width / 2));
        text.setAttribute("y", String(height / 2));
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("font-size", "14px");
        text.setAttribute("font-family", this.settings.fontFamily);
        text.setAttribute("fill", "#E74856");
        text.textContent = `${this.localizationManager.getDisplayName("Visual_Error") || "Error"}: ${message}`;
        this.mainGroup.appendChild(text);
    }
}

export class StreamLinks extends Visual { }
export default StreamLinks;

