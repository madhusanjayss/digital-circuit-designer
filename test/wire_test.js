import assert from 'node:assert';
import {
  ComponentTypes,
  getComponentPinSpecs,
  getPinPosition,
  getComponentBounds,
  getComponentSVGMarkup,
  getWireComponentSVGMarkup
} from '../static/js/components.js';
import {
  Circuit,
  validateWireComponent,
  validateCircuit,
  migrateCircuitData,
  createChipFromSelection,
  expandChipToCircuit
} from '../static/js/circuit.js';
import { Simulator } from '../static/js/simulator.js';
import { HistoryManager } from '../static/js/history.js';
import { InteractionHandler } from '../static/js/interaction.js';

console.log('--- Starting Wire Component Automated Test Suite ---');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log('PASS: Test ' + totalTests + ' - ' + name);
    passedTests++;
  } catch (err) {
    console.error('FAIL: Test ' + totalTests + ' - ' + name);
    console.error(err);
    process.exitCode = 1;
  }
}

// ----------------------------------------------------------------------------
// Test 1: Straight Wire Component (Horizontal & Vertical)
// ----------------------------------------------------------------------------
runTest('Straight Wire Component (Creation, Pins, Propagation)', () => {
  const circuit = new Circuit();
  const wire = circuit.addWireComponent({
    input: { x: 50, y: 100 },
    output: { x: 250, y: 100 },
    points: [{ x: 50, y: 100 }, { x: 250, y: 100 }]
  });

  assert.ok(wire, 'Wire component must be created');
  assert.strictEqual(wire.type, ComponentTypes.WIRE);
  assert.strictEqual(wire.segments.length, 1);
  assert.strictEqual(wire.segments[0].y1, wire.segments[0].y2, 'Segment should be horizontal');

  // Verify Pin Specs
  const pinSpecs = getComponentPinSpecs(wire.type, wire);
  assert.strictEqual(pinSpecs.inputs.length, 1, 'Should have exactly 1 input');
  assert.strictEqual(pinSpecs.inputs[0].id, 'in0');
  assert.strictEqual(pinSpecs.outputs.length, 1, 'Should have exactly 1 primary output');
  assert.strictEqual(pinSpecs.outputs[0].id, 'out0');

  // Verify Pin Positions
  const inPos = getPinPosition(wire, 'in0');
  const outPos = getPinPosition(wire, 'out0');
  assert.deepStrictEqual(inPos, { x: 50, y: 100 });
  assert.deepStrictEqual(outPos, { x: 250, y: 100 });

  // Connect Input Gate -> Wire -> Output Gate
  const inComp = circuit.addComponent(ComponentTypes.INPUT, 0, 100, null, 1);
  const outComp = circuit.addComponent(ComponentTypes.OUTPUT, 300, 100);

  const c1 = circuit.addConnection(inComp.id, 'out0', wire.id, 'in0');
  const c2 = circuit.addConnection(wire.id, 'out0', outComp.id, 'in0');
  assert.ok(c1 && c2, 'Connections should be created');

  const sim = new Simulator(circuit);
  const res = sim.run();
  assert.strictEqual(res.success, true);
  assert.strictEqual(wire.signal, 1, 'Wire signal should be HIGH (1)');
  assert.strictEqual(outComp.value, 1, 'Output component should receive HIGH (1)');

  // Toggle input to 0
  inComp.value = 0;
  const res2 = sim.run();
  assert.strictEqual(res2.success, true);
  assert.strictEqual(wire.signal, 0, 'Wire signal should be LOW (0)');
  assert.strictEqual(outComp.value, 0, 'Output component should receive LOW (0)');
});

// ----------------------------------------------------------------------------
// Test 2: Wire with Manhattan Bends (Strictly Orthogonal)
// ----------------------------------------------------------------------------
runTest('Wire with Manhattan Bends (Strictly Orthogonal)', () => {
  const circuit = new Circuit();
  const wire = circuit.addWireComponent({
    input: { x: 100, y: 100 },
    output: { x: 300, y: 300 },
    points: [
      { x: 100, y: 100 },
      { x: 200, y: 100 },
      { x: 200, y: 300 },
      { x: 300, y: 300 }
    ]
  });

  assert.strictEqual(wire.segments.length, 3);
  wire.segments.forEach((seg, idx) => {
    const isHoriz = Math.abs(seg.y1 - seg.y2) < 0.001;
    const isVert = Math.abs(seg.x1 - seg.x2) < 0.001;
    assert.ok(isHoriz || isVert, 'Segment ' + idx + ' must be orthogonal');
    assert.ok(!(seg.x1 !== seg.x2 && seg.y1 !== seg.y2), 'Segment ' + idx + ' must not be diagonal');
  });

  const check = validateWireComponent(wire);
  assert.strictEqual(check.valid, true);
});

