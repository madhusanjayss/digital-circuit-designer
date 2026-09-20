/* ==========================================================================
   Truth Table Generator Module with Integrated Boolean Logic Expressions
   ========================================================================== */

import { ComponentTypes, getCleanLabel } from './components.js';
import { Simulator } from './simulator.js';
import { Circuit } from './circuit.js';
import { generateAllCircuitEquations } from './circuitToAst.js';
import { runMinimizationPipeline, generateCanonicalForms } from './minimizer.js';
import { parseExpression } from './parser.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Derive Boolean expression and canonical minterms directly from truth table rows
 */
export function deriveExpressionsFromRows(inputLabels, outputLabels, rows) {
  return outputLabels.map((outName, outIdx) => {
    const mintermIndices = [];
    const mintermTerms = [];

    // Sort rows by ascending binary inputs
    const sortedBinaryRows = [...rows].sort((a, b) => {
      let aVal = 0, bVal = 0;
      for (let i = 0; i < a.inputs.length; i++) {
        aVal = (aVal << 1) | a.inputs[i];
        bVal = (bVal << 1) | b.inputs[i];
      }
      return aVal - bVal;
    });

    sortedBinaryRows.forEach(row => {
      let idx = 0;
      for (let i = 0; i < row.inputs.length; i++) {
        idx = (idx << 1) | row.inputs[i];
      }
      if (row.outputs[outIdx] === 1) {
        mintermIndices.push(idx);
        const termLits = row.inputs.map((bit, bitIdx) => {
          const varName = inputLabels[bitIdx] || `IN_${bitIdx + 1}`;
          return bit === 1 ? varName : `${varName}'`;
        });
        mintermTerms.push(termLits.join('.'));
      }
    });

    let sop = '0';
    if (mintermIndices.length === sortedBinaryRows.length && sortedBinaryRows.length > 0) {
      sop = '1';
    } else if (mintermTerms.length > 0) {
      sop = mintermTerms.join(' + ');
    }

    const mintermStr = mintermIndices.length > 0 ? `Σm(${mintermIndices.join(', ')})` : 'Σm(∅)';

    let simplified = sop;
    if (sop !== '0' && sop !== '1') {
      try {
        const parsed = parseExpression(sop);
        if (parsed && parsed.ast) {
          const minRes = runMinimizationPipeline(parsed.ast);
          if (minRes && minRes.finalExpr) {
            simplified = minRes.finalExpr;
          }
        }
      } catch (_) {}
    }

    return {
      outputName: outName,
      directExpr: sop,
      simplifiedExpr: simplified,
      mintermStr
    };
  });
}

/**
 * Get direct equations for circuit output components using topological AST
 */
function getCircuitOutputExpressions(circuit, outputs) {
  const expressions = [];
  try {
    const eqResults = generateAllCircuitEquations(circuit, { xorMode: 'readable' });
    eqResults.forEach(r => {
      if (r && !r.error && r.directExpr) {
        let simplified = null;
        let minterms = null;
        if (r.ast) {
          try {
            const minRes = runMinimizationPipeline(r.ast);
            if (minRes && minRes.finalExpr) simplified = minRes.finalExpr;
            const canonRes = generateCanonicalForms(r.ast);
            if (canonRes && canonRes.mintermStr) minterms = canonRes.mintermStr;
          } catch (_) {}
        }
        expressions.push({
          outputName: r.label,
          directExpr: r.directExpr.replace(/^[^=]+=\s*/, ''),
          simplifiedExpr: simplified,
          mintermStr: minterms
        });
      }
    });
  } catch (_) {}
  return expressions;
}

/**
 * Build HTML markup for the Boolean Expressions panel in the Truth Table modal
 */
