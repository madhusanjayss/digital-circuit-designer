import assert from 'node:assert';
import {
  ComponentTypes,
  SUPPORTED_COMPONENT_TYPES,
  getComponentPinSpecs,
  getPinPosition,
  getComponentBounds,
  getComponentSVGMarkup
} from '../static/js/components.js';
import {
  Circuit,
  migrateCircuitData
} from '../static/js/circuit.js';
import { Simulator } from '../static/js/simulator.js';
import { generateTruthTable } from '../static/js/truthtable.js';
import { HistoryManager } from '../static/js/history.js';
import { InteractionHandler } from '../static/js/interaction.js';

console.log('--- Starting Sequential Logic & Clock Automated Test Suite ---');

let passedTests = 0;
let totalTests = 0;

async function runTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log('PASS: Test ' + totalTests + ' - ' + name);
    passedTests++;
  } catch (err) {
    console.error('FAIL: Test ' + totalTests + ' - ' + name);
    console.error(err);
    process.exitCode = 1;
  }
}

// ----------------------------------------------------------------------------
// Test 1: Component Definitions & Pin Specifications
// ----------------------------------------------------------------------------
await runTest('Component Definitions, Pin Specs, Bounding Boxes & SVG Markup', () => {
  assert.ok(ComponentTypes.CLOCK, 'CLOCK type must exist');
  assert.ok(ComponentTypes.D_LATCH, 'D_LATCH type must exist');
  assert.ok(ComponentTypes.SR_LATCH, 'SR_LATCH type must exist');
  assert.ok(ComponentTypes.GATED_LATCH, 'GATED_LATCH type must exist');
  assert.ok(ComponentTypes.JK_LATCH, 'JK_LATCH type must exist');
  assert.ok(ComponentTypes.SR_FLIPFLOP, 'SR_FLIPFLOP type must exist');
  assert.ok(ComponentTypes.JK_FLIPFLOP, 'JK_FLIPFLOP type must exist');
  assert.ok(ComponentTypes.D_FLIPFLOP, 'D_FLIPFLOP type must exist');
  assert.ok(ComponentTypes.T_FLIPFLOP, 'T_FLIPFLOP type must exist');

  assert.ok(SUPPORTED_COMPONENT_TYPES.has(ComponentTypes.CLOCK));
  assert.ok(SUPPORTED_COMPONENT_TYPES.has(ComponentTypes.D_LATCH));
  assert.ok(SUPPORTED_COMPONENT_TYPES.has(ComponentTypes.SR_LATCH));
  assert.ok(SUPPORTED_COMPONENT_TYPES.has(ComponentTypes.GATED_LATCH));
  assert.ok(SUPPORTED_COMPONENT_TYPES.has(ComponentTypes.JK_LATCH));
  assert.ok(SUPPORTED_COMPONENT_TYPES.has(ComponentTypes.SR_FLIPFLOP));
  assert.ok(SUPPORTED_COMPONENT_TYPES.has(ComponentTypes.JK_FLIPFLOP));
  assert.ok(SUPPORTED_COMPONENT_TYPES.has(ComponentTypes.D_FLIPFLOP));
  assert.ok(SUPPORTED_COMPONENT_TYPES.has(ComponentTypes.T_FLIPFLOP));

  const dummyClock = { type: ComponentTypes.CLOCK, x: 100, y: 100, rotation: 0, frequency: 1, period: 1000, dutyCycle: 50, running: false };
  const clockSpecs = getComponentPinSpecs(ComponentTypes.CLOCK, dummyClock);
  assert.strictEqual(clockSpecs.inputs.length, 0, 'Clock has 0 inputs');
  assert.strictEqual(clockSpecs.outputs.length, 2, 'Clock has 2 outputs: CLK and CLK_bar');
  assert.strictEqual(clockSpecs.outputs[0].id, 'out0');
  assert.strictEqual(clockSpecs.outputs[0].label, 'CLK');
  assert.strictEqual(clockSpecs.outputs[1].id, 'out_nclk');
  assert.strictEqual(clockSpecs.outputs[1].label, 'CLK̅');

  const dummyDLatch = { type: ComponentTypes.D_LATCH, x: 200, y: 200, rotation: 0, state: { Q: 0, Qbar: 1 } };
  const dSpecs = getComponentPinSpecs(ComponentTypes.D_LATCH, dummyDLatch);
  assert.strictEqual(dSpecs.inputs.length, 2, 'D Latch has 2 inputs: D and CLK');
  assert.strictEqual(dSpecs.inputs[0].id, 'in_d');
  assert.strictEqual(dSpecs.inputs[1].id, 'in_clk');
  assert.strictEqual(dSpecs.outputs.length, 2, 'D Latch has 2 outputs: Q and Qbar');
  assert.strictEqual(dSpecs.outputs[0].id, 'out_q');
  assert.strictEqual(dSpecs.outputs[1].id, 'out_qbar');

  const dummySRLatch = { type: ComponentTypes.SR_LATCH, x: 300, y: 300, rotation: 0, state: { Q: 0, Qbar: 1 } };
  const srSpecs = getComponentPinSpecs(ComponentTypes.SR_LATCH, dummySRLatch);
  assert.strictEqual(srSpecs.inputs.length, 2, 'SR Latch has 2 inputs: S, R');
  assert.strictEqual(srSpecs.inputs[0].id, 'in_s');
  assert.strictEqual(srSpecs.inputs[1].id, 'in_r');
  assert.strictEqual(srSpecs.outputs.length, 2, 'SR Latch has 2 outputs: Q and Qbar');

  const dummyGatedLatch = { type: ComponentTypes.GATED_LATCH, x: 300, y: 300, rotation: 0, state: { Q: 0, Qbar: 1 } };
  const gatedSpecs = getComponentPinSpecs(ComponentTypes.GATED_LATCH, dummyGatedLatch);
  assert.strictEqual(gatedSpecs.inputs.length, 3, 'Gated Latch has 3 inputs: S, EN, R');
  assert.strictEqual(gatedSpecs.inputs[0].id, 'in_s');
  assert.strictEqual(gatedSpecs.inputs[1].id, 'in_en');
  assert.strictEqual(gatedSpecs.inputs[2].id, 'in_r');
  assert.strictEqual(gatedSpecs.outputs.length, 2, 'Gated Latch has 2 outputs: Q and Qbar');

  const dummyJKLatch = { type: ComponentTypes.JK_LATCH, x: 300, y: 300, rotation: 0, state: { Q: 0, Qbar: 1 } };
  const jkLatchSpecs = getComponentPinSpecs(ComponentTypes.JK_LATCH, dummyJKLatch);
  assert.strictEqual(jkLatchSpecs.inputs.length, 3, 'JK Latch has 3 inputs: J, EN, K');
  assert.strictEqual(jkLatchSpecs.inputs[0].id, 'in_j');
  assert.strictEqual(jkLatchSpecs.inputs[1].id, 'in_en');
  assert.strictEqual(jkLatchSpecs.inputs[2].id, 'in_k');
  assert.strictEqual(jkLatchSpecs.outputs.length, 2, 'JK Latch has 2 outputs: Q and Qbar');

  const dummySRFF = { type: ComponentTypes.SR_FLIPFLOP, x: 300, y: 300, rotation: 0, state: { Q: 0, Qbar: 1 } };
  const srFFSpecs = getComponentPinSpecs(ComponentTypes.SR_FLIPFLOP, dummySRFF);
  assert.strictEqual(srFFSpecs.inputs.length, 3, 'SR Flip-Flop has 3 inputs: S, CLK, R');
  assert.strictEqual(srFFSpecs.inputs[0].id, 'in_s');
  assert.strictEqual(srFFSpecs.inputs[1].id, 'in_clk');
  assert.strictEqual(srFFSpecs.inputs[2].id, 'in_r');
  assert.strictEqual(srFFSpecs.outputs.length, 2, 'SR Flip-Flop has 2 outputs: Q and Qbar');

  const bClock = getComponentBounds(dummyClock);
  assert.ok(bClock.width > 0 && bClock.height > 0);
  const bD = getComponentBounds(dummyDLatch);
  assert.ok(bD.width >= 80 && bD.height >= 60);

  const clockSVG = getComponentSVGMarkup(dummyClock);
  assert.ok(clockSVG.includes('clock-symbol') || clockSVG.includes('CLK'));
  const dSVG = getComponentSVGMarkup(dummyDLatch);
  assert.ok(dSVG.includes('D LATCH') || dSVG.includes('D-LATCH') || dSVG.includes('D Latch'));
  const srSVG = getComponentSVGMarkup(dummySRLatch);
  assert.ok(srSVG.includes('SR LATCH') || srSVG.includes('SR-LATCH') || srSVG.includes('SR Latch'));
  const gatedSVG = getComponentSVGMarkup(dummyGatedLatch);
  assert.ok(gatedSVG.includes('GATED LATCH') || gatedSVG.includes('GATED-LATCH') || gatedSVG.includes('Gated Latch'));
  const jkLSVG = getComponentSVGMarkup(dummyJKLatch);
  assert.ok(jkLSVG.includes('JK LATCH') || jkLSVG.includes('JK-LATCH') || jkLSVG.includes('JK Latch'));
  const srFFSVG = getComponentSVGMarkup(dummySRFF);
  assert.ok(srFFSVG.includes('SR-FF') || srFFSVG.includes('SR FF') || srFFSVG.includes('SR Flip-Flop'));
});

// ----------------------------------------------------------------------------
// Test 2: Active-HIGH SR Latch (Set: S=1, R=0 -> Q=1, Qbar=0)
// ----------------------------------------------------------------------------
await runTest('SR Latch - Set condition (S=1, R=0 -> Q=1, Qbar=0)', () => {
  const circuit = new Circuit();
  const sr = circuit.addComponent(ComponentTypes.SR_LATCH, 200, 200);
  const inS = circuit.addComponent(ComponentTypes.INPUT, 50, 180, null, 1);
  const inR = circuit.addComponent(ComponentTypes.INPUT, 50, 220, null, 0);
  const outQ = circuit.addComponent(ComponentTypes.OUTPUT, 350, 180);
  const outQbar = circuit.addComponent(ComponentTypes.OUTPUT, 350, 220);

  circuit.addConnection(inS.id, 'out0', sr.id, 'in_s');
  circuit.addConnection(inR.id, 'out0', sr.id, 'in_r');
  circuit.addConnection(sr.id, 'out_q', outQ.id, 'in0');
  circuit.addConnection(sr.id, 'out_qbar', outQbar.id, 'in0');

  const sim = new Simulator(circuit);
  const res = sim.run();
  assert.strictEqual(res.success, true);
  assert.strictEqual(sr.state.Q, 1, 'SR Q should be 1');
  assert.strictEqual(sr.state.Qbar, 0, 'SR Qbar should be 0');
  assert.strictEqual(outQ.value, 1, 'outQ should be 1');
  assert.strictEqual(outQbar.value, 0, 'outQbar should be 0');
});

// ----------------------------------------------------------------------------
// Test 3: Active-HIGH SR Latch (Hold: S=0, R=0 retains Q=1, Qbar=0)
// ----------------------------------------------------------------------------
await runTest('SR Latch - Hold condition after Set (S=0, R=0 retains Q=1, Qbar=0)', () => {
  const circuit = new Circuit();
  const sr = circuit.addComponent(ComponentTypes.SR_LATCH, 200, 200);
  const inS = circuit.addComponent(ComponentTypes.INPUT, 50, 180, null, 1);
  const inR = circuit.addComponent(ComponentTypes.INPUT, 50, 220, null, 0);
  circuit.addConnection(inS.id, 'out0', sr.id, 'in_s');
  circuit.addConnection(inR.id, 'out0', sr.id, 'in_r');

  const sim = new Simulator(circuit);
  sim.run();
  assert.strictEqual(sr.state.Q, 1);
  assert.strictEqual(sr.state.Qbar, 0);

  // Now transition S to 0 (S=0, R=0 -> Hold)
  inS.value = 0;
  const res = sim.run();
  assert.strictEqual(res.success, true);
  assert.strictEqual(sr.state.Q, 1, 'Q must remain 1 on S=0, R=0 hold');
  assert.strictEqual(sr.state.Qbar, 0, 'Qbar must remain 0 on S=0, R=0 hold');
});

