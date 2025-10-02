"use client"

import React, { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { DraggableWindow } from "./draggableWindow";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowDown, faArrowDownUpAcrossLine, faArrowLeft, faArrowRight, faArrowsLeftRight, faArrowsUpDown, faArrowUp, faChevronUp, faEraser, faEyeDropper, faFillDrip, faPaintBrush, faRotateBackward, faRotateForward, IconDefinition } from "@fortawesome/free-solid-svg-icons";
import { Cell, HistoryEntry, Metasprite, MetaSpriteEntry, Palette, Sheet, Tile, Tool } from "@/types/editorTypes";
import { v4 as uuid } from "uuid";
import { MultiSelect } from "./MultiSelect";
import { SingleSelectList } from "./singleSelectList";
import { MetaSpriteEditor } from "./metaSpriteEditor";
import { Region, Tilesheet } from "./tilesheet";
import { decodeSNES4bppTile, download, encodeSNES4bppTile, exportCGRAMBGR15, makeBlankTile, makeTiles, moveItem, parseHexColor, renderTilesheetToCanvas, renderTileToCanvas, tileIndex } from "@/helpers";
import { SCALE, TILE_H, TILE_W } from "@/app/constants";
import { ChevronButton } from "./chevronButton";
import ColorPicker555 from "./colorPicker555";
import StyledButton from "./styledButton";
import SytledCheckbox from "./styledCheckbox";
import StyledCheckbox from "./styledCheckbox";
import { LeftDrawer } from "./leftDrawer";
import { menuTree, type MenuNode } from "./menu";
import { DrawerMenu } from "./drawerMenu";

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

  static getBGR(index: number): [number, number, number] {
    return [
      Palettes.pal_b[index],
      Palettes.pal_g[index],
      Palettes.pal_r[index],
    ]
  }

  /** Get RGB as hex string like "#ffeeff" */
  static getRGBString(paletteIndex: number, colorIndex: number): string {
    const [r, g, b] = Palettes.getRGB(paletteIndex * 16 + colorIndex);
    const toHex = (n: number) => n.toString(16).padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  static getPalette(paletteIndex: number): string[] {
    let rgb = [];

    for (let i = 0; i < 16; i++) {
      rgb.push(Palettes.getRGBString(paletteIndex, i))
    }

    return rgb;
  }


  static getBGRPalette(paletteIndex: number): string[] {

    let bgr = [];

    const pal = Palettes.getPalette(0);

    for (let i = 0; i < 16; i++) {
      const color = Palettes.getBGR(paletteIndex * 16 + i)

      const bgrHexColor = (((color[0] & 0xf8) >> 3) << 10) | (((color[1] & 0xf8) >> 3) << 5) | (((color[2] & 0xf8) >> 3) & 0x1f);
      bgr.push(bgrHexColor.toString(16).padStart(4, '0'))
    }

    return bgr;

  }
}




function keyOfMetaSpriteEntry(e: MetaSpriteEntry) {
  return e.id;
}