function renderExpressionsPanel(expressions) {
  if (!expressions || expressions.length === 0) return '';

  let html = `
    <div class="truthtable-expressions-panel" style="margin-bottom: 14px; padding: 12px 14px; background: #f8fafc; border: 1px solid var(--border-light, #e2e8f0); border-radius: 8px;">
      <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted, #64748b); margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;">
        <span>Boolean Logic Expression(s)</span>
        <span style="font-size: 10px; font-weight: 600; color: #0284c7; background: #e0f2fe; padding: 2px 6px; border-radius: 4px;">Live Equation</span>
      </div>
      <div style="display: flex; flex-direction: column; gap: 6px;">
  `;

  expressions.forEach(expr => {
    const mainExpr = expr.simplifiedExpr || expr.directExpr || '0';
    const showDirect = expr.directExpr && expr.simplifiedExpr && expr.directExpr !== expr.simplifiedExpr;

    html += `
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px; font-family: 'Courier New', monospace; font-size: 13px; color: var(--text-color, #1e293b); background: #ffffff; padding: 7px 10px; border-radius: 6px; border: 1px solid #e2e8f0;">
        <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 6px;">
          <span style="font-weight: 700; color: var(--accent-primary, #2563eb); font-size: 14px;">${escapeHtml(expr.outputName)}</span>
          <span style="color: #64748b; font-weight: 600;">=</span>
          <span style="font-weight: 700; color: #0f172a;">${escapeHtml(mainExpr)}</span>
          ${showDirect ? `<span style="font-size: 11px; color: #64748b; margin-left: 6px;">(raw: ${escapeHtml(expr.directExpr)})</span>` : ''}
        </div>
        ${expr.mintermStr ? `<span style="font-size: 11px; color: #64748b; font-weight: 600; background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">${escapeHtml(expr.mintermStr)}</span>` : ''}
      </div>
    `;
  });

  html += `</div></div>`;
  return html;
}

