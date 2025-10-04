import { SettingsPanel } from "@/components/SettingsPannel";
import { EditorDoc, editorDocToSettings } from "@/state/EditorDoc";
import { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import React, { useMemo } from "react";

export type Tile = number[][]; // [y][x] => 0..15 palette index
export type Palette = string[]; // 16 hex colors: "#RRGGBB"

export type Tool = {
  type: "brush" | "fill" | "picker" | "eraser";
  icon: IconDefinition
}

export type HistoryEntry = {
  tiles: Tile[];
};

export type MetaSpriteEntry = {
  id: string;
  tileSheetIndex: number;
  tileIndex: number;
  paletteIndex: number;
  x: number;
  y: number;
  h: boolean;
  v: boolean;
  r: number;
};


export type Cell = { row: number; col: number } | null;

export type Metasprite = {
  name: string;
  entries: MetaSpriteEntry[]
};

export type Sheet = {
  tiles: number[][][]
}

/** Region is expressed in tile units (cols/rows) with a tile-aligned top-left */
export type Region = {
  startCol: number;   // left (tile)
  startRow: number;   // top (tile)
  cols: number;  // width  (in tiles)
  rows: number;  // height (in tiles)
};

export type TileRegionPayload = {
  tiles: Tile[];   // row-major tiles
  rows: number;    // height (in tiles)
  cols: number;    // width  (in tiles)
};

export type SelectedTiles = {
  tilesheetIndex: number;         // which tilesheet to pull tiles from
  paletteIndex: number;           // which palette to color with
  tileIndices: number[][];        // 2D grid of tile indices (rows x cols)
  opacity?: number;               // optional preview alpha (0..1), default 1
};

export type DisplaySettings = {
  metaspriteHighlightSelected: boolean;
  metaspriteDrawGrid: boolean;
  showTransparencyColor0: boolean;
};

export type ExportSettings = {
  palettePrefix: string;
  tilesheetPrefix: string;
  metaspritePrefix: string;
};

export type ImportSettings = Record<string, never>; // Placeholder (empty for now)

export type SettingsModel = {
  display: DisplaySettings;
  importSettings: ImportSettings;
  exportSettings: ExportSettings;
};

export type SettingChange = {
  /** Dot-path to the setting that changed, e.g. "display.metaspriteDrawGrid" */
  path: string;
  /** Previous value of the specific setting */
  oldValue: unknown;
  /** New value of the specific setting */
  newValue: unknown;
  /** Full, updated settings object after the change */
  next: SettingsModel;
};

export type SettingsPanelProps = {
  /** Full managed settings object */
  value: SettingsModel;
  /** Emit the full next settings (controlled component pattern) */
  onChange: (next: SettingsModel) => void;
  /** Granular change event for analytics/undo logs/etc. */
  onSettingsChanged?: (change: SettingChange) => void;
  className?: string;
};

function ensureExportPrefixes(
  ep?: { palette: string; tilesheet: string; metasprite: string }
): { palette: string; tilesheet: string; metasprite: string } {
  return {
    palette: ep?.palette ?? "",
    tilesheet: ep?.tilesheet ?? "",
    metasprite: ep?.metasprite ?? "",
  };
}


// Apply a single SettingChange to an EditorDoc immutably
export function applySettingsChangeToDoc(doc: EditorDoc, change: SettingChange): EditorDoc {
  const next: EditorDoc = { ...doc };
  switch (change.path) {
    case "display.metaspriteHighlightSelected":
      next.highlightSelected = Boolean(change.newValue);
      break;
    case "display.metaspriteDrawGrid":
      next.drawGrid = Boolean(change.newValue);
      break;
    case "display.showTransparencyColor0":
      next.showIndex0Transparency = Boolean(change.newValue);
      break;
    case "exportSettings.palettePrefix": {
      const prev = ensureExportPrefixes(next.exportPrefixes);
      next.exportPrefixes = { ...prev, palette: String(change.newValue ?? "") };
      }
      break;
    case "exportSettings.tilesheetPrefix": {
      const prev = ensureExportPrefixes(next.exportPrefixes);
      next.exportPrefixes = { ...prev, tilesheet: String(change.newValue ?? "") };
      }
      break;
    case "exportSettings.metaspritePrefix": {
      const prev = ensureExportPrefixes(next.exportPrefixes);
      next.exportPrefixes = { ...prev, metasprite: String(change.newValue ?? "") };
      }
      break;
    default:
      // no-op for unknown paths; keeps forward-compatibility if you add more later
      break;
  }
  return next;
}

// Apply a full SettingsModel to EditorDoc (bulk update)
export function applySettingsModelToDoc(doc: EditorDoc, model: SettingsModel): EditorDoc {
  return {
    ...doc,
    highlightSelected: !!model.display.metaspriteHighlightSelected,
    drawGrid: !!model.display.metaspriteDrawGrid,
    showIndex0Transparency: !!model.display.showTransparencyColor0,
    exportPrefixes: {
      ...(doc.exportPrefixes ?? {}),
      palette: model.exportSettings.palettePrefix ?? "",
      tilesheet: model.exportSettings.tilesheetPrefix ?? "",
      metasprite: model.exportSettings.metaspritePrefix ?? "",
    },
  };
}

export function EditorSettingsBridge({
  doc,
  onDocChange,
  className,
}: {
  doc: EditorDoc;
  onDocChange: (next: EditorDoc) => void;
  className?: string;
}) {
  const settings = React.useMemo(() => editorDocToSettings(doc), [doc]);
  const handleChange = (nextModel: SettingsModel) => onDocChange(applySettingsModelToDoc(doc, nextModel));
  const handleChanged = (change: SettingChange) => onDocChange(applySettingsChangeToDoc(doc, change));

  return (
    <SettingsPanel
      className={className}
      value={settings}
      onChange={handleChange}
      onSettingsChanged={handleChanged}
    />
  );
}


/**
 * =============================
 * Mutable (in-place) variants — for engines that expect the updater to mutate the draft
 * =============================
 */
export function applySettingsChangeToDraft(draft: EditorDoc, change: SettingChange): void {
  switch (change.path) {
    case "display.metaspriteHighlightSelected":
      draft.highlightSelected = Boolean(change.newValue);
      return;
    case "display.metaspriteDrawGrid":
      draft.drawGrid = Boolean(change.newValue);
      return;
    case "display.showTransparencyColor0":
      draft.showIndex0Transparency = Boolean(change.newValue);
      return;
    case "exportSettings.palettePrefix": {
      const prev = ensureExportPrefixes(draft.exportPrefixes);
      draft.exportPrefixes = { ...prev, palette: String(change.newValue ?? "") };
      return;
    }
    case "exportSettings.tilesheetPrefix": {
      const prev = ensureExportPrefixes(draft.exportPrefixes);
      draft.exportPrefixes = { ...prev, tilesheet: String(change.newValue ?? "") };
      return;
    }
    case "exportSettings.metaspritePrefix": {
      const prev = ensureExportPrefixes(draft.exportPrefixes);
      draft.exportPrefixes = { ...prev, metasprite: String(change.newValue ?? "") };
      return;
    }
    default:
      return;
  }
}

export function applySettingsModelToDraft(draft: EditorDoc, model: SettingsModel): void {
  draft.highlightSelected = !!model.display.metaspriteHighlightSelected;
  draft.drawGrid = !!model.display.metaspriteDrawGrid;
  draft.showIndex0Transparency = !!model.display.showTransparencyColor0;
  draft.exportPrefixes = {
    ...(draft.exportPrefixes ?? {}),
    palette: model.exportSettings.palettePrefix ?? "",
    tilesheet: model.exportSettings.tilesheetPrefix ?? "",
    metasprite: model.exportSettings.metaspritePrefix ?? "",
  };
}


/**
 * Preferred wrapper for your mutable update engine
 * Pass your `update` from useUndoableState as `setDoc`.
 */
export function EditorSettingsBridgeMutable({
  doc,
  setDoc,
  className,
}: {
  doc: EditorDoc;
  setDoc: (updater: (draft: EditorDoc) => EditorDoc) => void;
  className?: string;
}) {
  const settings = useMemo(() => editorDocToSettings(doc), [doc]);

  const handleChange = (nextModel: SettingsModel) =>
    setDoc(d => {
      applySettingsModelToDraft(d, nextModel);
      return d; // mutate and return same draft
    });

  const handleChanged = (change: SettingChange) =>
    setDoc(d => {
      applySettingsChangeToDraft(d, change);
      return d;
    });

  return (
    <SettingsPanel
      className={className}
      value={settings}
      onChange={handleChange}
      onSettingsChanged={handleChanged}
    />
  );
}
