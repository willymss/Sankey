import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";
import powerbi from "powerbi-visuals-api";

/** ========================================
 *  STYLE PRESETS
 *  ======================================== */

class StylePresetsCard extends formattingSettings.SimpleCard {
    stylePreset = new formattingSettings.ItemDropdown({
        name: "stylePreset",
        displayName: "Style",
        items: [
            { displayName: "Professional Blue", value: "professionalBlue" },
            { displayName: "Vibrant Spectrum", value: "vibrantSpectrum" },
            { displayName: "Neon", value: "neon" },
            { displayName: "Pastel", value: "pastel" },
            { displayName: "Angular Tech", value: "angularTech" },
            { displayName: "Gradient Flow", value: "gradientFlow" },
            { displayName: "Midnight Pro", value: "midnightPro" },
            { displayName: "Pop Art", value: "popArt" },
            { displayName: "Aurora Flow", value: "auroraFlow" },
            { displayName: "Offwhite", value: "offwhite" },
            { displayName: "Modern App", value: "modernApp" },
            { displayName: "Gradient Pill", value: "gradientPill" },
            { displayName: "Outlined Gradient", value: "outlinedGradient" },
            { displayName: "Soft White", value: "softWhite" }
        ],
        value: { displayName: "Soft White", value: "softWhite" }
    });

    // Hidden property to track active preset for state isolation
    activePresetId = new formattingSettings.TextInput({
        name: "activePresetId",
        displayName: "", // Hidden from UI
        placeholder: "",
        value: "softWhite",
        visible: false
    });

    name = "stylePresets";
    displayName = "Layout and style presets";
    slices = [this.stylePreset]; // Don't include activePresetId in visible slices
}

/** ========================================
 *  NODES SETTINGS - Organized into Sections
 *  ======================================== */

/** ---------- Size and Spacing Section ---------- */
class NodeSizeAndSpacingCard extends formattingSettings.SimpleCard {
    nodeWidth = new formattingSettings.Slider({
        name: "nodeWidth",
        displayName: "Width",
        value: 200,
        options: {
            minValue: {
                type: powerbi.visuals.ValidatorType.Min,
                value: 50
            },
            maxValue: {
                type: powerbi.visuals.ValidatorType.Max,
                value: 500
            }
        }
    });

    nodeHeight = new formattingSettings.Slider({
        name: "nodeHeight",
        displayName: "Height",
        value: 50,
        options: {
            minValue: {
                type: powerbi.visuals.ValidatorType.Min,
                value: 20
            },
            maxValue: {
                type: powerbi.visuals.ValidatorType.Max,
                value: 200
            }
        }
    });

    levelSpacing = new formattingSettings.Slider({
        name: "levelSpacing",
        displayName: "Horizontal spacing (between levels)",
        value: 280,
        options: {
            minValue: {
                type: powerbi.visuals.ValidatorType.Min,
                value: 100
            },
            maxValue: {
                type: powerbi.visuals.ValidatorType.Max,
                value: 600
            }
        }
    });

    nodeSpacing = new formattingSettings.Slider({
        name: "nodeSpacing",
        displayName: "Vertical spacing (between nodes)",
        value: 60,
        options: {
            minValue: {
                type: powerbi.visuals.ValidatorType.Min,
                value: 10
            },
            maxValue: {
                type: powerbi.visuals.ValidatorType.Max,
                value: 200
            }
        }
    });

    name = "nodeSizeAndSpacing";
    displayName = "Size and Spacing";
    slices = [this.nodeWidth, this.nodeHeight, this.levelSpacing, this.nodeSpacing];
}

/** ---------- Shape Section ---------- */
class NodeShapeCard extends formattingSettings.SimpleCard {
    nodeShape = new formattingSettings.ItemDropdown({
        name: "nodeShape",
        displayName: "Shape",
        items: [
            { displayName: "Rectangle", value: "rectangle" },
            { displayName: "Pill/Stadium", value: "pill" },
            { displayName: "Rounded Rectangle", value: "roundedRect" },
            { displayName: "Ellipse", value: "ellipse" },
            { displayName: "Diamond", value: "diamond" },
            { displayName: "Hexagon", value: "hexagon" },
            { displayName: "Parallelogram", value: "parallelogram" }
        ],
        value: { displayName: "Pill/Stadium", value: "pill" }
    });

