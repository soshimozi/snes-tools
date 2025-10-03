import { TILE_H, TILE_W } from "./app/constants";
import { Cell, Palette, Region, Tile, TileRegionPayload } from "./types/EditorTypes";

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

// export function makeBlankTile(): Tile {
//   return Array.from({ length: TILE_H }, () => Array(TILE_W).fill(0));
// }

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

export function parseHexColor(hex: string) : { r: number, g: number, b: number} | undefined {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return undefined;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

export function toHexColor(r: number, g: number, b: number) {
  const h = ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);
  return `#${h.toString(16).padStart(6, "0")}`.toUpperCase();
}

// Types you already have:
// type Tile = number[][];        // 8x8 (or similar) palette indexes
// type Region = { col: number; row: number; cols: number; rows: number; };
// type Cell = { col: number; row: number };

/** Build a fast inverse map for your (row,col)->index using your indexToRowCol */
function buildRowColToIndex(
  totalTiles: number,
  indexToRowCol: (i: number) => { row: number; col: number }
) {
  const map = new Map<string, number>();
  for (let i = 0; i < totalTiles; i++) {
    const { row, col } = indexToRowCol(i);
    map.set(`${row},${col}`, i);
  }
  return (row: number, col: number) => {
    const idx = map.get(`${row},${col}`);
    if (idx === undefined) throw new Error(`No tile at row=${row}, col=${col}`);
    return idx;
  };
}

const deepCopyTile = (t: Tile): Tile => t.map(r => r.slice());

/**
 * Extracts a rectangular region of tiles (tile-aligned) into a flat array,
 * row-major (top->bottom, left->right). Clamps to the sheet bounds.
 *
 * @param tiles       Full tilesheet (length = gridCols * gridRows)
 * @param region      Region in tile units
 * @param gridCols    Tile columns in the sheet (default 16)
 * @param gridRows    Tile rows in the sheet (default 16)
 */
export function extractRegionTiles(
  tiles: Tile[],
  region: Region,
  gridCols = 16,
  gridRows = 16
): TileRegionPayload {
  // Inverse mapping using your project’s indexToRowCol
  const rowColToIndex = buildRowColToIndex(tiles.length, indexToRowCol);

  // Clamp region to sheet bounds
  const startCol = Math.max(0, Math.min(gridCols - 1, region.col));
  const startRow = Math.max(0, Math.min(gridRows - 1, region.row));
  const endCol = Math.max(0, Math.min(gridCols - 1, region.col + region.cols - 1));
  const endRow = Math.max(0, Math.min(gridRows - 1, region.row + region.rows - 1));

  const outCols = endCol - startCol + 1;
  const outRows = endRow - startRow + 1;

  const out: Tile[] = [];
  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      const idx = rowColToIndex(r, c);
      const tileCopy = deepCopyTile(tiles[idx]);
      out.push(tileCopy);
    }
  }

  return { tiles: out, cols: outCols, rows: outRows };
}

/** (Optional) convenience for single-tile copy to reuse the same clipboard shape */
export function extractSingleTile(tiles: Tile[], cell: Cell): TileRegionPayload {
  if (!cell) throw new Error("Cell is null");

  const rowColToIndex = buildRowColToIndex(tiles.length, indexToRowCol);
  const idx = rowColToIndex(cell.row, cell.col);
  return { tiles: [deepCopyTile(tiles[idx])], cols: 1, rows: 1 };
}


export function extractRegionFromTilesheet(
  tilesheetTiles: Tile[],             // e.g. prev[currentTilesheet].tiles
  region: Region,
  indexToRowCol: (i: number) => { row: number; col: number },
  gridCols = 16,
  gridRows = 16
): TileRegionPayload {
  const rowColToIndex = buildRowColToIndex(tilesheetTiles.length, indexToRowCol);

  // Clamp region to sheet bounds
  const startCol = Math.max(0, Math.min(gridCols - 1, region.col));
  const startRow = Math.max(0, Math.min(gridRows - 1, region.row));
  const endCol   = Math.max(0, Math.min(gridCols - 1, region.col + region.cols - 1));
  const endRow   = Math.max(0, Math.min(gridRows - 1, region.row + region.rows - 1));

  const outCols = endCol - startCol + 1;
  const outRows = endRow - startRow + 1;

  const out: Tile[] = [];
  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      const idx = rowColToIndex(r, c);
      if (idx < 0) continue;
      out.push(deepCopyTile(tilesheetTiles[idx]));
    }
  }

  return { tiles: out, cols: outCols, rows: outRows };
}

