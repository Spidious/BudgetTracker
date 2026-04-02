import { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { sankey, sankeyLinkHorizontal, sankeyLeft } from 'd3-sankey';
import type { SankeyData } from '../types';
import type { SankeyGraph, SankeyNode as D3SankeyNode, SankeyLink as D3SankeyLink } from 'd3-sankey';

interface Props {
  data: SankeyData;
  width?: number;
  height?: number;
}

type NodeExtra = { id: string; label: string; color: string; value?: number };
type LinkExtra = { color?: string; isOverBudget?: boolean };

type SNode = D3SankeyNode<NodeExtra, LinkExtra>;
type SLink = D3SankeyLink<NodeExtra, LinkExtra>;
type SGraph = SankeyGraph<NodeExtra, LinkExtra>;

export default function SankeyDiagram({ data, width = 800, height = 400 }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  const graph = useMemo((): SGraph | null => {
    if (data.nodes.length === 0) return null;

    const nodeMap = new Map(data.nodes.map((n, i) => [n.id, i]));
    const filteredLinks = data.links.filter(
      (l) => nodeMap.has(l.source) && nodeMap.has(l.target) && l.value > 0
    );

    if (filteredLinks.length === 0) return null;

    const sankeyNodes: NodeExtra[] = data.nodes.map((n) => ({ ...n }));
    const sankeyLinks = filteredLinks.map((l) => ({
      source: nodeMap.get(l.source)!,
      target: nodeMap.get(l.target)!,
      value: l.value,
      color: l.color,
      isOverBudget: l.isOverBudget,
    }));

    const layout = sankey<NodeExtra, LinkExtra>()
      .nodeId((d) => d.id)
      .nodeAlign(sankeyLeft)
      .nodeWidth(20)
      .nodePadding(16)
      .extent([[40, 20], [width - 160, height - 20]]);

    return layout({ nodes: sankeyNodes, links: sankeyLinks } as SGraph);
  }, [data, width, height]);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    if (!graph) return;

    const defs = svg.append('defs');

    // Gradient for each link
    graph.links.forEach((link: SLink, i: number) => {
      const grad = defs.append('linearGradient')
        .attr('id', `link-grad-${i}`)
        .attr('gradientUnits', 'userSpaceOnUse')
        .attr('x1', (link.source as SNode).x1 ?? 0)
        .attr('x2', (link.target as SNode).x0 ?? 0);

      const srcColor = (link.source as SNode).color || '#6366f1';
      const tgtColor = link.color || (link.target as SNode).color || '#475569';

      grad.append('stop').attr('offset', '0%').attr('stop-color', srcColor).attr('stop-opacity', 0.8);
      grad.append('stop').attr('offset', '100%').attr('stop-color', tgtColor).attr('stop-opacity', 0.8);
    });

    const g = svg.append('g');

    // Links
    g.append('g')
      .attr('fill', 'none')
      .selectAll('path')
      .data(graph.links)
      .join('path')
      .attr('d', sankeyLinkHorizontal())
      .attr('stroke', (_d: SLink, i: number) => `url(#link-grad-${i})`)
      .attr('stroke-width', (d: SLink) => Math.max(1, d.width ?? 1))
      .attr('stroke-opacity', 0.5)
      .on('mouseover', (_event: MouseEvent, _d: SLink) => {
        // hover handled via CSS opacity
      })
      .on('mouseout', (_event: MouseEvent, _d: SLink) => {
        // hover handled via CSS opacity
      })
      .append('title')
      .text((d: SLink) => {
        const src = (d.source as SNode).label;
        const tgt = (d.target as SNode).label;
        return `${src} → ${tgt}\n$${d.value.toLocaleString()}`;
      });

    // Nodes
    const node = g.append('g')
      .selectAll('g')
      .data(graph.nodes)
      .join('g');

    node.append('rect')
      .attr('x', (d: SNode) => d.x0 ?? 0)
      .attr('y', (d: SNode) => d.y0 ?? 0)
      .attr('height', (d: SNode) => Math.max(2, (d.y1 ?? 0) - (d.y0 ?? 0)))
      .attr('width', (d: SNode) => (d.x1 ?? 0) - (d.x0 ?? 0))
      .attr('fill', (d: SNode) => d.color || '#6366f1')
      .attr('rx', 3)
      .append('title')
      .text((d: SNode) => `${d.label}\n$${(d.value ?? 0).toLocaleString()}`);

    // Labels
    node.append('text')
      .attr('x', (d: SNode) => ((d.x0 ?? 0) < width / 2 ? (d.x1 ?? 0) + 8 : (d.x0 ?? 0) - 8))
      .attr('y', (d: SNode) => ((d.y1 ?? 0) + (d.y0 ?? 0)) / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', (d: SNode) => (d.x0 ?? 0) < width / 2 ? 'start' : 'end')
      .attr('font-size', 12)
      .attr('font-family', 'Inter, system-ui, sans-serif')
      .attr('fill', '#e2e8f0')
      .text((d: SNode) => `${d.label}`)
      .clone(true)
      .lower()
      .attr('stroke-width', 3)
      .attr('stroke', '#0f1117');

    // Value labels
    node.append('text')
      .attr('x', (d: SNode) => ((d.x0 ?? 0) < width / 2 ? (d.x1 ?? 0) + 8 : (d.x0 ?? 0) - 8))
      .attr('y', (d: SNode) => ((d.y1 ?? 0) + (d.y0 ?? 0)) / 2 + 14)
      .attr('dy', '0.35em')
      .attr('text-anchor', (d: SNode) => (d.x0 ?? 0) < width / 2 ? 'start' : 'end')
      .attr('font-size', 10)
      .attr('font-family', 'Inter, system-ui, sans-serif')
      .attr('fill', '#8892b0')
      .text((d: SNode) => `$${(d.value ?? 0).toLocaleString()}`);

  }, [graph, width, height]);

  if (!graph) {
    return (
      <div className="flex items-center justify-center h-full">
        <p style={{ color: '#8892b0', fontSize: 14 }}>
          Add income and spending data to see the Sankey diagram
        </p>
      </div>
    );
  }

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      style={{ overflow: 'visible' }}
    />
  );
}