    cornerRadius = new formattingSettings.Slider({
        name: "cornerRadius",
        displayName: "Corner radius",
        description: "Applies to Rounded Rectangle shape",
        value: 5,
        visible: true,
        options: {
            minValue: {
                type: powerbi.visuals.ValidatorType.Min,
                value: 0
            },
            maxValue: {
                type: powerbi.visuals.ValidatorType.Max,
                value: 50
            }
        }
    });

    nodeFillOpacity = new formattingSettings.Slider({
        name: "nodeFillOpacity",
        displayName: "Fill opacity (%)",
        value: 85,
        options: {
            minValue: {
                type: powerbi.visuals.ValidatorType.Min,
                value: 0
            },
            maxValue: {
                type: powerbi.visuals.ValidatorType.Max,
                value: 100
            }
        }
    });

    name = "nodeShape";
    displayName = "Shape";
    slices = [this.nodeShape, this.cornerRadius, this.nodeFillOpacity];
}

/** ---------- Border Section ---------- */
class NodeBorderCard extends formattingSettings.SimpleCard {
    nodeBorderStyle = new formattingSettings.ItemDropdown({
        name: "nodeBorderStyle",
        displayName: "Border style",
        items: [
            { displayName: "Solid", value: "solid" },
            { displayName: "Dashed", value: "dashed" },
            { displayName: "Dotted", value: "dotted" },
            { displayName: "None", value: "none" }
        ],
        value: { displayName: "Solid", value: "solid" }
    });

    nodeBorderWidth = new formattingSettings.Slider({
        name: "nodeBorderWidth",
        displayName: "Border width",
        value: 2,
        options: {
            minValue: {
                type: powerbi.visuals.ValidatorType.Min,
                value: 0
            },
            maxValue: {
                type: powerbi.visuals.ValidatorType.Max,
                value: 10
            }
        }
    });

    useCustomBorderColor = new formattingSettings.ToggleSwitch({
        name: "useCustomBorderColor",
        displayName: "Use custom border color",
        description: "Override default color",
        value: false
    });

    nodeBorderColor = new formattingSettings.ColorPicker({
        name: "nodeBorderColor",
        displayName: "Border color",
        value: { value: "#333333" }
    });

    name = "nodeBorder";
    displayName = "Border";
    slices = [this.nodeBorderStyle, this.nodeBorderWidth, this.useCustomBorderColor, this.nodeBorderColor];
}

/** ---------- Text Section ---------- */
class NodeTextCard extends formattingSettings.SimpleCard {
    fontSize = new formattingSettings.Slider({
        name: "fontSize",
        displayName: "Font size",
        value: 10,
        options: {
            minValue: {
                type: powerbi.visuals.ValidatorType.Min,
                value: 6
            },
            maxValue: {
                type: powerbi.visuals.ValidatorType.Max,
                value: 40
            }
        }
    });

    fontFamily = new formattingSettings.ItemDropdown({
        name: "fontFamily",
        displayName: "Font family",
        items: [
            { displayName: "Segoe UI", value: "Segoe UI" },
            { displayName: "Arial", value: "Arial" },
            { displayName: "Arial Black", value: "Arial Black" },
            { displayName: "Calibri", value: "Calibri" },
            { displayName: "Cambria", value: "Cambria" },
            { displayName: "Candara", value: "Candara" },
            { displayName: "Comic Sans MS", value: "Comic Sans MS" },
            { displayName: "Consolas", value: "Consolas" },
            { displayName: "Constantia", value: "Constantia" },
            { displayName: "Corbel", value: "Corbel" },
            { displayName: "Courier New", value: "Courier New" },
            { displayName: "DIN", value: "DIN" },
            { displayName: "Georgia", value: "Georgia" },
            { displayName: "Lucida Console", value: "Lucida Console" },
            { displayName: "Segoe Script", value: "Segoe Script" },
            { displayName: "Tahoma", value: "Tahoma" },
            { displayName: "Times New Roman", value: "Times New Roman" },
            { displayName: "Trebuchet MS", value: "Trebuchet MS" },
            { displayName: "Verdana", value: "Verdana" },
            { displayName: "Roboto", value: "Roboto" },
            { displayName: "Open Sans", value: "Open Sans" },
            { displayName: "Inter", value: "Inter" }
        ],
        value: { displayName: "Segoe UI", value: "Segoe UI" }
    });


    textAlignment = new formattingSettings.ItemDropdown({
        name: "textAlignment",
        displayName: "Text alignment",
        items: [
            { displayName: "Left", value: "left" },
            { displayName: "Center", value: "center" },
            { displayName: "Right", value: "right" }
        ],
        value: { displayName: "Center", value: "center" }
    });

