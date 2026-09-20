import { migrateCircuitData } from './circuit.js';

const STORAGE_KEY = 'digital_logic_circuit_data';

function buildCleanExportClone(svgElem) {
  const clone = svgElem.cloneNode(true);

  clone.querySelector('#canvas-grid')?.remove();
  clone.querySelector('#temp-wire-layer')?.replaceChildren();
  clone.querySelectorAll(
    '.selection-box, .group-bounding-box, .selection-handle-dot, .paste-preview-badge-group, .marquee-box, .magnet-pulse'
  ).forEach(elem => elem.remove());

  clone.querySelectorAll('.port-hover, .magnet-snap, .selected, .paste-preview-component').forEach(elem => {
    elem.classList.remove('port-hover', 'magnet-snap', 'selected', 'paste-preview-component');
    elem.removeAttribute('style');
  });

  if (!clone.getAttribute('xmlns')) {
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  }

  return clone;
}

export class StorageManager {
  static saveToLocalStorage(circuit) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(circuit.toJSON()));
      return true;
    } catch (error) {
      console.error('LocalStorage Save Error:', error);
      return false;
    }
  }

  static loadFromLocalStorage(circuit) {
    try {
      const jsonStr = localStorage.getItem(STORAGE_KEY);
      if (!jsonStr) return false;
      return circuit.fromJSON(migrateCircuitData(JSON.parse(jsonStr)));
    } catch (error) {
      console.error('LocalStorage Load Error:', error);
      return false;
    }
  }

  static clearLocalStorage() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      return true;
    } catch (error) {
      console.error('LocalStorage Clear Error:', error);
      return false;
    }
  }

  static exportJSON(circuit, filename = 'circuit.json') {
    const jsonStr = JSON.stringify(circuit.toJSON(), null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  static importJSON(circuit, jsonContent) {
    try {
      const data = JSON.parse(jsonContent);
      return circuit.fromJSON(migrateCircuitData(data));
    } catch (error) {
      console.error('Import JSON Error:', error);
      return false;
    }
  }

  static exportSVG(svgElem, filename = 'circuit.svg') {
    const clone = buildCleanExportClone(svgElem);
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(clone);
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  static exportPNG(svgElem, filename = 'circuit.png') {
    const clone = buildCleanExportClone(svgElem);
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(clone);
    const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = svgElem.clientWidth || 1200;
      canvas.height = svgElem.clientHeight || 800;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

      const pngUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = pngUrl;
      a.download = filename;
      a.click();
    };
    img.src = url;
  }
}
