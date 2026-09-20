/**
 * Boolean Expression Parser
 * Tokenizes and parses Boolean expressions into AST representations.
 */

export class BooleanParser {
  constructor(expression) {
    this.rawExpression = expression || '';
    this.outputLabel = 'F';
    this.cleanExpr = this.extractLabel(expression);
    this.tokens = this.tokenize(this.cleanExpr);
    this.pos = 0;
  }

  /**
   * Extract output label from expression if present (e.g., "F = A.B + C'" -> label "F", expr "A.B + C'")
   */
  extractLabel(expr) {
    if (!expr) return '';
    const parts = expr.split('=');
    if (parts.length === 2) {
      this.outputLabel = parts[0].trim().toUpperCase() || 'F';
      return parts[1].trim();
    }
    return expr.trim();
  }

  /**
   * Tokenize string into token stream
   */
  tokenize(str) {
    if (!str) return [];
    const tokens = [];
    let i = 0;

    while (i < str.length) {
      const char = str[i];

      if (/\s/.test(char)) {
        i++;
        continue;
      }

      if (char === '+') {
        tokens.push({ type: 'OR', val: '+' });
        i++;
      } else if (char === '.') {
        tokens.push({ type: 'AND', val: '.' });
        i++;
      } else if (char === "'") {
        tokens.push({ type: 'NOT', val: "'" });
        i++;
      } else if (char === '(') {
        tokens.push({ type: 'LPAREN', val: '(' });
        i++;
      } else if (char === ')') {
        tokens.push({ type: 'RPAREN', val: ')' });
        i++;
      } else if (char === '0') {
        tokens.push({ type: 'CONST', val: 0 });
        i++;
      } else if (char === '1') {
        tokens.push({ type: 'CONST', val: 1 });
        i++;
      } else if (/[a-zA-Z]/.test(char)) {
        // Read identifier or word operator
        let ident = '';
        while (i < str.length && /[a-zA-Z0-9_]/.test(str[i])) {
          ident += str[i];
          i++;
        }
        const upper = ident.toUpperCase();

        if (upper === 'AND') tokens.push({ type: 'AND', val: '.' });
        else if (upper === 'OR') tokens.push({ type: 'OR', val: '+' });
        else if (upper === 'NOT') tokens.push({ type: 'PREFIX_NOT', val: 'NOT' });
        else if (upper === 'NAND') tokens.push({ type: 'NAND', val: 'NAND' });
        else if (upper === 'NOR') tokens.push({ type: 'NOR', val: 'NOR' });
        else if (upper === 'XOR') tokens.push({ type: 'XOR', val: 'XOR' });
        else if (upper === 'XNOR') tokens.push({ type: 'XNOR', val: 'XNOR' });
        else {
          // If multi-character variable (e.g., AB when user didn't space), break into single letters
          for (let k = 0; k < ident.length; k++) {
            tokens.push({ type: 'VAR', val: ident[k].toUpperCase() });
          }
        }
      } else {
        throw new Error(`Invalid character in expression: '${char}'`);
      }
    }

    // Insert implicit ANDs (e.g., AB -> A.B, A(B) -> A.(B), (A+B)'C -> (A+B)'.C)
    const finalTokens = [];
    for (let j = 0; j < tokens.length; j++) {
      finalTokens.push(tokens[j]);
      if (j < tokens.length - 1) {
        const t1 = tokens[j];
        const t2 = tokens[j + 1];

        const t1Valid = ['VAR', 'CONST', 'NOT', 'RPAREN'].includes(t1.type);
        const t2Valid = ['VAR', 'CONST', 'LPAREN', 'PREFIX_NOT'].includes(t2.type);

        if (t1Valid && t2Valid) {
          finalTokens.push({ type: 'AND', val: '.' });
        }
      }
    }

    return finalTokens;
  }

  match(type) {
    if (this.pos < this.tokens.length && this.tokens[this.pos].type === type) {
      return this.tokens[this.pos++];
    }
    return null;
  }

  peek() {
    return this.tokens[this.pos] || null;
  }

  parse() {
    if (this.tokens.length === 0) {
      throw new Error("Expression is empty.");
    }
    const ast = this.parseExpression();
    if (this.pos < this.tokens.length) {
      const remaining = this.tokens[this.pos];
      if (remaining.type === 'RPAREN') {
        throw new Error("Unexpected closing parenthesis.");
      }
      throw new Error(`Unexpected token at end of expression: '${remaining.val}'`);
    }
    return { ast, label: this.outputLabel };
  }

  // Precedence: OR / XOR / XNOR < AND / NAND / NOR < NOT (Postfix/Prefix)

  parseExpression() {
    let node = this.parseTerm();
    while (true) {
      if (this.match('OR')) {
        node = { type: 'OR', left: node, right: this.parseTerm() };
      } else if (this.match('XOR')) {
        node = { type: 'XOR', left: node, right: this.parseTerm() };
      } else if (this.match('XNOR')) {
        node = { type: 'XNOR', left: node, right: this.parseTerm() };
      } else if (this.match('NOR')) {
        node = { type: 'NOR', left: node, right: this.parseTerm() };
      } else {
        break;
      }
    }
    return node;
  }

  parseTerm() {
    let node = this.parseFactor();
    while (true) {
      if (this.match('AND')) {
        node = { type: 'AND', left: node, right: this.parseFactor() };
      } else if (this.match('NAND')) {
        node = { type: 'NAND', left: node, right: this.parseFactor() };
      } else {
        break;
      }
    }
    return node;
  }

  parseFactor() {
    let prefixNot = false;
    if (this.match('PREFIX_NOT')) {
      prefixNot = true;
    }

    let node = this.parsePrimary();

    // Postfix NOT operator (')
    while (this.match('NOT')) {
      node = { type: 'NOT', child: node };
    }

    if (prefixNot) {
      node = { type: 'NOT', child: node };
    }

    return node;
  }

  parsePrimary() {
    const varToken = this.match('VAR');
    if (varToken) {
      return { type: 'VAR', val: varToken.val };
    }

    const constToken = this.match('CONST');
    if (constToken) {
      return { type: 'CONST', val: constToken.val };
    }

    if (this.match('LPAREN')) {
      const node = this.parseExpression();
      if (!this.match('RPAREN')) {
        throw new Error("Missing closing parenthesis ')'.");
      }
      return node;
    }

    const next = this.peek();
    if (next) {
      if (next.type === 'OR' || next.type === 'AND') {
        throw new Error(`Unexpected operator '${next.val}'.`);
      }
      throw new Error(`Unexpected token '${next.val}'.`);
    }

    throw new Error("Unexpected end of expression.");
  }
}

/**
 * Helper to parse equation string directly
 */
export function parseExpression(exprString) {
  const parser = new BooleanParser(exprString);
  return parser.parse();
}