    textColor = new formattingSettings.ColorPicker({
        name: "textColor",
        displayName: "Text color",
        value: { value: "#000000" }
    });

    wrapText = new formattingSettings.ToggleSwitch({
        name: "wrapText",
        displayName: "Wrap long text",
        value: true
    });

    maxCharsPerLine = new formattingSettings.Slider({
        name: "maxCharsPerLine",
        displayName: "Max characters per line",
        value: 28,
        options: {
            minValue: {
                type: powerbi.visuals.ValidatorType.Min,
                value: 5
            },
            maxValue: {
                type: powerbi.visuals.ValidatorType.Max,
                value: 100
            }
        }
    });

    name = "nodeText";
    displayName = "Text";
    slices = [this.fontSize, this.fontFamily, this.textAlignment, this.textColor, this.wrapText, this.maxCharsPerLine];
}

/** ---------- Connection Counts Section ---------- */
class NodeConnectionCountsCard extends formattingSettings.SimpleCard {
    showValues = new formattingSettings.ToggleSwitch({
        name: "showValues",
        displayName: "Show connection counts",
        description: "Display count badges on nodes",
        value: true
    });

    badgeTextSize = new formattingSettings.Slider({
        name: "badgeTextSize",
        displayName: "Count text size",
        description: "Font size for count numbers (circle scales proportionally)",
        value: 8,
        options: {
            minValue: {
                type: powerbi.visuals.ValidatorType.Min,
                value: 4
            },
            maxValue: {
                type: powerbi.visuals.ValidatorType.Max,
                value: 24
            }
        }
    });

    badgeTextColor = new formattingSettings.ColorPicker({
        name: "badgeTextColor",
        displayName: "Count text color",
        value: { value: "#000000" }
    });

    badgeFontFamily = new formattingSettings.ItemDropdown({
        name: "badgeFontFamily",
        displayName: "Count font family",
        items: [
            { displayName: "Segoe UI", value: "Segoe UI" },
            { displayName: "Arial", value: "Arial" },
            { displayName: "Arial Black", value: "Arial Black" },
            { displayName: "Calibri", value: "Calibri" },
            { displayName: "Cambria", value: "Cambria" },
            { displayName: "Candara", value: "Candara" },
            { displayName: "Comic Sans MS", value: "Comic Sans MS" },
            { displayName: "Consolas", value: "Consolas" },
            { displayName: "Constantia", value: "Constantia" },
            { displayName: "Corbel", value: "Corbel" },
            { displayName: "Courier New", value: "Courier New" },
            { displayName: "DIN", value: "DIN" },
            { displayName: "Georgia", value: "Georgia" },
            { displayName: "Lucida Console", value: "Lucida Console" },
            { displayName: "Segoe Script", value: "Segoe Script" },
            { displayName: "Tahoma", value: "Tahoma" },
            { displayName: "Times New Roman", value: "Times New Roman" },
            { displayName: "Trebuchet MS", value: "Trebuchet MS" },
            { displayName: "Verdana", value: "Verdana" },
            { displayName: "Roboto", value: "Roboto" },
            { displayName: "Open Sans", value: "Open Sans" },
            { displayName: "Inter", value: "Inter" }
        ],
        value: { displayName: "Segoe UI", value: "Segoe UI" }
    });

    badgePosition = new formattingSettings.ItemDropdown({
        name: "badgePosition",
        displayName: "Badge position",
        items: [
            { displayName: "Top Left", value: "top-left" },
            { displayName: "Top Center", value: "top-center" },
            { displayName: "Top Right", value: "top-right" },
            { displayName: "Middle Left", value: "middle-left" },
            { displayName: "Center", value: "center" },
            { displayName: "Middle Right", value: "middle-right" },
            { displayName: "Bottom Left", value: "bottom-left" },
            { displayName: "Bottom Center", value: "bottom-center" },
            { displayName: "Bottom Right", value: "bottom-right" }
        ],
        value: { displayName: "Top Right", value: "top-right" }
    });

    countMode = new formattingSettings.ItemDropdown({
        name: "countMode",
        displayName: "Count direction",
        items: [
            { displayName: "Outgoing", value: "out" },
            { displayName: "Incoming", value: "in" },
            { displayName: "Both (In + Out)", value: "both" }
        ],
        value: { displayName: "Outgoing", value: "out" }
    });

