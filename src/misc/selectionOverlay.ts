// selectionOverlay.ts
import type { MetaSpriteEntry } from "@/types/EditorTypes";
import { clusterByGridAdjacency } from "./gridClusters";

function strokeRectDashed(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,dash=[4,3],lw=1,color="#3b82f6"){
  ctx.save(); ctx.setLineDash(dash); ctx.lineWidth=lw; ctx.strokeStyle=color;
  ctx.strokeRect(Math.round(x)+0.5, Math.round(y)+0.5, Math.round(w)-1, Math.round(h)-1);
  ctx.restore();
}
function strokeRectSolid(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,lw=2,color="#f59e0b"){
  ctx.save(); ctx.setLineDash([]); ctx.lineWidth=lw; ctx.strokeStyle=color;
  ctx.strokeRect(Math.round(x)+0.5, Math.round(y)+0.5, Math.round(w)-1, Math.round(h)-1);
  ctx.restore();
}
function fillTint(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,rgba="rgba(59,130,246,0.17)"){
  ctx.save(); ctx.fillStyle=rgba; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); ctx.restore();
}
function isOffGrid(e:MetaSpriteEntry, cellSize:number, tol=0.5){
  const mod = (v:number,m:number)=>((v % m)+m)%m;
  const fx = mod(e.x, cellSize), fy = mod(e.y, cellSize);
  const near = (v:number)=> (v<=tol || Math.abs(v-cellSize)<=tol);
  return !(near(fx)&&near(fy));
}
function drawOffGridMarker(ctx:CanvasRenderingContext2D, e:MetaSpriteEntry, cellSize:number){
  const s = Math.max(4, Math.floor(cellSize*0.12));
  ctx.save(); ctx.fillStyle="rgba(245,158,11,0.9)";
  ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x+s, e.y); ctx.lineTo(e.x, e.y+s); ctx.closePath(); ctx.fill(); ctx.restore();
}

export function drawSelectionOverlay(
  ctx: CanvasRenderingContext2D,
  selectedEntries: MetaSpriteEntry[] | undefined,
  cellSize: number,
  showClusterHull = true
) {
  if (!selectedEntries?.length) return;

  // A) per-tile at true positions (shows nudges)
  for (const e of selectedEntries) {
    fillTint(ctx, e.x, e.y, cellSize, cellSize);
    strokeRectDashed(ctx, e.x, e.y, cellSize, cellSize, [4,3], 2, "#3b82f6");
    if (isOffGrid(e, cellSize)) drawOffGridMarker(ctx, e, cellSize);
  }

  // // B) primary (first in the array)
  // const primary = selectedEntries[0];
  // strokeRectSolid(ctx, primary.x, primary.y, cellSize, cellSize, 2, "#f59e0b");

  // C) cluster hull(s) snapped to grid
  // if (showClusterHull && selectedEntries.length > 1) {
  //   const clusters = clusterByGridAdjacency(selectedEntries.slice(1), cellSize);
  //   for (const c of clusters) {
  //     const x = c.minCol * cellSize;
  //     const y = c.minRow * cellSize;
  //     const w = (c.maxCol - c.minCol + 1) * cellSize;
  //     const h = (c.maxRow - c.minRow + 1) * cellSize;
  //     strokeRectDashed(ctx, x, y, w, h, [8,4], 1, "rgba(99,102,241,0.95)");
  //   }
  // }
}
