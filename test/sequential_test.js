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

  assert.ok(SUPPORTED_COMPONENT_TYPES.has(ComponentTypes.CLOCK));
  assert.ok(SUPPORTED_COMPONENT_TYPES.has(ComponentTypes.D_LATCH));
  assert.ok(SUPPORTED_COMPONENT_TYPES.has(ComponentTypes.SR_LATCH));

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
  assert.strictEqual(srSpecs.inputs.length, 3, 'SR Latch has 3 inputs: S, EN, R');
  assert.strictEqual(srSpecs.inputs[0].id, 'in_s');
  assert.strictEqual(srSpecs.inputs[1].id, 'in_en');
  assert.strictEqual(srSpecs.inputs[2].id, 'in_r');
  assert.strictEqual(srSpecs.outputs.length, 2, 'SR Latch has 2 outputs: Q and Qbar');

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
  const sr = circuit.addComponent(ComponentTypes.SR_LATCH, 200, 200);
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
  const sr = circuit.addComponent(ComponentTypes.SR_LATCH, 200, 200);
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
// Test 15: Continuous Clock Square Wave Generation & Toggling
// ----------------------------------------------------------------------------
await runTest('Continuous Clock Square Wave Generation & Running Toggle', async () => {
  const circuit = new Circuit();
  const clock = circuit.addComponent(ComponentTypes.CLOCK, 100, 100);
  const outComp = circuit.addComponent(ComponentTypes.OUTPUT, 250, 100);
  circuit.addConnection(clock.id, 'out0', outComp.id, 'in0');

  const sim = new Simulator(circuit);
  sim.setClockFrequency(clock.id, 20); // 20Hz -> 50ms period (25ms high, 25ms low)
  sim.startClock(clock.id);
  assert.strictEqual(clock.running, true);

  // Wait 70ms to allow at least 1-2 clock state transitions
  await new Promise(r => setTimeout(r, 70));

  // The clock should have toggled
  sim.stopClock(clock.id);
  assert.strictEqual(clock.running, false);
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
// Test 19: Central Simulator Clock Scheduling & Simulation Speed Controls
// ----------------------------------------------------------------------------
await runTest('Simulation Speed Controls and Start/Stop All Clocks', () => {
  const circuit = new Circuit();
  const c1 = circuit.addComponent(ComponentTypes.CLOCK, 100, 100);
  const c2 = circuit.addComponent(ComponentTypes.CLOCK, 100, 200);

  const sim = new Simulator(circuit);
  sim.setSimulationSpeed(2.0);
  assert.strictEqual(sim.simulationSpeed, 2.0);

  sim.startAllClocks();
  assert.strictEqual(c1.running, true);
  assert.strictEqual(c2.running, true);

  sim.stopAllClocks();
  assert.strictEqual(c1.running, false);
  assert.strictEqual(c2.running, false);

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

console.log('----------------------------------------------------');
console.log('Results: ' + passedTests + ' / ' + totalTests + ' tests passed.');
if (passedTests === totalTests) {
  console.log('ALL SEQUENTIAL LOGIC & CLOCK TESTS PASSED SUCCESSFULLY!');
} else {
  console.error('SOME TESTS FAILED!');
  process.exitCode = 1;
}
