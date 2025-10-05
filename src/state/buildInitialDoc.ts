import { Palettes } from "@/Palettes";
import { EditorDoc } from "./EditorDoc";
import { makeTiles } from "@/misc/Helpers";

export function buildInitialDoc(): EditorDoc {
  const metasprites = Array.from({ length: 100 }, (_, i) => ({
    name: `Metasprite ${i.toString().padStart(2, "0")}`,
    entries: [],
  }));

  return {
    version: 1,

    tilesheets: [{ tiles: makeTiles() }, { tiles: makeTiles() }],
    metasprites,

    palettes: [
      Palettes.getPalette(0),
      Palettes.getPalette(1),
      Palettes.getPalette(2),
      Palettes.getPalette(3),
      Palettes.getPalette(4),
      Palettes.getPalette(5),
      Palettes.getPalette(6),
      Palettes.getPalette(7),
    ],
    bgrPalettes: [
      Palettes.getBGRPalette(0),
      Palettes.getBGRPalette(1),
      Palettes.getBGRPalette(2),
      Palettes.getBGRPalette(3),
      Palettes.getBGRPalette(4),
      Palettes.getBGRPalette(5),
      Palettes.getBGRPalette(6),
      Palettes.getBGRPalette(7),
    ],

    currentTilesheet: 0,
    currentMetasprite: 0,
    currentTile: 0,
    currentPalette: 0,
    currentColor: 1,

    selectedIds: [],
    selectedTileCell: {row: 0, col: 0},
    selectedTileRegion: undefined,
    highlightSelected: true,
    drawGrid: true,
    showSpriteEditor: false,
    drawerOpen: false,

    tool: "brush",
    clipboard: null,
    showIndex0Transparency: false, // NEW
    exportPrefixes: { palette: "", tilesheet: "", metasprite: "" },
  };
}
