/* ==========================================================================
   Main Application Entry Point & Event Controller
   ========================================================================== */

import { Circuit } from './circuit.js';
import { Simulator } from './simulator.js';
import { Renderer } from './renderer.js';
import { HistoryManager } from './history.js';
import { StorageManager } from './storage.js';
import { InteractionHandler } from './interaction.js';
import { generateTruthTable, generateChipTruthTable } from './truthtable.js';
import { ComponentTypes, POWER_RAIL_SPECS, getCleanLabel, getPinPosition, getComponentBounds, getComponentSVGMarkup } from './components.js';
import { getAllICDefinitions, getICDefinition, getICCategories, searchICs, IC_LIBRARY } from './icLibrary.js';
import { LogicUI } from './logicUI.js';

function initApp() {
  // DOM Elements
  const canvasElem = document.getElementById('circuit-canvas');
  const viewportElem = document.getElementById('viewport-group');
  const wiresLayer = document.getElementById('wires-layer');
  const compsLayer = document.getElementById('components-layer');
  const selectionLayer = document.getElementById('selection-layer');
  const tempWireLayer = document.getElementById('temp-wire-layer');

  const statusMsg = document.getElementById('status-message');
  const statusCoords = document.getElementById('status-coords');
  const statusZoom = document.getElementById('status-zoom');

  const infoCompCount = document.getElementById('info-comp-count');
  const infoWireCount = document.getElementById('info-wire-count');
  const infoInputCount = document.getElementById('info-input-count');
  const infoOutputCount = document.getElementById('info-output-count');
  const inspectorContent = document.getElementById('inspector-content');

  const toastElem = document.getElementById('toast-notification');
  const contextMenu = document.getElementById('context-menu');
  const fileImportInput = document.getElementById('file-input-import');

  // Core Instances
  const circuit = new Circuit();
  const simulator = new Simulator(circuit);
  const renderer = new Renderer(canvasElem, viewportElem, wiresLayer, compsLayer, tempWireLayer, selectionLayer);
  circuit.setRenderer(renderer);
  const history = new HistoryManager(circuit);
  let logicUI = null;

  // UI Callbacks passed to Interaction Handler
  const uiCallbacks = {
    onStatusChange: (msg) => {
      if (statusMsg) statusMsg.textContent = msg;
    },
    onMouseCoords: (x, y) => {
      if (statusCoords) statusCoords.textContent = `X: ${x}, Y: ${y}`;
    },
    onZoomChanged: (zoom) => {
      const pct = `${Math.round(zoom * 100)}%`;
      if (statusZoom) statusZoom.textContent = `Zoom: ${pct}`;
      const zoomText = document.getElementById('zoom-level-text');
      if (zoomText) zoomText.textContent = pct;
    },
    onToolChanged: (toolName) => {
      document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
      const id1 = `tool-${String(toolName || '').toLowerCase().replace(/_/g, '-')}`;
      const id2 = `tool-${String(toolName || '').toLowerCase()}`;
      const activeBtn = document.getElementById(id1) || document.getElementById(id2);
      if (activeBtn) activeBtn.classList.add('active');
    },
    onSelectionChanged: (selectedComp, selectedWire) => {
      updateInspector(selectedComp, selectedWire);
    },
    onCircuitUpdated: (options = {}) => {
      updateSidebarStats();
      if (options.save !== false) StorageManager.saveToLocalStorage(circuit);
      if (logicUI) logicUI.updateLiveEquations();
    },
    onToast: (msg) => {
      showToast(msg);
    },
    onShowContextMenu: (screenX, screenY, comp, targetType = 'component', selectedCount = 1) => {
      if (!contextMenu) return;
      contextMenu.style.left = `${screenX}px`;
      contextMenu.style.top = `${screenY}px`;
      contextMenu.style.display = 'block';

      const createChipBtn = document.getElementById('ctx-create-chip');
      const renameChipBtn = document.getElementById('ctx-chip-rename');
      const viewChipBtn = document.getElementById('ctx-chip-view');
      const truthTableChipBtn = document.getElementById('ctx-chip-truth-table');
      const chipToCircuitBtn = document.getElementById('ctx-chip-to-circuit');
      const icInfoBtn = document.getElementById('ctx-ic-info');
      const powerInfoBtn = document.getElementById('ctx-power-info');
      const chipDivider = document.getElementById('ctx-divider-chip');

      const copyBtn = document.getElementById('ctx-copy');
      const pasteBtn = document.getElementById('ctx-paste');
      const duplicateBtn = document.getElementById('ctx-duplicate');
      const toggleBtn = document.getElementById('ctx-toggle');
      const rotateBtn = document.getElementById('ctx-rotate');
      const deleteBtn = document.getElementById('ctx-delete');
      const divider1 = document.getElementById('ctx-divider-1');
      const divider2 = document.getElementById('ctx-divider-2');

      const count = selectedCount || (comp ? 1 : 0);
      const isChip = comp && comp.type === ComponentTypes.CHIP && count === 1;
      const isIC = comp && comp.type === ComponentTypes.IC && count === 1;
      const isPower = comp && !!POWER_RAIL_SPECS[comp.type] && count === 1;
      const canCreateChip = count >= 1;
      const hasClipboard = interaction.clipboardGroup && interaction.clipboardGroup.components && interaction.clipboardGroup.components.length > 0;

      if (targetType === 'wire') {
        if (createChipBtn) createChipBtn.style.display = 'none';
        if (renameChipBtn) renameChipBtn.style.display = 'none';
        if (viewChipBtn) viewChipBtn.style.display = 'none';
        if (truthTableChipBtn) truthTableChipBtn.style.display = 'none';
        if (chipToCircuitBtn) chipToCircuitBtn.style.display = 'none';
        if (icInfoBtn) icInfoBtn.style.display = 'none';
        if (powerInfoBtn) powerInfoBtn.style.display = 'none';
        if (chipDivider) chipDivider.style.display = 'none';
        if (copyBtn) copyBtn.style.display = 'none';
        if (pasteBtn) pasteBtn.style.display = 'none';
        if (duplicateBtn) duplicateBtn.style.display = 'none';
        if (rotateBtn) rotateBtn.style.display = 'none';
        if (toggleBtn) toggleBtn.style.display = 'none';
        if (divider1) divider1.style.display = 'none';
        if (divider2) divider2.style.display = 'none';
        if (deleteBtn) deleteBtn.style.display = 'flex';
        return;
      }

      if (createChipBtn) createChipBtn.style.display = canCreateChip && !isChip && !isIC && !isPower ? 'flex' : 'none';
      if (renameChipBtn) renameChipBtn.style.display = isChip ? 'flex' : 'none';
      if (viewChipBtn) viewChipBtn.style.display = isChip ? 'flex' : 'none';
      if (truthTableChipBtn) truthTableChipBtn.style.display = isChip ? 'flex' : 'none';
      if (chipToCircuitBtn) chipToCircuitBtn.style.display = isChip ? 'flex' : 'none';
      if (icInfoBtn) icInfoBtn.style.display = isIC ? 'flex' : 'none';
      if (powerInfoBtn) powerInfoBtn.style.display = isPower ? 'flex' : 'none';
      if (chipDivider) chipDivider.style.display = (canCreateChip || isChip || isIC || isPower) ? 'block' : 'none';

      if (copyBtn) copyBtn.style.display = count > 0 ? 'flex' : 'none';
      if (pasteBtn) pasteBtn.style.display = hasClipboard ? 'flex' : 'none';
      if (duplicateBtn) duplicateBtn.style.display = count > 0 ? 'flex' : 'none';
      if (rotateBtn) rotateBtn.style.display = count > 0 && (!comp || (comp.type !== ComponentTypes.WIRE && String(comp.type).toLowerCase() !== 'wire')) ? 'flex' : 'none';
      if (toggleBtn) toggleBtn.style.display = comp && comp.type === ComponentTypes.INPUT ? 'flex' : 'none';
      if (deleteBtn) deleteBtn.style.display = count > 0 ? 'flex' : 'none';
      if (divider1) divider1.style.display = (count > 0 || hasClipboard) ? 'block' : 'none';
      if (divider2) divider2.style.display = count > 0 ? 'block' : 'none';
    },
    onHideContextMenu: () => {
      if (contextMenu) contextMenu.style.display = 'none';
    }
  };

  const interaction = new InteractionHandler(
    circuit,
    simulator,
    renderer,
    history,
    StorageManager,
    uiCallbacks
  );

  window.addEventListener('resize', () => {
    interaction.requestRender();
  });

  logicUI = new LogicUI(circuit, renderer, simulator, history, uiCallbacks);
  window.__DCD_APP__ = { circuit, simulator, renderer, history, interaction, StorageManager, logicUI };

  // --------------------------------------------------------------------------
  // Global Input Signal Modifiers (Toolbar)
  // --------------------------------------------------------------------------
  document.getElementById('btn-inputs-all-0')?.addEventListener('click', () => {
    history.beginTransaction('set inputs low');
    circuit.getOrderedInputs().forEach(c => {
      c.value = 0;
    });
    history.commitTransaction();
    interaction.triggerSimulation();
    showToast('All inputs set to 0');
  });

  document.getElementById('btn-inputs-all-1')?.addEventListener('click', () => {
    history.beginTransaction('set inputs high');
    circuit.getOrderedInputs().forEach(c => {
      c.value = 1;
    });
    history.commitTransaction();
    interaction.triggerSimulation();
    showToast('All inputs set to 1');
  });

  document.getElementById('btn-inputs-invert')?.addEventListener('click', () => {
    history.beginTransaction('invert inputs');
    circuit.getOrderedInputs().forEach(c => {
      c.value = c.value === 1 ? 0 : 1;
    });
    history.commitTransaction();
    interaction.triggerSimulation();
    showToast('Inverted all inputs');
  });

  // --------------------------------------------------------------------------
  // Global Simulation Controls (Run/Pause, Reset, Speed)
  // --------------------------------------------------------------------------
  const btnSimPlayPause = document.getElementById('btn-sim-play-pause');
  let isClocksRunning = false;

  btnSimPlayPause?.addEventListener('click', () => {
    isClocksRunning = !isClocksRunning;
    if (isClocksRunning) {
      simulator.startAllClocks();
      btnSimPlayPause.textContent = '⏸ Pause';
      btnSimPlayPause.style.color = '#dc2626';
      showToast('Started continuous clocks');
    } else {
      simulator.stopAllClocks();
      btnSimPlayPause.textContent = '▶ Run';
      btnSimPlayPause.style.color = '#15803d';
      showToast('Paused clocks');
    }
    interaction.requestRender();
  });

  const btnSimReset = document.getElementById('btn-sim-reset');
  btnSimReset?.addEventListener('click', () => {
    simulator.resetSimulation();
    if (btnSimPlayPause) {
      btnSimPlayPause.textContent = '▶ Run';
      btnSimPlayPause.style.color = '#15803d';
      isClocksRunning = false;
    }
    interaction.triggerSimulation();
    showToast('Reset simulation: clocks stopped, latch states cleared');
  });

  document.getElementById('menu-circuit-reset-sim')?.addEventListener('click', () => {
    simulator.resetSimulation();
    if (btnSimPlayPause) {
      btnSimPlayPause.textContent = '▶ Run';
      btnSimPlayPause.style.color = '#15803d';
      isClocksRunning = false;
    }
    interaction.triggerSimulation();
    showToast('Reset simulation: clocks stopped, latch states cleared');
  });

  document.getElementById('sim-speed-select')?.addEventListener('change', (e) => {
    simulator.setSimulationSpeed(parseFloat(e.target.value));
    showToast(`Simulation speed: ${e.target.value}x`);
  });

  simulator.setOnTickCallback(() => {
    interaction.requestRender();
    if (interaction.selectedCompIds.size === 1) {
      const selectedId = Array.from(interaction.selectedCompIds)[0];
      const selComp = circuit.components.get(selectedId);
      if (selComp && (selComp.type === ComponentTypes.CLOCK || selComp.type === ComponentTypes.D_LATCH || selComp.type === ComponentTypes.SR_LATCH)) {
        updateInspector(selComp, null);
      }
    }
  });

  // --------------------------------------------------------------------------
  // Update Sidebar Statistics & Selection Inspector
  // --------------------------------------------------------------------------
  function updateSidebarStats() {
    const comps = Array.from(circuit.components.values());
    if (infoCompCount) infoCompCount.textContent = comps.length;
    if (infoWireCount) infoWireCount.textContent = circuit.connections.length;
    if (infoInputCount) infoInputCount.textContent = comps.filter(c => c.type === ComponentTypes.INPUT).length;
    if (infoOutputCount) infoOutputCount.textContent = comps.filter(c => c.type === ComponentTypes.OUTPUT).length;
  }

  function updateInspector(comp, wire) {
    if (!inspectorContent) return;

    if (interaction.selectedCompIds.size > 1) {
      inspectorContent.innerHTML = `
        <div class="prop-row"><span class="prop-label">Selection:</span><span class="prop-value">${interaction.selectedCompIds.size} items</span></div>
        <div class="prop-row"><span class="prop-label">Wires:</span><span class="prop-value">${interaction.selectedWireIds.size} wires</span></div>
        <div style="margin-top: 10px; display: flex; flex-direction: column; gap: 6px;">
          <button class="tool-btn" id="btn-inspect-rotate-group" style="width:100%; font-weight:600;">Rotate Group 90° (Scroll Click)</button>
          <button class="tool-btn" id="btn-inspect-create-chip" style="width:100%; background:#eff6ff; border:1px solid #3b82f6; color:#1d4ed8; font-weight:700;">Create Chip</button>
          <button class="tool-btn" id="btn-inspect-dup-group" style="width:100%;">Duplicate Group (Ctrl+D)</button>
          <button class="tool-btn" id="btn-inspect-delete-group" style="width:100%; color:#ef4444;">Delete Group (Del)</button>
        </div>
      `;
      document.getElementById('btn-inspect-rotate-group')?.addEventListener('click', () => interaction.rotateSelected());
      document.getElementById('btn-inspect-create-chip')?.addEventListener('click', () => openCreateChipModal());
      document.getElementById('btn-inspect-dup-group')?.addEventListener('click', () => interaction.duplicateSelected());
      document.getElementById('btn-inspect-delete-group')?.addEventListener('click', () => interaction.deleteSelected());
      return;
    }

    if (interaction.selectedBranchId && comp) {
      const branch = Array.isArray(comp.branches) ? comp.branches.find(b => b.id === interaction.selectedBranchId) : null;
      inspectorContent.innerHTML = `
        <div class="prop-row"><span class="prop-label">Branch ID:</span><span class="prop-value">${interaction.selectedBranchId}</span></div>
        <div class="prop-row"><span class="prop-label">Wire:</span><span class="prop-value">${getCleanLabel(comp)} (${comp.id})</span></div>
        <div class="prop-row"><span class="prop-label">Anchor:</span><span class="prop-value">X:${branch?.anchor?.x ?? '?'}, Y:${branch?.anchor?.y ?? '?'}</span></div>
        <div class="prop-row"><span class="prop-label">Output:</span><span class="prop-value">X:${branch?.output?.x ?? '?'}, Y:${branch?.output?.y ?? '?'}</span></div>
        <div class="prop-row"><span class="prop-label">Signal:</span><span class="prop-value" style="color:${comp.signal === 1 ? '#059669' : '#475569'}; font-weight:700;">${comp.signal === 1 ? 'HIGH (1)' : 'LOW (0)'}</span></div>
        <div style="margin-top: 10px;">
          <button class="tool-btn" id="btn-inspect-delete-branch" style="width:100%; color:#ef4444;">Delete Branch</button>
        </div>
      `;
      document.getElementById('btn-inspect-delete-branch')?.addEventListener('click', () => interaction.deleteSelected());
      return;
    }

    if (comp && (comp.type === ComponentTypes.WIRE || String(comp.type).toLowerCase() === 'wire')) {
      const branchCount = comp.branches?.length || 0;
      inspectorContent.innerHTML = `
        <div class="prop-row"><span class="prop-label">ID:</span><span class="prop-value">${comp.id}</span></div>
        <div class="prop-row"><span class="prop-label">Type:</span><span class="prop-value">Wire Component</span></div>
        <div class="prop-row"><span class="prop-label">Name:</span><span class="prop-value">${getCleanLabel(comp)}</span></div>
        <div class="prop-row"><span class="prop-label">Signal:</span><span class="prop-value" style="color:${comp.signal === 1 ? '#059669' : '#475569'}; font-weight:700;">${comp.signal === 1 ? 'HIGH (1)' : 'LOW (0)'}</span></div>
        <div class="prop-row"><span class="prop-label">Branches:</span><span class="prop-value">${branchCount} active</span></div>
        <div class="prop-row"><span class="prop-label">Start (Input):</span><span class="prop-value">X:${comp.input?.x ?? comp.x}, Y:${comp.input?.y ?? comp.y}</span></div>
        <div class="prop-row"><span class="prop-label">End (Output):</span><span class="prop-value">X:${comp.output?.x ?? comp.x}, Y:${comp.output?.y ?? comp.y}</span></div>
        <div style="margin-top: 10px;">
          <button class="tool-btn" id="btn-inspect-delete" style="width:100%; color:#ef4444;">Delete Wire</button>
        </div>
      `;
      document.getElementById('btn-inspect-delete')?.addEventListener('click', () => interaction.deleteSelected());
      return;
    }

    if (comp) {
      if (comp.type === ComponentTypes.CHIP) {
        const inCount = comp.chipData?.interface?.inputs?.length || 0;
        const outCount = comp.chipData?.interface?.outputs?.length || 0;
        inspectorContent.innerHTML = `
          <div class="prop-row"><span class="prop-label">ID:</span><span class="prop-value">${comp.id}</span></div>
          <div class="prop-row"><span class="prop-label">Type:</span><span class="prop-value">CHIP</span></div>
          <div class="prop-row"><span class="prop-label">Name:</span><span class="prop-value">${getCleanLabel(comp)}</span></div>
          <div class="prop-row"><span class="prop-label">Rotation:</span><span class="prop-value">${comp.rotation || 0}°</span></div>
          <div class="prop-row"><span class="prop-label">Inputs:</span><span class="prop-value">${inCount}</span></div>
          <div class="prop-row"><span class="prop-label">Outputs:</span><span class="prop-value">${outCount}</span></div>
          <div class="prop-row"><span class="prop-label">Position:</span><span class="prop-value">X:${comp.x}, Y:${comp.y}</span></div>
          <div style="margin-top: 10px; display: flex; flex-direction: column; gap: 6px;">
            <button class="tool-btn" id="btn-inspect-chip-rotate" style="width:100%; font-weight:600;">Rotate 90° (Scroll Click)</button>
            <button class="tool-btn" id="btn-inspect-chip-view" style="width:100%;">View Circuit</button>
            <button class="tool-btn" id="btn-inspect-chip-tt" style="width:100%;">Truth Table</button>
            <button class="tool-btn" id="btn-inspect-chip-expand" style="width:100%; background:#f0fdf4; border:1px solid #22c55e; color:#15803d; font-weight:600;">Chip to Circuit</button>
            <button class="tool-btn" id="btn-inspect-chip-rename" style="width:100%;">Rename Chip</button>
            <button class="tool-btn" id="btn-inspect-delete" style="width:100%; color:#ef4444;">Delete Chip</button>
          </div>
        `;
        document.getElementById('btn-inspect-chip-rotate')?.addEventListener('click', () => interaction.rotateComponent(comp.id));
        document.getElementById('btn-inspect-chip-view')?.addEventListener('click', () => viewChipCircuit(comp));
        document.getElementById('btn-inspect-chip-tt')?.addEventListener('click', () => viewChipTruthTable(comp));
        document.getElementById('btn-inspect-chip-expand')?.addEventListener('click', () => interaction.expandChip(comp.id));
        document.getElementById('btn-inspect-chip-rename')?.addEventListener('click', () => openRenameChipModal(comp));
        document.getElementById('btn-inspect-delete')?.addEventListener('click', () => interaction.deleteSelected());
        return;
      }

      if (comp.type === ComponentTypes.IC) {
        const defId = comp.icData?.definitionId || '74HC00';
        const def = getICDefinition(defId) || comp.icData || {};
        inspectorContent.innerHTML = `
          <div class="prop-row"><span class="prop-label">ID:</span><span class="prop-value">${comp.id}</span></div>
          <div class="prop-row"><span class="prop-label">Type:</span><span class="prop-value">IC (${def.family || '74xx'})</span></div>
          <div class="prop-row"><span class="prop-label">Part:</span><span class="prop-value">${def.name || defId}</span></div>
          <div class="prop-row"><span class="prop-label">Rotation:</span><span class="prop-value">${comp.rotation || 0}°</span></div>
          <div class="prop-row"><span class="prop-label">Package:</span><span class="prop-value">${def.package || 'DIP'}</span></div>
          <div class="prop-row"><span class="prop-label">Pins:</span><span class="prop-value">${def.pinCount || def.pins?.length || 14}</span></div>
          <div class="prop-row"><span class="prop-label">Position:</span><span class="prop-value">X:${comp.x}, Y:${comp.y}</span></div>
          <div style="margin-top: 10px; display: flex; flex-direction: column; gap: 6px;">
            <button class="tool-btn" id="btn-inspect-ic-rotate" style="width:100%; font-weight:600;">Rotate 90° (Scroll Click)</button>
            <button class="tool-btn" id="btn-inspect-ic-info" style="width:100%; font-weight: 600;">IC Information</button>
            <button class="tool-btn" id="btn-inspect-delete" style="width:100%; color:#ef4444;">Delete IC</button>
          </div>
        `;
        document.getElementById('btn-inspect-ic-rotate')?.addEventListener('click', () => interaction.rotateComponent(comp.id));
        document.getElementById('btn-inspect-ic-info')?.addEventListener('click', () => openICInfoModal(comp));
        document.getElementById('btn-inspect-delete')?.addEventListener('click', () => interaction.deleteSelected());
        return;
      }

      if (POWER_RAIL_SPECS[comp.type]) {
        const spec = POWER_RAIL_SPECS[comp.type];
        inspectorContent.innerHTML = `
          <div class="prop-row"><span class="prop-label">ID:</span><span class="prop-value">${comp.id}</span></div>
          <div class="prop-row"><span class="prop-label">Type:</span><span class="prop-value">Power Supply</span></div>
          <div class="prop-row"><span class="prop-label">Rail:</span><span class="prop-value">${spec.label}</span></div>
          <div class="prop-row"><span class="prop-label">Rotation:</span><span class="prop-value">${comp.rotation || 0}°</span></div>
          <div class="prop-row"><span class="prop-label">Voltage:</span><span class="prop-value" style="color:${spec.voltage > 0 ? '#dc2626' : '#475569'}; font-weight:700;">${spec.displayVoltage || (spec.voltage + 'V')}</span></div>
          <div class="prop-row"><span class="prop-label">Position:</span><span class="prop-value">X:${comp.x}, Y:${comp.y}</span></div>
          <div style="margin-top: 10px; display: flex; flex-direction: column; gap: 6px;">
            <button class="tool-btn" id="btn-inspect-power-rotate" style="width:100%; font-weight:600;">Rotate 90° (Scroll Click)</button>
            <button class="tool-btn" id="btn-inspect-delete" style="width:100%; color:#ef4444;">Delete</button>
          </div>
        `;
        document.getElementById('btn-inspect-power-rotate')?.addEventListener('click', () => interaction.rotateComponent(comp.id));
        document.getElementById('btn-inspect-delete')?.addEventListener('click', () => interaction.deleteSelected());
        return;
      }

      if (comp.type === ComponentTypes.CLOCK) {
        const isRunning = !!comp.running;
        const clkVal = comp.value === 1 ? 1 : 0;
        const nclkVal = clkVal === 1 ? 0 : 1;
        const freq = comp.frequency ?? 1;
        const period = comp.period ?? 1000;
        const duty = comp.dutyCycle ?? 50;
        const pulseDur = comp.pulseDuration ?? 100;

        inspectorContent.innerHTML = `
          <div class="prop-row"><span class="prop-label">ID:</span><span class="prop-value">${comp.id}</span></div>
          <div class="prop-row"><span class="prop-label">Type:</span><span class="prop-value">Clock Generator</span></div>
          <div class="prop-row"><span class="prop-label">Output CLK:</span><span class="prop-value" style="color:${clkVal === 1 ? '#059669' : '#475569'}; font-weight:800;">${clkVal} (${clkVal === 1 ? 'HIGH' : 'LOW'})</span></div>
          <div class="prop-row"><span class="prop-label">Output CLK̅:</span><span class="prop-value" style="color:${nclkVal === 1 ? '#059669' : '#475569'}; font-weight:800;">${nclkVal} (${nclkVal === 1 ? 'HIGH' : 'LOW'})</span></div>
          <div class="prop-row"><span class="prop-label">Mode:</span><span class="prop-value" style="color:${isRunning ? '#15803d' : '#2563eb'}; font-weight:700;">${isRunning ? 'Continuous Run' : 'Manual Push Button'}</span></div>
          <div class="prop-row"><span class="prop-label">Rotation:</span><span class="prop-value">${comp.rotation || 0}°</span></div>
          <div class="prop-row"><span class="prop-label">Position:</span><span class="prop-value">X:${comp.x}, Y:${comp.y}</span></div>

          <div style="margin-top: 10px; border-top: 1px solid var(--border-light, #cbd5e1); padding-top: 8px;">
            <div style="font-weight:700; font-size:11px; margin-bottom:6px; color:#1d4ed8;">MANUAL TRIGGER (1 PRESS = 1 PULSE)</div>
            <button class="tool-btn" id="btn-clk-pulse-manual" style="width:100%; height:34px; background:#eff6ff; border:1.5px solid #2563eb; color:#1d4ed8; font-weight:800; font-size:12px; margin-bottom:6px; cursor:pointer;">
              👆 Press Clock (1 Pulse)
            </button>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
              <label style="font-size:11px; color:#64748b;">Pulse Duration:</label>
              <div style="display:flex; align-items:center; gap:3px;">
                <input type="number" id="inp-clk-pulse-dur" value="${pulseDur}" min="20" max="5000" step="50" style="width:65px; padding:2px 4px; font-size:11px; border:1px solid #cbd5e1; border-radius:3px;">
                <span style="font-size:10px; color:#64748b;">ms</span>
              </div>
            </div>
          </div>

          <div style="margin-top: 10px; border-top: 1px solid var(--border-light, #cbd5e1); padding-top: 8px;">
            <div style="font-weight:700; font-size:11px; margin-bottom:6px; color:#334155;">CONTINUOUS OSCILLATION (OPTIONAL)</div>
            <button class="tool-btn" id="btn-clk-toggle-run" style="width:100%; font-weight:700; background:${isRunning ? '#fee2e2' : '#f8fafc'}; color:${isRunning ? '#b91c1c' : '#334155'}; border:1px solid ${isRunning ? '#ef4444' : '#cbd5e1'}; margin-bottom:6px; cursor:pointer;">
              ${isRunning ? '⏹ Stop Continuous Run' : '▶ Start Continuous Run'}
            </button>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
              <label style="font-size:11px; color:#64748b;">Frequency (Hz):</label>
              <input type="number" id="inp-clk-freq" value="${freq}" min="0.1" max="50" step="0.5" style="width:75px; padding:2px 4px; font-size:11px; border:1px solid #cbd5e1; border-radius:3px;">
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
              <label style="font-size:11px; color:#64748b;">Period (ms):</label>
              <input type="number" id="inp-clk-period" value="${period}" min="20" max="10000" step="50" style="width:75px; padding:2px 4px; font-size:11px; border:1px solid #cbd5e1; border-radius:3px;">
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
              <label style="font-size:11px; color:#64748b;">Duty Cycle (%):</label>
              <input type="number" id="inp-clk-duty" value="${duty}" min="1" max="99" step="5" style="width:75px; padding:2px 4px; font-size:11px; border:1px solid #cbd5e1; border-radius:3px;">
            </div>
          </div>

          <div style="margin-top: 10px; display: flex; flex-direction: column; gap: 6px;">
            <button class="tool-btn" id="btn-inspect-clock-rotate" style="width:100%; font-weight:600;">Rotate 90° (Scroll Click)</button>
            <button class="tool-btn" id="btn-inspect-delete" style="width:100%; color:#ef4444;">Delete Clock</button>
          </div>
        `;

        document.getElementById('btn-clk-pulse-manual')?.addEventListener('click', () => {
          const dur = comp.pulseDuration || 100;
          simulator.triggerPulse(comp.id, 'HIGH', dur);
          updateInspector(circuit.components.get(comp.id), null);
          showToast(`Clock pulsed for ${dur} ms`);
        });
        document.getElementById('btn-clk-toggle-run')?.addEventListener('click', () => {
          simulator.toggleClockRunning(comp.id);
          updateInspector(circuit.components.get(comp.id), null);
        });
        document.getElementById('inp-clk-freq')?.addEventListener('change', (e) => {
          simulator.setClockFrequency(comp.id, parseFloat(e.target.value));
          updateInspector(circuit.components.get(comp.id), null);
        });
        document.getElementById('inp-clk-period')?.addEventListener('change', (e) => {
          simulator.setClockPeriod(comp.id, parseInt(e.target.value, 10));
          updateInspector(circuit.components.get(comp.id), null);
        });
        document.getElementById('inp-clk-duty')?.addEventListener('change', (e) => {
          simulator.setClockDutyCycle(comp.id, parseInt(e.target.value, 10));
          updateInspector(circuit.components.get(comp.id), null);
        });
        document.getElementById('inp-clk-pulse-dur')?.addEventListener('change', (e) => {
          comp.pulseDuration = Math.max(10, parseInt(e.target.value, 10) || 100);
        });
        document.getElementById('btn-inspect-clock-rotate')?.addEventListener('click', () => interaction.rotateComponent(comp.id));
        document.getElementById('btn-inspect-delete')?.addEventListener('click', () => interaction.deleteSelected());
        return;
      }

      if (comp.type === ComponentTypes.D_LATCH) {
        const qVal = comp.state?.Q ?? 0;
        const qBarVal = comp.state?.Qbar ?? 1;
        inspectorContent.innerHTML = `
          <div class="prop-row"><span class="prop-label">ID:</span><span class="prop-value">${comp.id}</span></div>
          <div class="prop-row"><span class="prop-label">Type:</span><span class="prop-value">Level-Sensitive D Latch</span></div>
          <div class="prop-row"><span class="prop-label">State Q:</span><span class="prop-value" style="color:${qVal === 1 ? '#059669' : '#475569'}; font-weight:800;">${qVal} (${qVal === 1 ? 'HIGH' : 'LOW'})</span></div>
          <div class="prop-row"><span class="prop-label">State Q̅:</span><span class="prop-value" style="color:${qBarVal === 1 ? '#059669' : '#475569'}; font-weight:800;">${qBarVal} (${qBarVal === 1 ? 'HIGH' : 'LOW'})</span></div>
          <div class="prop-row"><span class="prop-label">Rotation:</span><span class="prop-value">${comp.rotation || 0}°</span></div>
          <div class="prop-row"><span class="prop-label">Position:</span><span class="prop-value">X:${comp.x}, Y:${comp.y}</span></div>
          <div style="margin-top: 10px; display: flex; flex-direction: column; gap: 6px;">
            <button class="tool-btn" id="btn-inspect-latch-reset" style="width:100%; background:#eff6ff; border:1px solid #3b82f6; color:#1d4ed8; font-weight:700;">Reset Latch (Q=0, Q̅=1)</button>
            <button class="tool-btn" id="btn-inspect-latch-rotate" style="width:100%; font-weight:600;">Rotate 90° (Scroll Click)</button>
            <button class="tool-btn" id="btn-inspect-delete" style="width:100%; color:#ef4444;">Delete Latch</button>
          </div>
        `;
        document.getElementById('btn-inspect-latch-reset')?.addEventListener('click', () => {
          comp.state = { Q: 0, Qbar: 1 };
          comp.value = 0;
          interaction.triggerSimulation();
          updateInspector(circuit.components.get(comp.id), null);
          showToast('D Latch reset to Q=0');
        });
        document.getElementById('btn-inspect-latch-rotate')?.addEventListener('click', () => interaction.rotateComponent(comp.id));
        document.getElementById('btn-inspect-delete')?.addEventListener('click', () => interaction.deleteSelected());
        return;
      }

      if (comp.type === ComponentTypes.SR_LATCH) {
        const qVal = comp.state?.Q ?? 0;
        const qBarVal = comp.state?.Qbar ?? 1;
        const isInvalid = comp.state?.invalid === true;
        inspectorContent.innerHTML = `
          <div class="prop-row"><span class="prop-label">ID:</span><span class="prop-value">${comp.id}</span></div>
          <div class="prop-row"><span class="prop-label">Type:</span><span class="prop-value">SR Latch (Gated/Ungated)</span></div>
          <div class="prop-row"><span class="prop-label">State Q:</span><span class="prop-value" style="color:${qVal === 1 ? '#059669' : '#475569'}; font-weight:800;">${qVal}</span></div>
          <div class="prop-row"><span class="prop-label">State Q̅:</span><span class="prop-value" style="color:${qBarVal === 1 ? '#059669' : '#475569'}; font-weight:800;">${qBarVal}</span></div>
          ${isInvalid ? `<div class="prop-row"><span class="prop-label">Condition:</span><span class="prop-value" style="color:#dc2626; font-weight:800;">INVALID (S=1, R=1)</span></div>` : ''}
          <div class="prop-row"><span class="prop-label">Rotation:</span><span class="prop-value">${comp.rotation || 0}°</span></div>
          <div class="prop-row"><span class="prop-label">Position:</span><span class="prop-value">X:${comp.x}, Y:${comp.y}</span></div>
          <div style="margin-top: 10px; display: flex; flex-direction: column; gap: 6px;">
            <button class="tool-btn" id="btn-inspect-srlatch-reset" style="width:100%; background:#eff6ff; border:1px solid #3b82f6; color:#1d4ed8; font-weight:700;">Reset Latch (Q=0, Q̅=1)</button>
            <button class="tool-btn" id="btn-inspect-srlatch-rotate" style="width:100%; font-weight:600;">Rotate 90° (Scroll Click)</button>
            <button class="tool-btn" id="btn-inspect-delete" style="width:100%; color:#ef4444;">Delete Latch</button>
          </div>
        `;
        document.getElementById('btn-inspect-srlatch-reset')?.addEventListener('click', () => {
          comp.state = { Q: 0, Qbar: 1, invalid: false };
          comp.value = 0;
          interaction.triggerSimulation();
          updateInspector(circuit.components.get(comp.id), null);
          showToast('SR Latch reset to Q=0');
        });
        document.getElementById('btn-inspect-srlatch-rotate')?.addEventListener('click', () => interaction.rotateComponent(comp.id));
        document.getElementById('btn-inspect-delete')?.addEventListener('click', () => interaction.deleteSelected());
        return;
      }

      inspectorContent.innerHTML = `
        <div class="prop-row"><span class="prop-label">ID:</span><span class="prop-value">${comp.id}</span></div>
        <div class="prop-row"><span class="prop-label">Type:</span><span class="prop-value">${comp.type}</span></div>
        <div class="prop-row"><span class="prop-label">Name:</span><span class="prop-value">${getCleanLabel(comp)}</span></div>
        <div class="prop-row"><span class="prop-label">Rotation:</span><span class="prop-value">${comp.rotation || 0}°</span></div>
        <div class="prop-row"><span class="prop-label">Position:</span><span class="prop-value">X:${comp.x}, Y:${comp.y}</span></div>
        ${comp.type === ComponentTypes.INPUT || comp.type === ComponentTypes.OUTPUT ? `
          <div class="prop-row"><span class="prop-label">Value:</span><span class="prop-value" style="color:${comp.value === 1 ? '#059669' : '#475569'};">${comp.value ?? 0} (${comp.value === 1 ? 'HIGH' : 'LOW'})</span></div>
        ` : ''}
        ${comp.type === ComponentTypes.INPUT ? `
          <div style="margin-top: 8px;">
            <button class="tool-btn" id="btn-inspect-toggle-val" style="width:100%; background: #eff6ff; border: 1px solid #2563eb; color: #1d4ed8; font-weight: 600;">Toggle Input</button>
          </div>
        ` : ''}
        <div style="margin-top: 8px; display: flex; flex-direction: column; gap: 6px;">
          <button class="tool-btn" id="btn-inspect-rotate" style="width:100%; font-weight:600;">Rotate 90° (Scroll Click)</button>
          <button class="tool-btn" id="btn-inspect-delete" style="width:100%; color:#ef4444;">Delete</button>
        </div>
      `;

      document.getElementById('btn-inspect-rotate')?.addEventListener('click', () => {
        interaction.rotateComponent(comp.id);
      });
      document.getElementById('btn-inspect-toggle-val')?.addEventListener('click', () => {
        history.beginTransaction('toggle input');
        const newVal = circuit.toggleInput(comp.id);
        history.commitTransaction();
        interaction.triggerSimulation();
        updateInspector(circuit.components.get(comp.id), null);
        interaction.uiCallbacks.onToast(`Input toggled to ${newVal}`);
      });
      document.getElementById('btn-inspect-delete')?.addEventListener('click', () => interaction.deleteSelected());
    } else if (wire) {
      inspectorContent.innerHTML = `
        <div class="prop-row"><span class="prop-label">Wire ID:</span><span class="prop-value">${wire.id}</span></div>
        <div class="prop-row"><span class="prop-label">From:</span><span class="prop-value">${wire.fromCompId}:${wire.fromPinId}</span></div>
        <div class="prop-row"><span class="prop-label">To:</span><span class="prop-value">${wire.toCompId}:${wire.toPinId}</span></div>
        <div class="prop-row"><span class="prop-label">Signal:</span><span class="prop-value" style="color:${wire.state === 1 ? '#059669' : '#475569'};">${wire.state === 1 ? 'HIGH (1)' : 'LOW (0)'}</span></div>
        <div style="margin-top: 10px;">
          <button class="tool-btn" id="btn-inspect-delete-wire" style="width:100%; color:#ef4444;">Delete Wire</button>
        </div>
      `;
      document.getElementById('btn-inspect-delete-wire')?.addEventListener('click', () => interaction.deleteSelected());
    } else {
      inspectorContent.innerHTML = `<div style="color: var(--text-muted); font-size: 11px; text-align: center; padding: 12px 0;">No item selected</div>`;
    }
  }

  function showToast(msg) {
    toastElem.textContent = msg;
    toastElem.style.display = 'block';
    setTimeout(() => {
      toastElem.style.display = 'none';
    }, 3200);
  }

  // --------------------------------------------------------------------------
  // Toolbar Event Listeners
  // --------------------------------------------------------------------------
  const toolButtons = [
    { id: 'tool-select', name: 'select' },
    { id: 'tool-box-select', name: 'box-select' },
    { id: 'tool-input', name: ComponentTypes.INPUT },
    { id: 'tool-output', name: ComponentTypes.OUTPUT },
    { id: 'tool-wire', name: ComponentTypes.WIRE },
    { id: 'tool-and', name: ComponentTypes.AND },
    { id: 'tool-or', name: ComponentTypes.OR },
    { id: 'tool-not', name: ComponentTypes.NOT },
    { id: 'tool-nand', name: ComponentTypes.NAND },
    { id: 'tool-nor', name: ComponentTypes.NOR },
    { id: 'tool-xor', name: ComponentTypes.XOR },
    { id: 'tool-xnor', name: ComponentTypes.XNOR },
    { id: 'tool-clock', name: ComponentTypes.CLOCK },
    { id: 'tool-gnd', name: ComponentTypes.GND },
    { id: 'tool-vcc-5', name: ComponentTypes.VCC_5 },
    { id: 'tool-vcc-neg-5', name: ComponentTypes.VCC_NEG_5 },
    { id: 'tool-vcc-12', name: ComponentTypes.VCC_12 },
    { id: 'tool-vcc-neg-12', name: ComponentTypes.VCC_NEG_12 }
  ];

  toolButtons.forEach(tool => {
    document.getElementById(tool.id)?.addEventListener('click', () => {
      interaction.setActiveTool(tool.name);
    });
  });

  // Zoom Toolbar buttons
  document.getElementById('btn-zoom-in')?.addEventListener('click', () => {
    renderer.setViewport(renderer.panX, renderer.panY, renderer.zoom * 1.2);
    uiCallbacks.onZoomChanged(renderer.zoom);
    interaction.requestRender();
  });
  document.getElementById('btn-zoom-out')?.addEventListener('click', () => {
    renderer.setViewport(renderer.panX, renderer.panY, renderer.zoom / 1.2);
    uiCallbacks.onZoomChanged(renderer.zoom);
    interaction.requestRender();
  });
  document.getElementById('btn-zoom-reset')?.addEventListener('click', () => {
    renderer.setViewport(0, 0, 1.0);
    uiCallbacks.onZoomChanged(1.0);
    interaction.requestRender();
  });

  // --------------------------------------------------------------------------
  // Menu Bar Dropdowns (Click to Open, Not On Hover)
  // --------------------------------------------------------------------------
  const menuItems = document.querySelectorAll('.menu-bar .menu-item');
  let isMenuOpen = false;

  function closeAllMenus() {
    menuItems.forEach(item => item.classList.remove('active', 'open'));
    isMenuOpen = false;
  }

  menuItems.forEach(item => {
    item.addEventListener('click', (e) => {
      // If clicking directly on a menu-option inside the dropdown, don't re-toggle
      if (e.target.closest('.menu-option') || e.target.closest('.menu-divider')) {
        closeAllMenus();
        return;
      }

      e.stopPropagation();
      const wasOpen = item.classList.contains('active') || item.classList.contains('open');
      closeAllMenus();
      if (!wasOpen) {
        item.classList.add('active', 'open');
        isMenuOpen = true;
      }
    });

    // If a menu is already open, hovering over other menu headers switches to them
    item.addEventListener('mouseenter', () => {
      if (isMenuOpen) {
        menuItems.forEach(mi => mi.classList.remove('active', 'open'));
        item.classList.add('active', 'open');
      }
    });
  });

  // Close menus when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.menu-bar')) {
      closeAllMenus();
    }
  });

  // Close menus when any menu option is selected
  document.querySelectorAll('.menu-option').forEach(opt => {
    opt.addEventListener('click', () => {
      closeAllMenus();
    });
  });

  // --------------------------------------------------------------------------
  // Menu Bar Action Event Listeners & Canvas Lifecycle
  // --------------------------------------------------------------------------
  function createNewCanvas(showConfirmation = false) {
    if (showConfirmation && circuit.components.size > 0) {
      if (!confirm('Create a fresh new canvas? Unsaved changes will be cleared.')) {
        return;
      }
    }
    simulator.stopAllClocks();
    circuit.resetSequentialState();
    circuit.clear();
    history.clear();
    interaction.clearSelection();
    renderer.setViewport(0, 0, 1.0);
    uiCallbacks.onZoomChanged(1.0);
    StorageManager.clearLocalStorage();
    interaction.triggerSimulation();
    interaction.requestRender();
    updateSidebarStats();
    updateInspector(null, null);
    if (logicUI) logicUI.updateLiveEquations();
    showToast('Created fresh empty canvas');
  }

  document.getElementById('menu-file-new')?.addEventListener('click', () => {
    createNewCanvas(true);
  });

  document.getElementById('menu-file-clear')?.addEventListener('click', () => {
    createNewCanvas(true);
  });

  document.getElementById('menu-file-save')?.addEventListener('click', () => {
    if (StorageManager.saveToLocalStorage(circuit)) {
      showToast('Circuit saved successfully to LocalStorage!');
    }
  });

  document.getElementById('menu-file-open')?.addEventListener('click', () => {
    fileImportInput.click();
  });

  fileImportInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      simulator.stopAllClocks();
      history.beginTransaction('import json');
      if (StorageManager.importJSON(circuit, evt.target.result)) {
        history.commitTransaction();
        interaction.clearSelection();
        interaction.triggerSimulation();
        showToast('Circuit imported successfully!');
      } else {
        history.cancelTransaction();
        showToast('Error importing circuit file.');
      }
    };
    reader.readAsText(file);
    fileImportInput.value = '';
  });

  document.getElementById('menu-file-export-json')?.addEventListener('click', () => {
    StorageManager.exportJSON(circuit);
  });
  document.getElementById('menu-file-export-svg')?.addEventListener('click', () => {
    StorageManager.exportSVG(canvasElem);
  });
  document.getElementById('menu-file-export-png')?.addEventListener('click', () => {
    StorageManager.exportPNG(canvasElem);
  });

  document.getElementById('menu-edit-undo')?.addEventListener('click', () => {
    if (history.undo()) {
      interaction.clearSelection();
      interaction.triggerSimulation();
    }
  });
  document.getElementById('menu-edit-redo')?.addEventListener('click', () => {
    if (history.redo()) {
      interaction.clearSelection();
      interaction.triggerSimulation();
    }
  });
  document.getElementById('menu-edit-copy')?.addEventListener('click', () => {
    interaction.copySelected();
  });
  document.getElementById('menu-edit-paste')?.addEventListener('click', () => {
    interaction.pasteSelected();
  });
  document.getElementById('menu-edit-delete')?.addEventListener('click', () => {
    interaction.deleteSelected();
  });

  document.getElementById('menu-view-zoomin')?.addEventListener('click', () => {
    renderer.setViewport(renderer.panX, renderer.panY, renderer.zoom * 1.2);
    uiCallbacks.onZoomChanged(renderer.zoom);
    interaction.requestRender();
  });
  document.getElementById('menu-view-zoomout')?.addEventListener('click', () => {
    renderer.setViewport(renderer.panX, renderer.panY, renderer.zoom / 1.2);
    uiCallbacks.onZoomChanged(renderer.zoom);
    interaction.requestRender();
  });
  document.getElementById('menu-view-zoomreset')?.addEventListener('click', () => {
    renderer.setViewport(0, 0, 1.0);
    uiCallbacks.onZoomChanged(1.0);
    interaction.requestRender();
  });
  document.getElementById('menu-view-grid')?.addEventListener('click', () => {
    renderer.setGridVisible(!renderer.showGrid);
  });
  document.getElementById('menu-view-snap')?.addEventListener('click', () => {
    interaction.snapToGrid = !interaction.snapToGrid;
    showToast(`Snap to grid ${interaction.snapToGrid ? 'ENABLED' : 'DISABLED'}`);
  });

  let truthTableFormatMode = 'binary'; // 'binary' (0s & 1s) or 'boolean' (T & F)
  let activeRenamingChipId = null;
  let activeViewingChip = null;

  function renderCurrentTruthTable() {
    let tableHTML = '';
    if (activeViewingChip && activeViewingChip.type === ComponentTypes.CHIP) {
      tableHTML = generateChipTruthTable(activeViewingChip, truthTableFormatMode);
    } else {
      tableHTML = generateTruthTable(circuit, truthTableFormatMode);
    }
    const container = document.getElementById('modal-truthtable-content');
    if (container) container.innerHTML = tableHTML;
  }

  function openCreateChipModal() {
    if (interaction.selectedCompIds.size === 0) {
      showToast('Please select components to package into a chip.');
      return;
    }
    const input = document.getElementById('create-chip-name-input');
    if (input) {
      input.value = `Chip_${Math.floor(Math.random() * 900 + 100)}`;
      setTimeout(() => input.focus(), 50);
    }
    openModal('modal-create-chip');
  }

  function openRenameChipModal(comp) {
    if (!comp || comp.type !== ComponentTypes.CHIP) {
      const selectedId = Array.from(interaction.selectedCompIds)[0];
      comp = circuit.components.get(selectedId);
    }
    if (!comp || comp.type !== ComponentTypes.CHIP) return;
    activeRenamingChipId = comp.id;
    const input = document.getElementById('rename-chip-name-input');
    if (input) {
      input.value = comp.name || '';
      setTimeout(() => input.focus(), 50);
    }
    openModal('modal-rename-chip');
  }

  function viewChipTruthTable(chip) {
    if (!chip || chip.type !== ComponentTypes.CHIP) {
      const selectedId = Array.from(interaction.selectedCompIds)[0];
      chip = circuit.components.get(selectedId);
    }
    if (!chip || chip.type !== ComponentTypes.CHIP) return;
    activeViewingChip = chip;
    renderCurrentTruthTable();
    openModal('modal-truthtable');
  }

  let chipViewStack = [];
  let targetNestedChip = null;

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function hideModalChipContextMenu() {
    const menu = document.getElementById('modal-chip-context-menu');
    if (menu) menu.style.display = 'none';
    targetNestedChip = null;
  }

  function updateChipBreadcrumbs() {
    const trailElem = document.getElementById('view-chip-breadcrumb-trail');
    const backBtn = document.getElementById('btn-view-chip-back');
    if (!trailElem) return;

    if (chipViewStack.length <= 1) {
      if (backBtn) backBtn.style.display = 'none';
      trailElem.innerHTML = `<span style="color: var(--accent-primary, #2563eb);">${escapeHtml(chipViewStack[0]?.name || 'CHIP')}</span>`;
      return;
    }

    if (backBtn) backBtn.style.display = 'inline-block';
    const crumbs = chipViewStack.map((c, idx) => {
      const isLast = idx === chipViewStack.length - 1;
      if (isLast) {
        return `<span style="color: var(--accent-primary, #2563eb);">${escapeHtml(c.name || 'CHIP')}</span>`;
      }
      return `<a href="#" class="chip-breadcrumb-link" data-index="${idx}" style="color: var(--text-muted, #64748b); text-decoration: underline;">${escapeHtml(c.name || 'CHIP')}</a>`;
    }).join(' <span style="color: var(--border-medium, #cbd5e1); margin: 0 4px;">/</span> ');

    trailElem.innerHTML = crumbs;

    trailElem.querySelectorAll('.chip-breadcrumb-link').forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        const targetIdx = parseInt(link.getAttribute('data-index'), 10);
        if (!isNaN(targetIdx) && targetIdx >= 0 && targetIdx < chipViewStack.length) {
          chipViewStack = chipViewStack.slice(0, targetIdx + 1);
          viewChipCircuit(chipViewStack[chipViewStack.length - 1], false);
        }
      });
    });
  }

  function viewChipCircuit(chip, addToStack = true) {
    if (!chip || chip.type !== ComponentTypes.CHIP) {
      const selectedId = Array.from(interaction.selectedCompIds)[0];
      chip = circuit.components.get(selectedId);
    }
    if (!chip || !chip.chipData || !chip.chipData.circuit) return;

    if (addToStack) {
      if (chipViewStack.length === 0 || chipViewStack[chipViewStack.length - 1].id !== chip.id) {
        chipViewStack.push(chip);
      }
    }

    updateChipBreadcrumbs();

    const internalComps = chip.chipData.circuit.components || [];
    const internalWires = chip.chipData.circuit.connections || [];
    const chipInterface = chip.chipData.interface || chip.chipData;

    const titleElem = document.getElementById('view-chip-title');
    if (titleElem) titleElem.textContent = `Chip Internal Schematic: ${chip.name || 'CHIP'}`;
    const inCount = (chipInterface.inputs || []).length;
    const outCount = (chipInterface.outputs || []).length;
    const descElem = document.getElementById('view-chip-pins-desc');
    if (descElem) descElem.textContent = `${inCount} Input(s), ${outCount} Output(s), ${internalComps.length} Internal Component(s)`;

    const viewSvg = document.getElementById('view-chip-svg');
    const viewViewport = document.getElementById('view-chip-viewport');
    if (!viewViewport) return;

    viewViewport.innerHTML = '';
    hideModalChipContextMenu();

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    internalComps.forEach(c => {
      const b = getComponentBounds(c);
      if (b) {
        minX = Math.min(minX, b.minX);
        minY = Math.min(minY, b.minY);
        maxX = Math.max(maxX, b.maxX);
        maxY = Math.max(maxY, b.maxY);
      }
    });

    if (minX === Infinity) {
      minX = -100; maxX = 100; minY = -100; maxY = 100;
    }

    const pad = 60;
    const width = Math.max(260, maxX - minX + pad * 2);
    const height = Math.max(180, maxY - minY + pad * 2);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    viewSvg.setAttribute('viewBox', `${cx - width / 2} ${cy - height / 2} ${width} ${height}`);

    const subCircuit = new Circuit();
    internalComps.forEach(c => subCircuit.components.set(c.id, { ...c }));
    internalWires.forEach(w => subCircuit.connections.push({ ...w }));

    let wiresMarkup = '';
    internalWires.forEach(wire => {
      const fromComp = subCircuit.components.get(wire.fromCompId);
      const toComp = subCircuit.components.get(wire.toCompId);
      if (fromComp && toComp) {
        const fromPos = getPinPosition(fromComp, wire.fromPinId);
        const toPos = getPinPosition(toComp, wire.toPinId);
        if (fromPos && toPos) {
          const isHigh = wire.state === 1;
          const stroke = isHigh ? '#10b981' : '#64748b';
          const dx = Math.abs(toPos.x - fromPos.x) * 0.5;
          const pathD = `M ${fromPos.x} ${fromPos.y} C ${fromPos.x + dx} ${fromPos.y}, ${toPos.x - dx} ${toPos.y}, ${toPos.x} ${toPos.y}`;
          wiresMarkup += `<path d="${pathD}" fill="none" stroke="${stroke}" stroke-width="2.5" stroke-linecap="round"/>`;
        }
      }
    });

    let compsMarkup = '';
    internalComps.forEach(comp => {
      compsMarkup += getComponentSVGMarkup(comp, false);
    });

    viewViewport.innerHTML = `
      <g class="subcircuit-wires">${wiresMarkup}</g>
      <g class="subcircuit-components">${compsMarkup}</g>
    `;

    // Add interactivity to nested CHIP components inside the schematic
    const modalCtxMenu = document.getElementById('modal-chip-context-menu');
    const container = document.getElementById('view-chip-canvas-container');

    viewViewport.querySelectorAll('.component-group').forEach(groupElem => {
      const compId = groupElem.getAttribute('data-id');
      const comp = internalComps.find(c => c.id === compId);
      if (comp && comp.type === ComponentTypes.CHIP) {
        groupElem.style.cursor = 'pointer';
        groupElem.setAttribute('title', `Right-click or double-click to view internal circuit for ${comp.name || 'CHIP'}`);

        // Double click: directly open sub-circuit
        groupElem.addEventListener('dblclick', e => {
          e.preventDefault();
          e.stopPropagation();
          viewChipCircuit(comp, true);
        });

        // Right click: open modal chip context menu
        groupElem.addEventListener('contextmenu', e => {
          e.preventDefault();
          e.stopPropagation();
          targetNestedChip = comp;

          if (modalCtxMenu && container) {
            const rect = container.getBoundingClientRect();
            const posX = Math.max(10, Math.min(rect.width - 160, e.clientX - rect.left));
            const posY = Math.max(10, Math.min(rect.height - 90, e.clientY - rect.top));

            modalCtxMenu.style.left = `${posX}px`;
            modalCtxMenu.style.top = `${posY}px`;
            modalCtxMenu.style.display = 'block';
          }
        });
      }
    });

    openModal('modal-view-chip');
  }

  document.getElementById('tt-format-binary')?.addEventListener('click', () => {
    truthTableFormatMode = 'binary';
    document.getElementById('tt-format-binary')?.classList.add('active');
    document.getElementById('tt-format-boolean')?.classList.remove('active');
    renderCurrentTruthTable();
  });

  document.getElementById('tt-format-boolean')?.addEventListener('click', () => {
    truthTableFormatMode = 'boolean';
    document.getElementById('tt-format-boolean')?.classList.add('active');
    document.getElementById('tt-format-binary')?.classList.remove('active');
    renderCurrentTruthTable();
  });

  document.getElementById('menu-circuit-truthtable')?.addEventListener('click', () => {
    activeViewingChip = null;
    renderCurrentTruthTable();
    openModal('modal-truthtable');
  });

  document.getElementById('menu-circuit-reset')?.addEventListener('click', () => {
    history.beginTransaction('reset inputs');
    circuit.components.forEach(c => {
      if (c.type === ComponentTypes.INPUT) c.value = 0;
    });
    history.commitTransaction();
    interaction.triggerSimulation();
  });

  document.getElementById('menu-circuit-clearwires')?.addEventListener('click', () => {
    if (confirm('Remove all wire connections?')) {
      history.beginTransaction('clear wires');
      circuit.connections = [];
      history.commitTransaction();
      interaction.triggerSimulation();
    }
  });

  document.getElementById('menu-help-shortcuts')?.addEventListener('click', () => {
    openModal('modal-shortcuts');
  });
  document.getElementById('menu-help-about')?.addEventListener('click', () => {
    openModal('modal-about');
  });

  // Boolean Logic Menu
  document.getElementById('menu-logic-panel')?.addEventListener('click', () => {
    openModal('modal-logic');
    logicUI?.updateLiveEquations();
  });
  document.getElementById('menu-logic-truthtable')?.addEventListener('click', () => {
    activeViewingChip = null;
    openModal('modal-truthtable');
    renderCurrentTruthTable();
  });

  // Context Menu Actions
  document.getElementById('ctx-create-chip')?.addEventListener('click', () => {
    uiCallbacks.onHideContextMenu();
    openCreateChipModal();
  });

  document.getElementById('ctx-chip-rename')?.addEventListener('click', () => {
    uiCallbacks.onHideContextMenu();
    openRenameChipModal();
  });

  document.getElementById('ctx-chip-view')?.addEventListener('click', () => {
    uiCallbacks.onHideContextMenu();
    viewChipCircuit();
  });

  document.getElementById('ctx-chip-truth-table')?.addEventListener('click', () => {
    uiCallbacks.onHideContextMenu();
    viewChipTruthTable();
  });

  document.getElementById('ctx-chip-to-circuit')?.addEventListener('click', () => {
    uiCallbacks.onHideContextMenu();
    interaction.expandChip();
  });

  // Modal Submit Handlers
  document.getElementById('btn-submit-create-chip')?.addEventListener('click', () => {
    const input = document.getElementById('create-chip-name-input');
    const name = input ? input.value.trim() : 'MyChip';
    document.getElementById('modal-create-chip')?.classList.remove('active');
    interaction.createChip(name || 'MyChip');
  });

  document.getElementById('create-chip-name-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('btn-submit-create-chip')?.click();
    }
  });

  document.getElementById('btn-submit-rename-chip')?.addEventListener('click', () => {
    const input = document.getElementById('rename-chip-name-input');
    const name = input ? input.value.trim() : '';
    document.getElementById('modal-rename-chip')?.classList.remove('active');
    if (activeRenamingChipId && name) {
      interaction.renameChip(activeRenamingChipId, name);
    }
  });

  document.getElementById('rename-chip-name-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('btn-submit-rename-chip')?.click();
    }
  });

  document.getElementById('ctx-copy')?.addEventListener('click', () => {
    interaction.copySelected();
    uiCallbacks.onHideContextMenu();
  });

  document.getElementById('ctx-paste')?.addEventListener('click', () => {
    interaction.pasteSelected();
    uiCallbacks.onHideContextMenu();
  });

  document.getElementById('ctx-duplicate')?.addEventListener('click', () => {
    interaction.duplicateSelected();
    uiCallbacks.onHideContextMenu();
  });

  document.getElementById('ctx-rotate')?.addEventListener('click', () => {
    interaction.rotateSelected();
    uiCallbacks.onHideContextMenu();
  });

  document.getElementById('ctx-toggle')?.addEventListener('click', () => {
    const selectedCompIds = Array.from(interaction.selectedCompIds);
    if (selectedCompIds.length > 0) {
      history.beginTransaction('toggle input');
      selectedCompIds.forEach(id => {
        const comp = circuit.components.get(id);
        if (comp && comp.type === ComponentTypes.INPUT) {
          circuit.toggleInput(id);
        }
      });
      history.commitTransaction();
      interaction.triggerSimulation();
    }
    uiCallbacks.onHideContextMenu();
  });

  document.getElementById('ctx-delete')?.addEventListener('click', () => {
    interaction.deleteSelected();
    uiCallbacks.onHideContextMenu();
  });

  document.getElementById('tool-ic')?.addEventListener('click', () => {
    openICLibraryModal();
  });

  document.getElementById('ctx-ic-info')?.addEventListener('click', () => {
    const compId = interaction.selectedCompId;
    const comp = circuit.components.get(compId);
    if (comp) openICInfoModal(comp);
    uiCallbacks.onHideContextMenu();
  });

  document.getElementById('ctx-power-info')?.addEventListener('click', () => {
    const compId = interaction.selectedCompId;
    const comp = circuit.components.get(compId);
    if (comp) {
      const spec = POWER_RAIL_SPECS[comp.type];
      showToast(`${spec?.label || comp.type} Power Source (${spec?.voltage ?? 0}V)`);
    }
    uiCallbacks.onHideContextMenu();
  });

  // --------------------------------------------------------------------------
  // IC Component Library & Info Modals
  // --------------------------------------------------------------------------
  let currentICCategory = 'All';
  let currentSelectedIC = null;

  function escapeSvgText(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderICPreview(ic) {
    const emptyElem = document.getElementById('ic-preview-empty');
    const contentElem = document.getElementById('ic-preview-content');
    const svgElem = document.getElementById('ic-preview-svg');
    if (!ic) {
      if (emptyElem) emptyElem.style.display = 'flex';
      if (contentElem) contentElem.style.display = 'none';
      return;
    }

    if (emptyElem) emptyElem.style.display = 'none';
    if (contentElem) contentElem.style.display = 'flex';

    document.getElementById('ic-preview-title').textContent = ic.name || ic.id;
    document.getElementById('ic-preview-package').textContent = ic.package || 'DIP';
    document.getElementById('ic-preview-desc').textContent = ic.description || '';

    const pinCount = ic.pinCount || (Array.isArray(ic.pins) ? ic.pins.length : 14);
    const pinsPerSide = Math.ceil(pinCount / 2);
    const pinSpacing = 24;
    const bodyW = 110;
    const bodyH = pinsPerSide * pinSpacing + 28;
    const halfW = bodyW / 2;
    const halfH = bodyH / 2;
    const startY = -((pinsPerSide - 1) * pinSpacing) / 2;

    let pinsMarkup = '';
    const defPins = Array.isArray(ic.pins) ? ic.pins : [];

    // Left Pins: 1 .. pinsPerSide
    for (let idx = 0; idx < pinsPerSide; idx++) {
      const pinNum = idx + 1;
      const p = defPins.find(x => x.number === pinNum) || { name: String(pinNum) };
      const dy = startY + idx * pinSpacing;
      const isPwr = p.kind === 'power' || p.type === 'power';
      const col = isPwr ? '#0284c7' : (p.type === 'out' ? '#059669' : '#334155');
      pinsMarkup += `
        <line x1="${-halfW - 14}" y1="${dy}" x2="${-halfW}" y2="${dy}" stroke="#64748b" stroke-width="2"/>
        <circle cx="${-halfW - 14}" cy="${dy}" r="3" fill="#ffffff" stroke="#64748b" stroke-width="1.5"/>
        <text x="${-halfW - 20}" y="${dy + 3.5}" text-anchor="end" font-size="9" font-weight="700" fill="#64748b">${pinNum}</text>
        <text x="${-halfW + 6}" y="${dy + 3.5}" text-anchor="start" font-size="9" font-weight="700" fill="${col}">${escapeSvgText(p.name || pinNum)}</text>
      `;
    }

    // Right Pins: pinCount .. pinsPerSide + 1
    for (let idx = 0; idx < pinsPerSide; idx++) {
      const pinNum = pinCount - idx;
      if (pinNum <= pinsPerSide) continue;
      const p = defPins.find(x => x.number === pinNum) || { name: String(pinNum) };
      const dy = startY + idx * pinSpacing;
      const isPwr = p.kind === 'power' || p.type === 'power';
      const col = isPwr ? '#0284c7' : (p.type === 'out' ? '#059669' : '#334155');
      pinsMarkup += `
        <line x1="${halfW}" y1="${dy}" x2="${halfW + 14}" y2="${dy}" stroke="#64748b" stroke-width="2"/>
        <circle cx="${halfW + 14}" cy="${dy}" r="3" fill="#ffffff" stroke="#64748b" stroke-width="1.5"/>
        <text x="${halfW + 20}" y="${dy + 3.5}" text-anchor="start" font-size="9" font-weight="700" fill="#64748b">${pinNum}</text>
        <text x="${halfW - 6}" y="${dy + 3.5}" text-anchor="end" font-size="9" font-weight="700" fill="${col}">${escapeSvgText(p.name || pinNum)}</text>
      `;
    }

    const viewBoxW = bodyW + 80;
    const viewBoxH = bodyH + 30;
    svgElem.setAttribute('viewBox', `${-viewBoxW/2} ${-viewBoxH/2} ${viewBoxW} ${viewBoxH}`);
    svgElem.innerHTML = `
      <rect x="${-halfW}" y="${-halfH}" width="${bodyW}" height="${bodyH}" rx="4" fill="#ffffff" stroke="#1e293b" stroke-width="2"/>
      <path d="M -7 ${-halfH} A 7 7 0 0 0 7 ${-halfH}" fill="#ffffff" stroke="#1e293b" stroke-width="2"/>
      <text x="0" y="-4" text-anchor="middle" font-size="12" font-weight="800" fill="#0f172a">${escapeSvgText(ic.name || ic.id)}</text>
      <text x="0" y="10" text-anchor="middle" font-size="8.5" font-weight="600" fill="#64748b">${escapeSvgText(ic.package || 'DIP')}</text>
      ${pinsMarkup}
    `;
  }

  function updateICResultsList() {
    const query = document.getElementById('ic-search-input')?.value || '';
    const results = searchICs(query, currentICCategory);
    const listContainer = document.getElementById('ic-results-list');
    if (!listContainer) return;

    if (results.length === 0) {
      listContainer.innerHTML = `
        <div style="padding: 24px; text-align: center; color: #94a3b8; font-size: 13px;">
          No ICs found matching "<strong>${escapeSvgText(query)}</strong>".
        </div>
      `;
      renderICPreview(null);
      return;
    }

    listContainer.innerHTML = '';
    results.forEach(ic => {
      const isSelected = currentSelectedIC && currentSelectedIC.id === ic.id;
      const card = document.createElement('div');
      card.className = `ic-card ${isSelected ? 'selected' : ''}`;
      card.innerHTML = `
        <div class="ic-card-header">
          <span class="ic-card-title">${escapeSvgText(ic.name || ic.id)}</span>
          <span class="ic-card-badge">${escapeSvgText(ic.family || '74xx')} / ${escapeSvgText(ic.package || 'DIP')}</span>
        </div>
        <div class="ic-card-desc">${escapeSvgText(ic.description || '')}</div>
        <div class="ic-card-footer">
          <span>Category: ${escapeSvgText(ic.category || 'Logic')}</span>
          <span>${ic.pinCount || (Array.isArray(ic.pins) ? ic.pins.length : 14)} Pins</span>
        </div>
      `;

      card.addEventListener('click', () => {
        currentSelectedIC = ic;
        document.querySelectorAll('.ic-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        renderICPreview(ic);
      });

      card.addEventListener('dblclick', () => {
        selectAndPlaceIC(ic);
      });

      listContainer.appendChild(card);
    });

    if (!currentSelectedIC || !results.some(r => r.id === currentSelectedIC.id)) {
      currentSelectedIC = results[0];
      const firstCard = listContainer.querySelector('.ic-card');
      if (firstCard) firstCard.classList.add('selected');
    }
    renderICPreview(currentSelectedIC);
  }

  function selectAndPlaceIC(ic) {
    if (!ic) return;
    interaction.selectedICDefinitionId = ic.id;
    interaction.setActiveTool(ComponentTypes.IC);
    document.getElementById('modal-ic-library')?.classList.remove('active');
    showToast(`Place IC: ${ic.name || ic.id} (Click canvas to place)`);
  }

  function openICLibraryModal() {
    const chipsContainer = document.getElementById('ic-category-chips');
    if (chipsContainer && chipsContainer.children.length === 0) {
      const categories = getICCategories();
      categories.forEach(cat => {
        const pill = document.createElement('button');
        pill.className = `ic-category-pill ${cat === currentICCategory ? 'active' : ''}`;
        pill.textContent = cat;
        pill.addEventListener('click', () => {
          currentICCategory = cat;
          document.querySelectorAll('.ic-category-pill').forEach(p => p.classList.remove('active'));
          pill.classList.add('active');
          updateICResultsList();
        });
        chipsContainer.appendChild(pill);
      });
    }

    const searchInput = document.getElementById('ic-search-input');
    if (searchInput) {
      searchInput.value = '';
      searchInput.oninput = () => updateICResultsList();
    }

    updateICResultsList();
    document.getElementById('modal-ic-library')?.classList.add('active');
    setTimeout(() => searchInput?.focus(), 50);
  }

  document.getElementById('btn-ic-place')?.addEventListener('click', () => {
    selectAndPlaceIC(currentSelectedIC);
  });

  function openICInfoModal(comp) {
    const defId = comp?.icData?.definitionId || '74HC00';
    const def = getICDefinition(defId) || comp?.icData || {};
    const titleElem = document.getElementById('ic-info-title');
    const metaElem = document.getElementById('ic-info-meta');
    const tbody = document.getElementById('ic-info-pins-tbody');

    if (titleElem) titleElem.textContent = `${def.name || defId} Information`;
    if (metaElem) {
      metaElem.innerHTML = `
        <div><strong>Part Number:</strong> ${escapeSvgText(def.name || defId)} (${escapeSvgText(def.family || '74xx')} Series)</div>
        <div><strong>Description:</strong> ${escapeSvgText(def.description || 'Standard Integrated Circuit')}</div>
        <div><strong>Package:</strong> ${escapeSvgText(def.package || 'DIP-14')} (${def.pinCount || (Array.isArray(def.pins) ? def.pins.length : 14)} Pins)</div>
        <div><strong>Category:</strong> ${escapeSvgText(def.category || 'Logic')}</div>
      `;
    }

    if (tbody) {
      tbody.innerHTML = '';
      const pins = Array.isArray(def.pins) ? def.pins : [];
      pins.forEach(pin => {
        const isPower = pin.kind === 'power' || pin.category === 'power';
        const typeLabel = isPower ? 'POWER' : (pin.type === 'out' ? 'OUTPUT' : 'INPUT');
        const typeColor = isPower ? '#0284c7' : (pin.type === 'out' ? '#059669' : '#334155');
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td style="padding: 6px 10px; border-bottom: 1px solid #f1f5f9; font-weight: 700; color: #64748b;">Pin ${pin.number}</td>
          <td style="padding: 6px 10px; border-bottom: 1px solid #f1f5f9; font-weight: 700; color: ${typeColor};">${escapeSvgText(pin.name)}</td>
          <td style="padding: 6px 10px; border-bottom: 1px solid #f1f5f9; font-size: 11px; font-weight: 700; color: ${typeColor};">${typeLabel}</td>
          <td style="padding: 6px 10px; border-bottom: 1px solid #f1f5f9; color: #475569;">${escapeSvgText(pin.description || '')}</td>
        `;
        tbody.appendChild(tr);
      });
    }

    document.getElementById('modal-ic-info')?.classList.add('active');
  }

  document.getElementById('btn-view-chip-back')?.addEventListener('click', () => {
    if (chipViewStack.length > 1) {
      chipViewStack.pop();
      const prevChip = chipViewStack[chipViewStack.length - 1];
      viewChipCircuit(prevChip, false);
    }
  });

  document.getElementById('ctx-modal-view-nested-chip')?.addEventListener('click', () => {
    if (targetNestedChip) {
      const chipToView = targetNestedChip;
      hideModalChipContextMenu();
      viewChipCircuit(chipToView, true);
    }
  });

  document.getElementById('ctx-modal-tt-nested-chip')?.addEventListener('click', () => {
    if (targetNestedChip) {
      const chipToView = targetNestedChip;
      hideModalChipContextMenu();
      viewChipTruthTable(chipToView);
    }
  });

  document.getElementById('view-chip-canvas-container')?.addEventListener('click', (e) => {
    if (!e.target.closest('#modal-chip-context-menu')) {
      hideModalChipContextMenu();
    }
  });

  window.addEventListener('click', (e) => {
    uiCallbacks.onHideContextMenu();
    if (!e.target.closest('#modal-chip-context-menu')) {
      hideModalChipContextMenu();
    }
  });

  // Modals management
  function openModal(id) {
    document.getElementById(id)?.classList.add('active');
  }

  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      const modalId = btn.getAttribute('data-close');
      document.getElementById(modalId)?.classList.remove('active');
      if (modalId === 'modal-view-chip') {
        chipViewStack = [];
        hideModalChipContextMenu();
      }
    });
  });

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('active');
        if (overlay.id === 'modal-view-chip') {
          chipViewStack = [];
          hideModalChipContextMenu();
        }
      }
    });
  });

  // --------------------------------------------------------------------------
  // Global Keyboard Shortcuts
  // --------------------------------------------------------------------------
  window.addEventListener('keydown', (e) => {
    // Ignore key shortcuts if typing in input/textarea or modal is open
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
    if (document.querySelector('.modal-overlay.active')) return;

    const ctrl = e.ctrlKey || e.metaKey;

    if (e.key === 'Escape' || e.key === 'Esc') {
      e.preventDefault();
      interaction.cancelActiveGesture();
    } else if (e.key === 'Enter') {
      if (interaction.isCreatingWire) {
        e.preventDefault();
        interaction.finishWireCreation();
        return;
      }
      if (interaction.isPullingBranch) {
        e.preventDefault();
        interaction.finishBranchCreation();
        return;
      }
    } else if (e.altKey && e.key.toLowerCase() === 'n') {
      e.preventDefault();
      createNewCanvas(true);
      return;
    } else if (ctrl && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (history.undo()) {
        interaction.clearSelection();
        interaction.triggerSimulation();
      }
    } else if (ctrl && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      if (history.redo()) {
        interaction.clearSelection();
        interaction.triggerSimulation();
      }
    } else if (ctrl && e.key.toLowerCase() === 'c') {
      e.preventDefault();
      interaction.copySelected();
    } else if (ctrl && e.key.toLowerCase() === 'v') {
      e.preventDefault();
      interaction.pasteSelected();
    } else if (ctrl && e.key.toLowerCase() === 's') {
      e.preventDefault();
      if (StorageManager.saveToLocalStorage(circuit)) {
        showToast('Circuit saved to LocalStorage!');
      }
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      if (interaction.isPasting) {
        e.preventDefault();
        interaction.cancelPaste();
      } else {
        interaction.deleteSelected();
      }
    } else if (e.key.toLowerCase() === 'v') {
      interaction.setActiveTool('select');
    } else if (e.key.toLowerCase() === 'm') {
      interaction.setActiveTool('move');
    } else if (e.key.toLowerCase() === 'b') {
      interaction.setActiveTool('box-select');
    } else if (e.key.toLowerCase() === 'h') {
      interaction.setActiveTool('pan');
    } else if (e.key.toLowerCase() === 'i') {
      interaction.setActiveTool(ComponentTypes.INPUT);
    } else if (e.key.toLowerCase() === 'o') {
      interaction.setActiveTool(ComponentTypes.OUTPUT);
    } else if (e.key.toLowerCase() === 'a') {
      interaction.setActiveTool(ComponentTypes.AND);
    } else if (e.key.toLowerCase() === 'r') {
      interaction.setActiveTool(ComponentTypes.OR);
    } else if (e.key.toLowerCase() === 'n') {
      interaction.setActiveTool(ComponentTypes.NOT);
    } else if (e.key.toLowerCase() === 'w') {
      interaction.setActiveTool('wire');
    } else if (e.key.toLowerCase() === 'c' && !ctrl) {
      interaction.setActiveTool(ComponentTypes.CLOCK);
    }
  });

  // --------------------------------------------------------------------------
  // Initial Canvas Loading (Fresh Canvas by Default)
  // --------------------------------------------------------------------------
  function loadInitialCircuit() {
    const loaded = StorageManager.loadFromLocalStorage(circuit);
    if (!loaded || circuit.components.size === 0) {
      createNewCanvas(false);
    } else {
      interaction.triggerSimulation();
      interaction.requestRender();
      updateSidebarStats();
      if (logicUI) logicUI.updateLiveEquations();
    }
  }

  loadInitialCircuit();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
