"use client"

import React, { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import TileView, {TILE_H, TILE_W } from "./tileView";
import { DraggableWindow } from "./draggableWindow";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowDown, faArrowLeft, faArrowRight, faArrowUp, faEraser, faEyeDropper, faFillDrip, faPaintBrush, faRotateBackward, faRotateForward, IconDefinition } from "@fortawesome/free-solid-svg-icons";
import { HistoryEntry, MetaSpriteEntry, Palette, Tile, Tool } from "@/types/editorTypes";
import { v4 as uuid } from "uuid";
import { MultiSelect } from "./MultiSelect";
import { SingleSelectList } from "./singleSelectList";

// Types
// export type Palette = string[]; // 16 hex colors: "#RRGGBB"

function makeBlankTile(): Tile {
  return Array.from({ length: TILE_H }, () => Array(TILE_W).fill(0));
}

function makeTiles(): Tile[] {
  return Array.from({ length: 256}, () => Array.from({ length: TILE_H }, () => Array(TILE_W).fill(0)))
}

function defaultPalette(): Palette {
  return [
    "#000000", // 0
    "#404040", // 1
    "#808080", // 2
    "#C0C0C0", // 3
    "#FF0000", // 4
    "#FFA500", // 5
    "#FFFF00", // 6
    "#00FF00", // 7
    "#00FFFF", // 8
    "#0000FF", // 9
    "#7A00FF", // 10
    "#FF00FF", // 11
    "#964B00", // 12
    "#FFFFFF", // 13
    "#1E90FF", // 14
    "#FF69B4", // 15
  ];
}


// ------------------ Encoding / Decoding ------------------
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

function toArrayBuffer(u8: Uint8Array): ArrayBuffer {
  // Guarantee a real ArrayBuffer (not SharedArrayBuffer) for Blob parts.
  const bufLike = u8.buffer; // ArrayBuffer | SharedArrayBuffer
  if (bufLike instanceof ArrayBuffer) {
    return bufLike.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
  }
  const ab = new ArrayBuffer(u8.byteLength);
  new Uint8Array(ab).set(u8);
  return ab;
}


