/* ==========================================================================
   IC Library - Central Data-Driven Integrated Circuit Registry
   ========================================================================== */

/**
 * Standard DIP Package Geometry and Pin Arrangement:
 * For a DIP-N package:
 * - Left side (Top-to-Bottom): Pins 1 .. N/2
 * - Right side (Top-to-Bottom): Pins N .. N/2 + 1
 */

export const IC_LIBRARY = {
  // ---------------------------------------------------------------------------
  // 74HC00 / 7400 / 74LS00 - Quad 2-Input NAND Gates (DIP-14)
  // ---------------------------------------------------------------------------
  '74HC00': {
    id: '74HC00',
    name: '74HC00',
    family: '74HC',
    category: 'Logic Gates',
    description: 'Quad 2-Input NAND Gates',
    package: 'DIP-14',
    pinCount: 14,
    keywords: ['7400', '74ls00', '74hc00', 'nand', 'quad', 'gate', 'dip14'],
    pins: [
      { number: 1, id: 'pin1', name: '1A', type: 'in', kind: 'logic', description: 'Gate 1 Input A' },
      { number: 2, id: 'pin2', name: '1B', type: 'in', kind: 'logic', description: 'Gate 1 Input B' },
      { number: 3, id: 'pin3', name: '1Y', type: 'out', kind: 'logic', description: 'Gate 1 Output (1Y = ~(1A & 1B))' },
      { number: 4, id: 'pin4', name: '2A', type: 'in', kind: 'logic', description: 'Gate 2 Input A' },
      { number: 5, id: 'pin5', name: '2B', type: 'in', kind: 'logic', description: 'Gate 2 Input B' },
      { number: 6, id: 'pin6', name: '2Y', type: 'out', kind: 'logic', description: 'Gate 2 Output (2Y = ~(2A & 2B))' },
      { number: 7, id: 'pin7', name: 'GND', type: 'in', kind: 'power', voltage: 0, isGround: true, description: 'Ground Supply (0 V)' },
      { number: 8, id: 'pin8', name: '3Y', type: 'out', kind: 'logic', description: 'Gate 3 Output (3Y = ~(3A & 3B))' },
      { number: 9, id: 'pin9', name: '3A', type: 'in', kind: 'logic', description: 'Gate 3 Input A' },
      { number: 10, id: 'pin10', name: '3B', type: 'in', kind: 'logic', description: 'Gate 3 Input B' },
      { number: 11, id: 'pin11', name: '4Y', type: 'out', kind: 'logic', description: 'Gate 4 Output (4Y = ~(4A & 4B))' },
      { number: 12, id: 'pin12', name: '4A', type: 'in', kind: 'logic', description: 'Gate 4 Input A' },
      { number: 13, id: 'pin13', name: '4B', type: 'in', kind: 'logic', description: 'Gate 4 Input B' },
      { number: 14, id: 'pin14', name: 'VCC', type: 'in', kind: 'power', voltage: 5, description: 'Positive Supply Voltage (+5 V)' }
    ],
    simulate(inputs, isPowered = true) {
      if (!isPowered) return { pin3: 0, pin6: 0, pin8: 0, pin11: 0 };
      const a1 = inputs.pin1 ?? 0, b1 = inputs.pin2 ?? 0;
      const a2 = inputs.pin4 ?? 0, b2 = inputs.pin5 ?? 0;
      const a3 = inputs.pin9 ?? 0, b3 = inputs.pin10 ?? 0;
      const a4 = inputs.pin12 ?? 0, b4 = inputs.pin13 ?? 0;
      return {
        pin3: (a1 === 1 && b1 === 1) ? 0 : 1,
        pin6: (a2 === 1 && b2 === 1) ? 0 : 1,
        pin8: (a3 === 1 && b3 === 1) ? 0 : 1,
        pin11: (a4 === 1 && b4 === 1) ? 0 : 1
      };
    }
  },

  // ---------------------------------------------------------------------------
  // 74HC02 / 7402 / 74LS02 - Quad 2-Input NOR Gates (DIP-14)
  // ---------------------------------------------------------------------------
  '74HC02': {
    id: '74HC02',
    name: '74HC02',
    family: '74HC',
    category: 'Logic Gates',
    description: 'Quad 2-Input NOR Gates',
    package: 'DIP-14',
    pinCount: 14,
    keywords: ['7402', '74ls02', '74hc02', 'nor', 'quad', 'gate', 'dip14'],
    pins: [
      { number: 1, id: 'pin1', name: '1Y', type: 'out', kind: 'logic', description: 'Gate 1 Output (1Y = ~(1A | 1B))' },
      { number: 2, id: 'pin2', name: '1A', type: 'in', kind: 'logic', description: 'Gate 1 Input A' },
      { number: 3, id: 'pin3', name: '1B', type: 'in', kind: 'logic', description: 'Gate 1 Input B' },
      { number: 4, id: 'pin4', name: '2Y', type: 'out', kind: 'logic', description: 'Gate 2 Output (2Y = ~(2A | 2B))' },
      { number: 5, id: 'pin5', name: '2A', type: 'in', kind: 'logic', description: 'Gate 2 Input A' },
      { number: 6, id: 'pin6', name: '2B', type: 'in', kind: 'logic', description: 'Gate 2 Input B' },
      { number: 7, id: 'pin7', name: 'GND', type: 'in', kind: 'power', voltage: 0, isGround: true, description: 'Ground Supply (0 V)' },
      { number: 8, id: 'pin8', name: '3A', type: 'in', kind: 'logic', description: 'Gate 3 Input A' },
      { number: 9, id: 'pin9', name: '3B', type: 'in', kind: 'logic', description: 'Gate 3 Input B' },
      { number: 10, id: 'pin10', name: '3Y', type: 'out', kind: 'logic', description: 'Gate 3 Output (3Y = ~(3A | 3B))' },
      { number: 11, id: 'pin11', name: '4A', type: 'in', kind: 'logic', description: 'Gate 4 Input A' },
      { number: 12, id: 'pin12', name: '4B', type: 'in', kind: 'logic', description: 'Gate 4 Input B' },
      { number: 13, id: 'pin13', name: '4Y', type: 'out', kind: 'logic', description: 'Gate 4 Output (4Y = ~(4A | 4B))' },
      { number: 14, id: 'pin14', name: 'VCC', type: 'in', kind: 'power', voltage: 5, description: 'Positive Supply Voltage (+5 V)' }
    ],
    simulate(inputs, isPowered = true) {
      if (!isPowered) return { pin1: 0, pin4: 0, pin10: 0, pin13: 0 };
      const a1 = inputs.pin2 ?? 0, b1 = inputs.pin3 ?? 0;
      const a2 = inputs.pin5 ?? 0, b2 = inputs.pin6 ?? 0;
      const a3 = inputs.pin8 ?? 0, b3 = inputs.pin9 ?? 0;
      const a4 = inputs.pin11 ?? 0, b4 = inputs.pin12 ?? 0;
      return {
        pin1: (a1 === 1 || b1 === 1) ? 0 : 1,
        pin4: (a2 === 1 || b2 === 1) ? 0 : 1,
        pin10: (a3 === 1 || b3 === 1) ? 0 : 1,
        pin13: (a4 === 1 || b4 === 1) ? 0 : 1
      };
    }
  },

  // ---------------------------------------------------------------------------
  // 74HC04 / 7404 / 74LS04 - Hex Inverters / NOT Gates (DIP-14)
  // ---------------------------------------------------------------------------
  '74HC04': {
    id: '74HC04',
    name: '74HC04',
    family: '74HC',
    category: 'Buffers / Inverters',
    description: 'Hex Inverters (6 NOT Gates)',
    package: 'DIP-14',
    pinCount: 14,
    keywords: ['7404', '74ls04', '74hc04', 'not', 'inverter', 'hex', 'gate', 'dip14'],
    pins: [
      { number: 1, id: 'pin1', name: '1A', type: 'in', kind: 'logic', description: 'Inverter 1 Input' },
      { number: 2, id: 'pin2', name: '1Y', type: 'out', kind: 'logic', description: 'Inverter 1 Output (~1A)' },
      { number: 3, id: 'pin3', name: '2A', type: 'in', kind: 'logic', description: 'Inverter 2 Input' },
      { number: 4, id: 'pin4', name: '2Y', type: 'out', kind: 'logic', description: 'Inverter 2 Output (~2A)' },
      { number: 5, id: 'pin5', name: '3A', type: 'in', kind: 'logic', description: 'Inverter 3 Input' },
      { number: 6, id: 'pin6', name: '3Y', type: 'out', kind: 'logic', description: 'Inverter 3 Output (~3A)' },
      { number: 7, id: 'pin7', name: 'GND', type: 'in', kind: 'power', voltage: 0, isGround: true, description: 'Ground Supply (0 V)' },
      { number: 8, id: 'pin8', name: '4Y', type: 'out', kind: 'logic', description: 'Inverter 4 Output (~4A)' },
      { number: 9, id: 'pin9', name: '4A', type: 'in', kind: 'logic', description: 'Inverter 4 Input' },
      { number: 10, id: 'pin10', name: '5Y', type: 'out', kind: 'logic', description: 'Inverter 5 Output (~5A)' },
      { number: 11, id: 'pin11', name: '5A', type: 'in', kind: 'logic', description: 'Inverter 5 Input' },
      { number: 12, id: 'pin12', name: '6Y', type: 'out', kind: 'logic', description: 'Inverter 6 Output (~6A)' },
      { number: 13, id: 'pin13', name: '6A', type: 'in', kind: 'logic', description: 'Inverter 6 Input' },
      { number: 14, id: 'pin14', name: 'VCC', type: 'in', kind: 'power', voltage: 5, description: 'Positive Supply Voltage (+5 V)' }
    ],
    simulate(inputs, isPowered = true) {
      if (!isPowered) return { pin2: 0, pin4: 0, pin6: 0, pin8: 0, pin10: 0, pin12: 0 };
      return {
        pin2: (inputs.pin1 === 1) ? 0 : 1,
        pin4: (inputs.pin3 === 1) ? 0 : 1,
        pin6: (inputs.pin5 === 1) ? 0 : 1,
        pin8: (inputs.pin9 === 1) ? 0 : 1,
        pin10: (inputs.pin11 === 1) ? 0 : 1,
        pin12: (inputs.pin13 === 1) ? 0 : 1
      };
    }
  },

  // ---------------------------------------------------------------------------
  // 74HC08 / 7408 / 74LS08 - Quad 2-Input AND Gates (DIP-14)
  // ---------------------------------------------------------------------------
  '74HC08': {
    id: '74HC08',
    name: '74HC08',
    family: '74HC',
    category: 'Logic Gates',
    description: 'Quad 2-Input AND Gates',
    package: 'DIP-14',
    pinCount: 14,
    keywords: ['7408', '74ls08', '74hc08', 'and', 'quad', 'gate', 'dip14'],
    pins: [
      { number: 1, id: 'pin1', name: '1A', type: 'in', kind: 'logic', description: 'Gate 1 Input A' },
      { number: 2, id: 'pin2', name: '1B', type: 'in', kind: 'logic', description: 'Gate 1 Input B' },
      { number: 3, id: 'pin3', name: '1Y', type: 'out', kind: 'logic', description: 'Gate 1 Output (1Y = 1A & 1B)' },
      { number: 4, id: 'pin4', name: '2A', type: 'in', kind: 'logic', description: 'Gate 2 Input A' },
      { number: 5, id: 'pin5', name: '2B', type: 'in', kind: 'logic', description: 'Gate 2 Input B' },
      { number: 6, id: 'pin6', name: '2Y', type: 'out', kind: 'logic', description: 'Gate 2 Output (2Y = 2A & 2B)' },
      { number: 7, id: 'pin7', name: 'GND', type: 'in', kind: 'power', voltage: 0, isGround: true, description: 'Ground Supply (0 V)' },
      { number: 8, id: 'pin8', name: '3Y', type: 'out', kind: 'logic', description: 'Gate 3 Output (3Y = 3A & 3B)' },
      { number: 9, id: 'pin9', name: '3A', type: 'in', kind: 'logic', description: 'Gate 3 Input A' },
      { number: 10, id: 'pin10', name: '3B', type: 'in', kind: 'logic', description: 'Gate 3 Input B' },
      { number: 11, id: 'pin11', name: '4Y', type: 'out', kind: 'logic', description: 'Gate 4 Output (4Y = 4A & 4B)' },
      { number: 12, id: 'pin12', name: '4A', type: 'in', kind: 'logic', description: 'Gate 4 Input A' },
      { number: 13, id: 'pin13', name: '4B', type: 'in', kind: 'logic', description: 'Gate 4 Input B' },
      { number: 14, id: 'pin14', name: 'VCC', type: 'in', kind: 'power', voltage: 5, description: 'Positive Supply Voltage (+5 V)' }
    ],
    simulate(inputs, isPowered = true) {
      if (!isPowered) return { pin3: 0, pin6: 0, pin8: 0, pin11: 0 };
      const a1 = inputs.pin1 ?? 0, b1 = inputs.pin2 ?? 0;
      const a2 = inputs.pin4 ?? 0, b2 = inputs.pin5 ?? 0;
      const a3 = inputs.pin9 ?? 0, b3 = inputs.pin10 ?? 0;
      const a4 = inputs.pin12 ?? 0, b4 = inputs.pin13 ?? 0;
      return {
        pin3: (a1 === 1 && b1 === 1) ? 1 : 0,
        pin6: (a2 === 1 && b2 === 1) ? 1 : 0,
        pin8: (a3 === 1 && b3 === 1) ? 1 : 0,
        pin11: (a4 === 1 && b4 === 1) ? 1 : 0
      };
    }
  },

  // ---------------------------------------------------------------------------
  // 74HC32 / 7432 / 74LS32 - Quad 2-Input OR Gates (DIP-14)
  // ---------------------------------------------------------------------------
  '74HC32': {
    id: '74HC32',
    name: '74HC32',
    family: '74HC',
    category: 'Logic Gates',
    description: 'Quad 2-Input OR Gates',
    package: 'DIP-14',
    pinCount: 14,
    keywords: ['7432', '74ls32', '74hc32', 'or', 'quad', 'gate', 'dip14'],
    pins: [
      { number: 1, id: 'pin1', name: '1A', type: 'in', kind: 'logic', description: 'Gate 1 Input A' },
      { number: 2, id: 'pin2', name: '1B', type: 'in', kind: 'logic', description: 'Gate 1 Input B' },
      { number: 3, id: 'pin3', name: '1Y', type: 'out', kind: 'logic', description: 'Gate 1 Output (1Y = 1A | 1B)' },
      { number: 4, id: 'pin4', name: '2A', type: 'in', kind: 'logic', description: 'Gate 2 Input A' },
      { number: 5, id: 'pin5', name: '2B', type: 'in', kind: 'logic', description: 'Gate 2 Input B' },
      { number: 6, id: 'pin6', name: '2Y', type: 'out', kind: 'logic', description: 'Gate 2 Output (2Y = 2A | 2B)' },
      { number: 7, id: 'pin7', name: 'GND', type: 'in', kind: 'power', voltage: 0, isGround: true, description: 'Ground Supply (0 V)' },
      { number: 8, id: 'pin8', name: '3Y', type: 'out', kind: 'logic', description: 'Gate 3 Output (3Y = 3A | 3B)' },
      { number: 9, id: 'pin9', name: '3A', type: 'in', kind: 'logic', description: 'Gate 3 Input A' },
      { number: 10, id: 'pin10', name: '3B', type: 'in', kind: 'logic', description: 'Gate 3 Input B' },
      { number: 11, id: 'pin11', name: '4Y', type: 'out', kind: 'logic', description: 'Gate 4 Output (4Y = 4A | 4B)' },
      { number: 12, id: 'pin12', name: '4A', type: 'in', kind: 'logic', description: 'Gate 4 Input A' },
      { number: 13, id: 'pin13', name: '4B', type: 'in', kind: 'logic', description: 'Gate 4 Input B' },
      { number: 14, id: 'pin14', name: 'VCC', type: 'in', kind: 'power', voltage: 5, description: 'Positive Supply Voltage (+5 V)' }
    ],
    simulate(inputs, isPowered = true) {
      if (!isPowered) return { pin3: 0, pin6: 0, pin8: 0, pin11: 0 };
      const a1 = inputs.pin1 ?? 0, b1 = inputs.pin2 ?? 0;
      const a2 = inputs.pin4 ?? 0, b2 = inputs.pin5 ?? 0;
      const a3 = inputs.pin9 ?? 0, b3 = inputs.pin10 ?? 0;
      const a4 = inputs.pin12 ?? 0, b4 = inputs.pin13 ?? 0;
      return {
        pin3: (a1 === 1 || b1 === 1) ? 1 : 0,
        pin6: (a2 === 1 || b2 === 1) ? 1 : 0,
        pin8: (a3 === 1 || b3 === 1) ? 1 : 0,
        pin11: (a4 === 1 || b4 === 1) ? 1 : 0
      };
    }
  },

  // ---------------------------------------------------------------------------
  // 74HC86 / 7486 / 74LS86 - Quad 2-Input XOR Gates (DIP-14)
  // ---------------------------------------------------------------------------
  '74HC86': {
    id: '74HC86',
    name: '74HC86',
    family: '74HC',
    category: 'Logic Gates',
    description: 'Quad 2-Input Exclusive-OR (XOR) Gates',
    package: 'DIP-14',
    pinCount: 14,
    keywords: ['7486', '74ls86', '74hc86', 'xor', 'exclusive-or', 'quad', 'gate', 'dip14'],
    pins: [
      { number: 1, id: 'pin1', name: '1A', type: 'in', kind: 'logic', description: 'Gate 1 Input A' },
      { number: 2, id: 'pin2', name: '1B', type: 'in', kind: 'logic', description: 'Gate 1 Input B' },
      { number: 3, id: 'pin3', name: '1Y', type: 'out', kind: 'logic', description: 'Gate 1 Output (1Y = 1A ^ 1B)' },
      { number: 4, id: 'pin4', name: '2A', type: 'in', kind: 'logic', description: 'Gate 2 Input A' },
      { number: 5, id: 'pin5', name: '2B', type: 'in', kind: 'logic', description: 'Gate 2 Input B' },
      { number: 6, id: 'pin6', name: '2Y', type: 'out', kind: 'logic', description: 'Gate 2 Output (2Y = 2A ^ 2B)' },
      { number: 7, id: 'pin7', name: 'GND', type: 'in', kind: 'power', voltage: 0, isGround: true, description: 'Ground Supply (0 V)' },
      { number: 8, id: 'pin8', name: '3Y', type: 'out', kind: 'logic', description: 'Gate 3 Output (3Y = 3A ^ 3B)' },
      { number: 9, id: 'pin9', name: '3A', type: 'in', kind: 'logic', description: 'Gate 3 Input A' },
      { number: 10, id: 'pin10', name: '3B', type: 'in', kind: 'logic', description: 'Gate 3 Input B' },
      { number: 11, id: 'pin11', name: '4Y', type: 'out', kind: 'logic', description: 'Gate 4 Output (4Y = 4A ^ 4B)' },
      { number: 12, id: 'pin12', name: '4A', type: 'in', kind: 'logic', description: 'Gate 4 Input A' },
      { number: 13, id: 'pin13', name: '4B', type: 'in', kind: 'logic', description: 'Gate 4 Input B' },
      { number: 14, id: 'pin14', name: 'VCC', type: 'in', kind: 'power', voltage: 5, description: 'Positive Supply Voltage (+5 V)' }
    ],
    simulate(inputs, isPowered = true) {
      if (!isPowered) return { pin3: 0, pin6: 0, pin8: 0, pin11: 0 };
      const a1 = inputs.pin1 ?? 0, b1 = inputs.pin2 ?? 0;
      const a2 = inputs.pin4 ?? 0, b2 = inputs.pin5 ?? 0;
      const a3 = inputs.pin9 ?? 0, b3 = inputs.pin10 ?? 0;
      const a4 = inputs.pin12 ?? 0, b4 = inputs.pin13 ?? 0;
      return {
        pin3: (a1 ^ b1) ? 1 : 0,
        pin6: (a2 ^ b2) ? 1 : 0,
        pin8: (a3 ^ b3) ? 1 : 0,
        pin11: (a4 ^ b4) ? 1 : 0
      };
    }
  },

  // ---------------------------------------------------------------------------
  // 74HC138 / 74138 - 3-to-8 Line Inverting Decoder / Demultiplexer (DIP-16)
  // ---------------------------------------------------------------------------
  '74HC138': {
    id: '74HC138',
    name: '74HC138',
    family: '74HC',
    category: 'Decoders',
    description: '3-to-8 Line Inverting Decoder / Demultiplexer',
    package: 'DIP-16',
    pinCount: 16,
    keywords: ['74138', '74ls138', '74hc138', 'decoder', 'demux', 'demultiplexer', '3-to-8', 'dip16'],
    pins: [
      { number: 1, id: 'pin1', name: 'A', type: 'in', kind: 'logic', description: 'Select Address Input A0' },
      { number: 2, id: 'pin2', name: 'B', type: 'in', kind: 'logic', description: 'Select Address Input A1' },
      { number: 3, id: 'pin3', name: 'C', type: 'in', kind: 'logic', description: 'Select Address Input A2 (MSB)' },
      { number: 4, id: 'pin4', name: '/G2A', type: 'in', kind: 'logic', description: 'Enable Input 2A (Active LOW)' },
      { number: 5, id: 'pin5', name: '/G2B', type: 'in', kind: 'logic', description: 'Enable Input 2B (Active LOW)' },
      { number: 6, id: 'pin6', name: 'G1', type: 'in', kind: 'logic', description: 'Enable Input 1 (Active HIGH)' },
      { number: 7, id: 'pin7', name: '/Y7', type: 'out', kind: 'logic', description: 'Output 7 (Active LOW)' },
      { number: 8, id: 'pin8', name: 'GND', type: 'in', kind: 'power', voltage: 0, isGround: true, description: 'Ground Supply (0 V)' },
      { number: 9, id: 'pin9', name: '/Y6', type: 'out', kind: 'logic', description: 'Output 6 (Active LOW)' },
      { number: 10, id: 'pin10', name: '/Y5', type: 'out', kind: 'logic', description: 'Output 5 (Active LOW)' },
      { number: 11, id: 'pin11', name: '/Y4', type: 'out', kind: 'logic', description: 'Output 4 (Active LOW)' },
      { number: 12, id: 'pin12', name: '/Y3', type: 'out', kind: 'logic', description: 'Output 3 (Active LOW)' },
      { number: 13, id: 'pin13', name: '/Y2', type: 'out', kind: 'logic', description: 'Output 2 (Active LOW)' },
      { number: 14, id: 'pin14', name: '/Y1', type: 'out', kind: 'logic', description: 'Output 1 (Active LOW)' },
      { number: 15, id: 'pin15', name: '/Y0', type: 'out', kind: 'logic', description: 'Output 0 (Active LOW)' },
      { number: 16, id: 'pin16', name: 'VCC', type: 'in', kind: 'power', voltage: 5, description: 'Positive Supply Voltage (+5 V)' }
    ],
    simulate(inputs, isPowered = true) {
      const allHighOutputs = { pin15: 1, pin14: 1, pin13: 1, pin12: 1, pin11: 1, pin10: 1, pin9: 1, pin7: 1 };
      if (!isPowered) return allHighOutputs;

      const g1 = inputs.pin6 ?? 1;
      const g2a = inputs.pin4 ?? 0;
      const g2b = inputs.pin5 ?? 0;

      // Enabled when G1=1, /G2A=0, /G2B=0
      const enabled = (g1 === 1 && g2a === 0 && g2b === 0);
      if (!enabled) return allHighOutputs;

      const a = inputs.pin1 ?? 0;
      const b = inputs.pin2 ?? 0;
      const c = inputs.pin3 ?? 0;
      const sel = (c << 2) | (b << 1) | a;

      const out = { ...allHighOutputs };
      const outPinMap = [ 'pin15', 'pin14', 'pin13', 'pin12', 'pin11', 'pin10', 'pin9', 'pin7' ];
      if (sel >= 0 && sel < 8) {
        out[outPinMap[sel]] = 0; // Active low output is 0
      }
      return out;
    }
  },

  // ---------------------------------------------------------------------------
  // 74HC151 / 74151 - 8-to-1 Line Data Selector / Multiplexer (DIP-16)
  // ---------------------------------------------------------------------------
  '74HC151': {
    id: '74HC151',
    name: '74HC151',
    family: '74HC',
    category: 'Multiplexers',
    description: '8-to-1 Line Data Selector / Multiplexer (True and Complementary Outputs)',
    package: 'DIP-16',
    pinCount: 16,
    keywords: ['74151', '74ls151', '74hc151', 'mux', 'multiplexer', '8-to-1', 'selector', 'dip16'],
    pins: [
      { number: 1, id: 'pin1', name: 'D3', type: 'in', kind: 'logic', description: 'Data Input 3' },
      { number: 2, id: 'pin2', name: 'D2', type: 'in', kind: 'logic', description: 'Data Input 2' },
      { number: 3, id: 'pin3', name: 'D1', type: 'in', kind: 'logic', description: 'Data Input 1' },
      { number: 4, id: 'pin4', name: 'D0', type: 'in', kind: 'logic', description: 'Data Input 0' },
      { number: 5, id: 'pin5', name: 'Y', type: 'out', kind: 'logic', description: 'Multiplexer True Output' },
      { number: 6, id: 'pin6', name: '/W', type: 'out', kind: 'logic', description: 'Multiplexer Inverted Output (~Y)' },
      { number: 7, id: 'pin7', name: '/G', type: 'in', kind: 'logic', description: 'Strobe/Enable (Active LOW)' },
      { number: 8, id: 'pin8', name: 'GND', type: 'in', kind: 'power', voltage: 0, isGround: true, description: 'Ground Supply (0 V)' },
      { number: 9, id: 'pin9', name: 'C', type: 'in', kind: 'logic', description: 'Select Input C (MSB)' },
      { number: 10, id: 'pin10', name: 'B', type: 'in', kind: 'logic', description: 'Select Input B' },
      { number: 11, id: 'pin11', name: 'A', type: 'in', kind: 'logic', description: 'Select Input A (LSB)' },
      { number: 12, id: 'pin12', name: 'D7', type: 'in', kind: 'logic', description: 'Data Input 7' },
      { number: 13, id: 'pin13', name: 'D6', type: 'in', kind: 'logic', description: 'Data Input 6' },
      { number: 14, id: 'pin14', name: 'D5', type: 'in', kind: 'logic', description: 'Data Input 5' },
      { number: 15, id: 'pin15', name: 'D4', type: 'in', kind: 'logic', description: 'Data Input 4' },
      { number: 16, id: 'pin16', name: 'VCC', type: 'in', kind: 'power', voltage: 5, description: 'Positive Supply Voltage (+5 V)' }
    ],
    simulate(inputs, isPowered = true) {
      if (!isPowered) return { pin5: 0, pin6: 1 };
      const strobe = inputs.pin7 ?? 0;
      if (strobe === 1) {
        return { pin5: 0, pin6: 1 };
      }
      const a = inputs.pin11 ?? 0;
      const b = inputs.pin10 ?? 0;
      const c = inputs.pin9 ?? 0;
      const sel = (c << 2) | (b << 1) | a;

      const dataMap = [
        inputs.pin4 ?? 0,  // D0
        inputs.pin3 ?? 0,  // D1
        inputs.pin2 ?? 0,  // D2
        inputs.pin1 ?? 0,  // D3
        inputs.pin15 ?? 0, // D4
        inputs.pin14 ?? 0, // D5
        inputs.pin13 ?? 0, // D6
        inputs.pin12 ?? 0  // D7
      ];
      const val = dataMap[sel] ?? 0;
      return {
        pin5: val,
        pin6: val === 1 ? 0 : 1
      };
    }
  },

  // ---------------------------------------------------------------------------
  // 74HC153 / 74153 - Dual 4-to-1 Line Data Selector / Multiplexer (DIP-16)
  // ---------------------------------------------------------------------------
  '74HC153': {
    id: '74HC153',
    name: '74HC153',
    family: '74HC',
    category: 'Multiplexers',
    description: 'Dual 4-to-1 Line Data Selector / Multiplexer',
    package: 'DIP-16',
    pinCount: 16,
    keywords: ['74153', '74ls153', '74hc153', 'dual', 'mux', 'multiplexer', '4-to-1', 'dip16'],
    pins: [
      { number: 1, id: 'pin1', name: '/1G', type: 'in', kind: 'logic', description: 'Mux 1 Strobe (Active LOW)' },
      { number: 2, id: 'pin2', name: 'B', type: 'in', kind: 'logic', description: 'Common Select Input B' },
      { number: 3, id: 'pin3', name: '1C3', type: 'in', kind: 'logic', description: 'Mux 1 Data Input 3' },
      { number: 4, id: 'pin4', name: '1C2', type: 'in', kind: 'logic', description: 'Mux 1 Data Input 2' },
      { number: 5, id: 'pin5', name: '1C1', type: 'in', kind: 'logic', description: 'Mux 1 Data Input 1' },
      { number: 6, id: 'pin6', name: '1C0', type: 'in', kind: 'logic', description: 'Mux 1 Data Input 0' },
      { number: 7, id: 'pin7', name: '1Y', type: 'out', kind: 'logic', description: 'Mux 1 Output' },
      { number: 8, id: 'pin8', name: 'GND', type: 'in', kind: 'power', voltage: 0, isGround: true, description: 'Ground Supply (0 V)' },
      { number: 9, id: 'pin9', name: '2Y', type: 'out', kind: 'logic', description: 'Mux 2 Output' },
      { number: 10, id: 'pin10', name: '2C0', type: 'in', kind: 'logic', description: 'Mux 2 Data Input 0' },
      { number: 11, id: 'pin11', name: '2C1', type: 'in', kind: 'logic', description: 'Mux 2 Data Input 1' },
      { number: 12, id: 'pin12', name: '2C2', type: 'in', kind: 'logic', description: 'Mux 2 Data Input 2' },
      { number: 13, id: 'pin13', name: '2C3', type: 'in', kind: 'logic', description: 'Mux 2 Data Input 3' },
      { number: 14, id: 'pin14', name: 'A', type: 'in', kind: 'logic', description: 'Common Select Input A' },
      { number: 15, id: 'pin15', name: '/2G', type: 'in', kind: 'logic', description: 'Mux 2 Strobe (Active LOW)' },
      { number: 16, id: 'pin16', name: 'VCC', type: 'in', kind: 'power', voltage: 5, description: 'Positive Supply Voltage (+5 V)' }
    ],
    simulate(inputs, isPowered = true) {
      if (!isPowered) return { pin7: 0, pin9: 0 };
      const selA = inputs.pin14 ?? 0;
      const selB = inputs.pin2 ?? 0;
      const sel = (selB << 1) | selA;

      const g1 = inputs.pin1 ?? 0;
      const g2 = inputs.pin15 ?? 0;

      let y1 = 0;
      if (g1 === 0) {
        const d1 = [ inputs.pin6 ?? 0, inputs.pin5 ?? 0, inputs.pin4 ?? 0, inputs.pin3 ?? 0 ];
        y1 = d1[sel] ?? 0;
      }

      let y2 = 0;
      if (g2 === 0) {
        const d2 = [ inputs.pin10 ?? 0, inputs.pin11 ?? 0, inputs.pin12 ?? 0, inputs.pin13 ?? 0 ];
        y2 = d2[sel] ?? 0;
      }

      return { pin7: y1, pin9: y2 };
    }
  },

  // ---------------------------------------------------------------------------
  // 74HC157 / 74157 - Quad 2-to-1 Line Multiplexer (DIP-16)
  // ---------------------------------------------------------------------------
  '74HC157': {
    id: '74HC157',
    name: '74HC157',
    family: '74HC',
    category: 'Multiplexers',
    description: 'Quad 2-to-1 Line Multiplexer (Non-Inverting)',
    package: 'DIP-16',
    pinCount: 16,
    keywords: ['74157', '74ls157', '74hc157', 'quad', 'mux', 'multiplexer', '2-to-1', 'selector', 'dip16'],
    pins: [
      { number: 1, id: 'pin1', name: '/S', type: 'in', kind: 'logic', description: 'Common Select Input (0: A, 1: B)' },
      { number: 2, id: 'pin2', name: '1A', type: 'in', kind: 'logic', description: 'Mux 1 Data Input A' },
      { number: 3, id: 'pin3', name: '1B', type: 'in', kind: 'logic', description: 'Mux 1 Data Input B' },
      { number: 4, id: 'pin4', name: '1Y', type: 'out', kind: 'logic', description: 'Mux 1 Output' },
      { number: 5, id: 'pin5', name: '2A', type: 'in', kind: 'logic', description: 'Mux 2 Data Input A' },
      { number: 6, id: 'pin6', name: '2B', type: 'in', kind: 'logic', description: 'Mux 2 Data Input B' },
      { number: 7, id: 'pin7', name: '2Y', type: 'out', kind: 'logic', description: 'Mux 2 Output' },
      { number: 8, id: 'pin8', name: 'GND', type: 'in', kind: 'power', voltage: 0, isGround: true, description: 'Ground Supply (0 V)' },
      { number: 9, id: 'pin9', name: '3Y', type: 'out', kind: 'logic', description: 'Mux 3 Output' },
      { number: 10, id: 'pin10', name: '3B', type: 'in', kind: 'logic', description: 'Mux 3 Data Input B' },
      { number: 11, id: 'pin11', name: '3A', type: 'in', kind: 'logic', description: 'Mux 3 Data Input A' },
      { number: 12, id: 'pin12', name: '4Y', type: 'out', kind: 'logic', description: 'Mux 4 Output' },
      { number: 13, id: 'pin13', name: '4B', type: 'in', kind: 'logic', description: 'Mux 4 Data Input B' },
      { number: 14, id: 'pin14', name: '4A', type: 'in', kind: 'logic', description: 'Mux 4 Data Input A' },
      { number: 15, id: 'pin15', name: '/G', type: 'in', kind: 'logic', description: 'Common Strobe/Enable (Active LOW)' },
      { number: 16, id: 'pin16', name: 'VCC', type: 'in', kind: 'power', voltage: 5, description: 'Positive Supply Voltage (+5 V)' }
    ],
    simulate(inputs, isPowered = true) {
      if (!isPowered) return { pin4: 0, pin7: 0, pin9: 0, pin12: 0 };
      const strobe = inputs.pin15 ?? 0;
      if (strobe === 1) {
        return { pin4: 0, pin7: 0, pin9: 0, pin12: 0 };
      }
      const select = inputs.pin1 ?? 0;
      return {
        pin4: (select === 0) ? (inputs.pin2 ?? 0) : (inputs.pin3 ?? 0),
        pin7: (select === 0) ? (inputs.pin5 ?? 0) : (inputs.pin6 ?? 0),
        pin9: (select === 0) ? (inputs.pin11 ?? 0) : (inputs.pin10 ?? 0),
        pin12: (select === 0) ? (inputs.pin14 ?? 0) : (inputs.pin13 ?? 0)
      };
    }
  },

  // ---------------------------------------------------------------------------
  // 74HC283 / 74283 - 4-Bit Binary Full Adder with Fast Carry (DIP-16)
  // ---------------------------------------------------------------------------
  '74HC283': {
    id: '74HC283',
    name: '74HC283',
    family: '74HC',
    category: 'Adders',
    description: '4-Bit Binary Full Adder with Fast Lookahead Carry',
    package: 'DIP-16',
    pinCount: 16,
    keywords: ['74283', '74ls283', '74hc283', 'adder', '4-bit', 'arithmetic', 'full adder', 'dip16'],
    pins: [
      { number: 1, id: 'pin1', name: 'Σ2', type: 'out', kind: 'logic', description: 'Sum Bit 2' },
      { number: 2, id: 'pin2', name: 'B2', type: 'in', kind: 'logic', description: 'Operand B Bit 2' },
      { number: 3, id: 'pin3', name: 'A2', type: 'in', kind: 'logic', description: 'Operand A Bit 2' },
      { number: 4, id: 'pin4', name: 'Σ1', type: 'out', kind: 'logic', description: 'Sum Bit 1' },
      { number: 5, id: 'pin5', name: 'A1', type: 'in', kind: 'logic', description: 'Operand A Bit 1' },
      { number: 6, id: 'pin6', name: 'B1', type: 'in', kind: 'logic', description: 'Operand B Bit 1' },
      { number: 7, id: 'pin7', name: 'C0', type: 'in', kind: 'logic', description: 'Carry Input (C_in)' },
      { number: 8, id: 'pin8', name: 'GND', type: 'in', kind: 'power', voltage: 0, isGround: true, description: 'Ground Supply (0 V)' },
      { number: 9, id: 'pin9', name: 'C4', type: 'out', kind: 'logic', description: 'Carry Output (C_out)' },
      { number: 10, id: 'pin10', name: 'Σ4', type: 'out', kind: 'logic', description: 'Sum Bit 4' },
      { number: 11, id: 'pin11', name: 'B4', type: 'in', kind: 'logic', description: 'Operand B Bit 4' },
      { number: 12, id: 'pin12', name: 'A4', type: 'in', kind: 'logic', description: 'Operand A Bit 4' },
      { number: 13, id: 'pin13', name: 'Σ3', type: 'out', kind: 'logic', description: 'Sum Bit 3' },
      { number: 14, id: 'pin14', name: 'A3', type: 'in', kind: 'logic', description: 'Operand A Bit 3' },
      { number: 15, id: 'pin15', name: 'B3', type: 'in', kind: 'logic', description: 'Operand B Bit 3' },
      { number: 16, id: 'pin16', name: 'VCC', type: 'in', kind: 'power', voltage: 5, description: 'Positive Supply Voltage (+5 V)' }
    ],
    simulate(inputs, isPowered = true) {
      if (!isPowered) return { pin4: 0, pin1: 0, pin13: 0, pin10: 0, pin9: 0 };
      const a1 = inputs.pin5 ?? 0, b1 = inputs.pin6 ?? 0;
      const a2 = inputs.pin3 ?? 0, b2 = inputs.pin2 ?? 0;
      const a3 = inputs.pin14 ?? 0, b3 = inputs.pin15 ?? 0;
      const a4 = inputs.pin12 ?? 0, b4 = inputs.pin11 ?? 0;
      const c0 = inputs.pin7 ?? 0;

      const aVal = (a4 << 3) | (a3 << 2) | (a2 << 1) | a1;
      const bVal = (b4 << 3) | (b3 << 2) | (b2 << 1) | b1;
      const sum = aVal + bVal + c0;

      return {
        pin4: (sum >> 0) & 1,
        pin1: (sum >> 1) & 1,
        pin13: (sum >> 2) & 1,
        pin10: (sum >> 3) & 1,
        pin9: (sum >> 4) & 1
      };
    }
  },

  // ---------------------------------------------------------------------------
  // CD4011 - CMOS Quad 2-Input NAND Gates (DIP-14)
  // ---------------------------------------------------------------------------
  'CD4011': {
    id: 'CD4011',
    name: 'CD4011',
    family: 'CD4000',
    category: 'Logic Gates',
    description: 'CMOS Quad 2-Input NAND Gates',
    package: 'DIP-14',
    pinCount: 14,
    keywords: ['cd4011', '4011', 'cmos', 'nand', 'quad', 'gate', 'dip14'],
    pins: [
      { number: 1, id: 'pin1', name: '1A', type: 'in', kind: 'logic', description: 'Gate 1 Input A' },
      { number: 2, id: 'pin2', name: '1B', type: 'in', kind: 'logic', description: 'Gate 1 Input B' },
      { number: 3, id: 'pin3', name: '1Y', type: 'out', kind: 'logic', description: 'Gate 1 Output' },
      { number: 4, id: 'pin4', name: '2Y', type: 'out', kind: 'logic', description: 'Gate 2 Output' },
      { number: 5, id: 'pin5', name: '2A', type: 'in', kind: 'logic', description: 'Gate 2 Input A' },
      { number: 6, id: 'pin6', name: '2B', type: 'in', kind: 'logic', description: 'Gate 2 Input B' },
      { number: 7, id: 'pin7', name: 'VSS', type: 'in', kind: 'power', voltage: 0, isGround: true, description: 'Ground / VSS' },
      { number: 8, id: 'pin8', name: '3A', type: 'in', kind: 'logic', description: 'Gate 3 Input A' },
      { number: 9, id: 'pin9', name: '3B', type: 'in', kind: 'logic', description: 'Gate 3 Input B' },
      { number: 10, id: 'pin10', name: '3Y', type: 'out', kind: 'logic', description: 'Gate 3 Output' },
      { number: 11, id: 'pin11', name: '4Y', type: 'out', kind: 'logic', description: 'Gate 4 Output' },
      { number: 12, id: 'pin12', name: '4A', type: 'in', kind: 'logic', description: 'Gate 4 Input A' },
      { number: 13, id: 'pin13', name: '4B', type: 'in', kind: 'logic', description: 'Gate 4 Input B' },
      { number: 14, id: 'pin14', name: 'VDD', type: 'in', kind: 'power', voltage: 5, description: 'Positive Supply / VDD (+5 V)' }
    ],
    simulate(inputs, isPowered = true) {
      if (!isPowered) return { pin3: 0, pin4: 0, pin10: 0, pin11: 0 };
      const a1 = inputs.pin1 ?? 0, b1 = inputs.pin2 ?? 0;
      const a2 = inputs.pin5 ?? 0, b2 = inputs.pin6 ?? 0;
      const a3 = inputs.pin8 ?? 0, b3 = inputs.pin9 ?? 0;
      const a4 = inputs.pin12 ?? 0, b4 = inputs.pin13 ?? 0;
      return {
        pin3: (a1 === 1 && b1 === 1) ? 0 : 1,
        pin4: (a2 === 1 && b2 === 1) ? 0 : 1,
        pin10: (a3 === 1 && b3 === 1) ? 0 : 1,
        pin11: (a4 === 1 && b4 === 1) ? 0 : 1
      };
    }
  },

  // ---------------------------------------------------------------------------
  // CD4001 - CMOS Quad 2-Input NOR Gates (DIP-14)
  // ---------------------------------------------------------------------------
  'CD4001': {
    id: 'CD4001',
    name: 'CD4001',
    family: 'CD4000',
    category: 'Logic Gates',
    description: 'CMOS Quad 2-Input NOR Gates',
    package: 'DIP-14',
    pinCount: 14,
    keywords: ['cd4001', '4001', 'cmos', 'nor', 'quad', 'gate', 'dip14'],
    pins: [
      { number: 1, id: 'pin1', name: '1A', type: 'in', kind: 'logic', description: 'Gate 1 Input A' },
      { number: 2, id: 'pin2', name: '1B', type: 'in', kind: 'logic', description: 'Gate 1 Input B' },
      { number: 3, id: 'pin3', name: '1Y', type: 'out', kind: 'logic', description: 'Gate 1 Output' },
      { number: 4, id: 'pin4', name: '2Y', type: 'out', kind: 'logic', description: 'Gate 2 Output' },
      { number: 5, id: 'pin5', name: '2A', type: 'in', kind: 'logic', description: 'Gate 2 Input A' },
      { number: 6, id: 'pin6', name: '2B', type: 'in', kind: 'logic', description: 'Gate 2 Input B' },
      { number: 7, id: 'pin7', name: 'VSS', type: 'in', kind: 'power', voltage: 0, isGround: true, description: 'Ground / VSS' },
      { number: 8, id: 'pin8', name: '3A', type: 'in', kind: 'logic', description: 'Gate 3 Input A' },
      { number: 9, id: 'pin9', name: '3B', type: 'in', kind: 'logic', description: 'Gate 3 Input B' },
      { number: 10, id: 'pin10', name: '3Y', type: 'out', kind: 'logic', description: 'Gate 3 Output' },
      { number: 11, id: 'pin11', name: '4Y', type: 'out', kind: 'logic', description: 'Gate 4 Output' },
      { number: 12, id: 'pin12', name: '4A', type: 'in', kind: 'logic', description: 'Gate 4 Input A' },
      { number: 13, id: 'pin13', name: '4B', type: 'in', kind: 'logic', description: 'Gate 4 Input B' },
      { number: 14, id: 'pin14', name: 'VDD', type: 'in', kind: 'power', voltage: 5, description: 'Positive Supply / VDD (+5 V)' }
    ],
    simulate(inputs, isPowered = true) {
      if (!isPowered) return { pin3: 0, pin4: 0, pin10: 0, pin11: 0 };
      const a1 = inputs.pin1 ?? 0, b1 = inputs.pin2 ?? 0;
      const a2 = inputs.pin5 ?? 0, b2 = inputs.pin6 ?? 0;
      const a3 = inputs.pin8 ?? 0, b3 = inputs.pin9 ?? 0;
      const a4 = inputs.pin12 ?? 0, b4 = inputs.pin13 ?? 0;
      return {
        pin3: (a1 === 1 || b1 === 1) ? 0 : 1,
        pin4: (a2 === 1 || b2 === 1) ? 0 : 1,
        pin10: (a3 === 1 || b3 === 1) ? 0 : 1,
        pin11: (a4 === 1 || b4 === 1) ? 0 : 1
      };
    }
  }
};

