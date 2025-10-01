import React from "react";
import { Palette, Tile } from "@/types/editorTypes";
import { TILE_H, TILE_W } from "@/app/constants";

// export type Tile = number[][]; // [y][x] => 0..15 palette index

const TileView: React.FC<{tile: Tile, palette: Palette, tileIndex: number, scale?: number, selected?: boolean}> = ({tile, palette, tileIndex, scale = 16, selected = false}) => {

  const borderStyle = {
    border: selected ? "solid 2px blue" : "solid 1px #ccc"
  }

  return (
    <div style={{ width: `${scale * TILE_W}px`, height: `${scale * TILE_H}px`, ...borderStyle }}>
        <canvas width="100%">

        </canvas>
    </div>
  )
                    

}


export default TileView;