// ----------------------------------------------------------------------------
// Test 3: Single Branch Creation from Wire Path
// ----------------------------------------------------------------------------
runTest('Single Branch Creation and Signal Consistency', () => {
  const circuit = new Circuit();
  const inComp = circuit.addComponent(ComponentTypes.INPUT, 0, 100, null, 1);
  const wire = circuit.addWireComponent({
    input: { x: 100, y: 100 },
    output: { x: 300, y: 100 }
  });
  circuit.addConnection(inComp.id, 'out0', wire.id, 'in0');

  // Pull branch from (200, 100) down to (200, 200)
  const branch = circuit.addWireBranch(wire.id, {
    anchor: { x: 200, y: 100 },
    output: { x: 200, y: 200 }
  });

  assert.ok(branch, 'Branch must be created');
  assert.strictEqual(wire.branches.length, 1);
  assert.strictEqual(branch.segments[0].x1, branch.segments[0].x2, 'Branch segment must be vertical');

  // Connect primary output and branch output to two separate output components
  const out1 = circuit.addComponent(ComponentTypes.OUTPUT, 400, 100);
  const out2 = circuit.addComponent(ComponentTypes.OUTPUT, 400, 200);

  circuit.addConnection(wire.id, 'out0', out1.id, 'in0');
  circuit.addConnection(wire.id, branch.id, out2.id, 'in0');

  const sim = new Simulator(circuit);
  sim.run();

  assert.strictEqual(wire.signal, 1);
  assert.strictEqual(out1.value, 1, 'Primary output should be HIGH');
  assert.strictEqual(out2.value, 1, 'Branch output should be HIGH');

  // Change input signal to 0
  inComp.value = 0;
  sim.run();
  assert.strictEqual(out1.value, 0, 'Primary output should follow to LOW');
  assert.strictEqual(out2.value, 0, 'Branch output should follow to LOW');
});

// ----------------------------------------------------------------------------
// Test 4: Multiple Branches from Same Wire (Unlimited Fan-out)
// ----------------------------------------------------------------------------
runTest('Multiple Branches (Unlimited Fan-out)', () => {
  const circuit = new Circuit();
  const wire = circuit.addWireComponent({
    input: { x: 100, y: 100 },
    output: { x: 500, y: 100 }
  });

  const branchCount = 10;
  const branchOutputs = [];
  for (let i = 1; i <= branchCount; i++) {
    const x = 100 + i * 35;
    const b = circuit.addWireBranch(wire.id, {
      anchor: { x, y: 100 },
      output: { x, y: 100 + (i % 2 === 0 ? 50 : -50) }
    });
    branchOutputs.push(b);
  }

  assert.strictEqual(wire.branches.length, branchCount);

  // Check pin specs
  const specs = getComponentPinSpecs(wire.type, wire);
  assert.strictEqual(specs.inputs.length, 1);
  assert.strictEqual(specs.outputs.length, 1 + branchCount, 'Should have 1 primary + 10 branch outputs');

  // Check SVG markup generation
  const svg = getWireComponentSVGMarkup(wire, false);
  assert.ok(svg.includes('wire-comp-main-path'));
  assert.ok(svg.includes('wire-comp-branch-path'));
  assert.ok(svg.includes('wire-branch-anchor-dot'));
});

// ----------------------------------------------------------------------------
// Test 5: Branch from Vertical Wire Segment
// ----------------------------------------------------------------------------
runTest('Branch from Vertical Wire Segment', () => {
  const circuit = new Circuit();
  const wire = circuit.addWireComponent({
    input: { x: 200, y: 50 },
    output: { x: 200, y: 350 },
    points: [{ x: 200, y: 50 }, { x: 200, y: 350 }]
  });

  // Pull branch horizontally to (350, 200)
  const branch = circuit.addWireBranch(wire.id, {
    anchor: { x: 200, y: 200 },
    output: { x: 350, y: 200 }
  });

  assert.ok(branch);
  assert.strictEqual(branch.segments[0].y1, branch.segments[0].y2, 'Branch must be horizontal');

  const check = validateWireComponent(wire);
  assert.strictEqual(check.valid, true);
});

// ----------------------------------------------------------------------------
// Test 6: Branch with Manhattan Bends
// ----------------------------------------------------------------------------
runTest('Branch with Manhattan Bends', () => {
  const circuit = new Circuit();
  const wire = circuit.addWireComponent({
    input: { x: 100, y: 100 },
    output: { x: 400, y: 100 }
  });

  const branch = circuit.addWireBranch(wire.id, {
    anchor: { x: 250, y: 100 },
    output: { x: 350, y: 250 },
    points: [
      { x: 250, y: 100 },
      { x: 250, y: 250 },
      { x: 350, y: 250 }
    ]
  });

  assert.ok(branch);
  assert.strictEqual(branch.segments.length, 2);
  branch.segments.forEach((seg, idx) => {
    assert.ok(
      Math.abs(seg.x1 - seg.x2) < 0.001 || Math.abs(seg.y1 - seg.y2) < 0.001,
      'Branch segment ' + idx + ' must be orthogonal'
    );
  });
});