    badgePaddingTop = new formattingSettings.Slider({
        name: "badgePaddingTop",
        displayName: "Padding top",
        value: 15,
        options: {
            minValue: {
                type: powerbi.visuals.ValidatorType.Min,
                value: 0
            },
            maxValue: {
                type: powerbi.visuals.ValidatorType.Max,
                value: 50
            }
        }
    });

    badgePaddingRight = new formattingSettings.Slider({
        name: "badgePaddingRight",
        displayName: "Padding right",
        value: 6,
        options: {
            minValue: {
                type: powerbi.visuals.ValidatorType.Min,
                value: 0
            },
            maxValue: {
                type: powerbi.visuals.ValidatorType.Max,
                value: 50
            }
        }
    });

    badgePaddingBottom = new formattingSettings.Slider({
        name: "badgePaddingBottom",
        displayName: "Padding bottom",
        value: 0,
        options: {
            minValue: {
                type: powerbi.visuals.ValidatorType.Min,
                value: 0
            },
            maxValue: {
                type: powerbi.visuals.ValidatorType.Max,
                value: 50
            }
        }
    });

    badgePaddingLeft = new formattingSettings.Slider({
        name: "badgePaddingLeft",
        displayName: "Padding left",
        value: 0,
        options: {
            minValue: {
                type: powerbi.visuals.ValidatorType.Min,
                value: 0
            },
            maxValue: {
                type: powerbi.visuals.ValidatorType.Max,
                value: 50
            }
        }
    });

    name = "nodeConnectionCounts";
    displayName = "Connection Counts";
    slices = [
        this.showValues,
        this.badgeTextSize,
        this.badgeTextColor,
        this.badgeFontFamily,
        this.badgePosition,
        this.countMode,
        this.badgePaddingTop,
        this.badgePaddingRight,
        this.badgePaddingBottom,
        this.badgePaddingLeft
    ];
}


/** ---------- Shadow Section ---------- */
class NodeShadowCard extends formattingSettings.SimpleCard {
    nodeShadowEnabled = new formattingSettings.ToggleSwitch({
        name: "nodeShadowEnabled",
        displayName: "Shadow",
        value: false
    });

    nodeShadowColor = new formattingSettings.ColorPicker({
        name: "nodeShadowColor",
        displayName: "Shadow color",
        value: { value: "#111111" }
    });

    nodeShadowOpacity = new formattingSettings.Slider({
        name: "nodeShadowOpacity",
        displayName: "Shadow opacity (%)",
        value: 10,
        options: {
            minValue: {
                type: powerbi.visuals.ValidatorType.Min,
                value: 0
            },
            maxValue: {
                type: powerbi.visuals.ValidatorType.Max,
                value: 100
            }
        }
    });

    nodeShadowBlur = new formattingSettings.Slider({
        name: "nodeShadowBlur",
        displayName: "Blur radius",
        value: 6,
        options: {
            minValue: {
                type: powerbi.visuals.ValidatorType.Min,
                value: 0
            },
            maxValue: {
                type: powerbi.visuals.ValidatorType.Max,
                value: 30
            }
        }
    });

    nodeShadowOffsetX = new formattingSettings.Slider({
        name: "nodeShadowOffsetX",
        displayName: "Offset X",
        value: 0,
        options: {
            minValue: {
                type: powerbi.visuals.ValidatorType.Min,
                value: -20
            },
            maxValue: {
                type: powerbi.visuals.ValidatorType.Max,
                value: 20
            }
        }
    });

    nodeShadowOffsetY = new formattingSettings.Slider({
        name: "nodeShadowOffsetY",
        displayName: "Offset Y",
        value: 4,
        options: {
            minValue: {
                type: powerbi.visuals.ValidatorType.Min,
                value: -20
            },
            maxValue: {
                type: powerbi.visuals.ValidatorType.Max,
                value: 20
            }
        }
    });

    name = "nodeShadow";
    displayName = "Shadow";
    slices = [
        this.nodeShadowEnabled,
        this.nodeShadowColor,
        this.nodeShadowOpacity,
        this.nodeShadowBlur,
        this.nodeShadowOffsetX,
        this.nodeShadowOffsetY
    ];
}

/** ---------- Nodes Main Composite Card ---------- */
class NodeSettingsCard extends formattingSettings.CompositeCard {
    sizeAndSpacing = new NodeSizeAndSpacingCard();
    shape = new NodeShapeCard();
    border = new NodeBorderCard();
    shadow = new NodeShadowCard();
    text = new NodeTextCard();
    connectionCounts = new NodeConnectionCountsCard();

