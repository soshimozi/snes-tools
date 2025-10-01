import React, { useCallback, useEffect, useMemo, useState } from "react";

/* ---------- helpers ---------- */
const to5 = (v8: number) => Math.min(31, Math.max(0, Math.round((v8 / 255) * 31)));
const to8 = (v5: number) => Math.min(255, Math.max(0, Math.round((v5 / 31) * 255)));

function parseHexColor(hex: string) {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}
function toHexColor(r: number, g: number, b: number) {
  const h = ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);
  return `#${h.toString(16).padStart(6, "0")}`.toUpperCase();
}

function packRGB555(r5: number, g5: number, b5: number) {
  return ((r5 & 0x1f) << 10) | ((g5 & 0x1f) << 5) | (b5 & 0x1f);
}
function unpackRGB555(rgb555: number) {
  console.log('number: ', rgb555)
  return { r5: (rgb555 >> 10) & 0x1f, g5: (rgb555 >> 5) & 0x1f, b5: rgb555 & 0x1f };
}

function rgb555ToBgr555(rgb555: number) {
  const { r5, g5, b5 } = unpackRGB555(rgb555);

  console.log('r5: ', r5)
  return ((b5 & 0x1f) << 10) | ((g5 & 0x1f) << 5) | (r5 & 0x1f);
}
function bgr555ToRgb555(bgr555: number) {
  const b5 = (bgr555 >> 10) & 0x1f;
  const g5 = (bgr555 >> 5) & 0x1f;
  const r5 = bgr555 & 0x1f;
  return packRGB555(r5, g5, b5);
}

function hexToRGB555(hex: string) {
  const c = parseHexColor(hex);

  console.log("hex: ", hex, " c: ", c);

  if (!c) return null;
  return packRGB555(to5(c.r), to5(c.g), to5(c.b));
}
function rgb555ToHex(rgb555: number) {
  const { r5, g5, b5 } = unpackRGB555(rgb555);
  return toHexColor(to8(r5), to8(g5), to8(b5));
}

/* ---------- component ---------- */
type Props = {
  /** Controlled #RRGGBB value (e.g. "#FF00AA") */
  value: string;
  /** Called whenever user picks a color or types a valid BGR555; pass new #RRGGBB to parent */
  onColorChange?: (rgbHex: string) => void;
  className?: string;
};

export default function ColorPicker555Controlled({ value, onColorChange, className }: Props) {

  // Normalize/validate the incoming value
  const normalizedHex = useMemo(() => {
    const parsed = parseHexColor(value);
    return parsed ? toHexColor(parsed.r, parsed.g, parsed.b) : "#000000";
  }, [value]);

  const normalizedBGR = useMemo(() => {
    const parsed = parseHexColor(value);
    if(!parsed) return null;

    const {r, g, b} = parsed;

    const normalizedR = r & 0xf8;
    const normalizedG = g & 0xf8;
    const normalizedB = b & 0xf8;

    const bgrHexColor = ((normalizedB >> 3) << 10) | ((normalizedG >> 3) << 5) | ((normalizedR >> 3) & 0x1f);

    return bgrHexColor;

  }, [value]);

  const emit = useCallback(
    (hex: string) => {
      const parsed = parseHexColor(hex);
      if (!parsed) return;
      onColorChange?.(toHexColor(parsed.r, parsed.g, parsed.b));
    },
    [onColorChange]
  );

  // Color picker changed
  const onPick = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {

    const color = parseHexColor(e.target.value.toUpperCase());

    if(!color) return;

    const {r, g, b} = color;

    // const normalizedR = r & 0xf8;
    // const normalizedG = g & 0xf8;
    // const normalizedB = b & 0xf8;

    const normalizedHexColor = toHexColor(r & 0xf8, g & 0xf8, b & 0xf8);
    
    emit(normalizedHexColor);
  }, [emit]);


  return (
    <div className={`flex flex-col gap-1 mt-4 max-w-md ${className ?? ""}`}>
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

      {/* <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-sm font-medium mb-1">
            BGR555 (4-digit hex)
          </label>
          <div className="flex items-center gap-2">
            <span className="text-slate-500">0x</span>
            <input
              type="text"
              value={bgrInput}
              onChange={onBgrInputChange}
              placeholder="0000"
              className="w-28 border rounded px-2 py-1 font-mono text-sm uppercase tracking-widest"
              title="Enter 4 hex digits, e.g. 1234 (bit15=0)"
            />
            <span className="text-xs text-slate-500">(bit15=0)</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Field order <span className="font-mono">BBBBB GGGGG RRRRR</span>
          </p>
        </div>

      </div> */}

    </div>
  );
}