// ----------------------------------------------------------------------------
// Test 7: Adjacent / Duplicate Branch Anchor Handling
// ----------------------------------------------------------------------------
runTest('Adjacent / Duplicate Branch Anchor Handling', () => {
  const circuit = new Circuit();
  const wire = circuit.addWireComponent({
    input: { x: 100, y: 100 },
    output: { x: 400, y: 100 }
  });

  // Pull two branches from the exact same anchor point
  const b1 = circuit.addWireBranch(wire.id, {
    anchor: { x: 200, y: 100 },
    output: { x: 200, y: 50 }
  });
  const b2 = circuit.addWireBranch(wire.id, {
    anchor: { x: 200, y: 100 },
    output: { x: 200, y: 150 }
  });

  assert.ok(b1 && b2);
  assert.notStrictEqual(b1.id, b2.id, 'Branch IDs must be distinct');
  assert.strictEqual(wire.branches.length, 2);

  const check = validateWireComponent(wire);
  assert.strictEqual(check.valid, true);
});

// ----------------------------------------------------------------------------
// Test 8: Circuit Isolation (Generic Gate Wiring Unchanged)
// ----------------------------------------------------------------------------
runTest('Circuit Isolation (Generic Gate Wiring Unchanged)', () => {
  const circuit = new Circuit();
  const inA = circuit.addComponent(ComponentTypes.INPUT, 50, 50, null, 1);
  const inB = circuit.addComponent(ComponentTypes.INPUT, 50, 150, null, 1);
  const andGate = circuit.addComponent(ComponentTypes.AND, 200, 100);
  const outGate = circuit.addComponent(ComponentTypes.OUTPUT, 350, 100);

  const w1 = circuit.addConnection(inA.id, 'out0', andGate.id, 'in0');
  const w2 = circuit.addConnection(inB.id, 'out0', andGate.id, 'in1');
  const w3 = circuit.addConnection(andGate.id, 'out0', outGate.id, 'in0');

  assert.ok(w1 && w2 && w3);
  assert.strictEqual(circuit.connections.length, 3);

  // Verify ordinary connections do NOT have branches property
  assert.strictEqual(w1.branches, undefined);
  assert.strictEqual(w2.branches, undefined);
  assert.strictEqual(w3.branches, undefined);

  const sim = new Simulator(circuit);
  sim.run();
  assert.strictEqual(outGate.value, 1, 'Standard AND gate simulation intact');
});

// ----------------------------------------------------------------------------
// Test 9: Serialization & Deserialization (Save/Load)
// ----------------------------------------------------------------------------
runTest('Serialization & Deserialization Round-trip', () => {
  const circuit = new Circuit();
  const wire = circuit.addWireComponent({
    input: { x: 100, y: 100 },
    output: { x: 400, y: 100 },
    signal: 1
  });
  circuit.addWireBranch(wire.id, {
    anchor: { x: 250, y: 100 },
    output: { x: 250, y: 200 }
  });

  const json = circuit.toJSON();
  const wireJson = json.components.find(c => c.id === wire.id);

  assert.ok(wireJson, 'Wire must exist in JSON');
  assert.strictEqual(wireJson.type, ComponentTypes.WIRE);
  assert.deepStrictEqual(wireJson.input, { x: 100, y: 100 });
  assert.deepStrictEqual(wireJson.output, { x: 400, y: 100 });
  assert.strictEqual(wireJson.branches.length, 1);

  // Reload into a new Circuit instance
  const loadedCircuit = new Circuit();
  const ok = loadedCircuit.fromJSON(json);
  assert.strictEqual(ok, true, 'fromJSON should succeed');

  const reloadedWire = loadedCircuit.components.get(wire.id);
  assert.ok(reloadedWire);
  assert.strictEqual(reloadedWire.type, ComponentTypes.WIRE);
  assert.strictEqual(reloadedWire.branches.length, 1);
  assert.deepStrictEqual(reloadedWire.branches[0].anchor, { x: 250, y: 100 });
  assert.deepStrictEqual(reloadedWire.branches[0].output, { x: 250, y: 200 });
});