export default function SNESpriteEditor() {
  //const [tiles, setTiles] = useState<number[][][]>(makeTiles());
  const [tilesheets, setTilesheets] = useState<Sheet[]>([
    {
      tiles: makeTiles()
    },
    {
      tiles: makeTiles()
    }
  ]);

  const [metasprites, setMetaSprites] = useState<Metasprite[]>(() => {
    const entries : Metasprite[] = [];
    for(let i = 0; i < 100; i++) {
      entries.push(
        {
          name: `Metasprite ${i.toString().padStart(2, "0")}`,
          entries: []
        }
      )
    }
    return entries;
  })

  const [currentMetasprite, setCurrentMetasprite] = useState(0);
  const [currentTilesheet, setCurrentTilesheet] = useState(0);

  const [currentTile, setCurrentTile] = useState(0);
  const [currentColor, setCurrentColor] = useState(1);
  const [tool, setTool] = useState<Tool>({ type: "brush", icon: faFillDrip });
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [selectedTileCell, setSelectedTileCell] = useState<Cell | null>(null);
  const [showSpriteEditor, setShowSpriteEditor] = useState(false);
  const [highlightSelected, setHighlightSelected] = useState(true);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawGrid, setDrawGrid] = useState(true);
  const [selectedTileRegion, setSelectedTileRegion] = useState<Region | undefined>();


  const [drawerOpen, setDrawerOpen] = useState(false);

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

  const [bgrPalettes, setBGRPalettes] = useState<Palette[]>(() => [
    Palettes.getBGRPalette(0),
    Palettes.getBGRPalette(1),
    Palettes.getBGRPalette(2),
    Palettes.getBGRPalette(3),
    Palettes.getBGRPalette(4),
    Palettes.getBGRPalette(5),
    Palettes.getBGRPalette(6),
    Palettes.getBGRPalette(7),
  ]);

  const [currentPalette, setCurrentPalette] = useState(0);


  const currentMetaSpriteEntries = useMemo(
    () =>
       metasprites[currentMetasprite].entries,
  [currentMetasprite, metasprites])

  // Build multi-line options for the list (memoized).
  const options = useMemo(
    () =>
      currentMetaSpriteEntries.map((entry) => ({
        value: keyOfMetaSpriteEntry(entry),
        lines: [
          `Tile: ${entry.tileIndex}, Sheet: ${entry.tileSheetIndex}, Palette: ${entry.paletteIndex}, x: ${entry.x}, y: ${entry.y}, h: ${entry.h ? 1 : 0}, v: ${entry.v ? 1 : 0}, r: ${entry.r}`,
        ],
      })),
    [currentMetaSpriteEntries]
  );



  const currentTiles = useMemo(() =>
    tilesheets[currentTilesheet].tiles, [tilesheets, currentTilesheet]
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
    return id ? currentMetaSpriteEntries.find((e) => keyOfMetaSpriteEntry(e) === id) ?? undefined : undefined;
  }, [selectedId, currentMetaSpriteEntries]);

  const currentRed = useMemo(() => {
    const colorHex = palettes[currentPalette][currentColor];

    const color = parseHexColor(colorHex);
    return color?.r
  }, [palettes, currentPalette, currentColor]);

  const currentBlue = useMemo(() => {
    const colorHex = palettes[currentPalette][currentColor];

    const color = parseHexColor(colorHex);
    return color?.b
  }, [palettes, currentPalette, currentColor]);

  const currentGreen = useMemo(() => {
    const colorHex = palettes[currentPalette][currentColor];

    const color = parseHexColor(colorHex);
    return color?.g
  }, [palettes, currentPalette, currentColor]);

  const currentColorValue = useMemo(() => {

    const colorHex = palettes[currentPalette][currentColor];
    const color = parseHexColor(colorHex);
    return color;

  }, [palettes, currentPalette, currentColor])

  const getToolByName = (name: "brush" | "fill" | "picker" | "eraser"): Tool => {
    switch (name) {
      case "brush":
        return { type: "brush", icon: faPaintBrush };
      case "fill":
        return { type: "fill", icon: faFillDrip };
      case "picker":
        return { type: "picker", icon: faEyeDropper };
      case "eraser":
        return { type: "eraser", icon: faEraser };
    }
  }

  // Keyboard shortcuts
  const tile = currentTiles[currentTile];

  // Painting ops
  const setPixel = useCallback((x: number, y: number, value: number) => {

    setTilesheets(prev => {

      return prev.map((item, idx) => {
        if (idx !== currentTilesheet) return item;

        const next = item.tiles.map(t => t.map(row => row.slice()));
        next[currentTile][y][x] = value & 0xF;

        return {
          ...item,
          tiles: next
        }
      })
    })

  }, [currentTilesheet, currentTile]);

  const floodFill = useCallback((x: number, y: number, _target: number | undefined, replacementRaw: number) =>{
    const tileIndex = currentTile;                 // snapshot to avoid stale closure
    const tilesheetIndex = currentTilesheet
    const replacement = replacementRaw & 0xF;

    setTilesheets(prev => {
      return prev.map((item, idx) => {
        if (idx !== tilesheetIndex) return item;

        const tiles = item.tiles.map(t => t.map(row => row.slice()));
        const width = TILE_W, height = TILE_H;

        // Defensive bounds check on the seed pixel
        if (x < 0 || y < 0 || x >= width || y >= height) return item;

        // Read the true target from state (ignore the passed-in if any)
        const startTarget = tiles[tileIndex][y][x] & 0xF;

        // Nothing to do if already that color
        if (startTarget === replacement) return item;

        // Clone (tile -> rows -> cells)
        const next = tiles.map(t => t.map(r => r.slice()));

        const visited = new Set<string>();
        const stack: [number, number][] = [[x, y]];

        while (stack.length) {
          const [cx, cy] = stack.pop()!;
          if (cx < 0 || cy < 0 || cx >= width || cy >= height) continue;

          const key = `${cx},${cy}`;
          if (visited.has(key)) continue;

          // Only fill matching target pixels
          if ((next[tileIndex][cy][cx] & 0xF) !== startTarget) continue;

          visited.add(key);
          next[tileIndex][cy][cx] = replacement;

          // 4-way neighbors
          stack.push([cx + 1, cy]);
          stack.push([cx - 1, cy]);
          stack.push([cx, cy + 1]);
          stack.push([cx, cy - 1]);
        }

        return {
          ...item,
          tiles: next
        }        
      })
    })

  }, [currentTile, currentTilesheet])


  // Mouse interactions
  const onCellDown = (x: number, y: number) => (e: React.MouseEvent) => {
    e.preventDefault();
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

  // Context menu disable for right-click erase
  useEffect(() => {
    const prevent = (e: MouseEvent) => e.preventDefault();
    document.addEventListener("contextmenu", prevent);
    return () => document.removeEventListener("contextmenu", prevent);
  }, []);


  const transformTile = useCallback((fn: (src: Tile) => Tile) => {

    console.log('transformTile: ', currentTilesheet);
    
    setTilesheets(prev => {

      return prev.map((item, idx) => {
        if (idx !== currentTilesheet) return item;

        const next = item.tiles.map(t => t.map(row => row.slice()));
        next[currentTile] = fn(next[currentTile]);

        return {
          ...item,
          tiles: next
        }
      })
    })

  }, [currentTile, currentTilesheet]);

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
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const nx = wrap8(x + dx);
        const ny = wrap8(y + dy);
        out[ny][nx] = src[y][x];
      }
    }
    return out;
  };

  // need to do this with collection
  const shiftMetaSprite = (dx: number, dy: number) => {

    const scale = SCALE * 8 * 16;
    const wrap = (n: number) => (((n % scale) + scale) % scale);

    setMetaSprites(prev => {

      return prev.map((item, idx) => {
        if (idx !== currentMetasprite) return item;

        const updated = item.entries.map(entry => entry.id === selectedId ? { ...entry, x: wrap(entry.x + dx), y: wrap(entry.y + dy)} : entry);

        return {
          ...item,
          entries: updated
        }
      })
    })                          


  };

  // need to do this with collection
  const deleteAll = () => {
    setMetaSprites(prev => {

      return prev.map((item, idx) => {
        if (idx !== currentMetasprite) return item;

        return {
          ...item,
          entries: []
        }
      })
    })                          

  }

  const flipHorizontal = () => {
    if (!selectedId) return;

    setMetaSprites(prev => {

      return prev.map((item, idx) => {
        if (idx !== currentMetasprite) return item;

        const updated = item.entries.map(entry => entry.id === selectedId ? { ...entry, h: !entry.h} : entry);

        return {
          ...item,
          entries: updated
        }
      })
    })                          

  }

  const flipVertical = () => {
    if (!selectedId) return;

    setMetaSprites(prev => {

      return prev.map((item, idx) => {
        if (idx !== currentMetasprite) return item;

        const updated = item.entries.map(entry => entry.id === selectedId ? { ...entry, v: !entry.v} : entry);

        return {
          ...item,
          entries: updated
        }
      })
    })                          


  }

  const rotateMetaSpriteCCW = () => {
    if (!selectedId) return;

    setMetaSprites(prev => {

      return prev.map((item, idx) => {
        if (idx !== currentMetasprite) return item;

        const updated = item.entries.map(entry => entry.id === selectedId ? { ...entry, r: (entry.r - 1) % 4} : entry);

        return {
          ...item,
          entries: updated
        }
      })
    })                          

  }


  const rotateMetaSpriteCW = () => {
    if (!selectedId) return;

    setMetaSprites(prev => {

      return prev.map((item, idx) => {
        if (idx !== currentMetasprite) return item;

        const updated = item.entries.map(entry => entry.id === selectedId ? { ...entry, r: (entry.r + 1) % 4} : entry);

        return {
          ...item,
          entries: updated
        }
      })
    })                          

    
  }

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


  function bgr555ToRgb(bgr555: number): { r: number; g: number; b: number } {
    // Extract the 5-bit color components using bitwise shifts and masks.
    const b5 = (bgr555 >> 10) & 0b11111;
    const g5 = (bgr555 >> 5) & 0b11111;
    const r5 = bgr555 & 0b11111;

    // Scale the 5-bit values (0-31) to 8-bit values (0-255).
    // This is done by shifting left by 3 and adding the higher bits.
    // The formula `(value << 3) | (value >> 2)` provides a more accurate
    // mapping than just `value << 3`.
    const r = (r5 << 3) | (r5 >> 2);
    const g = (g5 << 3) | (g5 >> 2);
    const b = (b5 << 3) | (b5 >> 2);

    return { r, g, b };
  }

  const handleBGRChange = ((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const num = parseInt(value, 16);

    const color = bgr555ToRgb(num);

    setBGRPalettes(prev =>
      prev.map((p, pi) =>
        pi === currentPalette || currentColor === 0 ?
          p.map((hex, ci) => (ci === currentColor ? num.toString(16).padStart(4, '0') : hex))
          : p
      ));

    const hexColor = `#${(color?.r & 0xf8).toString(16).padStart(2, '0')}${(color?.g & 0xf8).toString(16).padStart(2, '0')}${(color?.b & 0xf8).toString(16).padStart(2, '0')}`;

    setPalettes(prev =>
      prev.map((palette, pi) =>
        pi === currentPalette || currentColor === 0 ?
          palette.map((hex, ci) => (ci === currentColor ? hexColor : hex))
          : palette
      ))
  })

  const handleRedChanged = ((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);

    console.log('value: ', value)

    var color = currentColorValue;
    if (!color) return;

    const hexColor = `#${(value & 0xf8).toString(16).padStart(2, '0')}${(color.g & 0xf8).toString(16).padStart(2, '0')}${(color.b & 0xf8).toString(16).padStart(2, '0')}`;
    const bgrHexColor = (((color.b & 0xf8) >> 3) << 10) | (((color.g & 0xf8) >> 3) << 5) | ((value & 0xf8) >> 3)

    setPalettes(prev =>
      prev.map((palette, pi) =>
        pi === currentPalette || currentColor === 0 ?
          palette.map((hex, ci) => (ci === currentColor ? hexColor : hex))
          : palette
      ))

    setBGRPalettes(prev =>
      prev.map((p, pi) =>
        pi === currentPalette || currentColor === 0 ?
          p.map((hex, ci) => (ci === currentColor ? bgrHexColor.toString(16).padStart(4, '0') : hex))
          : p
      ));
  });

  const handleGreenChanged = ((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);

    var color = currentColorValue;
    if (!color) return;

    const hexColor = `#${(color.r & 0xf8).toString(16).padStart(2, '0')}${(value & 0xf8).toString(16).padStart(2, '0')}${(color.b & 0xf8).toString(16).padStart(2, '0')}`;
    const bgrHexColor = (((color.b & 0xf8) >> 3) << 10) | (((value & 0xf8) >> 3) << 5) | ((color.r & 0xf8) >> 3)

    setPalettes(prev =>
      prev.map((palette, pi) =>
        pi === currentPalette || currentColor === 0 ?
          palette.map((hex, ci) => (ci === currentColor ? hexColor : hex))
          : palette
      ))

    setBGRPalettes(prev =>
      prev.map((p, pi) =>
        pi === currentPalette || currentColor === 0 ?
          p.map((hex, ci) => (ci === currentColor ? bgrHexColor.toString(16).padStart(4, '0') : hex))
          : p
      ));
  })

  const handleBlueChanged = ((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);

    var color = currentColorValue;
    if (!color) return;

    const hexColor = `#${(color.r & 0xf8).toString(16).padStart(2, '0')}${(color.g & 0xf8).toString(16).padStart(2, '0')}${(value & 0xf8).toString(16).padStart(2, '0')}`;
    const bgrHexColor = (((value & 0xf8) >> 3) << 10) | (((color.g & 0xf8) >> 3) << 5) | ((color.r & 0xf8) >> 3)

    setPalettes(prev =>
      prev.map((palette, pi) =>
        pi === currentPalette || currentColor === 0 ?
          palette.map((hex, ci) => (ci === currentColor ? hexColor : hex))
          : palette
      ))

    setBGRPalettes(prev =>
      prev.map((p, pi) =>
        pi === currentPalette || currentColor === 0 ?
          p.map((hex, ci) => (ci === currentColor ? bgrHexColor.toString(16).padStart(4, '0') : hex))
          : p
      ));
  })

  const createMetaspriteEntry = useCallback((col: number, row: number) => {
    const newEntry: MetaSpriteEntry = {
      id: uuid(),
      tileSheetIndex: currentTilesheet,  // for now
      tileIndex: currentTile,
      paletteIndex: currentPalette, // for now
      x: col,
      y: row,
      h: false,
      v: false,
      r: 0
    }

    return newEntry;

  }, [currentTile, currentPalette, currentTilesheet]);

  const updateMetasprite = ({row, col} : {row: number, col: number}) => {
    if(!selectedTileCell) return;

    const newEntry =  createMetaspriteEntry(col, row);
    setMetaSprites(prev => {

      return prev.map((item, idx) => {
        if (idx !== currentMetasprite) return item;

        return {
          ...item,
          entries: [...item.entries, newEntry]
        }
      })
    })                          

    setSelectedId(newEntry.id);

  }

