// gridClusters.ts
import type { MetaSpriteEntry } from "@/types/EditorTypes";

export type SelCluster = {
  members: MetaSpriteEntry[];
  minCol: number; minRow: number; maxCol: number; maxRow: number;
};

const EPS = 1e-6;
const key = (c:number, r:number) => `${c},${r}`;

export function colRowFor(e: MetaSpriteEntry, cellSize: number) {
  // nearest grid cell (handles nudged sprites)
  const col = Math.round((e.x + EPS) / cellSize);
  const row = Math.round((e.y + EPS) / cellSize);
  return { col, row };
}

export function clusterByGridAdjacency(
  selectedEntries: MetaSpriteEntry[] | undefined,
  cellSize: number
): SelCluster[] {
  if (!selectedEntries?.length) return [];

  const nodes = selectedEntries.map(e => ({ e, ...colRowFor(e, cellSize) }));
  const byCell = new Map<string, { e: MetaSpriteEntry; col: number; row: number }>();
  for (const n of nodes) byCell.set(key(n.col, n.row), n);

  const seen = new Set<string>();
  const out: SelCluster[] = [];

  for (const n of nodes) {
    const start = key(n.col, n.row);
    if (seen.has(start)) continue;

    const q = [n];
    const members: MetaSpriteEntry[] = [];
    const cols: number[] = [];
    const rows: number[] = [];
    seen.add(start);

    while (q.length) {
      const cur = q.shift()!;
      members.push(cur.e);
      cols.push(cur.col); rows.push(cur.row);

      for (const [dc, dr] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nk = key(cur.col + dc, cur.row + dr);
        if (!seen.has(nk) && byCell.has(nk)) {
          seen.add(nk);
          q.push(byCell.get(nk)!);
        }
      }
    }

    out.push({
      members,
      minCol: Math.min(...cols),
      maxCol: Math.max(...cols),
      minRow: Math.min(...rows),
      maxRow: Math.max(...rows),
    });
  }

  return out;
}