function download(filename: string, bytes: Uint8Array | Blob) {
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
function exportCGRAMBGR15(palette: Palette): Uint8Array {
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
function renderTileToCanvas(tile: Tile, palette: Palette, scale = 8): HTMLCanvasElement {
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

function renderTilesheetToCanvas(tiles: Tile[], palette: Palette, tilesPerRow = 8, scale = 8): HTMLCanvasElement {
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

// ------------------ Editor ------------------

// type Tool = {
//   type: "brush" | "fill" | "picker" | "eraser";
//   icon: IconDefinition
// }

// type HistoryEntry = {
//   tiles: Tile[];
// };


type Cell = { row: number; col: number } | null;

function MetaSpriteView(
  {
    entries,
    onClick,
    palettes,
    tiles
  } : 
  {
    entries: MetaSpriteEntry[],
    onClick: (selected:number) => void,
    palettes: string[][], 
    tiles: Tile[],
  }
) {

  const logicalTile = 8;     // your underlying tile size
  const scale = 3;           // scale factor (so each cell = 16px)
  const cols = 16;
  const rows = 16;
  const cellSize = logicalTile * scale; // 16
  const cssWidth = cols * cellSize;     // 256
  const cssHeight = rows * cellSize;    // 256

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const drawMeta = useCallback(() => {
    const scale = 3; // preview scale per pixel
    const c = canvasRef.current;
    if (!c) return;
    c.width = 8 * cols * scale + 4;
    c.height = 8 * rows * scale + 4;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = palettes[0][0];
    ctx.fillRect(0, 0, c.width, c.height);

    ctx.fillStyle = palettes[0][0];
    ctx.fillRect(0, 0, scale * 8 * 16 + 2, scale * 8 * 16 + 2);

    // Pure render: draw tiles as-is in A/B/C/D positions, no flips or offsets
    entries.forEach((e, i) => {

      const dx = e.x * 8 * scale;
      const dy = e.y * 8 * scale;
      const tile = tiles[e.tileIndex]

      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
          const pix = tile[y][x];
          const wx = dx + (x * scale);
          const wy = dy + (y * scale);
          ctx.fillStyle = palettes[e.paletteIndex][pix] ?? "#000";
          ctx.fillRect(wx, wy, scale, scale);
        }
      }
    })

    ctx.lineWidth = 1;
    ctx.strokeStyle = "#555";

    // render grid
    ctx.setLineDash([7, 5]);
    const endx = scale * 8 * 16;
    const endy = scale * 8 * 16
    for(var x = 1; x <= 8; x++) {
      ctx.beginPath();
      ctx.moveTo(scale * 16 * x + .5, 0);
      ctx.lineTo(scale * 16 * x + .5, endy);
      ctx.stroke();
    }
    for(var y = 1; y <= 8; y++) {
      ctx.beginPath();
      ctx.moveTo(0, scale * 16 * y + .5);
      ctx.lineTo(endx, scale * 16 * y + .5);
      ctx.stroke();
    }

    // render center lines
    ctx.strokeStyle = "#fff";
    ctx.beginPath();
    ctx.moveTo(scale * 16 * 4 + .5, 0)
    ctx.lineTo(scale * 16 * 4 + .5, endy);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, scale * 16 * 4 + .5);
    ctx.lineTo(endx, scale * 16 * 4 + .5);
    ctx.stroke();

    ctx.setLineDash([]);

  }, [entries, palettes, tiles]);

  useEffect(() => { drawMeta(); }, [drawMeta]);    

  const handlePointerDown: React.PointerEventHandler<HTMLCanvasElement> = (e) => {
    const c = canvasRef.current;
    if (!c) return;

    const rect = c.getBoundingClientRect(); // CSS pixels
    const xCss = e.clientX - rect.left;
    const yCss = e.clientY - rect.top;
    
    const col = Math.floor(xCss / cellSize);
    const row = Math.floor(yCss / cellSize);

    if (col >= 0 && col < cols && row >= 0 && row < rows) {
      onClick(row * rows + col);
    }
  };  
  return (
    <canvas
      ref={canvasRef}
      onPointerDown={handlePointerDown}
      style={{ border: "1px solid #ccc", imageRendering: "pixelated", cursor: "pointer", borderRadius: "4px" }}
    />
  );
}

function TileGrid(
  { 
    palette = ["#dddddd"], 
    drawGridLines = false, 
    tiles,
    onSelected, 
    selected 
  }: 
  { 
    onSelected: (selected:Cell) => void, 
    selected: Cell | null, 
    tiles: Tile[],
    palette?: string[], 
    drawGridLines?: boolean
  }) {

  const tilesheetCanvasRef = useRef<HTMLCanvasElement | null>(null);
  // const [selected, setSelected] = useState<Cell>(null);

  // ----- grid config -----
  const logicalTile = 8;     // your underlying tile size
  const scale = 3;           // scale factor (so each cell = 16px)
  const cols = 16;
  const rows = 16;
  const cellSize = logicalTile * scale; // 16
  const cssWidth = cols * cellSize;     // 256
  const cssHeight = rows * cellSize;    // 256

  const drawTiles = useCallback(() => {
    const c = tilesheetCanvasRef.current;
    if (!c) return;

    const dpr = window.devicePixelRatio || 1;
    // Backing store size (actual pixels) vs CSS size (layout pixels)
    c.width = Math.round(cssWidth * dpr);
    c.height = Math.round(cssHeight * dpr);
    c.style.width = `${cssWidth}px`;
    c.style.height = `${cssHeight}px`;

    const ctx = c.getContext("2d");
    if (!ctx) return;

    // Normalize drawing to CSS pixel units
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Background
    ctx.clearRect(0, 0, cssWidth, cssHeight);
    ctx.fillStyle = palette[0] ?? "#ffffff";
    ctx.fillRect(0, 0, cssWidth, cssHeight);

    if(drawGridLines) {
      // Optional: draw grid lines
      ctx.beginPath();
      for (let x = 0; x <= cols; x++) {
        const xx = x * cellSize;
        ctx.moveTo(xx + 0.5, 0);
        ctx.lineTo(xx + 0.5, cssHeight);
      }
      for (let y = 0; y <= rows; y++) {
        const yy = y * cellSize;
        ctx.moveTo(0, yy + 0.5);
        ctx.lineTo(cssWidth, yy + 0.5);
      }
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1;
      ctx.stroke();
    }


    tiles.forEach((tile, index) => {

      const {row, col} = indexToRowCol(index);

      console.log(`row: ${row}, col: ${col}, index: ${index}`);

      const dx = col * 8 * scale;
      const dy = row * 8 * scale;

        for (let y = 0; y < 8; y++) {
          for (let x = 0; x < 8; x++) {
            const pix = tile[y][x];
            const wx = dx + (x * scale);
            const wy = dy + (y * scale);
            ctx.fillStyle = palette[pix] ?? "#000";
            ctx.fillRect(wx, wy, scale, scale);
          }
        }
    })

    // Highlight selected cell
    if (selected) {
      const { col, row } = selected;
      const x = col * cellSize;
      const y = row * cellSize;

      // Border highlight
      ctx.lineWidth = .5;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
      ctx.strokeRect(x + 1, y + 1, cellSize - 2, cellSize - 2);
    }
  }, [palette, selected, cssWidth, cssHeight, cellSize, cols, rows, drawGridLines, tiles]);

  useEffect(() => {
    drawTiles();
  }, [drawTiles]);

  const handlePointerDown: React.PointerEventHandler<HTMLCanvasElement> = (e) => {
    const c = tilesheetCanvasRef.current;
    if (!c) return;

    const rect = c.getBoundingClientRect(); // CSS pixels
    const xCss = e.clientX - rect.left;
    const yCss = e.clientY - rect.top;

    const col = Math.floor(xCss / cellSize);
    const row = Math.floor(yCss / cellSize);

    if (col >= 0 && col < cols && row >= 0 && row < rows) {
      onSelected({row, col});
    }
  };

  return (
    <canvas
      ref={tilesheetCanvasRef}
      onPointerDown={handlePointerDown}
      style={{ imageRendering: "pixelated", cursor: "pointer", borderRadius: "3px" }}
    />
  );
}

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


function keyOf(e: MetaSpriteEntry) {
  // If you *don't* have e.id, use a composite:
  // return `${e.tileIndex}|${e.paletteIndex}|${e.x}|${e.y}`;
  return e.id;
}

export default function SNESpriteEditor() {
  // Core state
  const [palette, setPalette] = useState<Palette>(() => defaultPalette());
  const [tiles, setTiles] = useState<Tile[]>(makeTiles());
  const [currentTile, setCurrentTile] = useState(0);
  const [currentColor, setCurrentColor] = useState(1);
  const [zoom, setZoom] = useState(32); // pixel size in px
  const [tool, setTool] = useState<Tool>({type: "brush", icon: faFillDrip});
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [tilesPerRow, setTilesPerRow] = useState(8);
  const [showPaletteWindow, setShowPaletteWindow] = useState(false);
  const [selectedTileCell, setSelectedTileCell] = useState<Cell | null>(null);
  const [showSpriteEditor, setShowSpriteEditor] = useState(false);

  const [metaSpriteEntries, setMetaSpriteEntries] = useState<MetaSpriteEntry[]>([]);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Build multi-line options for the list (memoized).
  const options = useMemo(
    () =>
      metaSpriteEntries.map((entry) => ({
        value: keyOf(entry),
        lines: [
          `Tile index: ${entry.tileIndex}, Palette: ${entry.paletteIndex}, x: ${entry.x}, y: ${entry.y}`,
        ],
      })),
    [metaSpriteEntries]
  );

  // Prune selection if it no longer exists after an update
  useEffect(() => {
    if (!selectedId) return;
    const exists = options.some((o) => o.value === selectedId);
    if (!exists) setSelectedId(null);
  }, [options, selectedId]);

  // (Optional) get the selected entry
  const selectedEntry = useMemo(() => {
    const id = selectedId;
    return id ? metaSpriteEntries.find((e) => keyOf(e) === id) ?? null : null;
  }, [selectedId, metaSpriteEntries]);
  
  // Undo/Redo
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [future, setFuture] = useState<HistoryEntry[]>([]);

  const pushHistory = useCallback((snapshot?: Tile[]) => {
    const tilesSnap = snapshot ?? tiles.map(t => t.map(row => row.slice()));
    setHistory(h => [...h, { tiles: tilesSnap }]);
    setFuture([]);
  }, [tiles]);

  const undo = () => {
    setHistory(h => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      setFuture(f => [{ tiles: tiles.map(t => t.map(r => r.slice())) }, ...f]);
      setTiles(prev.tiles.map(t => t.map(r => r.slice())));
      return h.slice(0, -1);
    });
  };

  const redo = () => {
    setFuture(f => {
      if (f.length === 0) return f;
      const next = f[0];
      setHistory(h => [...h, { tiles: tiles.map(t => t.map(r => r.slice())) }]);
      setTiles(next.tiles.map(t => t.map(r => r.slice())));
      return f.slice(1);
    });
  };

  const getToolByName = (name: "brush" | "fill" | "picker" | "eraser"): Tool => {
    switch(name) {
      case "brush":
        return { type: "brush", icon: faPaintBrush};
      case "fill":
        return { type: "fill", icon: faFillDrip};
      case "picker":
        return { type: "picker", icon: faEyeDropper};
      case "eraser":
        return { type: "eraser", icon: faEraser};
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      }
      if (e.key === "b") setTool(getToolByName("brush"));
      if (e.key === "f") setTool(getToolByName("fill"));
      if (e.key === "i") setTool(getToolByName("picker"));
      if (e.key === "e") setTool(getToolByName("eraser"));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [redo, undo]);

  const tile = tiles[currentTile];

  // Painting ops
  const setPixel = useCallback((x: number, y: number, value: number) => {
    setTiles(prev => {
      const next = prev.map(t => t.map(row => row.slice()));
      next[currentTile][y][x] = value & 0xF;
      return next;
    });
  }, [currentTile]);

  const floodFill = useCallback((x: number, y: number, target: number, replacement: number) => {
    if (target === replacement) return;
    const visited = new Set<string>();
    const q: [number, number][] = [[x, y]];
    setTiles(prev => {
      const next = prev.map(t => t.map(r => r.slice()));
      while (q.length) {
        const [cx, cy] = q.shift()!;
        const key = `${cx},${cy}`;
        if (visited.has(key)) continue;
        visited.add(key);
        if (cx < 0 || cy < 0 || cx >= TILE_W || cy >= TILE_H) continue;
        if (next[currentTile][cy][cx] !== target) continue;
        next[currentTile][cy][cx] = replacement & 0xF;
        q.push([cx+1, cy]); q.push([cx-1, cy]); q.push([cx, cy+1]); q.push([cx, cy-1]);
      }
      return next;
    });
  }, [currentTile]);

  // Mouse interactions
  const onCellDown = (x: number, y: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    pushHistory();
    setIsMouseDown(true);

    if (e.button === 2 || e.buttons === 2) {
      // Right-click erase
      setPixel(x, y, 0);
      return;
    }

    if (tool.type === "picker") {
      setCurrentColor(tile[y][x]);
    } else if (tool.type === "eraser") {
      setPixel(x, y, 0);
    } else if (tool.type === "fill") {
      floodFill(x, y, tile[y][x], currentColor);
    } else {
      setPixel(x, y, currentColor);
    }
  };

  const onCellMove = (x: number, y: number) => (e: React.MouseEvent) => {
    if (!isMouseDown) return;
    if (tool.type === "brush") setPixel(x, y, currentColor);
    if (tool.type === "eraser") setPixel(x, y, 0);
  };

  const stopStroke = () => setIsMouseDown(false);

  // Tile ops
  const addTile = () => {
    pushHistory();
    setTiles(t => [...t, makeBlankTile()]);
    setCurrentTile(i => i + 1);
  };
  const duplicateTile = () => {
    pushHistory();
    setTiles(t => [...t, t[currentTile].map(row => row.slice())]);
    setCurrentTile(tiles.length);
  };
  const clearTile = () => {
    pushHistory();
    setTiles(prev => {
      const next = prev.map(t => t.map(row => row.slice()));
      next[currentTile] = makeBlankTile();
      return next;
    });
  };

  // Import/Export
  const exportBIN = () => {
    const chunks = tiles.map(encodeSNES4bppTile);
    const total = new Uint8Array(32 * tiles.length);
    chunks.forEach((c, i) => total.set(c, i * 32));
    download(`snes_tiles_${tiles.length}x.bin`, total);
  };

  const exportJSON = () => {
    const meta = { format: "snes-4bpp", tileSize: { w: TILE_W, h: TILE_H }, tiles, palette };
    const text = JSON.stringify(meta, null, 2);
    download("snes_tiles.json", new Blob([text], { type: "application/json" }));
  };

  const importBIN: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const buf = new Uint8Array(await f.arrayBuffer());
    if (buf.length % 32 !== 0) {
      alert("File size must be a multiple of 32 bytes (each tile is 32 bytes)");
      return;
    }
    const count = buf.length / 32;
    const newTiles: Tile[] = [];
    for (let i = 0; i < count; i++) newTiles.push(decodeSNES4bppTile(buf.subarray(i * 32, i * 32 + 32)));
    pushHistory(tiles.map(t => t.map(r => r.slice())));
    setTiles(newTiles);
    setCurrentTile(0);
    e.currentTarget.value = "";
  };

  // PNG export
  const exportTilePNG = () => {
    const c = renderTileToCanvas(tile, palette, 16);
    c.toBlob(b => b && download(`tile_${currentTile}.png`, b!));
  };
  const exportTilesheetPNG = () => {
    const c = renderTilesheetToCanvas(tiles, palette, tilesPerRow, 8);
    c.toBlob(b => b && download(`tilesheet_${tiles.length}x.png`, b!));
  };

  // CGRAM export
  const exportCGRAM = () => {
    const cgram = exportCGRAMBGR15(palette);
    download("palette_cgram_bgr15.bin", cgram);
  };

  // Context menu disable for right-click erase
  // useEffect(() => {
  //   const prevent = (e: MouseEvent) => e.preventDefault();
  //   document.addEventListener("contextmenu", prevent);
  //   return () => document.removeEventListener("contextmenu", prevent);
  // }, []);

  // const [meta, setMeta] = useState({
  //   a: { tile: 0 },
  //   b: { tile: 1 },
  //   c: { tile: 2 },
  //   d: { tile: 3 }
  // });

  const transformTile = useCallback((fn: (src: Tile) => Tile) => {
    pushHistory();
    setTiles(prev => {
      const next = prev.map(t => t.map(r => r.slice()));
      next[currentTile] = fn(next[currentTile]);
      return next;
    });
  }, [currentTile, pushHistory]);

  const flipTileH = () => transformTile((src) => {
    const out = makeBlankTile();
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) out[y][7 - x] = src[y][x];
    return out;
  });

  const flipTileV = () => transformTile((src) => {
    const out = makeBlankTile();
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) out[7 - y][x] = src[y][x];
    return out;
  });

  const rotateTileCW = () => transformTile((src) => {
    const out = makeBlankTile();
    // out[y][x] = src[7 - x][y]
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) out[y][x] = src[7 - x][y];
    return out;
  });

  const rotateTileCCW = () => transformTile((src) => {
    const out = makeBlankTile();
    // out[y][x] = src[x][7 - y]
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) out[y][x] = src[x][7 - y];
    return out;
  });

  const shiftTile = (dx: number, dy: number) => {
    const wrap8 = (n: number) => (((n % 8) + 8) % 8);
    transformTile((src) => {
      const out = makeBlankTile();
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
          const nx = wrap8(x + dx);
          const ny = wrap8(y + dy);
          out[ny][nx] = src[y][x];
        }
      }
      return out;
  });
};

  // const drawTiles = useCallback(() => {
  //   const c = tilesheetCanvasRef.current;
  //   if (!c) return;
  //   const scale = 2;
  //   c.width = (8 * scale) * 16;
  //   c.height = (8 * scale) * 16;
  //   const ctx = c.getContext("2d");
  //   if (!ctx) return;
  //   ctx.clearRect(0, 0, c.width, c.height);
  //   ctx.fillStyle = palette[0];
  //   ctx.fillRect(0, 0, c.width, c.height);
  // }, [tiles, palette]);


  // useEffect(() => { drawTiles(); }, [drawTiles]);

  const paletteSwatches = useMemo(
    () => palette.map((hex, i) => (
      <button
        key={i}
        onClick={() => setCurrentColor(i)}
        className={`select-none h-8 w-8 rounded-md border border-white-900 ${currentColor === i ? "ring-2 ring-offset-1 ring-yellow-500" : ""}`}
        style={{ background: hex }}
        title={`Index ${i}`}
      />
    )),
    [palette, currentColor]
  );

  // Helpers for UI state updates
  // const setQuad = (k: "a"|"b"|"c"|"d", patch: Partial<typeof meta.a>) =>
  //   setMeta(m => ({ ...m, [k]: { ...m[k], ...patch } } as typeof m));  

  return (

    <Fragment>
    <div className="min-h-screen p-6">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-bold mb-2">SNES Sprite Editor (4bpp, 8×8 tiles)</h1>
        <p className="text-sm text-slate-600 mb-6">
          Paint with 16-color palette. Tools: Brush (B), Fill (F), Eyedropper (I), Eraser (E). Undo (Ctrl/Cmd+Z), Redo (Ctrl/Cmd+Y or Shift+Z).
        </p>

        {/* Top Bar */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          {/* Zoom */}
          {/* <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Zoom</label>
            <input type="range" min={12} max={48} step={4} value={zoom} onChange={(e) => setZoom(parseInt(e.target.value))} />
            <span className="tabular-nums text-sm">{zoom}px</span>
          </div> */}

          {/* Tools */}
          {/* <div className="flex items-center gap-1 rounded-lg bg-white p-1 border">
            {(["brush","fill","picker","eraser"] as Tool[]).map(t => (
              <button key={t} onClick={() => setTool(t)} className={`px-3 py-1.5 rounded-md text-sm ${tool===t?"bg-blue-600 text-white":"bg-transparent hover:bg-slate-100"}`}>{t}</button>
            ))}
          </div> */}

           {/* <div className="flex items-center gap-1 rounded-lg bg-white p-1 border">
             <span className="text-sm mr-1">Transform</span>
             <button onClick={rotateTileCCW} className="px-2 py-1 rounded hover:bg-slate-100" title="Rotate Left (90° CCW)">↺</button>
             <button onClick={rotateTileCW} className="px-2 py-1 rounded hover:bg-slate-100" title="Rotate Right (90° CW)">↻</button>
             <button onClick={flipTileH} className="px-2 py-1 rounded hover:bg-slate-100" title="Flip Horizontal">⟷</button>
             <button onClick={flipTileV} className="px-2 py-1 rounded hover:bg-slate-100" title="Flip Vertical">⟂</button>
           </div>           */}

          {/* Tile ops */}
          {/* <div className="flex items-center gap-2">
            <button onClick={addTile} className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm shadow">+ Add tile</button>
            <button onClick={duplicateTile} className="px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 text-sm">Duplicate</button>
            <button onClick={clearTile} className="px-3 py-1.5 rounded-lg bg-slate-200 text-slate-800 text-sm">Clear</button>
            <button onClick={undo} className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-800 text-sm">Undo</button>
            <button onClick={redo} className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-800 text-sm">Redo</button>
          </div> */}

          {/* Import/Export */}
          {/* <div className="flex flex-wrap items-center gap-2">
            <button onClick={exportBIN} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm shadow">Export .bin</button>
            <button onClick={exportJSON} className="px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 text-sm">Export .json</button>
            <button onClick={exportTilePNG} className="px-3 py-1.5 rounded-lg bg-purple-600 text-white text-sm shadow">Tile .png</button>
            <button onClick={exportTilesheetPNG} className="px-3 py-1.5 rounded-lg bg-purple-100 text-purple-700 text-sm">Tilesheet .png</button>
            <button onClick={exportCGRAM} className="px-3 py-1.5 rounded-lg bg-amber-200 text-amber-900 text-sm">Export CGRAM</button>
            <label className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-800 text-sm cursor-pointer">
              Import .bin
              <input type="file" accept=".bin" className="hidden" onChange={importBIN} />
            </label>
          </div> */}

        </div>
          <div className="flex flex-col w-160 mb-2">
            <div className="flex flex-row justify-between">
              <div className="text-lg">Palette (16 colors)</div><button onClick={() => setShowPaletteWindow(true)}>Edit Palette</button>
            </div>
            <div className="flex gap-2 justify-center">{paletteSwatches}</div>
          </div>

        {/* Editor + Side Panels */}
        <div className="flex flex-row gap-10">
          {/* Pixel Grid */}
          <div className="flex flex-row gap-10">

              <div className="flex flex-col items-center flex-wrap">
                <div>
                  <h2 className="font-semibold">Meta-sprite</h2>
                </div>

                <div className="mb-2 p-1 rounded-lg border border-indigo-900 bg-indigo-300">
                  {/* <canvas ref={metaCanvasRef} /> */}
                  <MetaSpriteView 
                        entries={metaSpriteEntries} 
                        palettes={[palette]} 
                        tiles={tiles}
                        onClick={(index) => {
                          if(selectedTileCell) {

                            const col = index % 16;
                            const row = Math.floor(index / 16);

                            const newEntry: MetaSpriteEntry = {
                              id: uuid(),
                              tileIndex: currentTile,
                              paletteIndex: 0,
                              x: col,
                              y: row
                            }

                            setMetaSpriteEntries((prev) => [...prev, newEntry])
                          }
                        }} 
                         />
                </div>
              </div>

          </div>
          <div className="flex">
              <div className="flex flex-col">
                <div className="flex flex-row justify-between w-full">
                  <h2 className="font-semibold">Tilesheet</h2>
                  {selectedTileCell && <span className="text-sm">Selected Tile: {tileIndex(selectedTileCell?.row ?? 0, selectedTileCell?.col ?? 0)}</span>}
                </div>
                <div className="mb-2 p-1 rounded-lg border border-indigo-900 bg-indigo-300">
                  <TileGrid tiles={tiles} palette={palette} selected={selectedTileCell} onSelected={(selected) => {
                    setSelectedTileCell(selected);
                    setShowSpriteEditor(true);
                    setCurrentTile(tileIndex(selected?.row ?? 0, selected?.col ?? 0))
                  }}  />
                </div>

              </div>
          </div>

        </div>
        
        <div className="w-208">
        <SingleSelectList options={options} value={selectedId} onChange={setSelectedId} />
        </div>
        {/* <div className="p1 border solid rounded-sm min-h-50 overflow-auto w-208">
           {metaSpriteEntries.map((e, i) => {
            return (
              <div key={i}>
                <span>Tile index: {e.tileIndex}, Palette: {e.paletteIndex}, X: {e.x}, Y: {e.y}</span>
              </div>
            )
           })}     
        </div> */}
      </div>
    </div>

    <DraggableWindow title="Palette Editor" open={showPaletteWindow} onClose={function (): void {
        setShowPaletteWindow(false)
      }}>
            <section>
              <div className="flex row mt-3 w-160 flex-wrap justify-between">
                {palette.map((hex, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="color"
                      value={hex}
                      onChange={(e) => {
                        const v = e.target.value;
                        setPalette((p) => p.map((c, j) => (j === i ? v : c)));
                      }}
                      className="h-8 w-4"
                      title={`Palette ${i}`}
                    />
                    <input
                      type="text"
                      value={hex}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (/^#?[0-9a-fA-F]{6}$/.test(v)) {
                          const norm = v.startsWith("#") ? v : `#${v}`;
                          setPalette((p) => p.map((c, j) => (j === i ? norm : c)));
                        }
                      }}
                      className="border rounded px-2 py-1 text-xs font-mono w-18"
                    />
                    <span className="text-xs text-slate-500 font-bold text-blue min-w-[20]">{i}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-2">Editor colors for preview only. Use CGRAM export for 15-bit BGR palette.</p>
            </section>
      
    </DraggableWindow>

    <DraggableWindow  title="Tile Editor" open={showSpriteEditor} onClose={function (): void {
        setShowSpriteEditor(false);
      } } >

        <div className="flex flex-col">
          <div className="flex flex-row gap-2">
            <div className="select-none w-fit" onMouseUp={stopStroke} onMouseLeave={stopStroke}>
              <div className="inline-grid"
                style={{ gridTemplateColumns: `repeat(${TILE_W}, ${zoom}px)`, gridTemplateRows: `repeat(${TILE_H}, ${zoom}px)` }}>
                {tile.map((row, y) =>
                  row.map((pix, x) => (
                    <div
                      key={`${x}-${y}`}
                      onMouseDown={onCellDown(x, y)}
                      onMouseMove={onCellMove(x, y)}
                      className="border border-slate-300 hover:brightness-95"
                      style={{ background: palette[pix] ?? "#000" }}
                      title={`(${x},${y}) → ${pix}`}
                    />
                  ))
                )}
              </div>
            </div>

            <div className="flex flex-col justify-between h-[180px]">
            {([getToolByName("brush"), getToolByName("fill"), getToolByName("picker"), getToolByName("eraser")] as Tool[]).map((t, i) => (
              <button key={i} onClick={() => setTool(t)} className={`p-1 rounded-md text-sm ${tool.type===t.type?"bg-blue-600 text-white":"bg-transparent hover:bg-slate-100"}`}>
                <FontAwesomeIcon icon={t.icon} />
              </button>
            ))}
            </div>
          </div>
              <div className="flex w-70 flex-col mt-1 text-xs text-slate-500">Left-click to paint. Right-click to erase. Hold and drag to draw. Fill tool replaces contiguous region.</div>


          <div className="flex flex-col gap-1 select-none">
            <div>
              <span className="text-xs text-[#222222]">Shift pixels 
                <button title="Shift pixels up" className="p-1 rounded-md text-sm bg-transparent hover:bg-blue-100 active:bg-blue-200 active:text-white" onClick={() => shiftTile(0, -1)}>
                  <FontAwesomeIcon className="text-xs text-[#333333]" icon={faArrowUp}></FontAwesomeIcon>
                </button>, 
                <button title="Shift pixels down" className="p-1 rounded-md text-sm bg-transparent hover:bg-blue-100 active:bg-blue-200 active:text-white" onClick={() => shiftTile(0, 1)}>
                  <FontAwesomeIcon className="text-xs text-[#333333]" icon={faArrowDown}></FontAwesomeIcon>
                </button>,
                <button title="Shift pixels left" className="p-1 rounded-md text-sm bg-transparent hover:bg-blue-100 active:bg-blue-200 active:text-white" onClick={() => shiftTile(-1, 0)}>
                  <FontAwesomeIcon className="text-xs text-[#333333]" icon={faArrowLeft}></FontAwesomeIcon>
                </button>, 
                <button title="Shift pixels right" className="p-1 rounded-md text-sm bg-transparent hover:bg-blue-100 active:bg-blue-200 active:text-white" onClick={() => shiftTile(1, 0)}>
                  <FontAwesomeIcon className="text-xs text-[#333333]" icon={faArrowRight}></FontAwesomeIcon>
                </button>
            </span></div>
          </div>
          <div className="flex flex-col gap-1 select-none">
            <div><span className="text-xs text-[#222222]">Rotate&nbsp; 
            <button onClick={rotateTileCCW} className="p-1 rounded-md text-sm bg-transparent hover:bg-blue-100 active:bg-blue-200 active:text-white" title="Rotate Left (90° CCW)">
                <FontAwesomeIcon className="text-xs text-[#333333]" icon={faRotateBackward}></FontAwesomeIcon>
            </button>,
            <button onClick={rotateTileCW} className="p-1 rounded-md text-sm bg-transparent hover:bg-blue-100 active:bg-blue-200 active:text-white" title="Rotate Right (90° CW)">
                <FontAwesomeIcon className="text-xs text-[#333333]" icon={faRotateForward}></FontAwesomeIcon>

            </button>

            </span></div>
            {/* <button onClick={flipTileH} className="px-2 py-1 rounded hover:bg-slate-100" title="Flip Horizontal">⟷</button>
            <button onClick={flipTileV} className="px-2 py-1 rounded hover:bg-slate-100" title="Flip Vertical">⟂</button> */}
          </div>                
        </div>

    </DraggableWindow>
    
    </Fragment>
  );
}
