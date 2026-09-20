/**
 * Boolean Equivalence Verification Engine.
 * Compares a target AST with the canonical circuit graph by truth table.
 */

import { extractASTVariables } from './ast.js';
import { evaluateAST } from './minimizer.js';
import { circuitToAST } from './circuitToAst.js';
import { ComponentTypes, getCleanLabel } from './components.js';

export function verifyEquivalence(targetAst, circuit, outputCompId) {
  if (!targetAst) return { isEquivalent: false, error: 'Target AST is null or invalid.' };

  const astVars = extractASTVariables(targetAst);
  const circuitClone = circuit.clone();
  const circuitInputs = circuitClone.getOrderedInputs
    ? circuitClone.getOrderedInputs()
    : Array.from(circuitClone.components.values()).filter(c => c.type === ComponentTypes.INPUT);
  const circuitVars = circuitInputs.map(c => getCleanLabel(c));
  const allVars = Array.from(new Set([...astVars, ...circuitVars])).sort();

  if (allVars.length === 0) return { isEquivalent: true, totalRows: 1, variables: [] };
  if (allVars.length > 12) {
    return { isEquivalent: false, error: `Too many variables (${allVars.length}). Equivalence check limited to 12 variables.` };
  }

  const totalRows = Math.pow(2, allVars.length);
  let circuitAst = null;
  try {
    circuitAst = circuitToAST(circuitClone, outputCompId);
  } catch (error) {
    return { isEquivalent: false, error: `Circuit evaluation failed: ${error.message}` };
  }

  for (let row = 0; row < totalRows; row++) {
    const varValues = {};
    for (let index = 0; index < allVars.length; index++) {
      varValues[allVars[index]] = (row >> (allVars.length - 1 - index)) & 1;
    }

    const eqVal = evaluateAST(targetAst, varValues);
    const circuitVal = evaluateAST(circuitAst, varValues);
    if (eqVal !== circuitVal) {
      return {
        isEquivalent: false,
        totalRows,
        variables: allVars,
        counterExample: { inputs: varValues, eqVal, circuitVal }
      };
    }
  }

  return { isEquivalent: true, totalRows, variables: allVars, counterExample: null };
}