export function producePasteIntoTilesheet(
  prevTilesheets: Array<{ tiles: Tile[]; [k: string]: any }>,
  tilesheetIndex: number,
  payload: TileRegionPayload,
  at: Cell,  // destination top-left (tile coords)
  indexToRowCol: (i: number) => { row: number; col: number },
  gridCols = 16,
  gridRows = 16
) {
  return prevTilesheets.map((sheet, i) => {
    if(!at) throw new Error("at is null");

    if (i !== tilesheetIndex) return sheet;

    const rowColToIndex = buildRowColToIndex(sheet.tiles.length, indexToRowCol);
    const nextTiles = sheet.tiles.map(deepCopyTile);

    for (let r = 0; r < payload.rows; r++) {
      for (let c = 0; c < payload.cols; c++) {
        const destRow = at.row + r;
        const destCol = at.col + c;
        if (destRow < 0 || destCol < 0 || destRow >= gridRows || destCol >= gridCols) continue;

        const destIdx = rowColToIndex(destRow, destCol);
        if (destIdx < 0) continue;

        const srcIdx = r * payload.cols + c;
        nextTiles[destIdx] = deepCopyTile(payload.tiles[srcIdx]);
      }
    }

    return { ...sheet, tiles: nextTiles };
  });
}

/** Optional: single-tile version to keep clipboard shape consistent */
export function extractSingleTileFromTilesheet(
  tilesheetTiles: Tile[],
  cell: Cell,
  indexToRowCol: (i: number) => { row: number; col: number }
): TileRegionPayload {
  if(!cell) throw new Error("Cell is null");

  const rowColToIndex = buildRowColToIndex(tilesheetTiles.length, indexToRowCol);
  const idx = rowColToIndex(cell.row, cell.col);
  if (idx < 0) throw new Error("Cell out of range");
  return { tiles: [deepCopyTile(tilesheetTiles[idx])], cols: 1, rows: 1 };
}

export const makeBlankTile = (w = 8, h = 8): Tile => Array.from({ length: h }, () => Array(w).fill(0));

export function produceDeleteRegionInTilesheet(
  prevTilesheets: Array<{ tiles: Tile[]; [k: string]: any }>,
  tilesheetIndex: number,
  region: Region,
  indexToRowCol: (i: number) => { row: number; col: number },
  gridCols = 16,
  gridRows = 16,
  tileW = 8,
  tileH = 8
) {
  return prevTilesheets.map((sheet, i) => {
    if (i !== tilesheetIndex) return sheet;

    const rowColToIndex = buildRowColToIndex(sheet.tiles.length, indexToRowCol);
    const nextTiles = sheet.tiles.map(deepCopyTile);

    const startCol = Math.max(0, Math.min(gridCols - 1, region.col));
    const startRow = Math.max(0, Math.min(gridRows - 1, region.row));
    const endCol   = Math.max(0, Math.min(gridCols - 1, region.col + region.cols - 1));
    const endRow   = Math.max(0, Math.min(gridRows - 1, region.row + region.rows - 1));

    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const idx = rowColToIndex(r, c);
        if (idx < 0) continue;
        nextTiles[idx] = makeBlankTile(tileW, tileH);
      }
    }

    return { ...sheet, tiles: nextTiles };
  });
}

// ---- helpers ----
const to5 = (v8: number) => Math.min(31, Math.max(0, Math.round((v8 / 255) * 31)));

/** Pack #RRGGBB -> BGR555 (0b0BBBBBGGGGGRRRRR). Bit 15 is always 0. */
function packBGR555(r8: number, g8: number, b8: number): number {
  const r5 = to5(r8);
  const g5 = to5(g8);
  const b5 = to5(b8);
  return ((b5 << 10) | (g5 << 5) | r5) & 0x7fff; // ensure bit 15 cleared
}

/**
 * Convert Palette[] (8 x 16 colors) to a Blob of 16-bit BGR555 words.
 * Layout: P0 C0..C15, P1 C0..C15, ... P7 C0..C15
 */
export function palettesToBGR555Blob(
  palettes: Palette[],
  {
    palettesExpected = 8,
    entriesPerPalette = 16,
    littleEndian = true,
    padWith = "#000000", // if a palette/entry is missing, pad with this
  }: {
    palettesExpected?: number;
    entriesPerPalette?: number;
    littleEndian?: boolean;
    padWith?: string;
  } = {}
): {
  blob: Blob;
  failures: Array<{ palette: number; index: number; value: string }>;
} {
  const total = palettesExpected * entriesPerPalette;
  const buf = new ArrayBuffer(total * 2);
  const view = new DataView(buf);
  const failures: Array<{ palette: number; index: number; value: string }> = [];

  for (let p = 0; p < palettesExpected; p++) {
    const pal = palettes[p] ?? [];
    for (let i = 0; i < entriesPerPalette; i++) {
      const colorStr = pal[i] ?? padWith;
      const parsed = parseHexColor(colorStr);
      if (!parsed) failures.push({ palette: p, index: i, value: colorStr });
      const word = parsed ? packBGR555(parsed.r, parsed.g, parsed.b) : 0x0000;

      const flatIndex = p * entriesPerPalette + i;
      view.setUint16(flatIndex * 2, word, littleEndian);
    }
  }

  return { blob: new Blob([buf], { type: "application/octet-stream" }), failures };
}

export function savePalettes(filename: string, palettes: Palette[], littleEndian: boolean): boolean {

  const { blob, failures } = palettesToBGR555Blob(palettes, {littleEndian});

  // Optional: report bad inputs
  if (failures.length) {
    return false;
    console.warn("Unparseable color indexes:", failures);
  }

  // Example save (browser):
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename; //"palette_bgr555.pal";
  a.click();
  URL.revokeObjectURL(url);
  
  return true;

}