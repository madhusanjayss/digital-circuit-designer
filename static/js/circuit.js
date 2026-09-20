/* ==========================================================================
   Circuit Data Model, Connection Graph, Migration, and Validation
   ========================================================================== */

import {
  ComponentTypes,
  POWER_RAIL_SPECS,
  isSupportedComponentType,
  getComponentPinSpecs,
  getPinSpec,
  getPinPosition as getComponentPinPosition,
  getComponentBounds,
  resolvePin as resolveComponentPin,
  normalizePinType,
  getInputNameForIndex,
  getOutputNameForIndex,
  getCleanLabel
} from './components.js';

export const CIRCUIT_SCHEMA_VERSION = 1;

export function cloneData(data) {
  return JSON.parse(JSON.stringify(data));
}

export function cloneChipData(chipData) {
  if (!chipData) return null;
  return cloneData(chipData);
}

export function validateChipData(chipData) {
  if (!chipData || typeof chipData !== 'object') {
    return { valid: false, errors: ['Chip data must be an object.'] };
  }
  const errors = [];
  const chipInterface = chipData.interface || chipData;
  if (!Array.isArray(chipInterface.inputs)) errors.push('Chip interface inputs must be an array.');
  if (!Array.isArray(chipInterface.outputs)) errors.push('Chip interface outputs must be an array.');
  if (!chipData.circuit || typeof chipData.circuit !== 'object') {
    errors.push('Chip internal circuit definition is missing.');
  } else {
    if (!Array.isArray(chipData.circuit.components)) errors.push('Chip internal components must be an array.');
    if (!Array.isArray(chipData.circuit.connections)) errors.push('Chip internal connections must be an array.');
  }
  return { valid: errors.length === 0, errors };
}

export function validateWireComponent(comp) {
  const errors = [];
  if (!comp || typeof comp !== 'object') {
    return { valid: false, errors: ['Wire component must be an object.'] };
  }
  if (!comp.input || !Number.isFinite(Number(comp.input.x)) || !Number.isFinite(Number(comp.input.y))) {
    errors.push(`Wire ${comp.id}: must have a valid input position.`);
  }
  if (!comp.output || !Number.isFinite(Number(comp.output.x)) || !Number.isFinite(Number(comp.output.y))) {
    errors.push(`Wire ${comp.id}: must have a valid primary output position.`);
  }
  if (Array.isArray(comp.segments)) {
    comp.segments.forEach((seg, sIdx) => {
      const isOrthogonal = Math.abs(seg.x1 - seg.x2) < 0.5 || Math.abs(seg.y1 - seg.y2) < 0.5;
      if (!isOrthogonal) {
        errors.push(`Wire ${comp.id}: segment ${sIdx} is not orthogonal.`);
      }
    });
  }
  if (Array.isArray(comp.branches)) {
    comp.branches.forEach((b, bIdx) => {
      if (!b.anchor || !Number.isFinite(Number(b.anchor.x)) || !Number.isFinite(Number(b.anchor.y))) {
        errors.push(`Wire ${comp.id}: branch ${b.id || bIdx} must have a valid anchor position.`);
      }
      if (!b.output || !Number.isFinite(Number(b.output.x)) || !Number.isFinite(Number(b.output.y))) {
        errors.push(`Wire ${comp.id}: branch ${b.id || bIdx} must have a valid output endpoint.`);
      }
      if (Array.isArray(b.segments)) {
        b.segments.forEach((seg, sIdx) => {
          const isOrthogonal = Math.abs(seg.x1 - seg.x2) < 0.5 || Math.abs(seg.y1 - seg.y2) < 0.5;
          if (!isOrthogonal) {
            errors.push(`Wire ${comp.id}: branch ${b.id || bIdx} segment ${sIdx} is not orthogonal.`);
          }
        });
      }
    });
  }
  return { valid: errors.length === 0, errors };
}

function normalizeInteger(value, fallback = 0) {
  const num = Number(value);
  return Number.isInteger(num) && num >= 0 ? num : fallback;
}

function normalizeSignalValue(value) {
  return Number(value) === 1 ? 1 : 0;
}

function normalizePinId(pinId) {
  if (pinId === undefined || pinId === null) return pinId;
  return String(pinId)
    .replace(/^input/i, 'in')
    .replace(/^output/i, 'out');
}

function nextNumericId(existingIds, prefix) {
  let max = 0;
  const re = new RegExp(`^${prefix}_(\\d+)$`);
  existingIds.forEach(id => {
    const match = String(id).match(re);
    if (match) max = Math.max(max, Number(match[1]));
  });
  return max + 1;
}

export function normalizeConnection(pinA, pinB) {
  if (!pinA || !pinB) return null;
  if (!pinA.compId || !pinB.compId || !pinA.pinId || !pinB.pinId) return null;
  if (pinA.compId === pinB.compId) return null;

  const typeA = normalizePinType(pinA.pinType);
  const typeB = normalizePinType(pinB.pinType);
  if (!typeA || !typeB || typeA === typeB) return null;

  if (typeA === 'out' && typeB === 'in') {
    return {
      fromCompId: pinA.compId,
      fromPinId: pinA.pinId,
      toCompId: pinB.compId,
      toPinId: pinB.pinId
    };
  }

  return {
    fromCompId: pinB.compId,
    fromPinId: pinB.pinId,
    toCompId: pinA.compId,
    toPinId: pinA.pinId
  };
}

