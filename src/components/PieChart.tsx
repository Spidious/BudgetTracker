import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

export interface PieSlice {
  label: string;
  value: number;
  color: string;
}

export default function PieChart({ data, size = 160 }: { data: PieSlice[]; size?: number }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const active = data.filter((d) => d.value > 0);
    if (active.length === 0) {
      svg.append('circle').attr('cx', size / 2).attr('cy', size / 2).attr('r', size * 0.3)
        .attr('fill', 'none').attr('stroke', '#2e3355').attr('stroke-width', size * 0.14);
      return;
    }

    const r = size / 2;
    const innerR = r * 0.55;
    const pie = d3.pie<PieSlice>().value((d) => d.value).sort(null);
    const arc = d3.arc<d3.PieArcDatum<PieSlice>>().innerRadius(innerR).outerRadius(r - 3);

    const g = svg.append('g').attr('transform', `translate(${r},${r})`);

    g.selectAll('path')
      .data(pie(active))
      .join('path')
      .attr('d', arc)
      .attr('fill', (d) => d.data.color)
      .attr('stroke', '#1a1d2e')
      .attr('stroke-width', 1.5);

    const total = active.reduce((s, d) => s + d.value, 0);
    g.append('text')
      .attr('text-anchor', 'middle').attr('dy', '-0.1em')
      .attr('fill', '#e2e8f0').attr('font-size', Math.max(11, size * 0.09)).attr('font-weight', '700')
      .text(`$${Math.round(total).toLocaleString()}`);
    g.append('text')
      .attr('text-anchor', 'middle').attr('dy', '1.2em')
      .attr('fill', '#8892b0').attr('font-size', Math.max(9, size * 0.07))
      .text('expenses');
  }, [data, size]);

  return <svg ref={svgRef} width={size} height={size} />;
}