// ----------------------------------------------------------------------------
// Test 10: Undo / Redo Handling
// ----------------------------------------------------------------------------
runTest('Undo / Redo for Wire and Branches', () => {
  const circuit = new Circuit();
  const history = new HistoryManager(circuit);

  // Action 1: Add Wire
  history.beginTransaction('add wire');
  const wire = circuit.addWireComponent({
    input: { x: 100, y: 100 },
    output: { x: 300, y: 100 }
  });
  history.commitTransaction();
  assert.strictEqual(circuit.components.size, 1);

  // Action 2: Add Branch
  history.beginTransaction('add branch');
  const branch = circuit.addWireBranch(wire.id, {
    anchor: { x: 200, y: 100 },
    output: { x: 200, y: 200 }
  });
  history.commitTransaction();
  assert.strictEqual(circuit.components.get(wire.id).branches.length, 1);

  // Undo Action 2
  const undo1 = history.undo();
  assert.strictEqual(undo1, true);
  assert.strictEqual(circuit.components.get(wire.id).branches.length, 0, 'Branch should be undone');

  // Redo Action 2
  const redo1 = history.redo();
  assert.strictEqual(redo1, true);
  assert.strictEqual(circuit.components.get(wire.id).branches.length, 1, 'Branch should be restored');

  // Undo Action 2, then Undo Action 1
  history.undo();
  history.undo();
  assert.strictEqual(circuit.components.size, 0, 'Wire addition should be undone');

  // Redo Action 1
  history.redo();
  assert.strictEqual(circuit.components.size, 1, 'Wire should be restored');
});

// ----------------------------------------------------------------------------
// Test 11: Validation Rules (Catch Non-Orthogonal Segments)
// ----------------------------------------------------------------------------
runTest('Validation Rules (Reject Diagonal Segments)', () => {
  const invalidWire = {
    id: 'invalid_1',
    type: ComponentTypes.WIRE,
    input: { x: 0, y: 0 },
    output: { x: 100, y: 100 },
    segments: [
      { x1: 0, y1: 0, x2: 100, y2: 100 }
    ],
    branches: []
  };

  const check = validateWireComponent(invalidWire);
  assert.strictEqual(check.valid, false);
  assert.ok(check.errors.some(e => e.includes('not orthogonal')));
});

// ----------------------------------------------------------------------------
// Test 12: Backward Compatibility (Missing branches property)
// ----------------------------------------------------------------------------
runTest('Backward Compatibility (Gracefully Default Missing branches to [])', () => {
  const legacyData = {
    version: 1,
    components: [
      {
        id: 'wire_legacy',
        type: 'wire',
        x: 50,
        y: 50,
        input: { x: 50, y: 50 },
        output: { x: 150, y: 50 }
      }
    ],
    connections: []
  };

  const migrated = migrateCircuitData(legacyData);
  const loadedWire = migrated.components[0];
  assert.ok(Array.isArray(loadedWire.branches), 'branches must be defaulted to an array');
  assert.strictEqual(loadedWire.branches.length, 0);

  const circuit = new Circuit();
  const ok = circuit.fromJSON(legacyData);
  assert.strictEqual(ok, true, 'Legacy data without branches must load cleanly');
  assert.deepStrictEqual(circuit.components.get('wire_legacy').branches, []);
});

// ----------------------------------------------------------------------------
// Test 13: Move Wire Component (Preserve Relative Geometry of Main and Branches)
// ----------------------------------------------------------------------------
runTest('Move Wire Component and all Branches by (dx, dy)', () => {
  const circuit = new Circuit();
  const wire = circuit.addWireComponent({
    input: { x: 100, y: 100 },
    output: { x: 300, y: 100 },
    points: [{ x: 100, y: 100 }, { x: 300, y: 100 }]
  });
  const branch = circuit.addWireBranch(wire.id, {
    anchor: { x: 200, y: 100 },
    output: { x: 200, y: 200 },
    points: [{ x: 200, y: 100 }, { x: 200, y: 200 }]
  });

  // Move wire from (100, 100) to (150, 120) -> dx=+50, dy=+20
  circuit.moveComponent(wire.id, 150, 120);

  assert.deepStrictEqual(wire.input, { x: 150, y: 120 });
  assert.deepStrictEqual(wire.output, { x: 350, y: 120 });
  assert.deepStrictEqual(wire.points, [{ x: 150, y: 120 }, { x: 350, y: 120 }]);
  assert.deepStrictEqual(wire.branches[0].anchor, { x: 250, y: 120 });
  assert.deepStrictEqual(wire.branches[0].output, { x: 250, y: 220 });
  assert.deepStrictEqual(wire.branches[0].points, [{ x: 250, y: 120 }, { x: 250, y: 220 }]);
});

// ----------------------------------------------------------------------------
// Test 14: Remove Branch and Downstream Connection Cleanup
// ----------------------------------------------------------------------------
runTest('Remove Wire Branch and Downstream Connection Cleanup', () => {
  const circuit = new Circuit();
  const wire = circuit.addWireComponent({
    input: { x: 100, y: 100 },
    output: { x: 300, y: 100 }
  });
  const branch = circuit.addWireBranch(wire.id, {
    anchor: { x: 200, y: 100 },
    output: { x: 200, y: 200 }
  });
  const outGate = circuit.addComponent(ComponentTypes.OUTPUT, 400, 200);
  circuit.addConnection(wire.id, branch.id, outGate.id, 'in0');

  assert.strictEqual(circuit.connections.length, 1);

  // Remove the branch
  const removed = circuit.removeWireBranch(wire.id, branch.id);
  assert.strictEqual(removed, true);
  assert.strictEqual(wire.branches.length, 0);
  assert.strictEqual(circuit.connections.length, 0, 'Connection from deleted branch should be removed');
});

