/**
 * Offline Deterministic Boolean Logic Minimizer Engine
 * Executes NNF transformation, SOP distributive expansion, Absorption/Adjacency laws, and Canonical forms.
 */

import { astToString, extractASTVariables } from './ast.js';

/**
 * Phase 1: Negation Normal Form (NNF) Transformation (De Morgan's Laws & Double Negation)
 */
function transformNNF(node, markChanged) {
  if (!node) return null;
  if (node.type === 'VAR' || node.type === 'CONST') return node;

  if (node.type === 'NOT') {
    const c = node.child;
    if (c.type === 'NOT') {
      markChanged();
      return transformNNF(c.child, markChanged);
    }
    if (c.type === 'AND') {
      markChanged();
      return transformNNF({
        type: 'OR',
        left: { type: 'NOT', child: c.left },
        right: { type: 'NOT', child: c.right }
      }, markChanged);
    }
    if (c.type === 'OR') {
      markChanged();
      return transformNNF({
        type: 'AND',
        left: { type: 'NOT', child: c.left },
        right: { type: 'NOT', child: c.right }
      }, markChanged);
    }
  }

  if (node.type === 'AND' || node.type === 'OR') {
    return {
      ...node,
      left: transformNNF(node.left, markChanged),
      right: transformNNF(node.right, markChanged)
    };
  }

  return { ...node, child: transformNNF(node.child, markChanged) };
}

/**
 * Phase 2: Distributive Expansion to SOP
 */
function expandAstToSop(ast) {
  if (!ast) return [];
  if (ast.type === 'CONST') {
    if (ast.val === 0) return [{ lits: [], isZero: true }];
    if (ast.val === 1) return [{ lits: [], isZero: false }];
  }
  if (ast.type === 'VAR') {
    return [{ lits: [{ v: ast.val, inv: false }], isZero: false }];
  }
  if (ast.type === 'NOT') {
    return [{ lits: [{ v: ast.child.val, inv: true }], isZero: false }];
  }
  if (ast.type === 'OR') {
    return expandAstToSop(ast.left).concat(expandAstToSop(ast.right));
  }
  if (ast.type === 'AND') {
    const left = expandAstToSop(ast.left);
    const right = expandAstToSop(ast.right);
    const result = [];
    for (const l of left) {
      for (const r of right) {
        const isZ = l.isZero || r.isZero;
        result.push({ lits: l.lits.concat(r.lits), isZero: isZ });
      }
    }
    return result;
  }
  return [];
}

function formatTerm(term) {
  if (term.isZero) return '0';
  if (term.lits.length === 0) return '1';
  return term.lits.map(l => l.v + (l.inv ? "'" : "")).join('');
}

function formatSop(sop) {
  if (!sop || sop.length === 0) return '0';
  const validTerms = sop.filter(t => !t.isZero);
  if (validTerms.length === 0) return '0';
  return validTerms.map(formatTerm).join(' + ');
}

/**
 * Phase 3: Intra-term reduction (A.A' = 0, A.A = A)
 */
function applyIntraTerm(sop) {
  let changed = false;
  const newSop = sop.map(term => {
    if (term.isZero) return term;
    const seen = {};
    let isZero = false;
    const newLits = [];

    for (const l of term.lits) {
      const key = l.v + (l.inv ? "'" : "");
      const oppKey = l.v + (!l.inv ? "'" : "");
      if (seen[oppKey]) {
        isZero = true;
        changed = true;
        break;
      }
      if (!seen[key]) {
        seen[key] = true;
        newLits.push(l);
      } else {
        changed = true;
      }
    }

    newLits.sort((a, b) => a.v.localeCompare(b.v));
    if (isZero) return { lits: [], isZero: true };
    return { lits: newLits, isZero: false };
  });

  return { sop: newSop, changed };
}

function removeZeros(sop) {
  const originalLength = sop.length;
  let newSop = sop.filter(t => !t.isZero);
  const changed = newSop.length !== originalLength;
  if (newSop.length === 0) newSop = [{ lits: [], isZero: true }];
  return { sop: newSop, changed };
}

