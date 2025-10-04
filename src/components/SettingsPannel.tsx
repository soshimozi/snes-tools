import { SettingsModel, SettingsPanelProps } from "@/types/EditorTypes";
import { useId, useState } from "react";

/**
 * Small primitives
 */
function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-5 w-5 transition-transform ${open ? "rotate-180" : "rotate-0"}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
    </svg>
  );
}

function Subsection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-base font-medium text-gray-900">{title}</h3>
        {description ? (
          <p className="text-sm text-gray-500 mt-0.5">{description}</p>
        ) : null}
      </div>
      <div className="grid gap-3">{children}</div>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-3 py-2">{children}</div>;
}

function Checkbox({
  id,
  label,
  checked,
  onChange,
  hint,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  hint?: string;
}) {
  return (
    <label htmlFor={id} className="flex items-start gap-3 select-none cursor-pointer">
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 h-5 w-5 rounded border-gray-300 focus:ring-2 focus:ring-indigo-500"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div>
        <span className="text-sm font-medium text-gray-900">{label}</span>
        {hint ? <p className="text-xs text-gray-500">{hint}</p> : null}
      </div>
    </label>
  );
}

function TextInput({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-gray-900">
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
    </div>
  );
}

/**
 * Utilities to immutably set a dot-path on the settings object
 */
function getAtPath(obj: any, path: string): unknown {
  return path.split(".").reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

function setAtPath<T extends object>(obj: T, path: string, value: unknown): T {
  const keys = path.split(".");
  const rootCopy: any = Array.isArray(obj) ? [...(obj as any)] : { ...(obj as any) };
  let cursor: any = rootCopy;
  keys.forEach((key, idx) => {
    if (idx === keys.length - 1) {
      cursor[key] = value;
    } else {
      const next = cursor[key];
      cursor[key] = Array.isArray(next) ? [...next] : { ...(next ?? {}) };
      cursor = cursor[key];
    }
  });
  return rootCopy as T;
}

/**
 * Accordion section — only one open at a time
 */
function AccordionSection({
  id,
  title,
  openId,
  setOpenId,
  children,
}: {
  id: string;
  title: string;
  openId: string;
  setOpenId: (id: string) => void;
  children: React.ReactNode;
}) {
  const isOpen = openId === id;
  const panelId = `${id}-panel`;
  const headerId = `${id}-header`;
  return (
    <section className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <button
        id={headerId}
        type="button"
        className="w-full flex items-center justify-between gap-3 px-5 py-3 text-left hover:bg-gray-50"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setOpenId(isOpen ? "" : id)}
      >
        <h2 className="text-lg font-semibold tracking-tight text-gray-900">{title}</h2>
        <Chevron open={isOpen} />
      </button>
      <div
        id={panelId}
        role="region"
        aria-labelledby={headerId}
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${
          isOpen ? "[grid-template-rows:1fr]" : "[grid-template-rows:0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="p-5">{children}</div>
        </div>
      </div>
    </section>
  );
}

/**
 * SettingsPanel (controlled component)
 * - Single managed settings object via `value`
 * - Emits `onChange(next)` for controlled updates
 * - Also emits granular `onSettingsChanged({ path, oldValue, newValue, next })`
 */
export function SettingsPanel({ value, onChange, onSettingsChanged, className }: SettingsPanelProps) {
  const uid = useId();
  const [openId, setOpenId] = useState<string>("display"); // only one open at a time

  const apply = (path: string, newValue: unknown) => {
    const oldValue = getAtPath(value, path);
    if (Object.is(oldValue, newValue)) return; // no-op
    const next = setAtPath<SettingsModel>(value, path, newValue);
    onChange(next);
    onSettingsChanged?.({ path, oldValue, newValue, next });
  };

  return (
    <div className={"grid gap-4 " + (className ?? "") }>
      {/* Display Settings */}
      <AccordionSection id="display" title="Display Settings" openId={openId} setOpenId={setOpenId}>
        <div className="grid gap-6">
          {/* Metasprite subsection */}
          <Subsection title="Metasprite">
            <Row>
              <Checkbox
                id={`${uid}-highlight-selected`}
                label="Highlight Selected Metasprite"
                checked={value.display.metaspriteHighlightSelected}
                onChange={(next) => apply("display.metaspriteHighlightSelected", next)}
              />
            </Row>
            <Row>
              <Checkbox
                id={`${uid}-draw-grid`}
                label="Draw Grid"
                checked={value.display.metaspriteDrawGrid}
                onChange={(next) => apply("display.metaspriteDrawGrid", next)}
              />
            </Row>
          </Subsection>

          <div className="h-px bg-gray-100" />

          {/* General subsection */}
          <Subsection title="General">
            <Row>
              <Checkbox
                id={`${uid}-show-transparency`}
                label="Show Transparency For Color 0"
                checked={value.display.showTransparencyColor0}
                onChange={(next) => apply("display.showTransparencyColor0", next)}
              />
            </Row>
          </Subsection>
        </div>
      </AccordionSection>

      {/* Import Settings */}
      <AccordionSection id="import" title="Import Settings" openId={openId} setOpenId={setOpenId}>
        <div className="text-sm text-gray-500 italic">(Reserved — following the same pattern later)</div>
      </AccordionSection>

      {/* Export Settings */}
      <AccordionSection id="export" title="Export Settings" openId={openId} setOpenId={setOpenId}>
        <div className="grid gap-6">
          <Subsection title="Palette">
            <TextInput
              id={`${uid}-palette-prefix`}
              label="Filename Prefix"
              value={value.exportSettings.palettePrefix}
              onChange={(next) => apply("exportSettings.palettePrefix", next)}
              placeholder="e.g., palette_"
            />
          </Subsection>

          <Subsection title="Tilesheet">
            <TextInput
              id={`${uid}-tilesheet-prefix`}
              label="Filename Prefix"
              value={value.exportSettings.tilesheetPrefix}
              onChange={(next) => apply("exportSettings.tilesheetPrefix", next)}
              placeholder="e.g., tiles_"
            />
          </Subsection>

          <Subsection title="Metasprite">
            <TextInput
              id={`${uid}-metasprite-prefix`}
              label="Filename Prefix"
              value={value.exportSettings.metaspritePrefix}
              onChange={(next) => apply("exportSettings.metaspritePrefix", next)}
              placeholder="e.g., meta_"
            />
          </Subsection>
        </div>
      </AccordionSection>
    </div>
  );
}