"use client";

import { parseHexColor, toHexColor } from "@/Helpers";
import React, { useCallback, useEffect, useMemo, useState } from "react";

/* ---------- helpers ---------- */
const to5 = (v8: number) => Math.min(31, Math.max(0, Math.round((v8 / 255) * 31)));
const to8 = (v5: number) => Math.min(255, Math.max(0, Math.round((v5 / 31) * 255)));



/* ---------- component ---------- */
type Props = {
  /** Controlled #RRGGBB value (e.g. "#FF00AA") */
  value: string;
  onColorChange?: (rgbHex: string, bgr: number) => void;
  className?: string;
};

export default function ColorPicker555Controlled({ value, onColorChange, className }: Props) {

  // Normalize/validate the incoming value
  const normalizedHex = useMemo(() => {
    const parsed = parseHexColor(value);
    return parsed ? toHexColor(parsed.r, parsed.g, parsed.b) : "#000000";
  }, [value]);

  const emit = useCallback(
    (hex: string, bgr: number) => {
      const parsed = parseHexColor(hex);
      if (!parsed) return;
      onColorChange?.(toHexColor(parsed.r, parsed.g, parsed.b), bgr);
    },
    [onColorChange]
  );

  // Color picker changed
  const onPick = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {

    const chosen = (e.target.value || "").toUpperCase();

    const color = parseHexColor(chosen);
    if(!color) return;

    const normalizedHexColor = toHexColor(color.r & 0xf8, color.g & 0xf8, color.b & 0xf8);

    const bgrHexColor = (((color.b & 0xf8) >> 3) << 10) | (((color.g & 0xf8) >> 3) << 5) | (((color.r & 0xf8) >> 3) & 0x1f);

    emit(normalizedHexColor, bgrHexColor);
  }, [emit]);


  return (
    <div className={`flex flex-col gap-1 max-w-md ${className ?? ""}`}>
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium">Color picker</label>
        <input
          type="color"
          value={normalizedHex}
          onChange={onPick}
          className="h-9 w-9 p-0 border rounded cursor-pointer"
          title="Pick a color"
        />
      </div>

    </div>
  );
}