export function generateTruthTable(circuit, mode = 'binary') {
  const allInputs = circuit.getOrderedInputs
    ? circuit.getOrderedInputs()
    : Array.from(circuit.components.values()).filter(c => c.type === ComponentTypes.INPUT);
  const allOutputs = circuit.getOrderedOutputs
    ? circuit.getOrderedOutputs()
    : Array.from(circuit.components.values()).filter(c => c.type === ComponentTypes.OUTPUT);

  const connectedInputs = allInputs.filter(inp => circuit.connections.some(w => w.fromCompId === inp.id || w.toCompId === inp.id));
  const inputs = connectedInputs.length > 0 ? connectedInputs : allInputs.slice(0, 8);

  const connectedOutputs = allOutputs.filter(out => circuit.connections.some(w => w.fromCompId === out.id || w.toCompId === out.id));
  const outputs = connectedOutputs.length > 0 ? connectedOutputs : allOutputs.slice(0, 8);

  if (inputs.length === 0) {
    return `<div style="padding: 16px; color: #ef4444; text-align: center;">Please place at least one <strong>Input</strong> component on the canvas.</div>`;
  }
  if (outputs.length === 0) {
    return `<div style="padding: 16px; color: #ef4444; text-align: center;">Please place at least one <strong>Output</strong> light component on the canvas.</div>`;
  }

  const hasSequential = Array.from(circuit.components.values()).some(
    c => c.type === ComponentTypes.CLOCK || c.type === ComponentTypes.D_LATCH || c.type === ComponentTypes.SR_LATCH
  );
  if (hasSequential) {
    return `<div style="padding: 24px 16px; text-align: center;">
      <div style="font-size: 14px; font-weight: 700; color: #d97706; margin-bottom: 8px;">
        Sequential circuit: truth table depends on previous state.
      </div>
      <div style="font-size: 12px; color: var(--text-muted, #64748b); max-width: 440px; margin: 0 auto; line-height: 1.5;">
        Latches and clock components are stateful devices where output depends on internal memory and temporal events rather than pure combinational input values.
      </div>
    </div>`;
  }

  const numInputs = inputs.length;
  if (numInputs > 12) {
    return `<div style="padding: 16px; color: #ef4444; text-align: center;">Truth table is limited to 12 connected inputs. Current circuit has <strong>${numInputs}</strong>.</div>`;
  }
  const totalCombinations = Math.pow(2, numInputs);
  const tableRows = [];

  // Clone circuit once for ultra-fast evaluation
  const circuitClone = circuit.clone();
  const simulator = new Simulator(circuitClone);
  const cloneInputs = inputs.map(inp => circuitClone.components.get(inp.id));
  const cloneOutputs = outputs.map(out => circuitClone.components.get(out.id));

  // For 'boolean' (T and F), start with True first (descending: 11..1 down to 00..0, e.g. T T, T F, F T, F F)
  // For 'binary' (0s and 1s), start with 0 first (ascending: 00..0 up to 11..1, e.g. 0 0, 0 1, 1 0, 1 1)
  if (mode === 'boolean') {
    for (let i = totalCombinations - 1; i >= 0; i--) {
      const inputBits = [];
      for (let j = numInputs - 1; j >= 0; j--) {
        const bit = Math.floor(i / Math.pow(2, j)) % 2;
        inputBits.push(bit);
      }

      cloneInputs.forEach((cloneInp, idx) => {
        if (cloneInp) cloneInp.value = inputBits[idx];
      });

      const simResult = simulator.run();
      if (!simResult.success) {
        return `<div style="padding: 16px; color: #ef4444; text-align: center;">${simResult.error || 'Simulation failed while generating the truth table.'}</div>`;
      }

      const outputBits = cloneOutputs.map(cloneOut => cloneOut ? cloneOut.value : 0);

      tableRows.push({
        inputs: inputBits,
        outputs: outputBits
      });
    }
  } else {
    for (let i = 0; i < totalCombinations; i++) {
      const inputBits = [];
      for (let j = numInputs - 1; j >= 0; j--) {
        const bit = Math.floor(i / Math.pow(2, j)) % 2;
        inputBits.push(bit);
      }

      cloneInputs.forEach((cloneInp, idx) => {
        if (cloneInp) cloneInp.value = inputBits[idx];
      });

      const simResult = simulator.run();
      if (!simResult.success) {
        return `<div style="padding: 16px; color: #ef4444; text-align: center;">${simResult.error || 'Simulation failed while generating the truth table.'}</div>`;
      }

      const outputBits = cloneOutputs.map(cloneOut => cloneOut ? cloneOut.value : 0);

      tableRows.push({
        inputs: inputBits,
        outputs: outputBits
      });
    }
  }

  const formatVal = (bit) => {
    if (mode === 'boolean') {
      return bit === 1 ? 'T' : 'F';
    }
    return bit === 1 ? '1' : '0';
  };

  const inputLabels = inputs.map((inp, idx) => getCleanLabel(inp) || String.fromCharCode(65 + idx));
  const outputLabels = outputs.map((out, idx) => getCleanLabel(out) || ('OUT_' + (idx + 1)));

  // Try topological AST first, fallback to truth-table derivation
  let expressions = getCircuitOutputExpressions(circuit, outputs);
  if (expressions.length === 0) {
    expressions = deriveExpressionsFromRows(inputLabels, outputLabels, tableRows);
  }

  const exprMap = new Map();
  expressions.forEach(e => exprMap.set(e.outputName, e));

  // Construct HTML Output
  let html = renderExpressionsPanel(expressions);

  html += `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 12px; color: var(--text-muted, #64748b);">
      <span>Inputs: <strong>${numInputs}</strong> | Outputs: <strong>${outputs.length}</strong></span>
      <span>Total Rows: <strong>${totalCombinations.toLocaleString()}</strong> combinations</span>
    </div>
    <div style="max-height: 480px; overflow-y: auto; overflow-x: auto; border: 1px solid var(--border-light, #e2e8f0); border-radius: 6px;">
      <table class="truth-table" style="margin-top: 0;">
        <thead style="position: sticky; top: 0; z-index: 2;">
          <tr>
  `;

  // Headers
  inputLabels.forEach(inpName => {
    html += `<th>${escapeHtml(inpName)}</th>`;
  });

  html += `<th style="width: 12px; background: #cbd5e1;"></th>`;

  outputLabels.forEach(outName => {
    html += `<th>${escapeHtml(outName)}</th>`;
  });

  html += `</tr></thead><tbody>`;

  // Rows
  tableRows.forEach(row => {
    html += `<tr>`;
    row.inputs.forEach(val => {
      html += `<td class="${val === 1 ? 'high-val' : 'low-val'}">${formatVal(val)}</td>`;
    });
    html += `<td style="background: #cbd5e1;"></td>`;
    row.outputs.forEach(val => {
      html += `<td class="${val === 1 ? 'high-val' : 'low-val'}">${formatVal(val)}</td>`;
    });
    html += `</tr>`;
  });

  html += `</tbody></table></div>`;
  return html;
}

