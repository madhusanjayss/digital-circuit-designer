/* ==========================================================================
   SVG Canvas Renderer and Orthogonal Wire Router
   ========================================================================== */

import {
  RAIL_METRICS,
  getComponentSVGMarkup,
  getComponentBounds,
  getCleanLabel,
  getPinPosition,
  getPinNormal,
  getRailY,
  isRailInput,
  isRailOutput,
  isWorkspaceComponent
} from './components.js';

function escapeText(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function asSet(value) {
  return value instanceof Set ? value : new Set(value ? [value] : []);
}

function cssEscape(value) {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(String(value));
  return String(value).replace(/["\\]/g, '\\$&');
}

export class Renderer {
  constructor(canvasElem, viewportElem, wiresLayerElem, compsLayerElem, tempWireLayerElem, selectionLayerElem = null) {
    this.canvas = canvasElem;
    this.viewportGroup = viewportElem;
    this.wiresLayer = wiresLayerElem;
    this.compsLayer = compsLayerElem;
    this.tempWireLayer = tempWireLayerElem;
    this.selectionLayer = selectionLayerElem || tempWireLayerElem;

    this.panX = 0;
    this.panY = 0;
    this.zoom = 1.0;
    this.showGrid = true;

    this.updateViewportTransform();
  }

  setViewport(panX, panY, zoom) {
    this.panX = Number(panX) || 0;
    this.panY = Number(panY) || 0;
    this.zoom = Math.max(0.2, Math.min(3.0, Number(zoom) || 1));
    this.updateViewportTransform();
  }

  resetZoomPan() {
    this.setViewport(0, 0, 1.0);
  }

  updateViewportTransform() {
    this.viewportGroup.setAttribute('transform', `translate(${this.panX}, ${this.panY}) scale(${this.zoom})`);
    const gridPattern = this.canvas.querySelector('#grid-pattern');
    if (gridPattern) {
      gridPattern.setAttribute('patternTransform', `translate(${this.panX}, ${this.panY}) scale(${this.zoom})`);
    }
  }

  screenToWorld(screenX, screenY) {
    const rect = this.canvas.getBoundingClientRect();
    return this.localToWorld(screenX - rect.left, screenY - rect.top);
  }

  localToWorld(localX, localY) {
    return {
      x: (localX - this.panX) / this.zoom,
      y: (localY - this.panY) / this.zoom
    };
  }

  worldToLocal(worldX, worldY) {
    return {
      x: worldX * this.zoom + this.panX,
      y: worldY * this.zoom + this.panY
    };
  }

  setGridVisible(visible) {
    this.showGrid = visible;
    const gridElem = this.canvas.querySelector('#canvas-grid');
    if (gridElem) gridElem.style.display = visible ? 'block' : 'none';
  }

  getCanvasSize() {
    return {
      width: this.canvas?.clientWidth || 1200,
      height: Math.max(920, this.canvas?.clientHeight || 920)
    };
  }

  getDisplayModel(circuit, preview = null) {
    const components = new Map(circuit.components);
    const connections = circuit.connections.map(wire => ({ ...wire, preview: false }));

    if (preview?.components?.length) {
      preview.components.forEach(comp => components.set(comp.id, comp));
      preview.connections.forEach(wire => connections.push({ ...wire, preview: true }));
    }

    return { components, connections };
  }

  getDisplayPinPosition(displayModel, compId, pinId) {
    return getPinPosition(displayModel.components.get(compId), pinId, this);
  }

  getWireWaypoints(p1, p2, customMidX = null) {
    if (!p1 || !p2) return [];

    // Direct straight horizontal connection if collinear
    if (Math.abs(p1.y - p2.y) < 0.5 && p1.x < p2.x) {
      return [
        { x: p1.x, y: p1.y },
        { x: p2.x, y: p2.y }
      ];
    }

    // Direct straight vertical connection if collinear
    if (Math.abs(p1.x - p2.x) < 0.5) {
      return [
        { x: p1.x, y: p1.y },
        { x: p2.x, y: p2.y }
      ];
    }

    // Forward connection: clean 3-segment Z-path (horizontal -> vertical -> horizontal)
    if (p1.x + 20 < p2.x) {
      let midX = customMidX;
      if (midX === null || midX === undefined || midX <= p1.x + 8 || midX >= p2.x - 8) {
        midX = (p1.x + p2.x) / 2;
      }
      return [
        { x: p1.x, y: p1.y },
        { x: midX, y: p1.y },
        { x: midX, y: p2.y },
        { x: p2.x, y: p2.y }
      ];
    }

    // Backward connection / Loopback: clean 5-segment loopback
    const preferTop = p2.y <= p1.y;
    const bypassY = preferTop ? Math.min(p1.y, p2.y) - 25 : Math.max(p1.y, p2.y) + 25;
    const rightX = p1.x + 20;
    const leftX = p2.x - 20;

    return [
      { x: p1.x, y: p1.y },
      { x: rightX, y: p1.y },
      { x: rightX, y: bypassY },
      { x: leftX, y: bypassY },
      { x: leftX, y: p2.y },
      { x: p2.x, y: p2.y }
    ];
  }

  buildPathFromWaypoints(waypoints, allHorizontalSegments = []) {
    if (!waypoints || waypoints.length < 2) return { pathData: '', crossovers: [] };

    // Filter out duplicate or near-identical consecutive points
    const pts = [waypoints[0]];
    for (let i = 1; i < waypoints.length; i++) {
      const prev = pts[pts.length - 1];
      const curr = waypoints[i];
      if (Math.abs(prev.x - curr.x) > 0.5 || Math.abs(prev.y - curr.y) > 0.5) {
        pts.push(curr);
      }
    }

    if (pts.length < 2) return { pathData: '', crossovers: [] };

    let d = `M ${pts[0].x} ${pts[0].y}`;
    const crossoverPoints = [];

    for (let i = 0; i < pts.length - 1; i++) {
      const pA = pts[i];
      const pB = pts[i + 1];

      if (Math.abs(pA.y - pB.y) < 0.5) {
        d += ` H ${pB.x}`;
      } else if (Math.abs(pA.x - pB.x) < 0.5) {
        const x = pA.x;
        const yStart = pA.y;
        const yEnd = pB.y;
        const minY = Math.min(yStart, yEnd);
        const maxY = Math.max(yStart, yEnd);

        if (Math.abs(yEnd - yStart) > 16 && allHorizontalSegments.length > 0) {
          const segCrossovers = [];
          allHorizontalSegments.forEach(seg => {
            if (seg.y <= minY + 14 || seg.y >= maxY - 14) return;
            const minX = Math.min(seg.x1, seg.x2);
            const maxX = Math.max(seg.x1, seg.x2);
            if (x > minX + 16 && x < maxX - 16) {
              segCrossovers.push(seg.y);
            }
          });

          segCrossovers.sort((a, b) => (yStart < yEnd ? a - b : b - a));
          const radius = 7;
          segCrossovers.forEach(crossY => {
            crossoverPoints.push({ x, y: crossY });
            d += yStart < yEnd
              ? ` L ${x} ${crossY - radius} A ${radius} ${radius} 0 0 1 ${x} ${crossY + radius}`
              : ` L ${x} ${crossY + radius} A ${radius} ${radius} 0 0 1 ${x} ${crossY - radius}`;
          });
          d += ` L ${x} ${yEnd}`;
        } else {
          d += ` V ${yEnd}`;
        }
      } else {
        d += ` L ${pB.x} ${pB.y}`;
      }
    }

    return { pathData: d, crossovers: crossoverPoints };
  }

  getManhattanPath(p1, p2, allHorizontalSegments = [], customMidX = null) {
    const waypoints = this.getWireWaypoints(p1, p2, customMidX);
    return this.buildPathFromWaypoints(waypoints, allHorizontalSegments);
  }

  renderComponents(displayModel, selectedCompIds) {
    let html = '';
    displayModel.components.forEach(comp => {
      const markup = getComponentSVGMarkup(comp, selectedCompIds.has(comp.id));
      html += comp.preview ? markup.replace('component-group ', 'component-group paste-preview-component ') : markup;
    });
    this.compsLayer.innerHTML = html;
  }

  renderWires(displayModel, selectedWireIds) {
    const wireInfos = displayModel.connections.map(wire => {
      const p1 = this.getDisplayPinPosition(displayModel, wire.fromCompId, wire.fromPinId);
      const p2 = this.getDisplayPinPosition(displayModel, wire.toCompId, wire.toPinId);
      if (!p1 || !p2) return null;
      const dx = p2.x - p1.x;
      const baseMidX = dx > 20 ? (p1.x + p2.x) / 2 : p1.x + 20;
      return { wire, p1, p2, baseMidX };
    }).filter(Boolean);

    // Stagger midX for parallel forward wires in the same corridor
    const wireMidXMap = new Map();
    const forwardWires = wireInfos.filter(info => info.p1.x + 20 < info.p2.x);
    const forwardClusters = [];

    forwardWires.forEach(info => {
      let added = false;
      for (const cluster of forwardClusters) {
        const ref = cluster[0];
        const yOverlap = !(info.p2.y < Math.min(ref.p1.y, ref.p2.y) || info.p1.y > Math.max(ref.p1.y, ref.p2.y));
        if (Math.abs(info.baseMidX - ref.baseMidX) < 30 || yOverlap) {
          cluster.push(info);
          added = true;
          break;
        }
      }
      if (!added) forwardClusters.push([info]);
    });

    forwardClusters.forEach(cluster => {
      cluster.sort((a, b) => a.p2.y - b.p2.y || a.p1.y - b.p1.y);
      const n = cluster.length;
      cluster.forEach((item, index) => {
        const offset = n > 1 ? (index - (n - 1) / 2) * 16 : 0;
        wireMidXMap.set(item.wire.id, item.baseMidX + offset);
      });
    });

    const wireWaypointsMap = new Map();
    const allHorizontalSegments = [];

    wireInfos.forEach(info => {
      const waypoints = this.getWireWaypoints(info.p1, info.p2, wireMidXMap.get(info.wire.id));
      wireWaypointsMap.set(info.wire.id, waypoints);

      for (let i = 0; i < waypoints.length - 1; i++) {
        const pA = waypoints[i];
        const pB = waypoints[i + 1];
        if (Math.abs(pA.y - pB.y) < 0.5) {
          allHorizontalSegments.push({ x1: pA.x, x2: pB.x, y: pA.y });
        }
      }
    });

    let html = '';
    const crossovers = [];
    wireInfos.forEach(info => {
      const waypoints = wireWaypointsMap.get(info.wire.id);
      const { pathData, crossovers: wireCrossovers } = this.buildPathFromWaypoints(waypoints, allHorizontalSegments);
      crossovers.push(...wireCrossovers);

      const isHigh = info.wire.state === 1;
      const selected = selectedWireIds.has(info.wire.id);
      const classes = [
        'wire-path',
        isHigh ? 'wire-high' : '',
        selected ? 'wire-selected' : '',
        info.wire.preview ? 'paste-preview-wire' : ''
      ].filter(Boolean).join(' ');

      html += `
        <path d="${pathData}" class="wire-hit-path" data-wire-id="${escapeText(info.wire.id)}"></path>
        <path d="${pathData}" class="${classes}" data-wire-id="${escapeText(info.wire.id)}">
          <title>Wire ${escapeText(info.wire.id)} (${isHigh ? 'HIGH / 1' : 'LOW / 0'})</title>
        </path>
      `;
    });

    crossovers.forEach(point => {
      html = `<circle cx="${point.x}" cy="${point.y}" r="6.5" fill="#ffffff" stroke="none" pointer-events="none"/>` + html;
    });

    const pinWireCount = new Map();
    displayModel.connections.forEach(wire => {
      const fromKey = `${wire.fromCompId}:${wire.fromPinId}`;
      const toKey = `${wire.toCompId}:${wire.toPinId}`;
      if (!pinWireCount.has(fromKey)) pinWireCount.set(fromKey, { count: 0, compId: wire.fromCompId, pinId: wire.fromPinId, state: wire.state });
      if (!pinWireCount.has(toKey)) pinWireCount.set(toKey, { count: 0, compId: wire.toCompId, pinId: wire.toPinId, state: wire.state });
      pinWireCount.get(fromKey).count++;
      pinWireCount.get(toKey).count++;
    });

    pinWireCount.forEach(info => {
      if (info.count <= 1) return;
      const pos = this.getDisplayPinPosition(displayModel, info.compId, info.pinId);
      if (!pos) return;
      html += `
        <circle cx="${pos.x}" cy="${pos.y}" r="4.5"
                class="wire-junction-dot ${info.state === 1 ? 'wire-high' : ''}"
                pointer-events="none" />
      `;
    });

    this.wiresLayer.innerHTML = html;
  }

  renderSelection(displayModel, selectedCompIds, marqueeBox, isPasting) {
    let html = '';

    if (marqueeBox) {
      html += `
        <rect x="${marqueeBox.x}" y="${marqueeBox.y}" width="${marqueeBox.width}" height="${marqueeBox.height}"
              class="marquee-box" />
      `;
    } else if (selectedCompIds.size >= 1) {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      selectedCompIds.forEach(id => {
        const comp = displayModel.components.get(id);
        const bounds = getComponentBounds(comp, this);
        if (!bounds) return;
        minX = Math.min(minX, bounds.minX);
        minY = Math.min(minY, bounds.minY);
        maxX = Math.max(maxX, bounds.maxX);
        maxY = Math.max(maxY, bounds.maxY);
      });

      if (minX !== Infinity) {
        const width = maxX - minX;
        const height = maxY - minY;
        const midX = minX + width / 2;
        const midY = minY + height / 2;
        const boxClass = isPasting ? 'group-bounding-box paste-preview-box' : 'group-bounding-box';

        html += `<rect x="${minX}" y="${minY}" width="${width}" height="${height}" class="${boxClass}" />`;
        if (isPasting) {
          html += `
            <g class="paste-preview-badge-group">
              <rect x="${midX - 95}" y="${minY - 26}" width="190" height="20" rx="4" fill="#2563eb" opacity="0.9" />
              <text x="${midX}" y="${minY - 12}" text-anchor="middle" fill="#ffffff" font-size="11" font-weight="600">
                Click to Place | ESC to Cancel
              </text>
            </g>
          `;
        }

        [
          { x: minX, y: minY }, { x: midX, y: minY }, { x: maxX, y: minY },
          { x: maxX, y: midY }, { x: maxX, y: maxY }, { x: midX, y: maxY },
          { x: minX, y: maxY }, { x: minX, y: midY }
        ].forEach(handle => {
          html += `
            <rect x="${handle.x - 3.5}" y="${handle.y - 3.5}" width="7" height="7"
                  fill="#ffffff" stroke="${isPasting ? '#3b82f6' : '#2563eb'}" stroke-width="1.5" class="selection-handle-dot" />
          `;
        });
      }
    }

    this.selectionLayer.innerHTML = html;
  }

  applyPinHighlight(hoveredPinInfo) {
    this.canvas.querySelectorAll('.port-hover, .magnet-snap').forEach(pin => {
      pin.classList.remove('port-hover', 'magnet-snap');
    });
    if (!hoveredPinInfo) return;

    const pinElem = this.canvas.querySelector(
      `[data-comp-id="${cssEscape(hoveredPinInfo.compId)}"][data-pin-id="${cssEscape(hoveredPinInfo.pinId)}"]`
    );
    if (!pinElem) return;
    pinElem.classList.add('port-hover');
    if (hoveredPinInfo.isSnapped) pinElem.classList.add('magnet-snap');
  }

  render(circuit, selectedCompIds = new Set(), selectedWireIds = new Set(), hoveredPinInfo = null, marqueeBox = null, isPasting = false, preview = null) {
    const compIdSet = asSet(selectedCompIds);
    const wireIdSet = asSet(selectedWireIds);
    const displayModel = this.getDisplayModel(circuit, preview);

    this.renderWires(displayModel, wireIdSet);
    this.renderComponents(displayModel, compIdSet);
    this.renderSelection(displayModel, compIdSet, marqueeBox, isPasting);
    this.applyPinHighlight(hoveredPinInfo);
  }

  renderTempWire(startPos, currentPos, isSnapped = false, marqueeBox = null) {
    if (marqueeBox) {
      this.tempWireLayer.innerHTML = `
        <rect x="${marqueeBox.x}" y="${marqueeBox.y}" width="${marqueeBox.width}" height="${marqueeBox.height}"
              class="marquee-box" />
      `;
      return;
    }

    if (!startPos || !currentPos) {
      this.tempWireLayer.innerHTML = '';
      return;
    }

    const { pathData } = this.getManhattanPath(startPos, currentPos);
    const lineClass = isSnapped ? 'temp-wire temp-wire-snapped' : 'temp-wire';
    const indicatorColor = isSnapped ? '#10b981' : '#2563eb';

    this.tempWireLayer.innerHTML = `
      <path d="${pathData}" class="${lineClass}" />
      ${isSnapped ? `<circle cx="${currentPos.x}" cy="${currentPos.y}" r="12" fill="rgba(16, 185, 129, 0.2)" stroke="#10b981" stroke-width="2" class="magnet-pulse"/>` : ''}
      <circle cx="${startPos.x}" cy="${startPos.y}" r="6" fill="#2563eb" stroke="#ffffff" stroke-width="2"/>
      <circle cx="${currentPos.x}" cy="${currentPos.y}" r="6" fill="${indicatorColor}" stroke="#ffffff" stroke-width="2"/>
    `;
  }

  renderTempWirePath(points, isSnapped = false, options = {}) {
    if (!Array.isArray(points) || points.length < 2) {
      this.tempWireLayer.innerHTML = '';
      return;
    }

    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const pA = points[i - 1];
      const pB = points[i];
      if (Math.abs(pA.y - pB.y) < 0.5) d += ` H ${pB.x}`;
      else if (Math.abs(pA.x - pB.x) < 0.5) d += ` V ${pB.y}`;
      else d += ` H ${pB.x} V ${pB.y}`;
    }

    const startPos = points[0];
    const endPos = points[points.length - 1];
    const lineClass = isSnapped ? 'temp-wire temp-wire-snapped' : 'temp-wire';
    const indicatorColor = isSnapped ? '#10b981' : '#2563eb';
    const isBranch = options.isBranch || false;

    let verticesMarkup = '';
    points.forEach(p => {
      verticesMarkup += `<circle cx="${p.x}" cy="${p.y}" r="3" fill="#2563eb" stroke="#ffffff" stroke-width="1.5" />`;
    });

    this.tempWireLayer.innerHTML = `
      <path d="${d}" class="${lineClass}" />
      ${isSnapped ? `<circle cx="${endPos.x}" cy="${endPos.y}" r="12" fill="rgba(16, 185, 129, 0.2)" stroke="#10b981" stroke-width="2" class="magnet-pulse"/>` : ''}
      <circle cx="${startPos.x}" cy="${startPos.y}" r="${isBranch ? 5 : 6}" fill="${isBranch ? '#059669' : '#2563eb'}" stroke="#ffffff" stroke-width="2"/>
      ${verticesMarkup}
      <circle cx="${endPos.x}" cy="${endPos.y}" r="6" fill="${indicatorColor}" stroke="#ffffff" stroke-width="2"/>
    `;
  }

  renderBranchHover(anchorPoint) {
    if (!anchorPoint) return;
    const existing = this.tempWireLayer.querySelector('.branch-hover-indicator-group');
    if (existing) existing.remove();

    const hoverElem = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    hoverElem.setAttribute('class', 'branch-hover-indicator-group');
    hoverElem.innerHTML = `
      <circle cx="${anchorPoint.x}" cy="${anchorPoint.y}" r="11" fill="rgba(37, 99, 235, 0.2)" stroke="#2563eb" stroke-width="1.5" class="magnet-pulse" pointer-events="none" />
      <circle cx="${anchorPoint.x}" cy="${anchorPoint.y}" r="4" fill="#2563eb" stroke="#ffffff" stroke-width="1.5" pointer-events="none" />
    `;
    this.tempWireLayer.appendChild(hoverElem);
  }

  clearTempWire() {
    this.tempWireLayer.innerHTML = '';
  }
}