// ----------------------------------------------------------------------------
// Test 4: Active-HIGH SR Latch (Reset: S=0, R=1 -> Q=0, Qbar=1)
// ----------------------------------------------------------------------------
await runTest('SR Latch - Reset condition (S=0, R=1 -> Q=0, Qbar=1)', () => {
  const circuit = new Circuit();
  const sr = circuit.addComponent(ComponentTypes.SR_LATCH, 200, 200);
  sr.state = { Q: 1, Qbar: 0 };
  const inS = circuit.addComponent(ComponentTypes.INPUT, 50, 180, null, 0);
  const inR = circuit.addComponent(ComponentTypes.INPUT, 50, 220, null, 1);
  circuit.addConnection(inS.id, 'out0', sr.id, 'in_s');
  circuit.addConnection(inR.id, 'out0', sr.id, 'in_r');

  const sim = new Simulator(circuit);
  const res = sim.run();
  assert.strictEqual(res.success, true);
  assert.strictEqual(sr.state.Q, 0, 'SR Q should be 0 on reset');
  assert.strictEqual(sr.state.Qbar, 1, 'SR Qbar should be 1 on reset');
});

// ----------------------------------------------------------------------------
// Test 5: Active-HIGH SR Latch (Hold after Reset: S=0, R=0 retains Q=0, Qbar=1)
// ----------------------------------------------------------------------------
await runTest('SR Latch - Hold condition after Reset (S=0, R=0 retains Q=0, Qbar=1)', () => {
  const circuit = new Circuit();
  const sr = circuit.addComponent(ComponentTypes.SR_LATCH, 200, 200);
  const inS = circuit.addComponent(ComponentTypes.INPUT, 50, 180, null, 0);
  const inR = circuit.addComponent(ComponentTypes.INPUT, 50, 220, null, 1);
  circuit.addConnection(inS.id, 'out0', sr.id, 'in_s');
  circuit.addConnection(inR.id, 'out0', sr.id, 'in_r');

  const sim = new Simulator(circuit);
  sim.run();
  assert.strictEqual(sr.state.Q, 0);
  assert.strictEqual(sr.state.Qbar, 1);

  // Transition R to 0 (S=0, R=0)
  inR.value = 0;
  const res = sim.run();
  assert.strictEqual(res.success, true);
  assert.strictEqual(sr.state.Q, 0, 'Q must remain 0');
  assert.strictEqual(sr.state.Qbar, 1, 'Qbar must remain 1');
});

// ----------------------------------------------------------------------------
// Test 6: Active-HIGH SR Latch (Invalid State: S=1, R=1)
// ----------------------------------------------------------------------------
await runTest('SR Latch - Invalid condition (S=1, R=1 -> invalid flagged, stable outputs)', () => {
  const circuit = new Circuit();
  const sr = circuit.addComponent(ComponentTypes.SR_LATCH, 200, 200);
  const inS = circuit.addComponent(ComponentTypes.INPUT, 50, 180, null, 1);
  const inR = circuit.addComponent(ComponentTypes.INPUT, 50, 220, null, 1);
  circuit.addConnection(inS.id, 'out0', sr.id, 'in_s');
  circuit.addConnection(inR.id, 'out0', sr.id, 'in_r');

  const sim = new Simulator(circuit);
  const res = sim.run();
  assert.strictEqual(res.success, true, 'Simulation should not fail or get stuck in cycle');
  assert.strictEqual(sr.state.invalid, true, 'SR latch must record invalid=true');
  assert.strictEqual(sr.state.Q, 0);
  assert.strictEqual(sr.state.Qbar, 0);
});

// ----------------------------------------------------------------------------
// Test 7: Active-HIGH SR Latch (Recovery from Invalid State)
// ----------------------------------------------------------------------------
await runTest('SR Latch - Recovery from Invalid state to Hold without infinite loop', () => {
  const circuit = new Circuit();
  const sr = circuit.addComponent(ComponentTypes.SR_LATCH, 200, 200);
  const inS = circuit.addComponent(ComponentTypes.INPUT, 50, 180, null, 1);
  const inR = circuit.addComponent(ComponentTypes.INPUT, 50, 220, null, 1);
  circuit.addConnection(inS.id, 'out0', sr.id, 'in_s');
  circuit.addConnection(inR.id, 'out0', sr.id, 'in_r');

  const sim = new Simulator(circuit);
  sim.run();
  assert.strictEqual(sr.state.invalid, true);

  // Both drop to 0 simultaneously
  inS.value = 0;
  inR.value = 0;
  const res = sim.run();
  assert.strictEqual(res.success, true);
  // Now reset properly
  inR.value = 1;
  sim.run();
  assert.strictEqual(sr.state.Q, 0);
  assert.strictEqual(sr.state.Qbar, 1);
  assert.strictEqual(sr.state.invalid, false);
});

// ----------------------------------------------------------------------------
// Test 8: Gated SR Latch (Enable EN=0 holds state; EN=1 permits changes)
// ----------------------------------------------------------------------------
await runTest('Gated SR Latch - EN=0 holds state, EN=1 allows active-HIGH changes', () => {
  const circuit = new Circuit();
  const sr = circuit.addComponent(ComponentTypes.GATED_LATCH, 200, 200);
  const inS = circuit.addComponent(ComponentTypes.INPUT, 50, 150, null, 1);
  const inEN = circuit.addComponent(ComponentTypes.INPUT, 50, 200, null, 0); // DISABLED
  const inR = circuit.addComponent(ComponentTypes.INPUT, 50, 250, null, 0);
  circuit.addConnection(inS.id, 'out0', sr.id, 'in_s');
  circuit.addConnection(inEN.id, 'out0', sr.id, 'in_en');
  circuit.addConnection(inR.id, 'out0', sr.id, 'in_r');

  const sim = new Simulator(circuit);
  sim.run();
  // Since EN=0, S=1 is blocked! State should remain default Q=0, Qbar=1
  assert.strictEqual(sr.state.Q, 0, 'Q should remain 0 while EN=0');
  assert.strictEqual(sr.state.Qbar, 1, 'Qbar should remain 1 while EN=0');

  // Now enable EN=1
  inEN.value = 1;
  sim.run();
  assert.strictEqual(sr.state.Q, 1, 'Q should set to 1 when EN=1');
  assert.strictEqual(sr.state.Qbar, 0, 'Qbar should set to 0 when EN=1');

  // Disable EN=0, then change S=0, R=1 (reset attempt)
  inEN.value = 0;
  inS.value = 0;
  inR.value = 1;
  sim.run();
  assert.strictEqual(sr.state.Q, 1, 'Q must remain 1 when EN=0 despite R=1');
  assert.strictEqual(sr.state.Qbar, 0, 'Qbar must remain 0 when EN=0 despite R=1');

  // Re-enable EN=1: now R=1 takes effect
  inEN.value = 1;
  sim.run();
  assert.strictEqual(sr.state.Q, 0, 'Q resets to 0 when EN=1');
  assert.strictEqual(sr.state.Qbar, 1, 'Qbar resets to 1 when EN=1');
});

// ----------------------------------------------------------------------------
// Test 9: Gated SR Latch (EN unassigned defaults to active-HIGH ungated latch)
// ----------------------------------------------------------------------------
await runTest('Gated SR Latch - EN unassigned defaults to enabled (ungated behavior)', () => {
  const circuit = new Circuit();
  const sr = circuit.addComponent(ComponentTypes.GATED_LATCH, 200, 200);
  const inS = circuit.addComponent(ComponentTypes.INPUT, 50, 180, null, 1);
  const inR = circuit.addComponent(ComponentTypes.INPUT, 50, 220, null, 0);
  // Do not connect in_en
  circuit.addConnection(inS.id, 'out0', sr.id, 'in_s');
  circuit.addConnection(inR.id, 'out0', sr.id, 'in_r');

  const sim = new Simulator(circuit);
  sim.run();
  assert.strictEqual(sr.state.Q, 1, 'Ungated SR latch sets to 1');
  assert.strictEqual(sr.state.Qbar, 0, 'Ungated SR latch Qbar is 0');
});

// ----------------------------------------------------------------------------
// Test 10: D Latch Level Sensitivity - Transparent Mode (CLK=1)
// ----------------------------------------------------------------------------
await runTest('D Latch - Transparent Mode (CLK=1: Q follows D)', () => {
  const circuit = new Circuit();
  const dLatch = circuit.addComponent(ComponentTypes.D_LATCH, 200, 200);
  const inD = circuit.addComponent(ComponentTypes.INPUT, 50, 180, null, 1);
  const inCLK = circuit.addComponent(ComponentTypes.INPUT, 50, 220, null, 1);
  circuit.addConnection(inD.id, 'out0', dLatch.id, 'in_d');
  circuit.addConnection(inCLK.id, 'out0', dLatch.id, 'in_clk');

  const sim = new Simulator(circuit);
  sim.run();
  assert.strictEqual(dLatch.state.Q, 1);
  assert.strictEqual(dLatch.state.Qbar, 0);

  // When D becomes 0 while CLK=1, Q immediately becomes 0
  inD.value = 0;
  sim.run();
  assert.strictEqual(dLatch.state.Q, 0);
  assert.strictEqual(dLatch.state.Qbar, 1);
});

// ----------------------------------------------------------------------------
// Test 11: D Latch Level Sensitivity - Hold Mode (CLK=0)
// ----------------------------------------------------------------------------
await runTest('D Latch - Hold Mode (CLK=0: changes to D are ignored)', () => {
  const circuit = new Circuit();
  const dLatch = circuit.addComponent(ComponentTypes.D_LATCH, 200, 200);
  const inD = circuit.addComponent(ComponentTypes.INPUT, 50, 180, null, 1);
  const inCLK = circuit.addComponent(ComponentTypes.INPUT, 50, 220, null, 1);
  circuit.addConnection(inD.id, 'out0', dLatch.id, 'in_d');
  circuit.addConnection(inCLK.id, 'out0', dLatch.id, 'in_clk');

  const sim = new Simulator(circuit);
  sim.run();
  assert.strictEqual(dLatch.state.Q, 1);

  // CLK drops to 0: latches state 1
  inCLK.value = 0;
  sim.run();
  assert.strictEqual(dLatch.state.Q, 1);

  // D toggles to 0 while CLK=0: latch must hold 1!
  inD.value = 0;
  sim.run();
  assert.strictEqual(dLatch.state.Q, 1, 'Q must remain 1 during CLK=0');
  assert.strictEqual(dLatch.state.Qbar, 0, 'Qbar must remain 0 during CLK=0');
});

