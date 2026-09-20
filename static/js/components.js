/* ==========================================================================
   Component Definitions, Rail Geometry, Pin Resolution, and SVG Markup
   ========================================================================== */

import { IC_LIBRARY, getICDefinition } from './icLibrary.js';

export const ComponentTypes = {
  INPUT: 'INPUT',
  OUTPUT: 'OUTPUT',
  AND: 'AND',
  OR: 'OR',
  NOT: 'NOT',
  NAND: 'NAND',
  NOR: 'NOR',
  XOR: 'XOR',
  XNOR: 'XNOR',
  CONST_0: 'CONST_0',
  CONST_1: 'CONST_1',
  CHIP: 'CHIP',
  IC: 'IC',
  WIRE: 'wire',
  GND: 'GND',
  VCC_5: 'VCC_5',
  VCC_NEG_5: 'VCC_NEG_5',
  VCC_12: 'VCC_12',
  VCC_NEG_12: 'VCC_NEG_12',
  CLOCK: 'CLOCK',
  SR_LATCH: 'SR_LATCH',
  D_LATCH: 'D_LATCH'
};

export const SUPPORTED_COMPONENT_TYPES = new Set([...Object.values(ComponentTypes), 'WIRE', 'wire']);

export const POWER_RAIL_SPECS = {
  [ComponentTypes.GND]: { label: 'GND', voltage: 0, isGround: true, displayVoltage: '0V' },
  [ComponentTypes.VCC_5]: { label: '+5V', voltage: 5, isGround: false, displayVoltage: '+5V' },
  [ComponentTypes.VCC_NEG_5]: { label: '-5V', voltage: -5, isGround: false, displayVoltage: '-5V' },
  [ComponentTypes.VCC_12]: { label: '+12V', voltage: 12, isGround: false, displayVoltage: '+12V' },
  [ComponentTypes.VCC_NEG_12]: { label: '-12V', voltage: -12, isGround: false, displayVoltage: '-12V' }
};

export const COMPONENT_METRICS = {
  PIN_VISIBLE_RADIUS: 4.5,
  PIN_HIT_RADIUS: 13,
  SNAP_RADIUS: 35,
  WORKSPACE_COMPONENT_WIDTH: 76,
  WORKSPACE_COMPONENT_HEIGHT: 56
};

export const RAIL_METRICS = COMPONENT_METRICS;

export function normalizePinType(type) {
  if (type === 'in' || type === 'input') return 'in';
  if (type === 'out' || type === 'output') return 'out';
  return null;
}

export function isSupportedComponentType(type) {
  if (typeof type === 'string' && type.toLowerCase() === 'wire') return true;
  return SUPPORTED_COMPONENT_TYPES.has(type);
}

export function isRailInput(comp) {
  return false;
}

export function isRailOutput(comp) {
  return false;
}

export function isRailComponent(comp) {
  return false;
}

export function isWorkspaceComponent(comp) {
  return true;
}

export function getRailY(railIndex) {
  return 55 + (railIndex || 0) * 42;
}

export function getRailPinPosition(comp, renderer = null) {
  return null;
}

export function getRailBounds(comp, renderer = null) {
  return null;
}

export const OUTPUT_NAMES_SEQUENCE = [
  'Y', 'Z', 'X', 'W', 'V', 'U', 'T', 'S', 'R', 'Q', 'P', 'O', 'N', 'M', 'L', 'K', 'J', 'I', 'H', 'G', 'F', 'E', 'D', 'C', 'B', 'A'
];

export function getInputNameForIndex(index) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let n = Math.max(0, index);
  let name = '';
  do {
    name = alphabet[n % 26] + name;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return name;
}

export function getOutputNameForIndex(index) {
  const n = Math.max(0, index);
  const baseName = OUTPUT_NAMES_SEQUENCE[n % OUTPUT_NAMES_SEQUENCE.length];
  const suffix = Math.floor(n / OUTPUT_NAMES_SEQUENCE.length);
  return suffix > 0 ? `${baseName}${suffix}` : baseName;
}

export function getChipDimensions(comp) {
  const chipInterface = comp?.chipData?.interface || comp?.chipData || {};
  const inputs = Array.isArray(chipInterface.inputs) ? chipInterface.inputs : [];
  const outputs = Array.isArray(chipInterface.outputs) ? chipInterface.outputs : [];

  const maxPins = Math.max(inputs.length, outputs.length, 1);
  const pinSpacing = 28;
  const paddingY = 36;
  const height = Math.max(70, maxPins * pinSpacing + paddingY);

  const nameLen = comp?.name ? comp.name.length : 6;
  const maxLabelLen = Math.max(
    ...inputs.map(p => (p.name || p.label || '').length),
    ...outputs.map(p => (p.name || p.label || '').length),
    1
  );
  const labelSpace = maxLabelLen * 14;
  let width = Math.max(160, Math.max(height + 20, nameLen * 10 + labelSpace + 60));

  // Ensure horizontal orientation: width > height
  if (height >= width) {
    width = height + 30;
  }

  return { width, height };
}

export function getChipPinSpecs(comp) {
  if (!comp || !comp.chipData) {
    return { inputs: [], outputs: [] };
  }

  const { width, height } = getChipDimensions(comp);
  const chipInterface = comp.chipData.interface || comp.chipData || {};
  const rawInputs = Array.isArray(chipInterface.inputs) ? chipInterface.inputs : [];
  const rawOutputs = Array.isArray(chipInterface.outputs) ? chipInterface.outputs : [];

  const halfW = width / 2;
  const halfH = height / 2;

  const inputs = rawInputs.map((p, idx) => {
    const count = rawInputs.length;
    const dy = count === 1 ? 0 : -halfH + 24 + (idx * (height - 48)) / (count - 1);
    return {
      id: p.id || `in${idx}`,
      label: p.name || p.label || `IN_${idx + 1}`,
      dx: -halfW,
      dy: Math.round(dy),
      type: 'in'
    };
  });

  const outputs = rawOutputs.map((p, idx) => {
    const count = rawOutputs.length;
    const dy = count === 1 ? 0 : -halfH + 24 + (idx * (height - 48)) / (count - 1);
    return {
      id: p.id || `out${idx}`,
      label: p.name || p.label || `OUT_${idx + 1}`,
      dx: halfW,
      dy: Math.round(dy),
      type: 'out'
    };
  });

  return { inputs, outputs };
}

export function getICDimensions(comp) {
  const defId = comp?.icData?.definitionId || '74HC00';
  const def = getICDefinition(defId) || comp?.icData || {};
  const pinCount = def.pinCount || (Array.isArray(def.pins) ? def.pins.length : 14);
  const pinsPerSide = Math.ceil(pinCount / 2);
  const pinSpacing = 22;
  const paddingY = 28;
  const height = Math.max(80, pinsPerSide * pinSpacing + paddingY);
  let width = Math.max(140, 150);
  if (height >= width) {
    width = height + 30;
  }
  return { width, height, pinCount, pinsPerSide, pinSpacing };
}