function termEquals(t1, t2) {
  if (t1.isZero !== t2.isZero) return false;
  if (t1.isZero) return true;
  if (t1.lits.length !== t2.lits.length) return false;
  for (let i = 0; i < t1.lits.length; i++) {
    if (t1.lits[i].v !== t2.lits[i].v || t1.lits[i].inv !== t2.lits[i].inv) return false;
  }
  return true;
}

function isSubset(tSub, tSuper) {
  if (tSub.isZero || tSuper.isZero) return false;
  for (const lSub of tSub.lits) {
    const found = tSuper.lits.some(lSup => lSup.v === lSub.v && lSup.inv === lSub.inv);
    if (!found) return false;
  }
  return true;
}

/**
 * Phase 4: Inter-term reduction (Absorption, Redundancy, Adjacency)
 */
function applyAbsorption(sop) {
  let changed = false;
  const newSop = [];

  for (let i = 0; i < sop.length; i++) {
    let isAbsorbed = false;
    for (let j = 0; j < sop.length; j++) {
      if (i === j) continue;
      if (isSubset(sop[j], sop[i])) {
        isAbsorbed = true;
        changed = true;
        break;
      }
      if (i > j && termEquals(sop[i], sop[j])) {
        isAbsorbed = true;
        changed = true;
        break;
      }
    }
    if (!isAbsorbed) newSop.push(sop[i]);
  }

  return { sop: newSop, changed };
}

function applyAdjacency(sop) {
  let changed = false;
  for (let i = 0; i < sop.length; i++) {
    for (let j = i + 1; j < sop.length; j++) {
      const t1 = sop[i];
      const t2 = sop[j];
      if (t1.isZero || t2.isZero || t1.lits.length !== t2.lits.length) continue;

      let diffCount = 0;
      let diffIdx = -1;
      for (let k = 0; k < t1.lits.length; k++) {
        if (t1.lits[k].v !== t2.lits[k].v) { diffCount = 2; break; }
        if (t1.lits[k].inv !== t2.lits[k].inv) { diffCount++; diffIdx = k; }
      }

      if (diffCount === 1) {
        const newLits = [...t1.lits];
        newLits.splice(diffIdx, 1);
        const newTerm = { lits: newLits, isZero: false };
        if (!sop.some(t => termEquals(t, newTerm))) {
          sop.push(newTerm);
          changed = true;
          return { sop, changed };
        }
      }
    }
  }
  return { sop, changed };
}

function sopToAst(sop) {
  const validTerms = sop.filter(t => !t.isZero);
  if (validTerms.length === 0) return { type: 'CONST', val: 0 };

  const orNodes = [];
  for (const term of validTerms) {
    if (term.lits.length === 0) return { type: 'CONST', val: 1 };

    const andNodes = [];
    for (const lit of term.lits) {
      let node = { type: 'VAR', val: lit.v };
      if (lit.inv) node = { type: 'NOT', child: node };
      andNodes.push(node);
    }

    let termAst = andNodes[0];
    for (let i = 1; i < andNodes.length; i++) {
      termAst = { type: 'AND', left: termAst, right: andNodes[i] };
    }
    orNodes.push(termAst);
  }

  if (orNodes.length === 0) return { type: 'CONST', val: 0 };

  let finalAst = orNodes[0];
  for (let i = 1; i < orNodes.length; i++) {
    finalAst = { type: 'OR', left: finalAst, right: orNodes[i] };
  }
  return finalAst;
}

/**
 * Execute master Boolean minimization pipeline
 */