// ----------------------------------------------------------------------------
// Test 12: D Latch Full Section 16 Verification Sequence
// ----------------------------------------------------------------------------
await runTest('D Latch - Full Section 16 Verification Sequence', () => {
  const circuit = new Circuit();
  const dLatch = circuit.addComponent(ComponentTypes.D_LATCH, 200, 200);
  const inD = circuit.addComponent(ComponentTypes.INPUT, 50, 180, null, 0);
  const inCLK = circuit.addComponent(ComponentTypes.INPUT, 50, 220, null, 0);
  const outQ = circuit.addComponent(ComponentTypes.OUTPUT, 350, 180);
  const outQbar = circuit.addComponent(ComponentTypes.OUTPUT, 350, 220);

  circuit.addConnection(inD.id, 'out0', dLatch.id, 'in_d');
  circuit.addConnection(inCLK.id, 'out0', dLatch.id, 'in_clk');
  circuit.addConnection(dLatch.id, 'out_q', outQ.id, 'in0');
  circuit.addConnection(dLatch.id, 'out_qbar', outQbar.id, 'in0');

  const sim = new Simulator(circuit);

  // Step a: Initial CLK=0, D=0 -> Q=0, Qbar=1
  sim.run();
  assert.strictEqual(dLatch.state.Q, 0, 'Step a: Q=0');
  assert.strictEqual(dLatch.state.Qbar, 1, 'Step a: Qbar=1');
  assert.strictEqual(outQ.value, 0);
  assert.strictEqual(outQbar.value, 1);

  // Step b: CLK=0, D=1 -> Q=0 (latched, ignoring D)
  inD.value = 1;
  sim.run();
  assert.strictEqual(dLatch.state.Q, 0, 'Step b: Q remains 0 when D=1 while CLK=0');
  assert.strictEqual(dLatch.state.Qbar, 1, 'Step b: Qbar remains 1');

  // Step c: CLK=1, D=1 -> Q=1 (transparent, passes D)
  inCLK.value = 1;
  sim.run();
  assert.strictEqual(dLatch.state.Q, 1, 'Step c: Q becomes 1');
  assert.strictEqual(dLatch.state.Qbar, 0, 'Step c: Qbar becomes 0');
  assert.strictEqual(outQ.value, 1);
  assert.strictEqual(outQbar.value, 0);

  // Step d: CLK=1, D=0 -> Q=0 (transparent, passes D)
  inD.value = 0;
  sim.run();
  assert.strictEqual(dLatch.state.Q, 0, 'Step d: Q follows D to 0');
  assert.strictEqual(dLatch.state.Qbar, 1, 'Step d: Qbar follows to 1');

  // Step e: CLK=0, D=0 -> Q=0 (latches 0)
  inCLK.value = 0;
  sim.run();
  assert.strictEqual(dLatch.state.Q, 0, 'Step e: Q holds 0');
  assert.strictEqual(dLatch.state.Qbar, 1, 'Step e: Qbar holds 1');

  // Step f: CLK=0, D=1 -> Q=0 (holds 0 despite D=1)
  inD.value = 1;
  sim.run();
  assert.strictEqual(dLatch.state.Q, 0, 'Step f: Q remains 0 despite D=1 when CLK=0');
  assert.strictEqual(dLatch.state.Qbar, 1, 'Step f: Qbar remains 1');
});

// ----------------------------------------------------------------------------
// Test 13: D Latch Driving Downstream Combinational Logic
// ----------------------------------------------------------------------------
await runTest('D Latch driving downstream combinational gates (Q -> NOT -> Output)', () => {
  const circuit = new Circuit();
  const dLatch = circuit.addComponent(ComponentTypes.D_LATCH, 150, 150);
  const inD = circuit.addComponent(ComponentTypes.INPUT, 50, 130, null, 1);
  const inCLK = circuit.addComponent(ComponentTypes.INPUT, 50, 170, null, 1);
  const notGate = circuit.addComponent(ComponentTypes.NOT, 280, 150);
  const outComp = circuit.addComponent(ComponentTypes.OUTPUT, 380, 150);

  circuit.addConnection(inD.id, 'out0', dLatch.id, 'in_d');
  circuit.addConnection(inCLK.id, 'out0', dLatch.id, 'in_clk');
  circuit.addConnection(dLatch.id, 'out_q', notGate.id, 'in0');
  circuit.addConnection(notGate.id, 'out0', outComp.id, 'in0');

  const sim = new Simulator(circuit);
  sim.run();
  // Q=1 -> NOT gate output = 0 -> outComp.value = 0
  assert.strictEqual(dLatch.state.Q, 1);
  assert.strictEqual(notGate.value, 0);
  assert.strictEqual(outComp.value, 0);

  // Now change D to 0 while transparent
  inD.value = 0;
  sim.run();
  assert.strictEqual(dLatch.state.Q, 0);
  assert.strictEqual(notGate.value, 1);
  assert.strictEqual(outComp.value, 1);
});

// ----------------------------------------------------------------------------
// Test 14: Clock Component Properties & Bi-directional Sync
// ----------------------------------------------------------------------------
await runTest('Clock Properties and Frequency/Period/Duty Bi-directional Sync', () => {
  const circuit = new Circuit();
  const clock = circuit.addComponent(ComponentTypes.CLOCK, 100, 100);
  const sim = new Simulator(circuit);

  assert.strictEqual(clock.frequency, 1);
  assert.strictEqual(clock.period, 1000);
  assert.strictEqual(clock.dutyCycle, 50);

  // Sync: Change Frequency -> Updates Period
  sim.setClockFrequency(clock.id, 2);
  assert.strictEqual(clock.frequency, 2);
  assert.strictEqual(clock.period, 500);

  // Sync: Change Period -> Updates Frequency
  sim.setClockPeriod(clock.id, 250);
  assert.strictEqual(clock.period, 250);
  assert.strictEqual(clock.frequency, 4);

  // Duty cycle
  sim.setClockDutyCycle(clock.id, 75);
  assert.strictEqual(clock.dutyCycle, 75);

  // Manual Value Set
  sim.setClockValue(clock.id, 1);
  assert.strictEqual(clock.value, 1);
  sim.setClockValue(clock.id, 0);
  assert.strictEqual(clock.value, 0);
});

// ----------------------------------------------------------------------------
// Test 15: Manual Pulse: Exactly One Clock Cycle (0 -> 1 -> 0) and Stops
// ----------------------------------------------------------------------------
await runTest('Manual Pulse: Exactly One Clock Cycle (0 -> 1 -> 0) and Stops', async () => {
  const circuit = new Circuit();
  const clock = circuit.addComponent(ComponentTypes.CLOCK, 100, 100);
  const outComp = circuit.addComponent(ComponentTypes.OUTPUT, 250, 100);
  circuit.addConnection(clock.id, 'out0', outComp.id, 'in0');

  const sim = new Simulator(circuit);
  sim.setClockValue(clock.id, 0);
  assert.strictEqual(clock.value, 0, 'Initial CLK must be 0');
  assert.strictEqual(outComp.value, 0);

  // Trigger exactly one manual pulse (50ms duration)
  sim.triggerPulse(clock.id, 'HIGH', 50);

  // Immediately upon pulse: CLK transitions 0 -> 1
  assert.strictEqual(clock.value, 1, 'CLK must be 1 during pulse');
  assert.strictEqual(outComp.value, 1);
  assert.strictEqual(sim.isPulsing, true, 'Simulator is marked as pulsing');

  // Wait for pulse to finish + margin
  await new Promise(r => setTimeout(r, 80));

  // After pulse finishes: CLK transitions 1 -> 0 and STOPS
  assert.strictEqual(clock.value, 0, 'CLK must return to 0');
  assert.strictEqual(outComp.value, 0);
  assert.strictEqual(sim.isPulsing, false, 'Pulsing state ended');

  // Wait additional time to verify NO automatic pulses occur
  await new Promise(r => setTimeout(r, 60));
  assert.strictEqual(clock.value, 0, 'CLK must remain 0 with no continuous oscillation');

  sim.cleanup();
});

// ----------------------------------------------------------------------------
// Test 16: Stop Clock Freezes Signal and State
// ----------------------------------------------------------------------------
await runTest('Stop Clock Freezes Signal and State', async () => {
  const circuit = new Circuit();
  const clock = circuit.addComponent(ComponentTypes.CLOCK, 100, 100);
  const sim = new Simulator(circuit);
  sim.setClockValue(clock.id, 1);
  sim.stopClock(clock.id);

  const valBefore = clock.value;
  await new Promise(r => setTimeout(r, 50));
  assert.strictEqual(clock.value, valBefore, 'Clock value must remain constant when stopped');
  sim.cleanup();
});

// ----------------------------------------------------------------------------
// Test 17: HIGH Pulse Driving D Latch (Section 17)
// ----------------------------------------------------------------------------
await runTest('Clock HIGH Pulse Driving D Latch (Section 17: 0 -> 1 -> 0)', async () => {
  const circuit = new Circuit();
  const clock = circuit.addComponent(ComponentTypes.CLOCK, 100, 200);
  const inD = circuit.addComponent(ComponentTypes.INPUT, 100, 150, null, 1);
  const dLatch = circuit.addComponent(ComponentTypes.D_LATCH, 250, 180);
  const outQ = circuit.addComponent(ComponentTypes.OUTPUT, 400, 180);

  circuit.addConnection(clock.id, 'out0', dLatch.id, 'in_clk');
  circuit.addConnection(inD.id, 'out0', dLatch.id, 'in_d');
  circuit.addConnection(dLatch.id, 'out_q', outQ.id, 'in0');

  const sim = new Simulator(circuit);
  // Initial: Clock is stopped at 0. D=1. Latch is in hold with initial Q=0.
  sim.setClockValue(clock.id, 0);
  sim.run();
  assert.strictEqual(clock.value, 0);
  assert.strictEqual(dLatch.state.Q, 0, 'Before pulse: Q is 0 (held)');
  assert.strictEqual(outQ.value, 0);

  // Trigger HIGH Pulse of duration 60ms
  sim.triggerPulse(clock.id, 'HIGH', 60);

  // Immediately upon pulse start: clock is 1, dLatch becomes transparent, Q becomes 1
  assert.strictEqual(clock.value, 1, 'Clock should be 1 during pulse');
  assert.strictEqual(dLatch.state.Q, 1, 'D Latch Q should be 1 during transparent pulse');
  assert.strictEqual(outQ.value, 1);

  // Wait for pulse duration to elapse + extra margin
  await new Promise(r => setTimeout(r, 90));

  // Pulse has completed: clock should have reverted to 0!
  assert.strictEqual(clock.value, 0, 'Clock must revert back to 0 after pulse completes');
  assert.strictEqual(dLatch.state.Q, 1, 'D Latch Q must latch and remain 1 in hold mode');
  assert.strictEqual(outQ.value, 1);

  // Subsequent change to D=0 while clock=0 does NOT alter Q!
  inD.value = 0;
  sim.run();
  assert.strictEqual(dLatch.state.Q, 1, 'Q holds 1 despite D changing to 0');
  assert.strictEqual(outQ.value, 1);

  sim.cleanup();
});

