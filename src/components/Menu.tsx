"use client";

import { ChevronRight, Settings, Images, Layers, Palette } from "lucide-react";

export type MenuNode = {
  id: string;
  label: string;
  href?: string;                 // if using router
  action?: () => void;           // or execute a command
  icon?: React.ReactNode;
  children?: MenuNode[];         // sub-items
};

export const menuTree: MenuNode[] = [
  {
    id: "sprite",
    label: "Sprite Editor",
    icon: <Layers className="h-4 w-4" />,
  },
  {
    id: "tiles",
    label: "Tiles",
    icon: <Images className="h-4 w-4" />,
    children: [
      { id: "tiles-import", label: "Import " },
      { id: "tiles-export", label: "Export"},
    ],
  },
  {
    id: "palette",
    label: "Palette",
    icon: <Palette className="h-4 w-4" />,
    children: [
      { id: "pal-load-full", label: "Load Full Palette" },
      { id: "pal-load-16", label: "Load 16 Colors" },
      { id: "pal-load-rgb", label: "Load Palette from RGB" },
      { id: "pal-save-full", label: "Save Full Palette" },
      { id: "pal-save-asm", label: "Save Palette as ASM" },
      { id: "pal-save-rgb", label: "Save Palette as RGB" },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    icon: <Settings className="h-4 w-4" />,
    action: () => {},
  },
];