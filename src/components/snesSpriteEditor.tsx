"use client"

import React, { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { DraggableWindow } from "./draggableWindow";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowDown, faArrowLeft, faArrowRight, faArrowsLeftRight, faArrowsUpDown, faArrowUp, faChevronUp, faEraser, faEyeDropper, faFillDrip, faPaintBrush, faRotateBackward, faRotateForward, IconDefinition } from "@fortawesome/free-solid-svg-icons";
import { Cell, HistoryEntry, MetaSpriteEntry, Palette, Tile, Tool } from "@/types/editorTypes";
import { v4 as uuid } from "uuid";
import { MultiSelect } from "./MultiSelect";
import { SingleSelectList } from "./singleSelectList";
import { MetaSpriteEditor } from "./metaSpriteEditor";
import { Tilesheet } from "./tilesheet";
import { decodeSNES4bppTile, download, encodeSNES4bppTile, exportCGRAMBGR15, makeBlankTile, makeTiles, moveItem, renderTilesheetToCanvas, renderTileToCanvas, tileIndex } from "@/helpers";
import { TILE_H, TILE_W } from "@/app/constants";
import { ChevronButton } from "./chevronButton";
import ColorPicker555 from "./colorPicker555";

// Types
// export type Palette = string[]; // 16 hex colors: "#RRGGBB"

// Palettes.ts
export class Palettes {
  static readonly pal_r = new Uint8Array([
    80, 0, 0x40, 0x80, 0xc0, 0xf8, 0x50, 0xa0, 0xf8, 0, 0, 0, 0, 0, 0, 0xc0,
    80, 0, 0x20, 0x30, 0x40, 0x50, 0x60, 0x70, 0x80, 0x90, 0xa0, 0xb0, 0xc0, 0xd0, 0xe0, 0xf8,
    80, 0x20, 0x40, 0x60, 0x80, 0xa0, 0xc0, 0xf8, 0xf8, 0xf8, 0xf8, 0xf8, 0xf8, 0xf8, 0xf8, 0xf8,
    80, 0, 0, 0, 0, 0, 0, 0, 0x20, 0x40, 0x60, 0x80, 0xa0, 0xc0, 0xe0, 0xf8,
    80, 0, 0, 0, 0, 0, 0, 0, 0x20, 0x40, 0x60, 0x80, 0xa0, 0xc0, 0xe0, 0xf8,
    80, 0x20, 0x40, 0x60, 0x80, 0xa0, 0xc0, 0xf8, 0xf8, 0xf8, 0xf8, 0xf8, 0xf8, 0xf8, 0xf8, 0xf8,
    80, 0x20, 0x40, 0x60, 0x80, 0xa0, 0xc0, 0xf8, 0xf8, 0xf8, 0xf8, 0xf8, 0xf8, 0xf8, 0xf8, 0xf8,
    80, 0, 0, 0, 0, 0, 0, 0, 0x20, 0x40, 0x60, 0x80, 0xa0, 0xc0, 0xe0, 0xf8
  ]);

  static readonly pal_g = new Uint8Array([
    248, 0, 0x40, 0x80, 0xc0, 0xf8, 0, 0, 0, 0x50, 0xa0, 0xf8, 0, 0, 0, 0xc0,
    248, 0, 0x20, 0x30, 0x40, 0x50, 0x60, 0x70, 0x80, 0x90, 0xa0, 0xb0, 0xc0, 0xd0, 0xe0, 0xf8,
    248, 0, 0, 0, 0, 0, 0, 0, 0x20, 0x40, 0x60, 0x80, 0xa0, 0xc0, 0xe0, 0xf8,
    248, 0x20, 0x40, 0x60, 0x80, 0xa0, 0xc0, 0xf8, 0xf8, 0xf8, 0xf8, 0xf8, 0xf8, 0xf8, 0xf8, 0xf8,
    248, 0, 0, 0, 0, 0, 0, 0, 0x20, 0x40, 0x60, 0x80, 0xa0, 0xc0, 0xe0, 0xf8,
    248, 0x20, 0x40, 0x60, 0x80, 0xa0, 0xc0, 0xf8, 0xf8, 0xf8, 0xf8, 0xf8, 0xf8, 0xf8, 0xf8, 0xf8,
    248, 0, 0, 0, 0, 0, 0, 0, 0x20, 0x40, 0x60, 0x80, 0xa0, 0xc0, 0xe0, 0xf8,
    248, 0x20, 0x40, 0x60, 0x80, 0xa0, 0xc0, 0xf8, 0xf8, 0xf8, 0xf8, 0xf8, 0xf8, 0xf8, 0xf8, 0xf8
  ]);

