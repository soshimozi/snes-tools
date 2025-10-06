"use client";

import React, { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DraggableWindow } from "./DraggableWindow";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowDown, faArrowLeft, faArrowRight, faArrowsLeftRight, faArrowsUpDown,
  faArrowUp, faRotateBackward, faRotateForward
} from "@fortawesome/free-solid-svg-icons";

import {
  Cell, EditorSettingsBridgeMutable, MetaSpriteEntry, Region, SelectedTiles, Tile
} from "@/types/EditorTypes";

import { v4 as uuid } from "uuid";
import { SelectList } from "./SingleSelectList";
import { MetaSpriteEditor } from "./MetaSpriteEditor";
import { Tilesheet } from "./Tilesheet";

import {
  extractRegionFromTilesheet,
  extractSingleTileFromTilesheet,
  importAllPalettes,
  importPalette,
  importSinglePalette,
  indexToRowCol,
  makeBlankTile,
  moveItem,
  parseHexColor,
  produceDeleteRegionInTilesheet,
  producePasteIntoTilesheet,
  saveBGR555Palette,
  saveBGR555Palettes,
  tileIndex
} from "@/misc/Helpers";

import { SCALE, TILE_H, TILE_W } from "@/app/constants";
import { ChevronButton } from "./ChevronButton";
import ColorPicker555 from "./ColorPicker555";
import StyledButton from "./StyledButton";
import { LeftDrawer } from "./LeftDrawer";
import { menuTree, type MenuNode } from "./Menu";
import { DrawerMenu } from "./DrawerMenu";

import { useUndoableState } from "@/hooks/useUndoableState";
import { buildInitialDoc } from "@/state/buildInitialDoc";
import { EditorDoc, PasteMode, toolIcon } from "@/state/EditorDoc";
import ColorChannelInput from "./ColorChannelSlider";
import Modal from "./Modal";

// ---------------- NEW: editor sizing caps ----------------
const MAX_VIEWPORT_PX = 512; // max pixels on the larger dimension of the selection
const MIN_CELL = 10;         // min per-pixel cell size for visibility

const STORAGE_KEY = "snes-editor@v1";

// ---------------- same checkerboard util ----------------
function checkerboardStyle(
  cellPx: number,
  light = "#eeeeee",
  dark = "#bbbbbb"
): React.CSSProperties {
  console.log("checkerboardStyle", cellPx);

  // tile the pattern at half a pixel-cell for a nice density
  const s = Math.max(2, Math.floor(cellPx / 2));
  const offset = Math.floor(s / 2);

  if(cellPx <= 16) {
    return { backgroundColor: 
      "transparent"
    }
  }

  return {
    backgroundColor: light,
    backgroundImage: [
      "linear-gradient(45deg, VAR_DARK 25%, transparent 25%)",
      "linear-gradient(-45deg, VAR_DARK 25%, transparent 25%)",
      "linear-gradient(45deg, transparent 75%, VAR_DARK 75%)",
      "linear-gradient(-45deg, transparent 75%, VAR_DARK 75%)"
    ]
      .join(", ")
      .replaceAll("VAR_DARK", dark),
    backgroundSize: `${s}px ${s}px`,
    backgroundPosition: `0 0, 0 ${offset}px, ${offset}px -${offset}px, -${offset}px 0px`,
  };
}

