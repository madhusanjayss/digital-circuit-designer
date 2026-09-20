/**
 * Circuit-to-AST Analyzer.
 * Traces from rail OUTPUT components back through explicit input pins.
 */

import { ComponentTypes, getComponentPinSpecs, getCleanLabel } from './components.js';
import { astToString } from './ast.js';
import { validateCircuit } from './circuit.js';

export function validateCircuitTopology(circuit) {
  const modelCheck = validateCircuit(circuit);
  if (!modelCheck.valid) {
    return { valid: false, error: modelCheck.errors[0], errors: modelCheck.errors };
  }

  const outputs = circuit.getOrderedOutputs ? circuit.getOrderedOutputs() : Array.from(circuit.components.values()).filter(c => c.type === ComponentTypes.OUTPUT);
  if (outputs.length === 0) return { valid: false, error: 'No output component found in circuit.' };

  for (const outComp of outputs) {
    const wire = circuit.connections.find(w => w.toCompId === outComp.id && w.toPinId === 'in0');
    if (!wire) return { valid: false, error: `Output '${getCleanLabel(outComp)}' has an unconnected input.` };
  }

  for (const comp of circuit.components.values()) {
    if (
      comp.type === ComponentTypes.INPUT ||
      comp.type === ComponentTypes.OUTPUT ||
      comp.type === ComponentTypes.CONST_0 ||
      comp.type === ComponentTypes.CONST_1 ||
      comp.type === ComponentTypes.WIRE ||
      String(comp.type).toLowerCase() === 'wire'
    ) {
      continue;
    }

    const specs = getComponentPinSpecs(comp.type);
    for (const inPin of specs.inputs) {
      const wire = circuit.connections.find(w => w.toCompId === comp.id && w.toPinId === inPin.id);
      if (!wire) return { valid: false, error: `Cannot generate equation: ${getCleanLabel(comp)} gate has an unconnected input.` };
    }
  }

  return { valid: true };
}

export function circuitToAST(circuit, outputCompId) {
  const topology = validateCircuitTopology(circuit);
  if (!topology.valid) throw new Error(topology.error);

  const outComp = circuit.components.get(outputCompId);
  if (!outComp || outComp.type !== ComponentTypes.OUTPUT) throw new Error('Output component not found.');

  const visiting = new Set();

  function trace(compId) {
    if (visiting.has(compId)) throw new Error('Cannot generate equation: circular dependency detected.');
    visiting.add(compId);

    const comp = circuit.components.get(compId);
    if (!comp) {
      visiting.delete(compId);
      throw new Error(`Component '${compId}' not found.`);
    }

    if (comp.type === ComponentTypes.INPUT) {
      visiting.delete(compId);
      return { type: 'VAR', val: getCleanLabel(comp) };
    }
    if (comp.type === ComponentTypes.CONST_0) {
      visiting.delete(compId);
      return { type: 'CONST', val: 0 };
    }
    if (comp.type === ComponentTypes.CONST_1) {
      visiting.delete(compId);
      return { type: 'CONST', val: 1 };
    }
    if (comp.type === ComponentTypes.OUTPUT) {
      const wire = circuit.connections.find(w => w.toCompId === comp.id && w.toPinId === 'in0');
      if (!wire) {
        visiting.delete(compId);
        throw new Error(`Output '${getCleanLabel(comp)}' has no connected input.`);
      }
      const ast = trace(wire.fromCompId);
      visiting.delete(compId);
      return ast;
    }
    if (comp.type === ComponentTypes.WIRE || String(comp.type).toLowerCase() === 'wire') {
      const wire = circuit.connections.find(w => w.toCompId === comp.id && w.toPinId === 'in0');
      if (!wire) {
        visiting.delete(compId);
        return { type: 'CONST', val: comp.value ?? 0 };
      }
      const ast = trace(wire.fromCompId);
      visiting.delete(compId);
      return ast;
    }

    const specs = getComponentPinSpecs(comp.type);
    const inputWires = specs.inputs.map(inPin => {
      const wire = circuit.connections.find(w => w.toCompId === comp.id && w.toPinId === inPin.id);
      if (!wire) throw new Error(`Cannot generate equation: ${getCleanLabel(comp)} gate has an unconnected input.`);
      return wire;
    });

    const buildBinary = type => ({
      type,
      left: trace(inputWires[0].fromCompId),
      right: trace(inputWires[1].fromCompId)
    });

    let ast = null;
    if (comp.type === ComponentTypes.NOT) ast = { type: 'NOT', child: trace(inputWires[0].fromCompId) };
    else if (comp.type === ComponentTypes.AND) ast = buildBinary('AND');
    else if (comp.type === ComponentTypes.OR) ast = buildBinary('OR');
    else if (comp.type === ComponentTypes.NAND) ast = buildBinary('NAND');
    else if (comp.type === ComponentTypes.NOR) ast = buildBinary('NOR');
    else if (comp.type === ComponentTypes.XOR) ast = buildBinary('XOR');
    else if (comp.type === ComponentTypes.XNOR) ast = buildBinary('XNOR');
    else throw new Error(`Unsupported gate type: ${comp.type}`);

    visiting.delete(compId);
    return ast;
  }

  return trace(outputCompId);
}

