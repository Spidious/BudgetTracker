import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { sankey, sankeyLinkHorizontal, sankeyLeft } from 'd3-sankey';
import type { SankeyGraph, SankeyNode, SankeyLink } from 'd3-sankey';
import type { SankeyData } from '../types';

interface Props {
  data: SankeyData;
  width?: number;
  height?: number;
}

type NExtra = { id: string; label: string; color: string };
type LExtra = { color?: string; isOverBudget?: boolean };
type SNode = SankeyNode<NExtra, LExtra>;
type SLink = SankeyLink<NExtra, LExtra>;
type SGraph = SankeyGraph<NExtra, LExtra>;

export default function SankeyDiagram({ data, width = 800, height = 400 }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const hasData = data.nodes.length > 0 && data.links.length > 0;

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    if (!hasData) return;

    // Build fresh copies every effect — d3-sankey mutates objects in place
    const nodeIndexMap = new Map(data.nodes.map((n, i) => [n.id, i]));
    const validLinks = data.links.filter(
      (l) => nodeIndexMap.has(l.source) && nodeIndexMap.has(l.target) && l.value > 0
    );
    if (validLinks.length === 0) return;

    const sankeyNodes: NExtra[] = data.nodes.map((n) => ({ ...n }));
    const sankeyLinks: Array<{ source: number; target: number; value: number; color?: string; isOverBudget?: boolean }> =
      validLinks.map((l) => ({
        source: nodeIndexMap.get(l.source)!,
        target: nodeIndexMap.get(l.target)!,
        value: l.value,
        color: l.color,
        isOverBudget: l.isOverBudget ?? false,
      }));

    let graph: SGraph;
    try {
      const layout = sankey<NExtra, LExtra>()
        .nodeAlign(sankeyLeft)
        .nodeWidth(20)
        .nodePadding(16)
        .extent([[40, 20], [width - 160, height - 20]]);
      graph = layout({ nodes: sankeyNodes, links: sankeyLinks } as unknown as SGraph);
    } catch (e) {
      console.error('Sankey layout error:', e);
      return;
    }

    const defs = svg.append('defs');
    graph.links.forEach((link: SLink, i: number) => {
      const src = link.source as SNode;
      const tgt = link.target as SNode;
      const grad = defs.append('linearGradient')
        .attr('id', `lg-${i}`)
        .attr('gradientUnits', 'userSpaceOnUse')
        .attr('x1', src.x1 ?? 0)
        .attr('x2', tgt.x0 ?? 0);
      const srcColor = src.color || '#6366f1';
      const tgtColor = link.color || tgt.color || '#475569';
      grad.append('stop').attr('offset', '0%').attr('stop-color', srcColor).attr('stop-opacity', 0.8);
      grad.append('stop').attr('offset', '100%').attr('stop-color', tgtColor).attr('stop-opacity', 0.8);
    });

    const g = svg.append('g');

    // Links
    g.append('g')
      .attr('fill', 'none')
      .selectAll<SVGPathElement, SLink>('path')
      .data(graph.links as SLink[])
      .join('path')
      .attr('d', sankeyLinkHorizontal() as (d: SLink) => string)
      .attr('stroke', (_d: SLink, i: number) => `url(#lg-${i})`)
      .attr('stroke-width', (d: SLink) => Math.max(1, d.width ?? 1))
      .attr('stroke-opacity', 0.5)
      .append('title')
      .text((d: SLink) => {
        const src = (d.source as SNode).label ?? '';
        const tgt = (d.target as SNode).label ?? '';
        return `${src} → ${tgt}\n$${d.value.toLocaleString()}`;
      });

    // Nodes
    const node = g.append('g')
      .selectAll<SVGGElement, SNode>('g')
      .data(graph.nodes as SNode[])
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

    const lx = (d: SNode) => (d.x0 ?? 0) < width / 2 ? (d.x1 ?? 0) + 8 : (d.x0 ?? 0) - 8;
    const la = (d: SNode) => (d.x0 ?? 0) < width / 2 ? 'start' : 'end';
    const ly = (d: SNode) => ((d.y1 ?? 0) + (d.y0 ?? 0)) / 2;

    node.append('text')
      .attr('x', (d: SNode) => lx(d))
      .attr('y', (d: SNode) => ly(d))
      .attr('dy', '0.35em')
      .attr('text-anchor', (d: SNode) => la(d))
      .attr('font-size', 12)
      .attr('font-family', 'Inter, system-ui, sans-serif')
      .attr('fill', '#e2e8f0')
      .text((d: SNode) => d.label ?? '')
      .clone(true).lower()
      .attr('stroke-width', 3)
      .attr('stroke', '#0f1117');

    node.append('text')
      .attr('x', (d: SNode) => lx(d))
      .attr('y', (d: SNode) => ly(d) + 14)
      .attr('dy', '0.35em')
      .attr('text-anchor', (d: SNode) => la(d))
      .attr('font-size', 10)
      .attr('font-family', 'Inter, system-ui, sans-serif')
      .attr('fill', '#8892b0')
      .text((d: SNode) => `$${(d.value ?? 0).toLocaleString()}`);

  }, [data, width, height, hasData]);

  if (!hasData) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <p style={{ color: '#8892b0', fontSize: 14 }}>
          Enter income to see your budget flow
        </p>
      </div>
    );
  }

  return <svg ref={svgRef} width={width} height={height} style={{ overflow: 'visible' }} />;
}
