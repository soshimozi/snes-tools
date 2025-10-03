"use client";

import React, { Fragment, useCallback, useEffect, useMemo } from "react";
import { DraggableWindow } from "./DraggableWindow";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowDown, faArrowLeft, faArrowRight, faArrowsLeftRight, faArrowsUpDown,
  faArrowUp, faEraser, faEyeDropper, faFillDrip, faPaintBrush, faRotateBackward, faRotateForward
} from "@fortawesome/free-solid-svg-icons";

import {
  Cell, Metasprite, MetaSpriteEntry, Palette, Region, Sheet, Tile, Tool, TileRegionPayload
} from "@/types/EditorTypes";

import { v4 as uuid } from "uuid";
import { SelectList } from "./SingleSelectList";
import { MetaSpriteEditor } from "./MetaSpriteEditor";
import { Tilesheet } from "./Tilesheet";

import {
  extractRegionFromTilesheet,
  extractSingleTileFromTilesheet,
  indexToRowCol,
  makeBlankTile,
  makeTiles,
  moveItem,
  parseHexColor,
  produceDeleteRegionInTilesheet,
  producePasteIntoTilesheet,
  savePalettes,
  tileIndex
} from "@/Helpers";

import { SCALE, TILE_H, TILE_W } from "@/app/constants";
import { ChevronButton } from "./ChevronButton";
import ColorPicker555 from "./ColorPicker555";
import StyledButton from "./StyledButton";
import StyledCheckbox from "./StyledCheckbox";
import { LeftDrawer } from "./LeftDrawer";
import { menuTree, type MenuNode } from "./Menu";
import { DrawerMenu } from "./DrawerMenu";

import { useUndoableState } from "@/hooks/useUndoableState";
import { buildInitialDoc } from "@/state/buildInitialDoc";
import { EditorDoc, toolIcon } from "@/state/EditorDoc";