export function generateChipTruthTable(chip, mode = 'binary') {
  if (!chip || !chip.chipData || !chip.chipData.circuit) {
    return `<div style="padding: 16px; color: #ef4444; text-align: center;">Invalid or empty chip definition.</div>`;
  }

  const chipInterface = chip.chipData.interface || chip.chipData;
  const chipInputs = Array.isArray(chipInterface.inputs) ? chipInterface.inputs : [];
  const chipOutputs = Array.isArray(chipInterface.outputs) ? chipInterface.outputs : [];

  if (chipInputs.length === 0) {
    return `<div style="padding: 16px; color: #ef4444; text-align: center;">Chip <strong>${escapeHtml(chip.name || 'CHIP')}</strong> has no input pins.</div>`;
  }
  if (chipOutputs.length === 0) {
    return `<div style="padding: 16px; color: #ef4444; text-align: center;">Chip <strong>${escapeHtml(chip.name || 'CHIP')}</strong> has no output pins.</div>`;
  }

  const numInputs = chipInputs.length;
  if (numInputs > 12) {
    return `<div style="padding: 16px; color: #ef4444; text-align: center;">Truth table is limited to 12 inputs. Chip has <strong>${numInputs}</strong>.</div>`;
  }

  const totalCombinations = Math.pow(2, numInputs);
  const tableRows = [];
  const simulator = new Simulator(new Circuit());

  for (let i = 0; i < totalCombinations; i++) {
    const inputBits = [];
    const inputMap = {};

    for (let j = numInputs - 1; j >= 0; j--) {
      const bit = Math.floor(i / Math.pow(2, j)) % 2;
      inputBits.push(bit);
    }

    chipInputs.forEach((inp, idx) => {
      inputMap[inp.id] = inputBits[idx];
    });

    let evaluatedOutputs = {};
    try {
      evaluatedOutputs = simulator.evaluateChip(chip, inputMap);
    } catch (err) {
      return `<div style="padding: 16px; color: #ef4444; text-align: center;">${escapeHtml(err.message)}</div>`;
    }

    const outputBits = chipOutputs.map(out => evaluatedOutputs[out.id] === 1 ? 1 : 0);

    tableRows.push({
      inputs: inputBits,
      outputs: outputBits
    });
  }

  if (mode === 'boolean') {
    tableRows.reverse();
  }

  const formatVal = bit => (mode === 'boolean' ? (bit === 1 ? 'T' : 'F') : (bit === 1 ? '1' : '0'));

  const inputLabels = chipInputs.map((inp, idx) => inp.name || inp.id || `IN_${idx + 1}`);
  const outputLabels = chipOutputs.map((out, idx) => out.name || out.id || `OUT_${idx + 1}`);

  // Derive expressions for chip outputs
  const expressions = deriveExpressionsFromRows(inputLabels, outputLabels, tableRows);
  const exprMap = new Map();
  expressions.forEach(e => exprMap.set(e.outputName, e));

  let html = renderExpressionsPanel(expressions);

  html += `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 12px; color: var(--text-muted, #64748b);">
      <span>Chip: <strong>${escapeHtml(chip.name || 'CHIP')}</strong> (Inputs: <strong>${numInputs}</strong> | Outputs: <strong>${chipOutputs.length}</strong>)</span>
      <span>Total Rows: <strong>${totalCombinations.toLocaleString()}</strong> combinations</span>
    </div>
    <div style="max-height: 480px; overflow-y: auto; overflow-x: auto; border: 1px solid var(--border-light, #e2e8f0); border-radius: 6px;">
      <table class="truth-table" style="margin-top: 0;">
        <thead style="position: sticky; top: 0; z-index: 2;">
          <tr>
  `;

  chipInputs.forEach(inp => {
    html += `<th>${escapeHtml(inp.name || inp.id)}</th>`;
  });

  html += `<th style="width: 12px; background: #cbd5e1;"></th>`;

  chipOutputs.forEach(out => {
    const outName = out.name || out.id;
    html += `<th>${escapeHtml(outName)}</th>`;
  });

  html += `</tr></thead><tbody>`;

  tableRows.forEach(row => {
    html += `<tr>`;
    row.inputs.forEach(val => {
      html += `<td class="${val === 1 ? 'high-val' : 'low-val'}">${formatVal(val)}</td>`;
    });
    html += `<td style="background: #cbd5e1;"></td>`;
    row.outputs.forEach(val => {
      html += `<td class="${val === 1 ? 'high-val' : 'low-val'}">${formatVal(val)}</td>`;
    });
    html += `</tr>`;
  });

  html += `</tbody></table></div>`;
  return html;
}
