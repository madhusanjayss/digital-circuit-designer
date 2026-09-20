import { ComponentTypes, POWER_RAIL_SPECS } from './components.js';
import { getICDefinition } from './icLibrary.js';
import { validateCircuit, Circuit } from './circuit.js';

export class Simulator {
  constructor(circuit) {
    this.circuit = circuit;
    this.lastError = null;
    this.simulationSpeed = 1.0;
    this.clockTimerId = null;
    this.onTickCallback = null;
  }

  evaluateGate(type, inputMap = {}, compValue = 0) {
    const val = pinId => (inputMap[pinId] === 1 ? 1 : 0);

    if (POWER_RAIL_SPECS[type]) {
      const spec = POWER_RAIL_SPECS[type];
      return spec.voltage > 0 ? 1 : 0;
    }

    switch (type) {
      case ComponentTypes.INPUT:
      case ComponentTypes.CLOCK:
        return compValue === 1 ? 1 : 0;
      case ComponentTypes.CONST_0:
        return 0;
      case ComponentTypes.CONST_1:
        return 1;
      case ComponentTypes.OUTPUT:
        return val('in0');
      case ComponentTypes.NOT:
        return val('in0') === 1 ? 0 : 1;
      case ComponentTypes.AND:
        return val('in0') === 1 && val('in1') === 1 ? 1 : 0;
      case ComponentTypes.NAND:
        return val('in0') === 1 && val('in1') === 1 ? 0 : 1;
      case ComponentTypes.OR:
        return val('in0') === 1 || val('in1') === 1 ? 1 : 0;
      case ComponentTypes.NOR:
        return val('in0') === 1 || val('in1') === 1 ? 0 : 1;
      case ComponentTypes.XOR:
        return val('in0') !== val('in1') ? 1 : 0;
      case ComponentTypes.WIRE:
        return inputMap['in0'] !== undefined ? (inputMap['in0'] === 1 ? 1 : 0) : (compValue === 1 ? 1 : 0);
      case ComponentTypes.XNOR:
        return val('in0') === val('in1') ? 1 : 0;
      default:
        return 0;
    }
  }

  evaluateIC(comp, inputMap = {}) {
    if (!comp) return {};
    const defId = comp.icData?.definitionId || '74HC00';
    const def = getICDefinition(defId) || comp.icData;
    if (!def || typeof def.simulate !== 'function') return {};

    // Determine power state
    let isPowered = true;
    const pins = Array.isArray(def.pins) ? def.pins : [];
    const gndPin = pins.find(p => p.kind === 'power' && (p.isGround || p.name === 'GND' || p.name === 'VSS'));
    const vccPin = pins.find(p => p.kind === 'power' && (!p.isGround || p.name === 'VCC' || p.name === 'VDD'));

    const hasGndInput = gndPin && inputMap[gndPin.id] !== undefined;
    const hasVccInput = vccPin && inputMap[vccPin.id] !== undefined;

    if (hasGndInput || hasVccInput) {
      if (hasGndInput && inputMap[gndPin.id] !== 0) {
        isPowered = false;
      }
      if (hasVccInput && inputMap[vccPin.id] !== 1) {
        isPowered = false;
      }
    }

    const outputs = def.simulate(inputMap, isPowered) || {};
    comp.outputValues = outputs;
    return outputs;
  }