export function runMinimizationPipeline(ast) {
  if (!ast) {
    return { steps: [], finalAst: null, finalExpr: '0' };
  }

  const steps = [];
  let currentAst = JSON.parse(JSON.stringify(ast));

  const addStep = (expr, rule) => steps.push({ expr, rule });

  // 1. De Morgan & Double Negation
  let changedNNF = true;
  while (changedNNF) {
    changedNNF = false;
    currentAst = transformNNF(currentAst, () => { changedNNF = true; });
    if (changedNNF) addStep(astToString(currentAst), "De Morgan's / Double Negation");
  }

  // 2. Distributive Expansion
  let sop = expandAstToSop(currentAst);
  const expandedExpr = formatSop(sop);
  addStep(expandedExpr, "Distributive Expansion");

  // 3. Intra-term reduction
  let res = applyIntraTerm(sop);
  sop = res.sop;
  if (res.changed) addStep(formatSop(sop), "Complement / Idempotent Law");

  // 4. Remove Zeros
  res = removeZeros(sop);
  sop = res.sop;
  if (res.changed) addStep(formatSop(sop), "Identity Law (X + 0 = X)");

  // 5. Inter-term reduction loop
  let changing = true;
  let safety = 0;
  while (changing && safety < 100) {
    changing = false;
    safety++;

    res = applyAbsorption(sop);
    if (res.changed) {
      sop = res.sop;
      addStep(formatSop(sop), "Absorption Law (A + AB = A)");
      changing = true;
      continue;
    }

    res = applyAdjacency(sop);
    if (res.changed) {
      sop = res.sop;
      addStep(formatSop(sop), "Adjacency Law (AB + AB' = A)");
      changing = true;
      continue;
    }
  }

  const finalAst = sopToAst(sop);
  const finalExpr = formatSop(sop);

  return { steps, expandedExpr, finalAst, finalExpr };
}

/**
 * Evaluate AST given variable values object e.g. { A: 1, B: 0 }
 */
export function evaluateAST(ast, varValues) {
  if (!ast) return 0;
  if (ast.type === 'CONST') return ast.val;
  if (ast.type === 'VAR') return (varValues[ast.val] || 0) & 1;

  if (ast.type === 'NOT') {
    return (~evaluateAST(ast.child, varValues)) & 1;
  }
  if (ast.type === 'AND') {
    return (evaluateAST(ast.left, varValues) & evaluateAST(ast.right, varValues)) & 1;
  }
  if (ast.type === 'OR') {
    return (evaluateAST(ast.left, varValues) | evaluateAST(ast.right, varValues)) & 1;
  }
  if (ast.type === 'NAND') {
    return (~(evaluateAST(ast.left, varValues) & evaluateAST(ast.right, varValues))) & 1;
  }
  if (ast.type === 'NOR') {
    return (~(evaluateAST(ast.left, varValues) | evaluateAST(ast.right, varValues))) & 1;
  }
  if (ast.type === 'XOR') {
    return (evaluateAST(ast.left, varValues) ^ evaluateAST(ast.right, varValues)) & 1;
  }
  if (ast.type === 'XNOR') {
    return (~(evaluateAST(ast.left, varValues) ^ evaluateAST(ast.right, varValues))) & 1;
  }

  return 0;
}

/**
 * Generate Canonical Forms (Minterms Σm, Maxterms ΠM, Canonical SOP, Canonical POS)
 */
export function generateCanonicalForms(ast) {
  const vars = extractASTVariables(ast);
  if (vars.length === 0) {
    return { minterms: [], maxterms: [], sop: '0', pos: '0' };
  }

  const mintermIndices = [];
  const maxtermIndices = [];

  const totalRows = Math.pow(2, vars.length);
  for (let r = 0; r < totalRows; r++) {
    const varVals = {};
    for (let v = 0; v < vars.length; v++) {
      const bit = (r >> (vars.length - 1 - v)) & 1;
      varVals[vars[v]] = bit;
    }

    const outVal = evaluateAST(ast, varVals);
    if (outVal === 1) {
      mintermIndices.push(r);
    } else {
      maxtermIndices.push(r);
    }
  }

  const mintermStr = `Σm(${mintermIndices.join(',')})`;
  const maxtermStr = `ΠM(${maxtermIndices.join(',')})`;

  return {
    vars,
    mintermIndices,
    maxtermIndices,
    mintermStr,
    maxtermStr
  };
}