export function getICPinSpecs(comp) {
  const defId = comp?.icData?.definitionId || '74HC00';
  const def = getICDefinition(defId) || comp?.icData || {};
  const defPins = Array.isArray(def.pins) ? def.pins : [];
  const { width, height, pinCount, pinsPerSide, pinSpacing } = getICDimensions(comp);

  const halfW = width / 2;
  const halfH = height / 2;
  const startY = -((pinsPerSide - 1) * pinSpacing) / 2;

  const inputs = [];
  const outputs = [];

  // Left side: Pins 1 .. pinsPerSide (top-to-bottom)
  for (let idx = 0; idx < pinsPerSide; idx++) {
    const pinNum = idx + 1;
    const defPin = defPins.find(p => p.number === pinNum) || { id: `pin${pinNum}`, name: String(pinNum), type: 'in', kind: 'logic' };
    const pinSpec = {
      id: defPin.id || `pin${pinNum}`,
      label: defPin.name || String(pinNum),
      pinNumber: pinNum,
      dx: -halfW,
      dy: Math.round(startY + idx * pinSpacing),
      type: defPin.type || 'in',
      kind: defPin.kind || (defPin.type === 'power' ? 'power' : 'logic'),
      category: defPin.category || (defPin.type === 'power' ? 'power' : 'logic'),
      description: defPin.description || ''
    };
    if (pinSpec.type === 'out') {
      outputs.push(pinSpec);
    } else {
      inputs.push(pinSpec);
    }
  }

  // Right side: Pins pinCount down to pinsPerSide + 1 (top-to-bottom)
  for (let idx = 0; idx < pinsPerSide; idx++) {
    const pinNum = pinCount - idx;
    if (pinNum <= pinsPerSide) continue;
    const defPin = defPins.find(p => p.number === pinNum) || { id: `pin${pinNum}`, name: String(pinNum), type: 'in', kind: 'logic' };
    const pinSpec = {
      id: defPin.id || `pin${pinNum}`,
      label: defPin.name || String(pinNum),
      pinNumber: pinNum,
      dx: halfW,
      dy: Math.round(startY + idx * pinSpacing),
      type: defPin.type || 'in',
      kind: defPin.kind || (defPin.type === 'power' ? 'power' : 'logic'),
      category: defPin.category || (defPin.type === 'power' ? 'power' : 'logic'),
      description: defPin.description || ''
    };
    if (pinSpec.type === 'out') {
      outputs.push(pinSpec);
    } else {
      inputs.push(pinSpec);
    }
  }

  return { inputs, outputs };
}

export function getPowerPinSpecs(type, comp = null) {
  const spec = POWER_RAIL_SPECS[type];
  const isGnd = type === ComponentTypes.GND;
  return {
    inputs: [],
    outputs: [
      {
        id: 'out0',
        label: spec?.label || 'PWR',
        dx: 0,
        dy: isGnd ? -20 : 20,
        type: 'out',
        kind: 'power',
        category: 'power',
        voltage: spec?.voltage ?? 0,
        isGround: !!spec?.isGround
      }
    ]
  };
}

export function buildOrthogonalPathData(points) {
  if (!Array.isArray(points) || points.length < 2) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    if (Math.abs(prev.y - curr.y) < 0.5) {
      d += ` H ${curr.x}`;
    } else if (Math.abs(prev.x - curr.x) < 0.5) {
      d += ` V ${curr.y}`;
    } else {
      d += ` H ${curr.x} V ${curr.y}`;
    }
  }
  return d;
}

export function segmentsToPathData(segments) {
  if (!Array.isArray(segments) || segments.length === 0) return '';
  let d = '';
  segments.forEach((seg, idx) => {
    if (idx === 0) {
      d += `M ${seg.x1} ${seg.y1}`;
    } else {
      const prev = segments[idx - 1];
      if (Math.abs(prev.x2 - seg.x1) > 0.5 || Math.abs(prev.y2 - seg.y1) > 0.5) {
        d += ` M ${seg.x1} ${seg.y1}`;
      }
    }
    if (Math.abs(seg.y1 - seg.y2) < 0.5) {
      d += ` H ${seg.x2}`;
    } else if (Math.abs(seg.x1 - seg.x2) < 0.5) {
      d += ` V ${seg.y2}`;
    } else {
      d += ` L ${seg.x2} ${seg.y2}`;
    }
  });
  return d;
}

export function getWirePinSpecs(comp) {
  if (!comp) return { inputs: [], outputs: [] };
  const inputX = comp.input?.x ?? comp.x ?? 0;
  const inputY = comp.input?.y ?? comp.y ?? 0;
  const outputX = comp.output?.x ?? comp.x ?? 0;
  const outputY = comp.output?.y ?? comp.y ?? 0;
  const compX = comp.x || 0;
  const compY = comp.y || 0;

  const inputs = [
    {
      id: 'in0',
      label: 'IN',
      dx: inputX - compX,
      dy: inputY - compY,
      type: 'in'
    }
  ];

  const outputs = [
    {
      id: 'out0',
      label: 'OUT',
      dx: outputX - compX,
      dy: outputY - compY,
      type: 'out'
    }
  ];

  if (Array.isArray(comp.branches)) {
    comp.branches.forEach((b, idx) => {
      const bx = b.output?.x ?? inputX;
      const by = b.output?.y ?? inputY;
      outputs.push({
        id: b.id || `branch_${idx + 1}`,
        label: `OUT_${idx + 1}`,
        dx: bx - compX,
        dy: by - compY,
        type: 'out'
      });
    });
  }

  return { inputs, outputs };
}

/**
 * Returns pin layout specifications for a component type.
 * Pins are defined relative to center (0,0), and pin type is canonical.
 */
