export type NodeCategory = 'Workspace' | 'Report' | 'Dataset' | 'Type' | 'Table';

export interface GraphNode {
  id: string;
  name: string;
  category: NodeCategory;
  value?: number;
}

export interface GraphLink {
  source: string;
  target: string;
  value?: number;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export type NodeShape = 'rectangle' | 'pill' | 'roundedRect' | 'ellipse' | 'diamond' | 'hexagon' | 'parallelogram';
export type BorderStyle = 'solid' | 'dashed' | 'dotted' | 'none';
export type CurveStyle = 'bezier' | 'step' | 'straight';
export type LinkColorMode = 'source' | 'target' | 'gradient' | 'custom';
export type MarkerType = 'arrow' | 'arrowOutline' | 'circle' | 'diamond' | 'square';
export type FillType = 'solid' | 'gradient';

/**
 * Configuration object defining the visual appearance of the DataFlowChart.
 * This config can be partially updated by the AI Agent.
 */
export interface VisualConfig {
  /** The name of the currently active preset, or 'Custom' */
  presetName?: string;

  // --- Canvas ---
  /** Background color of the chart container (Hex code) */
  backgroundColor: string;
  
  // --- Layout ---
  /** Width of a single node in pixels */
  nodeWidth: number;
  /** Height of a single node in pixels */
  nodeHeight: number;
  /** Horizontal distance between columns */
  horizontalSpacing: number;
  /** Vertical distance between nodes in a column */
  verticalSpacing: number;
  
  // --- Nodes ---
  /** Geometric shape of the nodes */
  nodeShape: NodeShape;
  /** Corner radius (only applicable if nodeShape is roundedRect) */
  cornerRadius: number;
  /** Fill style: 'solid' uses theme/category color; 'gradient' adds a light gradient */
  nodeFillType: FillType;
  /** Opacity of the node background (0.0 to 1.0) */
  nodeFillOpacity: number;
  /** Border style of the node */
  nodeBorderStyle: BorderStyle;
  /** Width of the node border in pixels */
  nodeBorderWidth: number;
  /** If true, uses nodeBorderColor. If false, uses themeColor or category color for border. */
  useCustomBorderColor: boolean;
  /** Custom border color (Hex code) */
  nodeBorderColor: string;
  /** Primary theme color used for default node coloring */
  themeColor: string; 
  /** Array of hex colors to cycle through for node categories */
  colors: string[];
  
  // --- Text ---
  /** Font size of the node label in pixels */
  fontSize: number;
  /** Font family for node text */
  fontFamily: string;
  /** Color of the node label text (Hex code) */
  textColor: string;
  
  // --- Badges ---
  /** Whether to show the numeric value badge on nodes */
  showBadges: boolean;
  /** Text color for the badge number (Hex code) */
  badgeTextColor: string;
  
  // --- Shadows ---
  /** Enable drop shadow for nodes */
  nodeShadowEnabled: boolean;
  /** Color of the shadow (Hex code) */
  nodeShadowColor: string;
  /** Opacity of the shadow (0.0 to 1.0) */
  nodeShadowOpacity: number;
  /** Blur radius of the shadow */
  nodeShadowBlur: number;
  /** Horizontal offset of the shadow */
  nodeShadowOffsetX: number;
  /** Vertical offset of the shadow */
  nodeShadowOffsetY: number;

  // --- Links ---
  /** Stroke style of the connecting lines */
  linkStyle: BorderStyle;
  /** Width of the connecting lines in pixels */
  linkWidth: number;
  /** Curvature style of the links */
  linkCurveStyle: CurveStyle;
  /** Color (Hex code) used for links if linkColorMode is 'custom' */
  linkColor: string; 
  /** Strategy for coloring links */
  linkColorMode: LinkColorMode;
  /** Opacity of the links (0.0 to 1.0) */
  lineOpacity: number;
  
  // --- Markers ---
  /** Show marker at the start of the link */
  showStartMarker: boolean;
  /** Shape of the start marker */
  startMarkerType: MarkerType;
  /** Size of the start marker */
  startMarkerSize: number;
  /** Show marker at the end of the link */
  showEndMarker: boolean;
  /** Shape of the end marker */
  endMarkerType: MarkerType;
  /** Size of the end marker */
  endMarkerSize: number;
}
