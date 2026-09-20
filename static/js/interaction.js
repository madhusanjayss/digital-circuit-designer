/* ==========================================================================
   Canvas Interaction, Wiring, Selection, Reconnect, and Paste Transactions
   ========================================================================== */

import {
  ComponentTypes,
  RAIL_METRICS,
  getComponentPinSpecs,
  getComponentBounds,
  getCleanLabel,
  getPinPosition,
  isRailInput,
  isRailOutput,
  isRailComponent,
  isWorkspaceComponent
} from './components.js';
import {
  normalizeConnection,
  validateConnection,
  createChipFromSelection,
  expandChipToCircuit,
  cloneData
} from './circuit.js';

function rectsIntersect(a, b) {
  return a.maxX >= b.minX && a.minX <= b.maxX && a.maxY >= b.minY && a.minY <= b.maxY;
}

function pointInsideBounds(point, bounds) {
  return bounds && point.x >= bounds.minX && point.x <= bounds.maxX && point.y >= bounds.minY && point.y <= bounds.maxY;
}

export class InteractionHandler {
  constructor(circuit, simulator, renderer, history, storage, uiCallbacks) {
    this.circuit = circuit;
    this.simulator = simulator;
    this.renderer = renderer;
    this.history = history;
    this.storage = storage;
    this.uiCallbacks = uiCallbacks;

    this.activeTool = 'select';
    this.selectedICDefinitionId = '74HC00';
    this.selectedCompIds = new Set();
    this.selectedWireIds = new Set();
    this.snapToGrid = false;
    this.gridSize = 20;

    this.isSpaceDown = false;
    this.activePointerId = null;

    this.isPanning = false;
    this.panStart = { x: 0, y: 0 };
    this.panStartViewport = { x: 0, y: 0 };

    this.isDraggingComp = false;
    this.dragCompId = null;
    this.dragOffset = { x: 0, y: 0 };
    this.dragStartScreen = { x: 0, y: 0 };
    this.dragMoved = false;

    this.isDraggingGroup = false;
    this.groupStartPositions = new Map();
    this.groupDragStartWorld = { x: 0, y: 0 };
    this.groupClickTargetCompId = null;
    this.groupClickStartScreen = null;
    this.groupMoved = false;

    this.isMarqueeSelecting = false;
    this.marqueeStart = { x: 0, y: 0 };
    this.marqueeCurrent = { x: 0, y: 0 };
    this.marqueeBaseCompIds = new Set();
    this.currentMarqueeBox = null;

    this.clipboardGroup = null;
    this.lastMouseWorld = null;
    this.isPasting = false;
    this.pastePreview = null;

    this.isDrawingWire = false;
    this.wireStartInfo = null;
    this.reconnectingWire = null;
    this.hoveredPinInfo = null;
    this.snappedPinInfo = null;

    this.isCreatingWire = false;
    this.wireCreationPoints = [];
    this.wireCreationStartPin = null;
    this.wireCreationDragMoved = false;
    this.wireCreationStartScreen = null;

    this.isPullingBranch = false;
    this.branchWireId = null;
    this.branchAnchor = null;
    this.branchOriginSegment = null;
    this.branchStartScreen = null;
    this.branchMoved = false;
    this.hoveredBranchPoint = null;
    this.selectedBranchId = null;

    this.bindEvents();
  }

  get selectedCompId() {
    return this.selectedCompIds.size === 1 ? Array.from(this.selectedCompIds)[0] : null;
  }

  set selectedCompId(id) {
    this.selectedCompIds.clear();
    if (id) this.selectedCompIds.add(id);
  }

  get selectedWireId() {
    return this.selectedWireIds.size === 1 ? Array.from(this.selectedWireIds)[0] : null;
  }

  set selectedWireId(id) {
    this.selectedWireIds.clear();
    if (id) this.selectedWireIds.add(id);
  }

  bindEvents() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const container = document.getElementById('canvas-container');
    if (!container) return;

    window.addEventListener('keydown', e => {
      if (e.code === 'Space' && !e.repeat && !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
        this.isSpaceDown = true;
        if (container && this.activeTool === 'select') container.style.cursor = 'grab';
      }
    });

    window.addEventListener('keyup', e => {
      if (e.code === 'Space') {
        this.isSpaceDown = false;
        if (container && this.activeTool === 'select') container.style.cursor = 'default';
      }
    });