  static readonly pal_b = new Uint8Array([
    80, 0, 0x40, 0x80, 0xc0, 0xf8, 0, 0, 0, 0, 0, 0, 0x50, 0xa0, 0xf8, 0,
    80, 0, 0x20, 0x30, 0x40, 0x50, 0x60, 0x70, 0x80, 0x90, 0xa0, 0xb0, 0xc0, 0xd0, 0xe0, 0xf8,
    80, 0, 0, 0, 0, 0, 0, 0, 0x20, 0x40, 0x60, 0x80, 0xa0, 0xc0, 0xe0, 0xf8,
    80, 0, 0, 0, 0, 0, 0, 0, 0x20, 0x40, 0x60, 0x80, 0xa0, 0xc0, 0xe0, 0xf8,
    80, 0x20, 0x40, 0x60, 0x80, 0xa0, 0xc0, 0xf8, 0xf8, 0xf8, 0xf8, 0xf8, 0xf8, 0xf8, 0xf8, 0xf8,
    80, 0, 0, 0, 0, 0, 0, 0, 0x20, 0x40, 0x60, 0x80, 0xa0, 0xc0, 0xe0, 0xf8,
    80, 0x20, 0x40, 0x60, 0x80, 0xa0, 0xc0, 0xf8, 0xf8, 0xf8, 0xf8, 0xf8, 0xf8, 0xf8, 0xf8, 0xf8,
    80, 0x20, 0x40, 0x60, 0x80, 0xa0, 0xc0, 0xf8, 0xf8, 0xf8, 0xf8, 0xf8, 0xf8, 0xf8, 0xf8, 0xf8
  ]);

  /** Get RGB values as tuple [r, g, b] */
  static getRGB(index: number): [number, number, number] {
    return [
      Palettes.pal_r[index],
      Palettes.pal_g[index],
      Palettes.pal_b[index],
    ];
  }

  /** Get RGB as hex string like "#ffeeff" */
  static getRGBString(paletteIndex: number, colorIndex: number): string {
    const [r, g, b] = Palettes.getRGB(paletteIndex * 16 + colorIndex);
    const toHex = (n: number) => n.toString(16).padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }  

  static getPalette(paletteIndex: number) : string[] {
    let rgb = [];

    for(let i = 0; i < 16; i++) {
      rgb.push(Palettes.getRGBString(paletteIndex, i))
    }

    return rgb;    
    }
}


function defaultPalette(): Palette {
  return Palettes.getPalette(0);
  // return [
  //   "#000000", // 0
  //   "#404040", // 1
  //   "#808080", // 2
  //   "#C0C0C0", // 3
  //   "#FF0000", // 4
  //   "#FFA500", // 5
  //   "#FFFF00", // 6
  //   "#00FF00", // 7
  //   "#00FFFF", // 8
  //   "#0000FF", // 9
  //   "#7A00FF", // 10
  //   "#FF00FF", // 11
  //   "#964B00", // 12
  //   "#FFFFFF", // 13
  //   "#1E90FF", // 14
  //   "#FF69B4", // 15
  // ];
}

function greenPalette(): Palette {
  return Palettes.getPalette(3);
}



// ------------------ Encoding / Decoding ------------------












function keyOf(e: MetaSpriteEntry) {
  // If you *don't* have e.id, use a composite:
  // return `${e.tileIndex}|${e.paletteIndex}|${e.x}|${e.y}`;
  return e.id;
}

