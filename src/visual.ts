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
    textColor: string;
    wrapText: boolean;
    maxCharsPerLine: number;
    showValues: boolean;
    badgeTextSize: number;
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
    showEmptyPlaceholder: boolean;
    showCounters: boolean;
    headerCounterFontSize: number;
    headerCounterFontFamily: string;
    headerCounterFontWeight: string;
    headerCounterColor: string;
    headerCounterSeparator: string;
    showControls: boolean;
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
}

interface SankeyLink {
    source: string;
    target: string;
    count: number;
    color: string;
    sourceColor?: string;
    targetColor?: string;
}

interface TableData {
    columns: string[];
    rows: any[][];
    highlights?: any[][];
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
    private readonly presetIds: string[] = [
        "professionalBlue",
        "vibrantSpectrum",
        "neon",
        "earthTones",
        "pastel",
        "angularTech",
        "gradientFlow",
        "midnightPro",
        "popArt",
        "nordicMinimal",
        "softGlass",
        "monoBrutal",
        "auroraFlow"
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
    private previousPreset: string = "professionalBlue";
    private copyHandler: ((e: ClipboardEvent) => void) | null = null;
    private currentDrillLevel: number = 0;
    private maxDrillLevel: number = 0;
    private isDrillMode: boolean = false;
    private previousFieldCount: number = 0;
    private lastViewportWidth: number = 0;
    private lastViewportHeight: number = 0;
    private justSwitchedPreset: boolean = false;

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
            textColor: this.isHighContrastMode && this.highContrastColors ? this.highContrastColors.foreground : "#ffffff",
            wrapText: true,
            maxCharsPerLine: 28,
            showValues: true,
            badgeTextSize: 8,
            badgePosition: "top-right",
            badgePaddingTop: 0,
            badgePaddingRight: 0,
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
            lineOpacity: 0.3,
            linkWidth: 2,
            highlightOpacity: 0.8,
            linkStyle: "solid",
            linkColorMode: "gradient",
            customLinkColor: "#888888",
            linkCurveStyle: "bezier",
            showStartMarker: false,
            startMarkerType: "circle",
            startMarkerSize: 6,
            showEndMarker: true,
            endMarkerType: "arrow",
            endMarkerSize: 8,
            useCustomMarkerColors: false,
            startMarkerColor: "#0078D4",
            endMarkerColor: "#0078D4",
            colors: ["#0078D4", "#50E6FF", "#106EBE", "#005A9E", "#74B4E7", "#004578", "#96C9F4", "#003B5C"],
            showEmptyPlaceholder: true,
            showCounters: true,
            headerCounterFontSize: 11,
            headerCounterFontFamily: "Segoe UI, -apple-system, BlinkMacSystemFont, sans-serif",
            headerCounterFontWeight: "bold",
            headerCounterColor: "#4b5563",
            headerCounterSeparator: "|",
            showControls: true
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
            background-color: ${this.isHighContrastMode && this.highContrastColors ? this.highContrastColors.background : '#ffffff'};
        `;
        this.container.setAttribute("tabindex", "0");
        this.container.setAttribute("role", "application");
        this.container.setAttribute("aria-label", this.localizationManager.getDisplayName("Visual_LandingPage_Title") || "Advanced Sankey Chart");

        this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        this.svg.style.cssText = "width: 100%; height: 100%; display: block;";
        this.svg.setAttribute("role", "img");
        this.svg.setAttribute("aria-label", "Sankey diagram visualization");

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
        const title = this.localizationManager.getDisplayName("Visual_LandingPage_Title") || "Advanced Sankey Chart";
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
        switch (presetValue) {
            case "professionalBlue":
                // Professional Blue - Clean, corporate, Microsoft-inspired
                this.settings.colors = ["#0078D4", "#50E6FF", "#106EBE", "#005A9E", "#74B4E7", "#004578", "#96C9F4", "#003B5C"];
                this.settings.nodeShape = "roundedRect";
                this.settings.cornerRadius = 8;
                this.settings.nodeFillOpacity = 90;
                this.settings.nodeBorderStyle = "solid";
                this.settings.nodeBorderWidth = 2;
                this.settings.useCustomBorderColor = true;
                this.settings.nodeBorderColor = "#003B5C";
                this.settings.textColor = "#FFFFFF";
                this.settings.fontSize = 10;
                this.settings.fontFamily = "Segoe UI";
                this.settings.nodeHeight = 50;
                this.settings.nodeSpacing = 60;
                this.settings.levelSpacing = 280;
                this.settings.linkCurveStyle = "bezier";
                this.settings.linkColorMode = "gradient";
                this.settings.lineOpacity = 0.3;
                this.settings.linkWidth = 2;
                this.settings.linkStyle = "solid";
                this.settings.showStartMarker = false;
                this.settings.showEndMarker = true;
                this.settings.endMarkerType = "arrow";
                this.settings.endMarkerSize = 8;
                this.settings.useCustomMarkerColors = false;
                this.settings.showControls = true;
                this.settings.showValues = true;
                break;

            case "vibrantSpectrum":
                // Vibrant Spectrum - Eye-catching, diverse, rainbow progression
                this.settings.colors = ["#E74856", "#FF8C00", "#FFB900", "#00CC6A", "#00B7C3", "#0078D4", "#8764B8", "#E3008C"];
                this.settings.nodeShape = "pill";
                this.settings.nodeFillOpacity = 95;
                this.settings.nodeBorderStyle = "solid";
                this.settings.nodeBorderWidth = 3;
                this.settings.useCustomBorderColor = true;
                this.settings.nodeBorderColor = "#000000";
                this.settings.textColor = "#FFFFFF";
                this.settings.fontSize = 11;
                this.settings.fontFamily = "Segoe UI";
                this.settings.nodeHeight = 50;
                this.settings.nodeSpacing = 60;
                this.settings.levelSpacing = 280;
                this.settings.linkCurveStyle = "bezier";
                this.settings.linkColorMode = "source";
                this.settings.lineOpacity = 0.35;
                this.settings.linkWidth = 2.5;
                this.settings.linkStyle = "solid";
                this.settings.showStartMarker = false;
                this.settings.showEndMarker = true;
                this.settings.endMarkerType = "arrow";
                this.settings.endMarkerSize = 8;
                this.settings.useCustomMarkerColors = false;
                this.settings.showControls = true;
                this.settings.showValues = true;
                break;

            case "neon":
                // Neon Dark Mode - Dark background-friendly, glowing effect
                this.settings.colors = ["#00F5FF", "#39FF14", "#FF10F0", "#FFFF00", "#FF006E", "#8A2BE2", "#FF4500", "#00FFFF"];
                this.settings.nodeShape = "pill";
                this.settings.nodeFillOpacity = 90;
                this.settings.nodeBorderStyle = "none";
                this.settings.nodeBorderWidth = 0;
                this.settings.useCustomBorderColor = false;
                this.settings.textColor = "#000000";
                this.settings.fontSize = 10;
                this.settings.fontFamily = "Segoe UI";
                this.settings.nodeHeight = 50;
                this.settings.nodeSpacing = 80;
                this.settings.levelSpacing = 320;
                this.settings.linkCurveStyle = "bezier";
                this.settings.linkColorMode = "gradient";
                this.settings.lineOpacity = 0.8;
                this.settings.highlightOpacity = 0.95;
                this.settings.linkWidth = 2.5;
                this.settings.linkStyle = "solid";
                this.settings.showStartMarker = true;
                this.settings.startMarkerType = "arrow";
                this.settings.startMarkerSize = 10;
                this.settings.showEndMarker = true;
                this.settings.endMarkerType = "arrow";
                this.settings.endMarkerSize = 10;
                this.settings.useCustomMarkerColors = false;
                this.settings.showControls = true;
                this.settings.showValues = true;
                break;

            case "earthTones":
                // Earth Tones - Warm, distinct earthy palette (less gradient-like)
                this.settings.colors = ["#5D3A00", "#A05A2C", "#C68A47", "#D9B382", "#4F6B2A", "#7DA45A", "#A26A5E", "#8C5319"];
                this.settings.nodeShape = "roundedRect";
                this.settings.cornerRadius = 6;
                this.settings.nodeFillOpacity = 92;
                this.settings.nodeBorderStyle = "solid";
                this.settings.nodeBorderWidth = 2;
                this.settings.useCustomBorderColor = true;
                this.settings.nodeBorderColor = "#3E2723";
                this.settings.textColor = "#FFFFFF";
                this.settings.fontSize = 10;
                this.settings.fontFamily = "Georgia";
                this.settings.nodeHeight = 50;
                this.settings.nodeSpacing = 60;
                this.settings.levelSpacing = 280;
                this.settings.linkCurveStyle = "bezier";
                this.settings.linkColorMode = "source";
                this.settings.lineOpacity = 0.35;
                this.settings.linkWidth = 2.0;
                this.settings.linkStyle = "solid";
                this.settings.showStartMarker = false;
                this.settings.showEndMarker = true;
                this.settings.endMarkerType = "diamond";
                this.settings.endMarkerSize = 7;
                this.settings.useCustomMarkerColors = false;
                this.settings.showControls = true;
                this.settings.showValues = true;
                break;

            case "pastel":
                // Pastel Soft - Gentle, easy on eyes, dashboard-friendly
                this.settings.colors = ["#B39DDB", "#90CAF9", "#80CBC4", "#A5D6A7", "#FFF59D", "#FFAB91", "#F48FB1", "#CE93D8"];
                this.settings.nodeShape = "pill";
                this.settings.nodeFillOpacity = 75;
                this.settings.nodeBorderStyle = "solid";
                this.settings.nodeBorderWidth = 1.5;
                this.settings.useCustomBorderColor = true;
                this.settings.nodeBorderColor = "#9E9E9E";
                this.settings.textColor = "#424242";
                this.settings.fontSize = 10;
                this.settings.fontFamily = "Segoe UI";
                this.settings.nodeHeight = 50;
                this.settings.nodeSpacing = 60;
                this.settings.levelSpacing = 280;
                this.settings.linkCurveStyle = "bezier";
                this.settings.linkColorMode = "gradient";
                this.settings.lineOpacity = 0.35;
                this.settings.linkWidth = 2.0;
                this.settings.linkStyle = "solid";
                this.settings.showStartMarker = true;
                this.settings.startMarkerType = "circle";
                this.settings.startMarkerSize = 4;
                this.settings.showEndMarker = true;
                this.settings.endMarkerType = "circle";
                this.settings.endMarkerSize = 4;
                this.settings.useCustomMarkerColors = false;
                this.settings.showControls = true;
                this.settings.showValues = true;
                break;

            case "angularTech":
                // Angular Tech - Sharp, geometric, tech-forward
                this.settings.colors = ["#00BCD4", "#009688", "#4CAF50", "#8BC34A", "#CDDC39", "#FFC107", "#FF9800", "#FF5722"];
                this.settings.nodeShape = "roundedRect";
                this.settings.cornerRadius = 2;
                this.settings.nodeFillOpacity = 92;
                this.settings.nodeBorderStyle = "solid";
                this.settings.nodeBorderWidth = 2;
                this.settings.useCustomBorderColor = true;
                this.settings.nodeBorderColor = "#263238";
                this.settings.textColor = "#FFFFFF";
                this.settings.fontSize = 10;
                this.settings.fontFamily = "Consolas";
                this.settings.nodeHeight = 48;
                this.settings.nodeSpacing = 55;
                this.settings.levelSpacing = 270;
                this.settings.linkCurveStyle = "step";
                this.settings.linkColorMode = "target";
                this.settings.lineOpacity = 0.4;
                this.settings.linkWidth = 2;
                this.settings.linkStyle = "solid";
                this.settings.showStartMarker = true;
                this.settings.startMarkerType = "circle";
                this.settings.startMarkerSize = 6;
                this.settings.showEndMarker = true;
                this.settings.endMarkerType = "arrow";
                this.settings.endMarkerSize = 8;
                this.settings.useCustomMarkerColors = false;
                this.settings.showControls = true;
                this.settings.showValues = true;
                break;

            case "gradientFlow":
                // Gradient Flow - Smooth color transitions, modern aesthetic
                this.settings.colors = ["#667EEA", "#764BA2", "#F093FB", "#4FACFE", "#00F2FE", "#43E97B", "#38F9D7", "#FA709A"];
                this.settings.nodeShape = "pill";
                this.settings.nodeFillOpacity = 88;
                this.settings.nodeBorderStyle = "none";
                this.settings.nodeBorderWidth = 0;
                this.settings.useCustomBorderColor = false;
                this.settings.textColor = "#FFFFFF";
                this.settings.fontSize = 10;
                this.settings.fontFamily = "Segoe UI";
                this.settings.nodeHeight = 52;
                this.settings.nodeSpacing = 70;
                this.settings.levelSpacing = 300;
                this.settings.linkCurveStyle = "bezier";
                this.settings.linkColorMode = "gradient";
                this.settings.lineOpacity = 0.5;
                this.settings.linkWidth = 2.5;
                this.settings.linkStyle = "solid";
                this.settings.showStartMarker = false;
                this.settings.showEndMarker = true;
                this.settings.endMarkerType = "arrow";
                this.settings.endMarkerSize = 8;
                this.settings.useCustomMarkerColors = false;
                this.settings.showControls = true;
                this.settings.showValues = true;
                break;

            case "midnightPro":
                // Midnight Pro - Deep indigos, SaaS dark-mode inspired
                this.settings.colors = ["#5E6AD2", "#8B5CF6", "#3B82F6", "#6366F1", "#2563EB", "#1D4ED8", "#1E40AF", "#1E3A8A"];
                this.settings.nodeShape = "roundedRect";
                this.settings.cornerRadius = 6;
                this.settings.nodeFillOpacity = 100;
                this.settings.nodeBorderStyle = "solid";
                this.settings.nodeBorderWidth = 1;
                this.settings.useCustomBorderColor = true;
                this.settings.nodeBorderColor = "#4338CA";
                this.settings.textColor = "#FFFFFF";
                this.settings.fontSize = 11;
                this.settings.fontFamily = "Inter, sans-serif";
                this.settings.nodeHeight = 46;
                this.settings.nodeSpacing = 60;
                this.settings.levelSpacing = 280;
                this.settings.linkCurveStyle = "bezier";
                this.settings.linkColorMode = "gradient";
                this.settings.lineOpacity = 0.4;
                this.settings.linkWidth = 1.5;
                this.settings.linkStyle = "solid";
                this.settings.showStartMarker = false;
                this.settings.showEndMarker = true;
                this.settings.endMarkerType = "arrow";
                this.settings.endMarkerSize = 6;
                this.settings.useCustomMarkerColors = false;
                this.settings.showControls = true;
                this.settings.showValues = true;
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
                this.settings.textColor = "#FFFFFF";
                this.settings.fontSize = 12;
                this.settings.fontFamily = "Quicksand, sans-serif";
                this.settings.nodeHeight = 54;
                this.settings.nodeSpacing = 65;
                this.settings.levelSpacing = 280;
                this.settings.linkCurveStyle = "bezier";
                this.settings.linkColorMode = "source";
                this.settings.lineOpacity = 1.0;
                this.settings.linkWidth = 2.5;
                this.settings.linkStyle = "solid";
                this.settings.showStartMarker = false;
                this.settings.showEndMarker = true;
                this.settings.endMarkerType = "arrow";
                this.settings.endMarkerSize = 8;
                this.settings.useCustomMarkerColors = false;
                this.settings.showControls = true;
                this.settings.showValues = true;
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
                this.settings.textColor = "#00FF94";
                this.settings.fontSize = 10;
                this.settings.fontFamily = "JetBrains Mono, monospace";
                this.settings.nodeHeight = 44;
                this.settings.nodeSpacing = 80;
                this.settings.levelSpacing = 320;
                this.settings.linkCurveStyle = "step";
                this.settings.linkColorMode = "target";
                this.settings.lineOpacity = 0.6;
                this.settings.linkWidth = 1.0;
                this.settings.linkStyle = "solid";
                this.settings.showStartMarker = true;
                this.settings.startMarkerType = "square";
                this.settings.startMarkerSize = 4;
                this.settings.showEndMarker = true;
                this.settings.endMarkerType = "square";
                this.settings.endMarkerSize = 4;
                this.settings.useCustomMarkerColors = true;
                this.settings.startMarkerColor = this.settings.nodeBorderColor;
                this.settings.endMarkerColor = this.settings.nodeBorderColor;
                this.settings.showControls = true;
                this.settings.showValues = true;
                break;

            case "nordicMinimal":
                // Nordic Minimal - Muted earthy tones, matte finish
                this.settings.colors = ["#4C566A", "#5E81AC", "#81A1C1", "#88C0D0", "#A3BE8C", "#EBCB8B", "#D08770", "#BF616A"];
                this.settings.nodeShape = "roundedRect";
                this.settings.cornerRadius = 4;
                this.settings.nodeFillOpacity = 90;
                this.settings.nodeBorderStyle = "none";
                this.settings.nodeBorderWidth = 0;
                this.settings.useCustomBorderColor = false;
                this.settings.textColor = "#ECEFF4";
                this.settings.fontSize = 11;
                this.settings.fontFamily = "Roboto Slab, serif";
                this.settings.nodeHeight = 48;
                this.settings.nodeSpacing = 60;
                this.settings.levelSpacing = 280;
                this.settings.linkCurveStyle = "bezier";
                this.settings.linkColorMode = "source";
                this.settings.lineOpacity = 0.25;
                this.settings.linkWidth = 2;
                this.settings.linkStyle = "solid";
                this.settings.showStartMarker = false;
                this.settings.showEndMarker = true;
                this.settings.endMarkerType = "circle";
                this.settings.endMarkerSize = 5;
                this.settings.useCustomMarkerColors = false;
                this.settings.showControls = true;
                this.settings.showValues = true;
                break;

            case "softGlass":
                // Soft Glass - Glassmorphic pastel pills
                this.settings.colors = ["#93C5FD", "#C4B5FD", "#FCA5A5", "#6EE7B7", "#FDBA74", "#D8B4FE", "#FCD34D", "#86EFAC"];
                this.settings.nodeShape = "pill";
                this.settings.cornerRadius = 20;
                this.settings.nodeFillOpacity = 40;
                this.settings.nodeBorderStyle = "solid";
                this.settings.nodeBorderWidth = 1;
                this.settings.useCustomBorderColor = true;
                this.settings.nodeBorderColor = "rgba(0,0,0,0.1)";
                this.settings.textColor = "#334155";
                this.settings.fontSize = 10;
                this.settings.fontFamily = "SF Pro Text, sans-serif";
                this.settings.nodeHeight = 44;
                this.settings.nodeSpacing = 55;
                this.settings.levelSpacing = 280;
                this.settings.linkCurveStyle = "bezier";
                this.settings.linkColorMode = "gradient";
                this.settings.lineOpacity = 0.3;
                this.settings.linkWidth = 2;
                this.settings.linkStyle = "solid";
                this.settings.showStartMarker = false;
                this.settings.showEndMarker = true;
                this.settings.endMarkerType = "arrow";
                this.settings.endMarkerSize = 7;
                this.settings.useCustomMarkerColors = false;
                this.settings.showControls = true;
                this.settings.showValues = true;
                break;

            case "monoBrutal":
                // Mono Brutal - Stark contrast, heavy strokes (avoid white fill/text clash)
                this.settings.colors = ["#0A0A0A", "#1A1A1A", "#2B2B2B", "#3C3C3C", "#4D4D4D", "#5E5E5E", "#777777", "#8F8F8F"];
                this.settings.nodeShape = "roundedRect";
                this.settings.cornerRadius = 0;
                this.settings.nodeFillOpacity = 100;
                this.settings.nodeBorderStyle = "solid";
                this.settings.nodeBorderWidth = 3;
                this.settings.useCustomBorderColor = true;
                this.settings.nodeBorderColor = "#000000";
                this.settings.textColor = "#FFFFFF";
                this.settings.fontSize = 11;
                this.settings.fontFamily = "Courier Prime, monospace";
                this.settings.nodeHeight = 50;
                this.settings.nodeSpacing = 60;
                this.settings.levelSpacing = 270;
                this.settings.linkCurveStyle = "step";
                this.settings.linkColorMode = "target";
                this.settings.lineOpacity = 1.0;
                this.settings.linkWidth = 3;
                this.settings.linkStyle = "solid";
                this.settings.showStartMarker = true;
                this.settings.startMarkerType = "square";
                this.settings.startMarkerSize = 8;
                this.settings.showEndMarker = true;
                this.settings.endMarkerType = "arrow";
                this.settings.endMarkerSize = 10;
                this.settings.useCustomMarkerColors = false;
                this.settings.showControls = true;
                this.settings.showValues = true;
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
                this.settings.textColor = "#FFFFFF";
                this.settings.fontSize = 11;
                this.settings.fontFamily = "Montserrat, sans-serif";
                this.settings.nodeHeight = 52;
                this.settings.nodeSpacing = 70;
                this.settings.levelSpacing = 300;
                this.settings.linkCurveStyle = "bezier";
                this.settings.linkColorMode = "gradient";
                this.settings.lineOpacity = 0.5;
                this.settings.linkWidth = 4;
                this.settings.linkStyle = "solid";
                this.settings.showStartMarker = false;
                this.settings.showEndMarker = false;
                this.settings.useCustomMarkerColors = false;
                this.settings.showControls = true;
                this.settings.showValues = true;
                break;

            default:
                // If unknown preset, use professionalBlue
                this.applyStylePreset("professionalBlue");
                break;
        }
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
        this.settings = this.getPresetDefaults(resolvedPreset);
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

    private updateSettingsFromModel(dataView: powerbi.DataView): void {
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

            const text = ns.text as any;
            if (nodeObjects["fontSize"] !== undefined) this.settings.fontSize = text?.fontSize?.value ?? defaults.fontSize;
            if (nodeObjects["fontFamily"] !== undefined) this.settings.fontFamily = text?.fontFamily?.value?.value ?? text?.fontFamily?.value ?? defaults.fontFamily;
            if (nodeObjects["textColor"] !== undefined) this.settings.textColor = text?.textColor?.value?.value ?? defaults.textColor;
            if (nodeObjects["wrapText"] !== undefined) this.settings.wrapText = text?.wrapText?.value ?? defaults.wrapText;
            if (nodeObjects["maxCharsPerLine"] !== undefined) this.settings.maxCharsPerLine = text?.maxCharsPerLine?.value ?? defaults.maxCharsPerLine;

            const counts = ns.connectionCounts as any;
            if (nodeObjects["showValues"] !== undefined) this.settings.showValues = counts?.showValues?.value ?? defaults.showValues;
            if (nodeObjects["badgeTextSize"] !== undefined) this.settings.badgeTextSize = counts?.badgeTextSize?.value ?? defaults.badgeTextSize;
            if (nodeObjects["badgePosition"] !== undefined) this.settings.badgePosition = counts?.badgePosition?.value?.value ?? counts?.badgePosition?.value ?? defaults.badgePosition;
            if (nodeObjects["countMode"] !== undefined) this.settings.countMode = counts?.countMode?.value?.value ?? counts?.countMode?.value ?? defaults.countMode;
            if (nodeObjects["badgePaddingTop"] !== undefined) this.settings.badgePaddingTop = counts?.badgePaddingTop?.value ?? defaults.badgePaddingTop;
            if (nodeObjects["badgePaddingRight"] !== undefined) this.settings.badgePaddingRight = counts?.badgePaddingRight?.value ?? defaults.badgePaddingRight;
            if (nodeObjects["badgePaddingBottom"] !== undefined) this.settings.badgePaddingBottom = counts?.badgePaddingBottom?.value ?? defaults.badgePaddingBottom;
            if (nodeObjects["badgePaddingLeft"] !== undefined) this.settings.badgePaddingLeft = counts?.badgePaddingLeft?.value ?? defaults.badgePaddingLeft;
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
            if (displayObjects["showEmptyPlaceholder"] !== undefined) this.settings.showEmptyPlaceholder = ds.showEmptyPlaceholder?.value ?? defaults.showEmptyPlaceholder;
            if (displayObjects["showCounters"] !== undefined) this.settings.showCounters = ds.showCounters?.value ?? defaults.showCounters;
            if (displayObjects["counterFontSize"] !== undefined) this.settings.headerCounterFontSize = ds.counterFontSize?.value ?? defaults.headerCounterFontSize;
            if (displayObjects["counterFontFamily"] !== undefined) this.settings.headerCounterFontFamily = (ds.counterFontFamily as any)?.value?.value ?? (ds.counterFontFamily as any)?.value ?? defaults.headerCounterFontFamily;
            if (displayObjects["counterFontWeight"] !== undefined) this.settings.headerCounterFontWeight = (ds.counterFontWeight as any)?.value?.value ?? (ds.counterFontWeight as any)?.value ?? defaults.headerCounterFontWeight;
            if (displayObjects["counterColor"] !== undefined) this.settings.headerCounterColor = ds.counterColor?.value?.value ?? defaults.headerCounterColor;
            if (displayObjects["counterSeparator"] !== undefined) this.settings.headerCounterSeparator = ds.counterSeparator?.value ?? defaults.headerCounterSeparator;
            if (displayObjects["showControls"] !== undefined) this.settings.showControls = ds.showControls?.value ?? defaults.showControls;
        }

        if (this.isHighContrastMode && this.highContrastColors) {
            this.settings.textColor = this.highContrastColors.background;
            this.settings.headerCounterColor = this.highContrastColors.foreground;
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
                ns.text.textColor.value = { value: this.settings.textColor };
                ns.text.wrapText.value = this.settings.wrapText;
                ns.text.maxCharsPerLine.value = this.settings.maxCharsPerLine;
            }
            if (ns.connectionCounts) {
                ns.connectionCounts.showValues.value = this.settings.showValues;
                ns.connectionCounts.badgeTextSize.value = this.settings.badgeTextSize;
                ns.connectionCounts.badgePosition.value = { displayName: this.settings.badgePosition, value: this.settings.badgePosition } as any;
                ns.connectionCounts.countMode.value = { displayName: this.settings.countMode, value: this.settings.countMode } as any;
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
            ds.counterColor.value = { value: this.settings.headerCounterColor };
            ds.counterSeparator.value = this.settings.headerCounterSeparator;
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
                    { objectName: "nodeSettings", propertyName: "textColor" },
                    { objectName: "nodeSettings", propertyName: "wrapText" },
                    { objectName: "nodeSettings", propertyName: "maxCharsPerLine" }
                ];

            case "nodeConnectionCounts":
                return [
                    { objectName: "nodeSettings", propertyName: "showValues" },
                    { objectName: "nodeSettings", propertyName: "badgeTextSize" },
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
                this.settings.textColor = defaults.textColor;
                this.settings.wrapText = defaults.wrapText;
                this.settings.maxCharsPerLine = defaults.maxCharsPerLine;
                break;

            case "nodeConnectionCounts":
                // Reset only Connection Counts sub-card
                this.settings.showValues = defaults.showValues;
                this.settings.badgeTextSize = defaults.badgeTextSize;
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
                this.settings.headerCounterColor = defaults.headerCounterColor;
                this.settings.headerCounterSeparator = defaults.headerCounterSeparator;
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
            "levelSpacing", "nodeSpacing", "fontSize", "fontFamily", "textColor",
            "wrapText", "maxCharsPerLine", "showValues", "badgeTextSize",
            "badgePosition", "badgePaddingTop", "badgePaddingRight",
            "badgePaddingBottom", "badgePaddingLeft", "countMode"
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
            "counterFontWeight",
            "counterColor",
            "counterSeparator",
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
            case "nodeText":
                return ["fontSize", "fontFamily", "textColor", "wrapText", "maxCharsPerLine"];
            case "nodeConnectionCounts":
                return ["showValues", "badgeTextSize", "badgePosition", "badgePaddingTop",
                        "badgePaddingRight", "badgePaddingBottom", "badgePaddingLeft", "countMode"];

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
        const allGroupColumns: Array<{index: number, name: string, metadata: any}> = [];
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

    private buildNodeTooltip(node: SankeyNode): VisualTooltipDataItem[] {
        const items: VisualTooltipDataItem[] = [];
        items.push({ header: node.value, displayName: "Connections", value: String(node.count) });
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
        const nodesByLevel: Map<string, Map<string, number>> = new Map();

        columns.forEach((level, levelIndex) => {
            const valueMap = new Map<string, number>();
            rows.forEach((row, rowIndex) => {
                const value = this.normalizeValue(row[levelIndex]);
                if (value !== '') {
                    valueMap.set(value, (valueMap.get(value) || 0) + 1);
                    const nodeId = this.makeId(levelIndex, value);
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

        columns.forEach((level, levelIndex) => {
            const valueMap = nodesByLevel.get(level)!;
            const color = this.getLevelColor(levelIndex);
            valueMap.forEach((count, value) => {
                const id = this.makeId(levelIndex, value);
                const isHighlighted = highlights ? highlightedValues.has(`${levelIndex}_${value}`) : true;
                this.nodes.set(id, { id, level, levelIndex, value, count, color, x: 0, y: 0, selectionId: this.nodeSelectionById.get(id), highlighted: isHighlighted });
            });
        });

        for (let i = 0; i < columns.length - 1; i++) {
            const pairSet = new Set<string>();
            rows.forEach(row => {
                const sourceVal = this.normalizeValue(row[i]);
                const targetVal = this.normalizeValue(row[i + 1]);
                if (sourceVal !== '' && targetVal !== '') {
                    const sourceId = this.makeId(i, sourceVal);
                    const targetId = this.makeId(i + 1, targetVal);
                    pairSet.add(`${sourceId}->${targetId}`);
                }
            });
            pairSet.forEach(pair => {
                const [source, target] = pair.split('->');
                const sourceNode = this.nodes.get(source);
                const targetNode = this.nodes.get(target);
                const sourceColor = sourceNode?.color || this.getLevelColor(i);
                const targetColor = targetNode?.color || this.getLevelColor(i + 1);
                this.links.push({ source, target, count: 1, color: sourceColor, sourceColor, targetColor });
            });
        }

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

            if (this.settings.linkColorMode === "gradient") {
                const gradientId = `gradient-${index}`;
                const gradient = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
                gradient.setAttribute("id", gradientId);
                gradient.setAttribute("x1", "0%");
                gradient.setAttribute("y1", "0%");
                gradient.setAttribute("x2", "100%");
                gradient.setAttribute("y2", "0%");
                const stop1 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
                stop1.setAttribute("offset", "0%");
                stop1.setAttribute("stop-color", sourceColor);
                const stop2 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
                stop2.setAttribute("offset", "100%");
                stop2.setAttribute("stop-color", targetColor);
                gradient.appendChild(stop1);
                gradient.appendChild(stop2);
                this.defs.appendChild(gradient);
            }

            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute("d", this.generateLinkPath(x1, y1, x2, y2));
            path.setAttribute("fill", "none");
            path.setAttribute("stroke", this.settings.linkColorMode === "gradient" ? `url(#gradient-${index})` : linkColor);
            path.setAttribute("stroke-width", String(this.settings.linkWidth));
            path.setAttribute("opacity", String(this.settings.lineOpacity));
            path.setAttribute("data-source", link.source);
            path.setAttribute("data-target", link.target);
            path.setAttribute("data-link-index", String(index));
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
                path.setAttribute("opacity", "0.7");
                path.setAttribute("stroke-width", String(this.settings.linkWidth + 1));
            });
            path.addEventListener("mouseleave", () => {
                path.setAttribute("opacity", String(this.settings.lineOpacity));
                path.setAttribute("stroke-width", String(this.settings.linkWidth));
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
            text.setAttribute("font-size", "14px");
            text.setAttribute("font-weight", "bold");
            text.setAttribute("font-family", this.settings.fontFamily);
            text.setAttribute("fill", this.isHighContrastMode && this.highContrastColors ? this.highContrastColors.foreground : this.settings.colors[index % this.settings.colors.length]);
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

    private renderNodes(): void {
        const nodeGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        nodeGroup.setAttribute("class", "nodes");

        this.nodes.forEach(node => {
            const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
            g.setAttribute("class", "node");
            g.setAttribute("transform", `translate(${node.x},${node.y})`);
            g.style.cursor = this.allowInteractions ? "pointer" : "default";
            g.setAttribute("data-node-id", node.id);
            g.setAttribute("data-node-value", node.value);
            g.setAttribute("tabindex", "-1");
            g.setAttribute("role", "button");
            g.setAttribute("aria-label", `${node.value}, ${node.level}, ${node.count} connections`);

            this.nodeElements.set(node.id, g);

            const shape = this.createNodeShape(node);
            g.appendChild(shape);

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
                }
                shape.setAttribute("stroke-width", String(this.settings.nodeBorderWidth + 2));
                shape.style.filter = "brightness(1.1)";
            });

            g.addEventListener("mouseleave", () => {
                shape.style.filter = "none";
                if (this.selectedNodes.size > 0 && !this.connectedNodes.has(node.id)) {
                    shape.setAttribute("opacity", "0.2");
                    shape.setAttribute("stroke-width", String(this.settings.nodeBorderWidth));
                    g.querySelectorAll("text").forEach(t => t.setAttribute("opacity", "0.3"));
                    g.querySelectorAll("circle").forEach(c => c.setAttribute("opacity", "0.3"));
                    this.highlightLinksForNode(node.id, false);
                } else {
                    shape.setAttribute("stroke-width", String(this.settings.nodeBorderWidth));
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

        this.mainGroup.appendChild(nodeGroup);
    }

    private renderNodeText(g: SVGGElement, node: SankeyNode): void {
        const text = node.value;
        const lines = this.wrapText(text, this.settings.maxCharsPerLine);
        if (lines.length > 3) {
            lines.splice(3);
            lines[2] = lines[2].substring(0, this.settings.maxCharsPerLine - 3) + '...';
        }
        const textGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        textGroup.setAttribute("class", "node-text");
        textGroup.style.pointerEvents = "none";
        const lineHeight = 13;
        const startY = this.settings.nodeHeight / 2 - ((lines.length - 1) * lineHeight) / 2 + 4;
        const textColor = this.isHighContrastMode && this.highContrastColors ? this.highContrastColors.background : this.settings.textColor;

        lines.forEach((line, i) => {
            const textEl = document.createElementNS("http://www.w3.org/2000/svg", "text");
            textEl.setAttribute("x", String(this.settings.nodeWidth / 2));
            textEl.setAttribute("y", String(startY + i * lineHeight));
            textEl.setAttribute("text-anchor", "middle");
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
        const badgeColor = this.isHighContrastMode && this.highContrastColors ? this.highContrastColors.foreground : node.color;
        const badgeBg = this.isHighContrastMode && this.highContrastColors ? this.highContrastColors.background : "white";
        
        // Calculate badge size - circle size is proportional to text size (1.5x text size)
        const textSize = this.settings.badgeTextSize;
        const badgeRadius = textSize * 1.25; // Circle scales proportionally with text
        let cx = 0;
        let cy = 0;
        
        // Parse position (e.g., "top-right", "center", "bottom-left")
        const [vertical, horizontal] = this.settings.badgePosition.split("-");
        
        // Calculate horizontal position
        if (horizontal === "left" || vertical === "left") {
            cx = badgeRadius + this.settings.badgePaddingLeft;
        } else if (horizontal === "right" || vertical === "right") {
            cx = this.settings.nodeWidth - badgeRadius - this.settings.badgePaddingRight;
        } else if (horizontal === "center" || vertical === "center") {
            cx = this.settings.nodeWidth / 2;
        } else {
            // Default to middle horizontal for middle-* positions
            if (vertical === "middle") {
                cx = this.settings.nodeWidth - badgeRadius - this.settings.badgePaddingRight;
            } else {
                cx = this.settings.nodeWidth / 2;
            }
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
        text.setAttribute("font-family", this.settings.fontFamily);
        text.style.pointerEvents = "none";
        text.textContent = String(node.count);
        
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
        statsText.setAttribute("x", "20");
        statsText.setAttribute("y", "30");
        statsText.setAttribute("font-size", `${this.settings.headerCounterFontSize}px`);
        statsText.setAttribute("font-weight", this.settings.headerCounterFontWeight);
        statsText.setAttribute("font-family", this.settings.headerCounterFontFamily || this.settings.fontFamily);
        statsText.setAttribute("fill", counterColor);
        statsText.textContent = allCounters.join(joiner);
        this.fixedHeader.appendChild(statsText);
    }

    private renderControls(width: number): void {
        const controlsGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        controlsGroup.setAttribute("class", "controls");
        controlsGroup.setAttribute("transform", `translate(${width - 360}, 10)`);
        const buttons = [
            { label: "Zoom +", action: () => this.zoomIn() },
            { label: "Zoom -", action: () => this.zoomOut() },
            { label: "Reset", action: () => this.resetZoom() },
            { label: "Fit", action: () => this.fitToScreen() }
        ];
        const buttonColor = this.isHighContrastMode && this.highContrastColors ? this.highContrastColors.foreground : "#0078D4";

        buttons.forEach((btn, i) => {
            const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
            g.setAttribute("transform", `translate(${i * 88}, 0)`);
            g.style.cursor = "pointer";
            g.setAttribute("tabindex", "0");
            g.setAttribute("role", "button");
            g.setAttribute("aria-label", btn.label);
            const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            rect.setAttribute("width", "80");
            rect.setAttribute("height", "28");
            rect.setAttribute("rx", "5");
            rect.setAttribute("fill", buttonColor);
            rect.setAttribute("opacity", "0.9");
            const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
            text.setAttribute("x", "40");
            text.setAttribute("y", "18");
            text.setAttribute("text-anchor", "middle");
            text.setAttribute("fill", this.isHighContrastMode && this.highContrastColors ? this.highContrastColors.background : "white");
            text.setAttribute("font-size", "12px");
            text.setAttribute("font-weight", "bold");
            text.setAttribute("font-family", this.settings.fontFamily);
            text.textContent = btn.label;
            g.appendChild(rect);
            g.appendChild(text);
            g.addEventListener("mouseenter", () => rect.setAttribute("opacity", "1"));
            g.addEventListener("mouseleave", () => rect.setAttribute("opacity", "0.9"));
            g.addEventListener("click", btn.action);
            g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); btn.action(); } });
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
                if (highlight) {
                    path.setAttribute("opacity", "0.4");
                    path.setAttribute("stroke-width", String(this.settings.linkWidth * 1.5));
                } else {
                    path.setAttribute("opacity", "0.05");
                    path.setAttribute("stroke-width", String(this.settings.linkWidth));
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
                path.setAttribute("opacity", String(this.settings.lineOpacity));
                path.setAttribute("stroke-width", String(this.settings.linkWidth));
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
        allNodes.forEach(node => {
            const shape = node.querySelector(".node-shape");
            const texts = node.querySelectorAll("text");
            const circles = node.querySelectorAll("circle");
            if (shape) { shape.setAttribute("opacity", "0.2"); shape.setAttribute("stroke-width", String(this.settings.nodeBorderWidth)); }
            texts.forEach(t => t.setAttribute("opacity", "0.3"));
            circles.forEach(c => c.setAttribute("opacity", "0.3"));
        });

        const allLinks = this.mainGroup.querySelectorAll(".links path");
        allLinks.forEach(path => { path.setAttribute("opacity", "0.05"); path.setAttribute("stroke-width", String(this.settings.linkWidth)); });

        allNodes.forEach(node => {
            const id = node.getAttribute("data-node-id");
            if (id && connected.has(id)) {
                const shape = node.querySelector(".node-shape");
                const texts = node.querySelectorAll("text");
                const circles = node.querySelectorAll("circle");
                if (shape) { shape.setAttribute("opacity", "1"); shape.setAttribute("stroke-width", this.selectedNodes.has(id) ? String(this.settings.nodeBorderWidth + 2) : String(this.settings.nodeBorderWidth + 1)); }
                texts.forEach(t => t.setAttribute("opacity", "1"));
                circles.forEach(c => c.setAttribute("opacity", "1"));
                if (this.settings.showValues) {
                    const badgeText = node.querySelector(".badge-count") as SVGTextElement;
                    if (badgeText) {
                        let filteredCount = 0;
                        if (this.settings.countMode === 'out') filteredCount = filteredOutNeighbors.get(id)?.size || 0;
                        else if (this.settings.countMode === 'in') filteredCount = filteredInNeighbors.get(id)?.size || 0;
                        else filteredCount = (filteredOutNeighbors.get(id)?.size || 0) + (filteredInNeighbors.get(id)?.size || 0);
                        badgeText.textContent = String(filteredCount);
                    }
                }
            }
        });

        allLinks.forEach(path => {
            const source = path.getAttribute("data-source");
            const target = path.getAttribute("data-target");
            if (source && target && filteredLinkPairs.has(`${source}->${target}`)) {
                path.setAttribute("opacity", String(this.settings.highlightOpacity));
                path.setAttribute("stroke-width", String(this.settings.linkWidth * 2));
            }
        });
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
        allNodes.forEach(node => {
            const shape = node.querySelector(".node-shape");
            const texts = node.querySelectorAll("text");
            const circles = node.querySelectorAll("circle");
            if (shape) { shape.setAttribute("opacity", String(this.settings.nodeFillOpacity / 100)); shape.setAttribute("stroke-width", String(this.settings.nodeBorderWidth)); }
            texts.forEach(t => t.setAttribute("opacity", "1"));
            circles.forEach(c => c.setAttribute("opacity", "1"));
            if (this.settings.showValues) {
                const id = node.getAttribute("data-node-id");
                const badgeText = node.querySelector(".badge-count") as SVGTextElement;
                if (id && badgeText) {
                    const originalNode = this.nodes.get(id);
                    if (originalNode) badgeText.textContent = String(originalNode.count);
                }
            }
        });

        const allLinks = this.mainGroup.querySelectorAll(".links path");
        allLinks.forEach(path => {
            path.setAttribute("opacity", String(this.settings.lineOpacity));
            path.setAttribute("stroke-width", String(this.settings.linkWidth));
        });
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

export class AdvancedSankeyChart extends Visual { }
export default AdvancedSankeyChart;