const onPick = useCallback((node: MenuNode) => {
    // route or command
    switch (node.id) {
      case "sprite":       
        if(selectedTileCell) setShowSpriteEditor(true); 
        break;

      case "tiles":      
        console.log("tiles"); 
        break;
      case "palette":    
        console.log("palette"); 
        break;
      case "settings":   
        console.log("settings"); 
        break;
      case "meta-export": 
        /* open export modal */ 
        break;
      // ...etc
    }
    setDrawerOpen(false); // close on selection (overlay mode)
  }, [selectedTileCell]);  

  function selectTile(selected: Cell): void {
      setSelectedTileCell(selected);
      setShowSpriteEditor(true);
      setCurrentTile(tileIndex(selected?.row ?? 0, selected?.col ?? 0));
  }

  return (

    <Fragment>
      <div className="min-h-screen">
      {/* Header / AppBar */}
      <header className="sticky top-0 z-30 border-b border-slate-200">
        <div className="flex items-center gap-3 px-4 py-3">
          <StyledButton
            className="cursor-pointer"
            width={24}
            onClick={() => setDrawerOpen(true)}
          >
            {/* Simple hamburger icon */}
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </StyledButton>

          <h1 className="text-2xl font-bold">SNES Sprite Editor (4bpp, 8×8 tiles)</h1>
        </div>
      </header>

      {/* Drawer (overlay on mobile, persistent on lg) */}
      <LeftDrawer
        open={drawerOpen}
        
        onClose={() => setDrawerOpen(false)}
        widthClass="w-64"
        persistentLg={false}
        ariaLabel="SNES tools navigation"
      >
        {/* Close button only visible on mobile/tablet */}
        <div className="lg:hidden flex justify-end p-2 border-b border-slate-200">
          <button
            onClick={() => setDrawerOpen(false)}
            className="inline-flex items-center justify-center h-8 w-8 rounded-md"
            aria-label="Close navigation"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6l-12 12" />
            </svg>
          </button>
        </div>
        <DrawerMenu tree={menuTree} onPick={onPick} accordion />        
        {/* <nav className="h-full flex flex-col bg-black">
          <div className="px-4 py-3 border-b"><h2 className="text-base font-semibold">SNES Tools</h2></div>
          <ul className="p-2 space-y-1 text-sm">
            <li><button className="w-full text-left px-3 py-2 rounded cursor-pointer" onClick={() => { setDrawerOpen(false); setShowSpriteEditor(true);}}>Tile Editor</button></li>
            <li><button className="w-full text-left px-3 py-2 rounded cursor-pointer" onClick={() => setDrawerOpen(false)}>Tilesheets</button></li>
            <li><button className="w-full text-left px-3 py-2 rounded cursor-pointer" onClick={() => setDrawerOpen(false)} >Palette</button></li>
            <li className="pt-2 border-t mt-2">
              <button className="w-full text-left px-3 py-2 rounded cursor-pointer" onClick={() => setDrawerOpen(false)} >Settings</button>
            </li>
          </ul>
          <div className="mt-auto p-3 border-t text-xs text-slate-500">v0.1 • 4bpp • 8×8</div>
        </nav> */}
      </LeftDrawer>

      {/* Main content area.
          On lg+, add left padding to make room for the persistent drawer. */}
      <main className="mt-2">
        <div className="mx-auto w-full">
          <div className="flex flex-row gap-10 justify-center">

            <div className="flex flex-col gap-1">

              <div className="flex flex-row justify-between items-center">
                <span className="text-sm font-bold">Metasprite Editor</span>
                {/* <span className="text-xs">Current Metasprite: {currentMetasprite.toString().padStart(2, "0")}</span> */}
                                      <div className="relative">
                    <select 
                      value={currentMetasprite} 
                      onChange={((e) => setCurrentMetasprite(parseInt(e.target.value)))}
                      className="w-full select-none bg-white placeholder:text-slate-400 text-slate-700 text-sm border border-slate-200 rounded pl-3 pr-8 py-1 transition duration-300 ease focus:outline-none focus:border-slate-400 hover:border-slate-400 shadow-sm focus:shadow-md appearance-none cursor-pointer">
                        {metasprites.map((ms, i) => {
                          return <option key={i} value={i}>{ms.name}</option>
                        })}
                    </select>           
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.2" stroke="currentColor" className="h-5 w-5 ml-1 absolute top-1.5 right-1.5 text-slate-700">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15 12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
                    </svg>    
                  </div>         

              </div>

              <div className="flex flex-col">
                <div className="mb-2 p-1 rounded-lg border-2 border-blue-400 bg-transparent">
                  <MetaSpriteEditor
                    entries={currentMetaSpriteEntries}
                    tilesheets={tilesheets}
                    drawGrid={drawGrid}
                    palettes={palettes}
                    highlightSelected={highlightSelected}
                    selected={selectedEntry}
                    onClick={updateMetasprite}
                  />
                </div>
                <div className="flex flex-row gap-10">
                  <div className="flex flex-col">
                    <div className="flex mb-2 ml-1">
                      <div className="flex flex-row gap-4">
                        <div className="flex flex-row gap-2">
                          <div className="w-fit h-fit select-none">
                            <StyledCheckbox checked={highlightSelected} onChange={(e) => { setHighlightSelected(e.target.checked) }} />
                          </div>
                          <label>Highlight selected sprite</label>
                        </div>
                        <div className="flex flex-row gap-2">
                          <div className="w-fit h-fit select-none">
                            <StyledCheckbox checked={drawGrid} onChange={(e) => { setDrawGrid(e.target.checked) }} />
                          </div>
                          <label>Draw Grid</label>
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-between w-full items-center">
                      <div className="flex flex-row gap-2 items-center">

                        <StyledButton width={25} onClick={flipHorizontal}>H Flip</StyledButton>
                        <StyledButton width={25} onClick={flipVertical}>V Flip</StyledButton>

                        <ChevronButton title="Shift Left" direction="left" onClick={() => shiftMetaSprite(-1, 0)} />
                        <ChevronButton title="Shift Right" direction="right" onClick={() => shiftMetaSprite(1, 0)} />
                        <ChevronButton title="Shift Up" direction="up" onClick={() => shiftMetaSprite(0, -1)} />
                        <ChevronButton title="Shift Down" direction="down" onClick={() => shiftMetaSprite(0, 1)} />
                        <ChevronButton title="Rotate CCW" direction="rotate-ccw" onClick={() => rotateMetaSpriteCCW()} />
                        <ChevronButton title="Rotate CW" direction="rotate-cw" onClick={() => rotateMetaSpriteCW()} />
                      </div>
                    </div>
                    <div className="flex flex-col w-130">
                      <div className="flex flex-row justify-between items-center"><span className="mt-1 text-sm">List of Sprites {currentMetaSpriteEntries.length}</span>
                        <StyledButton width={35} className="h-5" onClick={deleteAll}>Clear</StyledButton>
                      </div>
                      <SingleSelectList
                        maxHeight={200}
                        onDrop={(fromIndex, toIndex) => {
                          setMetaSprites(prev => {

                            return prev.map((item, idx) => {
                              if (idx !== currentMetasprite) return item;

                              const updated = moveItem(item.entries, fromIndex, toIndex);

                              return {
                                ...item,
                                entries: updated
                              }
                            })
                          })                          

                          // setMetaSpriteEntries(prev => moveItem(prev, fromIndex, toIndex));
                        }}
                        options={options}
                        value={selectedId}
                        onDeleteItem={(index) => {
                          setMetaSprites(prev => {

                            return prev.map((item, idx) => {
                              if (idx !== currentMetasprite) return item;

                              const updated = item.entries.filter(a => a.id !== index);

                              return {
                                ...item,
                                entries: updated
                              }
                            })
                          })                          

                        }
                          //setMetaSpriteEntries(prev => prev.filter(a => a.id !== index))
                        }
                        onChange={(id) => {
                          setSelectedId(id);
                        }} />
                    </div>
                  </div>
                </div>

              </div>

              
            </div>

            <div className="flex">
              <div className="flex flex-col gap-1">
                <div className="flex flex-row justify-between w-full items-center">
                  <span className="text-sm font-bold">Tilesheet</span>
                  <div className="relative">
                    <select
                      value={currentTilesheet}
                      onChange={((e) => setCurrentTilesheet(parseInt(e.target.value)))}
                      className="w-full select-none bg-white placeholder:text-slate-400 text-slate-700 text-sm border border-slate-200 rounded pl-3 pr-8 py-1 transition duration-300 ease focus:outline-none focus:border-slate-400 hover:border-slate-400 shadow-sm focus:shadow-md appearance-none cursor-pointer">
                      <option value="0">Tilesheet 0</option>
                      <option value="1">Tilesheet 1</option>
                    </select>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.2" stroke="currentColor" className="h-5 w-5 ml-1 absolute top-1.5 right-1.5 text-slate-700">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15 12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
                    </svg>
                  </div>

                </div>
                <div className="flex flex-col">
                  <div className="mb-2 p-1 rounded-lg border-2 border-blue-400 bg-transparent">
                    <Tilesheet tiles={currentTiles} 
                                palette={palettes[currentPalette]} 
                                selected={selectedTileCell} 
                                onSelected={selectTile} 
                                selectedRegion={selectedTileRegion} 
                                onRegionSelected={function (region?: Region): void {
                                    setSelectedTileRegion(region);
                                }} />
                  </div>
                  <div className="flex justify-end">
                    {selectedTileCell && <span className="text-xs">Selected Tile: {tileIndex(selectedTileCell?.row ?? 0, selectedTileCell?.col ?? 0)}</span>}
                  </div>
                </div>

              </div>
            </div>
            
            <div className="flex flex-col w-fit">
              <div className="flex flex-col gap-1">

                <div className="flex flex-row justify-between items-center">
                  <span className="text-sm font-bold">Palette Editor</span>
                    <div className="relative">
                      <select 
                        value={currentPalette} 
                        onChange={((e) => setCurrentPalette(parseInt(e.target.value)))}
                        className="w-full select-none bg-white placeholder:text-slate-400 text-slate-700 text-sm border border-slate-200 rounded pl-3 pr-8 py-1 transition duration-300 ease focus:outline-none focus:border-slate-400 hover:border-slate-400 shadow-sm focus:shadow-md appearance-none cursor-pointer">
                          {palettes.map((ms, i) => {
                            return <option key={i} value={i}>{`Palette ${i.toString().padStart(2, '0')}`}</option>
                          })}
                      </select>           
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.2" stroke="currentColor" className="h-5 w-5 ml-1 absolute top-1.5 right-1.5 text-slate-700">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15 12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
                      </svg>    
                    </div>         

                </div>

                <div className="flex flex-col gap-2">
                  {paletteView}
                </div>

                <div className="flex flex-row justify-between">
                  <div className="flex mt-4">
                    <ColorPicker555 value={palettes[currentPalette][currentColor]}
                      onColorChange={(nextHex, bgr) => {

                        setBGRPalettes(prev =>
                          prev.map((p, pi) =>
                            pi === currentPalette || currentColor === 0 ?
                              p.map((hex, ci) => (ci === currentColor ? bgr.toString(16).padStart(4, '0') : hex))
                              : p
                          ));

                        setPalettes(prev =>
                          prev.map((palette, pi) =>
                            pi === currentPalette || currentColor === 0 ?
                              palette.map((hex, ci) => (ci === currentColor ? nextHex : hex))
                              : palette
                          ))
                      }}
                    />
                  </div>
                  <div className="flex mt-4 flex-row items-center gap-2">
                    <label>HEX</label>
                    <input type="text"
                      placeholder="0000"
                      value={bgrPalettes[currentPalette][currentColor]}
                      onChange={handleBGRChange}
                      className="w-28 border rounded px-2 py-1 font-mono text-sm uppercase tracking-widest"
                      title="Enter 4 hex digits (bit15 auto-cleared)" />
                  </div>
                </div>

                <div className="flex flex-row mt-1 justify-between w-full">

                  <div className="flex flex-col gap-2 w-20 items-center">
                    <div className="flex flex-row items-center gap-1">
                      <label>R</label>
                      <input type="text"
                        placeholder="000"
                        value={currentRed?.toString().padStart(3, '0')}
                        onChange={handleRedChanged}
                        className="w-14 border rounded px-2 py-1 font-mono text-sm uppercase tracking-widest"
                        title="Enter Red Value" />
                    </div>
                    <div className="flex justify-center">
                      <input value={currentRed} max={248} onChange={handleRedChanged} type="range" className="w-20 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700
                              [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:appearance-none
                              [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:bg-blue-600 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:appearance-none"></input>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 w-20 items-center">

                    <div className="flex flex-row items-center gap-1">
                      <label>G</label>
                      <input type="text"
                        placeholder="000"
                        value={currentGreen?.toString().padStart(3, '0')}
                        onChange={handleGreenChanged}
                        className="w-14 border rounded px-2 py-1 font-mono text-sm uppercase tracking-widest"
                        title="Enter Green Value" />
                    </div>
                    <div className="flex justify-center">
                      <input onChange={handleGreenChanged} max={248} value={currentGreen} type="range" className="w-20 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700
                                  [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:appearance-none
                                  [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:bg-blue-600 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:appearance-none"></input>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 w-20 items-center">
                    <div className="flex flex-row items-center gap-1">
                      <label>B</label>
                      <input type="text"
                        placeholder="000"
                        value={currentBlue?.toString().padStart(3, '0')}
                        onChange={handleBlueChanged}
                        className="w-14 border rounded px-2 py-1 font-mono text-sm uppercase tracking-widest"
                        title="Enter Blue Value" />
                    </div>
                    <div className="flex justify-center">
                      <input value={currentBlue} max={248} onChange={handleBlueChanged} type="range" className="w-20 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700
                                  [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:appearance-none
                                  [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:bg-blue-600 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:appearance-none"></input>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      </main>

      </div>


      <DraggableWindow
        className="text-slate-700"
        title="Tile Editor"
        open={showSpriteEditor}
        onClose={function (): void {
          setShowSpriteEditor(false);
        }}>
        <div className="flex flex-col">
          <div className="flex flex-row gap-2">
            <div className="select-none w-fit" onMouseUp={stopStroke} onMouseLeave={stopStroke}>
              <div className="inline-grid"
                style={{ gridTemplateColumns: `repeat(${TILE_W}, 32px)`, gridTemplateRows: `repeat(${TILE_H}, 32px)` }}>
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
                <button key={i} onClick={() => setTool(t)} className={`p-1 rounded-md text-sm ${tool.type === t.type ? "bg-blue-600 text-white" : "bg-transparent hover:bg-slate-100"}`}>
                  <FontAwesomeIcon icon={t.icon} />
                </button>
              ))}
            </div>
          </div>
          <div className="flex w-70 flex-col mt-1 text-xs text-slate-500">Left-click to paint. Right-click to erase. Hold and drag to draw. Fill tool replaces contiguous region.</div>
          <div className="flex flex-col gap-1 select-none">
            <div>
              <div className="text-xs text-[#222222]">Shift pixels
                <button title="Shift pixels up"
                  className="p-1 rounded-md text-sm bg-transparent hover:bg-blue-100 active:bg-blue-200 active:text-white"
                  onClick={() => transformTile((src) => shiftTile(src, 0, -1))}>
                  <FontAwesomeIcon className="text-xs text-[#333333]" icon={faArrowUp}></FontAwesomeIcon>
                </button>,
                <button title="Shift pixels down"
                  className="p-1 rounded-md text-sm bg-transparent hover:bg-blue-100 active:bg-blue-200 active:text-white"
                  onClick={() => transformTile((src) => shiftTile(src, 0, 1))}>
                  <FontAwesomeIcon className="text-xs text-[#333333]" icon={faArrowDown}></FontAwesomeIcon>
                </button>,
                <button title="Shift pixels left"
                  className="p-1 rounded-md text-sm bg-transparent hover:bg-blue-100 active:bg-blue-200 active:text-white"
                  onClick={() => transformTile((src) => shiftTile(src, -1, 0))}>
                  <FontAwesomeIcon className="text-xs text-[#333333]" icon={faArrowLeft}></FontAwesomeIcon>
                </button>,
                <button title="Shift pixels right"
                  className="p-1 rounded-md text-sm bg-transparent hover:bg-blue-100 active:bg-blue-200 active:text-white"
                  onClick={() => transformTile((src) => shiftTile(src, 1, 0))}>
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