    name = "nodeSettings";
    displayName = "Nodes";
    groups = [this.sizeAndSpacing, this.shape, this.border, this.shadow, this.text, this.connectionCounts];

    setVisibility() {
        // Corner radius visibility based on shape
        const isRoundedRect = this.shape.nodeShape.value.value === "roundedRect";
        this.shape.cornerRadius.visible = isRoundedRect;
    }
}

/** ========================================
 *  LINKS SETTINGS - Organized into Sections
 *  ======================================== */

/** ---------- Style Section ---------- */
class LinkStyleCard extends formattingSettings.SimpleCard {
    linkStyle = new formattingSettings.ItemDropdown({
        name: "linkStyle",
        displayName: "Line style",
        items: [
            { displayName: "Solid", value: "solid" },
            { displayName: "Dashed", value: "dashed" },
            { displayName: "Dotted", value: "dotted" }
        ],
        value: { displayName: "Solid", value: "solid" }
    });

    linkWidth = new formattingSettings.Slider({
        name: "linkWidth",
        displayName: "Line width",
        value: 1.5,
        options: {
            minValue: {
                type: powerbi.visuals.ValidatorType.Min,
                value: 0.5
            },
            maxValue: {
                type: powerbi.visuals.ValidatorType.Max,
                value: 10
            }
        }
    });

    linkCurveStyle = new formattingSettings.ItemDropdown({
        name: "linkCurveStyle",
        displayName: "Curve style",
        items: [
            { displayName: "Bezier (Smooth)", value: "bezier" },
            { displayName: "Straight", value: "straight" },
            { displayName: "Step", value: "step" }
        ],
        value: { displayName: "Bezier (Smooth)", value: "bezier" }
    });

    name = "linkStyle";
    displayName = "Style";
    slices = [this.linkStyle, this.linkWidth, this.linkCurveStyle];
}

/** ---------- Opacity Section ---------- */
class LinkOpacityCard extends formattingSettings.SimpleCard {
    lineOpacity = new formattingSettings.Slider({
        name: "lineOpacity",
        displayName: "Default opacity",
        description: "Opacity for unselected links (0-100%)",
        value: 30,
        options: {
            minValue: {
                type: powerbi.visuals.ValidatorType.Min,
                value: 0
            },
            maxValue: {
                type: powerbi.visuals.ValidatorType.Max,
                value: 100
            }
        }
    });

    highlightOpacity = new formattingSettings.Slider({
        name: "highlightOpacity",
        displayName: "Highlight opacity",
        description: "Opacity for selected/highlighted links (0-100%)",
        value: 80,
        options: {
            minValue: {
                type: powerbi.visuals.ValidatorType.Min,
                value: 0
            },
            maxValue: {
                type: powerbi.visuals.ValidatorType.Max,
                value: 100
            }
        }
    });

    name = "linkOpacity";
    displayName = "Opacity";
    slices = [this.lineOpacity, this.highlightOpacity];
}

/** ---------- Color Section ---------- */
class LinkColorCard extends formattingSettings.SimpleCard {
    linkColorMode = new formattingSettings.ItemDropdown({
        name: "linkColorMode",
        displayName: "Color mode",
        items: [
            { displayName: "Match Source Node", value: "source" },
            { displayName: "Match Target Node", value: "target" },
            { displayName: "Gradient (Source to Target)", value: "gradient" },
            { displayName: "Custom Color", value: "custom" }
        ],
        value: { displayName: "Match Source Node", value: "source" }
    });

    customLinkColor = new formattingSettings.ColorPicker({
        name: "customLinkColor",
        displayName: "Custom color",
        description: "Used when color mode is Custom",
        value: { value: "#888888" }
    });

    name = "linkColor";
    displayName = "Color";
    slices = [this.linkColorMode, this.customLinkColor];
}

/** ---------- Start Marker Section ---------- */
class LinkStartMarkerCard extends formattingSettings.SimpleCard {
    showStartMarker = new formattingSettings.ToggleSwitch({
        name: "showStartMarker",
        displayName: "Show start marker",
        description: "Add marker at link start",
        value: false
    });

    startMarkerType = new formattingSettings.ItemDropdown({
        name: "startMarkerType",
        displayName: "Start marker shape",
        items: [
            { displayName: "Circle", value: "circle" },
            { displayName: "Arrow", value: "arrow" },
            { displayName: "Arrow Outline", value: "arrowOutline" },
            { displayName: "Diamond", value: "diamond" },
            { displayName: "Square", value: "square" }
        ],
        value: { displayName: "Circle", value: "circle" }
    });

