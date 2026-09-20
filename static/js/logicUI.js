/**
 * Boolean Logic Panel UI Controller
 * Handles Equation -> Circuit generation, live Circuit -> Equation display, equivalence verification, and educational walkthroughs.
 */

import { parseExpression } from './parser.js';
import { astToString } from './ast.js';
import { astToCircuit } from './astToCircuit.js';
import { generateAllCircuitEquations, explainCircuit, validateCircuitTopology } from './circuitToAst.js';
import { runMinimizationPipeline, generateCanonicalForms } from './minimizer.js';
import { verifyEquivalence } from './equivalence.js';

export class LogicUI {
  constructor(circuit, renderer, simulator, history, uiCallbacks) {
    this.circuit = circuit;
    this.renderer = renderer;
    this.simulator = simulator;
    this.history = history;
    this.uiCallbacks = uiCallbacks;

    this.xorMode = 'readable'; // 'readable' | 'expanded'
    this.currentAST = null;
    this.currentOutputLabel = 'F';

    this.initElements();
    this.bindEvents();
  }

  initElements() {
    this.exprInput = document.getElementById('logic-expr-input');
    this.btnGenerate = document.getElementById('btn-logic-generate');

    this.directExprBox = document.getElementById('logic-direct-expr');
    this.simplifiedExprBox = document.getElementById('logic-simplified-expr');
    this.canonicalExprBox = document.getElementById('logic-canonical-expr');
    this.equationErrorBox = document.getElementById('logic-equation-error');

    this.btnCopyExpr = document.getElementById('btn-copy-expr');
    this.btnSimplify = document.getElementById('btn-simplify-expr');
    this.btnVerify = document.getElementById('btn-verify-equivalence');
    this.btnExplain = document.getElementById('btn-explain-circuit');

    this.toggleXorReadable = document.getElementById('xor-opt-readable');
    this.toggleXorExpanded = document.getElementById('xor-opt-expanded');

    // Confirm Replace Modal Elements
    this.modalConfirmReplace = document.getElementById('modal-confirm-replace');
    this.btnConfirmReplace = document.getElementById('btn-confirm-replace');
    this.pendingExpression = null;
  }

