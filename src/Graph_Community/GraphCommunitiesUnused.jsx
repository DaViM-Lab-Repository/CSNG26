import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass";

import React, { useRef, useEffect, useState } from "react";
import { ForceGraph2D, ForceGraph3D } from "react-force-graph";
import Graph from "graphology";
import forceAtlas2 from "graphology-layout-forceatlas2";
import louvain from "graphology-communities-louvain";
import { scaleOrdinal } from "d3-scale";
import { schemeCategory10 } from "d3-scale-chromatic"; // Or any other D3 color scheme

//import * as d3 from 'd3';
import chroma from "chroma-js";
import seedrandom from "seedrandom";
const infomap = require("infomap");
const llp = require("layered-label-propagation");
const hamming = require("./distance-hamming");

import { Allotment } from "allotment";
import {
  CustomNumberInput,
  CustomCheckBox,
  CustomSelect,
} from "./components/CustomComponents";
import { Box, Typography, Grid2, Button } from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";

//import { node } from 'webpack';

// Use an ordinal scale for colors with a D3 color scheme
const colorScale = scaleOrdinal(schemeCategory10);

const GraphCommunitiesUnused = ({
  data,
  segments,
  segmentsSelected,
  setSegmentsSelected,
  selectedSegment,
  pixelData,
  setPixelData,
  setPixelMapData,
}) => {
  const fgRef = useRef();
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [orgCommunities, setOrgCommunities] = useState({
    nodes: [],
    links: [],
  });
  const [isEmpty, setIsEmpty] = useState(true);
  const [selectedNode, setSelectedNode] = useState(null);
  const [nodeScale, setNodeScale] = useState(1);

  const [use3D, setUse3D] = useState(0);

  const [multiSelect, setMultiSelect] = useState(false);
  const [selectedNodes, setSelectedNodes] = useState([]);
  const [allGroups, setAllGroups] = useState([]);

  const [undoState, setUndoState] = useState(false);
  const [seed, setSeed] = useState(1);
  const [algorithm, setAlgorithm] = useState("Louvain");
  const [inputs, setInputs] = useState({
    resolution: 1,
    randomWalk: false,
    min: 0.01,
    gamma: 0.1,
    max: 10,
    dims: 5,
    kmean: 8,
  });

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setInputs({
      ...inputs,
      [name]: type === "checkbox" ? checked : parseFloat(value),
    });
  };

  const pcaKmeansStreamlineClustering = (segments, pcaDims, k) => {
    const streamlineIndices = {};
    segments.forEach((segment, idx) => {
      if (!streamlineIndices[segment.lineIDx]) {
        streamlineIndices[segment.lineIDx] = [idx, idx];
      } else {
        streamlineIndices[segment.lineIDx][1] = idx;
      }
    });

    const streamlines = Object.values(streamlineIndices);

    const avgLength = Math.round(
      streamlines.reduce((sum, s) => sum + (s[1] - s[0] + 1), 0) /
        streamlines.length
    );

    const paddedStreamlines = streamlines.map(([startIdx, endIdx]) => {
      let streamline = segments.slice(startIdx, endIdx + 1);
      let streamlineLength = streamline.length;

      let flattenedStreamline = streamline.flatMap((segment) => [
        ...segment.startPoint,
        ...segment.endPoint,
        ...segment.midPoint,
      ]);

      if (streamlineLength < avgLength) {
        const paddingSize = (avgLength - streamlineLength) * 9;
        flattenedStreamline = [
          ...flattenedStreamline,
          ...Array(paddingSize).fill(0),
        ];
      } else if (streamlineLength > avgLength) {
        flattenedStreamline = flattenedStreamline.slice(0, avgLength * 9);
      }

      return flattenedStreamline;
    });

    const pca = new PCA(paddedStreamlines);
    const reducedData = pca.predict(paddedStreamlines, {
      nComponents: pcaDims,
    });
    const reducedDataArray = Array.from(reducedData.data).map((row) =>
      Array.from(row)
    );

    let ans = kmeans.kmeans(reducedDataArray, k, { seed: seed });
    const communities = {};
    ans.clusters.forEach((cluster, streamlineIndex) => {
      const [startIdx, endIdx] = streamlines[streamlineIndex];
      for (let i = startIdx; i <= endIdx; i++) {
        communities[i] = cluster;
      }
    });

    return fillHolesInCommunities(communities);
  };

  const getRandomColor = () => {
    const letters = "0123456789ABCDEF";
    let color = "#";
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  };

  useEffect(() => {
    console.log("RUN");

    if (!isEmpty) {
      fgRef.current.d3Force("link").distance((link) => {
        if (
          link.source.groupID.length > 0 &&
          link.source.groupID[0] == link.target.groupID[0]
        ) {
          console.log(link);
          return -15;
        }

        return 30;
      });
      if (use3D) {
        const bloomPass = new UnrealBloomPass();
        bloomPass.strength = 1;
        bloomPass.radius = 1;
        bloomPass.threshold = 0;
        fgRef.current.postProcessingComposer().addPass(bloomPass);
      }
    }
  }, [isEmpty, use3D, data]);

  useEffect(() => {
    console.log("data updated!");
  }, [data]);

  const windowRef = useRef(null); // Ref to the parent box
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateDimensions = () => {
      if (windowRef.current) {
        const { offsetWidth, offsetHeight } = windowRef.current;
        setDimensions({ width: offsetWidth, height: offsetHeight });
      }
    };

    const resizeObserver = new ResizeObserver(updateDimensions);
    if (windowRef.current) resizeObserver.observe(windowRef.current);
    return () => resizeObserver.disconnect();
  }, []);

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
      graphData: sGraphData,
      orgCommunities,
      isEmpty,
      selectedNode,
      selectedNodes,
      multiSelect,
      allGroups,
    };

    setUndoState(JSON.stringify(undo));
  };

  const handleUndo = (data = false) => {
    if (!undoState) return;
    if (!data) data = undoState;
    else {
      setUndoState(data);
    }
    const undo = JSON.parse(data);
    //console.log(undo.graphData);
    setGraphData(undo.graphData);
    setOrgCommunities(undo.orgCommunities);
    setIsEmpty(undo.isEmpty);
    setSelectedNode(undo.selectedNode);
    setSelectedNodes(undo.selectedNodes);
    setMultiSelect(undo.multiSelect);
    setAllGroups(undo.allGroups);
  };

  useEffect(() => {
    let { nodes, links } = graphData;
    const nid = orgCommunities[selectedSegment];
    const snode = nodes.filter((n) => {
      return n.id == nid;
    });

    if (snode.length == 0) {
      console.log("Not found!", nid);
    }

    setMultiSelect(false);
    setSelectedNode(snode[0]);
  }, [selectedSegment]);

  const handleStart = () => {
    // Check if the graph is empty
    const isEmptyGraph = data.every((arr) => arr.length === 0);
    setIsEmpty(isEmptyGraph);

    if (isEmptyGraph) {
      console.log("Graph is empty, nothing to layout.");
      return; // Do not attempt to plot if the graph is empty
    }

    const graph = new Graph(); // Create a graph
    const communityGraph = new Graph(); // This will store the community graph
    const communitySizes = {}; // To store the size of each community

    const imapNodes = [];
    const imapEdges = [];

    let startTime = performance.now();
    //console.log(segments);
    // Add nodes first
    data.forEach((_, nodeIndex) => {
      if (!graph.hasNode(nodeIndex)) {
        graph.addNode(nodeIndex);
      }
      imapNodes.push(nodeIndex);
    });

    // Then add edges
    data.forEach((edges, source) => {
      edges.forEach((target) => {
        imapEdges.push({
          source,
          target,
          value: 1,
        });
        // Ensure both source and target nodes exist
        if (!graph.hasNode(target)) {
          graph.addNode(target);
        }
        if (!graph.hasEdge(source, target)) {
          graph.addEdge(source, target);
        }
      });
    });

    let endTime = performance.now();

    console.log(`Graph1 build time: ${endTime - startTime}ms`);

    startTime = performance.now();

    // Detect communities
    let communities;
    switch (algorithm) {
      case "Louvain":
        communities = louvain(graph, {
          resolution: inputs.resolution,
          randomWalk: inputs.randomWalk,
        });
        break;
      case "Louvain-SL":
        // Step 1: Build streamline graph
        const streamlineGraph = new Graph();
        const streamlineMap = new Map(); // Map streamline index to array of segment indices

        // First, map segments to streamlines
        segments.forEach((segment, segmentIndex) => {
          const streamlineIndex = segment.lineIDx;
          if (!streamlineMap.has(streamlineIndex)) {
            streamlineMap.set(streamlineIndex, []);
          }
          streamlineMap.get(streamlineIndex).push(segmentIndex);
        });

        // Add all nodes to streamlineGraph first
        streamlineMap.forEach((_, streamlineIndex) => {
          streamlineGraph.addNode(streamlineIndex);
        });

        // Now add edges to streamlineGraph
        streamlineMap.forEach((segmentIndices, streamlineIndex) => {
          segmentIndices.forEach((segmentIndex) => {
            data[segmentIndex].forEach((neighborIndex) => {
              const neighborStreamlineIndex = segments[neighborIndex].lineIDx;
              if (streamlineIndex !== neighborStreamlineIndex) {
                if (
                  !streamlineGraph.hasEdge(
                    streamlineIndex,
                    neighborStreamlineIndex
                  )
                ) {
                  streamlineGraph.addEdge(
                    streamlineIndex,
                    neighborStreamlineIndex
                  );
                }
              }
            });
          });
        });

        // Step 2: Perform Louvain community detection on streamlineGraph
        const streamlineCommunities = louvain(streamlineGraph, {
          resolution: inputs.resolution,
          randomWalk: inputs.randomWalk,
        });

        // Step 3: Map communities back to individual segments
        communities = {};
        streamlineMap.forEach((segmentIndices, streamlineIndex) => {
          const communityId = streamlineCommunities[streamlineIndex];
          segmentIndices.forEach((segmentIndex) => {
            communities[segmentIndex] = communityId;
          });
        });
        break;
      case "PCA":
        communities = pcaKmeansStreamlineClustering(
          segments,
          inputs.dims,
          inputs.kmean
        );
        break;
      case "Infomap":
        communities = infomap.jInfomap(imapNodes, imapEdges, inputs.min);
        break;
      case "Hamming Distance":
        communities = hamming.jHamming(nodes, links, inputs.min);
        break;
      case "Label Propagation":
        communities = llp.jLayeredLabelPropagation(
          imapNodes,
          imapEdges,
          inputs.gamma,
          inputs.max
        );
        break;
      case "Blank":
        communities = Array.from({ length: segments.length }, (_, i) => [
          i,
          0,
        ]).reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {});
        break;
    }

    endTime = performance.now();

    console.log(`Comm detect time:${endTime - startTime}ms`);

    const comms = {};
    Object.keys(communities).forEach((k) => {
      comms[communities[k]] = 1;
    });
    console.log("NUM COMMUNITIES: ", Object.keys(comms).length);

    setOrgCommunities(communities);

    ///color all!!
    Object.entries(communities).forEach(([nodeId, communityIndex]) => {
      const color = colorScale(communityIndex.toString());
      //console.log(`Node ${nodeId}: Community ${communityIndex} Color: ${color}`);
      if (!segments[parseInt(nodeId)]) console.log(nodeId);
      else segments[parseInt(nodeId)].color = color;
      //setSegmentsSelected(segments)
    });
    //CHECKKKKK!!!
    setSegmentsSelected(segments);

    // Process communities, creating nodes for each community and counting sizes
    Object.entries(communities).forEach(([node, community]) => {
      if (!segments[parseInt(node)]) return;
      if (!communityGraph.hasNode(community)) {
        communityGraph.addNode(community, { size: 1 });
      } else {
        communityGraph.updateNodeAttribute(
          community,
          "size",
          (size) => size + 1
        );
      }
    });

    // Now, let's prepare data for visualization
    const nodes = communityGraph.nodes().map((node) => ({
      id: node,
      size: communityGraph.getNodeAttribute(node, "size") / 2,
    }));

    // After computing community sizes but before setting the graphData:
    const scaleFactor = 0.02; // Adjust this scaling factor as needed
    const scaledNodes = nodes.map((node) => ({
      ...node,
      size: node.size * scaleFactor,
    }));

    // Assign a color to each community node
    const nodesWithColors = scaledNodes.map((node) => ({
      ...node,
      color: colorScale(node.id.toString()), // Convert node id to string for the scale function
    }));

    // No edges between communities are added for now,
    // as we don't have the information about inter-community connections here.
    // You might need additional logic to determine and add these connections if needed.

    // Detected communities: communities (a mapping of node -> community)

    console.log("CHECKPOINT1");

    // Use a set to store unique inter-community links in the format "smaller_larger" to ensure uniqueness
    const interCommunityLinksSet = new Set();

    data.forEach((edges, source) => {
      edges.forEach((target) => {
        const sourceCommunity = communities[source];
        const targetCommunity = communities[target];

        // Check if communities are different, now including community 0
        if (sourceCommunity !== targetCommunity) {
          // Ensure a consistent order for the pair to avoid duplicate entries in set
          const sortedPair = [sourceCommunity, targetCommunity]
            .sort()
            .join("_");
          interCommunityLinksSet.add(sortedPair);
        }
      });
    });

    // Convert the set back to an array of objects for further processing or output
    let interCommunityLinks = Array.from(interCommunityLinksSet).map((pair) => {
      const [source, target] = pair.split("_");
      return { source, target };
    });
    console.log("CHECKPOINT2");
    // Deduplicate the links
    const linkPairs = new Set();
    interCommunityLinks = interCommunityLinks.filter((link) => {
      const sortedPair = [link.source, link.target].sort().join("_");
      if (linkPairs.has(sortedPair)) {
        return false;
      } else {
        linkPairs.add(sortedPair);
        return true;
      }
    });
    console.log("CHECKPOINT3");
    const communityMembers = {};
    Object.entries(communities).forEach(([originalNode, communityId]) => {
      if (!segments[parseInt(originalNode)]) return;

      if (!communityMembers[communityId]) {
        communityMembers[communityId] = [];
      }
      communityMembers[communityId].push(parseInt(originalNode, 10));
    });

    const nodesWithCommunityMembers = nodesWithColors.map((node) => ({
      ...node,
      members: communityMembers[node.id] || [],
      groupID: [],
    }));

    //console.log("nodesWithCommunityMembers: ",nodesWithCommunityMembers)

    setGraphData({
      //nodes,
      nodes: nodesWithCommunityMembers,
      links: interCommunityLinks, //[], // No inter-community links for this simplified visualization
    });

    saveUndo();
  };

  const promptForColor = () => {
    const userInput = window.prompt(
      "Enter a color (e.g., 'red', '#FF0000', or 'rgb(255,0,0)'):"
    );
    return userInput || null; // Return null if user cancels or inputs empty string
  };

  const handleNodeClick = (node, event) => {
    if (event.button === 2) {
      // Right click
      event.preventDefault(); // Prevent default right-click menu
      let newColor;
      if (event.ctrlKey) {
        newColor = promptForColor();
      } else {
        newColor = getRandomColor();
      }

      node.color = newColor;

      // Update associated segments' colors
      const updatedSegments = segments.map((seg) =>
        node.members.includes(seg.globalIdx) ? { ...seg, color: newColor } : seg
      );

      setSegmentsSelected(updatedSegments);
    } else {
      // Left click (existing behavior)
      if (multiSelect) {
        setSelectedNodes((prevSelectedNodes) => {
          const isNodeAlreadySelected = prevSelectedNodes.find(
            (selectedNode) => selectedNode.id === node.id
          );
          if (!isNodeAlreadySelected) {
            const newState = [...prevSelectedNodes, node];
            let selected = [];
            newState.forEach((node) => {
              node.members.forEach((idx) => {
                let seg = segments[parseInt(idx)];
                seg.color = node.color;
                selected.push(seg);
              });
            });
            setSegmentsSelected(selected);
            return newState;
          }
          return prevSelectedNodes;
        });
      } else {
        setSelectedNodes([]);
        if (selectedNode == node) {
          setSelectedNode(false);
          setSegmentsSelected(segments);
        } else {
          let selected = [];
          node.members.forEach((idx) => {
            let seg = segments[parseInt(idx)];
            if (!seg) console.log(`segment idx not found! ${idx}`);
            seg.color = node.color;
            selected.push(seg);
          });
          setSegmentsSelected(selected);
          setSelectedNode(node);
        }
      }
    }
  };

  const renderInputs = () => {
    switch (algorithm) {
      case "Louvain":
      case "Louvain-SL":
        return (
          <>
            <CustomNumberInput
              name={"Resolution"}
              onChange={handleInputChange}
              defaultValue={inputs.resolution}
            />
            <CustomCheckBox
              name={"Random Walk"}
              onChange={handleInputChange}
              defaultValue={inputs.randomWalk}
            />
          </>
        );
      case "PCA":
        return (
          <>
            <CustomNumberInput
              name={"Dims"}
              onChange={handleInputChange}
              defaultValue={inputs.dims}
            />

            <CustomNumberInput
              name={"K Means"}
              onChange={handleInputChange}
              defaultValue={inputs.kmean}
            />
          </>
        );
      case "Infomap":
        return (
          <CustomNumberInput
            name={"Min"}
            onChange={handleInputChange}
            defaultValue={inputs.min}
          />
        );
      case "Hamming Distance":
        return (
          <CustomNumberInput
            name={"Min"}
            onChange={handleInputChange}
            defaultValue={inputs.min}
          />
        );
      case "Blank":
        return <></>;
      case "Label Propagation":
        return (
          <>
            <CustomNumberInput
              name={"Gamma"}
              onChange={handleInputChange}
              defaultValue={inputs.gamma}
            />
            <CustomNumberInput
              name={"Max"}
              onChange={handleInputChange}
              defaultValue={inputs.max}
            />
          </>
        );
      default:
        return null;
    }
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

    //console.log(groups)
    console.log("GROUPS: ", groups);
    setAllGroups(groups);
    return groups;
  };

  const handleMergeCommunitiesP = (pNodes) => {
    const toMerge = pNodes.map((node) => node.id);
    let { nodes, links } = graphData;

    if (pNodes[0].groupID.length > 0) {
      //already in group
      const mGroupID = pNodes[0].groupID;
    }
    const mergedGroupID = [].concat(...pNodes.map((obj) => obj.groupID));

    //console.log(orgCommunities)

    //convert the links back
    links = links.map((obj) => ({
      source: obj.source.id,
      target: obj.target.id,
    }));

    // Find an unused community index (node ID)
    const allCommunityIndexes = nodes.map((node) => node.id);
    const maxCommunityIndex =
      allCommunityIndexes.length > 0 ? Math.max(...allCommunityIndexes) : 0;
    const newCommunityIndex = maxCommunityIndex + 1;

    const mergeIds = pNodes.map((object) => object.id);
    // Iterate over the mergeArray
    for (let key in orgCommunities) {
      if (mergeIds.includes(orgCommunities[key].toString())) {
        orgCommunities[key] = newCommunityIndex;
        //console.log(key)
      }
    }
    setOrgCommunities(orgCommunities);

    // Merge member lists of communities specified in 'toMerge'
    const mergedMembers = toMerge.flatMap((communityIndex) => {
      // Find the node that corresponds to the current community index and get its members
      const node = nodes.find((n) => n.id === communityIndex);
      return node ? node.members : [];
    });

    const removed_nodes = nodes.filter((node) => toMerge.includes(node.id));

    // Remove the nodes that are merged
    nodes = nodes.filter((node) => !toMerge.includes(node.id));

    const newsize = removed_nodes.reduce(
      (totalSize, obj) => totalSize + obj.size,
      0
    );

    // Create a new node for the merged community
    const newCommunityNode = {
      // Copy other properties
      ...removed_nodes[0],
      id: newCommunityIndex,
      members: mergedMembers,
      size: newsize,
      groupID: [...mergedGroupID],
    };
    nodes.push(newCommunityNode);

    // Update the links to reflect the merge
    //console.log(toMerge)
    //console.log(links[0])
    links = links
      .map((link) => {
        // Update the source and target of the link if they refer to a community that was merged
        return {
          source: toMerge.includes(link.source)
            ? newCommunityIndex
            : link.source,
          target: toMerge.includes(link.target)
            ? newCommunityIndex
            : link.target,
        };
      })
      .filter((link) => link.source !== link.target); // Remove self-links

    // Deduplicate the links
    const linkPairs = new Set();
    links = links.filter((link) => {
      const sortedPair = [link.source, link.target].sort().join("_");
      if (linkPairs.has(sortedPair)) {
        return false;
      } else {
        linkPairs.add(sortedPair);
        return true;
      }
    });

    //deselect the ui multiselect mode
    setSelectedNodes([]);
    setMultiSelect(false);

    //update the 3D view with the new merged segment colors
    let selected = [];
    newCommunityNode.members.forEach((idx) => {
      let seg = segments[parseInt(idx)];
      seg.color = newCommunityNode.color;
      //console.log(seg.color);
      selected.push(seg);
    });
    setSegmentsSelected(selected);
    setSelectedNode(newCommunityNode);

    updateGroups(nodes);

    // Set the updated nodes and links to the state
    setGraphData({
      nodes: nodes,
      links: links,
    });

    saveUndo();
    return newCommunityNode;
  };

  const handleMergeCommunities = () => {
    const toMerge = selectedNodes.map((node) => node.id);
    let { nodes, links } = graphData;

    const mergedGroupID = [].concat(...selectedNodes.map((obj) => obj.groupID));

    //convert the links back
    links = links.map((obj) => ({
      source: obj.source.id,
      target: obj.target.id,
    }));

    // Find an unused community index (node ID)
    const allCommunityIndexes = nodes.map((node) => node.id);
    const maxCommunityIndex =
      allCommunityIndexes.length > 0 ? Math.max(...allCommunityIndexes) : 0;
    const newCommunityIndex = maxCommunityIndex + 1;

    const mergeIds = selectedNodes.map((object) => object.id);
    // Iterate over the mergeArray
    for (let key in orgCommunities) {
      if (mergeIds.includes(orgCommunities[key].toString())) {
        orgCommunities[key] = newCommunityIndex;
        //console.log(key)
      }
    }
    setOrgCommunities(orgCommunities);

    // Merge member lists of communities specified in 'toMerge'
    const mergedMembers = toMerge.flatMap((communityIndex) => {
      // Find the node that corresponds to the current community index and get its members
      const node = nodes.find((n) => n.id === communityIndex);
      return node ? node.members : [];
    });

    const removed_nodes = nodes.filter((node) => toMerge.includes(node.id));

    // Remove the nodes that are merged
    nodes = nodes.filter((node) => !toMerge.includes(node.id));

    const newsize = removed_nodes.reduce(
      (totalSize, obj) => totalSize + obj.size,
      0
    );

    // Create a new node for the merged community
    const newCommunityNode = {
      // Copy other properties
      ...removed_nodes[0],
      id: newCommunityIndex,
      members: mergedMembers,
      size: newsize,
      groupID: [...mergedGroupID],
    };
    nodes.push(newCommunityNode);

    // Update the links to reflect the merge
    //console.log(toMerge)
    //console.log(links[0])
    links = links
      .map((link) => {
        // Update the source and target of the link if they refer to a community that was merged
        return {
          source: toMerge.includes(link.source)
            ? newCommunityIndex
            : link.source,
          target: toMerge.includes(link.target)
            ? newCommunityIndex
            : link.target,
        };
      })
      .filter((link) => link.source !== link.target); // Remove self-links

    // Deduplicate the links
    const linkPairs = new Set();
    links = links.filter((link) => {
      const sortedPair = [link.source, link.target].sort().join("_");
      if (linkPairs.has(sortedPair)) {
        return false;
      } else {
        linkPairs.add(sortedPair);
        return true;
      }
    });

    //deselect the ui multiselect mode
    setSelectedNodes([]);
    setMultiSelect(false);

    //update the 3D view with the new merged segment colors
    let selected = [];
    newCommunityNode.members.forEach((idx) => {
      let seg = segments[parseInt(idx)];
      seg.color = newCommunityNode.color;
      //console.log(seg.color);
      selected.push(seg);
    });
    setSegmentsSelected(selected);
    setSelectedNode(newCommunityNode);

    updateGroups(nodes);

    // Set the updated nodes and links to the state
    setGraphData({
      nodes: nodes,
      links: links,
    });

    saveUndo();
    return newCommunityNode;
  };

  const handleSplitCommunity = (splitInto) => {
    const communityIndex = selectedNode.id;
    const X = 3;
    const orgSize = selectedNode.size;

    let { nodes, links } = graphData;

    // Find an unused community index (node ID)
    const allCommunityIndexes = nodes.map((node) => node.id);
    const maxCommunityIndex =
      allCommunityIndexes.length > 0
        ? Math.max(...allCommunityIndexes) + 1
        : 0 + 1;

    //conver the links back
    links = links.map((obj) => ({
      source: obj.source.id,
      target: obj.target.id,
    }));

    // Find the community node to split
    let communityNode = nodes.find((node) => node.id === communityIndex);

    if (nodes.length == 1) {
      communityNode = nodes[0];
    } else if (!communityNode) {
      console.error("Community to split not found");
      return;
    }

    const totalMembers = communityNode.members.length;
    const membersPerNewCommunity = Math.ceil(totalMembers / X);

    nodes = nodes.filter((node) => node.id !== communityIndex);

    let newLinks = links.filter(
      (link) => link.source !== communityIndex && link.target !== communityIndex
    ); // Exclude original community's links
    console.log(`${newLinks.length} ${links.length}`);
    console.log(newLinks);

    let fnodes, fdata, interCommunityLinks;
    const graph = new Graph(); // Create a graph
    const communityGraph = new Graph(); // This will store the community graph

    const indicesToFilter = communityNode.members;

    const imapNodes = [];
    const imapEdges = [];

    if (splitInto) {
      fnodes = splitInto.nodes;
      fdata = splitInto;
      interCommunityLinks = fdata.links;
      //alert("ARASD")
    } else {
      //alert("HERE")

      fdata = indicesToFilter.map((index) => data[index]);
      // Add nodes first
      fdata.forEach((_, nodeIndex) => {
        if (!graph.hasNode(indicesToFilter[nodeIndex])) {
          //console.log(nodeIndex)
          graph.addNode(indicesToFilter[nodeIndex]);
        }
        imapNodes.push(indicesToFilter[nodeIndex]);
      });

      // Then add edges
      fdata.forEach((edges, source) => {
        const src = source;
        edges.forEach((target) => {
          //if (!indicesToFilter[source])
          //console.log(`${source} ${indicesToFilter[source]}`)
          source = indicesToFilter[src];
          target = target;
          //WARNING
          if ((source === 0 && target) || (source && target)) {
            imapEdges.push({
              source,
              target,
              value: 1,
            });
            //console.log(`FOUND SRC TGT: ${source}, ${target}`)
            // Ensure both source and target nodes exist
            if (!graph.hasNode(target)) {
              //graph.addNode(target);
              //console.log(`WARNING! ${target}`)
            } else if (!graph.hasEdge(source, target)) {
              graph.addEdge(source, target);
              //console.log(`ADDED! ${[source,target]}`)
            }
          } else {
            //console.log(`UNDEFINED SRC TGT: ${source}, ${target}`)
          }
        });
      });
      //console.log(graph)

      console.log("imapNodes", imapNodes);
      console.log("imapEdges", imapEdges);

      // Detect communities
      //const communities = louvain(graph);
      let communities;
      switch (algorithm) {
        case "Louvain":
          communities = louvain(graph, {
            resolution: inputs.resolution,
            randomWalk: inputs.randomWalk,
          });
          break;
        case "Infomap":
          communities = infomap.jInfomap(imapNodes, imapEdges, inputs.min);
          break;
        case "Hamming Distance":
          communities = hamming.jHamming(nodes, links, inputs.min);
          break;
        case "Label Propagation":
          communities = llp.jLayeredLabelPropagation(
            imapNodes,
            imapEdges,
            inputs.gamma,
            inputs.max
          );
          break;

        case "Selected":
          communities = Array.from({ length: imapNodes.length }, (_, i) => [
            i,
            0,
          ]).reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {});
          console.log("segmentsSelected:", segmentsSelected);
          segmentsSelected.forEach((seg) => {
            if (communities[seg.globalIdx] !== undefined) {
              communities[seg.globalIdx] = 1;
            }
          });
          break;
      }

      console.log("comm: ", communities);

      // Process communities, creating nodes for each community and counting sizes
      Object.entries(communities).forEach(([node, community]) => {
        if (!communityGraph.hasNode(community)) {
          communityGraph.addNode(community, { size: 1 });
        } else {
          communityGraph.updateNodeAttribute(
            community,
            "size",
            (size) => size + 1
          );
        }
      });

      //let groupColor = d3.rgb(colorScale(maxCommunityIndex.toString())); // Convert to RGB
      let groupColor = chroma(colorScale(maxCommunityIndex.toString())).rgb(); // Convert to RGB
      let groupColorWithOpacity = `rgba(${groupColor[0]}, ${groupColor[1]}, ${groupColor[2]}, 0.1)`;

      // Now, let's prepare data for visualization
      fnodes = communityGraph.nodes().map((node) => ({
        id: node.toString(),
        size:
          (communityGraph.getNodeAttribute(node, "size") / totalMembers) *
          orgSize,
        color: colorScale(node.toString()),
        groupID:
          algorithm !== "Selected"
            ? [...communityNode.groupID, maxCommunityIndex]
            : [...communityNode.groupID],
        groupColor: groupColorWithOpacity, //colorScale(maxCommunityIndex.toString()),
        groupSize: communityGraph.nodes().length,
      }));

      //if (algorithm == 'Selected')
      //  fnodes.groupID = [];

      // Detected communities: communities (a mapping of node -> community)

      interCommunityLinks = [];

      // Assuming `data` is an adjacency list representation of the original graph

      if (algorithm !== "Selected")
        fdata.forEach((edges, source) => {
          source = indicesToFilter[source];
          edges.forEach((target) => {
            //target = indicesToFilter[target]
            const sourceCommunity = communities[source] + maxCommunityIndex;
            const targetCommunity = communities[target] + maxCommunityIndex;

            //WARNING
            if (
              targetCommunity &&
              sourceCommunity != communityIndex &&
              targetCommunity != communityIndex
            ) {
              if (sourceCommunity !== targetCommunity) {
                // This is an inter-community link
                const linkExists = interCommunityLinks.some(
                  (link) =>
                    (link.source === sourceCommunity &&
                      link.target === targetCommunity) ||
                    (link.source === targetCommunity &&
                      link.target === sourceCommunity)
                );

                if (!sourceCommunity || !targetCommunity)
                  console.log([
                    sourceCommunity,
                    targetCommunity,
                    source,
                    target,
                  ]);
                if (!linkExists && sourceCommunity != 0) {
                  interCommunityLinks.push({
                    source: sourceCommunity.toString(),
                    target: targetCommunity.toString(),
                  });
                  //console.log([sourceCommunity,targetCommunity,sourceCommunity.toString(), targetCommunity.toString()])
                }
              }
            }
          });
        });
      //test
      //console.log(`removing ${communityIndex}`)

      if (algorithm !== "Selected")
        data.forEach((edges, source) => {
          edges.forEach((target) => {
            const sourceCommunity = orgCommunities[source];
            let targetCommunity = orgCommunities[target];
            if (
              sourceCommunity == communityIndex ||
              targetCommunity != communityIndex ||
              communities[target] + maxCommunityIndex == communityIndex
            )
              return;

            targetCommunity = communities[target] + maxCommunityIndex;

            if (sourceCommunity !== targetCommunity) {
              // This is an inter-community link
              const linkExists = interCommunityLinks.some(
                (link) =>
                  (link.source === sourceCommunity &&
                    link.target === targetCommunity) ||
                  (link.source === targetCommunity &&
                    link.target === sourceCommunity)
              );

              if (!linkExists && sourceCommunity != 0) {
                interCommunityLinks.push({
                  source: sourceCommunity.toString(),
                  target: targetCommunity.toString(),
                });
                //console.log([sourceCommunity,targetCommunity,sourceCommunity.toString(), targetCommunity.toString()])
              }
            }
          });
        });

      //endtest

      // Deduplicate the links
      const linkPairs = new Set();
      interCommunityLinks = interCommunityLinks.filter((link) => {
        const sortedPair = [link.source, link.target].sort().join("_");
        if (linkPairs.has(sortedPair)) {
          return false;
        } else {
          linkPairs.add(sortedPair);
          return true;
        }
      });

      // Now, interCommunityLinks contains all the edges between different communities.
      //console.log(communities)
      //console.log(orgCommunities)

      // Create a new object by adding the constant to each key and value of obj2
      let adjustedComm = Object.keys(communities).reduce((newObj, key) => {
        // Convert key to a number since Object.keys returns an array of strings
        let adjustedKey = parseInt(key) + maxCommunityIndex;
        let adjustedValue = communities[key] + maxCommunityIndex;
        newObj[key] = adjustedValue;
        return newObj;
      }, {});

      console.log(adjustedComm);
      setOrgCommunities({ ...orgCommunities, ...adjustedComm });

      //console.log(indicesToFilter)
      //console.log(interCommunityLinks)

      // Modify the nodes structure to include the original nodes for each community
      const communityMembers = {};
      Object.entries(communities).forEach(([originalNode, communityId]) => {
        //communityId += maxCommunityIndex
        if (!communityMembers[communityId]) {
          communityMembers[communityId] = [];
        }
        //communityMembers[communityId].push(parseInt(indicesToFilter[originalNode], 10));
        communityMembers[communityId].push(parseInt(originalNode, 10));
      });

      //console.log(indicesToFilter)

      //console.log(communityMembers)

      fnodes = fnodes.map((node) => ({
        ...node,
        id: (parseInt(node.id) + maxCommunityIndex).toString(),
        members: communityMembers[node.id] || [],
      }));
    }

    let seenIds = new Set();
    let duplicates = [];

    fnodes.forEach((node) => {
      if (seenIds.has(node.id)) {
        duplicates.push(node); // This node is a duplicate
      } else {
        seenIds.add(node.id);
      }
    });

    if (duplicates.length > 0) {
      console.log("Duplicate nodes found:", duplicates);
    } else {
      console.log("No duplicate nodes found.");
    }

    //console.log(fnodes)
    fnodes = nodes.concat(fnodes);
    newLinks = newLinks.concat(interCommunityLinks);

    /////////

    updateGroups(fnodes);

    // Set the updated nodes and links to the state
    setGraphData({
      nodes: fnodes,
      links: newLinks,
      //links: newLinks,
    });

    saveUndo();
  };

  const handleCollaspeGroup = () => {
    const communityIndex = selectedNode.id;
    const groupID = selectedNode.groupID[0]; //first group for now
    let { nodes, links } = graphData;

    // Find an unused community index (node ID)

    const nodeMembers = nodes.filter((node) => node.groupID.includes(groupID));
    let linkMembers = links.filter(
      (link) =>
        link.source.groupID.includes(groupID) ||
        link.target.groupID.includes(groupID)
    );

    //convert the links back
    linkMembers = linkMembers.map((obj) => ({
      source: obj.source.id,
      target: obj.target.id,
    }));

    const storedGraphdata = {
      nodes: nodeMembers,
      links: linkMembers,
    };

    const newNode = handleMergeCommunitiesP(nodeMembers);
    newNode.storedGraphdata = storedGraphdata;
  };

  const handleExpandGroup = () => {
    const storedData = selectedNode.storedGraphdata;
    if (!storedData) return;

    /*let { nodes, links } = graphData;
      //convert the links back
      links = links.map(obj => ({
      source: obj.source.id,
      target: obj.target.id}
      ))*/

    handleSplitCommunity(storedData);
  };

  const handleDownload = () => {
    const fileName = window.prompt("Enter file name", "myImage.png");

    if (fileName) {
      const data = [];
      graphData.nodes.forEach((node) => {
        data.push(node.members);
      });

      console.log("NODES:", graphData.nodes);

      let text = JSON.stringify(data);

      const link = document.createElement("a");
      link.setAttribute(
        "href",
        "data:text/plain;charset=utf-8," + encodeURIComponent(text)
      );
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleFileChange = (event) => {
    const fileReader = new FileReader();
    fileReader.readAsText(event.target.files[0], "UTF-8");

    fileReader.onload = (e) => {
      try {
        //const parsedJson = JSON.parse(e.target.result);
        //setJsonData(parsedJson);
        handleUndo(e.target.result);
      } catch (error) {
        console.error("Error parsing JSON:", error);
      }
    };
  };

  const handleButtonClick = () => {
    document.getElementById("jsonFileInput").click();
  };

  const handleUpdateMatrix = () => {
    if (selectedNodes.length <= 0) return;

    const allmembers = selectedNodes.map((obj) => obj.members).flat();
    //console.log(allmembers)
    let filteredPixels = pixelData.filter((pair) => {
      return allmembers.includes(pair[0]) && allmembers.includes(pair[1]);
    });

    let indexMapping = {},
      RindexMapping = {};
    allmembers.forEach((val, idx) => {
      indexMapping[val] = idx + 1;
      RindexMapping[idx + 1] = val;
    });

    // Now, filter and remap the giant array
    let remappedArray = filteredPixels
      .filter(
        (pair) => allmembers.includes(pair[0]) && allmembers.includes(pair[1])
      )
      .map((pair) => [indexMapping[pair[0]], indexMapping[pair[1]], pair[2]]);

    setPixelMapData(RindexMapping);
    setPixelData(remappedArray);
  };
  const linkVisibility = (link) => algorithm !== "PCA";

  const handleNodeCanvasObject = (node, ctx, globalScale) => {
    const label = node.id.toString();

    const fontSize = 12 / globalScale; // Adjust font size against zoom level
    let size = node.size / nodeScale;

    if (size < 8) size = 8;
    if (size > 45) size = 45;
    // Draw group background or outline if the node has a groupID
    if (node.groupID.length > 0 && node.x) {
      //size *= 1.5;
      //var groupID = ;
      node.groupID.forEach((groupID) => {
        if (!window.tempt) window.tempt = {};
        if (!window.tempt[groupID]) window.tempt[groupID] = [];
        window.tempt[groupID].push([node.x, node.y]);
        //console.log(node)
        //console.log(JSON.stringify(node));
        //console.log({...node}.x)
        if (window.tempt[groupID].length == allGroups[groupID]) {
          const centroid = drawHullOnCanvas(
            window.tempt[groupID],
            ctx,
            node.groupColor
          );
          window.tempt[groupID] = false;

          if (centroid) {
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
            ctx.font = `${fontSize}px Sans-Serif`;
            ctx.fillText((groupID - 1).toString(), centroid[0], centroid[1]);
          }
        }
      });
    }
    const hexColor = node.color;
    let alpha = 0.4; // 50% transparency
    if (selectedNode) {
      if (selectedNode.id == node.id) alpha = 1;
    } else if (selectedNodes.length > 0) {
      if (selectedNodes.map((node) => node.id).includes(node.id)) alpha = 1;
    } else {
      //nothing is selected
      alpha = 1;
    }

    // Parse the hex color into RGB components
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);

    var x = node.x; // x coordinate of the circle's center
    var y = node.y; // y coordinate of the circle's center

    if (x === undefined || y === undefined) {
      console.log("INVALID NODE XY: ", x, y);
      return;
    }

    if (!size) {
      console.log("INVALID NODE SIZE: ", size);
      return;
    }

    //shadow
    ctx.fillStyle = "rgba(200, 200, 200, 0.7)";

    var innerRadius = 0; // Radius of the inner circle (start of the gradient)
    var outerRadius = size; // Radius of the outer circle (end of the gradient)

    // Draw the shadow
    ctx.beginPath();
    ctx.arc(x + 1, y + 1, outerRadius, 0, 2 * Math.PI, false);
    ctx.fill();
    //--

    // Create gradient
    var gradient = ctx.createRadialGradient(
      x,
      y,
      innerRadius,
      x,
      y,
      outerRadius
    );
    //gradient.addColorStop(1, 'rgba(255, 255, 255, 1)'); // Start color: white
    gradient.addColorStop(0, `rgba(${r * 3}, ${g * 3}, ${b * 3}, ${alpha})`);
    gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, ${alpha})`);

    // Set the gradient as fill style
    ctx.fillStyle = gradient;

    // Draw the circle
    ctx.beginPath();
    ctx.arc(x, y, outerRadius, 0, 2 * Math.PI, false);
    ctx.fill();

    //console.log(outerRadius,gradient)

    let scolor = `rgba(${1}, ${1}, ${1}, ${alpha})`;
    if (node.groupColor) {
      scolor = node.groupColor;
      const r2 = parseInt(node.groupColor.slice(1, 3), 16);
      const g2 = parseInt(node.groupColor.slice(3, 5), 16);
      const b2 = parseInt(node.groupColor.slice(5, 7), 16);

      //scolor = `rgba(${r2}, ${g2}, ${b2}, ${1})`;
      //alert(scolor)
    }

    ctx.strokeStyle = scolor;

    //ctx.strokeStyle = node.groupColor; // Color for the dashed line
    ctx.lineWidth = 0.4; // Width of the dashed line
    ctx.stroke(); // Apply the line style to the hull

    //ctx.strokeStyle = 'black';

    // Draw labels for larger nodes
    if (size > 5 / globalScale) {
      let fontSize_ = Math.round(fontSize + size / globalScale);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "black"; //`rgba(255, 255, 255, ${alpha*2})`;
      ctx.font = `${fontSize_}px Sans-Serif`;
      ctx.fillText(label, node.x, node.y);
      //ctx.fillText(size.toString(), node.x, node.y);
    }
  };

  return (
    <Allotment vertical={true} defaultSizes={[1, 2]}>
      <Allotment.Pane>
        {isEmpty && (
          <Box sx={{ p: 3 }}>
            <Grid2 container spacing={1}>
              <Grid2 container size={12} spacing={2}>
                <Grid2 size={4.5}></Grid2>
                <Grid2
                  size={3}
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    height: "100%",
                  }}
                >
                  <Button
                    component="label"
                    variant="contained"
                    tabIndex={-1}
                    startIcon={<PlayArrowIcon />}
                    fullWidth
                    disabled={multiSelect}
                    sx={{ flexGrow: 1 }}
                    onClick={() => handleStart()}
                  >
                    Start
                  </Button>
                </Grid2>
                <Grid2 size={4.5}></Grid2>
              </Grid2>

              <Typography sx={{ fontWeight: "bold" }}>
                Graph Community Settings
              </Typography>

              <Grid2 container size={12} spacing={2}>
                <Grid2 size={6}>
                  <CustomSelect
                    name={"Algorithm"}
                    onChange={(e) => setAlgorithm(e.target.value)}
                    defaultValue={algorithm}
                    options={[
                      { value: "Louvain", label: "Louvain" },
                      { value: "Louvain-SL", label: "Louvain-SL" },
                      { value: "PCA", label: "PCA K-Means" },
                      { value: "Infomap", label: "Infomap" },
                      {
                        value: "Label Propagation",
                        label: "Label Propagation",
                      },
                      { value: "Hamming Distance", label: "Hamming Distance" },
                      { value: "Blank", label: "Blank" },
                    ]}
                  />
                  <CustomNumberInput
                    name={"Node Scale"}
                    onChange={(e) => setNodeScale(Number(e.target.value))}
                    defaultValue={nodeScale}
                  />
                  <CustomNumberInput
                    name={"Seed"}
                    onChange={(e) => {
                      setSeed(Number(e.target.value));
                      seedrandom(seed, { global: true });
                    }}
                    defaultValue={seed}
                  />
                </Grid2>
                <Grid2 size={6}>{renderInputs()}</Grid2>
              </Grid2>
            </Grid2>
          </Box>
        )}
        {!isEmpty && (
          <>
            <button onClick={() => handleStart()} disabled={multiSelect}>
              Start
            </button>

            <button
              onClick={handleMergeCommunities}
              disabled={!multiSelect || selectedNodes.length <= 1}
            >
              Merge
            </button>

            <button
              onClick={() => handleSplitCommunity()}
              disabled={multiSelect}
            >
              Split
            </button>

            <button
              onClick={() => handleCollaspeGroup()}
              disabled={multiSelect}
            >
              Collasp Group
            </button>

            <button onClick={() => handleExpandGroup()} disabled={multiSelect}>
              Expand Group
            </button>

            <button onClick={() => handleUpdateMatrix()}>Update Matrix</button>

            <button onClick={() => handleUndo()}>Undo</button>
            <button onClick={() => handleDownload()}>💾</button>

            <button onClick={() => handleButtonClick()}>📁</button>

            <input
              type="file"
              id="jsonFileInput"
              style={{ display: "none" }}
              accept=".json"
              onChange={handleFileChange}
            />

            <input
              defaultValue={seed}
              style={{ maxWidth: "45px" }}
              type="number"
              onChange={(e) => {
                setSeed(Number(e.target.value));
              }}
            />
            <label>
              <input
                type="checkbox"
                checked={use3D}
                onChange={(e) => {
                  setUse3D(e.target.checked);
                }}
              />
              Use3D
            </label>
            <label>
              <input
                type="checkbox"
                checked={multiSelect}
                onChange={(e) => {
                  setMultiSelect(e.target.checked);
                  if (!e.target.checked) {
                    setSelectedNodes([]); // Clear selected nodes when multi-select is turned off
                  }
                }}
              />
              Multi select
            </label>
            <br />
            <Grid2 container spacing={1}></Grid2>
            <Grid2 container size={12} spacing={2}>
              <Grid2 size={6}>
                <CustomSelect
                  name={"Algorithm"}
                  onChange={(e) => setAlgorithm(e.target.value)}
                  defaultValue={algorithm}
                  options={[
                    { value: "Louvain", label: "Louvain" },
                    { value: "Louvain-SL", label: "Louvain-SL" },
                    { value: "PCA", label: "PCA K-Means" },
                    { value: "Infomap", label: "Infomap" },
                    { value: "Label Propagation", label: "Label Propagation" },
                    { value: "Hamming Distance", label: "Hamming Distance" },
                    { value: "Selected", label: "Selected" },
                  ]}
                />
                <CustomNumberInput
                  name={"Node Scale"}
                  onChange={(e) => setNodeScale(Number(e.target.value))}
                  defaultValue={nodeScale}
                />
                <CustomNumberInput
                  name={"Seed"}
                  onChange={(e) => setSeed(Number(e.target.value))}
                  defaultValue={seed}
                />
              </Grid2>
              <Grid2 size={6}>{renderInputs()}</Grid2>
            </Grid2>

            <br />
            {/* Optional: Display the list of selected node IDs */}
            {multiSelect && selectedNodes.length > 0 && (
              <div>
                Selected Nodes:
                <ul>
                  {selectedNodes.map((node, index) => (
                    <li key={index}>
                      Community {node.id}: {node.members.length} Members
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </Allotment.Pane>

      <Allotment.Pane>
        <div style={{ width: "100%", height: "100%" }} ref={windowRef}>
          {!use3D && (
            <ForceGraph2D
              width={dimensions.width}
              height={dimensions.height}
              linkVisibility={linkVisibility}
              graphData={graphData}
              nodeLabel="id"
              ref={fgRef}
              onNodeClick={handleNodeClick}
              onNodeRightClick={handleNodeClick} // Add this line
              nodeCanvasObject={handleNodeCanvasObject}
              linkDirectionalArrowLength={2.5}
              linkDirectionalArrowRelPos={0.6}
              linkDirectionalArrowColor={"black"}
              linkCurvature={0.25}
              linkOpacity={1}
              linkColor={"black"}
              linkWidth={4}
              d3Force="charge" // Modify the charge force
              d3ReheatSimulation={true}
              //d3AlphaDecay={0.0228} // Can tweak this for simulation cooling rate
              //d3VelocityDecay={0.4} // Can tweak this to adjust node movement inertia
              d3ForceConfig={{
                charge: {
                  strength: -220,
                  distanceMax: 300, // Optional: Increase to allow repulsion over larger distances
                  //distanceMin: 1    // Optional: Decrease to enhance repulsion for closely positioned nodes
                },
                link: {
                  // Adjust the strength of the link force based on groupID
                  strength: (link) => {
                    const sourceNode = graphData.nodes[link.source];
                    const targetNode = graphData.nodes[link.target];
                    alert("HERE");
                    return sourceNode.groupID === targetNode.groupID ? 1 : 4; // Modify as needed
                  },
                  // You can also configure other link force parameters here
                },
              }}
            />
          )}
        </div>
      </Allotment.Pane>
    </Allotment>
  );
};

export default GraphCommunitiesUnused;