export function migrateCircuitData(rawData) {
  const data = cloneData(rawData || {});
  data.version = CIRCUIT_SCHEMA_VERSION;
  data.components = Array.isArray(data.components) ? data.components : [];
  data.connections = Array.isArray(data.connections) ? data.connections : [];

  let inCount = 0;
  let outCount = 0;

  data.components = data.components.map(comp => {
    const migrated = { ...comp };
    migrated.id = migrated.id == null ? migrated.id : String(migrated.id);
    migrated.type = String(migrated.type || '');
    migrated.x = Number.isFinite(Number(migrated.x)) ? Math.round(Number(migrated.x)) : 0;
    migrated.y = Number.isFinite(Number(migrated.y)) ? Math.round(Number(migrated.y)) : 0;
    migrated.rotation = normalizeInteger(migrated.rotation, 0) % 360;
    migrated.value = normalizeSignalValue(migrated.value);
    if (typeof migrated.name === 'string') migrated.name = migrated.name.trim();

    if (migrated.type === ComponentTypes.INPUT) {
      if (!migrated.name) migrated.name = String.fromCharCode(65 + (inCount % 26)) + (inCount >= 26 ? Math.floor(inCount / 26) : '');
      inCount++;
    } else if (migrated.type === ComponentTypes.OUTPUT) {
      if (!migrated.name) migrated.name = `O${outCount + 1}`;
      outCount++;
    } else if (migrated.type === ComponentTypes.CHIP) {
      if (!migrated.name) migrated.name = 'CHIP';
      migrated.chipData = cloneData(comp.chipData || {
        version: 1,
        name: migrated.name,
        interface: { inputs: [], outputs: [] },
        circuit: { version: 1, components: [], connections: [] }
      });
    } else if (migrated.type === ComponentTypes.IC) {
      migrated.icData = cloneData(comp.icData || { definitionId: '74HC00', definitionVersion: 1 });
      if (!migrated.name) migrated.name = migrated.icData?.name || migrated.icData?.definitionId || 'IC';
    } else if (POWER_RAIL_SPECS[migrated.type]) {
      if (!migrated.name) migrated.name = POWER_RAIL_SPECS[migrated.type].label;
    } else if (migrated.type === ComponentTypes.WIRE || String(migrated.type).toLowerCase() === 'wire') {
      migrated.type = ComponentTypes.WIRE;
      if (!migrated.name) migrated.name = 'Wire';
      migrated.input = comp.input && typeof comp.input === 'object'
        ? { x: Math.round(Number(comp.input.x) || migrated.x || 0), y: Math.round(Number(comp.input.y) || migrated.y || 0) }
        : { x: migrated.x || 0, y: migrated.y || 0 };
      migrated.output = comp.output && typeof comp.output === 'object'
        ? { x: Math.round(Number(comp.output.x) || comp.input?.x || migrated.x || 0), y: Math.round(Number(comp.output.y) || comp.input?.y || migrated.y || 0) }
        : { x: migrated.input.x, y: migrated.input.y };
      migrated.points = Array.isArray(comp.points) ? comp.points.map(p => ({ x: Math.round(Number(p.x) || 0), y: Math.round(Number(p.y) || 0) })) : [];
      migrated.segments = Array.isArray(comp.segments) ? comp.segments.map(s => ({
        x1: Math.round(Number(s.x1) || 0),
        y1: Math.round(Number(s.y1) || 0),
        x2: Math.round(Number(s.x2) || 0),
        y2: Math.round(Number(s.y2) || 0)
      })) : [];
      migrated.branches = Array.isArray(comp.branches) ? comp.branches.map((b, bIdx) => ({
        id: b.id || `branch_${bIdx + 1}`,
        anchor: { x: Math.round(Number(b.anchor?.x) || 0), y: Math.round(Number(b.anchor?.y) || 0) },
        output: { x: Math.round(Number(b.output?.x) || 0), y: Math.round(Number(b.output?.y) || 0) },
        points: Array.isArray(b.points) ? b.points.map(p => ({ x: Math.round(Number(p.x) || 0), y: Math.round(Number(p.y) || 0) })) : [],
        segments: Array.isArray(b.segments) ? b.segments.map(s => ({
          x1: Math.round(Number(s.x1) || 0),
          y1: Math.round(Number(s.y1) || 0),
          x2: Math.round(Number(s.x2) || 0),
          y2: Math.round(Number(s.y2) || 0)
        })) : []
      })) : [];
      migrated.signal = normalizeSignalValue(comp.signal ?? comp.value ?? 0);
    } else if (migrated.type === ComponentTypes.CLOCK) {
      if (!migrated.name) migrated.name = 'CLK';
      migrated.frequency = Number(comp.frequency) > 0 ? Number(comp.frequency) : 1;
      migrated.period = Number(comp.period) > 0 ? Math.round(Number(comp.period)) : Math.round(1000 / migrated.frequency);
      migrated.dutyCycle = Number.isFinite(Number(comp.dutyCycle)) ? Math.max(1, Math.min(99, Number(comp.dutyCycle))) : 50;
      migrated.running = !!comp.running;
      migrated.pulseType = comp.pulseType || 'HIGH';
      migrated.pulseDuration = Number(comp.pulseDuration) > 0 ? Math.round(Number(comp.pulseDuration)) : 100;
      migrated.value = normalizeSignalValue(comp.value);
    } else if (migrated.type === ComponentTypes.D_LATCH) {
      if (!migrated.name) migrated.name = 'D_LATCH';
      const q = normalizeSignalValue(comp.state?.Q ?? 0);
      const qbar = normalizeSignalValue(comp.state?.Qbar ?? (1 - q));
      migrated.state = { Q: q, Qbar: qbar };
      migrated.value = q;
    } else if (migrated.type === ComponentTypes.SR_LATCH) {
      if (!migrated.name) migrated.name = 'SR_LATCH';
      const q = normalizeSignalValue(comp.state?.Q ?? 0);
      const qbar = normalizeSignalValue(comp.state?.Qbar ?? (1 - q));
      migrated.state = { Q: q, Qbar: qbar, invalid: !!comp.state?.invalid };
      migrated.value = q;
    } else {
      if (!migrated.name) migrated.name = migrated.type || 'COMP';
    }

    delete migrated.railSide;
    delete migrated.railIndex;

    return migrated;
  });

  data.connections = data.connections.map(conn => ({
    id: conn.id == null ? conn.id : String(conn.id),
    fromCompId: conn.fromCompId == null ? conn.fromCompId : String(conn.fromCompId),
    fromPinId: normalizePinId(conn.fromPinId),
    toCompId: conn.toCompId == null ? conn.toCompId : String(conn.toCompId),
    toPinId: normalizePinId(conn.toPinId),
    state: normalizeSignalValue(conn.state)
  }));

  return data;
}