export default function SNESpriteEditor() {
  const {
    present: s,
    set: update,
    mutate,
    undo,
    redo,
    checkpoint,
    canUndo,
    canRedo,
    hydrated
  } = useUndoableState<EditorDoc>(buildInitialDoc, { storageKey: STORAGE_KEY, limit: 200 });

  // ---------------- NEW: selection-apply toggle ----------------
  const [paintAcrossSelection, setPaintAcrossSelection] = useState(false);

  const isStrokingRef = useRef(false);
  // ---------------- NEW: remember which tile we last edited (for single-tile transforms) -------------
  const lastEditedTileIndexRef = useRef<number | null>(null);

  const [showSettings, setShowSettings] = useState(false);

  // --- Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (k === "z") { e.preventDefault(); if (canUndo) undo(); }
      else if (k === "y") { e.preventDefault(); if (canRedo) redo(); }
      else if (k === "b" && e.altKey) { e.preventDefault; update(d => (d.tool = "brush", d)); }
      else if (k === "f" && e.altKey) { e.preventDefault; update(d => (d.tool = "fill", d)); }
      else if (k === "p" && e.altKey) { e.preventDefault; update(d => (d.tool = "picker", d)); }
      else if (k === "d" && e.altKey) { e.preventDefault; update(d => (d.tool = "eraser", d)); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, canUndo, canRedo, update]);

  // Context menu disable for right-click erase
  useEffect(() => {
    const prevent = (e: MouseEvent) => e.preventDefault();
    document.addEventListener("contextmenu", prevent);
    return () => document.removeEventListener("contextmenu", prevent);
  }, []);

  // Derived
  const currentTiles = s.tilesheets[s.currentTilesheet].tiles;
  const tile = currentTiles[s.currentTile];

  const currentMetaSpriteEntries = useMemo(
    () => s.metasprites[s.currentMetasprite].entries,
    [s.metasprites, s.currentMetasprite]
  );

  const options = useMemo(
    () =>
      currentMetaSpriteEntries.map(entry => ({
        value: entry.id,
        lines: [
          `Tile: ${entry.tileIndex}, Sheet: ${entry.tileSheetIndex}, Palette: ${entry.paletteIndex}, x: ${entry.x}, y: ${entry.y}`,
        ],
        title:
          `Tile: ${entry.tileIndex}, Sheet: ${entry.tileSheetIndex}, Palette: ${entry.paletteIndex}, x: ${entry.x}, y: ${entry.y}, h: ${entry.h ? 1 : 0}, v: ${entry.v ? 1 : 0}, r: ${entry.r}`,
      })),
    [currentMetaSpriteEntries]
  );

  const selectedEntries = useMemo(() => {
    const ids = new Set(s.selectedIds);
    return currentMetaSpriteEntries.filter(e => ids.has(e.id));
  }, [s.selectedIds, currentMetaSpriteEntries]);

  const currentColorValue = useMemo(
    () => parseHexColor(s.palettes[s.currentPalette][s.currentColor]),
    [s.palettes, s.currentPalette, s.currentColor]
  );
  const currentRed = currentColorValue?.r;
  const currentGreen = currentColorValue?.g;
  const currentBlue = currentColorValue?.b;

  // ---------- utils ----------
  const cloneTilesArray = (tiles: Tile[]) => tiles.map(t => t.map(r => r.slice()));

  // ---------------- NEW: region grid (which tiles are in the selection) ----------------
  const tileGrid = useMemo(() => {
    // Region first
    if (s.selectedTileRegion) {
      const r = s.selectedTileRegion;
      const grid: number[][] = [];
      for (let y = 0; y < r.rows; y++) {
        const row: number[] = [];
        for (let x = 0; x < r.cols; x++) {
          row.push(tileIndex(r.startRow + y, r.startCol + x));
        }
        grid.push(row);
      }
      return grid;
    }

    // Single cell
    if (s.selectedTileCell) {
      const idx = tileIndex(s.selectedTileCell.row ?? 0, s.selectedTileCell.col ?? 0);
      return [[idx]];
    }

    // Fallback: current tile
    return [[s.currentTile]];
  }, [s.selectedTileRegion, s.selectedTileCell, s.currentTile]);

  // ---------------- NEW: region dimensions + dynamic pixel cell size ----------------
  const regionCols = tileGrid[0]?.length ?? 1;
  const regionRows = tileGrid.length || 1;
  const maxCells = 8 * Math.max(regionCols, regionRows);
  const dynamicCell = Math.max(MIN_CELL, Math.floor(MAX_VIEWPORT_PX / Math.max(1, maxCells)));

  // ---------- Painting ops (tile-aware) ----------
  const setPixelAt = useCallback((tileIndex0: number, x: number, y: number, value: number) => {
    mutate(d => {
      const sheet = d.tilesheets[d.currentTilesheet];
      const nextTiles = cloneTilesArray(sheet.tiles);
      nextTiles[tileIndex0][y][x] = value & 0xF;
      sheet.tiles = nextTiles;
      return d;
    });
  }, [mutate]);

  const floodFillTile = useCallback((tileIndex0: number, x: number, y: number, _target: number | undefined, replacementRaw: number) => {
    update(d => {
      const replacement = replacementRaw & 0xF;
      const width = TILE_W, height = TILE_H;
      const next = cloneTilesArray(d.tilesheets[d.currentTilesheet].tiles);
      if (x < 0 || y < 0 || x >= width || y >= height) return d;

      const target = next[tileIndex0][y][x] & 0xF;
      if (target === replacement) return d;

      const stack: [number, number][] = [[x, y]];
      const seen = new Set<string>();

      while (stack.length) {
        const [cx, cy] = stack.pop()!;
        if (cx < 0 || cy < 0 || cx >= width || cy >= height) continue;
        const key = `${cx},${cy}`;
        if (seen.has(key)) continue;
        if ((next[tileIndex0][cy][cx] & 0xF) !== target) continue;
        seen.add(key);
        next[tileIndex0][cy][cx] = replacement;
        stack.push([cx+1,cy], [cx-1,cy], [cx,cy+1], [cx,cy-1]);
      }

      d.tilesheets[d.currentTilesheet].tiles = next;
      return d;
    });
  }, [update]);

  const transformTileAt = useCallback((tileIndex0: number, fn: (src: Tile) => Tile) => {
    update(d => {
      const next = cloneTilesArray(d.tilesheets[d.currentTilesheet].tiles);
      next[tileIndex0] = fn(next[tileIndex0]);
      d.tilesheets[d.currentTilesheet].tiles = next;
      return d;
    });
  }, [update]);

  // ---------- Pixel transforms ----------
  const flipTileHFn = (src: Tile) => {
    const out = makeBlankTile();
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) out[y][7 - x] = src[y][x];
    return out;
  };
  const flipTileVFn = (src: Tile) => {
    const out = makeBlankTile();
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) out[7 - y][x] = src[y][x];
    return out;
  };
  const rotateTileCwFn = (src: Tile) => {
    const out = makeBlankTile();
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) out[y][x] = src[7 - x][y];
    return out;
  };
  const rotateTileCcwFn = (src: Tile) => {
    const out = makeBlankTile();
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) out[y][x] = src[x][7 - y];
    return out;
  };
  const shiftTileFn = (src: Tile, dx: number, dy: number) => {
    const wrap8 = (n: number) => (((n % 8) + 8) % 8);
    const out = makeBlankTile();
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const nx = wrap8(x + dx), ny = wrap8(y + dy);
      out[ny][nx] = src[y][x];
    }
    return out;
  };

  // ---------- Helpers for selection iteration ----------
  const forEachSelectedTile = (fn: (tileIndex0: number) => void) => {
    for (let gy = 0; gy < regionRows; gy++) {
      for (let gx = 0; gx < regionCols; gx++) {
        fn(tileGrid[gy][gx]);
      }
    }
  };

  // ---------- Metasprite ops (unchanged except kept your logic) ----------
  const shiftMetaSprite = (dx: number, dy: number) => {
    const scale = SCALE * 8 * 16;
    const wrap = (n: number) => (((n % scale) + scale) % scale);
    if (!s.selectedIds.length) return;

    update(d => {
      const sel = new Set(d.selectedIds);
      const ms = d.metasprites[d.currentMetasprite];
      let changed = false;
      const updated = ms.entries.map(entry => {
        if (!sel.has(entry.id)) return entry;
        changed = true;
        return { ...entry, x: wrap(entry.x + dx), y: wrap(entry.y + dy) };
      });
      if (changed) ms.entries = updated;
      return d;
    });
  };

  const flipHorizontal = () => {
    if (!s.selectedIds.length) return;
    const sel = new Set(s.selectedIds);
    update(d => {
      const ms = d.metasprites[d.currentMetasprite];
      let changed = false;
      const updated = ms.entries.map(e => (!sel.has(e.id) ? e : (changed = true, { ...e, h: !e.h })));
      if (changed) ms.entries = updated;
      return d;
    });
  };
  const flipVertical = () => {
    if (!s.selectedIds.length) return;
    const sel = new Set(s.selectedIds);
    update(d => {
      const ms = d.metasprites[d.currentMetasprite];
      let changed = false;
      const updated = ms.entries.map(e => (!sel.has(e.id) ? e : (changed = true, { ...e, v: !e.v })));
      if (changed) ms.entries = updated;
      return d;
    });
  };
  const rotateMetaSpriteCW = () => {
    if (!s.selectedIds.length) return;
    const sel = new Set(s.selectedIds);
    update(d => {
      const ms = d.metasprites[d.currentMetasprite];
      let changed = false;
      const updated = ms.entries.map(e => (!sel.has(e.id) ? e : (changed = true, { ...e, r: (e.r + 1) % 4 })));
      if (changed) ms.entries = updated;
      return d;
    });
  };
  const rotateMetaSpriteCCW = () => {
    if (!s.selectedIds.length) return;
    const sel = new Set(s.selectedIds);
    update(d => {
      const ms = d.metasprites[d.currentMetasprite];
      let changed = false;
      const updated = ms.entries.map(e => (!sel.has(e.id) ? e : (changed = true, { ...e, r: (e.r + 3) % 4 })));
      if (changed) ms.entries = updated;
      return d;
    });
  };

  const deleteAll = () => {
    update(d => {
      d.metasprites[d.currentMetasprite].entries = [];
      d.selectedIds = [];
      return d;
    });
  };

  const clearSelected = () => {
    update(d => {
      d.selectedIds = [];
      return d;
    });
  };

  const idInSelected = (selectedId: string, d: EditorDoc): boolean => {
    return !!(d.selectedIds.find((id) => id === selectedId));
  };

  const deleteSelected = () => {
    update(d => {
      d.metasprites[d.currentMetasprite].entries = d.metasprites[d.currentMetasprite].entries.filter((e) => !idInSelected(e.id, d));
      d.selectedIds = [];
      return d;
    });
  };

  // ---------- Palette handlers ----------
  function bgr555ToRgb(bgr555: number): { r: number; g: number; b: number } {
    const b5 = (bgr555 >> 10) & 31, g5 = (bgr555 >> 5) & 31, r5 = bgr555 & 31;
    const r = (r5 << 3) | (r5 >> 2);
    const g = (g5 << 3) | (g5 >> 2);
    const b = (b5 << 3) | (b5 >> 2);
    return { r, g, b };
  }

  const handleBGRChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const num = parseInt(e.target.value, 16) & 0x7FFF; // auto-clear bit 15
    const { r, g, b } = bgr555ToRgb(num);
    const hexColor = `#${(r & 0xf8).toString(16).padStart(2, "0")}${(g & 0xf8).toString(16).padStart(2, "0")}${(b & 0xf8).toString(16).padStart(2, "0")}`;

    update(d => {
      const pi = d.currentPalette, ci = d.currentColor;
      d.bgrPalettes = d.bgrPalettes.map((p, i) =>
        (i === pi || ci === 0) ? p.map((hex, j) => j === ci ? num.toString(16).padStart(4, "0") : hex) : p
      );
      d.palettes = d.palettes.map((p, i) =>
        (i === pi || ci === 0) ? p.map((hex, j) => j === ci ? hexColor : hex) : p
      );
      return d;
    });
  };

  const onColorPickerChange = (nextHex: string, bgr: number) => {
    update(d => {
      const pi = d.currentPalette, ci = d.currentColor;
      d.bgrPalettes = d.bgrPalettes.map((p, i) =>
        (i === pi || ci === 0) ? p.map((hex, j) => j === ci ? bgr.toString(16).padStart(4, "0") : hex) : p
      );
      d.palettes = d.palettes.map((p, i) =>
        (i === pi || ci === 0) ? p.map((hex, j) => j === ci ? nextHex : hex) : p
      );
      return d;
    });
  };

  const handleChannel = (channel: "r" | "g" | "b") => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseInt(e.target.value) | 0;
    const c = currentColorValue; if (!c) return;

    const r = channel === "r" ? v : c.r;
    const g = channel === "g" ? v : c.g;
    const b = channel === "b" ? v : c.b;

    const hex = `#${(r & 0xf8).toString(16).padStart(2, "0")}${(g & 0xf8).toString(16).padStart(2, "0")}${(b & 0xf8).toString(16).padStart(2, "0")}`;
    const bgr = (((b & 0xf8) >> 3) << 10) | (((g & 0xf8) >> 3) << 5) | ((r & 0xf8) >> 3);

    update(d => {
      const pi = d.currentPalette, ci = d.currentColor;
      d.palettes = d.palettes.map((p, i) =>
        (i === pi || ci === 0) ? p.map((hex0, j) => j === ci ? hex : hex0) : p
      );
      d.bgrPalettes = d.bgrPalettes.map((p, i) =>
        (i === pi || ci === 0) ? p.map((hex0, j) => j === ci ? bgr.toString(16).padStart(4, "0") : hex0) : p
      );
      return d;
    });
  };

  // ---------- Selection / creation ----------
  const createMetaspriteEntry = useCallback((col: number, row: number): MetaSpriteEntry => ({
    id: uuid(),
    tileSheetIndex: s.currentTilesheet,
    tileIndex: s.currentTile,
    paletteIndex: s.currentPalette,
    x: col,
    y: row,
    h: false,
    v: false,
    r: 0,
  }), [s.currentTilesheet, s.currentTile, s.currentPalette]);

  const updateMetasprite = ({ row, col }: { row: number; col: number }) => {
    update(d => {
      if (!d.selectedTileCell && !d.selectedTileRegion) return d;

      if (d.selectedTileRegion) {
        const reg = d.selectedTileRegion;
        const newEntries: MetaSpriteEntry[] = [];
        for (let y = 0; y < reg.rows; y++) {
          for (let x = 0; x < reg.cols; x++) {
            const locationX = col + (x * SCALE * 8);
            const locationY = row + (y * SCALE * 8);
            const e: MetaSpriteEntry = {
              id: uuid(),
              tileSheetIndex: d.currentTilesheet,
              tileIndex: tileIndex(reg.startRow + y, reg.startCol + x),
              paletteIndex: d.currentPalette,
              x: locationX,
              y: locationY,
              h: false, v: false, r: 0,
            };
            newEntries.push(e);
          }
        }
        d.metasprites[d.currentMetasprite].entries = [
          ...d.metasprites[d.currentMetasprite].entries,
          ...newEntries
        ];

        d.selectedIds = newEntries.map(e => e.id);
        return d;
      }

      // single tile
      const e = createMetaspriteEntry(col, row);
      d.metasprites[d.currentMetasprite].entries = [
        ...d.metasprites[d.currentMetasprite].entries,
        e
      ];
      d.selectedIds = [e.id];
      return d;
    });
  };

  function selectRegion(region?: Region): void {
    update(d => { 
      d.selectedTileRegion = region;
      d.selectedTileCell = null;
      d.showSpriteEditor = !!region;
      return d;
    });
  }

  function selectTile(selected: Cell): void {
    update(d => {
      d.selectedTileCell = selected;
      d.showSpriteEditor = !!selected;
      if (selected) d.currentTile = tileIndex(selected.row ?? 0, selected.col ?? 0);
      return d;
    });
  }

  // ---------- Copy / Paste / Delete (tilesheet) ----------
  const handleCopy = (region?: Region, cell?: Cell) => {
    update(d => {
      const sheet = d.tilesheets[d.currentTilesheet];
      const payload = region
        ? extractRegionFromTilesheet(sheet.tiles, region, indexToRowCol)
        : (cell ? extractSingleTileFromTilesheet(sheet.tiles, cell, indexToRowCol) : null);
      if (payload) d.clipboard = payload;
      return d;
    });
  };

  const handlePaste = (at: Cell) => {
    if (!s.clipboard || !at) return;
    update(d => {
      d.tilesheets = producePasteIntoTilesheet(
        d.tilesheets,
        d.currentTilesheet,
        d.clipboard!,
        at,
        indexToRowCol
      );
      return d;
    });
  };

  const handlePasteSpecial = (at: Cell, mode: PasteMode, includeZeroSrc = false) => {
    if (!s.clipboard || !at) return;
    update(d => {
      d.tilesheets = producePasteIntoTilesheet(
        d.tilesheets,
        d.currentTilesheet,
        d.clipboard!,
        at,
        indexToRowCol,
        { mode, includeZeroSrc }
      );
      return d;
    });
  };

  const handleDelete = (region?: Region, cell?: Cell) => {
    update(d => {
      const targetRegion = region ?? (cell ? { startRow: cell.row!, startCol: cell.col!, rows: 1, cols: 1 } : undefined);
      if (!targetRegion) return d;
      d.tilesheets = produceDeleteRegionInTilesheet(
        d.tilesheets, d.currentTilesheet, targetRegion, indexToRowCol
      );
      return d;
    });
  };

  // ---------- Drawer / Menu ----------
  const onPick = useCallback((node: MenuNode) => {
    if (node.id === "pal-load-full") {
      importAllPalettes(true, (palettes) => {
        if (palettes) {
          update(d => {
            d.palettes = convertUint16ArrayToHexPalettes(palettes);
            d.bgrPalettes = convertUint16ArrayToBGR555Palettes(palettes);
            return d;
          });
        }
      });
    } else if (node.id === "pal-save-full") {
      saveBGR555Palettes(`${s.exportPrefixes?.palette ?? "default_"}full.pal`, s.bgrPalettes, true);
    } else if (node.id === "pal-save-cur-full") {
      saveBGR555Palette(`${s.exportPrefixes?.palette ?? "default_"}${s.currentPalette}.pal`, s.bgrPalettes[s.currentPalette], true);
    } else if (node.id === "sprite") {
      console.log("Open sprite editor", s.selectedTileCell, s.selectedTileRegion);

      if (!s.selectedTileCell && !s.selectedTileRegion) return;

      mutate(d => {
        d.showSpriteEditor = true;
        return d;
      });
    } else if (node.id === "settings") {
      setShowSettings(true);
    } else if (node.id === "pal-load-16") {
      importSinglePalette(true, (palette) => {
        if (palette) {
          update(d => {
            const filtered = d.palettes.filter((_, i) => i !== d.currentPalette);
            filtered.splice(d.currentPalette, 0, convertUint16ArrayToHexPalettes(palette)[0]);
            const filteredBgr = d.bgrPalettes.filter((_, i) => i !== d.currentPalette);
            filteredBgr.splice(d.currentPalette, 0, convertUint16ArrayToBGR555Palettes(palette)[0]);

            d.palettes = [...filtered];
            d.bgrPalettes = [...filteredBgr];
            return d;
          });
        }
      });
    }

    mutate(d => (d.drawerOpen = false, d));
  }, [mutate, s.bgrPalettes, s.exportPrefixes, s.currentPalette, s.selectedTileCell, s.selectedTileRegion, update]);

  // ---------- Palette view ----------
  const paletteView = useMemo(
    () => (
      <div className="flex flex-col gap-2">
        {s.palettes.map((pal, palIndex) => (
          <div key={palIndex} className="flex flex-row">
            {pal.map((hex, i) => (
              <button
                key={i}
                onClick={() => update(d => { d.currentColor = i; d.currentPalette = palIndex; return d; })}
                className={`select-none h-6 w-6 rounded-sm border border-white-900 ${hydrated && s.currentPalette === palIndex && s.currentColor === i ? "ring-1 ring-offset-1 ring-yellow-500" : ""}`}
                style={{ background: hex }}
                title={`Index ${i}`}
              />
            ))}
          </div>
        ))}
      </div>
    ),
    [s.palettes, s.currentPalette, s.currentColor, update, hydrated]
  );

  const currentPalleteIndex = useMemo(() => {
    if (s.palettes.length === 0) return 0;
    return Math.min(s.currentPalette, s.palettes.length - 1);
  }, [s.palettes, s.currentPalette]);

  const currentPalette = useMemo(() => {
    if (s.palettes.length === 0) return [];
    return s.palettes[currentPalleteIndex];
  }, [s.palettes, currentPalleteIndex]);

  // ---------- Mouse interactions for pixel painting (tile-aware) ----------
  const onPixelDown = (tileIndex0: number, px: number, py: number) => (e: React.MouseEvent) => {
    e.preventDefault();

    isStrokingRef.current = true;
    lastEditedTileIndexRef.current = tileIndex0; // remember for transforms
    checkpoint();

    const rightClick = (e.button === 2 || e.buttons === 2);

    if (rightClick || s.tool === "eraser") {
      if (paintAcrossSelection) forEachSelectedTile(ti => setPixelAt(ti, px, py, 0));
      else setPixelAt(tileIndex0, px, py, 0);
      return;
    }

    if (s.tool === "picker") {
      const picked = s.tilesheets[s.currentTilesheet].tiles[tileIndex0][py][px];
      mutate(d => { d.currentColor = picked; return d; });
      return;
    }

    if (s.tool === "fill") {
      if (paintAcrossSelection) forEachSelectedTile(ti => floodFillTile(ti, px, py, undefined, s.currentColor));
      else floodFillTile(tileIndex0, px, py, undefined, s.currentColor);
      return;
    }

    // brush
    if (paintAcrossSelection) forEachSelectedTile(ti => setPixelAt(ti, px, py, s.currentColor));
    else setPixelAt(tileIndex0, px, py, s.currentColor);
  };

  const onPixelMove = (tileIndex0: number, px: number, py: number) => (e: React.MouseEvent) => {
    if (!isStrokingRef.current) return;
    if (e.buttons !== 1) return;

    if (s.tool === "brush") {
      if (paintAcrossSelection) forEachSelectedTile(ti => setPixelAt(ti, px, py, s.currentColor));
      else setPixelAt(tileIndex0, px, py, s.currentColor);
    } else if (s.tool === "eraser") {
      if (paintAcrossSelection) forEachSelectedTile(ti => setPixelAt(ti, px, py, 0));
      else setPixelAt(tileIndex0, px, py, 0);
    }
  };

  const stopStroke = () => { isStrokingRef.current = false; };

  // ---------- Transform buttons (apply to region or last edited tile) ----------
  const applyTransform = (fn: (src: Tile) => Tile) => {
    if (paintAcrossSelection) {
      forEachSelectedTile((ti) => transformTileAt(ti, fn));
    } else {
      const ti = lastEditedTileIndexRef.current ?? s.currentTile;
      transformTileAt(ti, fn);
    }
  };

  const shiftPixels = (dx: number, dy: number) => applyTransform((src) => shiftTileFn(src, dx, dy));
  const rotateTileCW = () => applyTransform(rotateTileCwFn);
  const rotateTileCCW = () => applyTransform(rotateTileCcwFn);
  const flipTileH = () => applyTransform(flipTileHFn);
  const flipTileV = () => applyTransform(flipTileVFn);

  // ---------- SelectedTiles for MetaSpriteEditor (preview block) ----------
  const selectedTiles: SelectedTiles | undefined = useMemo(() => {
    if (s.selectedTileRegion) {
      const r = s.selectedTileRegion;
      const grid: number[][] = [];
      for (let y = 0; y < r.rows; y++) {
        const row: number[] = [];
        for (let x = 0; x < r.cols; x++) {
          row.push(tileIndex(r.startRow + y, r.startCol + x));
        }
        grid.push(row);
      }
      return {
        tilesheetIndex: s.currentTilesheet,
        paletteIndex: s.currentPalette,
        tileIndices: grid,
        opacity: 0.3,
      };
    }
    if (s.selectedTileCell) {
      const idx = tileIndex(s.selectedTileCell.row ?? 0, s.selectedTileCell.col ?? 0);
      return {
        tilesheetIndex: s.currentTilesheet,
        paletteIndex: s.currentPalette,
        tileIndices: [[idx]],
        opacity: 0.9,
      };
    }
    return undefined;
  }, [s.selectedTileRegion, s.selectedTileCell, s.currentTilesheet, s.currentPalette]);

  // ---------- Palette conversion helpers ----------
  const convertUint16ArrayToHexPalettes = (bgrPalettes: Uint16Array): string[][] => {
    const palettes: string[][] = [];
    for (let i = 0; i < bgrPalettes.length; i += 16) {
      const palette: string[] = [];
      for (let j = 0; j < 16; j++) {
        const bgr555 = bgrPalettes[i + j] & 0x7FFF; // auto-clear bit 15
        const { r, g, b } = bgr555ToRgb(bgr555);
        const hexColor = `#${(r & 0xf8).toString(16).padStart(2, "0")}${(g & 0xf8).toString(16).padStart(2, "0")}${(b & 0xf8).toString(16).padStart(2, "0")}`;
        palette.push(hexColor);
      }
      palettes.push(palette);
    }
    return palettes;
  };

  const convertUint16ArrayToBGR555Palettes = (bgrPalettes: Uint16Array): string[][] => {
    const palettes: string[][] = [];
    for (let i = 0; i < bgrPalettes.length; i += 16) {
      const palette: string[] = [];
      for (let j = 0; j < 16; j++) {
        const bgr555 = bgrPalettes[i + j] & 0x7FFF; // auto-clear bit 15
        const hexColor = bgr555.toString(16).padStart(4, "0");
        palette.push(hexColor);
      }
      palettes.push(palette);
    }
    return palettes;
  };

  // ---------- Render ----------
  return (
    <Fragment>
      <div className="min-h-screen">
        {/* Header / AppBar */}
        <header className="sticky top-0 z-30 border-b border-slate-200">
          <div className="flex items-center gap-3 px-4 py-3">
            <StyledButton className="cursor-pointer" width={24} onClick={() => mutate(d => (d.drawerOpen = true, d))}>
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </StyledButton>

            <h1 className="text-2xl font-bold">SNES Sprite Editor (4bpp, 8×8 tiles)</h1>

            <div className="ml-auto flex gap-2">
              <StyledButton width={28} onClick={undo} disabled={!canUndo}>Undo</StyledButton>
              <StyledButton width={28} onClick={redo} disabled={!canRedo}>Redo</StyledButton>
            </div>
          </div>
        </header>

        {/* Drawer */}
        <LeftDrawer
          open={s.drawerOpen}
          onClose={() => mutate(d => (d.drawerOpen = false, d))}
          widthClass="w-64"
          persistentLg={false}
          ariaLabel="SNES tools navigation"
        >
          <div className="lg:hidden flex justify-end p-2 border-b border-slate-200">
            <button
              onClick={() => mutate(d => (d.drawerOpen = false, d))}
              className="inline-flex items-center justify-center h-8 w-8 rounded-md"
              aria-label="Close navigation"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6l-12 12" />
              </svg>
            </button>
          </div>
          <DrawerMenu tree={menuTree} onPick={onPick} accordion />
        </LeftDrawer>

        <main className="mt-2">
          <div className="mx-auto w-full">
            <div className="flex flex-row gap-5 justify-center">

              {/* Metasprite Editor column */}
              <div className="flex flex-col gap-1">
                <div className="flex flex-row justify-between items-center">
                  <span className="text-sm font-bold">Metasprite Editor</span>

                  <div className="relative">
                    <select
                      value={s.currentMetasprite}
                      onChange={e => update(d => (d.currentMetasprite = parseInt(e.target.value), d))}
                      className="w-full select-none bg-white text-slate-700 text-sm border border-slate-200 rounded pl-3 pr-8 py-1 focus:outline-none focus:border-slate-400 hover:border-slate-400 shadow-sm appearance-none cursor-pointer">
                      {s.metasprites.map((ms, i) => (
                        <option key={i} value={i}>{ms.name}</option>
                      ))}
                    </select>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                         strokeWidth="1.2" stroke="currentColor"
                         className="h-5 w-5 ml-1 absolute top-1.5 right-1.5 text-slate-700">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15 12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
                    </svg>
                  </div>
                </div>

                <div className="flex flex-col">
                  <div className="flex flex-row p-1 rounded-lg border-2 border-blue-400 bg-transparent w-full overflow-hidden">
                    <div className="grid grid-cols-[365px_minmax(0,1fr)] gap-1 items-stretch min-h-0">

                      {/* Right rail: sprites list */}
                      <aside className="flex flex-col overflow-hidden gap-1">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">
                            Sprites ({currentMetaSpriteEntries.length})
                          </span>
                          <div className="flex flex-row gap-1">
                            <ChevronButton title="Flip Horizontal" onClick={flipHorizontal} direction="flip-horizontal" />
                            <ChevronButton title="Flip Vertical"  onClick={flipVertical}  direction="flip-vertical"/>
                            <ChevronButton title="Shift Left"  direction="left"  onClick={() => shiftMetaSprite(-1, 0)} />
                            <ChevronButton title="Shift Right" direction="right" onClick={() => shiftMetaSprite(1, 0)} />
                            <ChevronButton title="Shift Up"    direction="up"    onClick={() => shiftMetaSprite(0, -1)} />
                            <ChevronButton title="Shift Down"  direction="down"  onClick={() => shiftMetaSprite(0, 1)} />
                            <ChevronButton title="Rotate CCW"  direction="rotate-ccw" onClick={rotateMetaSpriteCCW} />
                            <ChevronButton title="Rotate CW"   direction="rotate-cw"  onClick={rotateMetaSpriteCW} />
                          </div>
                        </div>
                        <div className="flex">
                          <SelectList
                            className="w-full"
                            maxHeight={452}
                            minHeight={452}
                            options={options}
                            values={s.selectedIds}
                            onChange={(ids) => update(d => (d.selectedIds = ids, d))}
                            onDeleteItem={(id) => {
                              update(d => {
                                const ms = d.metasprites[d.currentMetasprite];
                                ms.entries = ms.entries.filter(e => e.id !== id);
                                d.selectedIds = d.selectedIds.filter(x => x !== id);
                                return d;
                              });
                            }}
                            onDrop={(fromIndex, toIndex) => {
                              update(d => {
                                const ms = d.metasprites[d.currentMetasprite];
                                ms.entries = moveItem(ms.entries, fromIndex, toIndex);
                                return d;
                              });
                            }}
                            onDropMulti={(fromIndices, insertBeforeIndex) => {
                              update(d => {
                                const arr = d.metasprites[d.currentMetasprite].entries;
                                const order = [...fromIndices].sort((a, b) => a - b);
                                const picked = order.map(i => arr[i]);
                                const remaining = arr.filter((_, idx) => !order.includes(idx));
                                const insertAt = Math.max(0, Math.min(insertBeforeIndex, remaining.length));
                                d.metasprites[d.currentMetasprite].entries = [
                                  ...remaining.slice(0, insertAt),
                                  ...picked,
                                  ...remaining.slice(insertAt),
                                ];
                                return d;
                              });
                            }}
                          />
                        </div>
                        <div className="flex justify-center gap-[6px] items-center mt-1 ml-1 mr-2">
                          <StyledButton width={35} className="h-6" onClick={clearSelected}>
                            Clear Selected
                          </StyledButton>
                          <StyledButton width={35} className="h-6" onClick={deleteSelected}>
                            Delete Selected
                          </StyledButton>
                          <StyledButton width={35} className="h-6" onClick={deleteAll}>
                            Delete All
                          </StyledButton>
                        </div>

                      </aside>
                      <div className="min-w-0 min-h-0 overflow-auto">
                        {/* Canvas */}
                        <MetaSpriteEditor
                          entries={currentMetaSpriteEntries}
                          tilesheets={s.tilesheets}
                          drawGrid={s.drawGrid}
                          selectedTiles={selectedTiles}
                          selectedRegion={s.selectedTileRegion}
                          palettes={s.palettes}
                          highlightSelected={s.highlightSelected}
                          selected={selectedEntries}
                          onClick={updateMetasprite}
                          transparentIndex0={s.showIndex0Transparency}
                        />
                      </div>

                    </div>
                  </div>
                </div>

                <div className="flex flex-col">
                  <div className="flex flex-row justify-between items-center">
                    <div className="text-sm font-bold">Palette</div>
                    <div className="text-xs">Selected Palette ({s.currentPalette})</div>
                  </div>
                  <div className="flex flex-row gap-5 mt-1 justify-start rounded-lg border-2 border-blue-400 p-1">
                    {paletteView}
                    <div className="flex flex-col">
                      <div className="flex flex-row gap-5">
                        <div className="flex">
                          <ColorPicker555
                            value={s.palettes[s.currentPalette][s.currentColor]}
                            onColorChange={onColorPickerChange}
                          />
                        </div>
                        <div className="flex flex-row items-center gap-2">
                          <label>HEX</label>
                          <input
                            type="text"
                            placeholder="0000"
                            value={s.bgrPalettes[s.currentPalette][s.currentColor]}
                            onChange={handleBGRChange}
                            className="w-28 border rounded px-2 py-1 font-mono text-sm uppercase tracking-widest"
                            title="Enter 4 hex digits (bit15 auto-cleared)"
                          />
                          <span className="text-xs text-slate-500">(BGR555)</span>
                        </div>
                      </div>

                      <div className="flex flex-row mt-1 justify-between w-full">
                        <ColorChannelInput label="B" value={currentBlue} onChange={handleChannel("b")} />
                        <ColorChannelInput label="G" value={currentGreen} onChange={handleChannel("g")} />
                        <ColorChannelInput label="R" value={currentRed} onChange={handleChannel("r")} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tilesheet column */}
              <div className="flex">
                <div className="flex flex-col gap-1">
                  <div className="flex flex-row justify-between w-full items-center">
                    <span className="text-sm font-bold">Tilesheet</span>
                    <div className="relative">
                      <select
                        value={s.currentTilesheet}
                        onChange={e => update(d => (d.currentTilesheet = parseInt(e.target.value), d))}
                        className="w-full select-none bg-white text-slate-700 text-sm border border-slate-200 rounded pl-3 pr-8 py-1 focus:outline-none focus:border-slate-400 hover:border-slate-400 shadow-sm appearance-none cursor-pointer">
                        <option value="0">Tilesheet 0</option>
                        <option value="1">Tilesheet 1</option>
                      </select>
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                           strokeWidth="1.2" stroke="currentColor"
                           className="h-5 w-5 ml-1 absolute top-1.5 right-1.5 text-slate-700">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15 12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
                      </svg>
                    </div>
                  </div>

                  <div className="flex flex-col">
                    <div className="mb-2 p-1 rounded-lg border-2 border-blue-400 bg-transparent">
                      <Tilesheet
                        tiles={currentTiles}
                        palette={s.palettes[s.currentPalette]}
                        selected={s.selectedTileCell}
                        selectedRegion={s.selectedTileRegion}
                        transparentIndex0={s.showIndex0Transparency}
                        onSelected={selectTile}
                        onRegionSelected={selectRegion}
                        onCopy={({ cell, region }) => handleCopy(region, cell ?? undefined)}
                        onPaste={({ at }) => handlePaste(at)}
                        onPasteSpecial={({ at, mode }) => handlePasteSpecial(at, mode)}
                        onDelete={({ cell, region }) => handleDelete(region, cell ?? undefined)}
                        canCopy={({ cell, region }) => !!(region || cell)}
                        canPaste={() => s.clipboard !== null}
                      />
                    </div>
                    <div className="flex justify-end">
                      {hydrated && s.selectedTileCell && (
                        <span className="text-xs">
                          Selected Tile: {tileIndex(s.selectedTileCell?.row ?? 0, s.selectedTileCell?.col ?? 0)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </main>
      </div>

      <Modal isOpen={showSettings} title="Settings"
        draggable
        closeOnBackdropClick
        closeOnEsc
        onClose={() => setShowSettings(false)}
      >
        <div className="text-black max-w-xl">
          <EditorSettingsBridgeMutable
            doc={s}
            setDoc={update}
            className="space-y-6"
          />
        </div>
      </Modal>

      {/* Tile Editor window */}
      <DraggableWindow
        className="text-slate-700"
        title="Tile Editor"
        open={s.showSpriteEditor}
        onClose={() => update(d => (d.showSpriteEditor = false, d))}
      >
        <div className="flex flex-col">
          <div className="flex flex-row gap-2">

            {/* ---------------- NEW: Multi-tile canvas ---------------- */}
            <div className="select-none w-fit" onMouseUp={stopStroke} onMouseLeave={stopStroke}>
              <div
                className="inline-grid"
                style={{
                  gridTemplateColumns: `repeat(${regionCols * TILE_W}, ${dynamicCell}px)`,
                  gridTemplateRows:    `repeat(${regionRows * TILE_H}, ${dynamicCell}px)`
                }}
              >
                {Array.from({ length: regionRows }).map((_, gy) =>
                  // Emit 8 scanlines per tile-row (py = 0..7)
                  Array.from({ length: TILE_H }).flatMap((__, py) =>
                    // For each scanline, walk across tile columns
                    Array.from({ length: regionCols }).flatMap((___, gx) => {
                      const tIndex = tileGrid[gy][gx];
                      const row = s.tilesheets[s.currentTilesheet].tiles[tIndex][py];

                      // Emit 8 pixels across this tile scanline (px = 0..7)
                      return row.map((pix, px) => {
                        const style =
                          s.showIndex0Transparency && pix === 0
                            ? checkerboardStyle(dynamicCell)
                            : { background: s.palettes[s.currentPalette][pix] ?? "#000" };

                        const borderColor = s.showIndex0Transparency ? "border-yellow-200" : "border-slate-300";

                        return (
                          <div
                            key={`gy${gy}-py${py}-gx${gx}-px${px}`}
                            onMouseDown={onPixelDown(tIndex, px, py)}
                            onMouseMove={onPixelMove(tIndex, px, py)}
                            className={`border ${borderColor} hover:brightness-95`}
                            style={style}
                            title={`T:${tIndex} (${px},${py}) → ${pix}`}
                          />
                        );
                      });
                    })
                  )
                )}
              </div>

              {/* ---------------- NEW: UI toggles under canvas ---------------- */}
              <div className="flex items-center gap-3 mt-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={paintAcrossSelection}
                    onChange={(e) => setPaintAcrossSelection(e.target.checked)}
                  />
                  Apply brush/eraser/fill to all tiles in selection
                </label>
                <span className="text-xs text-slate-500">
                  Region: {regionCols}×{regionRows} • Cell: {dynamicCell}px
                </span>
              </div>
            </div>

            {/* Tool buttons */}
            <div className="flex flex-col justify-between h-[256px]">
              {(["brush", "fill", "picker", "eraser"] as const).map(tl => (
                <button
                  key={tl}
                  onClick={() => update(d => (d.tool = tl, d))}
                  className={`p-1 rounded-md w-[48px] h-[48px] text-lg ${s.tool === tl ? "bg-blue-600 text-white" : "bg-transparent hover:bg-slate-100"}`}
                >
                  <FontAwesomeIcon icon={toolIcon[tl]} />
                </button>
              ))}
            </div>
          </div>

          {/* Pixel transforms (now selection-aware) */}
          <div className="flex flex-col gap-1 select-none">
            <div className="text-md text-[#222222]">Shift Pixels&nbsp;
              <button title="Shift up" className="p-1 rounded-md hover:bg-blue-100 active:bg-blue-200"
                      onClick={() => shiftPixels(0, -1)}>
                <FontAwesomeIcon className="text-[#333333]" icon={faArrowUp} />
              </button>,
              <button title="Shift down" className="p-1 rounded-md hover:bg-blue-100 active:bg-blue-200"
                      onClick={() => shiftPixels(0, 1)}>
                <FontAwesomeIcon className="text-[#333333]" icon={faArrowDown} />
              </button>,
              <button title="Shift left" className="p-1 rounded-md hover:bg-blue-100 active:bg-blue-200"
                      onClick={() => shiftPixels(-1, 0)}>
                <FontAwesomeIcon className="text-[#333333]" icon={faArrowLeft} />
              </button>,
              <button title="Shift right" className="p-1 rounded-md hover:bg-blue-100 active:bg-blue-200"
                      onClick={() => shiftPixels(1, 0)}>
                <FontAwesomeIcon className="text-[#333333]" icon={faArrowRight} />
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1 select-none">
            <div className="text-md text-[#222222]">Rotate&nbsp;
              <button onClick={rotateTileCCW} className="p-1 rounded-md hover:bg-blue-100 active:bg-blue-200" title="Rotate Left (90° CCW)">
                <FontAwesomeIcon className="text-[#333333]" icon={faRotateBackward} />
              </button>,
              <button onClick={rotateTileCW} className="p-1 rounded-md hover:bg-blue-100 active:bg-blue-200" title="Rotate Right (90° CW)">
                <FontAwesomeIcon className="text-[#333333]" icon={faRotateForward} />
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1 select-none">
            <div className="text-md text-[#222222]">Flip&nbsp;
              <button onClick={flipTileH} className="p-1 rounded-md hover:bg-blue-100 active:bg-blue-200" title="Flip Horizontal">
                <FontAwesomeIcon className="text-[#333333]" icon={faArrowsLeftRight} />
              </button>,
              <button onClick={flipTileV} className="p-1 rounded-md hover:bg-blue-100 active:bg-blue-200" title="Flip Vertical">
                <FontAwesomeIcon className="text-[#333333]" icon={faArrowsUpDown} />
              </button>
            </div>
          </div>
        </div>
      </DraggableWindow>
    </Fragment>
  );
}

// "use client";

// import React, { Fragment, use, useCallback, useEffect, useMemo, useState } from "react";
// import { DraggableWindow } from "./DraggableWindow";
// import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
// import {
//   faArrowDown, faArrowLeft, faArrowRight, faArrowsLeftRight, faArrowsUpDown,
//   faArrowUp, faRotateBackward, faRotateForward
// } from "@fortawesome/free-solid-svg-icons";

// import {
//   Cell, EditorSettingsBridgeMutable, MetaSpriteEntry, Region, SelectedTiles, Tile} from "@/types/EditorTypes";

// import { v4 as uuid } from "uuid";
// import { SelectList } from "./SingleSelectList";
// import { MetaSpriteEditor } from "./MetaSpriteEditor";
// import { Tilesheet } from "./Tilesheet";

// import {
//   extractRegionFromTilesheet,
//   extractSingleTileFromTilesheet,
//   importAllPalettes,
//   importPalette,
//   importSinglePalette,
//   indexToRowCol,
//   makeBlankTile,
//   moveItem,
//   parseHexColor,
//   produceDeleteRegionInTilesheet,
//   producePasteIntoTilesheet,
//   saveBGR555Palette,
//   saveBGR555Palettes,
//   tileIndex
// } from "@/misc/Helpers";

// import { SCALE, TILE_H, TILE_W } from "@/app/constants";
// import { ChevronButton } from "./ChevronButton";
// import ColorPicker555 from "./ColorPicker555";
// import StyledButton from "./StyledButton";
// import { LeftDrawer } from "./LeftDrawer";
// import { menuTree, type MenuNode } from "./Menu";
// import { DrawerMenu } from "./DrawerMenu";

// import { useUndoableState } from "@/hooks/useUndoableState";
// import { buildInitialDoc } from "@/state/buildInitialDoc";
// import { EditorDoc, PasteMode, toolIcon } from "@/state/EditorDoc";
// import ColorChannelInput from "./ColorChannelSlider";
// import Modal from "./Modal";

// const STORAGE_KEY = "snes-editor@v1";
// const TILE_EDITOR_SCALE = 48;

// function checkerboardStyle(
//   light = "#eeeeee",
//   dark = "#bbbbbb"
// ): React.CSSProperties {
//   // Reasonable square size based on the pixel cell size
//   const s = Math.max(2, Math.floor(96 / 2));
//   const offset = Math.floor(s / 2);

//   return {
//     backgroundColor: light,
//     backgroundImage: [
//       "linear-gradient(45deg, VAR_DARK 25%, transparent 25%)",
//       "linear-gradient(-45deg, VAR_DARK 25%, transparent 25%)",
//       "linear-gradient(45deg, transparent 75%, VAR_DARK 75%)",
//       "linear-gradient(-45deg, transparent 75%, VAR_DARK 75%)"
//     ]
//       .join(", ")
//       .replaceAll("VAR_DARK", dark),
//     backgroundSize: `${s}px ${s}px`,
//     backgroundPosition: `0 0, 0 ${offset}px, ${offset}px -${offset}px, -${offset}px 0px`
//   };
// }

// export default function SNESpriteEditor() {
//   const {
//     present: s,
//     set: update,
//     mutate,
//     undo,
//     redo,
//     checkpoint,
//     canUndo,
//     canRedo,
//     hydrated
//   } = useUndoableState<EditorDoc>(buildInitialDoc, { storageKey: STORAGE_KEY, limit: 200 });

//   const isStrokingRef = React.useRef(false);
//   const [showSettings, setShowSettings] = useState(false);

//   // --- Keyboard shortcuts
//   useEffect(() => {
//     const onKey = (e: KeyboardEvent) => {
//       const k = e.key.toLowerCase();


//       const mod = e.metaKey || e.ctrlKey;
//       if (!mod) return;
//       if (k === "z") { e.preventDefault(); if (canUndo) undo(); }
//       else if (k === "y") { e.preventDefault(); if (canRedo) redo(); }
//       else if (k === "b" && e.altKey) { e.preventDefault; update(d => (d.tool = "brush", d))}
//       else if (k === "f" && e.altKey) { e.preventDefault; update(d => (d.tool = "fill", d))}
//       else if (k === "p" && e.altKey) { e.preventDefault; update(d => (d.tool = "picker", d))}
//       else if (k === "d" && e.altKey) { e.preventDefault; update(d => (d.tool = "eraser", d))}
//     };
//     window.addEventListener("keydown", onKey);
//     return () => window.removeEventListener("keydown", onKey);
//   }, [undo, redo, canUndo, canRedo]);

//   // Context menu disable for right-click erase
//   useEffect(() => {
//     const prevent = (e: MouseEvent) => e.preventDefault();
//     document.addEventListener("contextmenu", prevent);
//     return () => document.removeEventListener("contextmenu", prevent);
//   }, []);

//   // Derived
//   const currentTiles = s.tilesheets[s.currentTilesheet].tiles;
//   const tile = currentTiles[s.currentTile];

//   const currentMetaSpriteEntries = useMemo(
//     () => s.metasprites[s.currentMetasprite].entries,
//     [s.metasprites, s.currentMetasprite]
//   );

//   const options = useMemo(
//     () =>
//       currentMetaSpriteEntries.map(entry => ({
//         value: entry.id,
//         lines: [
//           `Tile: ${entry.tileIndex}, Sheet: ${entry.tileSheetIndex}, Palette: ${entry.paletteIndex}, x: ${entry.x}, y: ${entry.y}`,
//         ],
//         title: 
//           `Tile: ${entry.tileIndex}, Sheet: ${entry.tileSheetIndex}, Palette: ${entry.paletteIndex}, x: ${entry.x}, y: ${entry.y}, h: ${entry.h ? 1 : 0}, v: ${entry.v ? 1 : 0}, r: ${entry.r}`,
//       })),
//     [currentMetaSpriteEntries]
//   );

//   const selectedEntries = useMemo(() => {
//     const ids = new Set(s.selectedIds);
//     return currentMetaSpriteEntries.filter(e => ids.has(e.id));
//   }, [s.selectedIds, currentMetaSpriteEntries]);

//   const currentColorValue = useMemo(
//     () => parseHexColor(s.palettes[s.currentPalette][s.currentColor]),
//     [s.palettes, s.currentPalette, s.currentColor]
//   );
//   const currentRed = currentColorValue?.r;
//   const currentGreen = currentColorValue?.g;
//   const currentBlue = currentColorValue?.b;

//   // ---------- Painting ops ----------
//   const setPixel = useCallback((x: number, y: number, value: number) => {
//     mutate(d => {
//       const sheet = d.tilesheets[d.currentTilesheet];
//       const nextTiles = sheet.tiles.map(t => t.map(row => row.slice()));
//       nextTiles[d.currentTile][y][x] = value & 0xF;
//       sheet.tiles = nextTiles;
//       return d;
//     });
//   }, [mutate]);

//   const floodFill = useCallback((x: number, y: number, _target: number | undefined, replacementRaw: number) => {
//     update(d => {
//       const ts = d.currentTilesheet, tIdx = d.currentTile;
//       const replacement = replacementRaw & 0xF;
//       const width = TILE_W, height = TILE_H;

//       const next = d.tilesheets[ts].tiles.map(t => t.map(r => r.slice()));
//       if (x < 0 || y < 0 || x >= width || y >= height) return d;

//       const target = next[tIdx][y][x] & 0xF;
//       if (target === replacement) return d;

//       const stack: [number, number][] = [[x, y]];
//       const seen = new Set<string>();

//       while (stack.length) {
//         const [cx, cy] = stack.pop()!;
//         if (cx < 0 || cy < 0 || cx >= width || cy >= height) continue;
//         const key = `${cx},${cy}`;
//         if (seen.has(key)) continue;
//         if ((next[tIdx][cy][cx] & 0xF) !== target) continue;
//         seen.add(key);
//         next[tIdx][cy][cx] = replacement;
//         stack.push([cx+1,cy], [cx-1,cy], [cx,cy+1], [cx,cy-1]);
//       }

//       d.tilesheets[ts].tiles = next;
//       return d;
//     });
//   }, [update]);

//   const transformTile = useCallback((fn: (src: Tile) => Tile) => {
//     update(d => {
//       const ts = d.currentTilesheet, tIdx = d.currentTile;
//       const next = d.tilesheets[ts].tiles.map(t => t.map(r => r.slice()));
//       next[tIdx] = fn(next[tIdx]);
//       d.tilesheets[ts].tiles = next;
//       return d;
//     });
//   }, [update]);

//   const flipTileH = () => transformTile((src) => {
//     const out = makeBlankTile();
//     for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) out[y][7 - x] = src[y][x];
//     return out;
//   });
//   const flipTileV = () => transformTile((src) => {
//     const out = makeBlankTile();
//     for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) out[7 - y][x] = src[y][x];
//     return out;
//   });
//   const rotateTileCW = () => transformTile((src) => {
//     const out = makeBlankTile();
//     for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) out[y][x] = src[7 - x][y];
//     return out;
//   });
//   const rotateTileCCW = () => transformTile((src) => {
//     const out = makeBlankTile();
//     for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) out[y][x] = src[x][7 - y];
//     return out;
//   });

//   const shiftTile = (src: Tile, dx: number, dy: number) => {
//     const wrap8 = (n: number) => (((n % 8) + 8) % 8);
//     const out = makeBlankTile();
//     for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
//       const nx = wrap8(x + dx), ny = wrap8(y + dy);
//       out[ny][nx] = src[y][x];
//     }
//     return out;
//   };

//   // ---------- Metasprite ops ----------
//   const shiftMetaSprite = (dx: number, dy: number) => {
//     const scale = SCALE * 8 * 16;
//     const wrap = (n: number) => (((n % scale) + scale) % scale);
//     if (!s.selectedIds.length) return;

//     update(d => {
//       const sel = new Set(d.selectedIds);
//       const ms = d.metasprites[d.currentMetasprite];
//       let changed = false;
//       const updated = ms.entries.map(entry => {
//         if (!sel.has(entry.id)) return entry;
//         changed = true;
//         return { ...entry, x: wrap(entry.x + dx), y: wrap(entry.y + dy) };
//       });
//       if (changed) ms.entries = updated;
//       return d;
//     });
//   };

//   const flipHorizontal = () => {
//     if (!s.selectedIds.length) return;
//     const sel = new Set(s.selectedIds);
//     update(d => {
//       const ms = d.metasprites[d.currentMetasprite];
//       let changed = false;
//       const updated = ms.entries.map(e => (!sel.has(e.id) ? e : (changed = true, { ...e, h: !e.h })));
//       if (changed) ms.entries = updated;
//       return d;
//     });
//   };
//   const flipVertical = () => {
//     if (!s.selectedIds.length) return;
//     const sel = new Set(s.selectedIds);
//     update(d => {
//       const ms = d.metasprites[d.currentMetasprite];
//       let changed = false;
//       const updated = ms.entries.map(e => (!sel.has(e.id) ? e : (changed = true, { ...e, v: !e.v })));
//       if (changed) ms.entries = updated;
//       return d;
//     });
//   };
//   const rotateMetaSpriteCW = () => {
//     if (!s.selectedIds.length) return;
//     const sel = new Set(s.selectedIds);
//     update(d => {
//       const ms = d.metasprites[d.currentMetasprite];
//       let changed = false;
//       const updated = ms.entries.map(e => (!sel.has(e.id) ? e : (changed = true, { ...e, r: (e.r + 1) % 4 })));
//       if (changed) ms.entries = updated;
//       return d;
//     });
//   };
//   const rotateMetaSpriteCCW = () => {
//     if (!s.selectedIds.length) return;
//     const sel = new Set(s.selectedIds);
//     update(d => {
//       const ms = d.metasprites[d.currentMetasprite];
//       let changed = false;
//       const updated = ms.entries.map(e => (!sel.has(e.id) ? e : (changed = true, { ...e, r: (e.r + 3) % 4 })));
//       if (changed) ms.entries = updated;
//       return d;
//     });
//   };

//   const deleteAll = () => {
//     update(d => {
//       d.metasprites[d.currentMetasprite].entries = [];
//       d.selectedIds = [];
//       return d;
//     });
//   };


//   const clearSelected = () => {
//     update(d => {
//       d.selectedIds = [];
//       return d;
//     });
//   };  

//   const idInSelected = (selectedId: string, d: EditorDoc):boolean => {
//     return !!(d.selectedIds.find((id) => id === selectedId))
//   }
  
//   const deleteSelected = () => {
//     update(d => {
//       d.metasprites[d.currentMetasprite].entries = d.metasprites[d.currentMetasprite].entries.filter((e) => !idInSelected(e.id, d));
//       d.selectedIds = [];
//       return d;
//     });
//   };  

//   // ---------- Palette handlers ----------
//   function bgr555ToRgb(bgr555: number): { r: number; g: number; b: number } {
//     const b5 = (bgr555 >> 10) & 31, g5 = (bgr555 >> 5) & 31, r5 = bgr555 & 31;
//     const r = (r5 << 3) | (r5 >> 2);
//     const g = (g5 << 3) | (g5 >> 2);
//     const b = (b5 << 3) | (b5 >> 2);
//     return { r, g, b };
//   }

//   const handleBGRChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     const num = parseInt(e.target.value, 16) & 0x7FFF; // auto-clear bit 15
//     const { r, g, b } = bgr555ToRgb(num);
//     const hexColor = `#${(r & 0xf8).toString(16).padStart(2, "0")}${(g & 0xf8).toString(16).padStart(2, "0")}${(b & 0xf8).toString(16).padStart(2, "0")}`;

//     update(d => {
//       const pi = d.currentPalette, ci = d.currentColor;
//       d.bgrPalettes = d.bgrPalettes.map((p, i) =>
//         (i === pi || ci === 0) ? p.map((hex, j) => j === ci ? num.toString(16).padStart(4, "0") : hex) : p
//       );
//       d.palettes = d.palettes.map((p, i) =>
//         (i === pi || ci === 0) ? p.map((hex, j) => j === ci ? hexColor : hex) : p
//       );
//       return d;
//     });
//   };

//   const onColorPickerChange = (nextHex: string, bgr: number) => {
//     update(d => {
//       const pi = d.currentPalette, ci = d.currentColor;
//       d.bgrPalettes = d.bgrPalettes.map((p, i) =>
//         (i === pi || ci === 0) ? p.map((hex, j) => j === ci ? bgr.toString(16).padStart(4, "0") : hex) : p
//       );
//       d.palettes = d.palettes.map((p, i) =>
//         (i === pi || ci === 0) ? p.map((hex, j) => j === ci ? nextHex : hex) : p
//       );
//       return d;
//     });
//   };

//   const handleChannel = (channel: "r" | "g" | "b") => (e: React.ChangeEvent<HTMLInputElement>) => {
//     const v = parseInt(e.target.value) | 0;
//     const c = currentColorValue; if (!c) return;

//     const r = channel === "r" ? v : c.r;
//     const g = channel === "g" ? v : c.g;
//     const b = channel === "b" ? v : c.b;

//     const hex = `#${(r & 0xf8).toString(16).padStart(2, "0")}${(g & 0xf8).toString(16).padStart(2, "0")}${(b & 0xf8).toString(16).padStart(2, "0")}`;
//     const bgr = (((b & 0xf8) >> 3) << 10) | (((g & 0xf8) >> 3) << 5) | ((r & 0xf8) >> 3);

//     update(d => {
//       const pi = d.currentPalette, ci = d.currentColor;
//       d.palettes = d.palettes.map((p, i) =>
//         (i === pi || ci === 0) ? p.map((hex0, j) => j === ci ? hex : hex0) : p
//       );
//       d.bgrPalettes = d.bgrPalettes.map((p, i) =>
//         (i === pi || ci === 0) ? p.map((hex0, j) => j === ci ? bgr.toString(16).padStart(4, "0") : hex0) : p
//       );
//       return d;
//     });
//   };

//   // ---------- Selection / creation ----------
//   const createMetaspriteEntry = useCallback((col: number, row: number): MetaSpriteEntry => ({
//     id: uuid(),
//     tileSheetIndex: s.currentTilesheet,
//     tileIndex: s.currentTile,
//     paletteIndex: s.currentPalette,
//     x: col,
//     y: row,
//     h: false,
//     v: false,
//     r: 0,
//   }), [s.currentTilesheet, s.currentTile, s.currentPalette]);

//   const updateMetasprite = ({ row, col }: { row: number; col: number }) => {
//     update(d => {
//       if (!d.selectedTileCell && !d.selectedTileRegion) return d;

//       if (d.selectedTileRegion) {
//         const reg = d.selectedTileRegion;
//         const newEntries: MetaSpriteEntry[] = [];
//         for (let y = 0; y < reg.rows; y++) {
//           for (let x = 0; x < reg.cols; x++) {
//             const locationX = col + (x * SCALE * 8);
//             const locationY = row + (y * SCALE * 8);
//             const e: MetaSpriteEntry = {
//               id: uuid(),
//               tileSheetIndex: d.currentTilesheet,
//               tileIndex: tileIndex(reg.startRow + y, reg.startCol + x),
//               paletteIndex: d.currentPalette,
//               x: locationX,
//               y: locationY,
//               h: false, v: false, r: 0,
//             };
//             newEntries.push(e);
//           }
//         }
//         d.metasprites[d.currentMetasprite].entries = [
//           ...d.metasprites[d.currentMetasprite].entries,
//           ...newEntries
//         ];

//         d.selectedIds = newEntries.map(e => e.id)
//         return d;
//       }

//       // single tile
//       const e = createMetaspriteEntry(col, row);
//       d.metasprites[d.currentMetasprite].entries = [
//         ...d.metasprites[d.currentMetasprite].entries,
//         e
//       ];
//       d.selectedIds = [e.id];
//       return d;
//     });
//   };

//   function selectTile(selected: Cell): void {
//     update(d => {
//       d.selectedTileCell = selected;
//       d.showSpriteEditor = !!selected;
//       if (selected) d.currentTile = tileIndex(selected.row ?? 0, selected.col ?? 0);
//       return d;
//     });
//   }

//   // ---------- Copy / Paste / Delete (tilesheet) ----------
//   const handleCopy = (region?: Region, cell?: Cell) => {
//     update(d => {
//       const sheet = d.tilesheets[d.currentTilesheet];
//       const payload = region
//         ? extractRegionFromTilesheet(sheet.tiles, region, indexToRowCol)
//         : (cell ? extractSingleTileFromTilesheet(sheet.tiles, cell, indexToRowCol) : null);
//       if (payload) d.clipboard = payload;
//       return d;
//     });
//   };

//   const handlePaste = (at: Cell) => {
//     if (!s.clipboard || !at) return;
//     update(d => {
//       d.tilesheets = producePasteIntoTilesheet(
//         d.tilesheets,
//         d.currentTilesheet,
//         d.clipboard!,
//         at,
//         indexToRowCol
//       );
//       return d;
//     });
//   };


//   const handlePasteSpecial = (at: Cell, mode: PasteMode, includeZeroSrc = false) => {
//     if (!s.clipboard || !at) return;
//     update(d => {
//       d.tilesheets = producePasteIntoTilesheet(
//         d.tilesheets,
//         d.currentTilesheet,
//         d.clipboard!,
//         at,
//         indexToRowCol,
//         { mode, includeZeroSrc }
//       );
//       return d;
//     });
// };


//   const handleDelete = (region?: Region, cell?: Cell) => {
//     update(d => {
//       const targetRegion = region ?? (cell ? { startRow: cell.row!, startCol: cell.col!, rows: 1, cols: 1 } : undefined);
//       if (!targetRegion) return d;
//       d.tilesheets = produceDeleteRegionInTilesheet(
//         d.tilesheets, d.currentTilesheet, targetRegion, indexToRowCol
//       );
//       return d;
//     });
//   };

//   const convertUint16ArrayToHexPalettes = (bgrPalettes: Uint16Array): string[][] => {
//     const palettes: string[][] = [];
//     for (let i = 0; i < bgrPalettes.length; i += 16) {
//       const palette: string[] = [];
//       for (let j = 0; j < 16; j++) {
        
//         const bgr555 = bgrPalettes[i + j] & 0x7FFF; // auto-clear bit 15
//         const { r, g, b } = bgr555ToRgb(bgr555);
//         const hexColor = `#${(r & 0xf8).toString(16).padStart(2, "0")}${(g & 0xf8).toString(16).padStart(2, "0")}${(b & 0xf8).toString(16).padStart(2, "0")}`;

//         palette.push(hexColor);
//       }
//       palettes.push(palette);
//     }
//     return palettes;
//   }

//   const convertUint16ArrayToBGR555Palettes = (bgrPalettes: Uint16Array): string[][] => {
//     const palettes: string[][] = [];
//     for (let i = 0; i < bgrPalettes.length; i += 16) {
//       const palette: string[] = [];
//       for (let j = 0; j < 16; j++) {
        
//         const bgr555 = bgrPalettes[i + j] & 0x7FFF; // auto-clear bit 15
//         const hexColor = bgr555.toString(16).padStart(4, "0");

//         palette.push(hexColor);
//       }
//       palettes.push(palette);
//     }
//     return palettes;
//   }

//   // ---------- Drawer / Menu ----------
//   const onPick = useCallback((node: MenuNode) => {
//     console.log("Picked menu node", node);

//     if(node.id === "pal-load-full") {
//       importAllPalettes(true, (palettes)=> {
//         if(palettes) {
//           update(d => {

//             d.palettes = convertUint16ArrayToHexPalettes(palettes);
//             d.bgrPalettes = convertUint16ArrayToBGR555Palettes(palettes);

//             return d;
//           });
//         }
//       });
//     } else if(node.id ===  "pal-save-full") {
//       saveBGR555Palettes(`${s.exportPrefixes?.palette ?? "default_"}full.pal`,  s.bgrPalettes, true);
//     } else if(node.id ===  "pal-save-cur-full") {
//       saveBGR555Palette(`${s.exportPrefixes?.palette ?? "default_"}${s.currentPalette}.pal`, s.bgrPalettes[s.currentPalette], true);
//     } else if(node.id === "sprite") {
//       mutate(d=>{
//           if (d.selectedTileCell) d.showSpriteEditor = true;
//           return d;
//       });
//     } else if(node.id === "settings"){
//       setShowSettings(true);
//     } else if(node.id === "pal-load-16") {
//       importSinglePalette(true, (palette)=> {
//         if(palette) {
//           update(d => {
//             const filtered = d.palettes.filter((_, i) => i !== d.currentPalette);
//             filtered.splice(d.currentPalette, 0, convertUint16ArrayToHexPalettes(palette)[0])
//             const filteredBgr = d.bgrPalettes.filter((_, i) => i !== d.currentPalette);
//             filteredBgr.splice(d.currentPalette, 0, convertUint16ArrayToBGR555Palettes(palette)[0]);

//             d.palettes = [...filtered];
//             d.bgrPalettes = [...filteredBgr];
//             return d;
//           });
//         }
//       });
//     }

//     mutate(d => (d.drawerOpen = false, d));

//   }, [mutate, s.bgrPalettes, s.exportPrefixes, s.currentPalette, update]);

//   // ---------- Palette view ----------
//   const paletteView = useMemo(
//     () => (
//             <div className="flex flex-col gap-2">

//     {s.palettes.map((pal, palIndex) => (

//       <div key={palIndex} className="flex flex-row">
//         {pal.map((hex, i) => (
//           <button
//             key={i}
//             onClick={() => update(d => { d.currentColor = i; d.currentPalette = palIndex; return d; })}
//             className={`select-none h-6 w-6 rounded-sm border border-white-900 ${hydrated && s.currentPalette === palIndex && s.currentColor === i ? "ring-1 ring-offset-1 ring-yellow-500" : ""}`}
//             style={{ background: hex }}
//             title={`Index ${i}`}
//           />
//         ))}
//       </div>
//     ))}
//     </div>),
//     [s.palettes, s.currentPalette, s.currentColor, update]
//   );

//   const currentPalleteIndex = useMemo(() => {
//     if(s.palettes.length === 0) return 0;
//     return Math.min(s.currentPalette, s.palettes.length - 1);
//   }, [s.palettes, s.currentPalette]);

//   const currentPalette = useMemo(() => {
//     if(s.palettes.length === 0) return [];
//     return s.palettes[currentPalleteIndex];
//   }, [s.palettes, currentPalleteIndex]); 

  

//   // ---------- Mouse interactions for pixel painting ----------
//   const onCellDown = (x: number, y: number) => (e: React.MouseEvent) => {
//     e.preventDefault();

//     isStrokingRef.current = true;
//     checkpoint();

//     if (e.button === 2 || e.buttons === 2) {
//       setPixel(x, y, 0);
//       return;
//     }
//     if (s.tool === "picker") {
//       mutate(d => { d.currentColor = tile[y][x]; return d; });
//     } else if (s.tool === "eraser") {
//       setPixel(x, y, 0);
//     } else if (s.tool === "fill") {
//       floodFill(x, y, tile[y][x], s.currentColor);
//     } else {
//       setPixel(x, y, s.currentColor);
//     }
//   };
//   const onCellMove = (x: number, y: number) => (e: React.MouseEvent) => {
//     if(!isStrokingRef.current) return;
//     if (e.buttons !== 1) return;
//     if (s.tool === "brush") setPixel(x, y, s.currentColor);
//     if (s.tool === "eraser") setPixel(x, y, 0);
//   };

//   const stopStroke = () => { isStrokingRef.current = false; };
//   //const stopStroke = () => {/* no global state needed now */};

//   const selectedTiles = useMemo<SelectedTiles | undefined>(() => {
//     // Prefer a selected region
//     if (s.selectedTileRegion) {
//       const r = s.selectedTileRegion;
//       // Build a rows x cols grid of tile indices from the tilesheet
//       const grid: number[][] = [];
//       for (let y = 0; y < r.rows; y++) {
//         const row: number[] = [];
//         for (let x = 0; x < r.cols; x++) {
//           row.push(tileIndex(r.startRow + y, r.startCol + x));
//         }
//         grid.push(row);
//       }
//       return {
//         tilesheetIndex: s.currentTilesheet,
//         paletteIndex: s.currentPalette,
//         tileIndices: grid,
//         opacity: 0.3, // nice for preview; tweak as you like
//       };
//     }

//     // Else, a single selected cell (1x1)
//     if (s.selectedTileCell) {
//       const idx = tileIndex(s.selectedTileCell.row ?? 0, s.selectedTileCell.col ?? 0);
//       return {
//         tilesheetIndex: s.currentTilesheet,
//         paletteIndex: s.currentPalette,
//         tileIndices: [[idx]],
//         opacity: 0.9,
//       };
//     }

//     // Nothing selected → no preview block
//     return undefined;
//   }, [s.selectedTileRegion, s.selectedTileCell, s.currentTilesheet, s.currentPalette]);  
//   // ---------- Render ----------
//   return (
//     <Fragment>
//       <div className="min-h-screen">
//         {/* Header / AppBar */}
//         <header className="sticky top-0 z-30 border-b border-slate-200">
//           <div className="flex items-center gap-3 px-4 py-3">
//             <StyledButton className="cursor-pointer" width={24} onClick={() => mutate(d => (d.drawerOpen = true, d))}>
//               <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75">
//                 <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
//               </svg>
//             </StyledButton>

//             <h1 className="text-2xl font-bold">SNES Sprite Editor (4bpp, 8×8 tiles)</h1>

//             <div className="ml-auto flex gap-2">
//               <StyledButton width={28} onClick={undo} disabled={!canUndo}>Undo</StyledButton>
//               <StyledButton width={28} onClick={redo} disabled={!canRedo}>Redo</StyledButton>
//             </div>
//           </div>
//         </header>

//         {/* Drawer */}
//         <LeftDrawer
//           open={s.drawerOpen}
//           onClose={() => mutate(d => (d.drawerOpen = false, d))}
//           widthClass="w-64"
//           persistentLg={false}
//           ariaLabel="SNES tools navigation"
//         >
//           <div className="lg:hidden flex justify-end p-2 border-b border-slate-200">
//             <button
//               onClick={() => mutate(d => (d.drawerOpen = false, d))}
//               className="inline-flex items-center justify-center h-8 w-8 rounded-md"
//               aria-label="Close navigation"
//             >
//               <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75">
//                 <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6l-12 12" />
//               </svg>
//             </button>
//           </div>
//           <DrawerMenu tree={menuTree} onPick={onPick} accordion />
//         </LeftDrawer>

//         <main className="mt-2">
//           <div className="mx-auto w-full">
//             <div className="flex flex-row gap-5 justify-center">

//               {/* Metasprite Editor column */}
//               <div className="flex flex-col gap-1">
//                 <div className="flex flex-row justify-between items-center">
//                   <span className="text-sm font-bold">Metasprite Editor</span>

//                   <div className="relative">
//                     <select
//                       value={s.currentMetasprite}
//                       onChange={e => update(d => (d.currentMetasprite = parseInt(e.target.value), d))}
//                       className="w-full select-none bg-white text-slate-700 text-sm border border-slate-200 rounded pl-3 pr-8 py-1 focus:outline-none focus:border-slate-400 hover:border-slate-400 shadow-sm appearance-none cursor-pointer">
//                       {s.metasprites.map((ms, i) => (
//                         <option key={i} value={i}>{ms.name}</option>
//                       ))}
//                     </select>
//                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
//                          strokeWidth="1.2" stroke="currentColor"
//                          className="h-5 w-5 ml-1 absolute top-1.5 right-1.5 text-slate-700">
//                       <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15 12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
//                     </svg>
//                   </div>
//                 </div>

//                 <div className="flex flex-col">
//                   <div className="flex flex-row p-1 rounded-lg border-2 border-blue-400 bg-transparent w-full overflow-hidden">
//                     <div className="grid grid-cols-[365px_minmax(0,1fr)] gap-1 items-stretch min-h-0">

//                       {/* Right rail: sprites list */}
//                       <aside className="flex flex-col overflow-hidden gap-1">
//                         <div className="flex justify-between items-center">
//                           <span className="text-sm font-medium">
//                             Sprites ({currentMetaSpriteEntries.length})
//                           </span>
//                             <div className="flex flex-row gap-1">
//                               <ChevronButton title="Flip Horizontal" onClick={flipHorizontal} direction="flip-horizontal" />
//                               <ChevronButton title="Flip Vertical" onClick={flipVertical}  direction="flip-vertical"/>
//                               <ChevronButton title="Shift Left"  direction="left"  onClick={() => shiftMetaSprite(-1, 0)} />
//                               <ChevronButton title="Shift Right" direction="right" onClick={() => shiftMetaSprite(1, 0)} />
//                               <ChevronButton title="Shift Up"    direction="up"    onClick={() => shiftMetaSprite(0, -1)} />
//                               <ChevronButton title="Shift Down"  direction="down"  onClick={() => shiftMetaSprite(0, 1)} />
//                               <ChevronButton title="Rotate CCW"  direction="rotate-ccw" onClick={rotateMetaSpriteCCW} />
//                               <ChevronButton title="Rotate CW"   direction="rotate-cw"  onClick={rotateMetaSpriteCW} />
//                             </div>
//                         </div>
//                         <div className="flex">
//                           <SelectList
//                             className="w-full"
//                             maxHeight={452}             // rail controls height; container scrolls
//                             minHeight={452}
//                             options={options}
//                             values={s.selectedIds}
//                             onChange={(ids) => update(d => (d.selectedIds = ids, d))}
//                             onDeleteItem={(id) => {
//                               update(d => {
//                                 const ms = d.metasprites[d.currentMetasprite];
//                                 ms.entries = ms.entries.filter(e => e.id !== id);
//                                 d.selectedIds = d.selectedIds.filter(x => x !== id);
//                                 return d;
//                               });
//                             }}
//                             onDrop={(fromIndex, toIndex) => {
//                               update(d => {
//                                 const ms = d.metasprites[d.currentMetasprite];
//                                 ms.entries = moveItem(ms.entries, fromIndex, toIndex);
//                                 return d;
//                               });
//                             }}
//                             onDropMulti={(fromIndices, insertBeforeIndex) => {
//                               update(d => {
//                                 const arr = d.metasprites[d.currentMetasprite].entries;
//                                 const order = [...fromIndices].sort((a, b) => a - b);
//                                 const picked = order.map(i => arr[i]);
//                                 const remaining = arr.filter((_, idx) => !order.includes(idx));
//                                 const insertAt = Math.max(0, Math.min(insertBeforeIndex, remaining.length));
//                                 d.metasprites[d.currentMetasprite].entries = [
//                                   ...remaining.slice(0, insertAt),
//                                   ...picked,
//                                   ...remaining.slice(insertAt),
//                                 ];
//                                 return d;
//                               });
//                             }}
//                           />
//                         </div>
//                           <div className="flex justify-center gap-[6px] items-center mt-1 ml-1 mr-2">
//                             <StyledButton width={35} className="h-6" onClick={clearSelected}>
//                               Clear Selected
//                             </StyledButton>
//                             <StyledButton width={35} className="h-6" onClick={deleteSelected}>
//                               Delete Selected
//                             </StyledButton>
//                             <StyledButton width={35} className="h-6" onClick={deleteAll}>
//                               Delete All
//                             </StyledButton>
//                           </div>

//                       </aside>
//                       <div className="min-w-0 min-h-0 overflow-auto">
//                       {/* Canvas */}
//                       <MetaSpriteEditor
//                         entries={currentMetaSpriteEntries}
//                         tilesheets={s.tilesheets}
//                         drawGrid={s.drawGrid}
//                         selectedTiles={selectedTiles}
//                         selectedRegion={s.selectedTileRegion}
//                         palettes={s.palettes}
//                         highlightSelected={s.highlightSelected}
//                         selected={selectedEntries}
//                         onClick={updateMetasprite}
//                         transparentIndex0={s.showIndex0Transparency}
//                       />
//                       </div>

//                     </div>
//                   </div>
//                 </div>


//                 <div className="flex flex-col">
//                   <div className="flex flex-row justify-between items-center">
//                   <div className="text-sm font-bold">Palette</div>
//                   <div className="text-xs">Selected Palette ({s.currentPalette})</div>
//                   </div>
//                   <div className="flex flex-row gap-5 mt-1 justify-start rounded-lg border-2 border-blue-400 p-1">

//                     {paletteView}

//                     <div className="flex flex-col">
//                         <div className="flex flex-row gap-5">
//                           <div className="flex">
//                             <ColorPicker555
//                               value={s.palettes[s.currentPalette][s.currentColor]}
//                               onColorChange={onColorPickerChange}
//                             />
//                           </div>
//                           <div className="flex flex-row items-center gap-2">
//                             <label>HEX</label>
//                             <input
//                               type="text"
//                               placeholder="0000"
//                               value={s.bgrPalettes[s.currentPalette][s.currentColor]}
//                               onChange={handleBGRChange}
//                               className="w-28 border rounded px-2 py-1 font-mono text-sm uppercase tracking-widest"
//                               title="Enter 4 hex digits (bit15 auto-cleared)"
//                             />
//                             <span className="text-xs text-slate-500">(BGR555)</span>
//                           </div>
//                         </div>

//                         <div className="flex flex-row mt-1 justify-between w-full">
//                           <ColorChannelInput label="B" value={currentBlue} onChange={handleChannel("b")} />
//                           <ColorChannelInput label="G" value={currentGreen} onChange={handleChannel("g")} />
//                           <ColorChannelInput label="R" value={currentRed} onChange={handleChannel("r")} />
//                         </div>  
//                       </div>            
//                   </div>                
//                 </div>
//             </div>

//               {/* Tilesheet column */}
//               <div className="flex">
//                 <div className="flex flex-col gap-1">
//                   <div className="flex flex-row justify-between w-full items-center">
//                     <span className="text-sm font-bold">Tilesheet</span>
//                     <div className="relative">
//                       <select
//                         value={s.currentTilesheet}
//                         onChange={e => update(d => (d.currentTilesheet = parseInt(e.target.value), d))}
//                         className="w-full select-none bg-white text-slate-700 text-sm border border-slate-200 rounded pl-3 pr-8 py-1 focus:outline-none focus:border-slate-400 hover:border-slate-400 shadow-sm appearance-none cursor-pointer">
//                         <option value="0">Tilesheet 0</option>
//                         <option value="1">Tilesheet 1</option>
//                       </select>
//                       <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
//                            strokeWidth="1.2" stroke="currentColor"
//                            className="h-5 w-5 ml-1 absolute top-1.5 right-1.5 text-slate-700">
//                         <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15 12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
//                       </svg>
//                     </div>
//                   </div>

//                   <div className="flex flex-col">
//                     <div className="mb-2 p-1 rounded-lg border-2 border-blue-400 bg-transparent">
//                       <Tilesheet
//                         tiles={currentTiles}
//                         palette={s.palettes[s.currentPalette]}
//                         selected={s.selectedTileCell}
//                         selectedRegion={s.selectedTileRegion}
//                         transparentIndex0={s.showIndex0Transparency}
//                         onSelected={selectTile}
//                         onRegionSelected={region => update(d => (d.selectedTileRegion = region, d))}
//                         onCopy={({ cell, region }) => handleCopy(region, cell ?? undefined)}
//                         onPaste={({ at }) => handlePaste(at)}
//                         onPasteSpecial={({ at, mode }) => handlePasteSpecial(at, mode)}
//                         onDelete={({ cell, region }) => handleDelete(region, cell ?? undefined)}
//                         canCopy={({ cell, region }) => !!(region || cell)}
//                         canPaste={() => s.clipboard !== null}
//                       />
//                     </div>
//                     <div className="flex justify-end">
//                       {hydrated && s.selectedTileCell &&(
//                         <span className="text-xs">
//                           Selected Tile: {tileIndex(s.selectedTileCell?.row ?? 0, s.selectedTileCell?.col ?? 0)}
//                         </span>
//                       )}
//                     </div>
//                   </div>
//                 </div>
//               </div>
//             </div>
//           </div>
//         </main>
//       </div>

//       <Modal isOpen={showSettings} title="Settings" 
//         draggable 
//         closeOnBackdropClick 
//         closeOnEsc 
//         onClose={(reason) =>
//           setShowSettings(false)
//         }
//       >
//         <div className="text-black max-w-xl">
//           <EditorSettingsBridgeMutable
//             doc={s}
//             setDoc={update} // single source of truth
//             className="space-y-6"
//           />
//         </div>      
//       </Modal>

//       {/* Tile Editor window */}
//       <DraggableWindow
//         className="text-slate-700"
//         title="Tile Editor"
//         open={s.showSpriteEditor}
//         onClose={() => update(d => (d.showSpriteEditor = false, d))}
//       >
//         <div className="flex flex-col">
//           <div className="flex flex-row gap-2">
//             <div className="select-none w-fit" onMouseUp={stopStroke} onMouseLeave={stopStroke}>
//               <div
//                 className="inline-grid"
//                 style={{ gridTemplateColumns: `repeat(${TILE_W}, ${TILE_EDITOR_SCALE}px)`, gridTemplateRows: `repeat(${TILE_H}, ${TILE_EDITOR_SCALE}px)` }}
//               >
//                 {tile.map((row, y) =>
//                   row.map((pix, x) => { 
                    
//                     const style =
//                       s.showIndex0Transparency && pix === 0
//                         ? checkerboardStyle() // implied transparency
//                         : { background: s.palettes[s.currentPalette][pix] ?? "#000" };
                        
//                     const borderColor = 
//                       s.showIndex0Transparency ? "border-yellow-200" 
//                       : "boarder-slate-300";

//                     return (
//                     <div
//                       key={`${x}-${y}`}
//                       onMouseDown={onCellDown(x, y)}
//                       onMouseMove={onCellMove(x, y)}
//                       className={`border ${borderColor} hover:brightness-95`}
//                       style={style}
//                       title={`(${x},${y}) → ${pix}`}
//                     />
//                   )})
//                 )}
//               </div>
//             </div>

//             <div className="flex flex-col justify-between h-[256px]">
//               {(["brush", "fill", "picker", "eraser"] as const).map(t => (
//                 <button
//                   key={t}
//                   onClick={() => update(d => (d.tool = t, d))}
//                   className={`p-1 rounded-md w-[48px] h-[48px] text-lg ${s.tool === t ? "bg-blue-600 text-white" : "bg-transparent hover:bg-slate-100"}`}
//                 >
//                   <FontAwesomeIcon icon={toolIcon[t]} />
//                 </button>
//               ))}
//             </div>
//           </div>

//           <div className="flex flex-col gap-1 select-none">
//             <div className="text-md text-[#222222]">Shift Pixels&nbsp;
//               <button title="Shift up" className="p-1 rounded-md hover:bg-blue-100 active:bg-blue-200"
//                       onClick={() => transformTile(src => shiftTile(src, 0, -1))}>
//                 <FontAwesomeIcon className="text-[#333333]" icon={faArrowUp} />
//               </button>,
//               <button title="Shift down" className="p-1 rounded-md hover:bg-blue-100 active:bg-blue-200"
//                       onClick={() => transformTile(src => shiftTile(src, 0, 1))}>
//                 <FontAwesomeIcon className="text-[#333333]" icon={faArrowDown} />
//               </button>,
//               <button title="Shift left" className="p-1 rounded-md hover:bg-blue-100 active:bg-blue-200"
//                       onClick={() => transformTile(src => shiftTile(src, -1, 0))}>
//                 <FontAwesomeIcon className="text-[#333333]" icon={faArrowLeft} />
//               </button>,
//               <button title="Shift right" className="p-1 rounded-md hover:bg-blue-100 active:bg-blue-200" onClick={() => transformTile(src => shiftTile(src, 1, 0))}>
//                 <FontAwesomeIcon className="text-[#333333]" icon={faArrowRight} />
//               </button>
//             </div>
//           </div>

//           <div className="flex flex-col gap-1 select-none">
//             <div className="text-md text-[#222222]">Rotate&nbsp;
//               <button onClick={rotateTileCCW} className="p-1 rounded-md hover:bg-blue-100 active:bg-blue-200" title="Rotate Left (90° CCW)">
//                 <FontAwesomeIcon className="text-[#333333]" icon={faRotateBackward} />
//               </button>,
//               <button onClick={rotateTileCW} className="p-1 rounded-md hover:bg-blue-100 active:bg-blue-200" title="Rotate Right (90° CW)">
//                 <FontAwesomeIcon className="text-[#333333]" icon={faRotateForward} />
//               </button>
//             </div>
//           </div>

//           <div className="flex flex-col gap-1 select-none">
//             <div className="text-md text-[#222222]">Flip&nbsp;
//               <button onClick={flipTileH} className="p-1 rounded-md hover:bg-blue-100 active:bg-blue-200" title="Flip Horizontal">
//                 <FontAwesomeIcon className="text-[#333333]" icon={faArrowsLeftRight} />
//               </button>,
//               <button onClick={flipTileV} className="p-1 rounded-md hover:bg-blue-100 active:bg-blue-200" title="Flip Vertical">
//                 <FontAwesomeIcon className="text-[#333333]" icon={faArrowsUpDown} />
//               </button>
//             </div>
//           </div>
//         </div>
//       </DraggableWindow>
//     </Fragment>
//   );
// }

