import { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { faPaintBrush, faFillDrip, faEyeDropper, faEraser } from "@fortawesome/free-solid-svg-icons";
import type {
  Cell,
  Metasprite,
  Palette,
  Region,
  Sheet,
  TileRegionPayload,
} from "@/types/EditorTypes";

export type ToolType = "brush" | "fill" | "picker" | "eraser";
export const toolIcon: Record<ToolType, IconDefinition> = {
  brush: faPaintBrush,
  fill: faFillDrip,
  picker: faEyeDropper,
  eraser: faEraser,
};

export type EditorDoc = {
  version: 1;

  // Core data
  tilesheets: Sheet[];
  metasprites: Metasprite[];
  palettes: Palette[];
  bgrPalettes: Palette[];

  // Current indices
  currentTilesheet: number;
  currentMetasprite: number;
  currentTile: number;
  currentPalette: number;
  currentColor: number;

  // UI / selection
  selectedIds: string[];
  selectedTileCell: Cell;
  selectedTileRegion?: Region;
  highlightSelected: boolean;
  drawGrid: boolean;
  showSpriteEditor: boolean;
  drawerOpen: boolean;

  // Tool (store only the type; icon is derived)
  tool: ToolType;

  // Clipboard (tile region)
  clipboard: TileRegionPayload | null;
};