  evaluateChip(chip, inputMap = {}, recursionStack = new Set()) {
    if (!chip || !chip.chipData || !chip.chipData.circuit) {
      return {};
    }

    const chipKey = chip.id || chip.name;
    if (recursionStack.has(chipKey)) {
      throw new Error(`Recursive chip dependency detected involving ${chip.name || chip.id}.`);
    }
    const nextStack = new Set(recursionStack);
    nextStack.add(chipKey);

    const chipInterface = chip.chipData.interface || chip.chipData;
    const internalComps = chip.chipData.circuit.components || [];
    const internalWires = chip.chipData.circuit.connections || [];

    const subCircuit = new Circuit();
    internalComps.forEach(ic => {
      subCircuit.components.set(ic.id, { ...ic });
    });
    internalWires.forEach(iw => {
      subCircuit.connections.push({ ...iw });
    });

    (chipInterface.inputs || []).forEach(inpDef => {
      const topLevelVal = inputMap[inpDef.id] === 1 ? 1 : 0;

      // 1. Direct match on internal INPUT component
      const directComp = inpDef.internalCompId ? subCircuit.components.get(inpDef.internalCompId) : null;
      if (directComp && directComp.type === ComponentTypes.INPUT) {
        directComp.value = topLevelVal;
        return;
      }

      // 2. Iterate internal targets
      const targets = Array.isArray(inpDef.internalTargets) && inpDef.internalTargets.length > 0
        ? inpDef.internalTargets
        : (inpDef.internalTarget ? [inpDef.internalTarget] : []);

      targets.forEach((target, tIdx) => {
        if (!target || !target.compId) return;
        const intComp = subCircuit.components.get(target.compId);
        if (intComp) {
          if (intComp.type === ComponentTypes.INPUT) {
            intComp.value = topLevelVal;
          } else {
            // Remove any conflicting internal wire targeting this same pin
            subCircuit.connections = subCircuit.connections.filter(
              w => !(w.toCompId === target.compId && w.toPinId === target.pinId)
            );

            const virtualInputId = `__v_inp_${inpDef.id}_${tIdx}`;
            subCircuit.components.set(virtualInputId, {
              id: virtualInputId,
              type: topLevelVal === 1 ? ComponentTypes.CONST_1 : ComponentTypes.CONST_0,
              value: topLevelVal,
              x: 0,
              y: 0
            });
            subCircuit.connections.push({
              id: `__v_wire_${inpDef.id}_${tIdx}`,
              fromCompId: virtualInputId,
              fromPinId: 'out0',
              toCompId: target.compId,
              toPinId: target.pinId,
              state: topLevelVal
            });
          }
        }
      });
    });

    const subSim = new Simulator(subCircuit);
    subSim.run(nextStack);

    const outputMap = {};
    (chipInterface.outputs || []).forEach(outDef => {
      // 1. Direct match on internal OUTPUT component
      const directOutComp = outDef.internalCompId ? subCircuit.components.get(outDef.internalCompId) : null;
      if (directOutComp && directOutComp.type === ComponentTypes.OUTPUT) {
        outputMap[outDef.id] = directOutComp.value === 1 ? 1 : 0;
        return;
      }

      // 2. Internal source resolution
      const source = outDef.internalSource || { compId: outDef.internalCompId, pinId: outDef.internalPinId };
      if (source && source.compId) {
        const intComp = subCircuit.components.get(source.compId);
        if (intComp) {
          if (intComp.type === ComponentTypes.OUTPUT) {
            outputMap[outDef.id] = intComp.value === 1 ? 1 : 0;
          } else if (intComp.type === ComponentTypes.CHIP) {
            const sourceWire = subCircuit.connections.find(w => w.fromCompId === source.compId && w.fromPinId === source.pinId);
            if (sourceWire) {
              outputMap[outDef.id] = sourceWire.state === 1 ? 1 : 0;
            } else {
              const chipInputs = {};
              subCircuit.connections
                .filter(w => w.toCompId === source.compId)
                .forEach(w => { chipInputs[w.toPinId] = w.state === 1 ? 1 : 0; });
              const chipOuts = this.evaluateChip(intComp, chipInputs, nextStack);
              outputMap[outDef.id] = chipOuts[source.pinId] === 1 ? 1 : 0;
            }
          } else {
            const sourceWire = subCircuit.connections.find(w => w.fromCompId === source.compId && w.fromPinId === source.pinId);
            if (sourceWire) {
              outputMap[outDef.id] = sourceWire.state === 1 ? 1 : 0;
            } else {
              const gateInputs = {};
              subCircuit.connections
                .filter(w => w.toCompId === source.compId)
                .forEach(w => { gateInputs[w.toPinId] = w.state === 1 ? 1 : 0; });
              outputMap[outDef.id] = subSim.evaluateGate(intComp.type, gateInputs, intComp.value) === 1 ? 1 : 0;
            }
          }
        } else {
          outputMap[outDef.id] = 0;
        }
      } else {
        outputMap[outDef.id] = 0;
      }
    });

    return outputMap;
  }