export function validateRawCircuitData(data) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Circuit data must be an object.'] };
  }
  if (!Array.isArray(data.components)) errors.push('components must be an array.');
  if (!Array.isArray(data.connections)) errors.push('connections must be an array.');
  if (errors.length) return { valid: false, errors };

  const compIds = new Set();
  data.components.forEach((comp, idx) => {
    if (!comp || typeof comp !== 'object') {
      errors.push(`components[${idx}] must be an object.`);
      return;
    }
    if (!comp.id) errors.push(`components[${idx}] has no id.`);
    if (compIds.has(comp.id)) errors.push(`Duplicate component ID ${comp.id}.`);
    compIds.add(comp.id);
    if (!isSupportedComponentType(comp.type)) {
      errors.push(`components[${idx}] (${comp.id}) has unsupported type ${comp.type}.`);
    }
    if (comp.type === ComponentTypes.CHIP) {
      const chipCheck = validateChipData(comp.chipData);
      if (!chipCheck.valid) {
        errors.push(...chipCheck.errors.map(err => `CHIP ${comp.id}: ${err}`));
      }
    } else if (comp.type === ComponentTypes.WIRE || String(comp.type).toLowerCase() === 'wire') {
      const wireCheck = validateWireComponent(comp);
      if (!wireCheck.valid) {
        errors.push(...wireCheck.errors);
      }
    }
  });

  data.connections.forEach((conn, idx) => {
    if (!conn || typeof conn !== 'object') {
      errors.push(`connections[${idx}] must be an object.`);
      return;
    }
    if (!conn.fromCompId) errors.push(`connections[${idx}] has no fromCompId.`);
    if (!conn.fromPinId) errors.push(`connections[${idx}] has no fromPinId.`);
    if (!conn.toCompId) errors.push(`connections[${idx}] has no toCompId.`);
    if (!conn.toPinId) errors.push(`connections[${idx}] has no toPinId.`);
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

export function validateConnection(circuit, connection, options = {}) {
  const errors = [];
  const ignoreWireId = options.ignoreWireId || null;

  if (!circuit || !connection) {
    return { valid: false, reason: 'Connection is missing.', errors: ['Connection is missing.'] };
  }

  const fromComp = circuit.components.get(connection.fromCompId);
  const toComp = circuit.components.get(connection.toCompId);

  if (!fromComp) errors.push(`Source component ${connection.fromCompId} does not exist.`);
  if (!toComp) errors.push(`Target component ${connection.toCompId} does not exist.`);
  if (connection.fromCompId === connection.toCompId) errors.push('Cannot connect a component to itself.');

  const fromPin = fromComp ? resolveComponentPin(circuit, connection.fromCompId, connection.fromPinId, circuit.renderer) : null;
  const toPin = toComp ? resolveComponentPin(circuit, connection.toCompId, connection.toPinId, circuit.renderer) : null;

  if (!fromPin) errors.push(`Source pin ${connection.fromPinId} does not exist on ${connection.fromCompId}.`);
  if (!toPin) errors.push(`Target pin ${connection.toPinId} does not exist on ${connection.toCompId}.`);
  if (fromPin && fromPin.pinType !== 'out') errors.push(`Source pin ${connection.fromPinId} must be an output.`);
  if (toPin && toPin.pinType !== 'in') errors.push(`Target pin ${connection.toPinId} must be an input.`);

  if (fromPin && toPin && fromComp && toComp) {
    const fromPinSpec = getPinSpec(fromComp.type, connection.fromPinId, fromComp);
    const toPinSpec = getPinSpec(toComp.type, connection.toPinId, toComp);

    const isFromPower = fromPinSpec?.kind === 'power' || fromPinSpec?.category === 'power' || !!POWER_RAIL_SPECS[fromComp.type];
    const isToPower = toPinSpec?.kind === 'power' || toPinSpec?.category === 'power';

    if (!isFromPower && isToPower) {
      errors.push(`IC supply pin ${connection.toPinId} must be connected to a Power source (VCC or GND).`);
    }
  }

  const occupied = circuit.connections.some(wire =>
    wire.id !== ignoreWireId &&
    wire.toCompId === connection.toCompId &&
    wire.toPinId === connection.toPinId
  );
  if (occupied) errors.push(`Target input ${connection.toCompId}:${connection.toPinId} already has an incoming wire.`);

  if (options.requireUniqueId && connection.id) {
    const duplicateId = circuit.connections.some(wire => wire.id === connection.id && wire.id !== ignoreWireId);
    if (duplicateId) errors.push(`Duplicate wire ID ${connection.id}.`);
  }

  return {
    valid: errors.length === 0,
    reason: errors[0] || '',
    errors
  };
}

export function validateCircuit(circuit) {
  const errors = [];
  const compKeys = new Set();
  const wireIds = new Set();
  const incomingPins = new Map();

  if (!circuit || !(circuit.components instanceof Map) || !Array.isArray(circuit.connections)) {
    return { valid: false, errors: ['Circuit object is malformed.'] };
  }

  circuit.components.forEach((comp, key) => {
    if (!comp || typeof comp !== 'object') {
      errors.push(`Component ${key} is malformed.`);
      return;
    }
    if (compKeys.has(comp.id)) errors.push(`Duplicate component ID ${comp.id}.`);
    compKeys.add(comp.id);
    if (key !== comp.id) errors.push(`Component map key ${key} does not match component id ${comp.id}.`);
    if (!isSupportedComponentType(comp.type)) errors.push(`Component ${comp.id} has unsupported type ${comp.type}.`);

    if (comp.type === ComponentTypes.WIRE || String(comp.type).toLowerCase() === 'wire') {
      const wireCheck = validateWireComponent(comp);
      if (!wireCheck.valid) errors.push(...wireCheck.errors);
    }

    const specs = getComponentPinSpecs(comp.type, comp);
    [...specs.inputs, ...specs.outputs].forEach(pin => {
      const type = normalizePinType(pin.type);
      if (type !== pin.type) errors.push(`Pin ${comp.type}.${pin.id} must use canonical type "${type}".`);
    });
  });

  circuit.connections.forEach(wire => {
    if (!wire || typeof wire !== 'object') {
      errors.push('Malformed connection object.');
      return;
    }
    if (!wire.id) errors.push('Connection has no id.');
    if (wireIds.has(wire.id)) errors.push(`Duplicate wire ID ${wire.id}.`);
    wireIds.add(wire.id);

    const check = validateConnection(circuit, wire, { ignoreWireId: wire.id });
    if (!check.valid) errors.push(...check.errors.map(err => `Wire ${wire.id}: ${err}`));

    const targetKey = `${wire.toCompId}:${wire.toPinId}`;
    incomingPins.set(targetKey, (incomingPins.get(targetKey) || 0) + 1);
  });

  incomingPins.forEach((count, key) => {
    if (count > 1) errors.push(`Multiple incoming wires target ${key}.`);
  });

  return { valid: errors.length === 0, errors };
}

export function createChipFromSelection(circuit, selectedCompIds, chipName = 'MyChip') {
  const selectedSet = new Set(selectedCompIds);
  if (selectedSet.size === 0) {
    return { success: false, error: 'No components selected.' };
  }

  const selectedComps = [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  selectedSet.forEach(id => {
    const comp = circuit.components.get(id);
    if (comp) {
      selectedComps.push(comp);
      const b = getComponentBounds(comp, circuit.renderer);
      if (b) {
        minX = Math.min(minX, b.minX);
        minY = Math.min(minY, b.minY);
        maxX = Math.max(maxX, b.maxX);
        maxY = Math.max(maxY, b.maxY);
      }
    }
  });

  if (selectedComps.length === 0) {
    return { success: false, error: 'Selected components could not be found.' };
  }

  const centerX = Math.round((minX + maxX) / 2);
  const centerY = Math.round((minY + maxY) / 2);

  // 1. Capture internal connections
  const internalWires = circuit.connections.filter(
    w => selectedSet.has(w.fromCompId) && selectedSet.has(w.toCompId)
  );

  // 2. Capture inbound boundary wires (from outside -> selected)
  const inboundWires = circuit.connections.filter(
    w => !selectedSet.has(w.fromCompId) && selectedSet.has(w.toCompId)
  );

  // 3. Capture outbound boundary wires (selected -> to outside)
  const outboundWires = circuit.connections.filter(
    w => selectedSet.has(w.fromCompId) && !selectedSet.has(w.toCompId)
  );

  // 4. Build Chip Inputs
  const inputs = [];
  const inboundRewirePlan = [];

  if (inboundWires.length > 0) {
    // Group inbound wires by external source endpoint (fromCompId:fromPinId)
    const sourceMap = new Map();
    inboundWires.forEach(wire => {
      const key = `${wire.fromCompId}:${wire.fromPinId}`;
      if (!sourceMap.has(key)) sourceMap.set(key, []);
      sourceMap.get(key).push(wire);
    });

    const sortedSourceKeys = Array.from(sourceMap.keys()).sort((keyA, keyB) => {
      const [compIdA, pinIdA] = keyA.split(':');
      const [compIdB, pinIdB] = keyB.split(':');
      const compA = circuit.components.get(compIdA);
      const compB = circuit.components.get(compIdB);
      const posA = compA ? getComponentPinPosition(compA, pinIdA, circuit.renderer) : { x: 0, y: 0 };
      const posB = compB ? getComponentPinPosition(compB, pinIdB, circuit.renderer) : { x: 0, y: 0 };
      return (posA.y - posB.y) || (posA.x - posB.x) || compA.y - compB.y || compIdA.localeCompare(compIdB) || pinIdA.localeCompare(pinIdB);
    });

    const usedInputNames = new Set();
    sortedSourceKeys.forEach((key, idx) => {
      const [fromCompId, fromPinId] = key.split(':');
      const wires = sourceMap.get(key);
      const firstSourceComp = circuit.components.get(fromCompId);
      let baseName = firstSourceComp && (firstSourceComp.type === ComponentTypes.INPUT || firstSourceComp.name)
        ? getCleanLabel(firstSourceComp)
        : getInputNameForIndex(idx);
      if (!baseName) baseName = `IN_${idx + 1}`;

      let pinName = baseName;
      let suffix = 2;
      while (usedInputNames.has(pinName)) {
        pinName = `${baseName}${suffix++}`;
      }
      usedInputNames.add(pinName);

      const pinId = `in${idx}`;
      const targets = wires.map(w => ({ compId: w.toCompId, pinId: w.toPinId }));

      inputs.push({
        id: pinId,
        name: pinName,
        internalTargets: targets,
        internalTarget: targets[0] || null,
        internalCompId: targets[0]?.compId || null,
        internalPinId: targets[0]?.pinId || null
      });

      inboundRewirePlan.push({
        fromCompId,
        fromPinId,
        toPinId: pinId
      });
    });
  } else {
    const internalInputComps = selectedComps.filter(c => c.type === ComponentTypes.INPUT);
    internalInputComps.sort((a, b) => a.y - b.y || a.x - b.x);
    if (internalInputComps.length > 0) {
      internalInputComps.forEach((inpComp, idx) => {
        const pinName = getCleanLabel(inpComp) || getInputNameForIndex(idx);
        const drivenWires = internalWires.filter(w => w.fromCompId === inpComp.id);
        const drivenTargets = drivenWires.map(w => ({ compId: w.toCompId, pinId: w.toPinId }));
        inputs.push({
          id: `in${idx}`,
          name: pinName,
          internalCompId: inpComp.id,
          internalPinId: 'out0',
          internalTarget: drivenTargets[0] || { compId: inpComp.id, pinId: 'out0' },
          internalTargets: drivenTargets.length > 0 ? drivenTargets : [{ compId: inpComp.id, pinId: 'out0' }]
        });
      });
    } else {
      const undrivenInputs = [];
      selectedComps.forEach(c => {
        const pinSpecs = getComponentPinSpecs(c.type, c);
        (pinSpecs.inputs || []).forEach(p => {
          const hasDriver = internalWires.some(w => w.toCompId === c.id && w.toPinId === p.id);
          if (!hasDriver) {
            undrivenInputs.push({ compId: c.id, pinId: p.id, comp: c });
          }
        });
      });
      undrivenInputs.sort((a, b) => (a.comp.y - b.comp.y) || (a.comp.x - b.comp.x));
      undrivenInputs.forEach((entry, idx) => {
        inputs.push({
          id: `in${idx}`,
          name: getInputNameForIndex(idx),
          internalCompId: entry.compId,
          internalPinId: entry.pinId,
          internalTarget: { compId: entry.compId, pinId: entry.pinId },
          internalTargets: [{ compId: entry.compId, pinId: entry.pinId }]
        });
      });
    }
  }

  // 5. Build Chip Outputs
  const outputs = [];
  const outboundRewirePlan = [];

  if (outboundWires.length > 0) {
    const sourceMap = new Map();
    outboundWires.forEach(wire => {
      const key = `${wire.fromCompId}:${wire.fromPinId}`;
      if (!sourceMap.has(key)) sourceMap.set(key, []);
      sourceMap.get(key).push(wire);
    });

    const sortedSourceKeys = Array.from(sourceMap.keys()).sort((keyA, keyB) => {
      const [compIdA, pinIdA] = keyA.split(':');
      const [compIdB, pinIdB] = keyB.split(':');
      const compA = circuit.components.get(compIdA);
      const compB = circuit.components.get(compIdB);
      const posA = compA ? getComponentPinPosition(compA, pinIdA, circuit.renderer) : { x: 0, y: 0 };
      const posB = compB ? getComponentPinPosition(compB, pinIdB, circuit.renderer) : { x: 0, y: 0 };
      return (posA.y - posB.y) || (posA.x - posB.x) || compA.y - compB.y || compIdA.localeCompare(compIdB) || pinIdA.localeCompare(pinIdB);
    });

    const usedOutputNames = new Set();
    sortedSourceKeys.forEach((key, idx) => {
      const [fromCompId, fromPinId] = key.split(':');
      const wires = sourceMap.get(key);
      const firstDestComp = circuit.components.get(wires[0].toCompId);
      let baseName = firstDestComp && (firstDestComp.type === ComponentTypes.OUTPUT || firstDestComp.name)
        ? getCleanLabel(firstDestComp)
        : getOutputNameForIndex(idx);
      if (!baseName) baseName = `OUT_${idx + 1}`;

      let pinName = baseName;
      let suffix = 2;
      while (usedOutputNames.has(pinName)) {
        pinName = `${baseName}${suffix++}`;
      }
      usedOutputNames.add(pinName);

      const pinId = `out${idx}`;
      outputs.push({
        id: pinId,
        name: pinName,
        internalSource: { compId: fromCompId, pinId: fromPinId },
        internalCompId: fromCompId,
        internalPinId: fromPinId
      });

      wires.forEach(w => {
        outboundRewirePlan.push({
          fromPinId: pinId,
          toCompId: w.toCompId,
          toPinId: w.toPinId
        });
      });
    });
  } else {
    const internalOutputComps = selectedComps.filter(c => c.type === ComponentTypes.OUTPUT);
    internalOutputComps.sort((a, b) => a.y - b.y || a.x - b.x);
    if (internalOutputComps.length > 0) {
      internalOutputComps.forEach((outComp, idx) => {
        const pinName = getCleanLabel(outComp) || getOutputNameForIndex(idx);
        const wireToOut = internalWires.find(w => w.toCompId === outComp.id && w.toPinId === 'in0');
        outputs.push({
          id: `out${idx}`,
          name: pinName,
          internalSource: wireToOut
            ? { compId: wireToOut.fromCompId, pinId: wireToOut.fromPinId }
            : { compId: outComp.id, pinId: 'out0' },
          internalCompId: wireToOut ? wireToOut.fromCompId : outComp.id,
          internalOutputCompId: outComp.id,
          internalPinId: wireToOut ? wireToOut.fromPinId : 'out0'
        });
      });
    } else {
      const terminalGates = selectedComps.filter(c => {
        if (c.type === ComponentTypes.INPUT) return false;
        if (c.type === ComponentTypes.WIRE || String(c.type).toLowerCase() === 'wire') {
          const out0Unconnected = !internalWires.some(w => w.fromCompId === c.id && w.fromPinId === 'out0');
          const branchUnconnected = Array.isArray(c.branches) && c.branches.some(b => !internalWires.some(w => w.fromCompId === c.id && w.fromPinId === b.id));
          return out0Unconnected || branchUnconnected;
        }
        return !internalWires.some(w => w.fromCompId === c.id);
      });
      terminalGates.sort((a, b) => a.y - b.y || a.x - b.x);
      terminalGates.forEach((gate) => {
        if (gate.type === ComponentTypes.WIRE || String(gate.type).toLowerCase() === 'wire') {
          if (!internalWires.some(w => w.fromCompId === gate.id && w.fromPinId === 'out0')) {
            const outIdx = outputs.length;
            outputs.push({
              id: `out${outIdx}`,
              name: getOutputNameForIndex(outIdx),
              internalSource: { compId: gate.id, pinId: 'out0' },
              internalCompId: gate.id,
              internalPinId: 'out0'
            });
          }
          if (Array.isArray(gate.branches)) {
            gate.branches.forEach(b => {
              if (!internalWires.some(w => w.fromCompId === gate.id && w.fromPinId === b.id)) {
                const outIdx = outputs.length;
                outputs.push({
                  id: `out${outIdx}`,
                  name: `OUT_${b.id}`,
                  internalSource: { compId: gate.id, pinId: b.id },
                  internalCompId: gate.id,
                  internalPinId: b.id
                });
              }
            });
          }
        } else {
          const outIdx = outputs.length;
          outputs.push({
            id: `out${outIdx}`,
            name: getOutputNameForIndex(outIdx),
            internalSource: { compId: gate.id, pinId: 'out0' },
            internalCompId: gate.id,
            internalPinId: 'out0'
          });
        }
      });
    }
  }

  // 6. Build localized internal circuit snapshot
  const localComponents = selectedComps.map(comp => {
    const cloned = cloneData(comp);
    const dx = -centerX;
    const dy = -centerY;
    cloned.x = (comp.x || 0) + dx;
    cloned.y = (comp.y || 0) + dy;
    if (comp.type === ComponentTypes.WIRE || String(comp.type).toLowerCase() === 'wire') {
      if (cloned.input) { cloned.input.x += dx; cloned.input.y += dy; }
      if (cloned.output) { cloned.output.x += dx; cloned.output.y += dy; }
      if (Array.isArray(cloned.points)) {
        cloned.points.forEach(p => { p.x += dx; p.y += dy; });
      }
      if (Array.isArray(cloned.segments)) {
        cloned.segments.forEach(s => { s.x1 += dx; s.y1 += dy; s.x2 += dx; s.y2 += dy; });
      }
      if (Array.isArray(cloned.branches)) {
        cloned.branches.forEach(b => {
          if (b.anchor) { b.anchor.x += dx; b.anchor.y += dy; }
          if (b.output) { b.output.x += dx; b.output.y += dy; }
          if (Array.isArray(b.points)) {
            b.points.forEach(p => { p.x += dx; p.y += dy; });
          }
          if (Array.isArray(b.segments)) {
            b.segments.forEach(s => { s.x1 += dx; s.y1 += dy; s.x2 += dx; s.y2 += dy; });
          }
        });
      }
    }
    return cloned;
  });

  const localConnections = internalWires.map(wire => ({
    ...cloneData(wire)
  }));

  const cleanName = typeof chipName === 'string' && chipName.trim() ? chipName.trim() : 'MyChip';

  const chipData = {
    version: 1,
    name: cleanName,
    interface: {
      inputs,
      outputs
    },
    circuit: {
      version: 1,
      components: localComponents,
      connections: localConnections
    }
  };

  // 7. Remove selected components and their connected wires
  selectedSet.forEach(id => {
    circuit.removeComponent(id);
  });

  // 8. Add the CHIP component at center
  const newChip = circuit.addComponent(ComponentTypes.CHIP, centerX, centerY, null, 0, cleanName, chipData);
  if (!newChip) {
    return { success: false, error: 'Failed to create CHIP component.' };
  }

  // 9. Reconnect boundary wires to the new CHIP
  inboundRewirePlan.forEach(wire => {
    circuit.addConnection(wire.fromCompId, wire.fromPinId, newChip.id, wire.toPinId);
  });

  outboundRewirePlan.forEach(wire => {
    circuit.addConnection(newChip.id, wire.fromPinId, wire.toCompId, wire.toPinId);
  });

  return {
    success: true,
    chip: newChip
  };
}

export function expandChipToCircuit(circuit, chipId) {
  const chip = circuit.components.get(chipId);
  if (!chip || chip.type !== ComponentTypes.CHIP || !chip.chipData) {
    return { success: false, error: 'Selected component is not a valid CHIP.' };
  }

  const chipData = cloneData(chip.chipData);
  const chipInterface = chipData.interface || chipData;
  const internalComps = Array.isArray(chipData.circuit?.components) ? chipData.circuit.components : [];
  const internalWires = Array.isArray(chipData.circuit?.connections) ? chipData.circuit.connections : [];

  if (internalComps.length === 0) {
    return { success: false, error: 'Chip has no internal components.' };
  }

  // 1. Capture existing top-level wires connected to chip pins BEFORE removing the chip
  const inboundWires = circuit.connections.filter(w => w.toCompId === chipId);
  const outboundWires = circuit.connections.filter(w => w.fromCompId === chipId);

  // 2. Remove the chip component (and its attached wires) from the circuit
  circuit.removeComponent(chipId);

  // 3. ID translation map for internal components
  const idMap = new Map();
  internalComps.forEach(ic => {
    const newId = circuit.allocateComponentId(ic.id);
    idMap.set(ic.id, newId);
  });

  // 4. Identify internal placeholder INPUT and OUTPUT components to omit when external wires exist
  const omittedInternalCompIds = new Set();
  const omittedInternalWireIndices = new Set();

  // Handle Inbound Wires (external signals feeding chip inputs)
  const externalInboundConnections = [];

  (chipInterface.inputs || []).forEach(inpDef => {
    const connectedInboundWires = inboundWires.filter(w => w.toPinId === inpDef.id);
    const intCompId = inpDef.internalCompId || inpDef.internalTarget?.compId;
    const internalComp = internalComps.find(c => c.id === intCompId);

    if (connectedInboundWires.length > 0) {
      let directTargets = [];

      if (internalComp && internalComp.type === ComponentTypes.INPUT) {
        // Omit internal INPUT component from canvas restoration
        omittedInternalCompIds.add(internalComp.id);

        // Find internal wires starting from this internal INPUT component and omit them
        internalWires.forEach((iw, idx) => {
          if (iw.fromCompId === internalComp.id) {
            omittedInternalWireIndices.add(idx);
            directTargets.push({ compId: iw.toCompId, pinId: iw.toPinId });
          }
        });
      } else {
        const rawTargets = Array.isArray(inpDef.internalTargets) && inpDef.internalTargets.length > 0
          ? inpDef.internalTargets
          : (inpDef.internalTarget ? [inpDef.internalTarget] : []);
        rawTargets.forEach(t => {
          if (t && t.compId) directTargets.push(t);
        });
      }

      connectedInboundWires.forEach(wire => {
        directTargets.forEach(tgt => {
          const translatedTargetCompId = idMap.get(tgt.compId) || tgt.compId;
          externalInboundConnections.push({
            fromCompId: wire.fromCompId,
            fromPinId: wire.fromPinId,
            toCompId: translatedTargetCompId,
            toPinId: tgt.pinId
          });
        });
      });
    }
  });

  // Handle Outbound Wires (chip outputs driving external components)
  const externalOutboundConnections = [];

  (chipInterface.outputs || []).forEach(outDef => {
    const connectedOutboundWires = outboundWires.filter(w => w.fromPinId === outDef.id);

    if (connectedOutboundWires.length > 0) {
      let realSource = outDef.internalSource || null;
      let outputPlaceholderCompId = outDef.internalOutputCompId || null;

      const intComp = internalComps.find(c => c.id === (outDef.internalOutputCompId || outDef.internalCompId));
      if (intComp && intComp.type === ComponentTypes.OUTPUT) {
        outputPlaceholderCompId = intComp.id;
      }

      if (!realSource) {
        if (outputPlaceholderCompId) {
          const wireToOut = internalWires.find(w => w.toCompId === outputPlaceholderCompId && w.toPinId === 'in0');
          if (wireToOut) {
            realSource = { compId: wireToOut.fromCompId, pinId: wireToOut.fromPinId };
          }
        }
        if (!realSource) {
          realSource = { compId: outDef.internalCompId, pinId: outDef.internalPinId || 'out0' };
        }
      }

      // Omit internal placeholder OUTPUT component from restoration
      if (outputPlaceholderCompId) {
        omittedInternalCompIds.add(outputPlaceholderCompId);
      }

      // Also omit any internal wire and internal OUTPUT component fed by realSource
      if (realSource && realSource.compId) {
        internalWires.forEach((iw, idx) => {
          if (iw.fromCompId === realSource.compId && iw.fromPinId === realSource.pinId) {
            const destComp = internalComps.find(c => c.id === iw.toCompId);
            if (destComp && destComp.type === ComponentTypes.OUTPUT) {
              omittedInternalCompIds.add(destComp.id);
              omittedInternalWireIndices.add(idx);
            }
          }
        });
      }

      if (realSource && realSource.compId) {
        const translatedSourceCompId = idMap.get(realSource.compId) || realSource.compId;
        connectedOutboundWires.forEach(wire => {
          externalOutboundConnections.push({
            fromCompId: translatedSourceCompId,
            fromPinId: realSource.pinId,
            toCompId: wire.toCompId,
            toPinId: wire.toPinId
          });
        });
      }
    }
  });

  // 5. Restore only non-omitted internal components
  const restoredComps = [];
  internalComps.forEach(ic => {
    if (omittedInternalCompIds.has(ic.id)) return;

    const newId = idMap.get(ic.id);
    const restoredComp = {
      ...cloneData(ic),
      id: newId,
      x: chip.x + (ic.x || 0),
      y: chip.y + (ic.y || 0),
      name: ic.name || ic.id
    };
    if (restoredComp.type === ComponentTypes.WIRE || String(restoredComp.type).toLowerCase() === 'wire') {
      const dx = chip.x;
      const dy = chip.y;
      if (restoredComp.input) { restoredComp.input.x += dx; restoredComp.input.y += dy; }
      if (restoredComp.output) { restoredComp.output.x += dx; restoredComp.output.y += dy; }
      if (Array.isArray(restoredComp.points)) {
        restoredComp.points.forEach(p => { p.x += dx; p.y += dy; });
      }
      if (Array.isArray(restoredComp.segments)) {
        restoredComp.segments.forEach(s => { s.x1 += dx; s.y1 += dy; s.x2 += dx; s.y2 += dy; });
      }
      if (Array.isArray(restoredComp.branches)) {
        restoredComp.branches.forEach(b => {
          if (b.anchor) { b.anchor.x += dx; b.anchor.y += dy; }
          if (b.output) { b.output.x += dx; b.output.y += dy; }
          if (Array.isArray(b.points)) {
            b.points.forEach(p => { p.x += dx; p.y += dy; });
          }
          if (Array.isArray(b.segments)) {
            b.segments.forEach(s => { s.x1 += dx; s.y1 += dy; s.x2 += dx; s.y2 += dy; });
          }
        });
      }
    }
    circuit.components.set(newId, restoredComp);
    restoredComps.push(restoredComp);
  });

  // 6. Restore only non-omitted internal connections with translated IDs
  internalWires.forEach((iw, idx) => {
    if (omittedInternalWireIndices.has(idx)) return;
    if (omittedInternalCompIds.has(iw.fromCompId) || omittedInternalCompIds.has(iw.toCompId)) return;

    const fromId = idMap.get(iw.fromCompId) || iw.fromCompId;
    const toId = idMap.get(iw.toCompId) || iw.toCompId;
    circuit.addConnection(fromId, iw.fromPinId, toId, iw.toPinId);
  });

  // 7. Add external inbound and outbound connections
  externalInboundConnections.forEach(conn => {
    circuit.addConnection(conn.fromCompId, conn.fromPinId, conn.toCompId, conn.toPinId);
  });

  externalOutboundConnections.forEach(conn => {
    circuit.addConnection(conn.fromCompId, conn.fromPinId, conn.toCompId, conn.toPinId);
  });

  return {
    success: true,
    restoredCompIds: restoredComps.map(c => c.id)
  };
}

export class Circuit {
  constructor() {
    this.components = new Map();
    this.connections = [];
    this.nextCompId = 1;
    this.nextWireId = 1;
    this.renderer = null;
  }

  setRenderer(renderer) {
    this.renderer = renderer;
  }

  clear() {
    this.components.clear();
    this.connections = [];
    this.nextCompId = 1;
    this.nextWireId = 1;
  }

  resetSequentialState() {
    this.components.forEach(comp => {
      if (comp.type === ComponentTypes.CLOCK) {
        comp.value = 0;
        comp.running = false;
        comp.activePulse = null;
        comp.lastToggle = 0;
      } else if (comp.type === ComponentTypes.D_LATCH) {
        comp.state = { Q: 0, Qbar: 1 };
        comp.value = 0;
        delete comp.nextState;
      } else if (comp.type === ComponentTypes.SR_LATCH) {
        comp.state = { Q: 0, Qbar: 1, invalid: false };
        comp.value = 0;
        delete comp.nextState;
      }
    });
  }

  getOrderedInputs() {
    return Array.from(this.components.values())
      .filter(c => c.type === ComponentTypes.INPUT)
      .sort((a, b) => a.y - b.y || a.x - b.x);
  }

  getOrderedOutputs() {
    return Array.from(this.components.values())
      .filter(c => c.type === ComponentTypes.OUTPUT)
      .sort((a, b) => a.y - b.y || a.x - b.x);
  }

  rebuildRailIndexes() {
    // No-op in normal mode
  }

  getSequentialName(type, customName = null) {
    if (typeof customName === 'string' && customName.trim()) return customName.trim();

    const existingNames = new Set(Array.from(this.components.values()).map(c => c.name).filter(Boolean));
    if (type === ComponentTypes.INPUT) {
      let index = 0;
      while (true) {
        const name = getInputNameForIndex(index);
        if (!existingNames.has(name)) return name;
        index++;
      }
    }

    if (type === ComponentTypes.OUTPUT) {
      let index = 0;
      while (true) {
        const name = getOutputNameForIndex(index);
        if (!existingNames.has(name)) return name;
        index++;
      }
    }

    let counter = 1;
    while (existingNames.has(`${type}_${counter}`)) counter++;
    return `${type}_${counter}`;
  }

  allocateComponentId(customId = null) {
    if (customId && !this.components.has(String(customId))) return String(customId);
    let id = `comp_${this.nextCompId++}`;
    while (this.components.has(id)) id = `comp_${this.nextCompId++}`;
    return id;
  }

  allocateWireId(customId = null) {
    if (customId && !this.connections.some(wire => wire.id === String(customId))) return String(customId);
    let id = `wire_${this.nextWireId++}`;
    while (this.connections.some(wire => wire.id === id)) id = `wire_${this.nextWireId++}`;
    return id;
  }

  addComponent(type, x = 0, y = 0, customId = null, initialValue = 0, customName = null, chipData = null, icData = null) {
    if (!isSupportedComponentType(type)) return null;

    const id = this.allocateComponentId(customId);
    const component = {
      id,
      type,
      x: Math.round(Number(x) || 0),
      y: Math.round(Number(y) || 0),
      rotation: 0,
      value: normalizeSignalValue(initialValue),
      name: this.getSequentialName(type, customName),
      ...(type === ComponentTypes.CHIP && chipData ? { chipData: cloneData(chipData) } : {}),
      ...(type === ComponentTypes.IC && icData ? { icData: cloneData(icData) } : {}),
      ...(type === ComponentTypes.CLOCK ? {
        frequency: 1,
        period: 1000,
        dutyCycle: 50,
        running: false,
        pulseDuration: 100,
        activePulse: null,
        lastToggle: 0
      } : {}),
      ...(type === ComponentTypes.D_LATCH ? {
        state: { Q: 0, Qbar: 1 }
      } : {}),
      ...(type === ComponentTypes.SR_LATCH ? {
        state: { Q: 0, Qbar: 1, invalid: false }
      } : {})
    };

    this.components.set(id, component);
    return component;
  }

  addRailInput(initialValue = 0, customName = null) {
    return this.addComponent(ComponentTypes.INPUT, 0, 0, null, initialValue, customName);
  }

  addRailOutput(customName = null) {
    return this.addComponent(ComponentTypes.OUTPUT, 0, 0, null, 0, customName);
  }

  removeComponent(id) {
    if (!this.components.has(id)) return false;
    this.connections = this.connections.filter(wire => wire.fromCompId !== id && wire.toCompId !== id);
    this.components.delete(id);
    return true;
  }

  moveComponent(id, x, y) {
    const comp = this.components.get(id);
    if (!comp) return;
    const targetX = Math.round(Number(x) || 0);
    const targetY = Math.round(Number(y) || 0);
    if (comp.type === ComponentTypes.WIRE || String(comp.type).toLowerCase() === 'wire') {
      const dx = targetX - (comp.x || 0);
      const dy = targetY - (comp.y || 0);
      comp.x = targetX;
      comp.y = targetY;
      if (comp.input) { comp.input.x += dx; comp.input.y += dy; }
      if (comp.output) { comp.output.x += dx; comp.output.y += dy; }
      if (Array.isArray(comp.points)) {
        comp.points.forEach(p => { p.x += dx; p.y += dy; });
      }
      if (Array.isArray(comp.segments)) {
        comp.segments.forEach(s => { s.x1 += dx; s.y1 += dy; s.x2 += dx; s.y2 += dy; });
      }
      if (Array.isArray(comp.branches)) {
        comp.branches.forEach(b => {
          if (b.anchor) { b.anchor.x += dx; b.anchor.y += dy; }
          if (b.output) { b.output.x += dx; b.output.y += dy; }
          if (Array.isArray(b.points)) {
            b.points.forEach(p => { p.x += dx; p.y += dy; });
          }
          if (Array.isArray(b.segments)) {
            b.segments.forEach(s => { s.x1 += dx; s.y1 += dy; s.x2 += dx; s.y2 += dy; });
          }
        });
      }
    } else {
      comp.x = targetX;
      comp.y = targetY;
    }
  }

  deriveSegmentsFromPoints(points) {
    if (!Array.isArray(points) || points.length < 2) return [];
    const segments = [];
    for (let i = 0; i < points.length - 1; i++) {
      segments.push({
        x1: points[i].x,
        y1: points[i].y,
        x2: points[i + 1].x,
        y2: points[i + 1].y
      });
    }
    return segments;
  }

  addWireComponent(data = {}) {
    const id = this.allocateComponentId(data.id || null);
    const input = data.input ? { x: Math.round(data.input.x), y: Math.round(data.input.y) } : { x: 0, y: 0 };
    const output = data.output ? { x: Math.round(data.output.x), y: Math.round(data.output.y) } : { ...input };
    const points = Array.isArray(data.points) && data.points.length >= 2
      ? data.points.map(p => ({ x: Math.round(p.x), y: Math.round(p.y) }))
      : [{ ...input }, { ...output }];
    const segments = Array.isArray(data.segments) && data.segments.length > 0
      ? data.segments.map(s => ({ x1: Math.round(s.x1), y1: Math.round(s.y1), x2: Math.round(s.x2), y2: Math.round(s.y2) }))
      : this.deriveSegmentsFromPoints(points);

    const comp = {
      id,
      type: ComponentTypes.WIRE,
      name: this.getSequentialName(ComponentTypes.WIRE, data.name),
      x: input.x,
      y: input.y,
      rotation: 0,
      value: normalizeSignalValue(data.value ?? 0),
      signal: normalizeSignalValue(data.signal ?? data.value ?? 0),
      input,
      output,
      points,
      segments,
      branches: Array.isArray(data.branches) ? cloneData(data.branches) : []
    };

    this.components.set(id, comp);
    return comp;
  }

  addWireBranch(wireId, branchData = {}) {
    const comp = this.components.get(wireId);
    if (!comp || (comp.type !== ComponentTypes.WIRE && String(comp.type).toLowerCase() !== 'wire')) {
      return null;
    }
    if (!Array.isArray(comp.branches)) comp.branches = [];

    const anchor = { x: Math.round(branchData.anchor?.x ?? comp.input.x), y: Math.round(branchData.anchor?.y ?? comp.input.y) };
    const output = { x: Math.round(branchData.output?.x ?? anchor.x), y: Math.round(branchData.output?.y ?? anchor.y) };

    const branchId = branchData.id || `branch_${Date.now()}_${comp.branches.length + 1}`;
    const points = Array.isArray(branchData.points) && branchData.points.length >= 2
      ? branchData.points.map(p => ({ x: Math.round(p.x), y: Math.round(p.y) }))
      : [{ ...anchor }, { ...output }];

    const segments = Array.isArray(branchData.segments) && branchData.segments.length > 0
      ? branchData.segments.map(s => ({ x1: Math.round(s.x1), y1: Math.round(s.y1), x2: Math.round(s.x2), y2: Math.round(s.y2) }))
      : this.deriveSegmentsFromPoints(points);

    const branch = {
      id: branchId,
      anchor,
      output,
      points,
      segments
    };

    comp.branches.push(branch);
    return branch;
  }

  removeWireBranch(wireId, branchId) {
    const comp = this.components.get(wireId);
    if (!comp || !Array.isArray(comp.branches)) return false;
    const idx = comp.branches.findIndex(b => b.id === branchId);
    if (idx === -1) return false;
    comp.branches.splice(idx, 1);
    this.connections = this.connections.filter(w => !(w.fromCompId === wireId && w.fromPinId === branchId));
    return true;
  }

  rotateComponent(id) {
    const comp = this.components.get(id);
    if (comp) {
      comp.rotation = ((comp.rotation || 0) + 90) % 360;
      return true;
    }
    return false;
  }

  toggleInput(id) {
    const comp = this.components.get(id);
    if (comp?.type !== ComponentTypes.INPUT) return null;
    comp.value = comp.value === 1 ? 0 : 1;
    return comp.value;
  }

  getIncomingConnection(compId, pinId) {
    return this.connections.find(wire => wire.toCompId === compId && wire.toPinId === pinId) || null;
  }

  canConnect(fromCompId, fromPinId, toCompId, toPinId, options = {}) {
    return validateConnection(this, { fromCompId, fromPinId, toCompId, toPinId }, options);
  }

  addConnection(fromCompId, fromPinId, toCompId, toPinId, customId = null) {
    const connection = {
      id: this.allocateWireId(customId),
      fromCompId,
      fromPinId,
      toCompId,
      toPinId,
      state: 0
    };

    const check = validateConnection(this, connection, { requireUniqueId: true });
    if (!check.valid) return null;
    this.connections.push(connection);
    return connection;
  }

  removeConnection(wireId) {
    const idx = this.connections.findIndex(wire => wire.id === wireId);
    if (idx === -1) return false;
    this.connections.splice(idx, 1);
    return true;
  }

  resolvePin(compId, pinId) {
    return resolveComponentPin(this, compId, pinId, this.renderer);
  }

  getPinPosition(compId, pinId) {
    const comp = this.components.get(compId);
    return getComponentPinPosition(comp, pinId, this.renderer);
  }

  toJSON() {
    return {
      version: CIRCUIT_SCHEMA_VERSION,
      components: Array.from(this.components.values()).map(comp => {
        if (comp.type === ComponentTypes.WIRE || String(comp.type).toLowerCase() === 'wire') {
          return {
            id: comp.id,
            type: comp.type,
            x: comp.x,
            y: comp.y,
            rotation: comp.rotation || 0,
            value: comp.value ?? 0,
            signal: comp.signal ?? comp.value ?? 0,
            name: comp.name,
            input: comp.input ? { x: comp.input.x, y: comp.input.y } : { x: comp.x, y: comp.y },
            output: comp.output ? { x: comp.output.x, y: comp.output.y } : { x: comp.x, y: comp.y },
            points: Array.isArray(comp.points) ? cloneData(comp.points) : [],
            segments: Array.isArray(comp.segments) ? cloneData(comp.segments) : [],
            branches: Array.isArray(comp.branches) ? cloneData(comp.branches) : []
          };
        }
        return {
          id: comp.id,
          type: comp.type,
          x: comp.x,
          y: comp.y,
          rotation: comp.rotation || 0,
          value: comp.value ?? 0,
          name: comp.name,
          ...(comp.type === ComponentTypes.CHIP && comp.chipData ? { chipData: cloneData(comp.chipData) } : {}),
          ...(comp.type === ComponentTypes.IC && comp.icData ? { icData: cloneData(comp.icData) } : {}),
          ...(comp.type === ComponentTypes.CLOCK ? {
            frequency: comp.frequency ?? 1,
            period: comp.period ?? 1000,
            dutyCycle: comp.dutyCycle ?? 50,
            running: !!comp.running,
            pulseType: comp.pulseType || 'HIGH',
            pulseDuration: comp.pulseDuration ?? 100
          } : {}),
          ...(comp.type === ComponentTypes.D_LATCH || comp.type === ComponentTypes.SR_LATCH ? {
            state: cloneData(comp.state || { Q: 0, Qbar: 1 })
          } : {})
        };
      }),
      connections: this.connections.map(wire => ({
        id: wire.id,
        fromCompId: wire.fromCompId,
        fromPinId: wire.fromPinId,
        toCompId: wire.toCompId,
        toPinId: wire.toPinId,
        state: wire.state ?? 0
      }))
    };
  }

  fromJSON(rawData, options = {}) {
    try {
      const parsed = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
      const migrated = migrateCircuitData(parsed);
      const rawCheck = validateRawCircuitData(migrated);
      if (!rawCheck.valid) throw new Error(rawCheck.errors.join('\n'));

      const temp = new Circuit();
      temp.renderer = this.renderer;
      migrated.components.forEach(comp => {
        temp.components.set(comp.id, { ...comp });
      });
      migrated.connections.forEach(wire => {
        temp.connections.push({ ...wire, state: normalizeSignalValue(wire.state) });
      });

      const finalCheck = validateCircuit(temp);
      if (!finalCheck.valid) throw new Error(finalCheck.errors.join('\n'));

      this.components = new Map();
      temp.components.forEach(comp => this.components.set(comp.id, { ...comp }));
      this.connections = temp.connections.map(wire => ({ ...wire }));
      this.nextCompId = nextNumericId(new Set(this.components.keys()), 'comp');
      this.nextWireId = nextNumericId(new Set(this.connections.map(wire => wire.id)), 'wire');
      return true;
    } catch (error) {
      console.error('Circuit load rejected:', error);
      if (options.throwOnError) throw error;
      return false;
    }
  }

  clone() {
    const copy = new Circuit();
    copy.renderer = this.renderer;
    copy.fromJSON(this.toJSON(), { throwOnError: true });
    return copy;
  }
}
