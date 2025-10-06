"use client";

import { ChevronRight, Settings, Images, Layers, Palette, Save, SaveAll, SquareChartGantt, Binary, Image, Loader, FolderOpen } from "lucide-react";

export type NodeIdType =  "pal-save-asm" | "pal-save-rgb" | "pal-save-full" | "pal-save-all" |
                          "pal-save-current" | "pal-save-cur-asm" | "pal-save-cur-rgb" | "pal-save-cur-full" | "pal-load" |
                          "pal-load-full" | "pal-load-16" | "pal-load-rgb" | 
                          "tiles-import" | "tiles-export" | "sprite" | "tiles" | 
                          "palette" | "settings";

export type MenuNode = {
  id: NodeIdType;
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
      {id: "pal-load", label: "Load", icon: <FolderOpen className="h-4 w-4" />, children: [
      { id: "pal-load-full", label: "Load Full Palette" },
      { id: "pal-load-16", label: "Load 16 Colors" },
      { id: "pal-load-rgb", label: "Load Palette from RGB" },
      ]
      },
      { 
        id: "pal-save-all", 
        label: "Save Full Palette",
        icon: <SaveAll className="h-4 w-4" />,
        children: [
          { id: "pal-save-asm", label: "Save as ASM", icon: <SquareChartGantt className="h-4 w-4" /> },
          { id: "pal-save-rgb", label: "Save as RGB", icon: <Image className="h-4 w-4" /> },
          { id: "pal-save-full", label: "Save as BIN", icon: <Binary className="h-4 w-4" />  },
        ]
       },
       {
        id: "pal-save-current", 
        label: "Save Current Palette",
        icon: <Save className="h-4 w-4" />,
        children: [
          { id: "pal-save-cur-asm", label: "Save as ASM", icon: <SquareChartGantt className="h-4 w-4" /> },
          { id: "pal-save-cur-full", label: "Save as BIN", icon: <Binary className="h-4 w-4" /> },
        ]
       }
    ],
  },
  {
    id: "settings",
    label: "Settings",
    icon: <Settings className="h-4 w-4" />,
  },
];