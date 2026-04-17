import React, { createContext, useState } from "react";
export const AdjacencyMatrixDataContext = createContext();

export const AdjacencyMatrixDataProvider = ({ children }) => {
  const [grid, setGrid] = useState([]);
  const [snap, setSnap] = useState(true);
  const [selectMode, setSelectMode] = useState("area");
  const [selectColor, setSelectColor] = useState("one");
  const [image, setImage] = useState(createWhiteImage(500, 500, 1000));

  function createWhiteImage(width, height, tileSize) {
    const rows = Math.ceil(height / tileSize);
    const cols = Math.ceil(width / tileSize);
    //console.log(height,height / tileSize,rows,cols);
    const canvases = new Array(rows)
      .fill(null)
      .map(() => new Array(cols).fill(null));

    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const canvas = document.createElement("canvas");
        canvas.width = tileSize;
        canvas.height = tileSize;
        const context = canvas.getContext("2d");
        context.fillStyle = "white";
        context.fillRect(0, 0, tileSize, tileSize);

        canvases[i][j] = canvas;
      }
    }

    return canvases;
  }

  function deleteImage() {
    setImage(createWhiteImage(500, 500, 1000));
    setGrid([]);
  }

  return (
    <AdjacencyMatrixDataContext.Provider
      value={{
        grid,
        setGrid,
        snap,
        setSnap,
        selectMode,
        setSelectMode,
        selectColor,
        setSelectColor,
        image,
        setImage,
        createWhiteImage,
        deleteImage,
      }}
    >
      {children}
    </AdjacencyMatrixDataContext.Provider>
  );
};