// ----------------------------------------------------------------------------
// Test 15: Component 90-Degree Rotation Cycle (0 -> 90 -> 180 -> 270 -> 0)
// ----------------------------------------------------------------------------
runTest('Component 90-degree Rotation Cycle in Circuit', () => {
  const circuit = new Circuit();
  const andGate = circuit.addComponent(ComponentTypes.AND, 100, 100);

  assert.strictEqual(andGate.rotation || 0, 0);

  circuit.rotateComponent(andGate.id);
  assert.strictEqual(andGate.rotation, 90);

  circuit.rotateComponent(andGate.id);
  assert.strictEqual(andGate.rotation, 180);

  circuit.rotateComponent(andGate.id);
  assert.strictEqual(andGate.rotation, 270);

  circuit.rotateComponent(andGate.id);
  assert.strictEqual(andGate.rotation, 0);
});

// ----------------------------------------------------------------------------
// Test 16: Pin Positions Transform with 90° Rotation
// ----------------------------------------------------------------------------
runTest('Pin Positions Transform with Rotation', () => {
  const circuit = new Circuit();
  const notGate = circuit.addComponent(ComponentTypes.NOT, 200, 200);

  // At 0 deg: in0 is on left (dx < 0, dy = 0), out0 is on right (dx > 0, dy = 0)
  const pIn0 = getPinPosition(notGate, 'in0');
  const pOut0 = getPinPosition(notGate, 'out0');
  assert.ok(pIn0.x < notGate.x, 'Input pin should be left of center at 0 deg');
  assert.ok(pOut0.x > notGate.x, 'Output pin should be right of center at 0 deg');

  // Rotate 90 deg clockwise: (dx, dy) -> (-dy, dx) -> in0 points up, out0 points down
  circuit.rotateComponent(notGate.id);
  const pIn90 = getPinPosition(notGate, 'in0');
  const pOut90 = getPinPosition(notGate, 'out0');
  assert.ok(pIn90.y < notGate.y, 'Input pin should be above center at 90 deg');
  assert.ok(pOut90.y > notGate.y, 'Output pin should be below center at 90 deg');
});

// ----------------------------------------------------------------------------
// Test 17: Scroll Button Click (Middle Mouse Button) Rotates Component by 90°
// ----------------------------------------------------------------------------
runTest('Scroll Button Click (Middle Click) Rotates Component by 90°', () => {
  const circuit = new Circuit();
  const simulator = new Simulator(circuit);
  const history = new HistoryManager(circuit);

  const toasts = [];
  const uiCallbacks = {
    onSelectionChanged: () => {},
    onStatusChange: () => {},
    onToast: (msg) => toasts.push(msg),
    onShowContextMenu: () => {},
    onHideContextMenu: () => {},
    onMouseCoords: () => {}
  };

  const mockRenderer = {
    canvas: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) },
    screenToWorld: (x, y) => ({ x, y }),
    panX: 0,
    panY: 0,
    zoom: 1,
    render: () => {},
    requestRender: () => {}
  };

  const interaction = new InteractionHandler(circuit, simulator, mockRenderer, history, {}, uiCallbacks);

  const orGate = circuit.addComponent(ComponentTypes.OR, 150, 150);
  assert.strictEqual(orGate.rotation || 0, 0);

  const mockTarget = {
    closest: (selector) => {
      if (selector === '.component-group') {
        return {
          getAttribute: (attr) => attr === 'data-id' ? orGate.id : null
        };
      }
      return null;
    }
  };

  const mockScrollClickEvent = {
    preventDefault: () => {},
    stopPropagation: () => {},
    clientX: 150,
    clientY: 150,
    button: 1, // Middle click / scroll button
    target: mockTarget
  };

  interaction.onPointerDown(mockScrollClickEvent);

  assert.strictEqual(orGate.rotation, 90, 'Scroll click should have rotated OR gate to 90 degrees');
  assert.ok(toasts.some(t => t.includes('90°')), 'Toast should announce rotation');

  // Second scroll click rotates to 180 degrees
  interaction.onPointerDown(mockScrollClickEvent);
  assert.strictEqual(orGate.rotation, 180, 'Second scroll click should rotate OR gate to 180 degrees');
});

