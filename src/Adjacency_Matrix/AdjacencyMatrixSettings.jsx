import React, { useState, useEffect, useContext } from "react";
import { Box, Grid2, Button } from "@mui/material";
import { CustomCheckBox, CustomSelect } from "../components/CustomComponents";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import DeleteIcon from "@mui/icons-material/Delete";
import { AdjacencyMatrixDataContext } from "../context/AdjacencyMatrixDataContext";

const AdjacencyMatrixSettings = () => {
  const {
    snap,
    setSnap,
    selectMode,
    setSelectMode,
    selectColor,
    setSelectColor,
    deleteImage,
    image,
  } = useContext(AdjacencyMatrixDataContext);

  return (
    <Box sx={{ p: 3 }}>
      <Grid2 container spacing={2}>
        <CustomSelect
          label="Select Mode"
          value={selectMode}
          onChange={setSelectMode}
          options={[
            { value: "single", label: "Single" },
            { value: "area", label: "Area" },
            { value: "row", label: "Row" },
            { value: "col", label: "Column" },
          ]}
        />
        <CustomSelect
          label="Select Color"
          value={selectColor}
          onChange={setSelectColor}
          options={[
            { value: "one", label: "Single Color" },
            { value: "two", label: "Query + Neighbor" },
          ]}
        />
        <CustomCheckBox
          label="Snap"
          checked={snap}
          onChange={setSnap}
        />
        <Button
          component="label"
          variant="contained"
          tabIndex={-1}
          startIcon={<PlayArrowIcon />}
          fullWidth
          sx={{ flexGrow: 1 }}
          onClick={() => window.dispatchEvent(new Event("setPixels"))}
        >
          Render
        </Button>
        <Button
          variant="contained"
          fullWidth
          sx={{ flexGrow: 1 }}
          tabIndex={-1}
          startIcon={<DeleteIcon />}
          onClick={deleteImage}
          disabled={image.length === 1}
        >
          Delete Image
        </Button>
      </Grid2>
    </Box>
  );
};

export default AdjacencyMatrixSettings;