export function getComponentPinSpecs(type, comp = null) {
  if (type === ComponentTypes.WIRE || String(type).toLowerCase() === 'wire') {
    return getWirePinSpecs(comp);
  }

  if (type === ComponentTypes.CHIP) {
    return getChipPinSpecs(comp);
  }

  if (type === ComponentTypes.IC) {
    return getICPinSpecs(comp);
  }

  if (POWER_RAIL_SPECS[type]) {
    return getPowerPinSpecs(type, comp);
  }

  switch (type) {
    case ComponentTypes.INPUT:
    case ComponentTypes.CONST_0:
    case ComponentTypes.CONST_1:
      return {
        inputs: [],
        outputs: [{ id: 'out0', label: 'Y', dx: 45, dy: 0, type: 'out' }]
      };
    case ComponentTypes.OUTPUT:
      return {
        inputs: [{ id: 'in0', label: 'A', dx: -35, dy: 0, type: 'in' }],
        outputs: []
      };
    case ComponentTypes.NOT:
      return {
        inputs: [{ id: 'in0', label: 'A', dx: -25, dy: 0, type: 'in' }],
        outputs: [{ id: 'out0', label: 'Y', dx: 25, dy: 0, type: 'out' }]
      };
    case ComponentTypes.AND:
      return {
        inputs: [
          { id: 'in0', label: 'A', dx: -30, dy: -12, type: 'in' },
          { id: 'in1', label: 'B', dx: -30, dy: 12, type: 'in' }
        ],
        outputs: [{ id: 'out0', label: 'Y', dx: 30, dy: 0, type: 'out' }]
      };
    case ComponentTypes.NAND:
      return {
        inputs: [
          { id: 'in0', label: 'A', dx: -32.5, dy: -12, type: 'in' },
          { id: 'in1', label: 'B', dx: -32.5, dy: 12, type: 'in' }
        ],
        outputs: [{ id: 'out0', label: 'Y', dx: 32.5, dy: 0, type: 'out' }]
      };
    case ComponentTypes.OR:
      return {
        inputs: [
          { id: 'in0', label: 'A', dx: -30, dy: -12, type: 'in' },
          { id: 'in1', label: 'B', dx: -30, dy: 12, type: 'in' }
        ],
        outputs: [{ id: 'out0', label: 'Y', dx: 30, dy: 0, type: 'out' }]
      };
    case ComponentTypes.NOR:
      return {
        inputs: [
          { id: 'in0', label: 'A', dx: -32.5, dy: -12, type: 'in' },
          { id: 'in1', label: 'B', dx: -32.5, dy: 12, type: 'in' }
        ],
        outputs: [{ id: 'out0', label: 'Y', dx: 32.5, dy: 0, type: 'out' }]
      };
    case ComponentTypes.XOR:
      return {
        inputs: [
          { id: 'in0', label: 'A', dx: -32.5, dy: -12, type: 'in' },
          { id: 'in1', label: 'B', dx: -32.5, dy: 12, type: 'in' }
        ],
        outputs: [{ id: 'out0', label: 'Y', dx: 32.5, dy: 0, type: 'out' }]
      };
    case ComponentTypes.XNOR:
      return {
        inputs: [
          { id: 'in0', label: 'A', dx: -35, dy: -12, type: 'in' },
          { id: 'in1', label: 'B', dx: -35, dy: 12, type: 'in' }
        ],
        outputs: [{ id: 'out0', label: 'Y', dx: 35, dy: 0, type: 'out' }]
      };
    case ComponentTypes.CLOCK:
      return {
        inputs: [],
        outputs: [
          { id: 'out0', label: 'CLK', dx: 38, dy: -12, type: 'out' },
          { id: 'out_nclk', label: 'CLK̅', dx: 38, dy: 12, type: 'out' }
        ]
      };
    case ComponentTypes.D_LATCH:
      return {
        inputs: [
          { id: 'in_d', label: 'D', dx: -40, dy: -12, type: 'in' },
          { id: 'in_clk', label: 'CLK', dx: -40, dy: 12, type: 'in' }
        ],
        outputs: [
          { id: 'out_q', label: 'Q', dx: 40, dy: -12, type: 'out' },
          { id: 'out_qbar', label: 'Q̅', dx: 40, dy: 12, type: 'out' }
        ]
      };
    case ComponentTypes.SR_LATCH:
      return {
        inputs: [
          { id: 'in_s', label: 'S', dx: -40, dy: -16, type: 'in' },
          { id: 'in_en', label: 'EN', dx: -40, dy: 0, type: 'in' },
          { id: 'in_r', label: 'R', dx: -40, dy: 16, type: 'in' }
        ],
        outputs: [
          { id: 'out_q', label: 'Q', dx: 40, dy: -12, type: 'out' },
          { id: 'out_qbar', label: 'Q̅', dx: 40, dy: 12, type: 'out' }
        ]
      };
    default:
      return { inputs: [], outputs: [] };
  }
}

export function getPinSpec(componentType, pinId, comp = null) {
  const specs = getComponentPinSpecs(componentType, comp);
  return [...specs.inputs, ...specs.outputs].find(pin => pin.id === pinId) || null;
}

export function rotateVector(dx, dy, rotationDeg) {
  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    dx: Math.round(dx * cos - dy * sin),
    dy: Math.round(dx * sin + dy * cos)
  };
}

export function getPinPosition(comp, pinId, renderer = null) {
  if (!comp) return null;

  if (comp.type === ComponentTypes.WIRE || String(comp.type).toLowerCase() === 'wire') {
    if (pinId === 'in0') {
      return { x: comp.input?.x ?? comp.x ?? 0, y: comp.input?.y ?? comp.y ?? 0 };
    }
    if (pinId === 'out0') {
      return { x: comp.output?.x ?? comp.x ?? 0, y: comp.output?.y ?? comp.y ?? 0 };
    }
    const branches = Array.isArray(comp.branches) ? comp.branches : [];
    const branch = branches.find(b => b.id === pinId);
    if (branch && branch.output) {
      return { x: branch.output.x, y: branch.output.y };
    }
    return null;
  }

  const pinSpec = getPinSpec(comp.type, pinId, comp);
  if (!pinSpec) return null;

  const vec = rotateVector(pinSpec.dx, pinSpec.dy, comp.rotation || 0);
  return {
    x: (comp.x || 0) + vec.dx,
    y: (comp.y || 0) + vec.dy
  };
}

export function getPinNormal(comp, pinId) {
  if (!comp) return { dx: 1, dy: 0 };

  if (comp.type === ComponentTypes.WIRE || String(comp.type).toLowerCase() === 'wire') {
    if (pinId === 'in0') {
      const p0 = comp.points?.[0] || comp.input;
      const p1 = comp.points?.[1];
      if (p0 && p1) {
        const dx = p0.x - p1.x;
        const dy = p0.y - p1.y;
        if (Math.abs(dx) >= Math.abs(dy)) return { dx: dx >= 0 ? 1 : -1, dy: 0 };
        return { dx: 0, dy: dy >= 0 ? 1 : -1 };
      }
      return { dx: -1, dy: 0 };
    }
    return { dx: 1, dy: 0 };
  }

  const pinSpec = getPinSpec(comp.type, pinId, comp);
  if (!pinSpec) return { dx: 1, dy: 0 };

  const vec = rotateVector(pinSpec.dx, pinSpec.dy, comp.rotation || 0);
  if (Math.abs(vec.dx) >= Math.abs(vec.dy)) {
    return { dx: vec.dx >= 0 ? 1 : -1, dy: 0 };
  } else {
    return { dx: 0, dy: vec.dy >= 0 ? 1 : -1 };
  }
}

export function getAbsolutePinPosition(comp, pinId, renderer = null) {
  return getPinPosition(comp, pinId, renderer);
}