  evaluateDLatch(comp, inputMap = {}) {
    if (!comp.state) {
      comp.state = { Q: 0, Qbar: 1 };
    }
    const clk = inputMap['in_clk'] === 1 ? 1 : 0;
    const d = inputMap['in_d'] === 1 ? 1 : 0;

    let nextQ, nextQbar;
    if (clk === 1) {
      // Transparent mode: Q follows D
      nextQ = d;
      nextQbar = d === 1 ? 0 : 1;
    } else {
      // Hold mode: keep previous committed state
      nextQ = comp.state.Q === 1 ? 1 : 0;
      nextQbar = comp.state.Qbar === 1 ? 1 : 0;
    }

    comp.nextState = { Q: nextQ, Qbar: nextQbar };
    return {
      out_q: nextQ,
      out_qbar: nextQbar
    };
  }

  evaluateSRLatch(comp, inputMap = {}) {
    if (!comp.state) {
      comp.state = { Q: 0, Qbar: 1, invalid: false };
    }
    const s = inputMap['in_s'] === 1 ? 1 : 0;
    const r = inputMap['in_r'] === 1 ? 1 : 0;
    // If EN pin has no wire connected, default to 1 (ungated active-HIGH SR latch)
    const en = inputMap['in_en'] !== undefined ? (inputMap['in_en'] === 1 ? 1 : 0) : 1;

    let nextQ, nextQbar;
    let invalid = false;

    if (en === 0) {
      // Hold phase when disabled
      nextQ = comp.state.Q === 1 ? 1 : 0;
      nextQbar = comp.state.Qbar === 1 ? 1 : 0;
      invalid = !!comp.state.invalid;
    } else {
      // Enabled: evaluate S and R
      if (s === 0 && r === 0) {
        // HOLD
        nextQ = comp.state.Q === 1 ? 1 : 0;
        nextQbar = comp.state.Qbar === 1 ? 1 : 0;
        invalid = !!comp.state.invalid;
      } else if (s === 1 && r === 0) {
        // SET
        nextQ = 1;
        nextQbar = 0;
        invalid = false;
      } else if (s === 0 && r === 1) {
        // RESET
        nextQ = 0;
        nextQbar = 1;
        invalid = false;
      } else {
        // S === 1 && R === 1: INVALID condition
        nextQ = 0;
        nextQbar = 0;
        invalid = true;
      }
    }

    comp.nextState = { Q: nextQ, Qbar: nextQbar, invalid };
    return {
      out_q: nextQ,
      out_qbar: nextQbar,
      invalid
    };
  }

  commitSequentialStates() {
    this.circuit.components.forEach(comp => {
      if (comp.type === ComponentTypes.D_LATCH) {
        if (comp.nextState) {
          comp.state = { Q: comp.nextState.Q, Qbar: comp.nextState.Qbar };
          delete comp.nextState;
        }
        comp.value = comp.state?.Q ?? 0;
      } else if (comp.type === ComponentTypes.SR_LATCH) {
        if (comp.nextState) {
          comp.state = { Q: comp.nextState.Q, Qbar: comp.nextState.Qbar, invalid: comp.nextState.invalid };
          delete comp.nextState;
        }
        comp.value = comp.state?.Q ?? 0;
      }
    });
  }

  componentSortKey(comp) {
    if (comp.type === ComponentTypes.INPUT) return `0:${comp.id}`;
    if (comp.type === ComponentTypes.CLOCK || comp.type === ComponentTypes.CONST_0 || comp.type === ComponentTypes.CONST_1 || POWER_RAIL_SPECS[comp.type]) return `1:${comp.id}`;
    if (comp.type === ComponentTypes.D_LATCH || comp.type === ComponentTypes.SR_LATCH) return `2:${comp.id}`;
    if (comp.type === ComponentTypes.OUTPUT) return `9:${comp.id}`;
    return `5:${comp.id}`;
  }