// ----------------------------------------------------------------------------
// Test 18: LOW Pulse Driving D Latch (Section 18)
// ----------------------------------------------------------------------------
await runTest('Clock LOW Pulse Driving D Latch (Section 18: 1 -> 0 -> 1)', async () => {
  const circuit = new Circuit();
  const clock = circuit.addComponent(ComponentTypes.CLOCK, 100, 200);
  const inD = circuit.addComponent(ComponentTypes.INPUT, 100, 150, null, 1);
  const dLatch = circuit.addComponent(ComponentTypes.D_LATCH, 250, 180);
  const outQ = circuit.addComponent(ComponentTypes.OUTPUT, 400, 180);

  circuit.addConnection(clock.id, 'out0', dLatch.id, 'in_clk');
  circuit.addConnection(inD.id, 'out0', dLatch.id, 'in_d');
  circuit.addConnection(dLatch.id, 'out_q', outQ.id, 'in0');

  const sim = new Simulator(circuit);
  // Initial: Clock is 1 (HIGH). D=1. Latch is transparent -> Q=1.
  sim.setClockValue(clock.id, 1);
  sim.run();
  assert.strictEqual(clock.value, 1);
  assert.strictEqual(dLatch.state.Q, 1);

  // Trigger LOW Pulse of duration 60ms
  sim.triggerPulse(clock.id, 'LOW', 60);

  // Immediately upon pulse start: clock is 0 (LOW), dLatch is in HOLD mode with Q=1
  assert.strictEqual(clock.value, 0, 'Clock should be 0 during LOW pulse');
  assert.strictEqual(dLatch.state.Q, 1, 'D Latch Q remains 1');

  // While clock is 0 (in hold mode), toggle D to 0: Q must remain 1!
  inD.value = 0;
  sim.run();
  assert.strictEqual(dLatch.state.Q, 1, 'Q must remain 1 while clock is held low');

  // Wait for LOW pulse to elapse and revert
  await new Promise(r => setTimeout(r, 90));

  // Pulse completed: clock has reverted to 1 (HIGH).
  // Now latch is transparent again and sees current D=0 -> Q becomes 0!
  assert.strictEqual(clock.value, 1, 'Clock must revert back to 1');
  assert.strictEqual(dLatch.state.Q, 0, 'D Latch Q updates to current D=0 once transparent');
  assert.strictEqual(outQ.value, 0);

  sim.cleanup();
});

// ----------------------------------------------------------------------------
// Test 19: pulseAllClocks and Concurrent Click Guarding
// ----------------------------------------------------------------------------
await runTest('pulseAllClocks and Concurrent Click Guarding', async () => {
  const circuit = new Circuit();
  const c1 = circuit.addComponent(ComponentTypes.CLOCK, 100, 100);
  const c2 = circuit.addComponent(ComponentTypes.CLOCK, 100, 200);

  const sim = new Simulator(circuit);
  sim.setClockValue(c1.id, 0);
  sim.setClockValue(c2.id, 0);

  // Trigger pulse on all clocks simultaneously (50ms)
  const pulsePromise = sim.pulseAllClocks(50);
  assert.strictEqual(c1.value, 1, 'c1 should be 1 during pulse');
  assert.strictEqual(c2.value, 1, 'c2 should be 1 during pulse');
  assert.strictEqual(sim.isPulsing, true, 'isPulsing is true');

  // Attempt rapid second click while pulse is active: must be rejected!
  const rejectedTrigger = await sim.pulseAllClocks(50);
  assert.strictEqual(rejectedTrigger, false, 'Concurrent pulse request while active must return false');

  await pulsePromise;

  // After completion: both clocks are 0, simulator is ready for next pulse
  assert.strictEqual(c1.value, 0, 'c1 returns to 0');
  assert.strictEqual(c2.value, 0, 'c2 returns to 0');
  assert.strictEqual(sim.isPulsing, false, 'isPulsing is false after finish');

  sim.cleanup();
});

// ----------------------------------------------------------------------------
// Test 20: Reset Simulation (preserves wiring, stops clocks, clears latch state)
// ----------------------------------------------------------------------------
await runTest('Reset Simulation preserves topology and resets sequential states', () => {
  const circuit = new Circuit();
  const clock = circuit.addComponent(ComponentTypes.CLOCK, 100, 100);
  const dLatch = circuit.addComponent(ComponentTypes.D_LATCH, 250, 100);
  const srLatch = circuit.addComponent(ComponentTypes.SR_LATCH, 250, 250);
  const outQ = circuit.addComponent(ComponentTypes.OUTPUT, 400, 100);

  circuit.addConnection(clock.id, 'out0', dLatch.id, 'in_clk');
  circuit.addConnection(dLatch.id, 'out_q', outQ.id, 'in0');

  dLatch.state = { Q: 1, Qbar: 0 };
  srLatch.state = { Q: 1, Qbar: 0, invalid: true };
  clock.running = true;

  const sim = new Simulator(circuit);
  sim.resetSimulation();

  // Topology preserved
  assert.strictEqual(circuit.components.size, 4);
  assert.strictEqual(circuit.connections.length, 2);

  // Clock stopped
  assert.strictEqual(clock.running, false);

  // Latches reset to default Q=0, Qbar=1
  assert.strictEqual(dLatch.state.Q, 0);
  assert.strictEqual(dLatch.state.Qbar, 1);
  assert.strictEqual(srLatch.state.Q, 0);
  assert.strictEqual(srLatch.state.Qbar, 1);
  assert.strictEqual(srLatch.state.invalid, false);

  sim.cleanup();
});

// ----------------------------------------------------------------------------
// Test 21: Serialization & Deserialization Round-trip
// ----------------------------------------------------------------------------
await runTest('Serialization & Deserialization preserves sequential state & clock config', () => {
  const circuit = new Circuit();
  const clock = circuit.addComponent(ComponentTypes.CLOCK, 100, 100);
  clock.frequency = 5;
  clock.period = 200;
  clock.dutyCycle = 60;
  clock.pulseType = 'LOW';
  clock.pulseDuration = 150;

  const dLatch = circuit.addComponent(ComponentTypes.D_LATCH, 250, 100);
  dLatch.state = { Q: 1, Qbar: 0 };

  const srLatch = circuit.addComponent(ComponentTypes.SR_LATCH, 250, 250);
  srLatch.state = { Q: 0, Qbar: 1, invalid: false };

  circuit.addConnection(clock.id, 'out0', dLatch.id, 'in_clk');

  const json = circuit.toJSON();
  const jsonStr = JSON.stringify(json);

  const restoredCircuit = new Circuit();
  const parsed = migrateCircuitData(JSON.parse(jsonStr));
  restoredCircuit.fromJSON(parsed);

  const rClock = restoredCircuit.components.get(clock.id);
  assert.ok(rClock, 'Restored clock must exist');
  assert.strictEqual(rClock.frequency, 5);
  assert.strictEqual(rClock.period, 200);
  assert.strictEqual(rClock.dutyCycle, 60);
  assert.strictEqual(rClock.pulseType, 'LOW');
  assert.strictEqual(rClock.pulseDuration, 150);

  const rDLatch = restoredCircuit.components.get(dLatch.id);
  assert.ok(rDLatch, 'Restored D Latch must exist');
  assert.strictEqual(rDLatch.state.Q, 1);
  assert.strictEqual(rDLatch.state.Qbar, 0);

  const rSRLatch = restoredCircuit.components.get(srLatch.id);
  assert.ok(rSRLatch, 'Restored SR Latch must exist');
  assert.strictEqual(rSRLatch.state.Q, 0);
  assert.strictEqual(rSRLatch.state.Qbar, 1);
});

// ----------------------------------------------------------------------------
// Test 22: Truth Table Generator Sequential Circuit Detection
// ----------------------------------------------------------------------------
await runTest('Truth Table Generator identifies sequential circuits and advises user', () => {
  const circuit = new Circuit();
  const inD = circuit.addComponent(ComponentTypes.INPUT, 50, 100);
  const dLatch = circuit.addComponent(ComponentTypes.D_LATCH, 200, 100);
  const outQ = circuit.addComponent(ComponentTypes.OUTPUT, 350, 100);

  circuit.addConnection(inD.id, 'out0', dLatch.id, 'in_d');
  circuit.addConnection(dLatch.id, 'out_q', outQ.id, 'in0');

  const html = generateTruthTable(circuit, 'binary');
  assert.ok(html.includes('Sequential circuit: truth table depends on previous state.'), 'Must return sequential notice');

  // Contrast with pure combinational circuit
  const combCircuit = new Circuit();
  const cIn1 = combCircuit.addComponent(ComponentTypes.INPUT, 50, 50);
  const cIn2 = combCircuit.addComponent(ComponentTypes.INPUT, 50, 100);
  const cAnd = combCircuit.addComponent(ComponentTypes.AND, 200, 75);
  const cOut = combCircuit.addComponent(ComponentTypes.OUTPUT, 350, 75);

  combCircuit.addConnection(cIn1.id, 'out0', cAnd.id, 'in0');
  combCircuit.addConnection(cIn2.id, 'out0', cAnd.id, 'in1');
  combCircuit.addConnection(cAnd.id, 'out0', cOut.id, 'in0');

  const combHtml = generateTruthTable(combCircuit, 'binary');
  assert.ok(!combHtml.includes('Sequential circuit'), 'Combinational circuit should not show sequential notice');
  assert.ok(combHtml.includes('<table') || combHtml.includes('Boolean Logic Expression'), 'Should produce truth table or equations');
});

// ----------------------------------------------------------------------------
// Test 23: Combinational Backward Compatibility & Cycle Breaking
// ----------------------------------------------------------------------------
await runTest('Iterative Fixed-Point Propagation: Combinational Accuracy and Loop Guard', () => {
  const circuit = new Circuit();
  // Combinational Inverter Loop (NOT -> NOT self loop or single NOT gate loop)
  const notGate = circuit.addComponent(ComponentTypes.NOT, 100, 100);
  circuit.addConnection(notGate.id, 'out0', notGate.id, 'in0');

  const sim = new Simulator(circuit);
  // Propagation should detect cycle or hit MAX_PASSES without freezing the process
  const res = sim.run();
  assert.ok(res !== undefined);
  sim.cleanup();
});

// ----------------------------------------------------------------------------
// Test 24: Clock Dual Outputs (One is HIGH, Other is LOW at All Times)
// ----------------------------------------------------------------------------
await runTest('Clock Dual Outputs: One is HIGH and other is LOW (CLK and CLK_bar)', () => {
  const circuit = new Circuit();
  const clock = circuit.addComponent(ComponentTypes.CLOCK, 100, 100);
  const outLightClk = circuit.addComponent(ComponentTypes.OUTPUT, 250, 80);
  const outLightNclk = circuit.addComponent(ComponentTypes.OUTPUT, 250, 120);

  circuit.addConnection(clock.id, 'out0', outLightClk.id, 'in0');
  circuit.addConnection(clock.id, 'out_nclk', outLightNclk.id, 'in0');

  const sim = new Simulator(circuit);

  // When Clock is 0 (idle / LOW):
  sim.setClockValue(clock.id, 0);
  sim.run();
  assert.strictEqual(outLightClk.value, 0, 'CLK output must be 0 (LOW) when idle');
  assert.strictEqual(outLightNclk.value, 1, 'CLK_bar output must be 1 (HIGH) when idle');

  // When Clock is 1 (active / HIGH):
  sim.setClockValue(clock.id, 1);
  sim.run();
  assert.strictEqual(outLightClk.value, 1, 'CLK output must be 1 (HIGH) when active');
  assert.strictEqual(outLightNclk.value, 0, 'CLK_bar output must be 0 (LOW) when active');

  sim.cleanup();
});

// ----------------------------------------------------------------------------
// Test 25: Manual Press Button Triggers Exactly One Pulse (Not Continuous)
// ----------------------------------------------------------------------------
await runTest('Manual Press Button Triggers Exactly One Pulse (Not Continuous)', async () => {
  const circuit = new Circuit();
  const clock = circuit.addComponent(ComponentTypes.CLOCK, 100, 100);
  const outClk = circuit.addComponent(ComponentTypes.OUTPUT, 250, 80);
  const outNclk = circuit.addComponent(ComponentTypes.OUTPUT, 250, 120);

  circuit.addConnection(clock.id, 'out0', outClk.id, 'in0');
  circuit.addConnection(clock.id, 'out_nclk', outNclk.id, 'in0');

  const sim = new Simulator(circuit);
  sim.setClockValue(clock.id, 0);
  assert.strictEqual(clock.running, false, 'Clock must not be continuously running');

  // Trigger one manual pulse (50ms)
  sim.triggerPulse(clock.id, 'HIGH', 50);

  // During pulse: CLK = 1, CLK_bar = 0
  assert.strictEqual(clock.value, 1);
  assert.strictEqual(outClk.value, 1);
  assert.strictEqual(outNclk.value, 0);

  // Wait for pulse duration to elapse + small margin
  await new Promise(r => setTimeout(r, 80));

  // After pulse finishes: returns to 0 and STOPS (no continuous oscillation)
  assert.strictEqual(clock.value, 0, 'Clock must revert back to 0');
  assert.strictEqual(outClk.value, 0, 'outClk must revert back to 0');
  assert.strictEqual(outNclk.value, 1, 'outNclk must revert back to 1');
  assert.strictEqual(clock.running, false, 'Clock must remain stopped and NOT oscillate');

  // Wait another 60ms to verify it stays stopped
  await new Promise(r => setTimeout(r, 60));
  assert.strictEqual(clock.value, 0, 'Clock must remain 0 and not toggle');

  sim.cleanup();
});