export function getComponentBounds(comp, renderer = null) {
  if (!comp) return null;

  if (comp.type === ComponentTypes.WIRE || String(comp.type).toLowerCase() === 'wire') {
    const allX = [];
    const allY = [];
    if (comp.input) { allX.push(comp.input.x); allY.push(comp.input.y); }
    if (comp.output) { allX.push(comp.output.x); allY.push(comp.output.y); }
    if (Array.isArray(comp.points)) {
      comp.points.forEach(p => { allX.push(p.x); allY.push(p.y); });
    }
    if (Array.isArray(comp.segments)) {
      comp.segments.forEach(s => {
        allX.push(s.x1, s.x2);
        allY.push(s.y1, s.y2);
      });
    }
    if (Array.isArray(comp.branches)) {
      comp.branches.forEach(b => {
        if (b.anchor) { allX.push(b.anchor.x); allY.push(b.anchor.y); }
        if (b.output) { allX.push(b.output.x); allY.push(b.output.y); }
        if (Array.isArray(b.points)) b.points.forEach(p => { allX.push(p.x); allY.push(p.y); });
        if (Array.isArray(b.segments)) b.segments.forEach(s => { allX.push(s.x1, s.x2); allY.push(s.y1, s.y2); });
      });
    }
    if (allX.length === 0) {
      allX.push(comp.x || 0);
      allY.push(comp.y || 0);
    }
    const minX = Math.min(...allX) - 12;
    const maxX = Math.max(...allX) + 12;
    const minY = Math.min(...allY) - 12;
    const maxY = Math.max(...allY) + 12;
    return {
      minX, maxX, minY, maxY,
      width: Math.max(24, maxX - minX),
      height: Math.max(24, maxY - minY)
    };
  }

  if (comp.type === ComponentTypes.CHIP) {
    const { width, height } = getChipDimensions(comp);
    const rot = comp.rotation || 0;
    const isVertical = rot === 90 || rot === 270;
    const halfW = (isVertical ? height : width) / 2;
    const halfH = (isVertical ? width : height) / 2;
    return {
      minX: (comp.x || 0) - halfW,
      maxX: (comp.x || 0) + halfW,
      minY: (comp.y || 0) - halfH,
      maxY: (comp.y || 0) + halfH,
      width: halfW * 2,
      height: halfH * 2
    };
  }

  if (comp.type === ComponentTypes.IC) {
    const { width, height } = getICDimensions(comp);
    const rot = comp.rotation || 0;
    const isVertical = rot === 90 || rot === 270;
    const halfW = (isVertical ? height : width) / 2;
    const halfH = (isVertical ? width : height) / 2;
    return {
      minX: (comp.x || 0) - halfW,
      maxX: (comp.x || 0) + halfW,
      minY: (comp.y || 0) - halfH,
      maxY: (comp.y || 0) + halfH,
      width: halfW * 2,
      height: halfH * 2
    };
  }

  if (POWER_RAIL_SPECS[comp.type]) {
    const rot = comp.rotation || 0;
    const isVertical = rot === 90 || rot === 270;
    const halfW = (isVertical ? 26 : 26);
    const halfH = (isVertical ? 26 : 26);
    return {
      minX: (comp.x || 0) - halfW,
      maxX: (comp.x || 0) + halfW,
      minY: (comp.y || 0) - halfH,
      maxY: (comp.y || 0) + halfH,
      width: halfW * 2,
      height: halfH * 2
    };
  }

  if (comp.type === ComponentTypes.D_LATCH || comp.type === ComponentTypes.SR_LATCH) {
    const rot = comp.rotation || 0;
    const isVertical = rot === 90 || rot === 270;
    const compW = 84;
    const compH = 68;
    const halfW = (isVertical ? compH : compW) / 2;
    const halfH = (isVertical ? compW : compH) / 2;
    return {
      minX: (comp.x || 0) - halfW,
      maxX: (comp.x || 0) + halfW,
      minY: (comp.y || 0) - halfH,
      maxY: (comp.y || 0) + halfH,
      width: halfW * 2,
      height: halfH * 2
    };
  }

  const rot = comp.rotation || 0;
  const isVertical = rot === 90 || rot === 270;
  const halfW = (isVertical ? COMPONENT_METRICS.WORKSPACE_COMPONENT_HEIGHT : COMPONENT_METRICS.WORKSPACE_COMPONENT_WIDTH) / 2;
  const halfH = (isVertical ? COMPONENT_METRICS.WORKSPACE_COMPONENT_WIDTH : COMPONENT_METRICS.WORKSPACE_COMPONENT_HEIGHT) / 2;
  return {
    minX: (comp.x || 0) - halfW,
    maxX: (comp.x || 0) + halfW,
    minY: (comp.y || 0) - halfH,
    maxY: (comp.y || 0) + halfH,
    width: halfW * 2,
    height: halfH * 2
  };
}

export function resolvePin(circuit, compId, pinId, renderer = null) {
  const comp = circuit?.components?.get(compId);
  if (!comp) return null;

  const pinSpec = getPinSpec(comp.type, pinId, comp);
  if (!pinSpec) return null;

  const pinType = normalizePinType(pinSpec.type);
  const position = getPinPosition(comp, pinId, renderer);
  if (!pinType || !position) return null;

  return { compId, pinId, pinType, position };
}

export function getAllPinDescriptors(circuit, renderer = null) {
  const pins = [];
  circuit?.components?.forEach(comp => {
    const specs = getComponentPinSpecs(comp.type, comp);
    [...specs.inputs, ...specs.outputs].forEach(pin => {
      const descriptor = resolvePin(circuit, comp.id, pin.id, renderer);
      if (descriptor) pins.push(descriptor);
    });
  });
  return pins;
}

export function getCleanLabel(comp) {
  if (!comp) return '';
  if (typeof comp.name === 'string' && comp.name.trim()) return comp.name.trim();
  if (typeof comp.label === 'string' && comp.label.trim()) return comp.label.trim();
  return comp.type || '';
}