// ----------------------------------------------------------------------------
// Test 18: Right-Click on Special Wire and Branches SELECTS it
// ----------------------------------------------------------------------------
runTest('Right-Click on Special Wire and Branches Selects it', () => {
  const circuit = new Circuit();
  const simulator = new Simulator(circuit);
  const history = new HistoryManager(circuit);

  let selectedComp = null;
  const uiCallbacks = {
    onSelectionChanged: (comp) => { selectedComp = comp; },
    onStatusChange: () => {},
    onToast: () => {},
    onShowContextMenu: () => {},
    onHideContextMenu: () => {},
    onMouseCoords: () => {}
  };

  const mockRenderer = {
    canvas: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) },
    screenToWorld: (x, y) => ({ x, y }),
    panX: 0,
    panY: 0,
    zoom: 1,
    render: () => {},
    requestRender: () => {}
  };

  const interaction = new InteractionHandler(circuit, simulator, mockRenderer, history, {}, uiCallbacks);

  const wireComp = circuit.addWireComponent({
    input: { x: 50, y: 50 },
    output: { x: 200, y: 50 }
  });
  const branch = circuit.addWireBranch(wireComp.id, {
    anchor: { x: 100, y: 50 },
    output: { x: 100, y: 150 }
  });

  // Right-click wire component
  const mockWireTarget = {
    closest: (selector) => {
      if (selector === '.component-group') {
        return { getAttribute: (attr) => attr === 'data-id' ? wireComp.id : null };
      }
      return null;
    }
  };
  interaction.onContextMenu({
    preventDefault: () => {},
    stopPropagation: () => {},
    clientX: 75,
    clientY: 50,
    button: 2,
    target: mockWireTarget
  });

  assert.ok(interaction.selectedCompIds.has(wireComp.id), 'Right-click must select special wire');

  // Right-click branch
  const mockBranchTarget = {
    closest: (selector) => {
      if (selector === '.wire-comp-branch-hit, .wire-comp-branch-path') {
        return {
          getAttribute: (attr) => {
            if (attr === 'data-branch-id') return branch.id;
            if (attr === 'data-comp-id') return wireComp.id;
            return null;
          }
        };
      }
      return null;
    }
  };
  interaction.onContextMenu({
    preventDefault: () => {},
    stopPropagation: () => {},
    clientX: 100,
    clientY: 100,
    button: 2,
    target: mockBranchTarget
  });

  assert.strictEqual(interaction.selectedBranchId, branch.id, 'Right-click must select branch');
});

// ----------------------------------------------------------------------------
// Test 19: Left-Click on Special Wire Does NOT Select It
// ----------------------------------------------------------------------------
runTest('Left-Click on Special Wire Does NOT Select It', () => {
  const circuit = new Circuit();
  const simulator = new Simulator(circuit);
  const history = new HistoryManager(circuit);

  const uiCallbacks = {
    onSelectionChanged: () => {},
    onStatusChange: () => {},
    onToast: () => {},
    onShowContextMenu: () => {},
    onHideContextMenu: () => {},
    onMouseCoords: () => {}
  };

  const mockRenderer = {
    canvas: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) },
    screenToWorld: (x, y) => ({ x, y }),
    panX: 0,
    panY: 0,
    zoom: 1,
    render: () => {},
    requestRender: () => {}
  };

  const interaction = new InteractionHandler(circuit, simulator, mockRenderer, history, {}, uiCallbacks);

  const wireComp = circuit.addWireComponent({
    input: { x: 50, y: 50 },
    output: { x: 200, y: 50 }
  });

  interaction.clearSelection();
  assert.strictEqual(interaction.selectedCompIds.size, 0);

  const mockWireTarget = {
    closest: (selector) => {
      if (selector === '.component-group') {
        return { getAttribute: (attr) => attr === 'data-id' ? wireComp.id : null };
      }
      return null;
    }
  };

  interaction.onPointerDown({
    preventDefault: () => {},
    stopPropagation: () => {},
    clientX: 100,
    clientY: 50,
    button: 0,
    target: mockWireTarget
  });

  // Special wire must NOT be selected on left click
  assert.strictEqual(interaction.selectedCompIds.has(wireComp.id), false, 'Left-click must NOT select special wire');
  // Instead, left click starts branch pulling
  assert.strictEqual(interaction.isPullingBranch, true, 'Left-click starts branch pulling');
});