const STORAGE_KEY = "snes-editor@v1";
const TILE_EDITOR_SCALE = 48;

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

  const isStrokingRef = React.useRef(false);

  // --- Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) { e.preventDefault(); if (canUndo) undo(); }
      else if (k === "z" && e.shiftKey) { e.preventDefault(); if (canRedo) redo(); }
      else if (k === "y") { e.preventDefault(); if (canRedo) redo(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, canUndo, canRedo]);

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
          `Tile: ${entry.tileIndex}, Sheet: ${entry.tileSheetIndex}, Palette: ${entry.paletteIndex}, x: ${entry.x}, y: ${entry.y}, h: ${entry.h ? 1 : 0}, v: ${entry.v ? 1 : 0}, r: ${entry.r}`,
        ],
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

  // ---------- Painting ops ----------
  const setPixel = useCallback((x: number, y: number, value: number) => {
    mutate(d => {
      const sheet = d.tilesheets[d.currentTilesheet];
      const nextTiles = sheet.tiles.map(t => t.map(row => row.slice()));
      nextTiles[d.currentTile][y][x] = value & 0xF;
      sheet.tiles = nextTiles;
      return d;
    });
  }, [mutate]);

  const floodFill = useCallback((x: number, y: number, _target: number | undefined, replacementRaw: number) => {
    update(d => {
      const ts = d.currentTilesheet, tIdx = d.currentTile;
      const replacement = replacementRaw & 0xF;
      const width = TILE_W, height = TILE_H;

      const next = d.tilesheets[ts].tiles.map(t => t.map(r => r.slice()));
      if (x < 0 || y < 0 || x >= width || y >= height) return d;

      const target = next[tIdx][y][x] & 0xF;
      if (target === replacement) return d;

      const stack: [number, number][] = [[x, y]];
      const seen = new Set<string>();

      while (stack.length) {
        const [cx, cy] = stack.pop()!;
        if (cx < 0 || cy < 0 || cx >= width || cy >= height) continue;
        const key = `${cx},${cy}`;
        if (seen.has(key)) continue;
        if ((next[tIdx][cy][cx] & 0xF) !== target) continue;
        seen.add(key);
        next[tIdx][cy][cx] = replacement;
        stack.push([cx+1,cy], [cx-1,cy], [cx,cy+1], [cx,cy-1]);
      }

      d.tilesheets[ts].tiles = next;
      return d;
    });
  }, [update]);

  const transformTile = useCallback((fn: (src: Tile) => Tile) => {
    update(d => {
      const ts = d.currentTilesheet, tIdx = d.currentTile;
      const next = d.tilesheets[ts].tiles.map(t => t.map(r => r.slice()));
      next[tIdx] = fn(next[tIdx]);
      d.tilesheets[ts].tiles = next;
      return d;
    });
  }, [update]);

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
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) out[y][x] = src[7 - x][y];
    return out;
  });
  const rotateTileCCW = () => transformTile((src) => {
    const out = makeBlankTile();
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) out[y][x] = src[x][7 - y];
    return out;
  });

  const shiftTile = (src: Tile, dx: number, dy: number) => {
    const wrap8 = (n: number) => (((n % 8) + 8) % 8);
    const out = makeBlankTile();
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const nx = wrap8(x + dx), ny = wrap8(y + dy);
      out[ny][nx] = src[y][x];
    }
    return out;
  };

  // ---------- Metasprite ops ----------
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
              tileIndex: tileIndex(reg.row + y, reg.col + x),
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

  const handleDelete = (region?: Region, cell?: Cell) => {
    update(d => {
      const targetRegion = region ?? (cell ? { row: cell.row!, col: cell.col!, rows: 1, cols: 1 } : undefined);
      if (!targetRegion) return d;
      d.tilesheets = produceDeleteRegionInTilesheet(
        d.tilesheets, d.currentTilesheet, targetRegion, indexToRowCol
      );
      return d;
    });
  };

  // ---------- Drawer / Menu ----------
  const onPick = useCallback((node: MenuNode) => {
    update(d => {
      switch (node.id) {
        case "sprite":
          if (d.selectedTileCell) d.showSpriteEditor = true;
          break;
        case "tiles":
        case "palette":
        case "settings":
          /* no-op placeholder */
          break;
        case "meta-export":
          /* open export modal */
          break;
        case "pal-save-full":
          savePalettes("default.pal", d.palettes, true);
          break;
      }
      d.drawerOpen = false;
      return d;
    });
  }, [update]);

  // ---------- Palette view ----------
  const paletteView = useMemo(
    () => s.palettes.map((pal, palIndex) => (
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
    )),
    [s.palettes, s.currentPalette, s.currentColor, update]
  );

  // ---------- Mouse interactions for pixel painting ----------
  const onCellDown = (x: number, y: number) => (e: React.MouseEvent) => {
    e.preventDefault();

    isStrokingRef.current = true;
    checkpoint();

    if (e.button === 2 || e.buttons === 2) {
      setPixel(x, y, 0);
      return;
    }
    if (s.tool === "picker") {
      mutate(d => { d.currentColor = tile[y][x]; return d; });
    } else if (s.tool === "eraser") {
      setPixel(x, y, 0);
    } else if (s.tool === "fill") {
      floodFill(x, y, tile[y][x], s.currentColor);
    } else {
      setPixel(x, y, s.currentColor);
    }
  };
  const onCellMove = (x: number, y: number) => (e: React.MouseEvent) => {
    if(!isStrokingRef.current) return;
    if (e.buttons !== 1) return;
    if (s.tool === "brush") setPixel(x, y, s.currentColor);
    if (s.tool === "eraser") setPixel(x, y, 0);
  };

  const stopStroke = () => { isStrokingRef.current = false; };
  //const stopStroke = () => {/* no global state needed now */};

  // ---------- Render ----------
  return (
    <Fragment>
      <div className="min-h-screen">
        {/* Header / AppBar */}
        <header className="sticky top-0 z-30 border-b border-slate-200">
          <div className="flex items-center gap-3 px-4 py-3">
            <StyledButton className="cursor-pointer" width={24} onClick={() => update(d => (d.drawerOpen = true, d))}>
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
          onClose={() => update(d => (d.drawerOpen = false, d))}
          widthClass="w-64"
          persistentLg={false}
          ariaLabel="SNES tools navigation"
        >
          <div className="lg:hidden flex justify-end p-2 border-b border-slate-200">
            <button
              onClick={() => update(d => (d.drawerOpen = false, d))}
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
            <div className="flex flex-row gap-10 justify-center">

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
                  <div className="mb-2 p-1 rounded-lg border-2 border-blue-400 bg-transparent">
                    <MetaSpriteEditor
                      entries={currentMetaSpriteEntries}
                      tilesheets={s.tilesheets}
                      drawGrid={s.drawGrid}
                      palettes={s.palettes}
                      highlightSelected={s.highlightSelected}
                      selected={selectedEntries[0]}
                      onClick={updateMetasprite}
                    />
                  </div>

                  <div className="flex flex-row gap-10">
                    <div className="flex flex-col">
                      <div className="flex mb-2 ml-1">
                        <div className="flex flex-row gap-4">
                          <div className="flex flex-row gap-2">
                            <div className="w-fit h-fit select-none">
                              <StyledCheckbox
                                checked={s.highlightSelected}
                                onChange={e => update(d => (d.highlightSelected = e.target.checked, d))}
                              />
                            </div>
                            <label>Highlight selected sprite</label>
                          </div>
                          <div className="flex flex-row gap-2">
                            <div className="w-fit h-fit select-none">
                              <StyledCheckbox
                                checked={s.drawGrid}
                                onChange={e => update(d => (d.drawGrid = e.target.checked, d))}
                              />
                            </div>
                            <label>Draw Grid</label>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-between w-full items-center">
                        <div className="flex flex-row gap-2 items-center">
                          <StyledButton width={25} onClick={flipHorizontal}>H Flip</StyledButton>
                          <StyledButton width={25} onClick={flipVertical}>V Flip</StyledButton>

                          <ChevronButton title="Shift Left"  direction="left"  onClick={() => shiftMetaSprite(-1, 0)} />
                          <ChevronButton title="Shift Right" direction="right" onClick={() => shiftMetaSprite(1, 0)} />
                          <ChevronButton title="Shift Up"    direction="up"    onClick={() => shiftMetaSprite(0, -1)} />
                          <ChevronButton title="Shift Down"  direction="down"  onClick={() => shiftMetaSprite(0, 1)} />
                          <ChevronButton title="Rotate CCW"  direction="rotate-ccw" onClick={rotateMetaSpriteCCW} />
                          <ChevronButton title="Rotate CW"   direction="rotate-cw"  onClick={rotateMetaSpriteCW} />
                        </div>
                      </div>

                      <div className="flex flex-col w-130 gap-1">
                        <div className="flex flex-row justify-between items-center">
                          <span className="mt-1 text-sm">List of Sprites {currentMetaSpriteEntries.length}</span>
                          <StyledButton width={35} className="h-5" onClick={deleteAll}>Clear</StyledButton>
                        </div>

                        <SelectList
                          maxHeight={200}
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
                          options={options}
                          values={s.selectedIds}
                          onDeleteItem={(id) => {
                            update(d => {
                              const ms = d.metasprites[d.currentMetasprite];
                              ms.entries = ms.entries.filter(e => e.id !== id);
                              d.selectedIds = d.selectedIds.filter(x => x !== id);
                              return d;
                            });
                          }}
                          onChange={(ids) => update(d => (d.selectedIds = ids, d))}
                        />
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
                        onSelected={selectTile}
                        onRegionSelected={region => update(d => (d.selectedTileRegion = region, d))}
                        onCopy={({ cell, region }) => handleCopy(region, cell ?? undefined)}
                        onPaste={({ at }) => handlePaste(at)}
                        onDelete={({ cell, region }) => handleDelete(region, cell ?? undefined)}
                        canCopy={({ cell, region }) => !!(region || cell)}
                        canPaste={() => s.clipboard !== null}
                      />
                    </div>
                    <div className="flex justify-end">
                      {hydrated && s.selectedTileCell &&(
                        <span className="text-xs">
                          Selected Tile: {tileIndex(s.selectedTileCell.row, s.selectedTileCell.col)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Palette column */}
              <div className="flex flex-col w-fit">
                <div className="flex flex-col gap-1">
                  <div className="flex flex-row justify-between items-center">
                    <span className="text-sm font-bold">Palette Editor</span>
                    <div className="relative">
                      <select
                        value={s.currentPalette}
                        onChange={e => update(d => (d.currentPalette = parseInt(e.target.value), d))}
                        className="w-full select-none bg-white text-slate-700 text-sm border border-slate-200 rounded pl-3 pr-8 py-1 focus:outline-none focus:border-slate-400 hover:border-slate-400 shadow-sm appearance-none cursor-pointer">
                        {s.palettes.map((_, i) => (
                          <option key={i} value={i}>{`Palette ${i.toString().padStart(2, "0")}`}</option>
                        ))}
                      </select>
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                           strokeWidth="1.2" stroke="currentColor"
                           className="h-5 w-5 ml-1 absolute top-1.5 right-1.5 text-slate-700">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15 12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
                      </svg>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">{paletteView}</div>

                  <div className="flex flex-row justify-between">
                    <div className="flex mt-4">
                      <ColorPicker555
                        value={s.palettes[s.currentPalette][s.currentColor]}
                        onColorChange={onColorPickerChange}
                      />
                    </div>
                    <div className="flex mt-4 flex-row items-center gap-2">
                      <label>HEX</label>
                      <input
                        type="text"
                        placeholder="0000"
                        value={s.bgrPalettes[s.currentPalette][s.currentColor]}
                        onChange={handleBGRChange}
                        className="w-28 border rounded px-2 py-1 font-mono text-sm uppercase tracking-widest"
                        title="Enter 4 hex digits (bit15 auto-cleared)"
                      />
                    </div>
                  </div>

                  <div className="flex flex-row mt-1 justify-between w-full">
                    <ChannelControl label="R" value={currentRed} onChange={handleChannel("r")} />
                    <ChannelControl label="G" value={currentGreen} onChange={handleChannel("g")} />
                    <ChannelControl label="B" value={currentBlue} onChange={handleChannel("b")} />
                  </div>
                </div>
              </div>

            </div>
          </div>
        </main>
      </div>

      {/* Tile Editor window */}
      <DraggableWindow
        className="text-slate-700"
        title="Tile Editor"
        open={s.showSpriteEditor}
        onClose={() => update(d => (d.showSpriteEditor = false, d))}
      >
        <div className="flex flex-col">
          <div className="flex flex-row gap-2">
            <div className="select-none w-fit" onMouseUp={stopStroke} onMouseLeave={stopStroke}>
              <div
                className="inline-grid"
                style={{ gridTemplateColumns: `repeat(${TILE_W}, ${TILE_EDITOR_SCALE}px)`, gridTemplateRows: `repeat(${TILE_H}, ${TILE_EDITOR_SCALE}px)` }}
              >
                {tile.map((row, y) =>
                  row.map((pix, x) => (
                    <div
                      key={`${x}-${y}`}
                      onMouseDown={onCellDown(x, y)}
                      onMouseMove={onCellMove(x, y)}
                      className="border border-slate-300 hover:brightness-95"
                      style={{ background: s.palettes[s.currentPalette][pix] ?? "#000" }}
                      title={`(${x},${y}) → ${pix}`}
                    />
                  ))
                )}
              </div>
            </div>

            <div className="flex flex-col justify-between h-[256px]">
              {(["brush", "fill", "picker", "eraser"] as const).map(t => (
                <button
                  key={t}
                  onClick={() => update(d => (d.tool = t, d))}
                  className={`p-1 rounded-md w-[48px] h-[48px] text-lg ${s.tool === t ? "bg-blue-600 text-white" : "bg-transparent hover:bg-slate-100"}`}
                >
                  <FontAwesomeIcon icon={toolIcon[t]} />
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1 select-none">
            <div className="text-xs text-[#222222]">Shift pixels&nbsp;
              <button title="Shift up" className="p-1 rounded-md hover:bg-blue-100 active:bg-blue-200"
                      onClick={() => transformTile(src => shiftTile(src, 0, -1))}>
                <FontAwesomeIcon className="text-xs text-[#333333]" icon={faArrowUp} />
              </button>,
              <button title="Shift down" className="p-1 rounded-md hover:bg-blue-100 active:bg-blue-200"
                      onClick={() => transformTile(src => shiftTile(src, 0, 1))}>
                <FontAwesomeIcon className="text-xs text-[#333333]" icon={faArrowDown} />
              </button>,
              <button title="Shift left" className="p-1 rounded-md hover:bg-blue-100 active:bg-blue-200"
                      onClick={() => transformTile(src => shiftTile(src, -1, 0))}>
                <FontAwesomeIcon className="text-xs text-[#333333]" icon={faArrowLeft} />
              </button>,
              <button title="Shift right" className="p-1 rounded-md hover:bg-blue-100 active:bg-blue-200"
                      onClick={() => transformTile(src => shiftTile(src, 1, 0))}>
                <FontAwesomeIcon className="text-xs text-[#333333]" icon={faArrowRight} />
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1 select-none">
            <div className="text-xs text-[#222222]">Rotate&nbsp;
              <button onClick={rotateTileCCW} className="p-1 rounded-md hover:bg-blue-100 active:bg-blue-200" title="Rotate Left (90° CCW)">
                <FontAwesomeIcon className="text-xs text-[#333333]" icon={faRotateBackward} />
              </button>,
              <button onClick={rotateTileCW} className="p-1 rounded-md hover:bg-blue-100 active:bg-blue-200" title="Rotate Right (90° CW)">
                <FontAwesomeIcon className="text-xs text-[#333333]" icon={faRotateForward} />
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1 select-none">
            <div className="text-xs text-[#222222]">Flip&nbsp;
              <button onClick={flipTileH} className="p-1 rounded-md hover:bg-blue-100 active:bg-blue-200" title="Flip Horizontal">
                <FontAwesomeIcon className="text-xs text-[#333333]" icon={faArrowsLeftRight} />
              </button>,
              <button onClick={flipTileV} className="p-1 rounded-md hover:bg-blue-100 active:bg-blue-200" title="Flip Vertical">
                <FontAwesomeIcon className="text-xs text-[#333333]" icon={faArrowsUpDown} />
              </button>
            </div>
          </div>
        </div>
      </DraggableWindow>
    </Fragment>
  );
}

/* ------- Small UI subcomponent for RGB sliders/inputs ------- */
function ChannelControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="flex flex-col gap-2 w-20 items-center">
      <div className="flex flex-row items-center gap-1">
        <label>{label}</label>
        <input
          type="text"
          placeholder="000"
          value={(value ?? 0).toString().padStart(3, "0")}
          onChange={onChange}
          className="w-14 border rounded px-2 py-1 font-mono text-sm uppercase tracking-widest"
          title={`Enter ${label} Value`}
        />
      </div>
      <div className="flex justify-center">
        <input
          value={value ?? 0}
          max={248}
          onChange={onChange}
          type="range"
          className="w-20 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700
            [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:appearance-none
            [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:bg-blue-600 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:appearance-none"
        />
      </div>
    </div>
  );
}


// "use client"

// import React, { Fragment, useCallback, useEffect, useMemo, useState } from "react";
// import { DraggableWindow } from "./DraggableWindow";
// import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
// import { faArrowDown, faArrowLeft, faArrowRight, faArrowsLeftRight, faArrowsUpDown, 
//           faArrowUp, faEraser, faEyeDropper, faFillDrip, faPaintBrush, faRotateBackward, faRotateForward } from "@fortawesome/free-solid-svg-icons";

// import { Cell, Metasprite, MetaSpriteEntry, Palette, Region, Sheet, Tile, Tool, TileRegionPayload } from "@/types/EditorTypes";
// import { v4 as uuid } from "uuid";
// import { SelectList } from "./SingleSelectList";
// import { MetaSpriteEditor } from "./MetaSpriteEditor";
// import { Tilesheet } from "./Tilesheet";
// import { extractRegionFromTilesheet, extractRegionTiles, extractSingleTile, extractSingleTileFromTilesheet, indexToRowCol, makeBlankTile, makeTiles, moveItem, palettesToBGR555Blob, parseHexColor, produceDeleteRegionInTilesheet, producePasteIntoTilesheet, savePalettes, tileIndex } from "@/Helpers";
// import { SCALE, TILE_H, TILE_W } from "@/app/constants";
// import { ChevronButton } from "./ChevronButton";
// import ColorPicker555 from "./ColorPicker555";
// import StyledButton from "./StyledButton";
// import StyledCheckbox from "./StyledCheckbox";
// import { LeftDrawer } from "./LeftDrawer";
// import { menuTree, type MenuNode } from "./Menu";
// import { DrawerMenu } from "./DrawerMenu";
// import { Palettes } from "@/Palettes";


// const TILE_EDITOR_SCALE = 48;

// export default function SNESpriteEditor() {
//   const [tilesheets, setTilesheets] = useState<Sheet[]>([
//     {
//       tiles: makeTiles()
//     },
//     {
//       tiles: makeTiles()
//     }
//   ]);

//   const [metasprites, setMetaSprites] = useState<Metasprite[]>(() => {
//     const entries : Metasprite[] = [];
//     for(let i = 0; i < 100; i++) {
//       entries.push(
//         {
//           name: `Metasprite ${i.toString().padStart(2, "0")}`,
//           entries: []
//         }
//       )
//     }
//     return entries;
//   })

//   const [currentMetasprite, setCurrentMetasprite] = useState(0);
//   const [currentTilesheet, setCurrentTilesheet] = useState(0);

//   const [currentTile, setCurrentTile] = useState(0);
//   const [currentColor, setCurrentColor] = useState(1);
//   const [tool, setTool] = useState<Tool>({ type: "brush", icon: faFillDrip });
//   const [isMouseDown, setIsMouseDown] = useState(false);
//   const [selectedTileCell, setSelectedTileCell] = useState<Cell | null>(null);
//   const [showSpriteEditor, setShowSpriteEditor] = useState(false);
//   const [highlightSelected, setHighlightSelected] = useState(true);

//   const [selectedIds, setSelectedIds] = useState<string[]>([]);
//   const [drawGrid, setDrawGrid] = useState(true);
//   const [selectedTileRegion, setSelectedTileRegion] = useState<Region | undefined>();
//   const [clipboard, setClipboard] = useState<TileRegionPayload | null>(null);


//   const [drawerOpen, setDrawerOpen] = useState(false);

//   const [palettes, setPalettes] = useState<Palette[]>(() => [
//     Palettes.getPalette(0),
//     Palettes.getPalette(1),
//     Palettes.getPalette(2),
//     Palettes.getPalette(3),
//     Palettes.getPalette(4),
//     Palettes.getPalette(5),
//     Palettes.getPalette(6),
//     Palettes.getPalette(7),
//   ]);

//   const [bgrPalettes, setBGRPalettes] = useState<Palette[]>(() => [
//     Palettes.getBGRPalette(0),
//     Palettes.getBGRPalette(1),
//     Palettes.getBGRPalette(2),
//     Palettes.getBGRPalette(3),
//     Palettes.getBGRPalette(4),
//     Palettes.getBGRPalette(5),
//     Palettes.getBGRPalette(6),
//     Palettes.getBGRPalette(7),
//   ]);

//   const [currentPalette, setCurrentPalette] = useState(0);


//   const currentMetaSpriteEntries = useMemo(
//     () =>
//        metasprites[currentMetasprite].entries,
//   [currentMetasprite, metasprites])

//   // Build multi-line options for the list (memoized).
//   const options = useMemo(
//     () =>
//       currentMetaSpriteEntries.map((entry) => ({
//         value: keyOfMetaSpriteEntry(entry),
//         lines: [
//           `Tile: ${entry.tileIndex}, Sheet: ${entry.tileSheetIndex}, Palette: ${entry.paletteIndex}, x: ${entry.x}, y: ${entry.y}, h: ${entry.h ? 1 : 0}, v: ${entry.v ? 1 : 0}, r: ${entry.r}`,
//         ],
//       })),
//     [currentMetaSpriteEntries]
//   );



//   const currentTiles = useMemo(() =>
//     tilesheets[currentTilesheet].tiles, [tilesheets, currentTilesheet]
//   );

//   // Prune selection if it no longer exists after an update
//   // useEffect(() => {
//   //   if (selectedIds.length === 0) return;
//   //   //onst exists = options.some((o) => o.value === selectedId);
//   //   const exists = options.some((o) => values.includes(o.value));
//   //   if (!exists) setSelectedId(null);
//   // }, [options, selectedIds]);

//   // (Optional) get the selected entry
//   const selectedEntries = useMemo(() => {
//     const entries:MetaSpriteEntry[] = [];
//     for(let i = 0; i < selectedIds.length; i++) {
//       const entry = currentMetaSpriteEntries.find((e) => keyOfMetaSpriteEntry(e) === selectedIds[i]);
//       if(!entry) continue;

//       entries.push(entry)
//     }

//     return entries;

//   }, [selectedIds, currentMetaSpriteEntries]);

//   const currentRed = useMemo(() => {
//     const colorHex = palettes[currentPalette][currentColor];

//     const color = parseHexColor(colorHex);
//     return color?.r
//   }, [palettes, currentPalette, currentColor]);

//   const currentBlue = useMemo(() => {
//     const colorHex = palettes[currentPalette][currentColor];

//     const color = parseHexColor(colorHex);
//     return color?.b
//   }, [palettes, currentPalette, currentColor]);

//   const currentGreen = useMemo(() => {
//     const colorHex = palettes[currentPalette][currentColor];

//     const color = parseHexColor(colorHex);
//     return color?.g
//   }, [palettes, currentPalette, currentColor]);

//   const currentColorValue = useMemo(() => {

//     const colorHex = palettes[currentPalette][currentColor];
//     const color = parseHexColor(colorHex);
//     return color;

//   }, [palettes, currentPalette, currentColor])

//   const getToolByName = (name: "brush" | "fill" | "picker" | "eraser"): Tool => {
//     switch (name) {
//       case "brush":
//         return { type: "brush", icon: faPaintBrush };
//       case "fill":
//         return { type: "fill", icon: faFillDrip };
//       case "picker":
//         return { type: "picker", icon: faEyeDropper };
//       case "eraser":
//         return { type: "eraser", icon: faEraser };
//     }
//   }

//   // Keyboard shortcuts
//   const tile = currentTiles[currentTile];

//   // Painting ops
//   const setPixel = useCallback((x: number, y: number, value: number) => {

//     setTilesheets(prev => {

//       return prev.map((item, idx) => {
//         if (idx !== currentTilesheet) return item;

//         const next = item.tiles.map(t => t.map(row => row.slice()));
//         next[currentTile][y][x] = value & 0xF;

//         return {
//           ...item,
//           tiles: next
//         }
//       })
//     })

//   }, [currentTilesheet, currentTile]);

//   const floodFill = useCallback((x: number, y: number, _target: number | undefined, replacementRaw: number) =>{
//     const tileIndex = currentTile;                 // snapshot to avoid stale closure
//     const tilesheetIndex = currentTilesheet
//     const replacement = replacementRaw & 0xF;

//     setTilesheets(prev => {
//       return prev.map((item, idx) => {
//         if (idx !== tilesheetIndex) return item;

//         const tiles = item.tiles.map(t => t.map(row => row.slice()));
//         const width = TILE_W, height = TILE_H;

//         // Defensive bounds check on the seed pixel
//         if (x < 0 || y < 0 || x >= width || y >= height) return item;

//         // Read the true target from state (ignore the passed-in if any)
//         const startTarget = tiles[tileIndex][y][x] & 0xF;

//         // Nothing to do if already that color
//         if (startTarget === replacement) return item;

//         // Clone (tile -> rows -> cells)
//         const next = tiles.map(t => t.map(r => r.slice()));

//         const visited = new Set<string>();
//         const stack: [number, number][] = [[x, y]];

//         while (stack.length) {
//           const [cx, cy] = stack.pop()!;
//           if (cx < 0 || cy < 0 || cx >= width || cy >= height) continue;

//           const key = `${cx},${cy}`;
//           if (visited.has(key)) continue;

//           // Only fill matching target pixels
//           if ((next[tileIndex][cy][cx] & 0xF) !== startTarget) continue;

//           visited.add(key);
//           next[tileIndex][cy][cx] = replacement;

//           // 4-way neighbors
//           stack.push([cx + 1, cy]);
//           stack.push([cx - 1, cy]);
//           stack.push([cx, cy + 1]);
//           stack.push([cx, cy - 1]);
//         }

//         return {
//           ...item,
//           tiles: next
//         }        
//       })
//     })

//   }, [currentTile, currentTilesheet])


//   function keyOfMetaSpriteEntry(e: MetaSpriteEntry) {
//     return e.id;
//   }

//   // Mouse interactions
//   const onCellDown = (x: number, y: number) => (e: React.MouseEvent) => {
//     e.preventDefault();
//     setIsMouseDown(true);

//     if (e.button === 2 || e.buttons === 2) {
//       // Right-click erase
//       setPixel(x, y, 0);
//       return;
//     }

//     if (tool.type === "picker") {
//       setCurrentColor(tile[y][x]);
//     } else if (tool.type === "eraser") {
//       setPixel(x, y, 0);
//     } else if (tool.type === "fill") {
//       floodFill(x, y, tile[y][x], currentColor);
//     } else {
//       setPixel(x, y, currentColor);
//     }
//   };

//   const onCellMove = (x: number, y: number) => (e: React.MouseEvent) => {
//     if (!isMouseDown) return;
//     if (tool.type === "brush") setPixel(x, y, currentColor);
//     if (tool.type === "eraser") setPixel(x, y, 0);
//   };

//   const stopStroke = () => setIsMouseDown(false);

//   // Context menu disable for right-click erase
//   useEffect(() => {
//     const prevent = (e: MouseEvent) => e.preventDefault();
//     document.addEventListener("contextmenu", prevent);
//     return () => document.removeEventListener("contextmenu", prevent);
//   }, []);


//   const transformTile = useCallback((fn: (src: Tile) => Tile) => {

   
//     setTilesheets(prev => {

//       return prev.map((item, idx) => {
//         if (idx !== currentTilesheet) return item;

//         const next = item.tiles.map(t => t.map(row => row.slice()));
//         next[currentTile] = fn(next[currentTile]);

//         return {
//           ...item,
//           tiles: next
//         }
//       })
//     })

//   }, [currentTile, currentTilesheet]);

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
//     for (let y = 0; y < 8; y++) {
//       for (let x = 0; x < 8; x++) {
//         const nx = wrap8(x + dx);
//         const ny = wrap8(y + dy);
//         out[ny][nx] = src[y][x];
//       }
//     }
//     return out;
//   };

//   const shiftMetaSprite = (dx: number, dy: number) => {
//     const scale = SCALE * 8 * 16;
//     const wrap = (n: number) => (((n % scale) + scale) % scale);

//     console.log('shift meta sprite');

//     // Fast lookup for selected ids
//     const sel = new Set(selectedIds);
//     if (sel.size === 0) return; // nothing selected

//     console.log('we have a selection');



//     setMetaSprites(prev =>
//       prev.map((item, idx) => {
//         if (idx !== currentMetasprite) return item;

//         let anyChanged = false;
//         const updated = item.entries.map(entry => {
//           if (!sel.has(entry.id)) return entry;
//           anyChanged = true;
//           return {
//             ...entry,
//             x: wrap(entry.x + dx),
//             y: wrap(entry.y + dy),
//           };
//         });

//         return anyChanged ? { ...item, entries: updated } : item;
//       })
//     );
//   };

//   // need to do this with collection
//   const deleteAll = () => {
//     setMetaSprites(prev => {

//       return prev.map((item, idx) => {
//         if (idx !== currentMetasprite) return item;

//         return {
//           ...item,
//           entries: []
//         }
//       })
//     })                          

//   }

//   const flipHorizontal = () => {
//     if (!selectedIds?.length) return;

//     setMetaSprites(prev =>
//       prev.map((item, idx) => {
//         if (idx !== currentMetasprite) return item;

//         const sel = new Set(selectedIds);
//         let changed = false;

//         const updated = item.entries.map(entry => {
//           if (!sel.has(entry.id)) return entry;
//           changed = true;
//           return { ...entry, h: !entry.h };
//         });

//         return changed ? { ...item, entries: updated } : item;
//       })
//     );                
//   }

//   const flipVertical = () => {
//     if (!selectedIds?.length) return;

//     setMetaSprites(prev =>
//       prev.map((item, idx) => {
//         if (idx !== currentMetasprite) return item;

//         const sel = new Set(selectedIds);
//         let changed = false;

//         const updated = item.entries.map(entry => {
//           if (!sel.has(entry.id)) return entry;
//           changed = true;
//           return { ...entry, v: !entry.v };
//         });

//         return changed ? { ...item, entries: updated } : item;
//       })
//     );                        


//   }

//   const rotateMetaSpriteCCW = () => {
//     if (!selectedIds?.length) return;

//     setMetaSprites(prev =>
//       prev.map((item, idx) => {
//         if (idx !== currentMetasprite) return item;

//         const sel = new Set(selectedIds);
//         let changed = false;

//         const updated = item.entries.map(entry => {
//           if (!sel.has(entry.id)) return entry;
//           changed = true;
//           return { ...entry, r: (entry.r - 1) % 4 };
//         });

//         return changed ? { ...item, entries: updated } : item;
//       })
//     );    

//   }


//   const rotateMetaSpriteCW = () => {
//     if (!selectedIds?.length) return;

//     setMetaSprites(prev =>
//       prev.map((item, idx) => {
//         if (idx !== currentMetasprite) return item;

//         const sel = new Set(selectedIds);
//         let changed = false;

//         const updated = item.entries.map(entry => {
//           if (!sel.has(entry.id)) return entry;
//           changed = true;
//           return { ...entry, r: (entry.r + 1) % 4 };
//         });

//         return changed ? { ...item, entries: updated } : item;
//       })
//     );    
//   }

//   const paletteView = useMemo(
//     () => palettes.map((pal, palIndex) => (

//       <div key={palIndex} className="flex flex-row">
//         {pal.map((hex, i) => (
//           <button
//             key={i}
//             onClick={() => { setCurrentColor(i); setCurrentPalette(palIndex); }}
//             className={`select-none h-6 w-6 rounded-sm border border-white-900 ${currentPalette === palIndex && currentColor === i ? "ring-1 ring-offset-1 ring-yellow-500" : ""}`}
//             style={{ background: hex }}
//             title={`Index ${i}`}
//           />
//         ))}
//       </div>
//     )),
//     [palettes, currentPalette, currentColor]
//   );


//   function bgr555ToRgb(bgr555: number): { r: number; g: number; b: number } {
//     // Extract the 5-bit color components using bitwise shifts and masks.
//     const b5 = (bgr555 >> 10) & 0b11111;
//     const g5 = (bgr555 >> 5) & 0b11111;
//     const r5 = bgr555 & 0b11111;

//     // Scale the 5-bit values (0-31) to 8-bit values (0-255).
//     // This is done by shifting left by 3 and adding the higher bits.
//     // The formula `(value << 3) | (value >> 2)` provides a more accurate
//     // mapping than just `value << 3`.
//     const r = (r5 << 3) | (r5 >> 2);
//     const g = (g5 << 3) | (g5 >> 2);
//     const b = (b5 << 3) | (b5 >> 2);

//     return { r, g, b };
//   }

//   const handleBGRChange = ((e: React.ChangeEvent<HTMLInputElement>) => {
//     const value = e.target.value;
//     const num = parseInt(value, 16);

//     const color = bgr555ToRgb(num);

//     setBGRPalettes(prev =>
//       prev.map((p, pi) =>
//         pi === currentPalette || currentColor === 0 ?
//           p.map((hex, ci) => (ci === currentColor ? num.toString(16).padStart(4, '0') : hex))
//           : p
//       ));

//     const hexColor = `#${(color?.r & 0xf8).toString(16).padStart(2, '0')}${(color?.g & 0xf8).toString(16).padStart(2, '0')}${(color?.b & 0xf8).toString(16).padStart(2, '0')}`;

//     setPalettes(prev =>
//       prev.map((palette, pi) =>
//         pi === currentPalette || currentColor === 0 ?
//           palette.map((hex, ci) => (ci === currentColor ? hexColor : hex))
//           : palette
//       ))
//   })

//   const handleRedChanged = ((e: React.ChangeEvent<HTMLInputElement>) => {
//     const value = parseInt(e.target.value);

//     var color = currentColorValue;
//     if (!color) return;

//     const hexColor = `#${(value & 0xf8).toString(16).padStart(2, '0')}${(color.g & 0xf8).toString(16).padStart(2, '0')}${(color.b & 0xf8).toString(16).padStart(2, '0')}`;
//     const bgrHexColor = (((color.b & 0xf8) >> 3) << 10) | (((color.g & 0xf8) >> 3) << 5) | ((value & 0xf8) >> 3)

//     setPalettes(prev =>
//       prev.map((palette, pi) =>
//         pi === currentPalette || currentColor === 0 ?
//           palette.map((hex, ci) => (ci === currentColor ? hexColor : hex))
//           : palette
//       ))

//     setBGRPalettes(prev =>
//       prev.map((p, pi) =>
//         pi === currentPalette || currentColor === 0 ?
//           p.map((hex, ci) => (ci === currentColor ? bgrHexColor.toString(16).padStart(4, '0') : hex))
//           : p
//       ));
//   });

//   const handleGreenChanged = ((e: React.ChangeEvent<HTMLInputElement>) => {
//     const value = parseInt(e.target.value);

//     var color = currentColorValue;
//     if (!color) return;

//     const hexColor = `#${(color.r & 0xf8).toString(16).padStart(2, '0')}${(value & 0xf8).toString(16).padStart(2, '0')}${(color.b & 0xf8).toString(16).padStart(2, '0')}`;
//     const bgrHexColor = (((color.b & 0xf8) >> 3) << 10) | (((value & 0xf8) >> 3) << 5) | ((color.r & 0xf8) >> 3)

//     setPalettes(prev =>
//       prev.map((palette, pi) =>
//         pi === currentPalette || currentColor === 0 ?
//           palette.map((hex, ci) => (ci === currentColor ? hexColor : hex))
//           : palette
//       ))

//     setBGRPalettes(prev =>
//       prev.map((p, pi) =>
//         pi === currentPalette || currentColor === 0 ?
//           p.map((hex, ci) => (ci === currentColor ? bgrHexColor.toString(16).padStart(4, '0') : hex))
//           : p
//       ));
//   })

//   const handleBlueChanged = ((e: React.ChangeEvent<HTMLInputElement>) => {
//     const value = parseInt(e.target.value);

//     var color = currentColorValue;
//     if (!color) return;

//     const hexColor = `#${(color.r & 0xf8).toString(16).padStart(2, '0')}${(color.g & 0xf8).toString(16).padStart(2, '0')}${(value & 0xf8).toString(16).padStart(2, '0')}`;
//     const bgrHexColor = (((value & 0xf8) >> 3) << 10) | (((color.g & 0xf8) >> 3) << 5) | ((color.r & 0xf8) >> 3)

//     setPalettes(prev =>
//       prev.map((palette, pi) =>
//         pi === currentPalette || currentColor === 0 ?
//           palette.map((hex, ci) => (ci === currentColor ? hexColor : hex))
//           : palette
//       ))

//     setBGRPalettes(prev =>
//       prev.map((p, pi) =>
//         pi === currentPalette || currentColor === 0 ?
//           p.map((hex, ci) => (ci === currentColor ? bgrHexColor.toString(16).padStart(4, '0') : hex))
//           : p
//       ));
//   })

//   const createMetaspriteEntry = useCallback((col: number, row: number) => {
//     const newEntry: MetaSpriteEntry = {
//       id: uuid(),
//       tileSheetIndex: currentTilesheet,  // for now
//       tileIndex: currentTile,
//       paletteIndex: currentPalette, // for now
//       x: col,
//       y: row,
//       h: false,
//       v: false,
//       r: 0
//     }

//     return newEntry;

//   }, [currentTile, currentPalette, currentTilesheet]);

//   const updateMetasprite = ({row, col} : {row: number, col: number}) => {
//     if(!selectedTileCell && !selectedTileRegion) return;

//     if(selectedTileRegion) 
//     {
//       const newEntries:MetaSpriteEntry[] = [];

//       // handle region
//       for(let y = 0; y < selectedTileRegion.rows; y++) {
//         for(let x = 0; x < selectedTileRegion.cols; x++) {
//           const locationX = col + (x * SCALE * 8);
//           const locationY = row + (y * SCALE * 8);

//           const newEntry = createMetaspriteEntry(locationX, locationY);
//           newEntry.tileIndex = tileIndex(selectedTileRegion.row + y, selectedTileRegion.col + x);

//           newEntries.push(newEntry);
//         }
//       }

//       setMetaSprites(prev => {

//         return prev.map((item, idx) => {
//           if (idx !== currentMetasprite) return item;

//           return {
//             ...item,
//             entries: [...item.entries, ...newEntries]
//           }
//         })
//       })
//     }
//     else {
//       const newEntry =  createMetaspriteEntry(col, row);
//       setMetaSprites(prev => {

//         return prev.map((item, idx) => {
//           if (idx !== currentMetasprite) return item;

//           return {
//             ...item,
//             entries: [...item.entries, newEntry]
//           }
//         })
//       })

//       setSelectedIds([newEntry.id]);
//     }

//   }

// const onPick = useCallback((node: MenuNode) => {
//     // route or command
//     switch (node.id) {
//       case "sprite":       
//         if(selectedTileCell) setShowSpriteEditor(true); 
//         break;

//       case "tiles":      
//         console.log("tiles"); 
//         break;
//       case "palette":    
//         console.log("palette"); 
//         break;
//       case "settings":   
//         console.log("settings"); 
//         break;
//       case "meta-export": 
//         /* open export modal */ 
//         break;

//       case "pal-save-full":
//         savePalettes("default.pal", palettes, true);
//         break;
//       }
//       setDrawerOpen(false); // close on selection (overlay mode)
//   }, [selectedTileCell]);  

//   function selectTile(selected: Cell): void {
//       setSelectedTileCell(selected);
//       setShowSpriteEditor(true);
//       setCurrentTile(tileIndex(selected?.row ?? 0, selected?.col ?? 0));
//   }

//   function reorderMulti<T>(arr: T[], fromIndices: number[], insertBefore: number): T[] {
//     const order = [...fromIndices].sort((a, b) => a - b);
//     const picked = order.map(i => arr[i]);

//     // remove picked from the original
//     const remaining = arr.filter((_, idx) => !order.includes(idx));

//     // clamp insert position within remaining
//     const insertAt = Math.max(0, Math.min(insertBefore, remaining.length));

//     return [
//       ...remaining.slice(0, insertAt),
//       ...picked,
//       ...remaining.slice(insertAt),
//     ];
//   }

//   function buildRowColToIndex(
//     totalTiles: number,
//     indexToRowCol: (i: number) => { row: number; col: number }
//   ) {
//     const map = new Map<string, number>();
//     for (let i = 0; i < totalTiles; i++) {
//       const { row, col } = indexToRowCol(i);
//       map.set(`${row},${col}`, i);
//     }
//     return (row: number, col: number) => map.get(`${row},${col}`);
//   }

//   // Deep copy a single tile
//   const deepCopyTile = (t: Tile): Tile => t.map(r => r.slice());

//   /** Paste rectangular tile block with clipping to sheet bounds. */
//   function pasteTiles(
//     sheet: Tile[],                         // full tilesheet
//     payload: TileRegionPayload,            // { tiles, cols, rows }
//     at: { row: number; col: number },      // destination top-left (tile coords)
//     gridCols = 16,
//     gridRows = 16
//   ): Tile[] {
//     const rowColToIndex = buildRowColToIndex(sheet.length, indexToRowCol);
//     const next = sheet.map(deepCopyTile);

//     for (let r = 0; r < payload.rows; r++) {
//       for (let c = 0; c < payload.cols; c++) {
//         const destRow = at.row + r;
//         const destCol = at.col + c;
//         if (destRow < 0 || destCol < 0 || destRow >= gridRows || destCol >= gridCols) continue;

//         const destIdx = rowColToIndex(destRow, destCol);
//         if (destIdx == null) continue;

//         const srcIdx = r * payload.cols + c;
//         next[destIdx] = deepCopyTile(payload.tiles[srcIdx]);
//       }
//     }
//     return next;
//   }  

//   const handleCopy = (region?: Region, cell?: Cell) => {
//     setTilesheets(prev => {
//       const sheet = prev[currentTilesheet];
//       if (!sheet) return prev;

//       const payload = region
//         ? extractRegionFromTilesheet(sheet.tiles, region, indexToRowCol)
//         : (cell ? extractSingleTileFromTilesheet(sheet.tiles, cell, indexToRowCol) : null);

//       if (!payload) return prev;
//       // store clipboard (outside setTilesheets is also fine)
//       setClipboard(payload);
//       return prev;
//     });
//   };

//   // PASTE into CURRENT tilesheet at a tile location
//   const handlePaste = (at: Cell) => {
//     if (!clipboard) return;
//     setTilesheets(prev =>
//       producePasteIntoTilesheet(prev, currentTilesheet, clipboard, at, indexToRowCol)
//     );
//   };

//   // DELETE region in CURRENT tilesheet
//   const handleDelete = (region?: Region, cell?: Cell) => {
//     setTilesheets(prev => {
//       const targetRegion =
//         region ?? (cell ? { row: cell.row, col: cell.col, rows: 1, cols: 1 } : undefined);
//       if (!targetRegion) return prev;
//       return produceDeleteRegionInTilesheet(prev, currentTilesheet, targetRegion, indexToRowCol);
//     });
//   };  

//   return (

//     <Fragment>
//       <div className="min-h-screen">
//       {/* Header / AppBar */}
//       <header className="sticky top-0 z-30 border-b border-slate-200">
//         <div className="flex items-center gap-3 px-4 py-3">
//           <StyledButton
//             className="cursor-pointer"
//             width={24}
//             onClick={() => setDrawerOpen(true)}
//           >
//             {/* Simple hamburger icon */}
//             <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75">
//               <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
//             </svg>
//           </StyledButton>

//           <h1 className="text-2xl font-bold">SNES Sprite Editor (4bpp, 8×8 tiles)</h1>
//         </div>
//       </header>

//       {/* Drawer (overlay on mobile, persistent on lg) */}
//       <LeftDrawer
//         open={drawerOpen}
        
//         onClose={() => setDrawerOpen(false)}
//         widthClass="w-64"
//         persistentLg={false}
//         ariaLabel="SNES tools navigation"
//       >
//         {/* Close button only visible on mobile/tablet */}
//         <div className="lg:hidden flex justify-end p-2 border-b border-slate-200">
//           <button
//             onClick={() => setDrawerOpen(false)}
//             className="inline-flex items-center justify-center h-8 w-8 rounded-md"
//             aria-label="Close navigation"
//           >
//             <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75">
//               <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6l-12 12" />
//             </svg>
//           </button>
//         </div>
//         <DrawerMenu tree={menuTree} onPick={onPick} accordion />        
//       </LeftDrawer>

//       <main className="mt-2">
//         <div className="mx-auto w-full">
//           <div className="flex flex-row gap-10 justify-center">

//             <div className="flex flex-col gap-1">

//               <div className="flex flex-row justify-between items-center">
//                 <span className="text-sm font-bold">Metasprite Editor</span>
//                   <div className="relative">
//                     <select 
//                       value={currentMetasprite} 
//                       onChange={((e) => setCurrentMetasprite(parseInt(e.target.value)))}
//                       className="w-full select-none bg-white placeholder:text-slate-400 text-slate-700 text-sm border border-slate-200 rounded pl-3 pr-8 py-1 transition duration-300 ease focus:outline-none focus:border-slate-400 hover:border-slate-400 shadow-sm focus:shadow-md appearance-none cursor-pointer">
//                         {metasprites.map((ms, i) => {
//                           return <option key={i} value={i}>{ms.name}</option>
//                         })}
//                     </select>           
//                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.2" stroke="currentColor" className="h-5 w-5 ml-1 absolute top-1.5 right-1.5 text-slate-700">
//                       <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15 12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
//                     </svg>    
//                   </div>         

//               </div>

//               <div className="flex flex-col">
//                 <div className="mb-2 p-1 rounded-lg border-2 border-blue-400 bg-transparent">
//                   <MetaSpriteEditor
//                     entries={currentMetaSpriteEntries}
//                     tilesheets={tilesheets}
//                     drawGrid={drawGrid}
//                     palettes={palettes}
//                     highlightSelected={highlightSelected}
//                     selected={selectedEntries[0]}
//                     onClick={updateMetasprite}
//                   />
//                 </div>
//                 <div className="flex flex-row gap-10">
//                   <div className="flex flex-col">
//                     <div className="flex mb-2 ml-1">
//                       <div className="flex flex-row gap-4">
//                         <div className="flex flex-row gap-2">
//                           <div className="w-fit h-fit select-none">
//                             <StyledCheckbox checked={highlightSelected} onChange={(e) => { setHighlightSelected(e.target.checked) }} />
//                           </div>
//                           <label>Highlight selected sprite</label>
//                         </div>
//                         <div className="flex flex-row gap-2">
//                           <div className="w-fit h-fit select-none">
//                             <StyledCheckbox checked={drawGrid} onChange={(e) => { setDrawGrid(e.target.checked) }} />
//                           </div>
//                           <label>Draw Grid</label>
//                         </div>
//                       </div>
//                     </div>
//                     <div className="flex justify-between w-full items-center">
//                       <div className="flex flex-row gap-2 items-center">

//                         <StyledButton width={25} onClick={flipHorizontal}>H Flip</StyledButton>
//                         <StyledButton width={25} onClick={flipVertical}>V Flip</StyledButton>

//                         <ChevronButton title="Shift Left" direction="left" onClick={() => shiftMetaSprite(-1, 0)} />
//                         <ChevronButton title="Shift Right" direction="right" onClick={() => shiftMetaSprite(1, 0)} />
//                         <ChevronButton title="Shift Up" direction="up" onClick={() => shiftMetaSprite(0, -1)} />
//                         <ChevronButton title="Shift Down" direction="down" onClick={() => shiftMetaSprite(0, 1)} />
//                         <ChevronButton title="Rotate CCW" direction="rotate-ccw" onClick={() => rotateMetaSpriteCCW()} />
//                         <ChevronButton title="Rotate CW" direction="rotate-cw" onClick={() => rotateMetaSpriteCW()} />
//                       </div>
//                     </div>
//                     <div className="flex flex-col w-130 gap-1">
//                       <div className="flex flex-row justify-between items-center"><span className="mt-1 text-sm">List of Sprites {currentMetaSpriteEntries.length}</span>
//                         <StyledButton width={35} className="h-5" onClick={deleteAll}>Clear</StyledButton>
//                       </div>
//                       <SelectList
//                         maxHeight={200}
//                         onDrop={(fromIndex, toIndex) => {
//                           setMetaSprites(prev => {

//                             return prev.map((item, idx) => {
//                               if (idx !== currentMetasprite) return item;

//                               const updated = moveItem(item.entries, fromIndex, toIndex);

//                               return {
//                                 ...item,
//                                 entries: updated
//                               }
//                             })
//                           })                          


//                         }}

//                         onDropMulti={(fromIndices, insertBeforeIndex) => {
//                           setMetaSprites(prev =>
//                             prev.map((item, idx) => {
//                               if (idx !== currentMetasprite) return item;

//                               return {
//                                 ...item,
//                                 entries: reorderMulti(item.entries, fromIndices, insertBeforeIndex),
//                               };
//                             })
//                           );
//                         }}
//                         options={options}

//                         values={selectedIds}

//                         onDeleteItem={(index) => {

//                             setMetaSprites(prev => {

//                               return prev.map((item, idx) => {
//                                 if (idx !== currentMetasprite) return item;

//                                 const updated = item.entries.filter(a => a.id !== index);

//                                 return {
//                                   ...item,
//                                   entries: updated
//                                 }
//                               });

//                             });                          

//                         }}

//                         onChange={(id) => {
//                           setSelectedIds(id);
//                         }} 
                        
//                         />
//                     </div>
//                   </div>
//                 </div>

//               </div>

              
//             </div>

//             <div className="flex">
//               <div className="flex flex-col gap-1">
//                 <div className="flex flex-row justify-between w-full items-center">
//                   <span className="text-sm font-bold">Tilesheet</span>
//                   <div className="relative">
//                     <select
//                       value={currentTilesheet}
//                       onChange={((e) => setCurrentTilesheet(parseInt(e.target.value)))}
//                       className="w-full select-none bg-white placeholder:text-slate-400 text-slate-700 text-sm border border-slate-200 rounded pl-3 pr-8 py-1 transition duration-300 ease focus:outline-none focus:border-slate-400 hover:border-slate-400 shadow-sm focus:shadow-md appearance-none cursor-pointer">
//                       <option value="0">Tilesheet 0</option>
//                       <option value="1">Tilesheet 1</option>
//                     </select>
//                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.2" stroke="currentColor" className="h-5 w-5 ml-1 absolute top-1.5 right-1.5 text-slate-700">
//                       <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15 12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
//                     </svg>
//                   </div>

//                 </div>
//                 <div className="flex flex-col">
//                   <div className="mb-2 p-1 rounded-lg border-2 border-blue-400 bg-transparent">
//                     <Tilesheet tiles={currentTiles} 
//                                 palette={palettes[currentPalette]} 
//                                 selected={selectedTileCell} 
//                                 onSelected={selectTile} 
//                                 selectedRegion={selectedTileRegion} 
//                                 onRegionSelected={function (region?: Region): void {
//                                     setSelectedTileRegion(region);
//                                 }} 
//                                 onCopy={({ cell, region }) => {

//                                   handleCopy(region, cell);
//                                 }}                                
//                                 onPaste={({ at }) => handlePaste(at)}
//                                 onDelete={({cell, region}) => {
//                                   handleDelete(region, cell ?? undefined);
//                                 }}
//                                 canCopy={({ cell, region }) => !!(region || cell)}
//                                 canPaste={() => clipboard !== null}                                
//                                 />
//                   </div>
//                   <div className="flex justify-end">
//                     {selectedTileCell && <span className="text-xs">Selected Tile: {tileIndex(selectedTileCell?.row ?? 0, selectedTileCell?.col ?? 0)}</span>}
//                   </div>
//                 </div>

//               </div>
//             </div>
            
//             <div className="flex flex-col w-fit">
//               <div className="flex flex-col gap-1">

//                 <div className="flex flex-row justify-between items-center">
//                   <span className="text-sm font-bold">Palette Editor</span>
//                     <div className="relative">
//                       <select 
//                         value={currentPalette} 
//                         onChange={((e) => setCurrentPalette(parseInt(e.target.value)))}
//                         className="w-full select-none bg-white placeholder:text-slate-400 text-slate-700 text-sm border border-slate-200 rounded pl-3 pr-8 py-1 transition duration-300 ease focus:outline-none focus:border-slate-400 hover:border-slate-400 shadow-sm focus:shadow-md appearance-none cursor-pointer">
//                           {palettes.map((ms, i) => {
//                             return <option key={i} value={i}>{`Palette ${i.toString().padStart(2, '0')}`}</option>
//                           })}
//                       </select>           
//                       <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.2" stroke="currentColor" className="h-5 w-5 ml-1 absolute top-1.5 right-1.5 text-slate-700">
//                         <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15 12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
//                       </svg>    
//                     </div>         

//                 </div>

//                 <div className="flex flex-col gap-2">
//                   {paletteView}
//                 </div>

//                 <div className="flex flex-row justify-between">
//                   <div className="flex mt-4">
//                     <ColorPicker555 value={palettes[currentPalette][currentColor]}
//                       onColorChange={(nextHex, bgr) => {

//                         setBGRPalettes(prev =>
//                           prev.map((p, pi) =>
//                             pi === currentPalette || currentColor === 0 ?
//                               p.map((hex, ci) => (ci === currentColor ? bgr.toString(16).padStart(4, '0') : hex))
//                               : p
//                           ));

//                         setPalettes(prev =>
//                           prev.map((palette, pi) =>
//                             pi === currentPalette || currentColor === 0 ?
//                               palette.map((hex, ci) => (ci === currentColor ? nextHex : hex))
//                               : palette
//                           ))
//                       }}
//                     />
//                   </div>
//                   <div className="flex mt-4 flex-row items-center gap-2">
//                     <label>HEX</label>
//                     <input type="text"
//                       placeholder="0000"
//                       value={bgrPalettes[currentPalette][currentColor]}
//                       onChange={handleBGRChange}
//                       className="w-28 border rounded px-2 py-1 font-mono text-sm uppercase tracking-widest"
//                       title="Enter 4 hex digits (bit15 auto-cleared)" />
//                   </div>
//                 </div>

//                 <div className="flex flex-row mt-1 justify-between w-full">

//                   <div className="flex flex-col gap-2 w-20 items-center">
//                     <div className="flex flex-row items-center gap-1">
//                       <label>R</label>
//                       <input type="text"
//                         placeholder="000"
//                         value={currentRed?.toString().padStart(3, '0')}
//                         onChange={handleRedChanged}
//                         className="w-14 border rounded px-2 py-1 font-mono text-sm uppercase tracking-widest"
//                         title="Enter Red Value" />
//                     </div>
//                     <div className="flex justify-center">
//                       <input value={currentRed} max={248} onChange={handleRedChanged} type="range" className="w-20 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700
//                               [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:appearance-none
//                               [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:bg-blue-600 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:appearance-none"></input>
//                     </div>
//                   </div>

//                   <div className="flex flex-col gap-2 w-20 items-center">

//                     <div className="flex flex-row items-center gap-1">
//                       <label>G</label>
//                       <input type="text"
//                         placeholder="000"
//                         value={currentGreen?.toString().padStart(3, '0')}
//                         onChange={handleGreenChanged}
//                         className="w-14 border rounded px-2 py-1 font-mono text-sm uppercase tracking-widest"
//                         title="Enter Green Value" />
//                     </div>
//                     <div className="flex justify-center">
//                       <input onChange={handleGreenChanged} max={248} value={currentGreen} type="range" className="w-20 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700
//                                   [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:appearance-none
//                                   [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:bg-blue-600 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:appearance-none"></input>
//                     </div>
//                   </div>

//                   <div className="flex flex-col gap-2 w-20 items-center">
//                     <div className="flex flex-row items-center gap-1">
//                       <label>B</label>
//                       <input type="text"
//                         placeholder="000"
//                         value={currentBlue?.toString().padStart(3, '0')}
//                         onChange={handleBlueChanged}
//                         className="w-14 border rounded px-2 py-1 font-mono text-sm uppercase tracking-widest"
//                         title="Enter Blue Value" />
//                     </div>
//                     <div className="flex justify-center">
//                       <input value={currentBlue} max={248} onChange={handleBlueChanged} type="range" className="w-20 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700
//                                   [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:appearance-none
//                                   [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:bg-blue-600 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:appearance-none"></input>
//                     </div>
//                   </div>
//                 </div>

//               </div>
//             </div>
//           </div>
//         </div>
//       </main>

//       </div>


//       <DraggableWindow
//         className="text-slate-700"
//         title="Tile Editor"
//         open={showSpriteEditor}
//         onClose={function (): void {
//           setShowSpriteEditor(false);
//         }}>
//         <div className="flex flex-col">
//           <div className="flex flex-row gap-2">
//             <div className="select-none w-fit" onMouseUp={stopStroke} onMouseLeave={stopStroke}>
//               <div className="inline-grid"
//                 style={{ gridTemplateColumns: `repeat(${TILE_W}, ${TILE_EDITOR_SCALE}px)`, gridTemplateRows: `repeat(${TILE_H}, ${TILE_EDITOR_SCALE}px)` }}>
//                 {tile.map((row, y) =>
//                   row.map((pix, x) => (
//                     <div
//                       key={`${x}-${y}`}
//                       onMouseDown={onCellDown(x, y)}
//                       onMouseMove={onCellMove(x, y)}
//                       className="border border-slate-300 hover:brightness-95"
//                       style={{ background: palettes[currentPalette][pix] ?? "#000" }}
//                       title={`(${x},${y}) → ${pix}`}
//                     />
//                   ))
//                 )}
//               </div>
//             </div>

//             <div className="flex flex-col justify-between h-[256px]">
//               {([getToolByName("brush"), getToolByName("fill"), getToolByName("picker"), getToolByName("eraser")] as Tool[]).map((t, i) => (
//                 <button key={i} onClick={() => setTool(t)} className={`p-1 rounded-md w-[48px] h-[48px] text-lg ${tool.type === t.type ? "bg-blue-600 text-white" : "bg-transparent hover:bg-slate-100"}`}>
//                   <FontAwesomeIcon icon={t.icon} />
//                 </button>
//               ))}
//             </div>
//           </div>
//           <div className={`flex flex-col mt-1 text-xs text-slate-500 w-[380px]`}>Left-click to paint. Right-click to erase. Hold and drag to draw. Fill tool replaces contiguous region.</div>
//           <div className="flex flex-col gap-1 select-none">
//             <div>
//               <div className="text-xs text-[#222222]">Shift pixels
//                 <button title="Shift pixels up"
//                   className="p-1 rounded-md text-sm bg-transparent hover:bg-blue-100 active:bg-blue-200 active:text-white"
//                   onClick={() => transformTile((src) => shiftTile(src, 0, -1))}>
//                   <FontAwesomeIcon className="text-xs text-[#333333]" icon={faArrowUp}></FontAwesomeIcon>
//                 </button>,
//                 <button title="Shift pixels down"
//                   className="p-1 rounded-md text-sm bg-transparent hover:bg-blue-100 active:bg-blue-200 active:text-white"
//                   onClick={() => transformTile((src) => shiftTile(src, 0, 1))}>
//                   <FontAwesomeIcon className="text-xs text-[#333333]" icon={faArrowDown}></FontAwesomeIcon>
//                 </button>,
//                 <button title="Shift pixels left"
//                   className="p-1 rounded-md text-sm bg-transparent hover:bg-blue-100 active:bg-blue-200 active:text-white"
//                   onClick={() => transformTile((src) => shiftTile(src, -1, 0))}>
//                   <FontAwesomeIcon className="text-xs text-[#333333]" icon={faArrowLeft}></FontAwesomeIcon>
//                 </button>,
//                 <button title="Shift pixels right"
//                   className="p-1 rounded-md text-sm bg-transparent hover:bg-blue-100 active:bg-blue-200 active:text-white"
//                   onClick={() => transformTile((src) => shiftTile(src, 1, 0))}>
//                   <FontAwesomeIcon className="text-xs text-[#333333]" icon={faArrowRight}></FontAwesomeIcon>
//                 </button>
//               </div>
//             </div>
//           </div>
//           <div className="flex flex-col gap-1 select-none">
//             <div>
//               <div className="text-xs text-[#222222]">Rotate&nbsp;
//                 <button onClick={rotateTileCCW} className="p-1 rounded-md text-sm bg-transparent hover:bg-blue-100 active:bg-blue-200 active:text-white" title="Rotate Left (90° CCW)">
//                   <FontAwesomeIcon className="text-xs text-[#333333]" icon={faRotateBackward}></FontAwesomeIcon>
//                 </button>,
//                 <button onClick={rotateTileCW} className="p-1 rounded-md text-sm bg-transparent hover:bg-blue-100 active:bg-blue-200 active:text-white" title="Rotate Right (90° CW)">
//                   <FontAwesomeIcon className="text-xs text-[#333333]" icon={faRotateForward}></FontAwesomeIcon>
//                 </button>
//               </div>
//             </div>
//           </div>
//           <div className="flex flex-col gap-1 select-none">
//             <div>
//               <div className="text-xs text-[#222222]">Flip&nbsp;
//                 <button onClick={flipTileH} className="p-1 rounded-md text-sm bg-transparent hover:bg-blue-100 active:bg-blue-200 active:text-white" title="Flip Horizontal">
//                   <FontAwesomeIcon className="text-xs text-[#333333]" icon={faArrowsLeftRight}></FontAwesomeIcon>
//                 </button>,
//                 <button onClick={flipTileV} className="p-1 rounded-md text-sm bg-transparent hover:bg-blue-100 active:bg-blue-200 active:text-white" title="Flip Vertical">
//                   <FontAwesomeIcon className="text-xs text-[#333333]" icon={faArrowsUpDown}></FontAwesomeIcon>
//                 </button>
//               </div>
//             </div>
//           </div>

//         </div>
//       </DraggableWindow>

//     </Fragment>
//   );
// }
