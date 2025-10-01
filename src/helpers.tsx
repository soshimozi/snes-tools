import { TILE_H, TILE_W } from "./app/constants";
import { Palette, Tile } from "./types/editorTypes";

// Reverse: given index → (row, col)
// Forward (for reference)
// pairBase = (row >> 1) * (cols * 2)
// colSkew  = (col << 1) - (col & 1)   // 0,1,4,5,8,9,12,13,...
// rowOff   = (row & 1) * 2            // +0 top, +2 bottom
// index    = pairBase + colSkew + rowOff
export const indexToRowCol = (index: number, cols = 16) => {
  const band = Math.floor(index / (cols * 2)); // which 2-row band
  const offset = index % (cols * 2);           // position within band [0..(2*cols-1)]

  // Bit 1 of offset (value 2) tells top/bottom within the band:
  // 0 => top row, 1 => bottom row
  const rowInBand = (offset & 2) >> 1;

  // Remove the +0/+2 row offset to get the skewed column code
  const base = offset - (rowInBand << 1);      // 0,1,4,5,8,9,12,13,...

  // Undo the skew: 0->0, 1->1, 4->2, 5->3, 8->4, 9->5, ...
  const col = base - (base >> 1);

  const row = band * 2 + rowInBand;
  return { row, col };
};

// index pattern per pair of rows:
// top row:  0, 1, 4, 5, 8, 9, 12, 13, ...
// bottom:   2, 3, 6, 7, 10,11,14, 15, ...
export const tileIndex = (row: number, col: number, cols = 16) => {
  const pairBase = (row >> 1) * (cols * 2);       // start of this 2-row band
  const colSkew = col + (col & ~1);               // 0,1,4,5,8,9,...
  const rowOffset = (row & 1) * 2;                // +0 for top, +2 for bottom
  return pairBase + colSkew + rowOffset;
  // Equivalent colSkew form: (col << 1) - (col & 1)
};

export function makeBlankTile(): Tile {
  return Array.from({ length: TILE_H }, () => Array(TILE_W).fill(0));
}

export function makeTiles(): Tile[] {
  return Array.from({ length: 256}, () => Array.from({ length: TILE_H }, () => Array(TILE_W).fill(0)))
}


export function encodeSNES4bppTile(tile: Tile): Uint8Array {
  const out = new Uint8Array(32);
  for (let y = 0; y < TILE_H; y++) {
    let p0 = 0, p1 = 0;
    for (let x = 0; x < TILE_W; x++) {
      const idx = tile[y][x] & 0xF;
      const bit = 7 - x;
      p0 |= (idx & 1) << bit;
      p1 |= ((idx >> 1) & 1) << bit;
    }
    out[y * 2 + 0] = p0;
    out[y * 2 + 1] = p1;
  }
  for (let y = 0; y < TILE_H; y++) {
    let p2 = 0, p3 = 0;
    for (let x = 0; x < TILE_W; x++) {
      const idx = tile[y][x] & 0xF;
      const bit = 7 - x;
      p2 |= ((idx >> 2) & 1) << bit;
      p3 |= ((idx >> 3) & 1) << bit;
    }
    const base = 16 + y * 2;
    out[base + 0] = p2;
    out[base + 1] = p3;
  }
  return out;
}

export function decodeSNES4bppTile(data: Uint8Array): Tile {
  if (data.length < 32) throw new Error("SNES tile must be 32 bytes");
  const tile = makeBlankTile();
  for (let y = 0; y < TILE_H; y++) {
    const p0 = data[y * 2 + 0];
    const p1 = data[y * 2 + 1];
    const p2 = data[16 + y * 2 + 0];
    const p3 = data[16 + y * 2 + 1];
    for (let x = 0; x < TILE_W; x++) {
      const bit = 7 - x;
      const idx = ((p0 >> bit) & 1) | (((p1 >> bit) & 1) << 1) | (((p2 >> bit) & 1) << 2) | (((p3 >> bit) & 1) << 3);
      tile[y][x] = idx;
    }
  }
  return tile;
}


export function toArrayBuffer(u8: Uint8Array): ArrayBuffer {
  // Guarantee a real ArrayBuffer (not SharedArrayBuffer) for Blob parts.
  const bufLike = u8.buffer; // ArrayBuffer | SharedArrayBuffer
  if (bufLike instanceof ArrayBuffer) {
    return bufLike.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
  }
  const ab = new ArrayBuffer(u8.byteLength);
  new Uint8Array(ab).set(u8);
  return ab;
}


export function download(filename: string, bytes: Uint8Array | Blob) {
  const blob = bytes instanceof Blob ? bytes : new Blob([toArrayBuffer(bytes)], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Convert #RRGGBB → SNES BGR15 little-endian Uint8Array (length 32)
export function exportCGRAMBGR15(palette: Palette): Uint8Array {
  const out = new Uint8Array(16 * 2);
  for (let i = 0; i < 16; i++) {
    const hex = palette[i] ?? "#000000";
    const m = /^#?([0-9a-fA-F]{6})$/.exec(hex);
    const rgb = m ? parseInt(m[1], 16) : 0;
    const r8 = (rgb >> 16) & 0xFF;
    const g8 = (rgb >> 8) & 0xFF;
    const b8 = rgb & 0xFF;
    const r5 = Math.round((r8 / 255) * 31) & 31;
    const g5 = Math.round((g8 / 255) * 31) & 31;
    const b5 = Math.round((b8 / 255) * 31) & 31;
    const bgr15 = (r5 << 10) | (g5 << 5) | b5; // SNES stores as BGR15, but bit packing is R in high bits
    out[i * 2 + 0] = bgr15 & 0xFF; // little endian
    out[i * 2 + 1] = (bgr15 >> 8) & 0xFF;
  }
  return out;
}

// Render helpers for PNG export
export function renderTileToCanvas(tile: Tile, palette: Palette, scale = 8): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = TILE_W * scale;
  c.height = TILE_H * scale;
  const ctx = c.getContext("2d")!;
  for (let y = 0; y < TILE_H; y++) {
    for (let x = 0; x < TILE_W; x++) {
      ctx.fillStyle = palette[tile[y][x]] ?? "#000";
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }
  return c;
}

export function renderTilesheetToCanvas(tiles: Tile[], palette: Palette, tilesPerRow = 8, scale = 8): HTMLCanvasElement {
  const rows = Math.ceil(tiles.length / tilesPerRow);
  const c = document.createElement("canvas");
  c.width = tilesPerRow * TILE_W * scale;
  c.height = rows * TILE_H * scale;
  const ctx = c.getContext("2d")!;
  tiles.forEach((t, i) => {
    const col = i % tilesPerRow;
    const row = Math.floor(i / tilesPerRow);
    for (let y = 0; y < TILE_H; y++) {
      for (let x = 0; x < TILE_W; x++) {
        ctx.fillStyle = palette[t[y][x]] ?? "#000";
        ctx.fillRect((col * TILE_W + x) * scale, (row * TILE_H + y) * scale, scale, scale);
      }
    }
  });
  return c;
}

export function moveItem<T>(arr: T[], from: number, to: number): T[] {
  const newArr = [...arr];
  const [moved] = newArr.splice(from, 1); // remove item
  newArr.splice(to, 0, moved);            // insert at new position
  return newArr;
}