// ----------------------------------------------------------------------------
// Test 20: Right-Click Shows Context Menu for Components (Restored Previous Feature)
// ----------------------------------------------------------------------------
runTest('Right-Click Shows Context Menu for Components', () => {
  const circuit = new Circuit();
  const simulator = new Simulator(circuit);
  const history = new HistoryManager(circuit);

  let contextMenuShown = null;
  const uiCallbacks = {
    onSelectionChanged: () => {},
    onStatusChange: () => {},
    onToast: () => {},
    onShowContextMenu: (x, y, comp, type, count) => {
      contextMenuShown = { x, y, comp, type, count };
    },
    onHideContextMenu: () => {},
    onMouseCoords: () => {}
  };

  const mockRenderer = {
    canvas: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) },
    screenToWorld: (x, y) => ({ x, y }),
    panX: 0,
    panY: 0,
    zoom: 1,
    render: () => {},
    requestRender: () => {}
  };

  const interaction = new InteractionHandler(circuit, simulator, mockRenderer, history, {}, uiCallbacks);

  const andGate = circuit.addComponent(ComponentTypes.AND, 150, 150);

  const mockTarget = {
    closest: (selector) => {
      if (selector === '.component-group') {
        return { getAttribute: (attr) => attr === 'data-id' ? andGate.id : null };
      }
      return null;
    }
  };

  interaction.onContextMenu({
    preventDefault: () => {},
    stopPropagation: () => {},
    clientX: 200,
    clientY: 200,
    button: 2,
    target: mockTarget
  });

  assert.ok(contextMenuShown, 'Context menu must be opened on right-click');
  assert.strictEqual(contextMenuShown.comp.id, andGate.id, 'Context menu targeted to AND gate');
  assert.strictEqual(contextMenuShown.type, 'component');
});

// ----------------------------------------------------------------------------
// Test 21: Special Wire Selectable in Marquee Box and Shift-Click Multi-Select
// ----------------------------------------------------------------------------
runTest('Special Wire Selectable in Marquee Box and Shift-Click Multi-Select', () => {
  const circuit = new Circuit();
  const simulator = new Simulator(circuit);
  const history = new HistoryManager(circuit);

  const uiCallbacks = {
    onSelectionChanged: () => {},
    onStatusChange: () => {},
    onToast: () => {},
    onShowContextMenu: () => {},
    onHideContextMenu: () => {},
    onMouseCoords: () => {}
  };

  const mockRenderer = {
    canvas: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) },
    screenToWorld: (x, y) => ({ x, y }),
    panX: 0,
    panY: 0,
    zoom: 1,
    render: () => {},
    requestRender: () => {}
  };

  const interaction = new InteractionHandler(circuit, simulator, mockRenderer, history, {}, uiCallbacks);

  const andGate = circuit.addComponent(ComponentTypes.AND, 100, 100);
  const wireComp = circuit.addWireComponent({
    input: { x: 50, y: 100 },
    output: { x: 100, y: 100 }
  });

  // Test 21a: Shift-click on special wire adds it to selection
  const mockWireTarget = {
    closest: (selector) => {
      if (selector === '.component-group') {
        return { getAttribute: (attr) => attr === 'data-id' ? wireComp.id : null };
      }
      return null;
    }
  };

  interaction.onPointerDown({
    preventDefault: () => {},
    stopPropagation: () => {},
    clientX: 75,
    clientY: 100,
    button: 0,
    shiftKey: true,
    target: mockWireTarget
  });

  assert.strictEqual(interaction.selectedCompIds.has(wireComp.id), true, 'Shift-click must select special wire');

  // Test 21b: Marquee selection includes special wire
  interaction.marqueeStart = { x: 20, y: 50 };
  interaction.marqueeBaseCompIds = new Set();
  interaction.updateMarquee({ x: 200, y: 200 });

  assert.strictEqual(interaction.selectedCompIds.has(andGate.id), true, 'Marquee must select AND gate');
  assert.strictEqual(interaction.selectedCompIds.has(wireComp.id), true, 'Marquee must select special wire');
});

