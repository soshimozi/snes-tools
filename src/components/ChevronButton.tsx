import * as React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronRight,
  faChevronLeft,
  faChevronUp,
  faChevronDown,
  faRotateBackward,
  faRotateForward,
} from "@fortawesome/free-solid-svg-icons";

type Direction = "right" | "left" | "up" | "down" | "rotate-ccw" | "rotate-cw";

const iconFor: Record<Direction, any> = {
  right: faChevronRight,
  left: faChevronLeft,
  up: faChevronUp,
  down: faChevronDown,
  "rotate-ccw": faRotateBackward,
  "rotate-cw": faRotateForward
};

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  direction?: Direction; // pick which chevron you want
};

export function ChevronButton({
  direction = "right",
  className = "",
  ...rest
}: Props) {
  return (
    <button
      type="button"
      aria-label={`Chevron ${direction}`}
      className={[
        // size & layout
        "w-6 h-6 inline-flex items-center justify-center rounded-md",
        // colors
        "bg-slate-900 border border-white text-white",
        // interaction
        "transition-colors hover:bg-slate-800 active:bg-slate-700",
        // focus ring
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900",
        className,
      ].join(" ")}
      {...rest}
    >
      {/* icon ~14px inside a 24px square */}
      <FontAwesomeIcon className="w-[14px] h-[14px]" icon={iconFor[direction]} />
    </button>
  );
}
