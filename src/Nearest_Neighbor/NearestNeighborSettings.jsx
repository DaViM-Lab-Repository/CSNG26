import React, { useState, useEffect, useContext } from "react";
import {
  CustomCheckBox,
  CustomNumberInput,
  CustomSelect,
} from "../components/CustomComponents";
import {
  Button,
  Box,
  Grid2,
  Typography,
  CircularProgress,
} from "@mui/material";
import { LoadingButton } from "@mui/lab";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import DeleteIcon from "@mui/icons-material/Delete";
import { UniversalDataContext } from "../context/UniversalDataContext";
import { GraphCommunitiesDataContext } from "../context/GraphCommunitiesDataContext";
import { NearestNeighborDataContext } from "../context/NearestNeighborDataContext";
import { AdjacencyMatrixDataContext } from "../context/AdjacencyMatrixDataContext.jsx";
const NearestNeighborWorker = new Worker(
  new URL("./NearestNeighborWorker.jsx", import.meta.url),
  { type: "module" }
);
import NearestNeighborRuntime from "./NearestNeighborRuntime.jsx";
import { packSegments } from "../Segment.jsx";

const NearestNeighborSettings = () => {
  const { segments, streamLines } = useContext(UniversalDataContext);
  const { dGraphData, setDGraphData } = useContext(GraphCommunitiesDataContext);
  const {
    treeAlgorithm,
    setTreeAlgorithm,
    k,
    setK,
    r,
    setR,
    distanceMetric,
    setDistanceMetric,
    exclude,
    setExclude,
    progress,
    setProgress,
    doSort,
    setDoSort,
    sortType,
    setSortType,
  } = useContext(NearestNeighborDataContext);

  useEffect(() => {
    if (segments && segments.length > 0) {
      if (treeAlgorithm === "KNN")
        NearestNeighborWorker.postMessage({
          constructTree: true,
          doSort: doSort,
          param: k,
          unmodifiedSegments: packSegments(segments),
          treeAlgorithm: treeAlgorithm,
          distanceMetric: distanceMetric,
          unmodifiedStreamLines: streamLines,
          exclude: exclude,
          sortType: sortType,
        });
      else
        NearestNeighborWorker.postMessage({
          constructTree: true,
          doSort: doSort,
          param: r,
          unmodifiedSegments: packSegments(segments),
          treeAlgorithm: treeAlgorithm,
          distanceMetric: distanceMetric,
          unmodifiedStreamLines: streamLines,
          exclude: exclude,
          sortType: sortType,
        });
    }
  }, [segments]);

  const handleSearch = async () => {
    NearestNeighborWorker.addEventListener("message", searchCallback, false);
    if (treeAlgorithm === "KNN")
      NearestNeighborWorker.postMessage({
        constructTree: false,
        doSort: doSort,
        param: k,
        unmodifiedSegments: packSegments(segments),
        treeAlgorithm: treeAlgorithm,
        distanceMetric: distanceMetric,
        unmodifiedStreamLines: streamLines,
        exclude: exclude,
        sortType: sortType,
      });
    else
      NearestNeighborWorker.postMessage({
        constructTree: false,
        doSort: doSort,
        param: r,
        unmodifiedSegments: packSegments(segments),
        treeAlgorithm: treeAlgorithm,
        distanceMetric: distanceMetric,
        unmodifiedStreamLines: streamLines,
        exclude: exclude,
        sortType: sortType,
      });
  };

  const searchCallback = (event) => {
    if (event.data.type == "final") {
      setProgress(100);
      NearestNeighborWorker.removeEventListener("message", searchCallback);
      
      // Store runtime data in window.runtimes
      if (!window.runtimes) {
        window.runtimes = [];
      }
      if (event.data.runtimeData) {
        window.runtimes.push(event.data.runtimeData);
      }
      
      setDGraphData(event.data.tgraph);
    } else if (event.data.type == "progress") {
      setProgress(event.data.progress);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Grid2 container spacing={2}>
        <CustomSelect
          label="Algorithm"
          value={treeAlgorithm}
          onChange={setTreeAlgorithm}
          options={[
            { value: "KNN", label: "KNN" },
            { value: "RBN", label: "RBN" },
          ]}
        />
        {treeAlgorithm === "RBN" && (
          <CustomNumberInput
            label="Radius (Proportion from 0 to 1)"
            value={r}
            onChange={setR}
          />
        )}
        {treeAlgorithm === "KNN" && (
          <CustomNumberInput
            label="Number of Neighbors (K)"
            value={k}
            onChange={setK}
          />
        )}
        <CustomSelect
          label="Distance"
          value={distanceMetric}
          onChange={setDistanceMetric}
          options={[
            { value: "shortest", label: "Shortest" },
            { value: "longest", label: "Longest" },
            { value: "haustoff", label: "Haustoff" },
          ]}
        />
        <CustomSelect
          label="Sort Type"
          value={sortType}
          onChange={setSortType}
          options={[
            { value: 1, label: "Row Sum" },
            { value: 2, label: "Average Distance" },
          ]}
        />
        <CustomCheckBox
          label="Exclude"
          checked={exclude}
          onChange={setExclude}
        />
        {/* <CustomCheckBox
          label="Do Sort"
          checked={doSort}
          onChange={setDoSort}
        /> */}
        <LoadingButton
          component="label"
          variant="contained"
          tabIndex={-1}
          startIcon={<PlayArrowIcon />}
          fullWidth
          sx={{ flexGrow: 1 }}
          onClick={handleSearch}
          loading={progress != 0 && progress != 100}
          loadingIndicator={
            <CircularProgress
              variant="determinate"
              value={progress}
              size={20}
            />
          }
        >
          Start
        </LoadingButton>
        <Button
          component="label"
          variant="contained"
          tabIndex={-1}
          startIcon={<DeleteIcon />}
          fullWidth
          sx={{ flexGrow: 1 }}
          onClick={() => setDGraphData([])}
          disabled={dGraphData.length === 0}
        >
          Delete Tree
        </Button>
        {treeAlgorithm === "KNN" && (
          <Typography
            variant="h5"
            textAlign="center"
            fontWeight="bold"
            sx={{ width: "100%" }}
          >
            Predicted Runtime:{" "}
            {Math.ceil(NearestNeighborRuntime(segments.length, k) / 100) / 10}{" "}
            seconds
          </Typography>
        )}
      </Grid2>
    </Box>
  );
};

export default NearestNeighborSettings;