  run(recursionStack = new Set()) {
    this.lastError = null;
    const validation = validateCircuit(this.circuit);
    if (!validation.valid) {
      this.lastError = `Simulation blocked: ${validation.errors[0]}`;
      return { success: false, cycleDetected: false, error: this.lastError, validationErrors: validation.errors };
    }

    const components = Array.from(this.circuit.components.values())
      .sort((a, b) => this.componentSortKey(a).localeCompare(this.componentSortKey(b)));

    // Initialize component output maps with current state/values
    const compOutputs = new Map();
    components.forEach(comp => {
      if (comp.type === ComponentTypes.INPUT) {
        compOutputs.set(comp.id, { out0: comp.value === 1 ? 1 : 0 });
      } else if (comp.type === ComponentTypes.CLOCK) {
        const clkVal = comp.value === 1 ? 1 : 0;
        compOutputs.set(comp.id, { out0: clkVal, out_nclk: clkVal === 1 ? 0 : 1 });
      } else if (comp.type === ComponentTypes.CONST_0) {
        compOutputs.set(comp.id, { out0: 0 });
      } else if (comp.type === ComponentTypes.CONST_1) {
        compOutputs.set(comp.id, { out0: 1 });
      } else if (POWER_RAIL_SPECS[comp.type]) {
        compOutputs.set(comp.id, { out0: POWER_RAIL_SPECS[comp.type].voltage > 0 ? 1 : 0 });
      } else if (comp.type === ComponentTypes.D_LATCH || comp.type === ComponentTypes.SR_LATCH) {
        if (!comp.state) comp.state = { Q: 0, Qbar: 1 };
        compOutputs.set(comp.id, { out_q: comp.state.Q === 1 ? 1 : 0, out_qbar: comp.state.Qbar === 1 ? 1 : 0 });
      } else if (comp.type === ComponentTypes.WIRE || String(comp.type).toLowerCase() === 'wire') {
        const val = comp.signal === 1 || comp.value === 1 ? 1 : 0;
        const wOuts = { out0: val };
        if (Array.isArray(comp.branches)) {
          comp.branches.forEach(b => { wOuts[b.id] = val; });
        }
        compOutputs.set(comp.id, wOuts);
      } else {
        compOutputs.set(comp.id, {});
      }
    });

    const MAX_ITERATIONS = 40;
    let stable = false;
    let lastOscillatingIds = [];

    for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
      let changed = false;
      const changedCompIds = new Set();

      // 1. Propagate component outputs onto connections
      this.circuit.connections.forEach(wire => {
        const sourceOuts = compOutputs.get(wire.fromCompId) || {};
        const sig = sourceOuts[wire.fromPinId] === 1 ? 1 : 0;
        if (wire.state !== sig) {
          wire.state = sig;
          changed = true;
          changedCompIds.add(wire.toCompId);
        }
      });

      // 2. Gather inputs for each component
      const inputValues = new Map();
      this.circuit.connections.forEach(wire => {
        if (!inputValues.has(wire.toCompId)) {
          inputValues.set(wire.toCompId, {});
        }
        inputValues.get(wire.toCompId)[wire.toPinId] = wire.state === 1 ? 1 : 0;
      });

      // 3. Evaluate each component
      for (const comp of components) {
        const inputs = inputValues.get(comp.id) || {};
        const curOuts = compOutputs.get(comp.id) || {};

        if (comp.type === ComponentTypes.INPUT) {
          const expected = comp.value === 1 ? 1 : 0;
          if (curOuts.out0 !== expected) {
            compOutputs.set(comp.id, { out0: expected });
            changed = true;
          }
        } else if (comp.type === ComponentTypes.CLOCK) {
          const expClk = comp.value === 1 ? 1 : 0;
          const expNclk = expClk === 1 ? 0 : 1;
          if (curOuts.out0 !== expClk || curOuts.out_nclk !== expNclk) {
            compOutputs.set(comp.id, { out0: expClk, out_nclk: expNclk });
            changed = true;
          }
        } else if (comp.type === ComponentTypes.CONST_0 || comp.type === ComponentTypes.CONST_1 || POWER_RAIL_SPECS[comp.type]) {
          // Fixed outputs
        } else if (comp.type === ComponentTypes.OUTPUT) {
          const outVal = inputs['in0'] === 1 ? 1 : 0;
          if (comp.value !== outVal) {
            comp.value = outVal;
            changed = true;
          }
        } else if (comp.type === ComponentTypes.WIRE || String(comp.type).toLowerCase() === 'wire') {
          const wireVal = inputs['in0'] !== undefined ? (inputs['in0'] === 1 ? 1 : 0) : (comp.value === 1 ? 1 : 0);
          if (comp.value !== wireVal || comp.signal !== wireVal) {
            comp.value = wireVal;
            comp.signal = wireVal;
            changed = true;
          }
          if (curOuts.out0 !== wireVal) {
            const wOuts = { out0: wireVal };
            if (Array.isArray(comp.branches)) {
              comp.branches.forEach(b => { wOuts[b.id] = wireVal; });
            }
            compOutputs.set(comp.id, wOuts);
            changed = true;
          }
        } else if (comp.type === ComponentTypes.D_LATCH) {
          const nextOuts = this.evaluateDLatch(comp, inputs);
          if (curOuts.out_q !== nextOuts.out_q || curOuts.out_qbar !== nextOuts.out_qbar) {
            compOutputs.set(comp.id, nextOuts);
            changed = true;
          }
          comp.value = nextOuts.out_q;
        } else if (comp.type === ComponentTypes.SR_LATCH) {
          const nextOuts = this.evaluateSRLatch(comp, inputs);
          if (curOuts.out_q !== nextOuts.out_q || curOuts.out_qbar !== nextOuts.out_qbar) {
            compOutputs.set(comp.id, nextOuts);
            changed = true;
          }
          comp.value = nextOuts.out_q;
        } else if (comp.type === ComponentTypes.CHIP) {
          try {
            const chipOuts = this.evaluateChip(comp, inputs, recursionStack);
            let chipDiff = false;
            for (const [k, v] of Object.entries(chipOuts)) {
              if (curOuts[k] !== v) { chipDiff = true; break; }
            }
            if (chipDiff) {
              compOutputs.set(comp.id, chipOuts);
              changed = true;
            }
          } catch (err) {
            this.lastError = err.message;
            return { success: false, cycleDetected: true, error: err.message };
          }
        } else if (comp.type === ComponentTypes.IC) {
          try {
            const icOuts = this.evaluateIC(comp, inputs);
            let icDiff = false;
            for (const [k, v] of Object.entries(icOuts)) {
              if (curOuts[k] !== v) { icDiff = true; break; }
            }
            if (icDiff) {
              compOutputs.set(comp.id, icOuts);
              changed = true;
            }
          } catch (err) {
            this.lastError = err.message;
            return { success: false, cycleDetected: true, error: err.message };
          }
        } else {
          const gateVal = this.evaluateGate(comp.type, inputs, comp.value);
          comp.value = gateVal;
          if (curOuts.out0 !== gateVal) {
            compOutputs.set(comp.id, { out0: gateVal });
            changed = true;
          }
        }
      }

      if (!changed) {
        stable = true;
        break;
      }
      lastOscillatingIds = Array.from(changedCompIds);
    }

