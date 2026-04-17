import React, { useState, useEffect, useContext } from "react";
import seedrandom from "seedrandom";
import {
  CustomNumberInput,
  CustomCheckBox,
  CustomSelect,
} from "../components/CustomComponents";
import {
  Box,
  Grid2,
  Button,
} from "@mui/material";
import { LoadingButton } from "@mui/lab";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import DeleteIcon from "@mui/icons-material/Delete";
import { UniversalDataContext } from "../context/UniversalDataContext";
import { GraphCommunitiesDataContext } from "../context/GraphCommunitiesDataContext";
import { GraphCommunityWorkerInstance } from "./GraphCommunityWorkerInstance";
import { packSegments } from "../Segment";
import OpacityTable from "../OpacityTable";

const ALGORITHM_OPTIONS = [
  { value: "Louvain", label: "Louvain" },
  { value: "Louvain-SL", label: "Louvain-SL" },
  { value: "PCA", label: "PCA K-Means" },
  { value: "PCA-SL", label: "PCA-SL K-Means" },
  { value: "Infomap", label: "Infomap" },
  { value: "Label Propagation", label: "Label Propagation" },
  { value: "Hamming Distance", label: "Hamming Distance" },
  { value: "Blank", label: "Blank" },
];

const OPACITY_OPTIONS = [
  { value: "highlight-selected", label: "Highlight Selected" },
  { value: "connection-count", label: "Connection Count" },
  { value: "avg-distance", label: "Average Distance" },
  { value: "avg-curvature", label: "Average Curvature" },
  { value: "transfer-function", label: "Transfer Function" },
];

const GraphCommunitiesSettings = () => {
  const {
    nodeScale,
    setNodeScale,
    dGraphData,
    isEmpty,
    setIsEmpty,
    communityAlgorithm,
    setCommunityAlgorithm,
    setGraphData,
    setUndoState,
    setOrgCommunities,
    seed,
    setSeed,
    inputs,
    setInputs,
    graphData,
    opacityMode,
    setOpacityMode,
    opacityTransferFunction,
    setOpacityTransferFunction,
  } = useContext(GraphCommunitiesDataContext);
  const { segments } = useContext(UniversalDataContext);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    GraphCommunityWorkerInstance.postMessage({
      functionType: "preCompute",
      dGraphData: dGraphData,
    });
  }, [dGraphData]);

  useEffect(() => {
    setIsEmpty(dGraphData.every((arr) => arr.length === 0));
  }, [dGraphData]);

  const handleStart = async () => {
    if (isEmpty) return;

    GraphCommunityWorkerInstance.addEventListener(
      "message",
      createGraphCallback,
      false
    );
    
    GraphCommunityWorkerInstance.postMessage({
      functionType: "createGraph",
      dGraphData: dGraphData,
      segments: packSegments(segments),
      inputs: inputs,
      communityAlgorithm: communityAlgorithm,
      seed: seed,
    });

    setRunning(true);
  };

  const createGraphCallback = (event) => {
    setRunning(false);
    GraphCommunityWorkerInstance.removeEventListener(
      "message",
      createGraphCallback
    );
    
    // Store runtime data in window.runtimes
    if (!window.runtimes) {
      window.runtimes = [];
    }
    if (event.data.runtimeData) {
      window.runtimes.push(event.data.runtimeData);
    }
    
    setOrgCommunities(event.data.communities);
    setGraphData({
      nodes: event.data.nodesWithCommunityMembers,
      links: event.data.interCommunityLinks,
    });
    setUndoState(null);
  };

  const handleInputChange = (name, value) => {
    setInputs(prev => ({
      ...prev,
      [name.toLowerCase()]: value,
    }));
  };

  const renderInputs = () => {
    switch (communityAlgorithm) {
      case "Louvain":
      case "Louvain-SL":
        return (
          <>
            <CustomNumberInput
              label="Resolution"
              value={inputs.resolution || 0}
              onChange={(value) => handleInputChange("resolution", value)}
            />
            <CustomCheckBox
              label="Random Walk"
              checked={inputs.randomwalk || false}
              onChange={(value) => handleInputChange("randomwalk", value)}
            />
          </>
        );
      case "PCA":
      case "PCA-SL":
        return (
          <>
            <CustomNumberInput
              label="Dims"
              value={inputs.dims || 0}
              onChange={(value) => handleInputChange("dims", value)}
            />
            <CustomNumberInput
              label="KMean"
              value={inputs.kmean || 0}
              onChange={(value) => handleInputChange("kmean", value)}
            />
          </>
        );
      case "Infomap":
      case "Hamming Distance":
        return (
          <CustomNumberInput
            label="Min"
            value={inputs.min || 0}
            onChange={(value) => handleInputChange("min", value)}
          />
        );
      case "Label Propagation":
        return (
          <>
            <CustomNumberInput
              label="Gamma"
              value={inputs.gamma || 0}
              onChange={(value) => handleInputChange("gamma", value)}
            />
            <CustomNumberInput
              label="Max"
              value={inputs.max || 0}
              onChange={(value) => handleInputChange("max", value)}
            />
          </>
        );
      default:
        return null;
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Grid2 container spacing={2}>
        <CustomSelect
          label="Algorithm"
          value={communityAlgorithm}
          onChange={setCommunityAlgorithm}
          options={ALGORITHM_OPTIONS}
        />
        <CustomSelect
          label="Opacity Mode"
          value={opacityMode}
          onChange={setOpacityMode}
          options={OPACITY_OPTIONS}
        />
        <CustomNumberInput
          label="Node Scale"
          value={nodeScale}
          onChange={setNodeScale}
        />
        <CustomNumberInput
          label="Seed"
          value={seed}
          onChange={(value) => {
            setSeed(value);
            seedrandom(value, { global: true });
          }}
        />
        {renderInputs()}
        {opacityMode !== "highlight-selected" && (
          <Box sx={{ width: '100%', mt: 2 }}>
            <OpacityTable setOpacities={setOpacityTransferFunction} />
          </Box>
        )}
        <LoadingButton
          component="label"
          variant="contained"
          tabIndex={-1}
          startIcon={<PlayArrowIcon />}
          fullWidth
          sx={{ flexGrow: 1 }}
          onClick={handleStart}
          loading={running}
        >
          Start
        </LoadingButton>
        <Button
          component="label"
          variant="contained"
          tabIndex={-1}
          startIcon={<DeleteIcon />}
          fullWidth
          disabled={graphData.nodes.length === 0}
          sx={{ flexGrow: 1 }}
          onClick={() => {
            setOrgCommunities([]);
            setGraphData({ nodes: [], links: [] });
          }}
        >
          Delete Graph
        </Button>
      </Grid2>
    </Box>
  );
};

export default GraphCommunitiesSettings;
