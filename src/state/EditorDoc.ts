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

  showIndex0Transparency: boolean; // NEW
};


// near your Contextable type:
export type PasteMode =
  | "as-is"
  | "xor"
  | "or"
  | "and";


export type PasteOptions = {
  mode?: PasteMode;          // default "as-is"
  includeZeroSrc?: boolean;  // default false; if true, 0 participates in ops
}
// ---- NEW: Context-menu props ----
export type Contextable = {
  /** If provided, enables copy item when it returns true for current selection/region */
  canCopy?: (ctx: { cell: Cell | null; region?: Region }) => boolean;
  /** If provided, enables paste item when it returns true for the click location/selection */
  canPaste?: (ctx: { cell: Cell | null; region?: Region }) => boolean;
  onCopy?: (ctx: { cell: Cell | null; region?: Region }) => void;
  onPaste?: (ctx: { at: Cell; cell: Cell | null; region?: Region }) => void;
  onDelete?: (ctx: { cell: Cell | null; region?: Region }) => void;
  onPasteSpecial?: (ctx: { at: Cell; cell: Cell | null; region?: Region; mode: PasteMode }) => void;
  /**
   * Optional: notify parent the user opened the context menu.
   * Use this if you want to manage your own menu. If you return true, built-in menu won't show.
   */
  onContextMenuOpen?: (ctx: { mouse: { x: number; y: number }, at: Cell, cell: Cell | null, region?: Region }) => boolean | void;
};