    startMarkerSize = new formattingSettings.Slider({
        name: "startMarkerSize",
        displayName: "Start marker size",
        value: 6,
        options: {
            minValue: {
                type: powerbi.visuals.ValidatorType.Min,
                value: 2
            },
            maxValue: {
                type: powerbi.visuals.ValidatorType.Max,
                value: 20
            }
        }
    });

    name = "linkStartMarker";
    displayName = "Start Marker";
    slices = [this.showStartMarker, this.startMarkerType, this.startMarkerSize];
}

/** ---------- End Marker Section ---------- */
class LinkEndMarkerCard extends formattingSettings.SimpleCard {
    showEndMarker = new formattingSettings.ToggleSwitch({
        name: "showEndMarker",
        displayName: "Show end marker",
        description: "Add marker at link end",
        value: false
    });

    endMarkerType = new formattingSettings.ItemDropdown({
        name: "endMarkerType",
        displayName: "End marker shape",
        items: [
            { displayName: "Arrow", value: "arrow" },
            { displayName: "Arrow Outline", value: "arrowOutline" },
            { displayName: "Circle", value: "circle" },
            { displayName: "Diamond", value: "diamond" },
            { displayName: "Square", value: "square" }
        ],
        value: { displayName: "Arrow", value: "arrow" }
    });

    endMarkerSize = new formattingSettings.Slider({
        name: "endMarkerSize",
        displayName: "End marker size",
        value: 8,
        options: {
            minValue: {
                type: powerbi.visuals.ValidatorType.Min,
                value: 2
            },
            maxValue: {
                type: powerbi.visuals.ValidatorType.Max,
                value: 20
            }
        }
    });

    name = "linkEndMarker";
    displayName = "End Marker";
    slices = [this.showEndMarker, this.endMarkerType, this.endMarkerSize];
}

/** ---------- Marker Colors Section ---------- */
class LinkMarkerColorsCard extends formattingSettings.SimpleCard {
    useCustomMarkerColors = new formattingSettings.ToggleSwitch({
        name: "useCustomMarkerColors",
        displayName: "Use custom marker colors",
        description: "Override default marker colors",
        value: false
    });

    startMarkerColor = new formattingSettings.ColorPicker({
        name: "startMarkerColor",
        displayName: "Start marker color",
        value: { value: "#0078D4" },
        visible: true
    });

    endMarkerColor = new formattingSettings.ColorPicker({
        name: "endMarkerColor",
        displayName: "End marker color",
        value: { value: "#0078D4" },
        visible: true
    });

    name = "linkMarkerColors";
    displayName = "Marker Colors";
    slices = [this.useCustomMarkerColors, this.startMarkerColor, this.endMarkerColor];

    setMarkerColorVisibility() {
        const showCustomColors = this.useCustomMarkerColors.value;
        this.startMarkerColor.visible = showCustomColors;
        this.endMarkerColor.visible = showCustomColors;
    }
}

/** ---------- Links Main Composite Card ---------- */
class LinkSettingsCard extends formattingSettings.CompositeCard {
    style = new LinkStyleCard();
    opacity = new LinkOpacityCard();
    color = new LinkColorCard();
    startMarker = new LinkStartMarkerCard();
    endMarker = new LinkEndMarkerCard();
    markerColors = new LinkMarkerColorsCard();

    name = "linkSettings";
    displayName = "Links";
    groups = [this.style, this.opacity, this.color, this.startMarker, this.endMarker, this.markerColors];

    setVisibility() {
        this.markerColors.setMarkerColorVisibility();
    }
}

/** ---------- MEASURE SETTINGS ---------- */
class MeasureSettingsCard extends formattingSettings.SimpleCard {
    measureDisplayMode = new formattingSettings.ItemDropdown({
        name: "measureDisplayMode",
        displayName: "Display mode",
        items: [
            { displayName: "Badge", value: "badge" },
            { displayName: "Node text", value: "node" },
            { displayName: "Both", value: "both" },
            { displayName: "None", value: "none" }
        ],
        value: { displayName: "Badge", value: "badge" }
    });

    linkSizingMode = new formattingSettings.ItemDropdown({
        name: "linkSizingMode",
        displayName: "Link width mode",
        items: [
            { displayName: "Fixed", value: "fixed" },
            { displayName: "Proportional", value: "proportional" }
        ],
        value: { displayName: "Fixed", value: "fixed" }
    });

