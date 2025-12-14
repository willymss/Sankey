import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { GraphData, VisualConfig, NodeShape } from '../types';
import { COLUMNS } from '../constants';

interface DataFlowChartProps {
  data: GraphData;
  config: VisualConfig;
  onFitRequest?: number;
}

export const DataFlowChart: React.FC<DataFlowChartProps> = ({ data, config, onFitRequest }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  
  // Refs for D3 objects to persist across renders without re-initializing
  const gRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  // Helper to get Color using the config palette
  const getNodeColor = (node: any, colIndex: number) => {
    const colors = config.colors && config.colors.length > 0 
        ? config.colors 
        : [config.themeColor, '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
    return colors[colIndex % colors.length];
  };

  // Helper for Shapes
  const getShapePath = (shape: NodeShape, w: number, h: number) => {
    switch (shape) {
        case 'pill':
            return `M0,${h/2} A${h/2},${h/2} 0 0,1 ${h/2},0 L${w-h/2},0 A${h/2},${h/2} 0 0,1 ${w},${h/2} L${w},${h/2} A${h/2},${h/2} 0 0,1 ${w-h/2},${h} L${h/2},${h} A${h/2},${h/2} 0 0,1 0,${h/2} Z`;
        case 'ellipse':
            return `M0,${h/2} A${w/2},${h/2} 0 1,1 ${w},${h/2} A${w/2},${h/2} 0 1,1 0,${h/2} Z`;
        case 'diamond':
            return `M${w/2},0 L${w},${h/2} L${w/2},${h} L0,${h/2} Z`;
        case 'hexagon':
             const s = w * 0.1;
             return `M${s},0 L${w-s},0 L${w},${h/2} L${w-s},${h} L${s},${h} L0,${h/2} Z`;
        case 'parallelogram':
             const p = w * 0.15;
             return `M${p},0 L${w},0 L${w-p},${h} L0,${h} Z`;
        case 'rectangle':
             return `M0,0 L${w},0 L${w},${h} L0,${h} Z`;
        case 'roundedRect':
        default:
             const r = config.cornerRadius || 8;
             return `M${r},0 L${w-r},0 A${r},${r} 0 0,1 ${w},${r} L${w},${h-r} A${r},${r} 0 0,1 ${w-r},${h} L${r},${h} A${r},${r} 0 0,1 0,${h-r} L0,${r} A${r},${r} 0 0,1 ${r},0 Z`;
    }
  };

  // Build connected set for highlighting
  const getConnectedIds = (startNodeId: string | null) => {
      const ids = new Set<string>();
      if(!startNodeId) return ids;
      ids.add(startNodeId);
      
      const adj: Record<string, string[]> = {};
      const revAdj: Record<string, string[]> = {};
      data.nodes.forEach(n => { adj[n.id] = []; revAdj[n.id] = []; });
      data.links.forEach(l => {
          if(adj[l.source]) adj[l.source].push(l.target);
          if(revAdj[l.target]) revAdj[l.target].push(l.source);
      });

      // BFS Downstream
      let queue = [startNodeId];
      let visited = new Set<string>();
      visited.add(startNodeId);
      while(queue.length) {
          const curr = queue.shift()!;
          ids.add(curr);
          adj[curr]?.forEach(next => {
              if(!visited.has(next)) { visited.add(next); queue.push(next); }
          });
      }

      // BFS Upstream
      queue = [startNodeId];
      visited = new Set<string>();
      visited.add(startNodeId);
      while(queue.length) {
        const curr = queue.shift()!;
        ids.add(curr);
        revAdj[curr]?.forEach(prev => {
            if(!visited.has(prev)) { visited.add(prev); queue.push(prev); }
        });
    }

      return ids;
  };

  // 1. Setup SVG Structure (Runs once)
  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;
    const svg = d3.select(svgRef.current);
    
    // Clear any existing content
    svg.selectAll("*").remove();

    // Create Defs
    svg.append("defs").attr("class", "chart-defs");
    
    // Create Main Group
    const g = svg.append("g").attr("class", "chart-content");
    gRef.current = g;

    // Setup Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => g.attr("transform", event.transform));
    
    svg.call(zoom);
    zoomBehaviorRef.current = zoom;
    
    // Disable double click zoom
    svg.on("dblclick.zoom", null);
    
    // Click on background clears selection
    svg.on("click", () => setSelectedNodeId(null));
  }, []);

  // 2. Render Content (Runs on data/config/selection change)
  useEffect(() => {
    if (!svgRef.current || !gRef.current || !containerRef.current) return;
    const svg = d3.select(svgRef.current);
    const g = gRef.current;
    const defs = svg.select<SVGDefsElement>(".chart-defs");
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // --- REBUILD DEFS ---
    defs.selectAll("*").remove();
    
    // Shadow Filter
    if (config.nodeShadowEnabled) {
        const filter = defs.append("filter")
            .attr("id", "drop-shadow")
            .attr("height", "150%");
        
        filter.append("feGaussianBlur")
            .attr("in", "SourceAlpha")
            .attr("stdDeviation", config.nodeShadowBlur)
            .attr("result", "blur");
        
        filter.append("feOffset")
            .attr("in", "blur")
            .attr("dx", config.nodeShadowOffsetX)
            .attr("dy", config.nodeShadowOffsetY)
            .attr("result", "offsetBlur");
            
        filter.append("feFlood")
            .attr("flood-color", config.nodeShadowColor)
            .attr("flood-opacity", config.nodeShadowOpacity)
            .attr("result", "shadowColor");
            
        filter.append("feComposite")
            .attr("in", "shadowColor")
            .attr("in2", "offsetBlur")
            .attr("operator", "in")
            .attr("result", "shadow");

        const feMerge = filter.append("feMerge");
        feMerge.append("feMergeNode").attr("in", "shadow");
        feMerge.append("feMergeNode").attr("in", "SourceGraphic");
    }

    // Node Gradients
    const colors = config.colors && config.colors.length > 0 
        ? config.colors 
        : [config.themeColor, '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
    
    colors.forEach((color, i) => {
        const gradId = `node-grad-${i}`;
        const grad = defs.append("linearGradient")
            .attr("id", gradId)
            .attr("x1", "0%")
            .attr("y1", "0%")
            .attr("x2", "100%")
            .attr("y2", "100%");
        grad.append("stop").attr("offset", "0%").attr("stop-color", color).attr("stop-opacity", 1);
        grad.append("stop").attr("offset", "100%").attr("stop-color", d3.color(color)?.darker(0.5).toString() || color).attr("stop-opacity", 1);
    });

    // Markers
    ['start', 'end'].forEach(pos => {
        const isStart = pos === 'start';
        const show = isStart ? config.showStartMarker : config.showEndMarker;
        const type = isStart ? config.startMarkerType : config.endMarkerType;
        const size = isStart ? config.startMarkerSize : config.endMarkerSize;
        if (show) {
            const m = defs.append("marker")
                .attr("id", `marker-${pos}`)
                .attr("viewBox", "0 -5 10 10")
                .attr("refX", isStart ? 0 : 10)
                .attr("refY", 0)
                .attr("markerWidth", size)
                .attr("markerHeight", size)
                .attr("orient", "auto");

            const pathD = type === 'arrow' ? "M0,-5L10,0L0,5" : 
                          type === 'circle' ? "M0,0 m-3,0 a 3,3 0 1,0 6,0 a 3,3 0 1,0 -6,0" :
                          type === 'square' ? "M0,-3 L6,-3 L6,3 L0,3 Z" :
                          type === 'diamond' ? "M0,0 L5,-3 L10,0 L5,3 Z" : "M0,-5L10,0L0,5";
            m.append("path").attr("d", pathD).attr("fill", config.linkColorMode === 'custom' ? config.linkColor : '#999'); 
        }
    });

    // --- LAYOUT ---
    const columns: Record<string, any[]> = {};
    COLUMNS.forEach(c => columns[c] = []);
    const nodeMap = new Map();
    
    data.nodes.forEach(node => {
      columns[node.category].push(node);
      const colIndex = COLUMNS.indexOf(node.category);
      const color = getNodeColor(node, colIndex);
      const colorIndexInPalette = colors.indexOf(color);
      const gradientUrl = colorIndexInPalette >= 0 ? `url(#node-grad-${colorIndexInPalette})` : color;
      nodeMap.set(node.id, { ...node, color, gradientUrl, colIndex }); 
    });

    const computedNodes: any[] = [];
    COLUMNS.forEach((colName, colIndex) => {
      const colNodes = columns[colName];
      const spacing = colName === 'Table' ? Math.max(40, config.verticalSpacing * 0.8) : config.verticalSpacing;
      const totalHeight = colNodes.length * spacing;
      const startY = (Math.max(height, 800) / 2) - (totalHeight / 2);
      colNodes.forEach((node, idx) => {
        const n = nodeMap.get(node.id);
        n.x = 100 + (colIndex * config.horizontalSpacing);
        n.y = startY + (idx * spacing);
        computedNodes.push(n);
      });
    });

    const computedLinks = data.links.map(link => {
      const source = nodeMap.get(link.source);
      const target = nodeMap.get(link.target);
      if (!source || !target) return null;
      let stroke = config.linkColor;
      if (config.linkColorMode === 'source') stroke = source.color;
      if (config.linkColorMode === 'target') stroke = target.color;
      let gradientId = undefined;
      if (config.linkColorMode === 'gradient') {
          gradientId = `grad-${source.id}-${target.id}`;
          const grad = defs.append("linearGradient")
            .attr("id", gradientId)
            .attr("gradientUnits", "userSpaceOnUse")
            .attr("x1", source.x + config.nodeWidth).attr("y1", source.y + config.nodeHeight / 2)
            .attr("x2", target.x).attr("y2", target.y + config.nodeHeight / 2);
          grad.append("stop").attr("offset", "0%").attr("stop-color", source.color);
          grad.append("stop").attr("offset", "100%").attr("stop-color", target.color);
          stroke = `url(#${gradientId})`;
      }
      return { source, target, id: `${link.source}-${link.target}`, stroke, gradientId };
    }).filter(l => l) as any[];

    // Interactions
    const connectedSet = selectedNodeId ? getConnectedIds(selectedNodeId) : null;
    const isDimmed = (id: string) => selectedNodeId && !connectedSet?.has(id);
    const isLinkDimmed = (link: any) => selectedNodeId && (!connectedSet?.has(link.source.id) || !connectedSet?.has(link.target.id));

    // --- DRAWING ---
    // Clear content of G only
    g.selectAll("*").remove();

    // Links
    const linkGen = (d: any) => {
        const sx = d.source.x + config.nodeWidth;
        const sy = d.source.y + config.nodeHeight / 2;
        const tx = d.target.x;
        const ty = d.target.y + config.nodeHeight / 2;
        if (config.linkCurveStyle === 'straight') return `M${sx},${sy} L${tx},${ty}`;
        if (config.linkCurveStyle === 'step') {
            const mid = (sx + tx) / 2;
            return `M${sx},${sy} L${mid},${sy} L${mid},${ty} L${tx},${ty}`;
        }
        const midX = (sx + tx) / 2;
        return `M${sx},${sy} C${midX},${sy} ${midX},${ty} ${tx},${ty}`;
    };

    g.selectAll(".link")
        .data(computedLinks)
        .enter().append("path")
        .attr("class", "link")
        .attr("d", linkGen)
        .attr("fill", "none")
        .attr("stroke", (d: any) => d.stroke)
        .attr("stroke-width", config.linkWidth)
        .attr("stroke-opacity", (d: any) => isLinkDimmed(d) ? 0.05 : config.lineOpacity)
        .attr("stroke-dasharray", config.linkStyle === 'dashed' ? '5,5' : config.linkStyle === 'dotted' ? '2,2' : 'none')
        .attr("marker-start", config.showStartMarker ? "url(#marker-start)" : null)
        .attr("marker-end", config.showEndMarker ? "url(#marker-end)" : null)
        .style("transition", "stroke-opacity 0.3s");

    // Nodes
    const nodes = g.selectAll(".node")
        .data(computedNodes)
        .enter().append("g")
        .attr("class", "node")
        .attr("transform", (d: any) => `translate(${d.x},${d.y})`)
        .style("cursor", "pointer")
        .on("click", (e, d: any) => {
            e.stopPropagation();
            setSelectedNodeId(selectedNodeId === d.id ? null : d.id);
        });

    const nodePath = nodes.append("path")
        .attr("d", getShapePath(config.nodeShape, config.nodeWidth, config.nodeHeight))
        .attr("fill-opacity", (d: any) => isDimmed(d.id) ? 0.1 : config.nodeFillOpacity)
        .attr("stroke-width", config.nodeBorderWidth)
        .attr("stroke-dasharray", config.nodeBorderStyle === 'dashed' ? '4,2' : config.nodeBorderStyle === 'dotted' ? '1,1' : 'none')
        .attr("filter", config.nodeShadowEnabled ? "url(#drop-shadow)" : null)
        .style("transition", "fill-opacity 0.3s");

    nodePath.each(function(d: any) {
        const el = d3.select(this);
        if (config.nodeFillType === 'gradient') {
            el.attr("fill", d.gradientUrl);
        } else {
            el.attr("fill", d.color);
        }
        
        let strokeColor = config.useCustomBorderColor ? config.nodeBorderColor : config.themeColor;
        if (config.presetName === "Outlined Gradient") {
             el.attr("fill", "#ffffff");
             el.attr("stroke", d.gradientUrl);
        } else {
             if (!config.useCustomBorderColor && config.nodeFillType !== 'gradient') {
                 strokeColor = config.nodeBorderStyle === 'none' ? 'none' : d.color;
                 if (config.nodeBorderStyle !== 'none') el.attr("stroke", strokeColor);
             } else {
                 el.attr("stroke", strokeColor);
             }
        }
    });

    nodes.append("text")
        .attr("x", config.nodeWidth / 2)
        .attr("y", config.nodeHeight / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", "middle")
        .text((d: any) => d.name.length > 28 ? d.name.substring(0, 26) + '...' : d.name)
        .attr("fill", config.textColor)
        .attr("font-size", config.fontSize)
        .attr("font-family", config.fontFamily)
        .style("opacity", (d: any) => isDimmed(d.id) ? 0.3 : 1)
        .style("pointer-events", "none");

    if (config.showBadges) {
        const bx = config.nodeWidth - 15;
        const badges = nodes.append("g")
            .attr("transform", `translate(${bx}, 0)`)
            .style("opacity", (d: any) => isDimmed(d.id) ? 0.1 : 1);

        badges.append("circle")
            .attr("r", 10)
            .attr("fill", "white")
            .attr("stroke", (d: any) => config.presetName === 'Soft White' ? config.badgeTextColor : '#ccc')
            .attr("stroke-width", config.presetName === 'Soft White' ? 1.5 : 1);
        badges.append("text")
            .attr("dy", "0.35em")
            .attr("text-anchor", "middle")
            .attr("fill", config.badgeTextColor)
            .attr("font-size", "10px")
            .attr("font-weight", "bold")
            .text((d: any) => d.value);
    }
  }, [data, config, selectedNodeId]);

  // 3. Fit Graph Logic (Runs ONLY when onFitRequest changes)
  useEffect(() => {
     if (!onFitRequest || !svgRef.current || !gRef.current || !zoomBehaviorRef.current || !containerRef.current) return;
     const svg = d3.select(svgRef.current);
     const g = gRef.current;
     const width = containerRef.current.clientWidth;
     const height = containerRef.current.clientHeight;

     try {
        const bounds = (g.node() as SVGGElement).getBBox();
        if (bounds.width === 0 && bounds.height === 0) return;

        const dx = bounds.width;
        const dy = bounds.height;
        const x = bounds.x + bounds.width / 2;
        const y = bounds.y + bounds.height / 2;
        const scale = Math.max(0.1, Math.min(2, 0.9 / Math.max(dx / width, dy / height)));
        
        svg.transition().duration(750).call(
            zoomBehaviorRef.current.transform,
            d3.zoomIdentity.translate(width / 2 - scale * x, height / 2 - scale * y).scale(scale)
        );
     } catch(e) { /* ignore */ }
  }, [onFitRequest]);

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden" style={{ backgroundColor: config.backgroundColor }}>
      <svg ref={svgRef} className="w-full h-full block" />
    </div>
  );
};