    this.commitSequentialStates();

    if (!stable) {
      // If combinational oscillation occurred
      const cyclicIds = lastOscillatingIds.length > 0 ? lastOscillatingIds : components.map(c => c.id);
      this.lastError = `Simulation warning: cycle detected involving ${cyclicIds.join(', ')}.`;
      return { success: false, cycleDetected: true, error: this.lastError, cyclicIds };
    }

    return { success: true, cycleDetected: false };
  }

  // --------------------------------------------------------------------------
  // Central Clock & Timing Subsystem
  // --------------------------------------------------------------------------
  setOnTickCallback(cb) {
    this.onTickCallback = cb;
  }

  setSimulationSpeed(speed) {
    this.simulationSpeed = Math.max(0.1, Math.min(10.0, Number(speed) || 1.0));
  }

  ensureTimerRunning() {
    if (this.clockTimerId) return;
    this.clockTimerId = setInterval(() => {
      this.tick();
    }, 16);
  }

  stopTimer() {
    if (this.clockTimerId) {
      clearInterval(this.clockTimerId);
      this.clockTimerId = null;
    }
  }

  tick() {
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    let anyChanged = false;
    let hasActiveWork = false;

    this.circuit.components.forEach(comp => {
      if (comp.type !== ComponentTypes.CLOCK) return;

      // 1. Process active manual pulse if present
      if (comp.activePulse) {
        hasActiveWork = true;
        const elapsed = (now - comp.activePulse.startTime) * this.simulationSpeed;
        if (elapsed >= comp.activePulse.duration) {
          comp.value = comp.activePulse.revertValue;
          comp.activePulse = null;
          comp.lastToggle = now;
          anyChanged = true;
        }
      }

      // 2. Process continuous square wave if running
      if (comp.running && !comp.activePulse) {
        hasActiveWork = true;
        const freq = comp.frequency || 1;
        const period = comp.period || Math.round(1000 / freq);
        const duty = comp.dutyCycle ?? 50;
        const highTime = period * (duty / 100);
        const lowTime = period - highTime;
        const phaseDuration = comp.value === 1 ? highTime : lowTime;

        if (!comp.lastToggle) comp.lastToggle = now;
        const elapsed = (now - comp.lastToggle) * this.simulationSpeed;

        if (elapsed >= phaseDuration) {
          comp.value = comp.value === 1 ? 0 : 1;
          comp.lastToggle = now;
          anyChanged = true;
        }
      }
    });

    if (anyChanged) {
      this.run();
      this.onTickCallback?.();
    }

    if (!hasActiveWork) {
      this.stopTimer();
    }
  }

  startClock(clockId) {
    const comp = this.circuit.components.get(clockId);
    if (!comp || comp.type !== ComponentTypes.CLOCK) return;
    comp.running = true;
    comp.lastToggle = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    this.ensureTimerRunning();
    this.onTickCallback?.();
  }

  stopClock(clockId) {
    const comp = this.circuit.components.get(clockId);
    if (!comp || comp.type !== ComponentTypes.CLOCK) return;
    comp.running = false;
    comp.activePulse = null;
    this.onTickCallback?.();
  }

  toggleClockRunning(clockId) {
    const comp = this.circuit.components.get(clockId);
    if (!comp || comp.type !== ComponentTypes.CLOCK) return;
    if (comp.running) {
      this.stopClock(clockId);
    } else {
      this.startClock(clockId);
    }
  }

  setClockValue(clockId, val) {
    const comp = this.circuit.components.get(clockId);
    if (!comp || comp.type !== ComponentTypes.CLOCK) return;
    comp.value = val === 1 ? 1 : 0;
    comp.activePulse = null;
    comp.lastToggle = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    this.run();
    this.onTickCallback?.();
  }

  setClockFrequency(clockId, freq) {
    const comp = this.circuit.components.get(clockId);
    if (!comp || comp.type !== ComponentTypes.CLOCK) return;
    const f = Math.max(0.01, Math.min(100, Number(freq) || 1));
    comp.frequency = f;
    comp.period = Math.round(1000 / f);
    this.onTickCallback?.();
  }

  setClockPeriod(clockId, period) {
    const comp = this.circuit.components.get(clockId);
    if (!comp || comp.type !== ComponentTypes.CLOCK) return;
    const p = Math.max(10, Math.min(100000, Math.round(Number(period) || 1000)));
    comp.period = p;
    comp.frequency = Math.round((1000 / p) * 100) / 100;
    this.onTickCallback?.();
  }

  setClockDutyCycle(clockId, duty) {
    const comp = this.circuit.components.get(clockId);
    if (!comp || comp.type !== ComponentTypes.CLOCK) return;
    comp.dutyCycle = Math.max(1, Math.min(99, Math.round(Number(duty) || 50)));
    this.onTickCallback?.();
  }

  triggerPulse(clockId, type = 'HIGH', durationMs = 100) {
    const comp = this.circuit.components.get(clockId);
    if (!comp || comp.type !== ComponentTypes.CLOCK) return;
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    const duration = Math.max(10, Number(durationMs) || 100);

    const isHigh = String(type).toUpperCase() === 'HIGH';
    if (isHigh) {
      comp.value = 1;
      comp.activePulse = {
        type: 'HIGH',
        revertValue: 0,
        startTime: now,
        duration
      };
    } else {
      comp.value = 0;
      comp.activePulse = {
        type: 'LOW',
        revertValue: 1,
        startTime: now,
        duration
      };
    }

    this.run();
    this.ensureTimerRunning();
    this.onTickCallback?.();
  }

  startAllClocks() {
    let count = 0;
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    this.circuit.components.forEach(comp => {
      if (comp.type === ComponentTypes.CLOCK) {
        comp.running = true;
        comp.lastToggle = now;
        count++;
      }
    });
    if (count > 0) {
      this.ensureTimerRunning();
      this.onTickCallback?.();
    }
  }

  stopAllClocks() {
    this.circuit.components.forEach(comp => {
      if (comp.type === ComponentTypes.CLOCK) {
        comp.running = false;
        comp.activePulse = null;
      }
    });
    this.stopTimer();
    this.onTickCallback?.();
  }

  resetSimulation() {
    this.stopAllClocks();
    this.circuit.resetSequentialState();
    this.run();
    this.onTickCallback?.();
  }

  cleanup() {
    this.stopAllClocks();
  }
}