    linkMinWidth = new formattingSettings.Slider({
        name: "linkMinWidth",
        displayName: "Min link width",
        value: 1,
        options: {
            minValue: {
                type: powerbi.visuals.ValidatorType.Min,
                value: 0.5
            },
            maxValue: {
                type: powerbi.visuals.ValidatorType.Max,
                value: 10
            }
        }
    });

    linkMaxWidth = new formattingSettings.Slider({
        name: "linkMaxWidth",
        displayName: "Max link width",
        value: 20,
        options: {
            minValue: {
                type: powerbi.visuals.ValidatorType.Min,
                value: 5
            },
            maxValue: {
                type: powerbi.visuals.ValidatorType.Max,
                value: 50
            }
        }
    });

    measureFormat = new formattingSettings.ItemDropdown({
        name: "measureFormat",
        displayName: "Number format",
        items: [
            { displayName: "Auto", value: "auto" },
            { displayName: "None", value: "none" },
            { displayName: "Thousands (K)", value: "thousands" },
            { displayName: "Millions (M)", value: "millions" }
        ],
        value: { displayName: "Auto", value: "auto" }
    });

    measureDecimals = new formattingSettings.Slider({
        name: "measureDecimals",
        displayName: "Decimal places",
        value: 0,
        options: {
            minValue: {
                type: powerbi.visuals.ValidatorType.Min,
                value: 0
            },
            maxValue: {
                type: powerbi.visuals.ValidatorType.Max,
                value: 4
            }
        }
    });

    name = "measureSettings";
    displayName = "Measure Configuration";
    slices = [
        this.measureDisplayMode,
        this.linkSizingMode,
        this.linkMinWidth,
        this.linkMaxWidth,
        this.measureFormat,
        this.measureDecimals
    ];
}

/** ---------- COLORS ---------- */
class ColorSettingsCard extends formattingSettings.SimpleCard {
    level0Color = new formattingSettings.ColorPicker({ name: "level0Color", displayName: "Level 0", value: { value: "#0078D4" } });
    level1Color = new formattingSettings.ColorPicker({ name: "level1Color", displayName: "Level 1", value: { value: "#50E6FF" } });
    level2Color = new formattingSettings.ColorPicker({ name: "level2Color", displayName: "Level 2", value: { value: "#00B294" } });
    level3Color = new formattingSettings.ColorPicker({ name: "level3Color", displayName: "Level 3", value: { value: "#FFB900" } });
    level4Color = new formattingSettings.ColorPicker({ name: "level4Color", displayName: "Level 4", value: { value: "#E74856" } });
    level5Color = new formattingSettings.ColorPicker({ name: "level5Color", displayName: "Level 5", value: { value: "#8764B8" } });
    level6Color = new formattingSettings.ColorPicker({ name: "level6Color", displayName: "Level 6", value: { value: "#00CC6A" } });
    level7Color = new formattingSettings.ColorPicker({ name: "level7Color", displayName: "Level 7", value: { value: "#FF8C00" } });

    name = "colorSettings";
    displayName = "Colors";
    slices = [
        this.level0Color, this.level1Color, this.level2Color, this.level3Color,
        this.level4Color, this.level5Color, this.level6Color, this.level7Color
    ];
}

/** ---------- DISPLAY ---------- */
class DisplaySettingsCard extends formattingSettings.SimpleCard {
    backgroundColor = new formattingSettings.ColorPicker({
        name: "backgroundColor",
        displayName: "Background color",
        value: { value: "#FFFFFF" }
    });

    showControls = new formattingSettings.ToggleSwitch({
        name: "showControls",
        displayName: "Show zoom controls",
        value: true
    });

    showEmptyPlaceholder = new formattingSettings.ToggleSwitch({
        name: "showEmptyPlaceholder",
        displayName: "Show empty placeholder",
        value: true
    });

    showHeader = new formattingSettings.ToggleSwitch({
        name: "showHeader",
        displayName: "Show top header",
        value: true
    });

    showCounters = new formattingSettings.ToggleSwitch({
        name: "showCounters",
        displayName: "Show header counters",
        value: true
    });

    counterFontSize = new formattingSettings.Slider({
        name: "counterFontSize",
        displayName: "Counter font size",
        value: 11,
        options: {
            minValue: {
                type: powerbi.visuals.ValidatorType.Min,
                value: 6
            },
            maxValue: {
                type: powerbi.visuals.ValidatorType.Max,
                value: 30
            }
        }
    });