// ----------------------------------------------------------------------------
// Test 22: Create Chip Containing Special Wire with Branches
// ----------------------------------------------------------------------------
runTest('Create Chip Containing Special Wire with Branches and Verify Simulation', () => {
  const circuit = new Circuit();
  const simulator = new Simulator(circuit);

  // Layout:
  // Input Switch -> Special Wire Component -> (Main Output + Branch Output) -> 2 inputs of AND gate -> Output Lamp
  const inp = circuit.addComponent(ComponentTypes.INPUT, 50, 100, null, 1);
  const wireComp = circuit.addWireComponent({
    input: { x: 100, y: 100 },
    output: { x: 200, y: 100 },
    points: [{ x: 100, y: 100 }, { x: 200, y: 100 }]
  });
  const branch = circuit.addWireBranch(wireComp.id, {
    anchor: { x: 150, y: 100 },
    output: { x: 200, y: 150 },
    points: [{ x: 150, y: 100 }, { x: 150, y: 150 }, { x: 200, y: 150 }]
  });

  const andGate = circuit.addComponent(ComponentTypes.AND, 250, 100);
  const outComp = circuit.addComponent(ComponentTypes.OUTPUT, 350, 100);

  // Connect components
  circuit.addConnection(inp.id, 'out0', wireComp.id, 'in0');
  circuit.addConnection(wireComp.id, 'out0', andGate.id, 'in0');
  circuit.addConnection(wireComp.id, branch.id, andGate.id, 'in1');
  circuit.addConnection(andGate.id, 'out0', outComp.id, 'in0');

  // Initial simulation
  simulator.run();
  assert.strictEqual(outComp.value, 1, 'Initial output should be 1 because input is 1 and wire branches distribute 1 to both AND inputs');

  // Create chip containing the Wire component and AND gate
  const chipResult = createChipFromSelection(circuit, [wireComp.id, andGate.id], 'WireAndChip');
  assert.strictEqual(chipResult.success, true, 'Chip creation should succeed: ' + chipResult.error);

  const newChip = chipResult.chip;
  assert.ok(newChip, 'New CHIP component should be returned');
  assert.strictEqual(newChip.type, ComponentTypes.CHIP);

  // Check internal circuit
  const internalComponents = newChip.chipData.circuit.components;
  const internalWire = internalComponents.find(c => c.type === ComponentTypes.WIRE);
  assert.ok(internalWire, 'Internal circuit must contain the special Wire component');
  assert.strictEqual(internalWire.branches.length, 1, 'Internal wire component must preserve its branch');

  // Verify internal wire coordinates were localized relative to center
  assert.ok(internalWire.input && typeof internalWire.input.x === 'number', 'Internal wire input position is localized');
  assert.ok(internalWire.branches[0].output && typeof internalWire.branches[0].output.x === 'number', 'Branch output position is localized');

  // Run simulation with the new CHIP:
  // When Input is HIGH (1), Chip output should evaluate to HIGH (1)
  inp.value = 1;
  simulator.run();
  assert.strictEqual(outComp.value, 1, 'CHIP output with special wire should evaluate to 1 when input is 1');

  // When Input is LOW (0), Chip output should evaluate to LOW (0)
  inp.value = 0;
  simulator.run();
  assert.strictEqual(outComp.value, 0, 'CHIP output with special wire should evaluate to 0 when input is 0');
});

// ----------------------------------------------------------------------------
// Test 23: Expand Chip to Circuit with Internal Special Wire Component
// ----------------------------------------------------------------------------
runTest('Expand Chip to Circuit with Internal Special Wire Component', () => {
  const circuit = new Circuit();
  const simulator = new Simulator(circuit);

  const inp = circuit.addComponent(ComponentTypes.INPUT, 50, 100, null, 1);
  const wireComp = circuit.addWireComponent({
    input: { x: 100, y: 100 },
    output: { x: 200, y: 100 },
    points: [{ x: 100, y: 100 }, { x: 200, y: 100 }]
  });
  const branch = circuit.addWireBranch(wireComp.id, {
    anchor: { x: 150, y: 100 },
    output: { x: 200, y: 150 },
    points: [{ x: 150, y: 100 }, { x: 150, y: 150 }, { x: 200, y: 150 }]
  });

  const orGate = circuit.addComponent(ComponentTypes.OR, 250, 100);
  const outComp = circuit.addComponent(ComponentTypes.OUTPUT, 350, 100);

  circuit.addConnection(inp.id, 'out0', wireComp.id, 'in0');
  circuit.addConnection(wireComp.id, 'out0', orGate.id, 'in0');
  circuit.addConnection(wireComp.id, branch.id, orGate.id, 'in1');
  circuit.addConnection(orGate.id, 'out0', outComp.id, 'in0');

  // Package into a chip
  const chipResult = createChipFromSelection(circuit, [wireComp.id, orGate.id], 'WireOrChip');
  assert.strictEqual(chipResult.success, true);

  // Expand the chip back to circuit
  const expandResult = expandChipToCircuit(circuit, chipResult.chip.id);
  assert.strictEqual(expandResult.success, true, 'Expand chip should succeed: ' + expandResult.error);

  // Verify Wire component was restored
  const restoredWire = Array.from(circuit.components.values()).find(c => c.type === ComponentTypes.WIRE);
  assert.ok(restoredWire, 'Restored circuit must contain the special Wire component');
  assert.strictEqual(restoredWire.branches.length, 1, 'Restored wire component must preserve its branch');

  // Verify coordinates are restored
  assert.ok(restoredWire.input.x > 0 && restoredWire.output.x > 0, 'Restored wire coordinates are valid world coordinates');

  // Verify simulation continues working after chip expansion
  inp.value = 1;
  simulator.run();
  assert.strictEqual(outComp.value, 1, 'Restored circuit evaluates correctly with 1');

  inp.value = 0;
  simulator.run();
  assert.strictEqual(outComp.value, 0, 'Restored circuit evaluates correctly with 0');
});

// ----------------------------------------------------------------------------
// Summary
// ----------------------------------------------------------------------------
console.log('----------------------------------------------------');
console.log('Results: ' + passedTests + ' / ' + totalTests + ' tests passed.');
if (passedTests === totalTests) {
  console.log('ALL TESTS PASSED SUCCESSFULLY!');
} else {
  console.error('SOME TESTS FAILED!');
  process.exit(1);
}
