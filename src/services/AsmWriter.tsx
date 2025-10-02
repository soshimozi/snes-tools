// AsmWriter.ts
type EOL = "\n" | "\r\n";

export class AsmWriter {
  private buf: string[] = [];
  private indent = "";
  constructor(private eol: EOL = "\n") {}

  line(s = "") { this.buf.push(this.indent + s); return this; }
  blank() { return this.line(); }
  comment(s: string) { return this.line(`; ${s}`); }
  label(name: string) { return this.line(`${name}:`); }
  dir(name: string, ...args: (string | number)[]) {
    const parts = args.map(a => String(a)).filter(Boolean).join(", ");
    return this.line(`.${name}${parts ? " " + parts : ""}`);
  }
  bytes(arr: number[]) { return this.dir("byte", ...arr.map(n => hex8(n & 0xff))); }
  words(arr: number[]) { return this.dir("word", ...arr.map(n => hex16(n & 0xffff))); }
  incbin(path: string) { return this.dir("incbin", `"${path}"`); }

  push() { this.indent += "  "; return this; }
  pop()  { this.indent = this.indent.slice(0, -2); return this; }

  toString() { return this.buf.join(this.eol) + this.eol; }
}

// Reuse helpers
export const hex8  = (n: number) => `$${n.toString(16).padStart(2, "0")}`;
export const hex16 = (n: number) => `$${n.toString(16).padStart(4, "0")}`;
