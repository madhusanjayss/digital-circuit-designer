/**
 * Central Gate Definitions Table
 * Maps logic gate types to input counts, operations, evaluation functions, AST types, and expressions.
 */

export const GATE_DEFINITIONS = {
  AND: {
    type: 'AND',
    label: 'AND',
    inputCount: 2,
    operation: 'AND',
    astType: 'AND',
    eval: (inputs) => (inputs[0] & inputs[1]) & 1,
    formatDirect: (left, right) => `(${left}.${right})`,
    formatReadable: (left, right) => `(${left}.${right})`
  },
  OR: {
    type: 'OR',
    label: 'OR',
    inputCount: 2,
    operation: 'OR',
    astType: 'OR',
    eval: (inputs) => (inputs[0] | inputs[1]) & 1,
    formatDirect: (left, right) => `(${left} + ${right})`,
    formatReadable: (left, right) => `(${left} + ${right})`
  },
  NOT: {
    type: 'NOT',
    label: 'NOT',
    inputCount: 1,
    operation: 'NOT',
    astType: 'NOT',
    eval: (inputs) => (~inputs[0]) & 1,
    formatDirect: (child) => `${child}'`,
    formatReadable: (child) => `${child}'`
  },
  NAND: {
    type: 'NAND',
    label: 'NAND',
    inputCount: 2,
    operation: 'NAND',
    astType: 'NAND',
    eval: (inputs) => (~(inputs[0] & inputs[1])) & 1,
    formatDirect: (left, right) => `(${left}.${right})'`,
    formatReadable: (left, right) => `(${left}.${right})'`
  },
  NOR: {
    type: 'NOR',
    label: 'NOR',
    inputCount: 2,
    operation: 'NOR',
    astType: 'NOR',
    eval: (inputs) => (~(inputs[0] | inputs[1])) & 1,
    formatDirect: (left, right) => `(${left} + ${right})'`,
    formatReadable: (left, right) => `(${left} + ${right})'`
  },
  XOR: {
    type: 'XOR',
    label: 'XOR',
    inputCount: 2,
    operation: 'XOR',
    astType: 'XOR',
    eval: (inputs) => (inputs[0] ^ inputs[1]) & 1,
    formatDirect: (left, right) => `(${left} XOR ${right})`,
    formatReadable: (left, right) => `(${left} XOR ${right})`,
    formatExpanded: (left, right) => `(${left}'${right} + ${left}${right}')`
  },
  XNOR: {
    type: 'XNOR',
    label: 'XNOR',
    inputCount: 2,
    operation: 'XNOR',
    astType: 'XNOR',
    eval: (inputs) => (~(inputs[0] ^ inputs[1])) & 1,
    formatDirect: (left, right) => `(${left} XNOR ${right})`,
    formatReadable: (left, right) => `(${left} XNOR ${right})`,
    formatExpanded: (left, right) => `(${left}${right} + ${left}'${right}')`
  },
  CONST_0: {
    type: 'CONST_0',
    label: '0',
    inputCount: 0,
    operation: 'CONST',
    astType: 'CONST',
    val: 0,
    eval: () => 0
  },
  CONST_1: {
    type: 'CONST_1',
    label: '1',
    inputCount: 0,
    operation: 'CONST',
    astType: 'CONST',
    val: 1,
    eval: () => 1
  }
};
