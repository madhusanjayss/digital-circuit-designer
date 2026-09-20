# Digital Logic Circuit Designer & Simulator

A desktop-class, browser-based **Digital Logic Circuit Designer and Simulator** built with **HTML5**, **CSS3**, **Vanilla JavaScript**, and **Python (Flask)**.

Inspired by the visual simplicity and instant interactivity of classic desktop drawing applications like **Microsoft Paint**, this application lets users place digital logic gates, connect them with orthogonal Manhattan wires, toggle input switches, observe signal propagation in real-time, generate truth tables, and export vector diagrams.

---

## Features

- **Standard ANSI/IEEE Logic Gates**:
  - `Input` (0 / 1 toggle switch with glow indicators)
  - `Output` (Indicator bulb lamp with OFF/ON states)
  - `AND`, `OR`, `NOT`, `NAND`, `NOR`, `XOR`, `XNOR`
- **Interactive SVG Circuit Canvas**:
  - Grid background with snap-to-grid alignment.
  - Manhattan (orthogonal) wire routing with signal voltage coloring (Green for HIGH/1, Slate for LOW/0).
  - Smooth pan & zoom with mouse wheel or toolbar controls.
- **Real-Time Simulation Engine**:
  - Graph-based signal propagation with cycle/feedback loop detection.
  - Immediate state updates on input clicks or wire reconnects.
- **Desktop Workflow**:
  - Undo & Redo history stack (`Ctrl+Z`, `Ctrl+Y`).
  - Selection Inspector and right-click context menu (Rotate, Duplicate, Toggle, Delete).
  - Automatic Truth Table Generator for $N$ inputs and $M$ outputs.
  - Export circuits as `JSON`, `SVG`, or `PNG` images.
  - `localStorage` autosave and restore.

---

## Installation & Running

### Requirements
- Python 3.8+

### Setup

1. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Start the Local Flask Server**:
   ```bash
   python app.py
   ```

3. **Open in Browser**:
   Navigate to [http://127.0.0.1:5000](http://127.0.0.1:5000)

---

## Keyboard Shortcuts

| Shortcut | Function |
|---|---|
| `V` | Select Tool |
| `I` | Input Component Tool |
| `O` | Output Bulb Tool |
| `A` | AND Gate Tool |
| `R` | OR Gate Tool |
| `N` | NOT Gate Tool |
| `W` | Wire Connection Tool |
| `Del` / `Backspace` | Delete Selected Item |
| `Ctrl + Z` | Undo Action |
| `Ctrl + Y` | Redo Action |
| `Ctrl + C` / `Ctrl + V` | Copy / Paste Gate |
| `Ctrl + S` | Save Circuit to LocalStorage |
| `Mouse Wheel` | Zoom Canvas In / Out |
| `Middle Click + Drag` | Pan Workspace Canvas |

---

## Project Architecture

```text
digital-circuit-designer/
│
├── app.py                      # Flask server hosting local application
├── requirements.txt            # Python dependencies (flask)
├── README.md                   # Documentation & setup guide
│
├── templates/
│   └── index.html              # HTML5 Application template & modals
│
└── static/
    ├── css/
    │   └── style.css           # Desktop MS Paint design theme & component styles
    └── js/
        ├── main.js             # Main initialization & toolbar controller
        ├── circuit.js          # Circuit graph data model
        ├── components.js       # Component specs & standard SVG path definitions
        ├── simulator.js        # Real-time Boolean logic propagation & cycle detector
        ├── renderer.js         # SVG renderer & Manhattan wire router
        ├── interaction.js      # Pointer, canvas, dragging & selection handler
        ├── history.js          # Undo / Redo history manager
        ├── storage.js          # LocalStorage persistence & file export/import
        └── truthtable.js       # Truth table generator
```
