/**
 * AST-to-Circuit Graph Generator and Workspace Auto-Layout.
 */

import { ComponentTypes, isRailComponent } from './components.js';

export function astToCircuit(ast, outputLabel = 'Y', targetCircuit) {
  targetCircuit.clear();

  const inputMap = new Map();

  function buildNode(node) {
    if (!node) return null;

    if (node.type === 'VAR') {
      const varName = node.val.toUpperCase();
      if (!inputMap.has(varName)) {
        const inputComp = targetCircuit.addRailInput(0, varName);
        inputMap.set(varName, inputComp.id);
      }
      return { compId: inputMap.get(varName), outputPinId: 'out0' };
    }

    if (node.type === 'CONST') {
      const constType = node.val === 1 ? ComponentTypes.CONST_1 : ComponentTypes.CONST_0;
      const constComp = targetCircuit.addComponent(constType, 240, 100);
      return { compId: constComp.id, outputPinId: 'out0' };
    }

    if (node.type === 'NOT') {
      const child = buildNode(node.child);
      const notComp = targetCircuit.addComponent(ComponentTypes.NOT, 420, 100);
      if (child) targetCircuit.addConnection(child.compId, child.outputPinId, notComp.id, 'in0');
      return { compId: notComp.id, outputPinId: 'out0' };
    }

    const left = buildNode(node.left);
    const right = buildNode(node.right);
    const gateComp = targetCircuit.addComponent(node.type, 420, 100);
    if (left) targetCircuit.addConnection(left.compId, left.outputPinId, gateComp.id, 'in0');
    if (right) targetCircuit.addConnection(right.compId, right.outputPinId, gateComp.id, 'in1');
    return { compId: gateComp.id, outputPinId: 'out0' };
  }

  const root = buildNode(ast);
  const outComp = targetCircuit.addRailOutput(outputLabel || 'Y');
  if (root) targetCircuit.addConnection(root.compId, root.outputPinId, outComp.id, 'in0');

  targetCircuit.rebuildRailIndexes();
  layoutCircuit(targetCircuit);
}

export function layoutCircuit(circuit) {
  const depthMap = new Map();

  circuit.components.forEach(comp => {
    if (comp.type === ComponentTypes.INPUT || comp.type === ComponentTypes.CONST_0 || comp.type === ComponentTypes.CONST_1) {
      depthMap.set(comp.id, 0);
    }
  });

  let changed = true;
  let iterations = 0;
  while (changed && iterations < circuit.components.size + 5) {
    changed = false;
    iterations++;

    circuit.components.forEach(comp => {
      if (comp.type === ComponentTypes.INPUT || comp.type === ComponentTypes.CONST_0 || comp.type === ComponentTypes.CONST_1) return;
      if (comp.type === ComponentTypes.OUTPUT) return;

      const incomingWires = circuit.connections.filter(wire => wire.toCompId === comp.id);
      if (incomingWires.length === 0) {
        if (!depthMap.has(comp.id)) {
          depthMap.set(comp.id, 1);
          changed = true;
        }
        return;
      }

      let maxParentDepth = -1;
      let allParentsReady = true;
      for (const wire of incomingWires) {
        if (!depthMap.has(wire.fromCompId)) {
          allParentsReady = false;
          break;
        }
        maxParentDepth = Math.max(maxParentDepth, depthMap.get(wire.fromCompId));
      }

      if (allParentsReady) {
        const nextDepth = maxParentDepth + 1;
        if (depthMap.get(comp.id) !== nextDepth) {
          depthMap.set(comp.id, nextDepth);
          changed = true;
        }
      }
    });
  }

  const columns = new Map();
  circuit.components.forEach(comp => {
    if (isRailComponent(comp)) {
      comp.x = 0;
      comp.y = 0;
      comp.rotation = 0;
      return;
    }

    const depth = depthMap.get(comp.id) ?? 1;
    if (!columns.has(depth)) columns.set(depth, []);
    columns.get(depth).push(comp);
  });

  const xStart = 250;
  const xSpacing = 170;
  const yStart = 90;
  const ySpacing = 90;
  Array.from(columns.keys()).sort((a, b) => a - b).forEach((depth, colIndex) => {
    const comps = columns.get(depth).sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id)));
    comps.forEach((comp, rowIndex) => {
      comp.x = xStart + colIndex * xSpacing;
      comp.y = yStart + rowIndex * ySpacing;
    });
  });
}
