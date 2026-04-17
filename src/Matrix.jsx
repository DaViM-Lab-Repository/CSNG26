import React, { useState } from "react";
import "./styles/Matrix.css";

const Matrix = ({ matrix, onSelectRegion }) => {
  const [selection, setSelection] = useState({ start: null, end: null });
  const [selectedCells, setSelectedCells] = useState([]);

  const handleMouseDown = (i, j) => {
    setSelection({ start: { i, j }, end: { i, j } });
  };

  const handleMouseUp = () => {
    onSelectRegion(selection);
    setSelectedCells(calculateSelectedCells());
    setSelection({ start: null, end: null });
  };

  const handleMouseOver = (i, j) => {
    if (selection.start) {
      setSelection({ ...selection, end: { i, j } });
    }
  };

  const calculateSelectedCells = () => {
    const cells = [];

    if (!selection.start || !selection.end) return cells;

    const iMin = Math.min(selection.start.i, selection.end.i);
    const iMax = Math.max(selection.start.i, selection.end.i);
    const jMin = Math.min(selection.start.j, selection.end.j);
    const jMax = Math.max(selection.start.j, selection.end.j);

    for (let i = iMin; i <= iMax; i++) {
      for (let j = jMin; j <= jMax; j++) {
        cells.push(`${i}-${j}`);
      }
    }

    return cells; // Clear the previous selection and return only the new selection
  };

  const isSelected = (i, j) => {
    if (matrix[i][j] == 1) return false;

    if (selectedCells.includes(`${i}-${j}`)) {
      return true;
    }

    if (!selection.start || !selection.end) return false;

    const iMin = Math.min(selection.start.i, selection.end.i);
    const iMax = Math.max(selection.start.i, selection.end.i);
    const jMin = Math.min(selection.start.j, selection.end.j);
    const jMax = Math.max(selection.start.j, selection.end.j);

    return i >= iMin && i <= iMax && j >= jMin && j <= jMax;
  };

  return (
    <div
      className="matrix-container"
      style={{ gridTemplateColumns: `repeat(${matrix[0].length}, auto)` }}
      onMouseUp={handleMouseUp}
    >
      {matrix.map((row, i) =>
        row.map((value, j) => (
          <div
            key={`${i}-${j}`}
            className={`cell ${isSelected(i, j) ? "selected" : ""} ${
              value === 1 ? "black" : ""
            }`}
            onMouseDown={() => handleMouseDown(i, j)}
            onMouseOver={() => handleMouseOver(i, j)}
          />
        ))
      )}
    </div>
  );
};

export default Matrix;