  bindEvents() {
    if (this.btnGenerate && this.exprInput) {
      this.btnGenerate.addEventListener('click', () => this.handleGenerateCircuit());
      this.exprInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.handleGenerateCircuit();
      });
    }

    if (this.btnCopyExpr) {
      this.btnCopyExpr.addEventListener('click', () => this.copyCurrentEquation());
    }

    if (this.btnSimplify) {
      this.btnSimplify.addEventListener('click', () => this.showMinimizationSteps());
    }

    if (this.btnVerify) {
      this.btnVerify.addEventListener('click', () => this.handleVerifyEquivalence());
    }

    if (this.btnExplain) {
      this.btnExplain.addEventListener('click', () => this.handleExplainCircuit());
    }

    if (this.toggleXorReadable && this.toggleXorExpanded) {
      this.toggleXorReadable.addEventListener('change', () => {
        if (this.toggleXorReadable.checked) {
          this.xorMode = 'readable';
          this.updateLiveEquations();
        }
      });
      this.toggleXorExpanded.addEventListener('change', () => {
        if (this.toggleXorExpanded.checked) {
          this.xorMode = 'expanded';
          this.updateLiveEquations();
        }
      });
    }

    if (this.btnConfirmReplace && this.modalConfirmReplace) {
      this.btnConfirmReplace.addEventListener('click', () => {
        this.closeModal('modal-confirm-replace');
        if (this.pendingExpression) {
          this.executeGenerateCircuit(this.pendingExpression);
          this.pendingExpression = null;
        }
      });
    }
  }

  /**
   * Handle Equation -> Circuit button click
   */
  handleGenerateCircuit() {
    const rawExpr = this.exprInput.value.trim();
    if (!rawExpr) {
      this.uiCallbacks.onToast('Please enter a Boolean equation.');
      return;
    }

    // Check if circuit canvas has existing user components -> ask confirmation before replacing!
    if (this.circuit.components.size > 0) {
      this.pendingExpression = rawExpr;
      this.openModal('modal-confirm-replace');
      return;
    }

    this.executeGenerateCircuit(rawExpr);
  }

  /**
   * Parse equation and generate editable circuit graph
   */
  executeGenerateCircuit(exprString) {
    try {
      const { ast, label } = parseExpression(exprString);
      this.currentAST = ast;
      this.currentOutputLabel = label || 'F';

      this.history.beginTransaction('generate circuit');

      // Convert AST to real editable circuit graph
      astToCircuit(ast, this.currentOutputLabel, this.circuit);
      this.history.commitTransaction();

      // Run simulation & update canvas view
      this.simulator.run();
      this.renderer.resetZoomPan();
      this.renderer.render(this.circuit);
      this.uiCallbacks.onCircuitUpdated();

      this.uiCallbacks.onToast(`Generated circuit for equation: ${exprString}`);
      this.updateLiveEquations();

    } catch (err) {
      this.history.cancelTransaction();
      this.showEquationError(`Invalid Boolean expression: ${err.message}`);
      this.uiCallbacks.onToast(`Syntax Error: ${err.message}`);
    }
  }

  /**
   * Live Circuit -> Equation Update (called whenever circuit topology changes)
   */
  updateLiveEquations() {
    if (!this.directExprBox) return;

    this.hideEquationError();

    // 1. Topology validation
    const topCheck = validateCircuitTopology(this.circuit);
    if (!topCheck.valid) {
      this.directExprBox.textContent = '-';
      this.simplifiedExprBox.textContent = '-';
      this.canonicalExprBox.textContent = '-';
      this.showEquationError(topCheck.error);
      return;
    }

    // 2. Generate equations for output components
    const eqResults = generateAllCircuitEquations(this.circuit, { xorMode: this.xorMode });
    if (eqResults.length === 0) {
      this.directExprBox.textContent = 'No outputs';
      return;
    }

    const firstEq = eqResults[0];
    if (firstEq.error) {
      this.directExprBox.textContent = '-';
      this.simplifiedExprBox.textContent = '-';
      this.canonicalExprBox.textContent = '-';
      this.showEquationError(firstEq.error);
      return;
    }

    this.currentAST = firstEq.ast;
    this.currentOutputLabel = firstEq.label;

    // Display Direct Circuit Equations (joined by linebreaks if multiple outputs exist)
    const directText = eqResults.map(r => r.error ? `${r.label} = [Error]` : r.directExpr).join('\n');
    this.directExprBox.textContent = directText;

    // 3. Compute Simplified Equation
    if (firstEq.ast) {
      const minRes = runMinimizationPipeline(firstEq.ast);
      this.simplifiedExprBox.textContent = `${firstEq.label} = ${minRes.finalExpr}`;

      // 4. Compute Canonical Form
      const canonRes = generateCanonicalForms(firstEq.ast);
      if (canonRes.mintermStr) {
        this.canonicalExprBox.textContent = `${firstEq.label} = ${canonRes.mintermStr} = ${canonRes.maxtermStr}`;
      } else {
        this.canonicalExprBox.textContent = '-';
      }
    }
  }

  showEquationError(msg) {
    if (this.equationErrorBox) {
      this.equationErrorBox.textContent = msg;
      this.equationErrorBox.style.display = 'block';
    }
  }

  hideEquationError() {
    if (this.equationErrorBox) {
      this.equationErrorBox.style.display = 'none';
    }
  }

  copyCurrentEquation() {
    const text = this.directExprBox.textContent;
    if (text && text !== '-' && !text.includes('Error')) {
      navigator.clipboard.writeText(text).then(() => {
        this.uiCallbacks.onToast('Copied equation to clipboard!');
      });
    } else {
      this.uiCallbacks.onToast('No valid equation to copy.');
    }
  }

  showMinimizationSteps() {
    if (!this.currentAST) {
      this.uiCallbacks.onToast('No circuit or equation available to simplify.');
      return;
    }

    const minRes = runMinimizationPipeline(this.currentAST);
    const stepsListEl = document.getElementById('modal-simplify-steps');
    if (!stepsListEl) return;

    let html = `<li class="step-item"><span class="step-expr">${astToString(this.currentAST, { xorMode: this.xorMode })}</span> <span class="step-tag">[Original AST]</span></li>`;
    minRes.steps.forEach(s => {
      html += `<li class="step-item"><span class="step-expr">${s.expr}</span> <span class="step-tag">[${s.rule}]</span></li>`;
    });
    html += `<li class="step-item success"><span class="step-expr">${minRes.finalExpr}</span> <span class="step-tag">[Minimized Form]</span></li>`;

    stepsListEl.innerHTML = html;
    this.openModal('modal-simplify');
  }

  handleVerifyEquivalence() {
    const rawExpr = this.exprInput.value.trim();
    if (!rawExpr) {
      this.uiCallbacks.onToast('Enter a target equation in the input box to verify against the circuit!');
      return;
    }

    let targetAst = null;
    try {
      const parsed = parseExpression(rawExpr);
      targetAst = parsed.ast;
    } catch (err) {
      this.uiCallbacks.onToast(`Invalid Equation Syntax: ${err.message}`);
      return;
    }

    const outputs = this.circuit.getOrderedOutputs ? this.circuit.getOrderedOutputs() : Array.from(this.circuit.components.values()).filter(c => c.type === 'OUTPUT');
    if (outputs.length === 0) {
      this.uiCallbacks.onToast('Circuit has no output components!');
      return;
    }

    const res = verifyEquivalence(targetAst, this.circuit, outputs[0].id);
    const contentEl = document.getElementById('modal-verify-content');
    if (!contentEl) return;

    if (res.isEquivalent) {
      contentEl.innerHTML = `
        <div class="verify-badge success">✓ Equivalent</div>
        <p style="margin-top:12px; font-weight:600; color:#166534;">All ${res.totalRows} input combinations produce identical Boolean outputs!</p>
        <p style="margin-top:6px; font-size:12px; color:#475569;">Variables verified: ${res.variables.join(', ')}</p>
      `;
    } else if (res.counterExample) {
      const inputsStr = Object.entries(res.counterExample.inputs).map(([k, v]) => `${k} = ${v}`).join(', ');
      contentEl.innerHTML = `
        <div class="verify-badge error">✗ Not Equivalent</div>
        <p style="margin-top:12px; font-weight:600; color:#991b1b;">Found a counterexample input state where outputs differ:</p>
        <div class="counterexample-box" style="margin-top:10px; background:#fef2f2; border:1px solid #fca5a5; padding:12px; border-radius:6px; font-family:monospace;">
          <div><b>Input Combination:</b> ${inputsStr}</div>
          <div style="margin-top:4px;"><b>Target Equation Output:</b> ${res.counterExample.eqVal}</div>
          <div style="margin-top:4px;"><b>Actual Circuit Output:</b> ${res.counterExample.circuitVal}</div>
        </div>
      `;
    } else {
      contentEl.innerHTML = `<div class="verify-badge error">Verification Error</div><p style="margin-top:8px;">${res.error || 'Unknown failure'}</p>`;
    }

    this.openModal('modal-verify');
  }

  handleExplainCircuit() {
    const outputs = this.circuit.getOrderedOutputs ? this.circuit.getOrderedOutputs() : Array.from(this.circuit.components.values()).filter(c => c.type === 'OUTPUT');
    if (outputs.length === 0) {
      this.uiCallbacks.onToast('Circuit has no output components!');
      return;
    }

    const steps = explainCircuit(this.circuit, outputs[0].id);
    const stepsContainer = document.getElementById('modal-explain-steps');
    if (!stepsContainer) return;

    if (steps.length === 0) {
      stepsContainer.innerHTML = '<p style="color:var(--text-muted);">No logic gates found in circuit path.</p>';
    } else {
      let html = '<ol class="explain-list" style="display:flex; flex-direction:column; gap:10px; padding-left:20px;">';
      steps.forEach(s => {
        html += `
          <li style="background:#f8fafc; border:1px solid #e2e8f0; padding:10px; border-radius:6px;">
            <div style="font-size:11px; font-weight:700; color:#4f46e5; text-transform:uppercase;">Step ${s.stepNumber}: ${s.gateType} Gate</div>
            <div style="font-family:monospace; font-size:14px; font-weight:bold; margin-top:4px;">${s.equation}</div>
            <div style="font-size:11px; color:#64748b; margin-top:2px;">Inputs: ${s.inputs.join(', ')} → Output signal ${s.outputSignal}</div>
          </li>
        `;
      });
      html += '</ol>';
      stepsContainer.innerHTML = html;
    }

    this.openModal('modal-explain');
  }

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active');
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
  }
}