// ----------------------------------------------------------------------------
// Test 26: Clock Left-Click Triggers Pulse Without Selecting; Right-Click Selects for Move/Delete
// ----------------------------------------------------------------------------
await runTest('Clock Left-Click Triggers Pulse Without Selecting; Right-Click Selects for Move/Delete', async () => {
  const circuit = new Circuit();
  const clock = circuit.addComponent(ComponentTypes.CLOCK, 100, 100);
  const sim = new Simulator(circuit);
  const history = new HistoryManager(circuit);
  let toastMsg = '';
  let showMenuCalled = false;
  const uiCallbacks = {
    onSelectionChanged: () => {},
    onMouseCoords: () => {},
    onZoomChanged: () => {},
    onToast: (msg) => { toastMsg = msg; },
    onHideContextMenu: () => {},
    onShowContextMenu: () => { showMenuCalled = true; },
    onOpenLogicPanel: () => {},
    onSetExprInput: () => {}
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

  const interaction = new InteractionHandler(circuit, sim, mockRenderer, history, {}, uiCallbacks);
  interaction.clearSelection();

  const mockClockTarget = {
    closest: (selector) => {
      if (selector === '.component-group') {
        return { getAttribute: (attr) => attr === 'data-id' ? clock.id : null };
      }
      return null;
    }
  };

  // 1. LEFT CLICK on Clock:
  // Must NOT select the clock! Must trigger the pulse functionality!
  interaction.onPointerDown({
    preventDefault: () => {},
    stopPropagation: () => {},
    clientX: 100,
    clientY: 100,
    button: 0,
    target: mockClockTarget
  });

  assert.strictEqual(interaction.selectedCompIds.has(clock.id), false, 'Left-click must NOT select Clock');
  assert.strictEqual(clock.value, 1, 'Left-click must trigger Clock pulse (CLK=1)');
  assert.strictEqual(sim.isPulsing, true, 'Simulator is actively pulsing');

  // Wait for pulse to finish
  await new Promise(r => setTimeout(r, 220));
  assert.strictEqual(clock.value, 0, 'Clock reverts to 0 after pulse');

  // 2. RIGHT CLICK on Clock:
  // Must select the clock for move, delete or other!
  interaction.onContextMenu({
    preventDefault: () => {},
    clientX: 100,
    clientY: 100,
    target: mockClockTarget
  });

  assert.strictEqual(interaction.selectedCompIds.has(clock.id), true, 'Right-click MUST select Clock');
  assert.strictEqual(showMenuCalled, true, 'Right-click must show context menu');

  // 3. While selected, user can drag to move the clock:
  interaction.onPointerDown({
    preventDefault: () => {},
    stopPropagation: () => {},
    clientX: 100,
    clientY: 100,
    button: 0,
    target: mockClockTarget
  });

  interaction.onPointerMove({
    clientX: 150,
    clientY: 120
  });

  interaction.onPointerUp({
    clientX: 150,
    clientY: 120,
    target: mockClockTarget
  });

  assert.strictEqual(clock.x, 150, 'Clock x position must move');
  assert.strictEqual(clock.y, 120, 'Clock y position must move');

  // 4. Delete the selected clock:
  interaction.deleteSelected();
  assert.strictEqual(circuit.components.has(clock.id), false, 'Selected clock can be deleted');

  sim.cleanup();
});

// ----------------------------------------------------------------------------
// Test 27: JK Flip-Flop HOLD Condition (J=0, K=0)
// ----------------------------------------------------------------------------
await runTest('JK Flip-Flop - HOLD condition (J=0, K=0 retains state on clock pulses)', () => {
  const circuit = new Circuit();
  const jk = circuit.addComponent(ComponentTypes.JK_FLIPFLOP, 200, 200);
  const inJ = circuit.addComponent(ComponentTypes.INPUT, 50, 150, null, 0);
  const inK = circuit.addComponent(ComponentTypes.INPUT, 50, 250, null, 0);
  const clock = circuit.addComponent(ComponentTypes.CLOCK, 50, 200);
  const outQ = circuit.addComponent(ComponentTypes.OUTPUT, 350, 180);
  const outQbar = circuit.addComponent(ComponentTypes.OUTPUT, 350, 220);

  circuit.addConnection(inJ.id, 'out0', jk.id, 'in_j');
  circuit.addConnection(inK.id, 'out0', jk.id, 'in_k');
  circuit.addConnection(clock.id, 'out0', jk.id, 'in_clk');
  circuit.addConnection(jk.id, 'out_q', outQ.id, 'in0');
  circuit.addConnection(jk.id, 'out_qbar', outQbar.id, 'in0');

  const sim = new Simulator(circuit);
  sim.run();

  // Initial state Q=0, Qbar=1
  assert.strictEqual(jk.state.Q, 0, 'Initial Q=0');
  assert.strictEqual(jk.state.Qbar, 1, 'Initial Qbar=1');
  assert.strictEqual(outQ.value, 0);
  assert.strictEqual(outQbar.value, 1);

  // Pulse 1 with J=0, K=0 -> holds 0
  sim.pulseClockSync(clock.id);
  assert.strictEqual(jk.state.Q, 0, 'After pulse 1: Q holds 0');
  assert.strictEqual(jk.state.Qbar, 1, 'After pulse 1: Qbar holds 1');

  // Pulse 2 with J=0, K=0 -> holds 0
  sim.pulseClockSync(clock.id);
  assert.strictEqual(jk.state.Q, 0, 'After pulse 2: Q holds 0');

  // Set Q to 1: J=1, K=0
  inJ.value = 1;
  inK.value = 0;
  sim.pulseClockSync(clock.id);
  assert.strictEqual(jk.state.Q, 1, 'After setting: Q=1');
  assert.strictEqual(jk.state.Qbar, 0, 'After setting: Qbar=0');

  // Now HOLD 1: J=0, K=0
  inJ.value = 0;
  inK.value = 0;
  sim.pulseClockSync(clock.id);
  assert.strictEqual(jk.state.Q, 1, 'After pulse with J=0, K=0: Q holds 1');
  assert.strictEqual(jk.state.Qbar, 0, 'After pulse with J=0, K=0: Qbar holds 0');

  sim.pulseClockSync(clock.id);
  assert.strictEqual(jk.state.Q, 1, 'Consecutive pulse with J=0, K=0: Q still holds 1');
});

// ----------------------------------------------------------------------------
// Test 28: JK Flip-Flop SET Condition (J=1, K=0)
// ----------------------------------------------------------------------------
await runTest('JK Flip-Flop - SET condition (J=1, K=0 sets Q=1, Qbar=0)', () => {
  const circuit = new Circuit();
  const jk = circuit.addComponent(ComponentTypes.JK_FLIPFLOP, 200, 200);
  const inJ = circuit.addComponent(ComponentTypes.INPUT, 50, 150, null, 1);
  const inK = circuit.addComponent(ComponentTypes.INPUT, 50, 250, null, 0);
  const clock = circuit.addComponent(ComponentTypes.CLOCK, 50, 200);
  const outQ = circuit.addComponent(ComponentTypes.OUTPUT, 350, 180);
  const outQbar = circuit.addComponent(ComponentTypes.OUTPUT, 350, 220);

  circuit.addConnection(inJ.id, 'out0', jk.id, 'in_j');
  circuit.addConnection(inK.id, 'out0', jk.id, 'in_k');
  circuit.addConnection(clock.id, 'out0', jk.id, 'in_clk');
  circuit.addConnection(jk.id, 'out_q', outQ.id, 'in0');
  circuit.addConnection(jk.id, 'out_qbar', outQbar.id, 'in0');

  const sim = new Simulator(circuit);
  sim.run();

  assert.strictEqual(jk.state.Q, 0, 'Initial Q=0 before clock pulse');

  // Clock pulse triggers SET
  sim.pulseClockSync(clock.id);
  assert.strictEqual(jk.state.Q, 1, 'After pulse: Q=1');
  assert.strictEqual(jk.state.Qbar, 0, 'After pulse: Qbar=0');
  assert.strictEqual(outQ.value, 1);
  assert.strictEqual(outQbar.value, 0);

  // Subsequent pulses with J=1, K=0 keep Q=1
  sim.pulseClockSync(clock.id);
  assert.strictEqual(jk.state.Q, 1, 'Subsequent pulse: Q remains 1');
  assert.strictEqual(jk.state.Qbar, 0, 'Subsequent pulse: Qbar remains 0');
});

// ----------------------------------------------------------------------------
// Test 29: JK Flip-Flop RESET Condition (J=0, K=1)
// ----------------------------------------------------------------------------
await runTest('JK Flip-Flop - RESET condition (J=0, K=1 resets Q=0, Qbar=1)', () => {
  const circuit = new Circuit();
  const jk = circuit.addComponent(ComponentTypes.JK_FLIPFLOP, 200, 200);
  const inJ = circuit.addComponent(ComponentTypes.INPUT, 50, 150, null, 1);
  const inK = circuit.addComponent(ComponentTypes.INPUT, 50, 250, null, 0);
  const clock = circuit.addComponent(ComponentTypes.CLOCK, 50, 200);
  const outQ = circuit.addComponent(ComponentTypes.OUTPUT, 350, 180);
  const outQbar = circuit.addComponent(ComponentTypes.OUTPUT, 350, 220);

  circuit.addConnection(inJ.id, 'out0', jk.id, 'in_j');
  circuit.addConnection(inK.id, 'out0', jk.id, 'in_k');
  circuit.addConnection(clock.id, 'out0', jk.id, 'in_clk');
  circuit.addConnection(jk.id, 'out_q', outQ.id, 'in0');
  circuit.addConnection(jk.id, 'out_qbar', outQbar.id, 'in0');

  const sim = new Simulator(circuit);
  sim.run();

  // First set to 1
  sim.pulseClockSync(clock.id);
  assert.strictEqual(jk.state.Q, 1, 'Set Q=1');

  // Now configure for RESET: J=0, K=1
  inJ.value = 0;
  inK.value = 1;

  // Pulse clock -> resets to 0
  sim.pulseClockSync(clock.id);
  assert.strictEqual(jk.state.Q, 0, 'After reset pulse: Q=0');
  assert.strictEqual(jk.state.Qbar, 1, 'After reset pulse: Qbar=1');
  assert.strictEqual(outQ.value, 0);
  assert.strictEqual(outQbar.value, 1);

  // Subsequent pulses keep Q=0
  sim.pulseClockSync(clock.id);
  assert.strictEqual(jk.state.Q, 0, 'Subsequent reset pulse: Q remains 0');
});

// ----------------------------------------------------------------------------
// Test 30: JK Flip-Flop TOGGLE Condition (J=1, K=1 across 4 pulses)
// ----------------------------------------------------------------------------
await runTest('JK Flip-Flop - TOGGLE condition (J=1, K=1 toggles 0->1->0->1->0)', () => {
  const circuit = new Circuit();
  const jk = circuit.addComponent(ComponentTypes.JK_FLIPFLOP, 200, 200);
  const inJ = circuit.addComponent(ComponentTypes.INPUT, 50, 150, null, 1);
  const inK = circuit.addComponent(ComponentTypes.INPUT, 50, 250, null, 1);
  const clock = circuit.addComponent(ComponentTypes.CLOCK, 50, 200);
  const outQ = circuit.addComponent(ComponentTypes.OUTPUT, 350, 180);

  circuit.addConnection(inJ.id, 'out0', jk.id, 'in_j');
  circuit.addConnection(inK.id, 'out0', jk.id, 'in_k');
  circuit.addConnection(clock.id, 'out0', jk.id, 'in_clk');
  circuit.addConnection(jk.id, 'out_q', outQ.id, 'in0');

  const sim = new Simulator(circuit);
  sim.run();

  assert.strictEqual(jk.state.Q, 0, 'Initial state: Q=0');

  // Pulse 1: 0 -> 1
  sim.pulseClockSync(clock.id);
  assert.strictEqual(jk.state.Q, 1, 'Pulse 1: Q toggles 0 -> 1');
  assert.strictEqual(outQ.value, 1);

  // Pulse 2: 1 -> 0
  sim.pulseClockSync(clock.id);
  assert.strictEqual(jk.state.Q, 0, 'Pulse 2: Q toggles 1 -> 0');
  assert.strictEqual(outQ.value, 0);

  // Pulse 3: 0 -> 1
  sim.pulseClockSync(clock.id);
  assert.strictEqual(jk.state.Q, 1, 'Pulse 3: Q toggles 0 -> 1');
  assert.strictEqual(outQ.value, 1);

  // Pulse 4: 1 -> 0
  sim.pulseClockSync(clock.id);
  assert.strictEqual(jk.state.Q, 0, 'Pulse 4: Q toggles 1 -> 0');
  assert.strictEqual(outQ.value, 0);
});

// ----------------------------------------------------------------------------
// Test 31: JK Flip-Flop No Double Toggle on Single Pulse (Race-Around Prevention)
// ----------------------------------------------------------------------------
await runTest('JK Flip-Flop - Race-Around Prevention (Single pulse 0->1->0 produces exactly ONE toggle)', () => {
  const circuit = new Circuit();
  const jk = circuit.addComponent(ComponentTypes.JK_FLIPFLOP, 200, 200);
  const inJ = circuit.addComponent(ComponentTypes.INPUT, 50, 150, null, 1);
  const inK = circuit.addComponent(ComponentTypes.INPUT, 50, 250, null, 1);
  const clock = circuit.addComponent(ComponentTypes.CLOCK, 50, 200);

  circuit.addConnection(inJ.id, 'out0', jk.id, 'in_j');
  circuit.addConnection(inK.id, 'out0', jk.id, 'in_k');
  circuit.addConnection(clock.id, 'out0', jk.id, 'in_clk');

  const sim = new Simulator(circuit);
  sim.run();

  assert.strictEqual(jk.state.Q, 0, 'Initial state: Q=0');

  // Phase A: CLK transitions 0 -> 1 (Rising edge)
  sim.stepClock(clock.id, 1);
  assert.strictEqual(jk.state.Q, 1, 'On rising edge (0->1): Q toggles 0 -> 1');

  // Additional evaluation while CLK remains 1
  sim.run();
  assert.strictEqual(jk.state.Q, 1, 'While CLK=1: Q MUST NOT toggle again (no race-around)');

  // Phase B: CLK transitions 1 -> 0 (Falling edge)
  sim.stepClock(clock.id, 0);
  assert.strictEqual(jk.state.Q, 1, 'On falling edge (1->0): Rising-edge FF MUST NOT toggle again');

  // Additional evaluation while CLK remains 0
  sim.run();
  assert.strictEqual(jk.state.Q, 1, 'While CLK=0: Q remains 1');

  // Test Falling-Edge Triggered Configuration
  jk.trigger = 'falling';
  jk._prevClk = 0;

  // CLK 0 -> 1: Falling-edge FF should NOT trigger
  sim.stepClock(clock.id, 1);
  assert.strictEqual(jk.state.Q, 1, 'Falling-edge FF does NOT trigger on rising edge');

  // CLK 1 -> 0: Falling-edge triggers toggle (1 -> 0)
  sim.stepClock(clock.id, 0);
  assert.strictEqual(jk.state.Q, 0, 'Falling-edge FF triggers on 1->0 edge: Q toggles 1 -> 0');
});

// ----------------------------------------------------------------------------
// Test 32: D Flip-Flop Edge-Triggered Behavior & Static Invariance
// ----------------------------------------------------------------------------
await runTest('D Flip-Flop - Edge-triggered sampling (D updates only on clock edge; static D changes ignored)', () => {
  const circuit = new Circuit();
  const dff = circuit.addComponent(ComponentTypes.D_FLIPFLOP, 200, 200);
  const inD = circuit.addComponent(ComponentTypes.INPUT, 50, 150, null, 0);
  const clock = circuit.addComponent(ComponentTypes.CLOCK, 50, 220);
  const outQ = circuit.addComponent(ComponentTypes.OUTPUT, 350, 180);
  const outQbar = circuit.addComponent(ComponentTypes.OUTPUT, 350, 220);

  circuit.addConnection(inD.id, 'out0', dff.id, 'in_d');
  circuit.addConnection(clock.id, 'out0', dff.id, 'in_clk');
  circuit.addConnection(dff.id, 'out_q', outQ.id, 'in0');
  circuit.addConnection(dff.id, 'out_qbar', outQbar.id, 'in0');

  const sim = new Simulator(circuit);
  sim.run();

  assert.strictEqual(dff.state.Q, 0, 'Initial Q=0');

  // Change D to 1 WITHOUT clock pulse -> Q MUST remain 0 (edge-triggered, not transparent)
  inD.value = 1;
  sim.run();
  assert.strictEqual(dff.state.Q, 0, 'Static D change (0->1) with no clock edge does NOT change Q');
  assert.strictEqual(outQ.value, 0);

  // Pulse clock -> Q latches D=1
  sim.pulseClockSync(clock.id);
  assert.strictEqual(dff.state.Q, 1, 'After clock pulse: Q captures D=1');
  assert.strictEqual(dff.state.Qbar, 0, 'Qbar becomes 0');
  assert.strictEqual(outQ.value, 1);
  assert.strictEqual(outQbar.value, 0);

  // Change D to 0 WITHOUT clock pulse -> Q MUST remain 1
  inD.value = 0;
  sim.run();
  assert.strictEqual(dff.state.Q, 1, 'Static D change (1->0) with no clock edge does NOT change Q');

  // Pulse clock -> Q latches D=0
  sim.pulseClockSync(clock.id);
  assert.strictEqual(dff.state.Q, 0, 'After clock pulse: Q captures D=0');
  assert.strictEqual(dff.state.Qbar, 1, 'Qbar becomes 1');

  // Verify static D change while Clock is held HIGH (D-FF does NOT behave like transparent D-Latch)
  sim.stepClock(clock.id, 1);
  assert.strictEqual(dff.state.Q, 0);
  inD.value = 1;
  sim.run();
  assert.strictEqual(dff.state.Q, 0, 'While CLK=1, D changing to 1 does NOT pass through (not transparent)');
  sim.stepClock(clock.id, 0);
  assert.strictEqual(dff.state.Q, 0);

  // Next pulse captures D=1
  sim.pulseClockSync(clock.id);
  assert.strictEqual(dff.state.Q, 1, 'Next pulse captures D=1');
});

// ----------------------------------------------------------------------------
// Test 33: T Flip-Flop Behavior (Toggle on T=1, Hold on T=0)
// ----------------------------------------------------------------------------
await runTest('T Flip-Flop - Toggle on T=1, Hold on T=0', () => {
  const circuit = new Circuit();
  const tff = circuit.addComponent(ComponentTypes.T_FLIPFLOP, 200, 200);
  const inT = circuit.addComponent(ComponentTypes.INPUT, 50, 150, null, 1);
  const clock = circuit.addComponent(ComponentTypes.CLOCK, 50, 220);
  const outQ = circuit.addComponent(ComponentTypes.OUTPUT, 350, 180);

  circuit.addConnection(inT.id, 'out0', tff.id, 'in_t');
  circuit.addConnection(clock.id, 'out0', tff.id, 'in_clk');
  circuit.addConnection(tff.id, 'out_q', outQ.id, 'in0');

  const sim = new Simulator(circuit);
  sim.run();

  assert.strictEqual(tff.state.Q, 0, 'Initial Q=0');

  // Pulse 1 with T=1: Q toggles 0 -> 1
  sim.pulseClockSync(clock.id);
  assert.strictEqual(tff.state.Q, 1, 'Pulse 1: Q toggles 0 -> 1');
  assert.strictEqual(outQ.value, 1);

  // Pulse 2 with T=1: Q toggles 1 -> 0
  sim.pulseClockSync(clock.id);
  assert.strictEqual(tff.state.Q, 0, 'Pulse 2: Q toggles 1 -> 0');

  // Set T=0: Hold mode
  inT.value = 0;
  sim.pulseClockSync(clock.id);
  assert.strictEqual(tff.state.Q, 0, 'Pulse with T=0: Q holds 0');

  sim.pulseClockSync(clock.id);
  assert.strictEqual(tff.state.Q, 0, 'Second pulse with T=0: Q still holds 0');

  // Set T=1: Toggle to 1
  inT.value = 1;
  sim.pulseClockSync(clock.id);
  assert.strictEqual(tff.state.Q, 1, 'Pulse with T=1: Q toggles 0 -> 1');

  // Set T=0: Hold 1
  inT.value = 0;
  sim.pulseClockSync(clock.id);
  assert.strictEqual(tff.state.Q, 1, 'Pulse with T=0: Q holds 1');
});

// ----------------------------------------------------------------------------
// Test 34: Cascaded Flip-Flops (Shift Register - Pre-Edge State Snapshotting)
// ----------------------------------------------------------------------------
await runTest('Cascaded Flip-Flops - Synchronous Shift Register (Pre-edge snapshotting prevents single-pulse ripple)', () => {
  const circuit = new Circuit();
  const ff1 = circuit.addComponent(ComponentTypes.D_FLIPFLOP, 150, 200);
  const ff2 = circuit.addComponent(ComponentTypes.D_FLIPFLOP, 300, 200);
  const ff3 = circuit.addComponent(ComponentTypes.D_FLIPFLOP, 450, 200);
  const clock = circuit.addComponent(ComponentTypes.CLOCK, 50, 320);
  const inData = circuit.addComponent(ComponentTypes.INPUT, 50, 180, null, 1);

  // Shift register connections: inData -> FF1 -> FF2 -> FF3
  circuit.addConnection(inData.id, 'out0', ff1.id, 'in_d');
  circuit.addConnection(ff1.id, 'out_q', ff2.id, 'in_d');
  circuit.addConnection(ff2.id, 'out_q', ff3.id, 'in_d');

  // Common clock bus
  circuit.addConnection(clock.id, 'out0', ff1.id, 'in_clk');
  circuit.addConnection(clock.id, 'out0', ff2.id, 'in_clk');
  circuit.addConnection(clock.id, 'out0', ff3.id, 'in_clk');

  const sim = new Simulator(circuit);
  sim.run();

  assert.strictEqual(ff1.state.Q, 0, 'Initial FF1.Q = 0');
  assert.strictEqual(ff2.state.Q, 0, 'Initial FF2.Q = 0');
  assert.strictEqual(ff3.state.Q, 0, 'Initial FF3.Q = 0');

  // Pulse 1: inData=1 shifts into FF1.
  // CRITICAL: FF2 MUST sample FF1's PRE-EDGE state (0), NOT FF1's new state!
  sim.pulseClockSync(clock.id);
  assert.strictEqual(ff1.state.Q, 1, 'Pulse 1: FF1.Q captures 1');
  assert.strictEqual(ff2.state.Q, 0, 'Pulse 1: FF2.Q sampled old FF1.Q (0)');
  assert.strictEqual(ff3.state.Q, 0, 'Pulse 1: FF3.Q sampled old FF2.Q (0)');

  // Change input data to 0
  inData.value = 0;

  // Pulse 2: 0 shifts into FF1, 1 shifts into FF2, 0 into FF3
  sim.pulseClockSync(clock.id);
  assert.strictEqual(ff1.state.Q, 0, 'Pulse 2: FF1.Q captures 0');
  assert.strictEqual(ff2.state.Q, 1, 'Pulse 2: FF2.Q captures previous FF1.Q (1)');
  assert.strictEqual(ff3.state.Q, 0, 'Pulse 2: FF3.Q sampled old FF2.Q (0)');

  // Pulse 3: 0 into FF1, 0 into FF2, 1 into FF3
  sim.pulseClockSync(clock.id);
  assert.strictEqual(ff1.state.Q, 0, 'Pulse 3: FF1.Q = 0');
  assert.strictEqual(ff2.state.Q, 0, 'Pulse 3: FF2.Q = 0');
  assert.strictEqual(ff3.state.Q, 1, 'Pulse 3: FF3.Q captures previous FF2.Q (1)');

  // Pulse 4: 0 into FF3 -> all 0
  sim.pulseClockSync(clock.id);
  assert.strictEqual(ff1.state.Q, 0, 'Pulse 4: FF1.Q = 0');
  assert.strictEqual(ff2.state.Q, 0, 'Pulse 4: FF2.Q = 0');
  assert.strictEqual(ff3.state.Q, 0, 'Pulse 4: FF3.Q = 0');
});

// ----------------------------------------------------------------------------
// Test 35: Multi-Bit Register (4-Bit Parallel Load)
// ----------------------------------------------------------------------------
await runTest('Multi-Bit Register - 4-bit parallel capture on clock edge', () => {
  const circuit = new Circuit();
  const clock = circuit.addComponent(ComponentTypes.CLOCK, 50, 300);

  const dFFs = [];
  const inputs = [];
  const outputs = [];
  const testPattern = [1, 0, 1, 1]; // 4-bit word

  for (let i = 0; i < 4; i++) {
    const dff = circuit.addComponent(ComponentTypes.D_FLIPFLOP, 200, 100 + i * 80);
    const inp = circuit.addComponent(ComponentTypes.INPUT, 50, 100 + i * 80, null, testPattern[i]);
    const out = circuit.addComponent(ComponentTypes.OUTPUT, 350, 100 + i * 80);

    circuit.addConnection(inp.id, 'out0', dff.id, 'in_d');
    circuit.addConnection(clock.id, 'out0', dff.id, 'in_clk');
    circuit.addConnection(dff.id, 'out_q', out.id, 'in0');

    dFFs.push(dff);
    inputs.push(inp);
    outputs.push(out);
  }

  const sim = new Simulator(circuit);
  sim.run();

  // Before pulse, all register bits are 0
  for (let i = 0; i < 4; i++) {
    assert.strictEqual(dFFs[i].state.Q, 0, `Before pulse: Bit ${i} is 0`);
  }

  // Clock pulse loads the entire 4-bit word simultaneously
  sim.pulseClockSync(clock.id);
  for (let i = 0; i < 4; i++) {
    assert.strictEqual(dFFs[i].state.Q, testPattern[i], `After pulse: Bit ${i} matches ${testPattern[i]}`);
    assert.strictEqual(outputs[i].value, testPattern[i], `Output pin ${i} matches ${testPattern[i]}`);
  }

  // Change input lines without pulsing clock: register retains word
  inputs[0].value = 0;
  inputs[1].value = 1;
  inputs[2].value = 0;
  inputs[3].value = 0;
  sim.run();
  for (let i = 0; i < 4; i++) {
    assert.strictEqual(dFFs[i].state.Q, testPattern[i], `Input change ignored before clock: Bit ${i} holds`);
  }

  // Next pulse loads new pattern [0, 1, 0, 0]
  sim.pulseClockSync(clock.id);
  assert.deepStrictEqual(dFFs.map(d => d.state.Q), [0, 1, 0, 0], 'New 4-bit word loaded on edge');
});

// ----------------------------------------------------------------------------
// Test 36: Synchronous 3-Bit Binary Counter (000 to 111 and Wrap)
// ----------------------------------------------------------------------------
await runTest('Binary Counter - Synchronous 3-bit counter counting 000 through 111 and wrapping', () => {
  const circuit = new Circuit();
  const clock = circuit.addComponent(ComponentTypes.CLOCK, 50, 350);
  const inOne = circuit.addComponent(ComponentTypes.INPUT, 50, 100, null, 1);

  // Bit 0 (LSB): T = 1, clocked by CLK
  const ff0 = circuit.addComponent(ComponentTypes.T_FLIPFLOP, 180, 100);
  circuit.addConnection(inOne.id, 'out0', ff0.id, 'in_t');
  circuit.addConnection(clock.id, 'out0', ff0.id, 'in_clk');

  // Bit 1: T = Q0, clocked by CLK
  const ff1 = circuit.addComponent(ComponentTypes.T_FLIPFLOP, 320, 180);
  circuit.addConnection(ff0.id, 'out_q', ff1.id, 'in_t');
  circuit.addConnection(clock.id, 'out0', ff1.id, 'in_clk');

  // AND gate: Q0 AND Q1
  const andGate = circuit.addComponent(ComponentTypes.AND, 380, 280);
  circuit.addConnection(ff0.id, 'out_q', andGate.id, 'in0');
  circuit.addConnection(ff1.id, 'out_q', andGate.id, 'in1');

  // Bit 2 (MSB): T = (Q0 AND Q1), clocked by CLK
  const ff2 = circuit.addComponent(ComponentTypes.T_FLIPFLOP, 480, 260);
  circuit.addConnection(andGate.id, 'out0', ff2.id, 'in_t');
  circuit.addConnection(clock.id, 'out0', ff2.id, 'in_clk');

  const sim = new Simulator(circuit);
  sim.run();

  const expectedCounts = [
    [0, 0, 0], // 0
    [0, 0, 1], // 1
    [0, 1, 0], // 2
    [0, 1, 1], // 3
    [1, 0, 0], // 4
    [1, 0, 1], // 5
    [1, 1, 0], // 6
    [1, 1, 1], // 7
    [0, 0, 0]  // 8 (wraps)
  ];

  // Verify initial 000
  assert.deepStrictEqual([ff2.state.Q, ff1.state.Q, ff0.state.Q], expectedCounts[0], 'Initial count: 000');

  // Run 8 pulses
  for (let count = 1; count <= 8; count++) {
    sim.pulseClockSync(clock.id);
    const actual = [ff2.state.Q, ff1.state.Q, ff0.state.Q];
    assert.deepStrictEqual(actual, expectedCounts[count], `Pulse ${count}: expected ${expectedCounts[count].join('')}, got ${actual.join('')}`);
  }
});

// ----------------------------------------------------------------------------
// Test 37: Gate-Level Cross-Coupled NOR SR Latch
// ----------------------------------------------------------------------------
await runTest('Gate-Level SR Latch - Cross-coupled NOR gates settle bistable memory with zero cycle warnings', () => {
  const circuit = new Circuit();
  const nor1 = circuit.addComponent(ComponentTypes.NOR, 200, 150); // Produces Q
  const nor2 = circuit.addComponent(ComponentTypes.NOR, 200, 250); // Produces Qbar
  const inR = circuit.addComponent(ComponentTypes.INPUT, 50, 130, null, 1);
  const inS = circuit.addComponent(ComponentTypes.INPUT, 50, 270, null, 0);

  // Cross-coupling:
  // nor1 inputs: in0: inR, in1: nor2.out0
  circuit.addConnection(inR.id, 'out0', nor1.id, 'in0');
  circuit.addConnection(nor2.id, 'out0', nor1.id, 'in1');

  // nor2 inputs: in0: inS, in1: nor1.out0
  circuit.addConnection(inS.id, 'out0', nor2.id, 'in0');
  circuit.addConnection(nor1.id, 'out0', nor2.id, 'in1');

  const sim = new Simulator(circuit);

  // Phase 1: Reset state (R=1, S=0)
  sim.run();
  assert.strictEqual(nor1.value, 0, 'NOR Latch: R=1, S=0 -> Q=0');
  assert.strictEqual(nor2.value, 1, 'NOR Latch: R=1, S=0 -> Qbar=1');

  // Phase 2: Hold state (R=0, S=0)
  inR.value = 0;
  inS.value = 0;
  const hold1 = sim.run();
  assert.strictEqual(nor1.value, 0, 'NOR Latch Hold: Q remains 0');
  assert.strictEqual(nor2.value, 1, 'NOR Latch Hold: Qbar remains 1');
  assert.strictEqual(hold1.cycleDetected, false, 'No false cycle warning on bistable hold');

  // Phase 3: Set state (R=0, S=1)
  inR.value = 0;
  inS.value = 1;
  const setRes = sim.run();
  assert.strictEqual(nor1.value, 1, 'NOR Latch Set: Q becomes 1');
  assert.strictEqual(nor2.value, 0, 'NOR Latch Set: Qbar becomes 0');
  assert.strictEqual(setRes.cycleDetected, false, 'No false cycle warning on set transition');

  // Phase 4: Hold state after Set (R=0, S=0)
  inR.value = 0;
  inS.value = 0;
  const hold2 = sim.run();
  assert.strictEqual(nor1.value, 1, 'NOR Latch Hold: Q retains 1');
  assert.strictEqual(nor2.value, 0, 'NOR Latch Hold: Qbar retains 0');
  assert.strictEqual(hold2.cycleDetected, false, 'Bistable state holds smoothly');

  // Phase 5: Reset state again (R=1, S=0)
  inR.value = 1;
  inS.value = 0;
  sim.run();
  assert.strictEqual(nor1.value, 0, 'NOR Latch Reset: Q returns to 0');
  assert.strictEqual(nor2.value, 1, 'NOR Latch Reset: Qbar returns to 1');
});

// ----------------------------------------------------------------------------
// Test 38: Gate-Level Cross-Coupled NAND Latch (Active-Low SR Latch)
// ----------------------------------------------------------------------------
await runTest('Gate-Level NAND Latch - Active-LOW SR Latch settling and memory retention', () => {
  const circuit = new Circuit();
  const nand1 = circuit.addComponent(ComponentTypes.NAND, 200, 150); // Q
  const nand2 = circuit.addComponent(ComponentTypes.NAND, 200, 250); // Qbar
  const inSbar = circuit.addComponent(ComponentTypes.INPUT, 50, 130, null, 1);
  const inRbar = circuit.addComponent(ComponentTypes.INPUT, 50, 270, null, 0); // Active-low reset

  circuit.addConnection(inSbar.id, 'out0', nand1.id, 'in0');
  circuit.addConnection(nand2.id, 'out0', nand1.id, 'in1');
  circuit.addConnection(inRbar.id, 'out0', nand2.id, 'in0');
  circuit.addConnection(nand1.id, 'out0', nand2.id, 'in1');

  const sim = new Simulator(circuit);

  // Phase 1: Reset (Sbar=1, Rbar=0) -> Q=0, Qbar=1
  sim.run();
  assert.strictEqual(nand1.value, 0, 'NAND Latch Reset: Q=0');
  assert.strictEqual(nand2.value, 1, 'NAND Latch Reset: Qbar=1');

  // Phase 2: Hold (Sbar=1, Rbar=1) -> Q=0, Qbar=1
  inRbar.value = 1;
  const hold1 = sim.run();
  assert.strictEqual(nand1.value, 0, 'NAND Latch Hold 0: Q=0');
  assert.strictEqual(nand2.value, 1, 'NAND Latch Hold 0: Qbar=1');
  assert.strictEqual(hold1.cycleDetected, false);

  // Phase 3: Set (Sbar=0, Rbar=1) -> Q=1, Qbar=0
  inSbar.value = 0;
  const setRes = sim.run();
  assert.strictEqual(nand1.value, 1, 'NAND Latch Set: Q=1');
  assert.strictEqual(nand2.value, 0, 'NAND Latch Set: Qbar=0');
  assert.strictEqual(setRes.cycleDetected, false);

  // Phase 4: Hold (Sbar=1, Rbar=1) -> Q=1, Qbar=0
  inSbar.value = 1;
  const hold2 = sim.run();
  assert.strictEqual(nand1.value, 1, 'NAND Latch Hold 1: Q=1 retained');
  assert.strictEqual(nand2.value, 0, 'NAND Latch Hold 1: Qbar=0 retained');
  assert.strictEqual(hold2.cycleDetected, false);
});

// ----------------------------------------------------------------------------
// Test 39: Independent Multi-Clock Domains Isolation
// ----------------------------------------------------------------------------
await runTest('Independent Multi-Clock Isolation (Pulses on Clock A do not trigger Clock B components)', () => {
  const circuit = new Circuit();
  const clockA = circuit.addComponent(ComponentTypes.CLOCK, 50, 150);
  const clockB = circuit.addComponent(ComponentTypes.CLOCK, 50, 300);

  const inDA = circuit.addComponent(ComponentTypes.INPUT, 50, 100, null, 1);
  const inDB = circuit.addComponent(ComponentTypes.INPUT, 50, 250, null, 1);

  const ffA = circuit.addComponent(ComponentTypes.D_FLIPFLOP, 200, 120);
  const ffB = circuit.addComponent(ComponentTypes.D_FLIPFLOP, 200, 270);

  circuit.addConnection(inDA.id, 'out0', ffA.id, 'in_d');
  circuit.addConnection(clockA.id, 'out0', ffA.id, 'in_clk');

  circuit.addConnection(inDB.id, 'out0', ffB.id, 'in_d');
  circuit.addConnection(clockB.id, 'out0', ffB.id, 'in_clk');

  const sim = new Simulator(circuit);
  sim.run();

  assert.strictEqual(ffA.state.Q, 0, 'Initial FFA.Q = 0');
  assert.strictEqual(ffB.state.Q, 0, 'Initial FFB.Q = 0');

  // Pulse Clock A only: FFA updates to 1, FFB MUST remain 0!
  sim.pulseClockSync(clockA.id);
  assert.strictEqual(ffA.state.Q, 1, 'FFA updated on Clock A pulse');
  assert.strictEqual(ffB.state.Q, 0, 'FFB strictly unchanged on Clock A pulse');

  // Change input of A to 0, input of B remains 1
  inDA.value = 0;

  // Pulse Clock B only: FFB updates to 1, FFA MUST remain 1!
  sim.pulseClockSync(clockB.id);
  assert.strictEqual(ffB.state.Q, 1, 'FFB updated on Clock B pulse');
  assert.strictEqual(ffA.state.Q, 1, 'FFA strictly unchanged on Clock B pulse');
});

// ----------------------------------------------------------------------------
// Test 40: Structured Simulation Debug Logging Output
// ----------------------------------------------------------------------------
await runTest('Structured Simulation Debug Logging (Captures cycles and state transitions cleanly)', () => {
  const circuit = new Circuit();
  const jk = circuit.addComponent(ComponentTypes.JK_FLIPFLOP, 200, 200);
  const clock = circuit.addComponent(ComponentTypes.CLOCK, 50, 200);
  const inJ = circuit.addComponent(ComponentTypes.INPUT, 50, 150, null, 1);
  const inK = circuit.addComponent(ComponentTypes.INPUT, 50, 250, null, 1);

  circuit.addConnection(inJ.id, 'out0', jk.id, 'in_j');
  circuit.addConnection(inK.id, 'out0', jk.id, 'in_k');
  circuit.addConnection(clock.id, 'out0', jk.id, 'in_clk');

  const sim = new Simulator(circuit);
  sim.setDebug(true);

  const logs = [];
  const originalLog = console.log;
  console.log = (...args) => {
    logs.push(args.join(' '));
  };

  try {
    sim.pulseClockSync(clock.id);
  } finally {
    console.log = originalLog;
    sim.setDebug(false);
  }

  assert.strictEqual(jk.state.Q, 1, 'JK FF toggled');
  assert.ok(logs.some(l => l.includes('[SIM-CYCLE]')), 'Should output [SIM-CYCLE] logs when debug is enabled');
  assert.ok(logs.some(l => l.includes('Delta cycle') || l.includes('JK_FLIPFLOP') || l.includes('Commit')), 'Should log delta cycle or sequential state details');
});

// ----------------------------------------------------------------------------
// Test 41: JK Latch - Level Sensitive (EN=0 holds, EN=1 sets/resets/toggles)
// ----------------------------------------------------------------------------
await runTest('JK Latch - Level Sensitive operation with EN gating', () => {
  const circuit = new Circuit();
  const jk = circuit.addComponent(ComponentTypes.JK_LATCH, 200, 200);
  const inJ = circuit.addComponent(ComponentTypes.INPUT, 50, 150, null, 1);
  const inEN = circuit.addComponent(ComponentTypes.INPUT, 50, 200, null, 0); // DISABLED initially
  const inK = circuit.addComponent(ComponentTypes.INPUT, 50, 250, null, 0);
  const outQ = circuit.addComponent(ComponentTypes.OUTPUT, 350, 180);
  const outQbar = circuit.addComponent(ComponentTypes.OUTPUT, 350, 220);

  circuit.addConnection(inJ.id, 'out0', jk.id, 'in_j');
  circuit.addConnection(inEN.id, 'out0', jk.id, 'in_en');
  circuit.addConnection(inK.id, 'out0', jk.id, 'in_k');
  circuit.addConnection(jk.id, 'out_q', outQ.id, 'in0');
  circuit.addConnection(jk.id, 'out_qbar', outQbar.id, 'in0');

  const sim = new Simulator(circuit);
  sim.run();

  // EN=0: J=1 should NOT set Q
  assert.strictEqual(jk.state.Q, 0, 'Q holds 0 while EN=0');
  assert.strictEqual(jk.state.Qbar, 1, 'Qbar holds 1 while EN=0');

  // Enable EN=1: J=1, K=0 -> SET
  inEN.value = 1;
  sim.run();
  assert.strictEqual(jk.state.Q, 1, 'Q sets to 1 when EN=1');
  assert.strictEqual(jk.state.Qbar, 0, 'Qbar sets to 0 when EN=1');

  // EN=1: J=0, K=1 -> RESET
  inJ.value = 0;
  inK.value = 1;
  sim.run();
  assert.strictEqual(jk.state.Q, 0, 'Q resets to 0 when EN=1');
  assert.strictEqual(jk.state.Qbar, 1, 'Qbar resets to 1 when EN=1');

  // EN=1: J=0, K=0 -> HOLD
  inK.value = 0;
  sim.run();
  assert.strictEqual(jk.state.Q, 0, 'Q holds 0 when J=0, K=0');
  assert.strictEqual(jk.state.Qbar, 1, 'Qbar holds 1 when J=0, K=0');

  // Disable EN=0, change J=1, K=0: inputs ignored
  inEN.value = 0;
  inJ.value = 1;
  sim.run();
  assert.strictEqual(jk.state.Q, 0, 'Q holds 0 while EN=0 despite J=1');
  assert.strictEqual(jk.state.Qbar, 1, 'Qbar holds 1 while EN=0 despite J=1');
});

// ----------------------------------------------------------------------------
// Test 42: SR Flip-Flop - Edge-Triggered (Transitions occur only on CLK 0->1)
// ----------------------------------------------------------------------------
await runTest('SR Flip-Flop - Edge-triggered Set, Reset, Hold and static rejection', () => {
  const circuit = new Circuit();
  const srFF = circuit.addComponent(ComponentTypes.SR_FLIPFLOP, 200, 200);
  const inS = circuit.addComponent(ComponentTypes.INPUT, 50, 150, null, 1);
  const clock = circuit.addComponent(ComponentTypes.CLOCK, 50, 200);
  const inR = circuit.addComponent(ComponentTypes.INPUT, 50, 250, null, 0);
  const outQ = circuit.addComponent(ComponentTypes.OUTPUT, 350, 180);
  const outQbar = circuit.addComponent(ComponentTypes.OUTPUT, 350, 220);

  circuit.addConnection(inS.id, 'out0', srFF.id, 'in_s');
  circuit.addConnection(clock.id, 'out0', srFF.id, 'in_clk');
  circuit.addConnection(inR.id, 'out0', srFF.id, 'in_r');
  circuit.addConnection(srFF.id, 'out_q', outQ.id, 'in0');
  circuit.addConnection(srFF.id, 'out_qbar', outQbar.id, 'in0');

  const sim = new Simulator(circuit);
  sim.run();

  // Initial state before pulse: Q should be 0, Qbar should be 1
  assert.strictEqual(srFF.state.Q, 0, 'Initial Q is 0 prior to clock edge');
  assert.strictEqual(srFF.state.Qbar, 1, 'Initial Qbar is 1 prior to clock edge');

  // Pulse clock with S=1, R=0 -> SET
  sim.pulseClockSync(clock.id);
  assert.strictEqual(srFF.state.Q, 1, 'Q sets to 1 on clock pulse edge');
  assert.strictEqual(srFF.state.Qbar, 0, 'Qbar sets to 0 on clock pulse edge');
  assert.strictEqual(outQ.value, 1);
  assert.strictEqual(outQbar.value, 0);

  // Static input change without clock edge: S=0, R=1
  inS.value = 0;
  inR.value = 1;
  sim.run();
  assert.strictEqual(srFF.state.Q, 1, 'Q remains 1 without clock pulse despite R=1');
  assert.strictEqual(srFF.state.Qbar, 0, 'Qbar remains 0 without clock pulse despite R=1');

  // Now pulse clock: RESET takes effect
  sim.pulseClockSync(clock.id);
  assert.strictEqual(srFF.state.Q, 0, 'Q resets to 0 on clock pulse edge');
  assert.strictEqual(srFF.state.Qbar, 1, 'Qbar resets to 1 on clock pulse edge');

  // HOLD on clock pulse: S=0, R=0
  inR.value = 0;
  sim.pulseClockSync(clock.id);
  assert.strictEqual(srFF.state.Q, 0, 'Q remains 0 on S=0, R=0 pulse hold');
  assert.strictEqual(srFF.state.Qbar, 1, 'Qbar remains 1 on S=0, R=0 pulse hold');
});

console.log('----------------------------------------------------');
console.log('Results: ' + passedTests + ' / ' + totalTests + ' tests passed.');
if (passedTests === totalTests) {
  console.log('ALL SEQUENTIAL LOGIC & CLOCK TESTS PASSED SUCCESSFULLY!');
} else {
  console.error('SOME TESTS FAILED!');
  process.exitCode = 1;
}
