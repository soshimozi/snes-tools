/* ------- Small UI subcomponent for RGB sliders/inputs ------- */
export default function ColorChannelInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="flex flex-col gap-2 w-20 items-center">
      <div className="flex flex-row items-center gap-1">
        <label>{label}</label>
        <input
          type="text"
          placeholder="000"
          value={(value ?? 0).toString().padStart(3, "0")}
          onChange={onChange}
          className="w-14 border rounded px-2 py-1 font-mono text-sm uppercase tracking-widest"
          title={`Enter ${label} Value`}
        />
      </div>
      <div className="flex justify-center">
        <input
          value={value ?? 0}
          max={248}
          onChange={onChange}
          type="range"
          className="w-20 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700
            [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:appearance-none
            [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:bg-blue-600 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:appearance-none"
        />
      </div>
    </div>
  );
}