// -----------------------------------------------------------------------------
// Library Access & Search APIs
// -----------------------------------------------------------------------------

export function getAllICDefinitions() {
  return Object.values(IC_LIBRARY);
}

export function getICDefinition(definitionId) {
  if (!definitionId) return null;
  return IC_LIBRARY[definitionId] || null;
}

export function getICCategories() {
  const set = new Set();
  Object.values(IC_LIBRARY).forEach(ic => {
    if (ic.category) set.add(ic.category);
    if (ic.family) set.add(ic.family);
  });
  return [
    'All',
    '74HC',
    'CD4000',
    'Logic Gates',
    'Buffers / Inverters',
    'Multiplexers',
    'Decoders',
    'Adders'
  ];
}

export function searchICs(query = '', category = 'All') {
  const q = String(query || '').trim().toLowerCase();
  const cat = String(category || 'All').trim().toLowerCase();

  return Object.values(IC_LIBRARY).filter(ic => {
    if (cat !== 'all') {
      const matchCat = ic.category?.toLowerCase() === cat;
      const matchFam = ic.family?.toLowerCase() === cat;
      if (!matchCat && !matchFam) return false;
    }

    if (!q) return true;

    const searchableFields = [
      ic.id,
      ic.name,
      ic.family,
      ic.category,
      ic.description,
      ic.package,
      ...(ic.keywords || [])
    ].filter(Boolean);

    return searchableFields.some(field => String(field).toLowerCase().includes(q));
  });
}