export function generateAllCircuitEquations(circuit, options = { xorMode: 'readable' }) {
  const outputs = circuit.getOrderedOutputs ? circuit.getOrderedOutputs() : Array.from(circuit.components.values()).filter(c => c.type === ComponentTypes.OUTPUT);
  return outputs.map(outComp => {
    const label = getCleanLabel(outComp) || 'O';
    try {
      const ast = circuitToAST(circuit, outComp.id);
      const directExpr = astToString(ast, options);
      return { outputId: outComp.id, label, ast, directExpr: `${label} = ${directExpr}`, error: null };
    } catch (error) {
      return { outputId: outComp.id, label, ast: null, directExpr: null, error: error.message };
    }
  });
}

export function explainCircuit(circuit, outputCompId) {
  const outComp = circuit.components.get(outputCompId);
  if (!outComp) return [];

  const steps = [];
  const compSignalNames = new Map();
  let signalCounter = 1;
  const visited = new Set();

  function traverse(compId) {
    if (visited.has(compId)) return;
    visited.add(compId);

    const comp = circuit.components.get(compId);
    if (!comp) return;

    if (comp.type === ComponentTypes.INPUT) {
      compSignalNames.set(compId, getCleanLabel(comp));
      return;
    }
    if (comp.type === ComponentTypes.CONST_0) {
      compSignalNames.set(compId, '0');
      return;
    }
    if (comp.type === ComponentTypes.CONST_1) {
      compSignalNames.set(compId, '1');
      return;
    }
    if (comp.type === ComponentTypes.OUTPUT) {
      const wire = circuit.connections.find(w => w.toCompId === compId && w.toPinId === 'in0');
      if (wire) traverse(wire.fromCompId);
      return;
    }

    const specs = getComponentPinSpecs(comp.type);
    const inSignals = specs.inputs.map(inPin => {
      const wire = circuit.connections.find(w => w.toCompId === comp.id && w.toPinId === inPin.id);
      if (!wire) return '?';
      traverse(wire.fromCompId);
      return compSignalNames.get(wire.fromCompId) || '?';
    });

    const isFinalOutput = circuit.connections.some(
      wire => wire.fromCompId === comp.id && circuit.components.get(wire.toCompId)?.type === ComponentTypes.OUTPUT
    );
    const outputSignal = isFinalOutput ? getCleanLabel(outComp) : `X${signalCounter++}`;
    compSignalNames.set(comp.id, outputSignal);

    const exprByType = {
      [ComponentTypes.NOT]: `${inSignals[0]}'`,
      [ComponentTypes.AND]: `${inSignals[0]}.${inSignals[1]}`,
      [ComponentTypes.OR]: `${inSignals[0]} + ${inSignals[1]}`,
      [ComponentTypes.NAND]: `(${inSignals[0]}.${inSignals[1]})'`,
      [ComponentTypes.NOR]: `(${inSignals[0]} + ${inSignals[1]})'`,
      [ComponentTypes.XOR]: `${inSignals[0]} XOR ${inSignals[1]}`,
      [ComponentTypes.XNOR]: `${inSignals[0]} XNOR ${inSignals[1]}`
    };

    steps.push({
      stepNumber: steps.length + 1,
      gateType: comp.type,
      inputs: inSignals,
      outputSignal,
      equation: `${outputSignal} = ${exprByType[comp.type] || '?'}`
    });
  }

  traverse(outputCompId);
  return steps;
}
