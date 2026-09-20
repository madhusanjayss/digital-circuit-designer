/**
 * AST Utilities & Equation Formatter
 * Converts AST node structures into readable or expanded Boolean expressions.
 */

/**
 * Get precedence level of an AST node
 * NOT (3) > AND/NAND (2) > OR/NOR/XOR/XNOR (1)
 */
function getPrecedence(node) {
  if (!node) return 0;
  switch (node.type) {
    case 'VAR':
    case 'CONST':
      return 4;
    case 'NOT':
      return 3;
    case 'AND':
    case 'NAND':
      return 2;
    case 'OR':
    case 'NOR':
    case 'XOR':
    case 'XNOR':
      return 1;
    default:
      return 0;
  }
}

/**
 * Format AST to string expression
 * @param {Object} node - AST node
 * @param {Object} options - { xorMode: 'readable' | 'expanded' }
 */
export function astToString(node, options = { xorMode: 'readable' }) {
  if (!node) return '';

  const mode = options.xorMode || 'readable';

  if (node.type === 'VAR') return node.val;
  if (node.type === 'CONST') return String(node.val);

  if (node.type === 'NOT') {
    const childStr = astToString(node.child, options);
    if (['AND', 'OR', 'NAND', 'NOR', 'XOR', 'XNOR'].includes(node.child.type)) {
      return `(${childStr})'`;
    }
    return `${childStr}'`;
  }

  if (node.type === 'AND') {
    let leftStr = astToString(node.left, options);
    let rightStr = astToString(node.right, options);

    if (getPrecedence(node.left) < getPrecedence(node)) leftStr = `(${leftStr})`;
    if (getPrecedence(node.right) < getPrecedence(node)) rightStr = `(${rightStr})`;

    return `${leftStr}.${rightStr}`;
  }

  if (node.type === 'OR') {
    let leftStr = astToString(node.left, options);
    let rightStr = astToString(node.right, options);

    if (getPrecedence(node.left) < getPrecedence(node)) leftStr = `(${leftStr})`;
    if (getPrecedence(node.right) < getPrecedence(node)) rightStr = `(${rightStr})`;

    return `${leftStr} + ${rightStr}`;
  }

  if (node.type === 'NAND') {
    let leftStr = astToString(node.left, options);
    let rightStr = astToString(node.right, options);
    return `(${leftStr}.${rightStr})'`;
  }

  if (node.type === 'NOR') {
    let leftStr = astToString(node.left, options);
    let rightStr = astToString(node.right, options);
    return `(${leftStr} + ${rightStr})'`;
  }

  if (node.type === 'XOR') {
    let leftStr = astToString(node.left, options);
    let rightStr = astToString(node.right, options);

    if (mode === 'expanded') {
      return `(${leftStr}'${rightStr} + ${leftStr}${rightStr}')`;
    }
    return `${leftStr} XOR ${rightStr}`;
  }

  if (node.type === 'XNOR') {
    let leftStr = astToString(node.left, options);
    let rightStr = astToString(node.right, options);

    if (mode === 'expanded') {
      return `(${leftStr}${rightStr} + ${leftStr}'${rightStr}')`;
    }
    return `${leftStr} XNOR ${rightStr}`;
  }

  return '';
}

/**
 * Extract all unique input variable names (sorted alphabetically) from an AST
 */
export function extractASTVariables(ast) {
  const vars = new Set();

  function traverse(n) {
    if (!n) return;
    if (n.type === 'VAR') {
      vars.add(n.val);
    } else if (n.child) {
      traverse(n.child);
    } else {
      if (n.left) traverse(n.left);
      if (n.right) traverse(n.right);
    }
  }

  traverse(ast);
  return Array.from(vars).sort();
}