    counterFontFamily = new formattingSettings.ItemDropdown({
        name: "counterFontFamily",
        displayName: "Counter font family",
        items: [
            { displayName: "Segoe UI", value: "Segoe UI" },
            { displayName: "Arial", value: "Arial" },
            { displayName: "Calibri", value: "Calibri" },
            { displayName: "Cambria", value: "Cambria" },
            { displayName: "Consolas", value: "Consolas" },
            { displayName: "Georgia", value: "Georgia" },
            { displayName: "Roboto", value: "Roboto" },
            { displayName: "Open Sans", value: "Open Sans" },
            { displayName: "Tahoma", value: "Tahoma" },
            { displayName: "Verdana", value: "Verdana" },
            { displayName: "Inter", value: "Inter" }
        ],
        value: { displayName: "Segoe UI", value: "Segoe UI" }
    });

    counterAlignment = new formattingSettings.ItemDropdown({
        name: "counterAlignment",
        displayName: "Counter alignment",
        items: [
            { displayName: "Left", value: "left" },
            { displayName: "Center", value: "center" },
            { displayName: "Right", value: "right" }
        ],
        value: { displayName: "Left", value: "left" }
    });

    counterFontWeight = new formattingSettings.ItemDropdown({
        name: "counterFontWeight",
        displayName: "Counter weight",
        items: [
            { displayName: "Regular", value: "normal" },
            { displayName: "Semibold", value: "600" },
            { displayName: "Bold", value: "bold" }
        ],
        value: { displayName: "Bold", value: "bold" }
    });

    counterColor = new formattingSettings.ColorPicker({
        name: "counterColor",
        displayName: "Counter color",
        value: { value: "#000000" }
    });

    counterSeparator = new formattingSettings.TextInput({
        name: "counterSeparator",
        displayName: "Counter separator",
        placeholder: "|",
        value: "|"
    });

    headerTitleColor = new formattingSettings.ColorPicker({
        name: "headerTitleColor",
        displayName: "Level title color",
        value: { value: "#000000" }
    });

    headerTitleMatchNode = new formattingSettings.ToggleSwitch({
        name: "headerTitleMatchNode",
        displayName: "Match level title to node color",
        value: false
    });

    headerTitleSize = new formattingSettings.Slider({
        name: "headerTitleSize",
        displayName: "Level title size",
        value: 14,
        options: {
            minValue: {
                type: powerbi.visuals.ValidatorType.Min,
                value: 8
            },
            maxValue: {
                type: powerbi.visuals.ValidatorType.Max,
                value: 36
            }
        }
    });

    headerTitleFontFamily = new formattingSettings.ItemDropdown({
        name: "headerTitleFontFamily",
        displayName: "Level title font family",
        items: [
            { displayName: "Segoe UI", value: "Segoe UI" },
            { displayName: "Arial", value: "Arial" },
            { displayName: "Calibri", value: "Calibri" },
            { displayName: "Cambria", value: "Cambria" },
            { displayName: "Consolas", value: "Consolas" },
            { displayName: "Georgia", value: "Georgia" },
            { displayName: "Roboto", value: "Roboto" },
            { displayName: "Open Sans", value: "Open Sans" },
            { displayName: "Tahoma", value: "Tahoma" },
            { displayName: "Verdana", value: "Verdana" },
            { displayName: "Inter", value: "Inter" }
        ],
        value: { displayName: "Segoe UI", value: "Segoe UI" }
    });

    name = "displaySettings";
    displayName = "Display";
    slices = [
        this.backgroundColor,
        this.showControls,
        this.showEmptyPlaceholder,
        this.showCounters,
        this.counterFontSize,
        this.counterFontFamily,
        this.counterAlignment,
        this.counterFontWeight,
        this.counterColor,
        this.counterSeparator,
        this.headerTitleMatchNode,
        this.headerTitleColor,
        this.headerTitleSize,
        this.headerTitleFontFamily
    ];
}

/** ---------- MODEL ---------- */
export class VisualFormattingSettingsModel extends formattingSettings.Model {
    stylePresets = new StylePresetsCard();
    displaySettings = new DisplaySettingsCard();
    colorSettings = new ColorSettingsCard();
    nodeSettings = new NodeSettingsCard();
    linkSettings = new LinkSettingsCard();
    measureSettings = new MeasureSettingsCard();

    cards = [this.stylePresets, this.displaySettings, this.colorSettings, this.nodeSettings, this.linkSettings, this.measureSettings];
}
