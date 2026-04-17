import React, { useContext, useState, useEffect } from "react";
import { GraphCommunityWorkerInstance } from "./GraphCommunityWorkerInstance";
import { Button, Box, ToggleButton, Tooltip, IconButton, Menu, MenuItem } from "@mui/material";
import UndoIcon from "@mui/icons-material/Undo";
import CallSplitIcon from "@mui/icons-material/CallSplit";
import CallMergeIcon from "@mui/icons-material/CallMerge";
import DownloadIcon from "@mui/icons-material/Download";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { LoadingButton } from "@mui/lab";

import { GraphCommunitiesDataContext } from "../context/GraphCommunitiesDataContext";
import { UniversalDataContext } from "../context/UniversalDataContext";
import { LineSegmentsDataContext } from "../context/LineSegmentsDataContext"; // Import LineSegmentsDataContext

import { Segment, packSegments } from '../Segment'; //segment class definition




const GraphCommunitiesButtons = () => {
  const { segments, selectedSegments } = useContext(UniversalDataContext);
  const {
    setGraphData,
    setOrgCommunities,
    multiSelect,
    setMultiSelect,
    setAllGroups,
    selectedNodes,
    undoState,
    setUndoState,
    communityAlgorithm,
    dGraphData,
    graphData,
    orgCommunities,
    inputs,
    allGroups,
    opacityMode,
    setOpacityMode,
    seed,
  } = useContext(GraphCommunitiesDataContext);
  const { 
    setSegmentSaliencyData,
    setSegmentAverageDistanceData,
    setSegmentCommunitySizeData,
    setSegmentCommunityConnectionData 
  } = useContext(LineSegmentsDataContext); 

  const [opacityMenuAnchor, setOpacityMenuAnchor] = useState(null);
  const opacityModes = {
    "highlight-selected": "Highlight Selected",
    "connection-count": "Connection Count",
    "avg-distance": "Average Distance",
    "avg-curvature": "Average Curvature",
    "transfer-function": "Transfer Function"
  };

  const handleOpacityMenuOpen = (event) => {
    setOpacityMenuAnchor(event.currentTarget);
  };

  const handleOpacityMenuClose = () => {
    setOpacityMenuAnchor(null);
  };

  const handleOpacityModeSelect = (mode) => {
    setOpacityMode(mode);
    handleOpacityMenuClose();
  };

  const handleDownload = () => {
    console.log("Original Communities:", orgCommunities);
    
    // Convert orgCommunities to a clean object with just segment index -> community ID mapping
    const segmentToGroup = {};
    for (const [segmentIndex, communityId] of Object.entries(orgCommunities)) {
      segmentToGroup[parseInt(segmentIndex)] = communityId;
    }
    
    console.log("Segment to Group mapping:", segmentToGroup);
    
    const dataStr = JSON.stringify(segmentToGroup, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'community_detection_results.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const [splitProgress, setSplitProgress] = useState(false);
  const [mergeProgress, setMergeProgress] = useState(false);
  const [isLoading, setIsLoading] = useState(false); // General loading state

  useEffect(() => {
    const generalMessageCallback = (event) => {
      const {
        nodesWithCommunityMembers,
        interCommunityLinks,
        segments: updatedSegments, // Assuming worker might send back updated segments
        communities,
        saliencyData, 
        segmentAverageDistanceData, // Expect new data
        segmentCommunitySizeData,   // Expect new data
        segmentCommunityConnectionData, // Expect new data
        newGraphData, // For split/merge
        newOrgCommunities, // For split/merge
        newGroups, // For split
      } = event.data;

      // Handle general graph updates (including initial creation)
      if (nodesWithCommunityMembers && interCommunityLinks && communities) {
        setGraphData({
          nodes: nodesWithCommunityMembers,
          links: interCommunityLinks,
        });
        setOrgCommunities(communities);
        // Potentially update segments in UniversalDataContext if worker modifies them
        // setSegments(unpackSegments(updatedSegments)); // If segments are modified and sent back
        if (saliencyData) {
          setSegmentSaliencyData(saliencyData);
        }
        if (segmentAverageDistanceData) {
          setSegmentAverageDistanceData(segmentAverageDistanceData);
        }
        if (segmentCommunitySizeData) {
          setSegmentCommunitySizeData(segmentCommunitySizeData);
        }
        if (segmentCommunityConnectionData) {
          setSegmentCommunityConnectionData(segmentCommunityConnectionData);
        }
        updateGroups(nodesWithCommunityMembers); // Update groups based on new nodes
      }

      // Handle split results (already covered by specific callback, but good for consolidation)
      if (newGraphData && newOrgCommunities && newGroups && event.data.functionType !== "mergeCommunity") {
         // saveUndo(); // saveUndo is called within splitCommunityCallback
        // updateGroups(newGroups);
        // setOrgCommunities(newOrgCommunities);
        // setGraphData(newGraphData);
      }
      
      // Handle merge results (already covered by specific callback)
      if (newGraphData && newOrgCommunities && event.data.functionType === "mergeCommunity" && !newGroups) {
        // saveUndo(); // saveUndo is called within mergeCommunityCallback
        // setOrgCommunities(newOrgCommunities);
        // setGraphData(newGraphData);
        // updateGroups(newGraphData.nodes);
      }
      setIsLoading(false); // End loading state
    };

    GraphCommunityWorkerInstance.addEventListener("message", generalMessageCallback);

    return () => {
      GraphCommunityWorkerInstance.removeEventListener("message", generalMessageCallback);
    };
  }, [
    dGraphData, 
    segments, 
    inputs, 
    communityAlgorithm, 
    setGraphData, 
    setOrgCommunities, 
    setSegmentSaliencyData, 
    setSegmentAverageDistanceData, 
    setSegmentCommunitySizeData, 
    setSegmentCommunityConnectionData, 
    graphData.nodes.length
  ]); 


  const handleUndo = (data = false) => {
    if (!undoState) return;
    if (!data) data = undoState;
    else setUndoState(data);

    const undo = JSON.parse(data);
    setGraphData(undo.graphData);
    setOrgCommunities(undo.orgCommunities);
    setMultiSelect(undo.multiSelect);
    setAllGroups(undo.allGroups);
    setUndoState(undo.prevUndo);
  };

  const handleSplitCommunity = (splitInto = null) => {
    const packedSegments = packSegments(segments);

    GraphCommunityWorkerInstance.addEventListener(
      "message",
      splitCommunityCallback,
      false
    );
    GraphCommunityWorkerInstance.postMessage({
      functionType: "splitCommunity",
      communityAlgorithm: communityAlgorithm,
      dGraphData: dGraphData,
      graphData: graphData,
      splitInto: splitInto,
      selectedSegments: selectedSegments,
      orgCommunities: orgCommunities,
      selectedNodes: selectedNodes,
      inputs: inputs,
      seed: seed,
      //segments: segments,
      segments: packedSegments,
    });
    setSplitProgress(true);
  };

  const splitCommunityCallback = (event) => {
    GraphCommunityWorkerInstance.removeEventListener(
      "message",
      splitCommunityCallback
    );
    const { newGroups, newOrgCommunities, newGraphData, saliencyData } = event.data; // Expect saliencyData
    saveUndo();
    updateGroups(newGroups);
    setOrgCommunities(newOrgCommunities);
    setGraphData(newGraphData);
    if (saliencyData) { // Also handle saliency data from split if it's recalculated
      setSegmentSaliencyData(saliencyData);
    }
    setSplitProgress(false);
  };

  const handleMergeCommunity = () => {
    GraphCommunityWorkerInstance.addEventListener(
      "message",
      mergeCommunityCallback,
      false
    );
    GraphCommunityWorkerInstance.postMessage({
      functionType: "mergeCommunity",
      graphData: graphData,
      selectedNodes: selectedNodes,
      orgCommunities: orgCommunities,
    });

    setMergeProgress(true);
  };

  const mergeCommunityCallback = (event) => {
    GraphCommunityWorkerInstance.removeEventListener(
      "message",
      mergeCommunityCallback
    );
    const { newGraphData, newOrgCommunities, newNodes, saliencyData } = event.data; // Expect saliencyData
    saveUndo();
    setOrgCommunities(newOrgCommunities);
    setGraphData(newGraphData);
    updateGroups(newNodes);
    if (saliencyData) { // Also handle saliency data from merge if it's recalculated
      setSegmentSaliencyData(saliencyData);
    }
    setMergeProgress(false);
  };

  const saveUndo = () => {
    const nlinks = graphData.links.map((obj) => ({
      source: obj.source.id,
      target: obj.target.id,
    }));

    const sGraphData = {
      nodes: graphData.nodes,
      links: nlinks,
    };

    const undo = {
      prevUndo: undoState,
      graphData: sGraphData,
      orgCommunities,
      selectedNodes,
      multiSelect,
      allGroups,
    };

    setUndoState(JSON.stringify(undo));
  };

  const updateGroups = (nodes) => {
    const groups = {};

    nodes.forEach((node) => {
      if (Array.isArray(node.groupID)) {
        //console.log(node.groupID)
        node.groupID = [...new Set(node.groupID)];
        node.groupID.forEach((groupID) => {
          if (groups.hasOwnProperty(groupID)) {
            groups[groupID]++; // Increment the frequency if the key exists
          } else {
            groups[groupID] = 1; // Initialize the frequency if the key doesn't exist
          }
        });
      }
    });

    computeSizes(nodes);
    setAllGroups(groups);
    return groups;
  };

  const computeSizes = (nodes) => {
    // Find min and max number of members
    let minMembers = Infinity,
      maxMembers = -Infinity;
    nodes.forEach((node) => {
      minMembers = Math.min(minMembers, node.members.length);
      maxMembers = Math.max(maxMembers, node.members.length);
    });

    // Define the log base - using e (natural logarithm) for simplicity
    const logBase = Math.E;

    // Function to calculate size based on members count
    const logScaleSize = (membersCount, a, b) => {
      return a + (b * Math.log(membersCount)) / Math.log(logBase);
    };

    // Calculate constants a and b for the scale
    // Solve for a and b using the equations for min and max members
    const b = 9 / (Math.log(maxMembers) - Math.log(minMembers)); // (10 - 1) = 9 is the range of sizes
    const a = 1 - b * Math.log(minMembers);

    // Calculate and assign sizes
    nodes.forEach((node) => {
      node.size = logScaleSize(node.members.length, a, b);
      // Ensure size is within bounds
      node.size = Math.max(1, Math.min(node.size, 10));
    });

    return nodes;
  };

  return (
    <Box sx={{ display: "flex", justifyContent: "center", gap: 2 }}>
      <Tooltip title="Toggle Selecting Multiple Nodes">
        <span>
          <ToggleButton
            value="check"
            selected={multiSelect}
            onChange={() => setMultiSelect(!multiSelect)}
            color="primary"
            disabled={!graphData.nodes || graphData.nodes.length === 0}
            size="small"
          >
            Multi Select
          </ToggleButton>
        </span>
      </Tooltip>
      <Tooltip title="Undo to Previous State">
        <span>
          <IconButton
            color="primary"
            onClick={() => handleUndo()}
            disabled={!undoState}
            size="small"
          >
            <UndoIcon />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title="Split the Selected Node (Must only have One Node Selected)">
        <span>
          <IconButton
            color="primary"
            onClick={() => handleSplitCommunity()}
            disabled={selectedNodes.length !== 1 || splitProgress}
            size="small"
          >
            <CallSplitIcon />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title="Merge the Selected Nodes (Must only have More than One Node Selected)">
        <span>
          <IconButton
            color="primary"
            onClick={() => handleMergeCommunity()}
            disabled={selectedNodes.length < 2 || mergeProgress}
            size="small"
          >
            <CallMergeIcon />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title="Download Community Detection Results">
        <span>
          <IconButton
            color="primary"
            onClick={handleDownload}
            disabled={!graphData.nodes || graphData.nodes.length === 0}
            size="small"
          >
            <DownloadIcon />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title="Select Opacity Mode">
        <span>
          <IconButton
            color="primary"
            onClick={handleOpacityMenuOpen}
            disabled={!graphData.nodes || graphData.nodes.length === 0}
            size="small"
          >
            <VisibilityIcon />
          </IconButton>
        </span>
      </Tooltip>
      <Menu
        anchorEl={opacityMenuAnchor}
        open={Boolean(opacityMenuAnchor)}
        onClose={handleOpacityMenuClose}
      >
        {Object.entries(opacityModes).map(([mode, label]) => (
          <MenuItem
            key={mode}
            onClick={() => handleOpacityModeSelect(mode)}
            selected={opacityMode === mode}
          >
            {label}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
};

export default GraphCommunitiesButtons;