export default function SNESpriteEditor() {
  // Core state
  //const [palette, setPalette] = useState<Palette>(() => defaultPalette());
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
  const [highlightSelected, setHighlightSelected] = useState(true);

  const [metaSpriteEntries, setMetaSpriteEntries] = useState<MetaSpriteEntry[]>([]);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [selectedMetaSprite, setSelectedMetaSprite] = useState<{row: number, col: number} | undefined>();
  const [drawGrid, setDrawGrid] = useState(true);

  const [palettes, setPalettes] = useState<Palette[]>(() => [
    Palettes.getPalette(0),
    Palettes.getPalette(1),
    Palettes.getPalette(2),
    Palettes.getPalette(3),
    Palettes.getPalette(4),
    Palettes.getPalette(5),
    Palettes.getPalette(6),
    Palettes.getPalette(7),
  ]);
  const [currentPalette, setCurrentPalette] = useState(0);

  // Build multi-line options for the list (memoized).
  const options = useMemo(
    () =>
      metaSpriteEntries.map((entry) => ({
        value: keyOf(entry),
        lines: [
          `Tile: ${entry.tileIndex}, Sheet: ${entry.tileSheetIndex}, Palette: ${entry.paletteIndex}, x: ${entry.x}, y: ${entry.y}, h: ${entry.h ? 1 : 0}, v: ${entry.v ? 1 : 0}, r: ${entry.r}`,
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
    return id ? metaSpriteEntries.find((e) => keyOf(e) === id) ?? undefined : undefined;
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

  // const exportJSON = () => {
  //   const meta = { format: "snes-4bpp", tileSize: { w: TILE_W, h: TILE_H }, tiles, palette };
  //   const text = JSON.stringify(meta, null, 2);
  //   download("snes_tiles.json", new Blob([text], { type: "application/json" }));
  // };

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
  // const exportTilePNG = () => {
  //   const c = renderTileToCanvas(tile, palette, 16);
  //   c.toBlob(b => b && download(`tile_${currentTile}.png`, b!));
  // };
  // const exportTilesheetPNG = () => {
  //   const c = renderTilesheetToCanvas(tiles, palette, tilesPerRow, 8);
  //   c.toBlob(b => b && download(`tilesheet_${tiles.length}x.png`, b!));
  // };

  // // CGRAM export
  // const exportCGRAM = () => {
  //   const cgram = exportCGRAMBGR15(palette);
  //   download("palette_cgram_bgr15.bin", cgram);
  // };

  // Context menu disable for right-click erase
  useEffect(() => {
    const prevent = (e: MouseEvent) => e.preventDefault();
    document.addEventListener("contextmenu", prevent);
    return () => document.removeEventListener("contextmenu", prevent);
  }, []);


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


  const shiftMetaSprite = (dx: number, dy: number) => {

    const scale = 3 * 8 * 16;
    const wrap = (n: number) => (((n % scale) + scale) % scale);

    
    setMetaSpriteEntries(prev =>
      prev.map(item =>
        item.id === selectedId ? { ...item, x: wrap(item.x + dx), y: wrap(item.y + dy) } : item
      )
    );

  };

  const deleteAll = () => {
    setMetaSpriteEntries([]);
  }

  const flipHorizontal = () => {
    if(!selectedId) return;

    setMetaSpriteEntries(prev => 
      prev.map(item => item.id === selectedId ? { ...item, h: !item.h } : item))
  }

  const flipVertical = () => {
    if(!selectedId) return;

    setMetaSpriteEntries(prev => 
      prev.map(item => item.id === selectedId ? { ...item, v: !item.v } : item))

  }

  const rotateMetaSpriteCCW = () => {
    if(!selectedId) return;


    setMetaSpriteEntries(prev =>
      prev.map(item => item.id === selectedId ? { ...item, r: (item.r - 1) % 4} : item)
    )
  }


  const rotateMetaSpriteCW = () => {
    if(!selectedId) return;


    setMetaSpriteEntries(prev =>
      prev.map(item => item.id === selectedId ? { ...item, r: (item.r + 1) % 4} : item)
    )
  }

  
  // const paletteSwatches = useMemo(
  //   () => palette.map((hex, i) => (
  //     <button
  //       key={i}
  //       onClick={() => setCurrentColor(i)}
  //       className={`select-none h-8 w-8 rounded-md border border-white-900 ${currentColor === i ? "ring-2 ring-offset-1 ring-yellow-500" : ""}`}
  //       style={{ background: hex }}
  //       title={`Index ${i}`}
  //     />
  //   )),
  //   [palette, currentColor]
  // );

  const paletteView = useMemo(
    () => palettes.map((pal, palIndex) => (

      <div key={palIndex} className="flex flex-row">
        {pal.map((hex, i) => (
        <button
          key={i}
          onClick={() => { setCurrentColor(i); setCurrentPalette(palIndex); }}
          className={`select-none h-6 w-6 rounded-sm border border-white-900 ${currentPalette === palIndex && currentColor === i ? "ring-1 ring-offset-1 ring-yellow-500" : ""}`}
          style={{ background: hex }}
          title={`Index ${i}`}
        />
        ))}
      </div>
    )),
    [palettes, currentPalette, currentColor]
  );

  const getHexFromColorString = (hexString: string): string  => { 
    return hexString;
  }



  return (

    <Fragment>
    <div className="min-h-screen p-6">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-bold mb-2">SNES Sprite Editor (4bpp, 8×8 tiles)</h1>

        <div className="flex flex-row gap-10">
          <div className="flex flex-row gap-10">

            <div className="flex flex-col items-center">
              
              <div>
                <h2 className="font-semibold">Meta-sprite</h2>
              </div>

              <div className="mb-2 p-1 rounded-lg border border-indigo-900 bg-indigo-300">
                <MetaSpriteEditor 
                      entries={metaSpriteEntries} 
                      drawGrid={drawGrid}
                      palettes={palettes} 
                      tiles={tiles}
                      highlightSelected={highlightSelected}
                      selected={selectedEntry}
                      onClick={({row, col}) => {
                        if(selectedTileCell) {

                          const newEntry: MetaSpriteEntry = {
                            id: uuid(),
                            tileSheetIndex: 0,  // for now
                            tileIndex: currentTile,
                            paletteIndex: currentPalette, // for now
                            x: col,
                            y: row,
                            h: false,
                            v: false,
                            r: 0
                          }

                          setMetaSpriteEntries((prev) => [...prev, newEntry])

                          setSelectedId(newEntry.id);
                        }
                      }} 
                        />
              </div>
            </div>

            <div className="flex">
                <div className="flex flex-col">
                  <div className="flex flex-row justify-between w-full">
                    <h2 className="font-semibold">Tilesheet</h2>
                    {selectedTileCell && <span className="text-sm">Selected Tile: {tileIndex(selectedTileCell?.row ?? 0, selectedTileCell?.col ?? 0)}</span>}
                  </div>
                  <div className="mb-2 p-1 rounded-lg border border-indigo-900 bg-indigo-300">
                    <Tilesheet tiles={tiles} palette={palettes[currentPalette]} selected={selectedTileCell} onSelected={(selected) => {
                      setSelectedTileCell(selected);
                      setShowSpriteEditor(true);
                      setCurrentTile(tileIndex(selected?.row ?? 0, selected?.col ?? 0))
                    }}  />
                  </div>

                </div>
            </div>
            <div className="flex">
                <div className="flex flex-col">
                  <div className="flex flex-col w-full">
                    <h2 className="font-semibold">Palette</h2>
                    <div className="flex flex-col gap-2">
                      {paletteView}
                    </div>
                    <div className="flex flex-row gap-4">
                      <ColorPicker555 value={palettes[currentPalette][currentColor]} 
                        onColorChange={(nextHex) => {
                          setPalettes(prev =>
                            prev.map((palette, pi) => 
                            pi === currentPalette ? 
                              palette.map((hex, ci) => (ci === currentColor ? nextHex : hex))
                              : palette
                            ))
                        }}
                      />
                    </div>                    
                  </div>
                </div>
            </div>

          </div>
        </div>
        
        <div className="flex flex-row gap-10">
          <div className="w-208 flex flex-col">
                <div className="flex mb-2 ml-1">
                  <div className="flex flex-row gap-4">
                    <div className="flex flex-row gap-2">
                      <div className="w-fit h-fit select-none">
                        <input 
                            checked={highlightSelected} 
                            onChange={(e) => { setHighlightSelected(e.target.checked) }}  
                            type="checkbox" 
                            className="accent-blue-500 scale-150 focus:ring-2 focus:ring-blue-400" />
                    </div>
                    <label>Highlight selected sprite</label>
                    </div>
                    <div className="flex flex-row gap-2">
                      <div className="w-fit h-fit select-none">
                        <input 
                            checked={drawGrid} 
                            onChange={(e) => { setDrawGrid(e.target.checked) }}  
                            type="checkbox" 
                            className="accent-blue-500 scale-150 focus:ring-2 focus:ring-blue-400" />
                      </div>
                      <label>Draw Grid</label>
                    </div>
                  </div>
                </div>            
            <div className="flex flex-row gap-2 items-center">
              <div className="flex justify-between w-full items-center">
                <div className="flex flex-row gap-2 items-center">
                  <button onClick={flipHorizontal} className={[
                    "w-25 h-fit p-2 inline-flex items-center justify-center rounded-md",
                    "bg-slate-900 border border-white text-white",
                    "transition-colors hover:bg-slate-800 active:bg-slate-700",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                    ].join(" ")} title="Flip Horizontal">H Flip</button>
                  <button onClick={flipVertical} className={[
                    "w-25 h-fit p-2 inline-flex items-center justify-center rounded-md",
                    "bg-slate-900 border border-white text-white",
                    "transition-colors hover:bg-slate-800 active:bg-slate-700",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                    ].join(" ")} title="Flip Vertical">V Flip
                  </button>

                  <ChevronButton title="Shift Left" direction="left" onClick={() => shiftMetaSprite(-1, 0)} />
                  <ChevronButton title="Shift Right" direction="right" onClick={() => shiftMetaSprite(1, 0)} />
                  <ChevronButton title="Shift Up" direction="up" onClick={() => shiftMetaSprite(0, -1)} />
                  <ChevronButton title="Shift Down" direction="down" onClick={() => shiftMetaSprite(0, 1)} />
                  <ChevronButton title="Rotate CCW" direction="rotate-ccw" onClick={() => rotateMetaSpriteCCW()} />
                  <ChevronButton title="Rotate CW" direction="rotate-cw" onClick={() => rotateMetaSpriteCW()} />
                </div>

              </div>
            </div>
            <span className="mt-1">List of Sprites {metaSpriteEntries.length}</span>
            <SingleSelectList 
              maxHeight={200} 
              onDrop={(fromIndex, toIndex) => {
                  setMetaSpriteEntries(prev => moveItem(prev, fromIndex, toIndex));
              }}
              options={options} 
              value={selectedId} 
              onDeleteItem={(index) => setMetaSpriteEntries(prev => prev.filter(a => a.id !== index))}
              onChange={(id) => {
                setSelectedId(id);
              }} />
              <button className={[
                "mt-1",
                "w-35 h-fit p-2 inline-flex items-center justify-center rounded-md",
                "bg-slate-900 border border-white text-white",
                "transition-colors hover:bg-slate-800 active:bg-slate-700",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
            ].join(" ")} onClick={deleteAll}>Clear</button>
          </div>
        </div>
      </div>
    </div>


    <DraggableWindow 
      className="text-slate-700" 
      title="Tile Editor" 
      open={showSpriteEditor} 
      onClose={function (): void {
        setShowSpriteEditor(false);
      }}>
      <div className="flex flex-col">
        {/* <p className="text-xs text-slate-400 w-70">
          Paint with 16-color palette. Tools: Brush (B), Fill (F), Eyedropper (I), Eraser (E). Undo (Ctrl/Cmd+Z), Redo (Ctrl/Cmd+Y or Shift+Z).
        </p> */}

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
                    style={{ background: palettes[currentPalette][pix] ?? "#000" }}
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
            <div className="text-xs text-[#222222]">Shift pixels 
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
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-1 select-none">
          <div>
            <div className="text-xs text-[#222222]">Rotate&nbsp; 
              <button onClick={rotateTileCCW} className="p-1 rounded-md text-sm bg-transparent hover:bg-blue-100 active:bg-blue-200 active:text-white" title="Rotate Left (90° CCW)">
                  <FontAwesomeIcon className="text-xs text-[#333333]" icon={faRotateBackward}></FontAwesomeIcon>
              </button>,
              <button onClick={rotateTileCW} className="p-1 rounded-md text-sm bg-transparent hover:bg-blue-100 active:bg-blue-200 active:text-white" title="Rotate Right (90° CW)">
                  <FontAwesomeIcon className="text-xs text-[#333333]" icon={faRotateForward}></FontAwesomeIcon>
              </button>
            </div>
          </div>
        </div>                
        <div className="flex flex-col gap-1 select-none">
          <div>
            <div className="text-xs text-[#222222]">Flip&nbsp; 
              <button onClick={flipTileH} className="p-1 rounded-md text-sm bg-transparent hover:bg-blue-100 active:bg-blue-200 active:text-white" title="Flip Horizontal">
                  <FontAwesomeIcon className="text-xs text-[#333333]" icon={faArrowsLeftRight}></FontAwesomeIcon>
              </button>,
              <button onClick={flipTileV} className="p-1 rounded-md text-sm bg-transparent hover:bg-blue-100 active:bg-blue-200 active:text-white" title="Flip Vertical">
                  <FontAwesomeIcon className="text-xs text-[#333333]" icon={faArrowsUpDown}></FontAwesomeIcon>
              </button>
            </div>
          </div>
        </div>                

      </div>
    </DraggableWindow>
    
    </Fragment>
  );
}