function escapeSvgText(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function getWireComponentSVGMarkup(comp, isSelected = false) {
  const isHigh = comp.signal === 1 || comp.value === 1;
  const strokeClass = isHigh ? 'wire-high' : '';
  const selectedClass = isSelected ? 'wire-comp-selected' : '';

  const mainPath = (Array.isArray(comp.points) && comp.points.length >= 2)
    ? buildOrthogonalPathData(comp.points)
    : segmentsToPathData(comp.segments);

  let mainWireMarkup = `
    <path d="${mainPath}" class="wire-comp-hit-path" data-comp-id="${escapeSvgText(comp.id)}" data-segment-type="main" />
    <path d="${mainPath}" class="wire-comp-main-path ${strokeClass} ${selectedClass}" data-comp-id="${escapeSvgText(comp.id)}" />
  `;

  let branchesMarkup = '';
  const branches = Array.isArray(comp.branches) ? comp.branches : [];
  branches.forEach(branch => {
    const bPath = (Array.isArray(branch.points) && branch.points.length >= 2)
      ? buildOrthogonalPathData(branch.points)
      : segmentsToPathData(branch.segments);

    branchesMarkup += `
      <path d="${bPath}" class="wire-comp-hit-path wire-comp-branch-hit"
            data-comp-id="${escapeSvgText(comp.id)}"
            data-branch-id="${escapeSvgText(branch.id)}"
            data-segment-type="branch" />
      <path d="${bPath}" class="wire-comp-branch-path ${strokeClass} ${selectedClass}"
            data-comp-id="${escapeSvgText(comp.id)}"
            data-branch-id="${escapeSvgText(branch.id)}" />
      <circle cx="${branch.anchor.x}" cy="${branch.anchor.y}" r="4.5"
              class="wire-junction-dot wire-branch-anchor-dot ${isHigh ? 'wire-high' : ''}" pointer-events="none" />
    `;
  });

  const inPos = comp.input || { x: comp.x || 0, y: comp.y || 0 };
  const outPos = comp.output || { x: comp.x || 0, y: comp.y || 0 };

  let pinsMarkup = `
    <!-- Input Port (Single input at beginning) -->
    <circle cx="${inPos.x}" cy="${inPos.y}" r="${RAIL_METRICS.PIN_HIT_RADIUS}"
            class="pin-port-hitarea pin-port pin-in"
            data-comp-id="${escapeSvgText(comp.id)}"
            data-pin-id="in0"
            data-pin-type="in">
      <title>Wire Input</title>
    </circle>
    <circle cx="${inPos.x}" cy="${inPos.y}" r="${RAIL_METRICS.PIN_VISIBLE_RADIUS}"
            class="pin-port-visible pin-in" pointer-events="none"></circle>

    <!-- Primary Output Port (at endpoint) -->
    <circle cx="${outPos.x}" cy="${outPos.y}" r="${RAIL_METRICS.PIN_HIT_RADIUS}"
            class="pin-port-hitarea pin-port pin-out"
            data-comp-id="${escapeSvgText(comp.id)}"
            data-pin-id="out0"
            data-pin-type="out">
      <title>Primary Output (${isHigh ? 'HIGH' : 'LOW'})</title>
    </circle>
    <circle cx="${outPos.x}" cy="${outPos.y}" r="${RAIL_METRICS.PIN_VISIBLE_RADIUS}"
            class="pin-port-visible pin-out" pointer-events="none"></circle>
  `;

  branches.forEach(branch => {
    const bOut = branch.output;
    if (!bOut) return;
    pinsMarkup += `
      <circle cx="${bOut.x}" cy="${bOut.y}" r="${RAIL_METRICS.PIN_HIT_RADIUS}"
              class="pin-port-hitarea pin-port pin-out"
              data-comp-id="${escapeSvgText(comp.id)}"
              data-pin-id="${escapeSvgText(branch.id)}"
              data-pin-type="out">
        <title>Branch Output (${isHigh ? 'HIGH' : 'LOW'})</title>
      </circle>
      <circle cx="${bOut.x}" cy="${bOut.y}" r="${RAIL_METRICS.PIN_VISIBLE_RADIUS}"
              class="pin-port-visible pin-out" pointer-events="none"></circle>
    `;
  });

  let selectionMarkup = '';
  if (isSelected) {
    const vertices = [];
    if (Array.isArray(comp.points)) vertices.push(...comp.points);
    branches.forEach(b => {
      if (Array.isArray(b.points)) vertices.push(...b.points);
    });
    vertices.forEach(v => {
      selectionMarkup += `
        <circle cx="${v.x}" cy="${v.y}" r="3.5" class="wire-vertex-handle" pointer-events="none" />
      `;
    });
  }

  return `
    <g class="component-group wire-component-group ${isSelected ? 'selected' : ''}"
       id="comp-${escapeSvgText(comp.id)}"
       data-id="${escapeSvgText(comp.id)}">
      ${mainWireMarkup}
      ${branchesMarkup}
      ${selectionMarkup}
      ${pinsMarkup}
    </g>
  `;
}

export function getComponentSVGMarkup(comp, isSelected = false) {
  const { type, value, rotation = 0 } = comp;
  if (type === ComponentTypes.WIRE || String(type).toLowerCase() === 'wire') {
    return getWireComponentSVGMarkup(comp, isSelected);
  }
  let bodyMarkup = '';

  switch (type) {
    case ComponentTypes.CONST_0:
    case ComponentTypes.CONST_1: {
      const val = type === ComponentTypes.CONST_1 ? 1 : 0;
      const strokeCol = val === 1 ? '#d97706' : '#64748b';
      const fillBg = val === 1 ? '#fef3c7' : '#f1f5f9';
      const textColor = val === 1 ? '#92400e' : '#334155';
      bodyMarkup = `
        <rect x="-18" y="-18" width="36" height="36" rx="8" class="component-body" fill="${fillBg}" stroke="${strokeCol}" stroke-width="2.5"/>
        <text x="0" y="5" text-anchor="middle" font-size="16" font-weight="800" fill="${textColor}">${val}</text>
        <line x1="18" y1="0" x2="25" y2="0" stroke="${strokeCol}" stroke-width="2"/>
      `;
      break;
    }

    case ComponentTypes.INPUT: {
      const isHigh = value === 1;
      const strokeCol = isHigh ? '#10b981' : '#64748b';
      const fillBg = isHigh ? '#dcfce7' : '#ffffff';
      const textColor = isHigh ? '#047857' : '#334155';
      const label = escapeSvgText(getCleanLabel(comp));
      bodyMarkup = `
        <text x="-24" y="4.5" text-anchor="middle" font-size="12" font-weight="800" fill="#1e293b">${label}</text>
        <circle cx="0" cy="0" r="16" class="component-body" fill="${fillBg}" stroke="${strokeCol}" stroke-width="2.5"/>
        <text x="0" y="4.5" text-anchor="middle" font-size="13" font-weight="bold" fill="${textColor}">${value ?? 0}</text>
        <line x1="16" y1="0" x2="45" y2="0" stroke="${strokeCol}" stroke-width="2"/>
      `;
      break;
    }

    case ComponentTypes.OUTPUT: {
      const isHigh = value === 1;
      const strokeCol = isHigh ? '#10b981' : '#64748b';
      const bulbFill = isHigh ? '#22c55e' : '#64748b';
      const bulbGlow = isHigh ? 'filter="url(#glow-filter)"' : '';
      const label = escapeSvgText(getCleanLabel(comp));
      bodyMarkup = `
        <line x1="-35" y1="0" x2="-16" y2="0" stroke="${strokeCol}" stroke-width="2"/>
        <circle cx="0" cy="0" r="16" class="component-body" fill="${bulbFill}" stroke="${strokeCol}" stroke-width="2.5" ${bulbGlow}/>
        <text x="0" y="4.5" text-anchor="middle" font-size="13" font-weight="bold" fill="#ffffff">${value ?? 0}</text>
        <text x="24" y="4.5" text-anchor="start" font-size="12" font-weight="800" fill="#1e293b">${label}</text>
      `;
      break;
    }

    case ComponentTypes.NOT:
      bodyMarkup = `
        <line x1="-25" y1="0" x2="-14" y2="0" stroke="#334155" stroke-width="2"/>
        <path d="M -14 -16 L 12 0 L -14 16 Z" class="component-body" fill="#ffffff" stroke="#1e293b" stroke-width="2" stroke-linejoin="round"/>
        <circle cx="18" cy="0" r="4" fill="#ffffff" stroke="#1e293b" stroke-width="2"/>
        <text x="-4" y="4" text-anchor="middle" font-size="9" font-weight="bold" fill="#64748b">NOT</text>
      `;
      break;

    case ComponentTypes.AND:
      bodyMarkup = `
        <line x1="-30" y1="-12" x2="-16" y2="-12" stroke="#334155" stroke-width="2"/>
        <line x1="-30" y1="12" x2="-16" y2="12" stroke="#334155" stroke-width="2"/>
        <path d="M -16 -22 L 4 -22 A 22 22 0 0 1 4 22 L -16 22 Z" class="component-body" fill="#ffffff" stroke="#1e293b" stroke-width="2" stroke-linejoin="round"/>
        <line x1="26" y1="0" x2="30" y2="0" stroke="#334155" stroke-width="2"/>
        <text x="-2" y="4" text-anchor="middle" font-size="10" font-weight="bold" fill="#334155">AND</text>
      `;
      break;

    case ComponentTypes.NAND:
      bodyMarkup = `
        <line x1="-32.5" y1="-12" x2="-16" y2="-12" stroke="#334155" stroke-width="2"/>
        <line x1="-32.5" y1="12" x2="-16" y2="12" stroke="#334155" stroke-width="2"/>
        <path d="M -16 -22 L 4 -22 A 22 22 0 0 1 4 22 L -16 22 Z" class="component-body" fill="#ffffff" stroke="#1e293b" stroke-width="2" stroke-linejoin="round"/>
        <circle cx="28" cy="0" r="4.5" fill="#ffffff" stroke="#1e293b" stroke-width="2"/>
        <text x="-4" y="4" text-anchor="middle" font-size="9" font-weight="bold" fill="#334155">NAND</text>
      `;
      break;

    case ComponentTypes.OR:
      bodyMarkup = `
        <line x1="-30" y1="-12" x2="-12" y2="-12" stroke="#334155" stroke-width="2"/>
        <line x1="-30" y1="12" x2="-12" y2="12" stroke="#334155" stroke-width="2"/>
        <path d="M -18 -22 Q -8 -22 6 -12 Q 22 -2 28 0 Q 22 2 6 12 Q -8 22 -18 22 Q -8 0 -18 -22 Z" class="component-body" fill="#ffffff" stroke="#1e293b" stroke-width="2" stroke-linejoin="round"/>
        <line x1="28" y1="0" x2="30" y2="0" stroke="#334155" stroke-width="2"/>
        <text x="0" y="4" text-anchor="middle" font-size="10" font-weight="bold" fill="#334155">OR</text>
      `;
      break;

    case ComponentTypes.NOR:
      bodyMarkup = `
        <line x1="-32.5" y1="-12" x2="-12" y2="-12" stroke="#334155" stroke-width="2"/>
        <line x1="-32.5" y1="12" x2="-12" y2="12" stroke="#334155" stroke-width="2"/>
        <path d="M -18 -22 Q -8 -22 6 -12 Q 22 -2 26 0 Q 22 2 6 12 Q -8 22 -18 22 Q -8 0 -18 -22 Z" class="component-body" fill="#ffffff" stroke="#1e293b" stroke-width="2" stroke-linejoin="round"/>
        <circle cx="28" cy="0" r="4.5" fill="#ffffff" stroke="#1e293b" stroke-width="2"/>
        <text x="-2" y="4" text-anchor="middle" font-size="9" font-weight="bold" fill="#334155">NOR</text>
      `;
      break;

    case ComponentTypes.XOR:
      bodyMarkup = `
        <line x1="-32.5" y1="-12" x2="-12" y2="-12" stroke="#334155" stroke-width="2"/>
        <line x1="-32.5" y1="12" x2="-12" y2="12" stroke="#334155" stroke-width="2"/>
        <path d="M -24 -22 Q -14 0 -24 22" fill="none" stroke="#1e293b" stroke-width="2"/>
        <path d="M -18 -22 Q -8 -22 6 -12 Q 22 -2 28 0 Q 22 2 6 12 Q -8 22 -18 22 Q -8 0 -18 -22 Z" class="component-body" fill="#ffffff" stroke="#1e293b" stroke-width="2" stroke-linejoin="round"/>
        <line x1="28" y1="0" x2="30" y2="0" stroke="#334155" stroke-width="2"/>
        <text x="0" y="4" text-anchor="middle" font-size="9" font-weight="bold" fill="#334155">XOR</text>
      `;
      break;

    case ComponentTypes.XNOR:
      bodyMarkup = `
        <line x1="-35" y1="-12" x2="-12" y2="-12" stroke="#334155" stroke-width="2"/>
        <line x1="-35" y1="12" x2="-12" y2="12" stroke="#334155" stroke-width="2"/>
        <path d="M -24 -22 Q -14 0 -24 22" fill="none" stroke="#1e293b" stroke-width="2"/>
        <path d="M -18 -22 Q -8 -22 6 -12 Q 22 -2 26 0 Q 22 2 6 12 Q -8 22 -18 22 Q -8 0 -18 -22 Z" class="component-body" fill="#ffffff" stroke="#1e293b" stroke-width="2" stroke-linejoin="round"/>
        <circle cx="30.5" cy="0" r="4.5" fill="#ffffff" stroke="#1e293b" stroke-width="2"/>
        <text x="-2" y="4" text-anchor="middle" font-size="8" font-weight="bold" fill="#334155">XNOR</text>
      `;
      break;

    case ComponentTypes.CHIP: {
      const { width, height } = getChipDimensions(comp);
      const halfW = width / 2;
      const halfH = height / 2;
      const chipName = escapeSvgText(getCleanLabel(comp));
      const chipPinSpecs = getChipPinSpecs(comp);

      let pinLabelsMarkup = '';
      chipPinSpecs.inputs.forEach(pin => {
        pinLabelsMarkup += `
          <text x="${pin.dx + 10}" y="${pin.dy + 4}" text-anchor="start" font-size="11" font-weight="700" fill="#334155">${escapeSvgText(pin.label)}</text>
        `;
      });
      chipPinSpecs.outputs.forEach(pin => {
        pinLabelsMarkup += `
          <text x="${pin.dx - 10}" y="${pin.dy + 4}" text-anchor="end" font-size="11" font-weight="700" fill="#334155">${escapeSvgText(pin.label)}</text>
        `;
      });

      bodyMarkup = `
        <rect x="${-halfW}" y="${-halfH}" width="${width}" height="${height}" rx="8" class="component-body chip-body" fill="#f8fafc" stroke="#1e293b" stroke-width="2.5" />
        <rect x="${-halfW + 4}" y="${-halfH + 4}" width="${width - 8}" height="${height - 8}" rx="5" fill="none" stroke="#94a3b8" stroke-width="1" stroke-dasharray="3,3" />
        <text x="0" y="2" text-anchor="middle" font-size="13" font-weight="800" fill="#0f172a" letter-spacing="0.5">${chipName}</text>
        <text x="0" y="${halfH - 8}" text-anchor="middle" font-size="9" font-weight="700" fill="#64748b">CHIP</text>
        ${pinLabelsMarkup}
      `;
      break;
    }

    case ComponentTypes.IC: {
      const { width, height } = getICDimensions(comp);
      const halfW = width / 2;
      const halfH = height / 2;
      const defId = comp.icData?.definitionId || '74HC00';
      const def = getICDefinition(defId) || comp.icData || {};
      const icName = escapeSvgText(def.name || comp.name || defId);
      const pkg = escapeSvgText(def.package || 'DIP');
      const pinSpecs = getICPinSpecs(comp);
      const allPins = [...pinSpecs.inputs, ...pinSpecs.outputs];

      let pinLabelsMarkup = '';
      allPins.forEach(pin => {
        const isLeft = pin.dx < 0;
        const isPower = pin.kind === 'power' || pin.category === 'power';
        const color = isPower ? '#0284c7' : (pin.type === 'out' ? '#059669' : '#334155');
        if (isLeft) {
          pinLabelsMarkup += `
            <text x="${-halfW - 8}" y="${pin.dy + 3.5}" text-anchor="end" font-size="9" font-weight="700" fill="#64748b">${pin.pinNumber}</text>
            <text x="${-halfW + 8}" y="${pin.dy + 3.5}" text-anchor="start" font-size="9.5" font-weight="700" fill="${color}">${escapeSvgText(pin.label)}</text>
          `;
        } else {
          pinLabelsMarkup += `
            <text x="${halfW + 8}" y="${pin.dy + 3.5}" text-anchor="start" font-size="9" font-weight="700" fill="#64748b">${pin.pinNumber}</text>
            <text x="${halfW - 8}" y="${pin.dy + 3.5}" text-anchor="end" font-size="9.5" font-weight="700" fill="${color}">${escapeSvgText(pin.label)}</text>
          `;
        }
      });

      bodyMarkup = `
        <rect x="${-halfW}" y="${-halfH}" width="${width}" height="${height}" rx="5" class="component-body ic-body" fill="#ffffff" stroke="#1e293b" stroke-width="2" />
        <!-- Top Orientation Notch -->
        <path d="M -8 ${-halfH} A 8 8 0 0 0 8 ${-halfH}" fill="#ffffff" stroke="#1e293b" stroke-width="2" />
        <text x="0" y="-3" text-anchor="middle" font-size="12.5" font-weight="800" fill="#0f172a" letter-spacing="0.5">${icName}</text>
        <text x="0" y="11" text-anchor="middle" font-size="8.5" font-weight="600" fill="#64748b">${pkg}</text>
        ${pinLabelsMarkup}
      `;
      break;
    }

    case ComponentTypes.GND: {
      bodyMarkup = `
        <line x1="0" y1="-20" x2="0" y2="0" stroke="#1e293b" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="-14" y1="0" x2="14" y2="0" stroke="#1e293b" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="-9" y1="5" x2="9" y2="5" stroke="#1e293b" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="-4" y1="10" x2="4" y2="10" stroke="#1e293b" stroke-width="2.5" stroke-linecap="round"/>
        <text x="0" y="21" text-anchor="middle" font-size="9" font-weight="800" fill="#334155" letter-spacing="0.5">GND</text>
      `;
      break;
    }

    case ComponentTypes.VCC_5:
    case ComponentTypes.VCC_NEG_5:
    case ComponentTypes.VCC_12:
    case ComponentTypes.VCC_NEG_12: {
      const vSpec = POWER_RAIL_SPECS[type] || { label: 'VCC' };
      const labelText = escapeSvgText(vSpec.label);
      bodyMarkup = `
        <line x1="0" y1="20" x2="0" y2="2" stroke="#dc2626" stroke-width="2.5" stroke-linecap="round"/>
        <polygon points="0,-8 -7,2 7,2" fill="#dc2626" stroke="#dc2626" stroke-width="1"/>
        <text x="0" y="-12" text-anchor="middle" font-size="10" font-weight="800" fill="#dc2626" letter-spacing="0.5">${labelText}</text>
      `;
      break;
    }

    case ComponentTypes.CLOCK: {
      const isHigh = comp.value === 1;
      const isRunning = !!comp.running;
      const pulseActive = !!comp.activePulse;
      const outClkHigh = comp.value === 1;
      const outNclkHigh = !outClkHigh;
      bodyMarkup = `
        <rect x="-38" y="-28" width="76" height="56" rx="6" class="component-body clock-body" fill="#ffffff" stroke="${isHigh ? '#10b981' : '#1e293b'}" stroke-width="2.5"/>
        <text x="0" y="-17" text-anchor="middle" font-size="9" font-weight="800" fill="#0f172a" letter-spacing="0.5">CLOCK</text>
        <!-- Interactive Manual Trigger Push Button -->
        <g class="clock-push-btn" data-comp-id="${escapeSvgText(comp.id)}" style="cursor: pointer;">
          <rect x="-26" y="-7" width="52" height="20" rx="4" 
                fill="${pulseActive ? '#3b82f6' : (isHigh ? '#dcfce7' : '#eff6ff')}" 
                stroke="${pulseActive ? '#1d4ed8' : (isHigh ? '#10b981' : '#3b82f6')}" 
                stroke-width="1.5"/>
          <text x="0" y="7" text-anchor="middle" font-size="9" font-weight="800" 
                fill="${pulseActive ? '#ffffff' : (isHigh ? '#047857' : '#1d4ed8')}" pointer-events="none">
            ${pulseActive ? 'PULSING' : 'PULSE'}
          </text>
        </g>
        <!-- Pin Labels: CLK (top right) and CLK̅ (bottom right) -->
        <text x="30" y="-8" text-anchor="end" font-size="8.5" font-weight="700" fill="${outClkHigh ? '#059669' : '#475569'}">CLK</text>
        <text x="30" y="15" text-anchor="end" font-size="8.5" font-weight="700" fill="${outNclkHigh ? '#059669' : '#475569'}">CLK̅</text>
        <!-- Pin connection leads -->
        <line x1="32" y1="-12" x2="38" y2="-12" stroke="${outClkHigh ? '#10b981' : '#64748b'}" stroke-width="2"/>
        <line x1="32" y1="12" x2="38" y2="12" stroke="${outNclkHigh ? '#10b981' : '#64748b'}" stroke-width="2"/>
        <!-- Running mode indicator dot -->
        ${isRunning ? `<circle cx="-28" cy="-18" r="3" fill="#22c55e" stroke="#ffffff" stroke-width="1"><title>Continuous Running</title></circle>` : ''}
      `;
      break;
    }

    case ComponentTypes.D_LATCH: {
      const qVal = comp.state?.Q ?? 0;
      const isHigh = qVal === 1;
      bodyMarkup = `
        <rect x="-40" y="-30" width="80" height="60" rx="6" class="component-body latch-body" fill="#ffffff" stroke="#1e293b" stroke-width="2.5"/>
        <text x="0" y="-16" text-anchor="middle" font-size="10" font-weight="800" fill="#0f172a" letter-spacing="0.5">D LATCH</text>
        <!-- Input pin labels -->
        <text x="-32" y="-9" text-anchor="start" font-size="9" font-weight="700" fill="#475569">D</text>
        <text x="-32" y="15" text-anchor="start" font-size="8" font-weight="700" fill="#475569">CLK</text>
        <!-- Output pin labels -->
        <text x="32" y="-9" text-anchor="end" font-size="9" font-weight="700" fill="#475569">Q</text>
        <text x="32" y="15" text-anchor="end" font-size="9" font-weight="700" fill="#475569">Q̅</text>
        <!-- Pin connection lead lines -->
        <line x1="-40" y1="-12" x2="-35" y2="-12" stroke="#334155" stroke-width="2"/>
        <line x1="-40" y1="12" x2="-35" y2="12" stroke="#334155" stroke-width="2"/>
        <line x1="35" y1="-12" x2="40" y2="-12" stroke="#334155" stroke-width="2"/>
        <line x1="35" y1="12" x2="40" y2="12" stroke="#334155" stroke-width="2"/>
        <!-- Center State Indicator -->
        <rect x="-14" y="-2" width="28" height="18" rx="3" fill="${isHigh ? '#dcfce7' : '#f1f5f9'}" stroke="${isHigh ? '#10b981' : '#cbd5e1'}" stroke-width="1.5"/>
        <text x="0" y="11" text-anchor="middle" font-size="10" font-weight="800" fill="${isHigh ? '#047857' : '#334155'}">Q:${qVal}</text>
      `;
      break;
    }

    case ComponentTypes.SR_LATCH: {
      const qVal = comp.state?.Q ?? 0;
      const isInvalid = comp.state?.invalid === true;
      const isHigh = qVal === 1;
      bodyMarkup = `
        <rect x="-40" y="-32" width="80" height="64" rx="6" class="component-body latch-body" fill="#ffffff" stroke="#1e293b" stroke-width="2.5"/>
        <text x="0" y="-20" text-anchor="middle" font-size="10" font-weight="800" fill="#0f172a" letter-spacing="0.5">SR LATCH</text>
        <!-- Input pin labels -->
        <text x="-32" y="-13" text-anchor="start" font-size="9" font-weight="700" fill="#475569">S</text>
        <text x="-32" y="3" text-anchor="start" font-size="8" font-weight="700" fill="#475569">EN</text>
        <text x="-32" y="19" text-anchor="start" font-size="9" font-weight="700" fill="#475569">R</text>
        <!-- Output pin labels -->
        <text x="32" y="-9" text-anchor="end" font-size="9" font-weight="700" fill="#475569">Q</text>
        <text x="32" y="15" text-anchor="end" font-size="9" font-weight="700" fill="#475569">Q̅</text>
        <!-- Pin connection lead lines -->
        <line x1="-40" y1="-16" x2="-35" y2="-16" stroke="#334155" stroke-width="2"/>
        <line x1="-40" y1="0" x2="-35" y2="0" stroke="#334155" stroke-width="2"/>
        <line x1="-40" y1="16" x2="-35" y2="16" stroke="#334155" stroke-width="2"/>
        <line x1="35" y1="-12" x2="40" y2="-12" stroke="#334155" stroke-width="2"/>
        <line x1="35" y1="12" x2="40" y2="12" stroke="#334155" stroke-width="2"/>
        <!-- Center State Indicator -->
        <rect x="-18" y="-4" width="36" height="18" rx="3" fill="${isInvalid ? '#fee2e2' : (isHigh ? '#dcfce7' : '#f1f5f9')}" stroke="${isInvalid ? '#ef4444' : (isHigh ? '#10b981' : '#cbd5e1')}" stroke-width="1.5"/>
        <text x="0" y="9" text-anchor="middle" font-size="9" font-weight="800" fill="${isInvalid ? '#b91c1c' : (isHigh ? '#047857' : '#334155')}">${isInvalid ? 'INV' : `Q:${qVal}`}</text>
      `;
      break;
    }
  }

  const pinSpecs = getComponentPinSpecs(type, comp);
  let pinsMarkup = '';

  [...pinSpecs.inputs, ...pinSpecs.outputs].forEach(pin => {
    const pinType = normalizePinType(pin.type);
    const isOut = pinType === 'out';
    pinsMarkup += `
      <circle cx="${pin.dx}" cy="${pin.dy}" r="${RAIL_METRICS.PIN_HIT_RADIUS}"
              class="pin-port-hitarea pin-port ${isOut ? 'pin-out' : 'pin-in'}"
              data-comp-id="${escapeSvgText(comp.id)}"
              data-pin-id="${escapeSvgText(pin.id)}"
              data-pin-type="${pinType}">
        <title>${escapeSvgText(pin.label)} (${isOut ? 'Output' : 'Input'})</title>
      </circle>
      <circle cx="${pin.dx}" cy="${pin.dy}" r="${RAIL_METRICS.PIN_VISIBLE_RADIUS}"
              class="pin-port-visible ${isOut ? 'pin-out' : 'pin-in'}"
              pointer-events="none">
      </circle>
    `;
  });

  const bounds = getComponentBounds(comp);
  const halfW = (bounds ? bounds.width : 76) / 2;
  const halfH = (bounds ? bounds.height : 56) / 2;
  const selectionMarkup = isSelected
    ? `<rect x="${-halfW}" y="${-halfH}" width="${halfW * 2}" height="${halfH * 2}" rx="6" class="selection-box" />`
    : '';

  return `
    <g class="component-group ${isSelected ? 'selected' : ''}"
       id="comp-${escapeSvgText(comp.id)}"
       data-id="${escapeSvgText(comp.id)}"
       transform="translate(${comp.x || 0}, ${comp.y || 0}) rotate(${rotation})">
      ${selectionMarkup}
      ${bodyMarkup}
      ${pinsMarkup}
    </g>
  `;
}