    container.addEventListener('pointerdown', e => this.onPointerDown(e));
    container.addEventListener('pointermove', e => this.onPointerMove(e));
    container.addEventListener('pointerup', e => this.onPointerUp(e));
    container.addEventListener('pointercancel', e => this.onPointerCancel(e));
    container.addEventListener('dblclick', e => this.onDoubleClick(e));
    container.addEventListener('wheel', e => this.onWheel(e), { passive: false });
    container.addEventListener('contextmenu', e => this.onContextMenu(e));
    container.addEventListener('auxclick', e => {
      if (e.button === 1) e.preventDefault();
    });
  }

  capturePointer(e) {
    if (typeof document === 'undefined') return;
    const container = document.getElementById('canvas-container');
    if (!container || e?.pointerId == null) return;
    this.activePointerId = e.pointerId;
    try {
      container.setPointerCapture(e.pointerId);
    } catch {
      this.activePointerId = null;
    }
  }

  releasePointer(e) {
    if (typeof document === 'undefined') return;
    const container = document.getElementById('canvas-container');
    if (!container || this.activePointerId == null) return;
    try {
      container.releasePointerCapture(this.activePointerId);
    } catch {
      // Pointer capture may already be released by the browser.
    }
    this.activePointerId = null;
  }

  getWorldFromEvent(e) {
    return this.renderer.screenToWorld(e.clientX, e.clientY);
  }

  getSnappedWorld(world) {
    if (!this.snapToGrid) return { ...world };
    return {
      x: Math.round(world.x / this.gridSize) * this.gridSize,
      y: Math.round(world.y / this.gridSize) * this.gridSize
    };
  }

  getPinFromElement(elem) {
    if (!elem) return null;
    const compId = elem.getAttribute('data-comp-id');
    const pinId = elem.getAttribute('data-pin-id');
    return this.circuit.resolvePin(compId, pinId);
  }

  setActiveTool(tool) {
    this.activeTool = tool;
    this.clearSelection();
    this.uiCallbacks.onStatusChange(`Selected tool: ${String(tool).toUpperCase()}`);
    this.uiCallbacks.onToolChanged(tool);

    const container = typeof document !== 'undefined' ? document.getElementById('canvas-container') : null;
    if (!container) return;
    if (tool === 'pan') container.style.cursor = 'grab';
    else if (tool === 'move') container.style.cursor = 'move';
    else if (tool === 'wire' || Object.values(ComponentTypes).includes(tool)) container.style.cursor = 'crosshair';
    else if (tool === 'delete') container.style.cursor = 'not-allowed';
    else container.style.cursor = 'default';
  }

  clearSelection() {
    this.selectedCompIds.clear();
    this.selectedWireIds.clear();
    this.uiCallbacks.onSelectionChanged(null, null);
    this.requestRender();
  }

  selectionBounds() {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    this.selectedCompIds.forEach(id => {
      const bounds = getComponentBounds(this.circuit.components.get(id), this.renderer);
      if (!bounds) return;
      minX = Math.min(minX, bounds.minX);
      minY = Math.min(minY, bounds.minY);
      maxX = Math.max(maxX, bounds.maxX);
      maxY = Math.max(maxY, bounds.maxY);
    });

    return minX === Infinity ? null : { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
  }

  isPointInsideSelectedGroup(worldPos) {
    return pointInsideBounds(worldPos, this.selectionBounds());
  }

  findAnyPinNear(worldPos, radiusScreen = RAIL_METRICS.PIN_HIT_RADIUS) {
    let nearest = null;
    let minDist = radiusScreen / this.renderer.zoom;

    this.circuit.components.forEach(comp => {
      const specs = getComponentPinSpecs(comp.type, comp);
      [...specs.inputs, ...specs.outputs].forEach(pinSpec => {
        const descriptor = this.circuit.resolvePin(comp.id, pinSpec.id);
        if (!descriptor) return;
        const dist = Math.hypot(worldPos.x - descriptor.position.x, worldPos.y - descriptor.position.y);
        if (dist < minDist) {
          minDist = dist;
          nearest = descriptor;
        }
      });
    });

    return nearest;
  }

  findNearestSnapPin(worldPos, sourcePinInfo, radiusScreen = RAIL_METRICS.SNAP_RADIUS) {
    if (!sourcePinInfo) return null;
    let nearestPin = null;
    let minDist = radiusScreen / this.renderer.zoom;

    this.circuit.components.forEach(comp => {
      if (comp.id === sourcePinInfo.compId) return;
      const specs = getComponentPinSpecs(comp.type, comp);
      [...specs.inputs, ...specs.outputs].forEach(pinSpec => {
        const candidate = this.circuit.resolvePin(comp.id, pinSpec.id);
        if (!candidate) return;
        const normalized = normalizeConnection(sourcePinInfo, candidate);
        if (!normalized) return;

        const check = validateConnection(this.circuit, normalized, {
          ignoreWireId: this.reconnectingWire?.id || null
        });
        if (!check.valid) return;

        const dist = Math.hypot(worldPos.x - candidate.position.x, worldPos.y - candidate.position.y);
        if (dist < minDist) {
          minDist = dist;
          nearestPin = { ...candidate, pos: candidate.position, distance: dist, isSnapped: true };
        }
      });
    });

    return nearestPin;
  }

  findNearestPointOnSegment(world, p1, p2) {
    const isHorizontal = Math.abs(p1.y - p2.y) < 0.5;
    const isVertical = Math.abs(p1.x - p2.x) < 0.5;

    let nx = p1.x;
    let ny = p1.y;

    if (isHorizontal) {
      const minX = Math.min(p1.x, p2.x);
      const maxX = Math.max(p1.x, p2.x);
      nx = Math.max(minX, Math.min(maxX, world.x));
      ny = p1.y;
      if (this.snapToGrid) {
        nx = Math.max(minX, Math.min(maxX, Math.round(nx / this.gridSize) * this.gridSize));
      }
    } else if (isVertical) {
      const minY = Math.min(p1.y, p2.y);
      const maxY = Math.max(p1.y, p2.y);
      nx = p1.x;
      ny = Math.max(minY, Math.min(maxY, world.y));
      if (this.snapToGrid) {
        ny = Math.max(minY, Math.min(maxY, Math.round(ny / this.gridSize) * this.gridSize));
      }
    } else {
      nx = (p1.x + p2.x) / 2;
      ny = (p1.y + p2.y) / 2;
    }

    const dist = Math.hypot(world.x - nx, world.y - ny);
    return { point: { x: nx, y: ny }, distance: dist, segment: { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y } };
  }

  findNearestWireBranchLocation(world, maxRadiusScreen = 14) {
    const maxWorldDist = maxRadiusScreen / this.renderer.zoom;
    let best = null;
    let minDist = maxWorldDist;

    this.circuit.components.forEach(comp => {
      if (comp.type !== ComponentTypes.WIRE && String(comp.type).toLowerCase() !== 'wire') return;

      const mainSegments = (Array.isArray(comp.segments) && comp.segments.length > 0)
        ? comp.segments
        : this.circuit.deriveSegmentsFromPoints(comp.points || []);

      mainSegments.forEach(seg => {
        const res = this.findNearestPointOnSegment(world, { x: seg.x1, y: seg.y1 }, { x: seg.x2, y: seg.y2 });
        if (res.distance < minDist) {
          minDist = res.distance;
          best = { wireId: comp.id, comp, anchor: res.point, segment: seg, distance: res.distance };
        }
      });

      const branches = Array.isArray(comp.branches) ? comp.branches : [];
      branches.forEach(branch => {
        const branchSegments = (Array.isArray(branch.segments) && branch.segments.length > 0)
          ? branch.segments
          : this.circuit.deriveSegmentsFromPoints(branch.points || []);

        branchSegments.forEach(seg => {
          const res = this.findNearestPointOnSegment(world, { x: seg.x1, y: seg.y1 }, { x: seg.x2, y: seg.y2 });
          if (res.distance < minDist) {
            minDist = res.distance;
            best = { wireId: comp.id, comp, anchor: res.point, segment: seg, distance: res.distance };
          }
        });
      });
    });

    return best;
  }

  calculateOrthogonalPath(start, end, preferHorizontal = null) {
    if (Math.abs(start.y - end.y) < 0.5) {
      return [ { x: start.x, y: start.y }, { x: end.x, y: start.y } ];
    }
    if (Math.abs(start.x - end.x) < 0.5) {
      return [ { x: start.x, y: start.y }, { x: start.x, y: end.y } ];
    }

    const horizFirst = preferHorizontal !== null ? preferHorizontal : Math.abs(end.x - start.x) >= Math.abs(end.y - start.y);
    if (horizFirst) {
      return [
        { x: start.x, y: start.y },
        { x: end.x, y: start.y },
        { x: end.x, y: end.y }
      ];
    } else {
      return [
        { x: start.x, y: start.y },
        { x: start.x, y: end.y },
        { x: end.x, y: end.y }
      ];
    }
  }

  startWireCreation(pos, startPin = null) {
    this.isCreatingWire = true;
    this.wireCreationPoints = [ { x: pos.x, y: pos.y } ];
    this.wireCreationStartPin = startPin?.pinType === 'out' ? startPin : null;
    this.wireCreationDragMoved = false;
    this.uiCallbacks.onStatusChange('Creating Wire: Move mouse and click to add bends. Double-click or Enter to finish.');
  }

  finishWireCreation(endWorld = null) {
    if (!this.isCreatingWire || this.wireCreationPoints.length === 0) return;

    let points = [...this.wireCreationPoints];
    if (endWorld) {
      const snapped = this.getSnappedWorld(endWorld);
      const last = points[points.length - 1];
      if (Math.hypot(snapped.x - last.x, snapped.y - last.y) > 2) {
        const segs = this.calculateOrthogonalPath(last, snapped);
        points.push(...segs.slice(1));
      }
    }

    const cleanPoints = [points[0]];
    for (let i = 1; i < points.length; i++) {
      const prev = cleanPoints[cleanPoints.length - 1];
      const curr = points[i];
      if (Math.abs(prev.x - curr.x) > 0.5 || Math.abs(prev.y - curr.y) > 0.5) {
        cleanPoints.push(curr);
      }
    }

    const simplified = [];
    for (let i = 0; i < cleanPoints.length; i++) {
      if (simplified.length < 2) {
        simplified.push(cleanPoints[i]);
      } else {
        const pA = simplified[simplified.length - 2];
        const pB = simplified[simplified.length - 1];
        const pC = cleanPoints[i];
        if (
          (Math.abs(pA.x - pB.x) < 0.5 && Math.abs(pB.x - pC.x) < 0.5) ||
          (Math.abs(pA.y - pB.y) < 0.5 && Math.abs(pB.y - pC.y) < 0.5)
        ) {
          simplified[simplified.length - 1] = pC;
        } else {
          simplified.push(pC);
        }
      }
    }

    if (simplified.length < 2) {
      this.cancelWireCreation();
      return;
    }

    const segments = this.circuit.deriveSegmentsFromPoints(simplified);
    const endPoint = simplified[simplified.length - 1];
    const endPin = this.findAnyPinNear(endPoint, RAIL_METRICS.PIN_HIT_RADIUS);

    this.history.beginTransaction('add wire component');
    const wire = this.circuit.addWireComponent({
      input: simplified[0],
      output: endPoint,
      points: simplified,
      segments
    });

    if (this.wireCreationStartPin && wire) {
      this.circuit.addConnection(this.wireCreationStartPin.compId, this.wireCreationStartPin.pinId, wire.id, 'in0');
    }
    if (endPin && endPin.pinType === 'in' && wire) {
      this.circuit.addConnection(wire.id, 'out0', endPin.compId, endPin.pinId);
    }
    this.history.commitTransaction();

    this.isCreatingWire = false;
    this.wireCreationPoints = [];
    this.wireCreationStartPin = null;
    this.renderer.clearTempWire();

    if (wire) {
      this.selectComponent(wire.id, false);
      this.triggerSimulation();
      this.uiCallbacks.onToast('Wire component created');
    }

    this.setActiveTool('select');
  }

  cancelWireCreation() {
    this.isCreatingWire = false;
    this.wireCreationPoints = [];
    this.wireCreationStartPin = null;
    this.renderer.clearTempWire();
    this.uiCallbacks.onStatusChange('Wire creation cancelled.');
    this.requestRender();
  }

  startBranchPulling(wireId, anchor, originSegment = null) {
    this.isPullingBranch = true;
    this.branchWireId = wireId;
    this.branchAnchor = { x: Math.round(anchor.x), y: Math.round(anchor.y) };
    this.branchOriginSegment = originSegment;
    this.branchMoved = false;
    this.uiCallbacks.onStatusChange('Pulling branch: Move mouse and click to create output endpoint. Esc to cancel.');
  }

  finishBranchCreation(endWorld) {
    if (!this.isPullingBranch || !this.branchWireId || !this.branchAnchor) return;

    const snapped = this.getSnappedWorld(endWorld || this.lastMouseWorld || this.branchAnchor);
    const dist = Math.hypot(snapped.x - this.branchAnchor.x, snapped.y - this.branchAnchor.y);
    if (dist < 10) {
      this.cancelBranchPulling();
      return;
    }

    const isOrigHorizontal = this.branchOriginSegment ? Math.abs(this.branchOriginSegment.y1 - this.branchOriginSegment.y2) < 0.5 : null;
    const preferHoriz = isOrigHorizontal !== null ? !isOrigHorizontal : null;
    const points = this.calculateOrthogonalPath(this.branchAnchor, snapped, preferHoriz);

    const cleanPoints = [points[0]];
    for (let i = 1; i < points.length; i++) {
      const prev = cleanPoints[cleanPoints.length - 1];
      const curr = points[i];
      if (Math.abs(prev.x - curr.x) > 0.5 || Math.abs(prev.y - curr.y) > 0.5) {
        cleanPoints.push(curr);
      }
    }

    const segments = this.circuit.deriveSegmentsFromPoints(cleanPoints);
    const endPoint = cleanPoints[cleanPoints.length - 1];
    const targetPin = this.findAnyPinNear(endPoint, RAIL_METRICS.PIN_HIT_RADIUS);

    this.history.beginTransaction('add wire branch');
    const branch = this.circuit.addWireBranch(this.branchWireId, {
      anchor: this.branchAnchor,
      output: endPoint,
      points: cleanPoints,
      segments
    });

    if (branch && targetPin && targetPin.pinType === 'in') {
      this.circuit.addConnection(this.branchWireId, branch.id, targetPin.compId, targetPin.pinId);
    }
    this.history.commitTransaction();

    this.isPullingBranch = false;
    this.branchWireId = null;
    this.branchAnchor = null;
    this.branchOriginSegment = null;
    this.renderer.clearTempWire();

    this.triggerSimulation();
    this.uiCallbacks.onToast('Branch output created');
    this.requestRender();
  }

  cancelBranchPulling() {
    this.isPullingBranch = false;
    this.branchWireId = null;
    this.branchAnchor = null;
    this.branchOriginSegment = null;
    this.renderer.clearTempWire();
    this.uiCallbacks.onStatusChange('Branch pulling cancelled.');
    this.requestRender();
  }

  onPointerDown(e) {
    const isLeftButton = e.button === 0;

    if (this.isPasting && isLeftButton) {
      const world = this.getWorldFromEvent(e);
      this.lastMouseWorld = { ...world };
      this.updatePastePreview(world);
      this.commitPaste();
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    if (e.button === 1) {
      e.preventDefault();
      const world = this.getWorldFromEvent(e);
      const targetComp = e.target.closest('.component-group');
      const targetBoundingBox = e.target.closest('.group-bounding-box, .selection-box');
      const isInsideGroup = targetBoundingBox || this.isPointInsideSelectedGroup(world);

      if (targetComp) {
        const clickedCompId = targetComp.getAttribute('data-id');
        const comp = this.circuit.components.get(clickedCompId);
        if (comp && comp.type !== ComponentTypes.WIRE && String(comp.type).toLowerCase() !== 'wire') {
          if (this.selectedCompIds.size > 1 && this.selectedCompIds.has(clickedCompId)) {
            this.rotateSelected();
          } else {
            this.selectComponent(clickedCompId, false);
            this.rotateComponent(clickedCompId);
          }
          return;
        }
      } else if (isInsideGroup && this.selectedCompIds.size >= 1) {
        this.rotateSelected();
        return;
      }

      // Middle click on empty canvas -> pan
      this.isPanning = true;
      this.panStart = { x: e.clientX, y: e.clientY };
      this.panStartViewport = { x: this.renderer.panX, y: this.renderer.panY };
      this.capturePointer(e);
      return;
    }

    if (isLeftButton && (this.isSpaceDown || this.activeTool === 'pan')) {
      this.isPanning = true;
      this.panStart = { x: e.clientX, y: e.clientY };
      this.panStartViewport = { x: this.renderer.panX, y: this.renderer.panY };
      this.capturePointer(e);
      e.preventDefault();
      return;
    }

    if (!isLeftButton) return;

    const world = this.getWorldFromEvent(e);
    this.lastMouseWorld = { ...world };

    if (this.isCreatingWire) {
      const snapped = this.getSnappedWorld(world);
      const last = this.wireCreationPoints[this.wireCreationPoints.length - 1];
      if (Math.hypot(snapped.x - last.x, snapped.y - last.y) > 2) {
        const segs = this.calculateOrthogonalPath(last, snapped);
        this.wireCreationPoints.push(...segs.slice(1));
      }
      this.requestRender();
      return;
    }

    if (this.isPullingBranch) {
      this.finishBranchCreation(world);
      return;
    }

    const pinElem = e.target.closest('.pin-port');
    const targetComp = e.target.closest('.component-group');
    const targetWire = e.target.closest('.wire-hit-path, .wire-path');
    const targetBoundingBox = e.target.closest('.group-bounding-box');
    const pinHit = pinElem ? this.getPinFromElement(pinElem) : null;
    const isMultiSelectKey = e.ctrlKey || e.metaKey || e.shiftKey;

    if (this.activeTool === ComponentTypes.WIRE || this.activeTool === 'wire') {
      const pos = pinHit ? pinHit.position : this.getSnappedWorld(world);
      this.startWireCreation(pos, pinHit);
      this.wireCreationStartScreen = { x: e.clientX, y: e.clientY };
      this.wireCreationDragMoved = false;
      this.capturePointer(e);
      return;
    }

    if (pinHit) {
      this.beginWireGesture(pinHit, world);
      this.capturePointer(e);
      e.preventDefault();
      return;
    }

    const branchHit = e.target.closest('.wire-comp-branch-hit');
    if (branchHit) {
      const bId = branchHit.getAttribute('data-branch-id');
      const wId = branchHit.getAttribute('data-comp-id');
      if (this.activeTool === 'delete') {
        this.history.beginTransaction('delete branch');
        this.circuit.removeWireBranch(wId, bId);
        this.history.commitTransaction();
        this.triggerSimulation();
        this.uiCallbacks.onToast('Branch deleted');
        return;
      }
      if (isMultiSelectKey) {
        this.selectComponent(wId, true);
        return;
      }
      // Special wire branch is NOT selected on plain left click (selection is on right click or Shift/marquee).
      // On plain left click, start branch pulling from this location.
      const anchor = this.hoveredBranchPoint?.anchor || this.getSnappedWorld(world);
      this.startBranchPulling(wId, anchor, this.hoveredBranchPoint?.segment || null);
      this.branchStartScreen = { x: e.clientX, y: e.clientY };
      this.branchMoved = false;
      this.capturePointer(e);
      return;
    }

    if (this.hoveredBranchPoint && !targetBoundingBox && !isMultiSelectKey) {
      this.startBranchPulling(this.hoveredBranchPoint.wireId, this.hoveredBranchPoint.anchor, this.hoveredBranchPoint.segment);
      this.branchStartScreen = { x: e.clientX, y: e.clientY };
      this.branchMoved = false;
      this.capturePointer(e);
      return;
    }

    if (this.selectedCompIds.size >= 1 && !isMultiSelectKey) {
      const clickedSelectedComp = targetComp && this.selectedCompIds.has(targetComp.getAttribute('data-id'));
      const clickedComp = clickedSelectedComp ? this.circuit.components.get(targetComp.getAttribute('data-id')) : null;
      const isSelectedInput = clickedComp && clickedComp.type === ComponentTypes.INPUT;
      const isSelectedClockBtn = clickedComp && clickedComp.type === ComponentTypes.CLOCK && Boolean(e.target.closest('.clock-push-btn'));
      const insideSelectedBox = targetBoundingBox || (this.isPointInsideSelectedGroup(world) && !targetComp) || this.activeTool === 'move';
      if (!isSelectedInput && !isSelectedClockBtn && !isRailComponent(clickedComp) && (clickedSelectedComp || insideSelectedBox)) {
        this.beginGroupDrag(world, e, clickedSelectedComp ? targetComp.getAttribute('data-id') : null);
        this.capturePointer(e);
        return;
      }
    }

    if (targetComp) {
      const compId = targetComp.getAttribute('data-id');
      const comp = this.circuit.components.get(compId);
      if (!comp) return;

      if (this.activeTool === 'delete') {
        this.history.beginTransaction('delete component');
        this.circuit.removeComponent(compId);
        this.history.commitTransaction();
        this.clearSelection();
        this.triggerSimulation();
        return;
      }

      const clockPushBtn = e.target.closest('.clock-push-btn');
      if (clockPushBtn) {
        this.simulator.triggerPulse(comp.id, 'HIGH', comp.pulseDuration || 100);
        this.selectComponent(comp.id, false);
        this.uiCallbacks.onToast(`Clock ${getCleanLabel(comp)} triggered (1 pulse)`);
        return;
      }

      if (comp.type === ComponentTypes.INPUT) {
        this.history.beginTransaction('toggle input');
        const newVal = this.circuit.toggleInput(comp.id);
        this.history.commitTransaction();
        this.triggerSimulation();
        this.uiCallbacks.onToast(`Input ${getCleanLabel(comp)} toggled to ${newVal}`);
        return;
      }

      if (comp.type === ComponentTypes.WIRE || String(comp.type).toLowerCase() === 'wire') {
        if (isMultiSelectKey) {
          this.selectComponent(comp.id, true);
          return;
        }
        // Special wire is NOT selected on plain left click (selection is on right click or Shift/marquee).
        const anchor = this.hoveredBranchPoint?.anchor || this.getSnappedWorld(world);
        this.startBranchPulling(comp.id, anchor, this.hoveredBranchPoint?.segment || null);
        this.branchStartScreen = { x: e.clientX, y: e.clientY };
        this.branchMoved = false;
        this.capturePointer(e);
        return;
      }

      this.selectComponent(compId, isMultiSelectKey);
      if (!isMultiSelectKey) {
        this.beginSingleDrag(comp, world, e);
        this.capturePointer(e);
      }
      return;
    }

    if (targetWire) {
      const wireId = targetWire.getAttribute('data-wire-id');
      if (this.activeTool === 'delete') {
        this.history.beginTransaction('delete wire');
        this.circuit.removeConnection(wireId);
        this.history.commitTransaction();
        this.clearSelection();
        this.triggerSimulation();
        return;
      }
      this.selectWire(wireId, isMultiSelectKey);
      return;
    }

    if (Object.values(ComponentTypes).includes(this.activeTool)) {
      const pos = this.getSnappedWorld(world);
      this.history.beginTransaction('add component');
      let comp = null;
      if (this.activeTool === ComponentTypes.IC) {
        const icDefId = this.selectedICDefinitionId || '74HC00';
        comp = this.circuit.addComponent(
          ComponentTypes.IC,
          pos.x,
          pos.y,
          null,
          0,
          icDefId,
          null,
          { definitionId: icDefId, definitionVersion: 1 }
        );
      } else {
        comp = this.circuit.addComponent(this.activeTool, pos.x, pos.y);
      }
      this.history.commitTransaction();
      this.selectedCompIds.clear();
      this.selectedWireIds.clear();
      if (comp) this.selectedCompIds.add(comp.id);
      this.triggerSimulation();
      this.uiCallbacks.onSelectionChanged(comp, null);
      this.uiCallbacks.onToast(`Placed ${comp.type === ComponentTypes.IC ? comp.name : comp.type}`);
      this.setActiveTool('select');
      return;
    }

    if (this.activeTool === 'box-select' || isMultiSelectKey) {
      this.beginMarquee(world, isMultiSelectKey);
      this.capturePointer(e);
      return;
    }

    // Default Left Click on background: Pan / Move canvas background
    this.isPanning = true;
    this.panStart = { x: e.clientX, y: e.clientY };
    this.panStartViewport = { x: this.renderer.panX, y: this.renderer.panY };
    this.panMoved = false;
    this.capturePointer(e);
  }

  beginWireGesture(pin, world) {
    const existingWire = pin.pinType === 'in' ? this.circuit.getIncomingConnection(pin.compId, pin.pinId) : null;
    if (existingWire) {
      this.history.beginTransaction('reconnect wire');
      this.reconnectingWire = { ...existingWire };
      this.circuit.removeConnection(existingWire.id);
      const startPin = this.circuit.resolvePin(existingWire.fromCompId, existingWire.fromPinId);
      this.wireStartInfo = startPin ? { ...startPin, pos: startPin.position } : null;
      this.triggerSimulation({ save: false });
    } else {
      this.reconnectingWire = null;
      this.wireStartInfo = { ...pin, pos: pin.position };
    }

    if (!this.wireStartInfo) {
      this.history.cancelTransaction();
      this.reconnectingWire = null;
      return;
    }

    this.isDrawingWire = true;
    this.snappedPinInfo = null;
    this.hoveredPinInfo = null;
    this.renderer.renderTempWire(this.wireStartInfo.position, world, false);
  }

  beginSingleDrag(comp, world, e) {
    this.isDraggingComp = true;
    this.dragCompId = comp.id;
    this.dragOffset = { x: world.x - comp.x, y: world.y - comp.y };
    this.dragStartScreen = { x: e.clientX, y: e.clientY };
    this.dragMoved = false;
    this.history.beginTransaction('move component');
  }

  beginGroupDrag(world, e, clickTargetCompId = null) {
    this.groupStartPositions.clear();
    this.selectedCompIds.forEach(id => {
      const comp = this.circuit.components.get(id);
      if (isWorkspaceComponent(comp)) this.groupStartPositions.set(id, { x: comp.x, y: comp.y });
    });

    this.isDraggingGroup = true;
    this.groupDragStartWorld = { ...world };
    this.groupClickTargetCompId = clickTargetCompId;
    this.groupClickStartScreen = { x: e.clientX, y: e.clientY };
    this.groupMoved = false;
    if (this.groupStartPositions.size > 0) this.history.beginTransaction('move group');
  }

  beginMarquee(world, preserveSelection) {
    if (!preserveSelection) {
      this.selectedCompIds.clear();
      this.selectedWireIds.clear();
    }
    this.marqueeBaseCompIds = new Set(this.selectedCompIds);
    this.isMarqueeSelecting = true;
    this.marqueeStart = { ...world };
    this.marqueeCurrent = { ...world };
    this.currentMarqueeBox = null;
    this.uiCallbacks.onSelectionChanged(null, null);
    this.requestRender();
  }

  selectComponent(compId, multi) {
    const comp = this.circuit.components.get(compId);
    if (!comp) return;

    if (multi) {
      if (this.selectedCompIds.has(compId)) this.selectedCompIds.delete(compId);
      else this.selectedCompIds.add(compId);
    } else {
      this.selectedCompIds.clear();
      this.selectedWireIds.clear();
      this.selectedCompIds.add(compId);
    }

    this.uiCallbacks.onSelectionChanged(comp, null);
    this.requestRender();
  }

  selectWire(wireId, multi) {
    if (multi) {
      if (this.selectedWireIds.has(wireId)) this.selectedWireIds.delete(wireId);
      else this.selectedWireIds.add(wireId);
    } else {
      this.selectedCompIds.clear();
      this.selectedWireIds.clear();
      this.selectedWireIds.add(wireId);
    }

    const wire = this.circuit.connections.find(w => w.id === wireId);
    this.uiCallbacks.onSelectionChanged(null, wire);
    this.requestRender();
  }

  rotateComponent(compId) {
    const comp = this.circuit.components.get(compId);
    if (!comp || comp.type === ComponentTypes.WIRE || String(comp.type).toLowerCase() === 'wire') return false;

    this.history.beginTransaction('rotate component');
    const success = this.circuit.rotateComponent(compId);
    this.history.commitTransaction();
    if (success) {
      this.triggerSimulation();
      this.requestRender();
      this.uiCallbacks.onSelectionChanged(comp, null);
      this.uiCallbacks.onToast(`Rotated ${getCleanLabel(comp)} to ${comp.rotation || 0}°`);
    }
    return success;
  }

  rotateSelected() {
    if (this.selectedCompIds.size === 0) return false;
    this.history.beginTransaction('rotate selected');
    let count = 0;
    this.selectedCompIds.forEach(id => {
      const comp = this.circuit.components.get(id);
      if (comp && comp.type !== ComponentTypes.WIRE && String(comp.type).toLowerCase() !== 'wire') {
        this.circuit.rotateComponent(id);
        count++;
      }
    });
    this.history.commitTransaction();
    if (count > 0) {
      this.triggerSimulation();
      this.requestRender();
      const primaryComp = this.selectedCompIds.size === 1 ? this.circuit.components.get(Array.from(this.selectedCompIds)[0]) : null;
      this.uiCallbacks.onSelectionChanged(primaryComp, null);
      this.uiCallbacks.onToast(`Rotated ${count} component(s) 90°`);
    }
    return count > 0;
  }

  onPointerMove(e) {
    const world = this.getWorldFromEvent(e);
    this.lastMouseWorld = { ...world };
    this.uiCallbacks.onMouseCoords(Math.round(world.x), Math.round(world.y));

    if (this.isPasting) {
      this.updatePastePreview(world);
      return;
    }

    if (this.isPanning) {
      const dx = e.clientX - this.panStart.x;
      const dy = e.clientY - this.panStart.y;
      if (Math.hypot(dx, dy) > 3) this.panMoved = true;
      this.renderer.setViewport(this.panStartViewport.x + dx, this.panStartViewport.y + dy, this.renderer.zoom);
      this.requestRender();
      return;
    }

    if (this.isMarqueeSelecting) {
      this.updateMarquee(world);
      return;
    }

    if (this.isDraggingGroup) {
      this.updateGroupDrag(world, e);
      return;
    }

    if (this.isDraggingComp && this.dragCompId) {
      this.updateSingleDrag(world, e);
      return;
    }

    if (this.isDrawingWire && this.wireStartInfo) {
      this.updateWireDrag(world);
      return;
    }

    if (this.isCreatingWire) {
      if (this.wireCreationStartScreen && Math.hypot(e.clientX - this.wireCreationStartScreen.x, e.clientY - this.wireCreationStartScreen.y) > 4) {
        this.wireCreationDragMoved = true;
      }
      const snapped = this.getSnappedWorld(world);
      const last = this.wireCreationPoints[this.wireCreationPoints.length - 1];
      const previewSegs = this.calculateOrthogonalPath(last, snapped);
      const previewPoints = [...this.wireCreationPoints, ...previewSegs.slice(1)];
      const endPin = this.findAnyPinNear(snapped, RAIL_METRICS.PIN_HIT_RADIUS);
      this.renderer.renderTempWirePath(previewPoints, Boolean(endPin));
      return;
    }

    if (this.isPullingBranch) {
      if (this.branchStartScreen && Math.hypot(e.clientX - this.branchStartScreen.x, e.clientY - this.branchStartScreen.y) > 4) {
        this.branchMoved = true;
      }
      const snapped = this.getSnappedWorld(world);
      const isOrigHorizontal = this.branchOriginSegment ? Math.abs(this.branchOriginSegment.y1 - this.branchOriginSegment.y2) < 0.5 : null;
      const preferHoriz = isOrigHorizontal !== null ? !isOrigHorizontal : null;
      const previewPoints = this.calculateOrthogonalPath(this.branchAnchor, snapped, preferHoriz);
      const endPin = this.findAnyPinNear(snapped, RAIL_METRICS.PIN_HIT_RADIUS);
      this.renderer.renderTempWirePath(previewPoints, Boolean(endPin), { isBranch: true });
      return;
    }

    const branchCandidate = (this.activeTool === 'select' || this.activeTool === 'wire') ? this.findNearestWireBranchLocation(world) : null;
    if (branchCandidate) {
      this.hoveredBranchPoint = branchCandidate;
      this.renderer.renderBranchHover(branchCandidate.anchor);
      this.uiCallbacks.onStatusChange('Wire branch point available. Click to pull output branch.');
    } else if (this.hoveredBranchPoint) {
      this.hoveredBranchPoint = null;
      this.renderer.clearTempWire();
      this.uiCallbacks.onStatusChange(`Selected tool: ${String(this.activeTool).toUpperCase()}`);
    }

    const hover = this.findAnyPinNear(world, RAIL_METRICS.PIN_HIT_RADIUS);
    const hoverKey = hover ? `${hover.compId}:${hover.pinId}` : '';
    const currentKey = this.hoveredPinInfo ? `${this.hoveredPinInfo.compId}:${this.hoveredPinInfo.pinId}` : '';
    if (hoverKey !== currentKey) {
      this.hoveredPinInfo = hover;
      this.requestRender();
    }
  }

  updateMarquee(world) {
    this.marqueeCurrent = { ...world };
    const minX = Math.min(this.marqueeStart.x, this.marqueeCurrent.x);
    const maxX = Math.max(this.marqueeStart.x, this.marqueeCurrent.x);
    const minY = Math.min(this.marqueeStart.y, this.marqueeCurrent.y);
    const maxY = Math.max(this.marqueeStart.y, this.marqueeCurrent.y);
    const marqueeBounds = { minX, maxX, minY, maxY };
    this.currentMarqueeBox = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };

    this.selectedCompIds = new Set(this.marqueeBaseCompIds);
    this.selectedWireIds.clear();
    this.circuit.components.forEach(comp => {
      const bounds = getComponentBounds(comp, this.renderer);
      if (bounds && rectsIntersect(bounds, marqueeBounds)) this.selectedCompIds.add(comp.id);
    });
    this.circuit.connections.forEach(wire => {
      if (this.selectedCompIds.has(wire.fromCompId) && this.selectedCompIds.has(wire.toCompId)) {
        this.selectedWireIds.add(wire.id);
      }
    });
    this.requestRender();
  }

  updateGroupDrag(world, e) {
    const screenDist = Math.hypot(e.clientX - this.groupClickStartScreen.x, e.clientY - this.groupClickStartScreen.y);
    if (screenDist > 3) this.groupMoved = true;

    let dx = world.x - this.groupDragStartWorld.x;
    let dy = world.y - this.groupDragStartWorld.y;
    if (this.snapToGrid) {
      dx = Math.round(dx / this.gridSize) * this.gridSize;
      dy = Math.round(dy / this.gridSize) * this.gridSize;
    }

    this.groupStartPositions.forEach((start, id) => {
      this.circuit.moveComponent(id, start.x + dx, start.y + dy);
    });
    this.requestRender();
  }

  updateSingleDrag(world, e) {
    const screenDist = Math.hypot(e.clientX - this.dragStartScreen.x, e.clientY - this.dragStartScreen.y);
    if (screenDist > 3) this.dragMoved = true;

    const comp = this.circuit.components.get(this.dragCompId);
    if (!isWorkspaceComponent(comp)) return;

    let newX = world.x - this.dragOffset.x;
    let newY = world.y - this.dragOffset.y;
    if (this.snapToGrid) {
      newX = Math.round(newX / this.gridSize) * this.gridSize;
      newY = Math.round(newY / this.gridSize) * this.gridSize;
    }
    this.circuit.moveComponent(this.dragCompId, newX, newY);
    this.uiCallbacks.onSelectionChanged(comp, null);
    this.requestRender();
  }

  updateWireDrag(world) {
    const snapPin = this.findNearestSnapPin(world, this.wireStartInfo);
    if (snapPin) {
      this.snappedPinInfo = snapPin;
      this.hoveredPinInfo = snapPin;
      this.renderer.renderTempWire(this.wireStartInfo.position, snapPin.position, true);
      this.uiCallbacks.onStatusChange(`Snap: ${snapPin.compId}:${snapPin.pinId}`);
    } else {
      this.snappedPinInfo = null;
      this.hoveredPinInfo = null;
      this.renderer.renderTempWire(this.wireStartInfo.position, world, false);
      this.uiCallbacks.onStatusChange('Connecting wire...');
    }
    this.requestRender();
  }

  onPointerUp(e) {
    this.releasePointer(e);

    if (this.isPanning) {
      this.isPanning = false;
      if (!this.panMoved) {
        this.clearSelection();
      }
      return;
    }

    if (this.isMarqueeSelecting) {
      this.isMarqueeSelecting = false;
      this.currentMarqueeBox = null;
      this.uiCallbacks.onSelectionChanged(null, null);
      if (this.selectedCompIds.size > 0) this.uiCallbacks.onToast(`Selected ${this.selectedCompIds.size} component(s)`);
      this.requestRender();
      return;
    }

    if (this.isDraggingGroup) {
      if (this.groupMoved && this.groupStartPositions.size > 0) {
        this.history.commitTransaction();
        this.triggerSimulation();
      } else {
        this.history.cancelTransaction();
        if (this.groupClickTargetCompId) this.selectComponent(this.groupClickTargetCompId, false);
      }
      this.isDraggingGroup = false;
      this.groupStartPositions.clear();
      this.groupClickTargetCompId = null;
      this.groupClickStartScreen = null;
      this.groupMoved = false;
      return;
    }

    if (this.isDraggingComp) {
      if (this.dragMoved) {
        this.history.commitTransaction();
        this.triggerSimulation();
      } else {
        this.history.cancelTransaction();
        this.requestRender();
      }
      this.isDraggingComp = false;
      this.dragCompId = null;
      this.dragMoved = false;
      return;
    }

    if (this.isPullingBranch) {
      if (this.branchMoved) {
        const world = this.getWorldFromEvent(e);
        this.finishBranchCreation(world);
      }
      return;
    }

    if (this.isCreatingWire) {
      if (this.wireCreationDragMoved) {
        const world = this.getWorldFromEvent(e);
        this.finishWireCreation(world);
      }
      return;
    }

    if (this.isDrawingWire && this.wireStartInfo) {
      this.completeWireGesture(e);
    }
  }

  completeWireGesture(e) {
    this.renderer.clearTempWire();
    const world = this.getWorldFromEvent(e);
    const directPin = e.target.closest('.pin-port');
    const targetPin = this.snappedPinInfo || this.getPinFromElement(directPin) || this.findAnyPinNear(world, RAIL_METRICS.PIN_HIT_RADIUS);

    let connected = false;
    if (targetPin) {
      const normalized = normalizeConnection(this.wireStartInfo, targetPin);
      const check = normalized
        ? validateConnection(this.circuit, normalized, { ignoreWireId: this.reconnectingWire?.id || null })
        : { valid: false, reason: 'Pins are not compatible.' };

      if (check.valid) {
        if (!this.reconnectingWire) this.history.beginTransaction('connect wire');
        const newWire = this.circuit.addConnection(normalized.fromCompId, normalized.fromPinId, normalized.toCompId, normalized.toPinId);
        connected = Boolean(newWire);
        if (connected) {
          this.history.commitTransaction();
          this.selectedWireIds.clear();
          this.selectedCompIds.clear();
          this.selectedWireIds.add(newWire.id);
          this.triggerSimulation();
          this.uiCallbacks.onToast('Wire connected');
        }
      } else if (check.reason) {
        this.uiCallbacks.onToast(check.reason);
      }
    }

    if (!connected && this.reconnectingWire) {
      this.history.cancelTransaction();
      this.triggerSimulation({ save: false });
      this.uiCallbacks.onToast('Reconnect cancelled');
    } else if (!connected) {
      this.history.cancelTransaction();
      this.requestRender();
    }

    this.isDrawingWire = false;
    this.wireStartInfo = null;
    this.reconnectingWire = null;
    this.hoveredPinInfo = null;
    this.snappedPinInfo = null;
    this.requestRender();
  }

  onPointerCancel(e) {
    this.releasePointer(e);
    this.cancelActiveGesture();
  }

  cancelActiveGesture() {
    if (this.isPasting) {
      this.cancelPaste();
      return true;
    }

    if (this.isCreatingWire) {
      this.cancelWireCreation();
      return true;
    }

    if (this.isPullingBranch) {
      this.cancelBranchPulling();
      return true;
    }

    if (this.isDrawingWire) {
      this.renderer.clearTempWire();
      if (this.reconnectingWire) {
        this.history.cancelTransaction();
        this.triggerSimulation({ save: false });
      }
      this.isDrawingWire = false;
      this.wireStartInfo = null;
      this.reconnectingWire = null;
      this.hoveredPinInfo = null;
      this.snappedPinInfo = null;
      this.requestRender();
      return true;
    }

    if (this.isDraggingComp || this.isDraggingGroup) {
      this.history.cancelTransaction();
      this.isDraggingComp = false;
      this.isDraggingGroup = false;
      this.dragCompId = null;
      this.groupStartPositions.clear();
      this.requestRender();
      return true;
    }

    if (this.isMarqueeSelecting) {
      this.isMarqueeSelecting = false;
      this.currentMarqueeBox = null;
      this.requestRender();
      return true;
    }

    return false;
  }

  onDoubleClick(e) {
    if (this.isCreatingWire) {
      const world = this.getWorldFromEvent(e);
      this.finishWireCreation(world);
      return;
    }

    const targetWire = e.target.closest('.wire-hit-path, .wire-path');
    if (!targetWire) return;
    const wireId = targetWire.getAttribute('data-wire-id');
    this.history.beginTransaction('delete wire');
    this.circuit.removeConnection(wireId);
    this.history.commitTransaction();
    this.clearSelection();
    this.triggerSimulation();
    this.uiCallbacks.onToast('Wire disconnected');
  }

  onWheel(e) {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const targetZoom = this.renderer.zoom * zoomFactor;
    const worldBefore = this.renderer.screenToWorld(e.clientX, e.clientY);

    this.renderer.setViewport(this.renderer.panX, this.renderer.panY, targetZoom);

    const rect = this.renderer.canvas.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;
    const panX = localX - worldBefore.x * this.renderer.zoom;
    const panY = localY - worldBefore.y * this.renderer.zoom;
    this.renderer.setViewport(panX, panY, this.renderer.zoom);
    this.uiCallbacks.onZoomChanged(this.renderer.zoom);
    this.requestRender();
  }

  onContextMenu(e) {
    e.preventDefault();

    if (this.isCreatingWire || this.isPullingBranch) {
      this.cancelActiveGesture();
      return;
    }

    const targetBranch = e.target.closest('.wire-comp-branch-hit, .wire-comp-branch-path');
    const targetComp = e.target.closest('.component-group');
    const targetWire = e.target.closest('.wire-hit-path, .wire-path');
    const targetBoundingBox = e.target.closest('.group-bounding-box, .selection-box');
    const world = this.getWorldFromEvent(e);
    const isMultiSelectKey = e.ctrlKey || e.metaKey || e.shiftKey;

    // 1. Right-click on special wire branch -> Select wire and branch
    if (targetBranch) {
      const bId = targetBranch.getAttribute('data-branch-id');
      const wId = targetBranch.getAttribute('data-comp-id');
      const comp = this.circuit.components.get(wId);
      this.selectedCompId = wId;
      this.selectedBranchId = bId;
      this.uiCallbacks.onSelectionChanged(comp, null);
      this.uiCallbacks.onShowContextMenu(e.clientX, e.clientY, comp, 'wire', 1);
      this.requestRender();
      return;
    }

    // 2. Right-click on special wire component -> Select special wire
    if (targetComp) {
      const clickedCompId = targetComp.getAttribute('data-id');
      const comp = this.circuit.components.get(clickedCompId);
      if (comp && (comp.type === ComponentTypes.WIRE || String(comp.type).toLowerCase() === 'wire')) {
        this.selectedBranchId = null;
        this.selectComponent(comp.id, isMultiSelectKey);
        this.uiCallbacks.onShowContextMenu(e.clientX, e.clientY, comp, 'wire', 1);
        this.requestRender();
        return;
      }
    }

    // 3. Right-click near special wire segment (e.g. on hover snap dot)
    if (this.hoveredBranchPoint) {
      this.selectedBranchId = null;
      const comp = this.circuit.components.get(this.hoveredBranchPoint.wireId);
      this.selectComponent(this.hoveredBranchPoint.wireId, isMultiSelectKey);
      this.uiCallbacks.onShowContextMenu(e.clientX, e.clientY, comp, 'wire', 1);
      this.requestRender();
      return;
    }

    // 4. Right-click on generic connection wire
    if (targetWire) {
      this.selectWire(targetWire.getAttribute('data-wire-id'), isMultiSelectKey);
      this.uiCallbacks.onShowContextMenu(e.clientX, e.clientY, null, 'wire', 1);
      return;
    }

    // 5. Right-click on any standard component or group selection -> Show Context Menu (Previous Feature)
    const isInsideGroup = targetBoundingBox || this.isPointInsideSelectedGroup(world);
    const clickedCompId = targetComp ? targetComp.getAttribute('data-id') : null;
    const isClickedCompAlreadySelected = clickedCompId && this.selectedCompIds.has(clickedCompId);

    if (!targetComp && !isInsideGroup) {
      this.uiCallbacks.onHideContextMenu();
      return;
    }

    let comp = null;
    if (targetComp) {
      comp = this.circuit.components.get(clickedCompId);
      if (!isClickedCompAlreadySelected) {
        this.selectComponent(clickedCompId, isMultiSelectKey);
      }
    }

    const selectedCount = this.selectedCompIds.size;
    const primaryComp = comp || (selectedCount === 1 ? this.circuit.components.get(Array.from(this.selectedCompIds)[0]) : null);

    this.uiCallbacks.onShowContextMenu(e.clientX, e.clientY, primaryComp, 'component', selectedCount);
  }

  deleteSelected() {
    if (this.selectedBranchId && this.selectedCompId) {
      this.history.beginTransaction('delete wire branch');
      this.circuit.removeWireBranch(this.selectedCompId, this.selectedBranchId);
      this.history.commitTransaction();
      this.selectedBranchId = null;
      this.triggerSimulation();
      this.uiCallbacks.onToast('Deleted wire branch');
      this.requestRender();
      return;
    }

    if (this.selectedCompIds.size === 0 && this.selectedWireIds.size === 0) return;

    this.history.beginTransaction('delete selection');
    this.selectedCompIds.forEach(id => {
      this.simulator?.stopClock?.(id);
      this.circuit.removeComponent(id);
    });
    this.selectedWireIds.forEach(id => this.circuit.removeConnection(id));
    const deletedCount = this.selectedCompIds.size + this.selectedWireIds.size;
    this.history.commitTransaction();

    this.clearSelection();
    this.triggerSimulation();
    this.uiCallbacks.onToast(`Deleted ${deletedCount} item(s)`);
  }

  copySelected() {
    if (this.selectedCompIds.size === 0) return;

    const components = [];
    this.selectedCompIds.forEach(id => {
      const comp = this.circuit.components.get(id);
      if (comp) components.push(cloneData(comp));
    });

    const connections = this.circuit.connections
      .filter(wire => this.selectedCompIds.has(wire.fromCompId) && this.selectedCompIds.has(wire.toCompId))
      .map(wire => cloneData(wire));

    this.clipboardGroup = { components, connections };
    this.uiCallbacks.onToast(`Copied ${components.length} component(s)`);
  }

  getInitialPasteAnchorWorld() {
    if (this.lastMouseWorld && Number.isFinite(this.lastMouseWorld.x) && Number.isFinite(this.lastMouseWorld.y)) {
      return { ...this.lastMouseWorld };
    }
    const rect = this.renderer.canvas.getBoundingClientRect();
    return this.renderer.screenToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2);
  }

  getClipboardWorkspaceCenter() {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    this.clipboardGroup.components.forEach(comp => {
      if (!isWorkspaceComponent(comp)) return;
      const bounds = getComponentBounds(comp, this.renderer);
      if (!bounds) return;
      minX = Math.min(minX, bounds.minX);
      minY = Math.min(minY, bounds.minY);
      maxX = Math.max(maxX, bounds.maxX);
      maxY = Math.max(maxY, bounds.maxY);
    });
    return minX === Infinity ? null : { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  }

  pasteSelected() {
    if (!this.clipboardGroup?.components?.length) {
      this.uiCallbacks.onToast('Clipboard is empty');
      return;
    }
    if (this.isPasting) this.cancelPaste(true);

    const anchor = this.getSnappedWorld(this.getInitialPasteAnchorWorld());
    const clipCenter = this.getClipboardWorkspaceCenter() || anchor;
    const offset = { x: anchor.x - clipCenter.x, y: anchor.y - clipCenter.y };
    const previewComponents = [];
    const previewConnections = [];
    const oldToPreview = new Map();
    const workspaceStarts = new Map();

    this.clipboardGroup.components.forEach((comp, index) => {
      const preview = {
        ...cloneData(comp),
        id: `preview_comp_${index + 1}`,
        sourceId: comp.id,
        preview: true,
        x: Math.round((comp.x || 0) + offset.x),
        y: Math.round((comp.y || 0) + offset.y)
      };

      workspaceStarts.set(preview.id, { x: preview.x, y: preview.y });
      oldToPreview.set(comp.id, preview.id);
      previewComponents.push(preview);
    });

    this.clipboardGroup.connections.forEach((wire, index) => {
      const fromCompId = oldToPreview.get(wire.fromCompId);
      const toCompId = oldToPreview.get(wire.toCompId);
      if (!fromCompId || !toCompId) return;
      previewConnections.push({
        id: `preview_wire_${index + 1}`,
        fromCompId,
        fromPinId: wire.fromPinId,
        toCompId,
        toPinId: wire.toPinId,
        state: wire.state ?? 0,
        preview: true
      });
    });

    this.pastePreview = {
      components: previewComponents,
      connections: previewConnections,
      anchorWorld: anchor,
      workspaceStarts
    };

    this.selectedCompIds = new Set(previewComponents.map(comp => comp.id));
    this.selectedWireIds = new Set(previewConnections.map(wire => wire.id));
    this.isPasting = true;
    this.activeTool = 'select';
    this.uiCallbacks.onToolChanged('select');
    this.uiCallbacks.onStatusChange('Paste preview: move mouse, click to place, Esc to cancel');
    this.uiCallbacks.onToast('Paste preview: click to place, Esc to cancel');
    this.requestRender();
  }

  updatePastePreview(world) {
    if (!this.isPasting || !this.pastePreview) return;
    const target = this.getSnappedWorld(world);
    const dx = target.x - this.pastePreview.anchorWorld.x;
    const dy = target.y - this.pastePreview.anchorWorld.y;

    this.pastePreview.workspaceStarts.forEach((start, previewId) => {
      const comp = this.pastePreview.components.find(item => item.id === previewId);
      if (comp) {
        comp.x = Math.round(start.x + dx);
        comp.y = Math.round(start.y + dy);
      }
    });
    this.requestRender();
  }

  commitPaste() {
    if (!this.isPasting || !this.pastePreview) return;

    const sourceToNew = new Map();
    const newCompIds = new Set();
    const newWireIds = new Set();
    this.history.beginTransaction('paste');

    this.pastePreview.components.forEach(preview => {
      const customName = (preview.type === ComponentTypes.INPUT || preview.type === ComponentTypes.OUTPUT)
        ? null
        : (preview.name || null);

      const created = this.circuit.addComponent(
        preview.type,
        preview.x,
        preview.y,
        null,
        preview.value ?? 0,
        customName,
        preview.chipData ? cloneData(preview.chipData) : null,
        preview.icData ? cloneData(preview.icData) : null
      );

      if (created) {
        created.rotation = preview.rotation || 0;
        sourceToNew.set(preview.sourceId, created.id);
        newCompIds.add(created.id);
      }
    });

    this.clipboardGroup.connections.forEach(wire => {
      const fromCompId = sourceToNew.get(wire.fromCompId);
      const toCompId = sourceToNew.get(wire.toCompId);
      if (!fromCompId || !toCompId) return;
      const createdWire = this.circuit.addConnection(fromCompId, wire.fromPinId, toCompId, wire.toPinId);
      if (createdWire) newWireIds.add(createdWire.id);
    });

    this.history.commitTransaction();
    this.selectedCompIds = newCompIds;
    this.selectedWireIds = newWireIds;
    this.isPasting = false;
    this.pastePreview = null;
    this.triggerSimulation();
    this.uiCallbacks.onToast('Pasted circuit');
  }

  cancelPaste(silent = false) {
    if (!this.isPasting) return;
    this.isPasting = false;
    this.pastePreview = null;
    this.selectedCompIds.clear();
    this.selectedWireIds.clear();
    if (!silent) this.uiCallbacks.onToast('Cancelled paste');
    this.requestRender();
  }

  duplicateSelected() {
    if (this.selectedCompIds.size === 0) return;
    this.copySelected();
    this.pasteSelected();
  }

  createChip(chipName = 'MyChip') {
    if (this.selectedCompIds.size === 0) {
      this.uiCallbacks.onToast('Please select components to create a chip.');
      return null;
    }

    this.history.beginTransaction('create chip');
    const result = createChipFromSelection(this.circuit, this.selectedCompIds, chipName);
    if (!result.success) {
      this.history.cancelTransaction();
      this.uiCallbacks.onToast(result.error || 'Failed to create chip.');
      return null;
    }

    this.history.commitTransaction();
    this.clearSelection();
    this.selectComponent(result.chip.id, false);
    this.triggerSimulation();
    const inCount = result.chip.chipData?.interface?.inputs?.length || 0;
    const outCount = result.chip.chipData?.interface?.outputs?.length || 0;
    this.uiCallbacks.onToast(`Created Chip "${result.chip.name}" (${inCount} in, ${outCount} out)`);
    return result.chip;
  }

  expandChip(chipId = null) {
    const targetId = chipId || Array.from(this.selectedCompIds)[0];
    const comp = this.circuit.components.get(targetId);
    if (!comp || comp.type !== ComponentTypes.CHIP) {
      this.uiCallbacks.onToast('Selected item is not a chip.');
      return false;
    }

    this.history.beginTransaction('chip to circuit');
    const result = expandChipToCircuit(this.circuit, targetId);
    if (!result.success) {
      this.history.cancelTransaction();
      this.uiCallbacks.onToast(result.error || 'Failed to expand chip.');
      return false;
    }

    this.history.commitTransaction();
    this.clearSelection();
    (result.restoredCompIds || []).forEach(id => this.selectedCompIds.add(id));
    this.triggerSimulation();
    this.uiCallbacks.onToast(`Restored circuit from Chip "${comp.name}"`);
    return true;
  }

  renameChip(chipId, newName) {
    const comp = this.circuit.components.get(chipId);
    if (!comp || comp.type !== ComponentTypes.CHIP) return false;
    const clean = typeof newName === 'string' && newName.trim() ? newName.trim() : comp.name;

    this.history.beginTransaction('rename chip');
    comp.name = clean;
    if (comp.chipData) comp.chipData.name = clean;
    this.history.commitTransaction();
    this.triggerSimulation();
    this.uiCallbacks.onToast(`Renamed chip to "${clean}"`);
    return true;
  }

  updateChipCircuit(chipId, updatedCircuitData) {
    const comp = this.circuit.components.get(chipId);
    if (!comp || comp.type !== ComponentTypes.CHIP || !comp.chipData) return false;

    this.history.beginTransaction('edit chip circuit');
    comp.chipData.circuit = updatedCircuitData;
    this.history.commitTransaction();
    this.triggerSimulation();
    this.uiCallbacks.onToast(`Updated internal circuit for "${comp.name}"`);
    return true;
  }

  rotateSelected() {
    const rotatable = Array.from(this.selectedCompIds).filter(id => isWorkspaceComponent(this.circuit.components.get(id)));
    if (rotatable.length === 0) return;
    this.history.beginTransaction('rotate');
    rotatable.forEach(id => this.circuit.rotateComponent(id));
    this.history.commitTransaction();
    this.triggerSimulation();
  }

  triggerSimulation(options = {}) {
    const result = this.simulator.run();
    if (result.cycleDetected && result.error) this.uiCallbacks.onToast?.(result.error);
    if (!result.success && !result.cycleDetected && result.error) this.uiCallbacks.onToast?.(result.error);
    this.uiCallbacks.onCircuitUpdated?.(options);
    this.requestRender();
  }

  requestRender() {
    this.renderer.render(
      this.circuit,
      this.selectedCompIds,
      this.selectedWireIds,
      this.hoveredPinInfo,
      this.currentMarqueeBox,
      this.isPasting,
      this.pastePreview
    );
  }
}
