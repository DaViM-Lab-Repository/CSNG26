import Graph from "graphology";
import louvain from "graphology-communities-louvain";
import { scaleOrdinal } from "d3-scale";
import { schemeCategory10 } from "d3-scale-chromatic";
import jLayeredLabelPropagation from "./JLayeredLabelPropogation";
import jHamming from "./JHamming";
import jInfomap from "./JInfoMap";
import { PCA } from "ml-pca";
import { kmeans } from "ml-kmeans";
import chroma from "chroma-js";
import * as THREE from "three"; // For vector math
import seedrandom from "seedrandom";

import { Segment, unpackSegments } from '../Segment'; //segment class definition

const colorScale = scaleOrdinal(schemeCategory10);

let imapNodes = [];
let imapEdges = [];
let graph = new Graph();

const computeGraph = (dGraphData) => {
  if (!dGraphData || dGraphData.length === 0) return;

  // Pre-allocate arrays with known sizes
  imapNodes = new Array(dGraphData.length);
  imapEdges = [];
  graph = new Graph();

  let startTime = performance.now();
  
  // Fill pre-allocated array
  for (let nodeIndex = 0; nodeIndex < dGraphData.length; nodeIndex++) {
    if (!graph.hasNode(nodeIndex)) {
      graph.addNode(nodeIndex);
    }
    imapNodes[nodeIndex] = nodeIndex;
  }

  // Pre-calculate total number of edges to pre-allocate
  let totalEdges = 0;
  for (let i = 0; i < dGraphData.length; i++) {
    totalEdges += dGraphData[i].length;
  }
  imapEdges = new Array(totalEdges);
  
  // Fill edges array
  let edgeIndex = 0;
  for (let source = 0; source < dGraphData.length; source++) {
    const edges = dGraphData[source];
    for (let j = 0; j < edges.length; j++) {
      const target = edges[j];
      imapEdges[edgeIndex++] = {
        source,
        target,
        value: 1,
      };
      
      if (!graph.hasNode(target)) {
        graph.addNode(target);
      }
      if (!graph.hasEdge(source, target)) {
        graph.addEdge(source, target);
      }
    }
  }

  let endTime = performance.now();
  // console.log(`Community Precompute Time: ${(endTime - startTime).toFixed(2)} ms`);
};

const pcaKmeansSegmentClustering = (segments, pcaDims, k, seed) => {
  // Create feature vectors for each segment individually
  const segmentFeatures = segments.map((segment) => [
    ...segment.startPoint,
    ...segment.endPoint,
    ...segment.midPoint,
  ]);

  // Apply PCA to the segment feature vectors
  const pca = new PCA(segmentFeatures);
  const reducedData = pca.predict(segmentFeatures, {
    nComponents: pcaDims,
  });
  const reducedDataArray = Array.from(reducedData.data).map((row) =>
    Array.from(row)
  );

  // Apply K-means clustering
  let ans = kmeans(reducedDataArray, k, { seed: seed });
  
  // Create communities mapping
  const communities = {};
  ans.clusters.forEach((cluster, segmentIndex) => {
    communities[segmentIndex] = cluster;
  });

  return fillHolesInCommunities(communities);
};

const pcaKmeansStreamlineClustering = (segments, pcaDims, k, seed) => {
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

  let ans = kmeans(reducedDataArray, k, { seed: seed });
  const communities = {};
  ans.clusters.forEach((cluster, streamlineIndex) => {
    const [startIdx, endIdx] = streamlines[streamlineIndex];
    for (let i = startIdx; i <= endIdx; i++) {
      communities[i] = cluster;
    }
  });

  return fillHolesInCommunities(communities);
};

const fillHolesInCommunities = (communities) => {
  const sortedKeys = Object.keys(communities)
    .map(Number)
    .sort((a, b) => a - b);
  const newCommunities = {};
  let gapCount = 0;

  for (let i = 0; i < sortedKeys.length; i++) {
    // Check if there is a hole
    if (i > 0 && sortedKeys[i] !== sortedKeys[i - 1] + 1) {
      gapCount += sortedKeys[i] - sortedKeys[i - 1] - 1;
    }
    newCommunities[sortedKeys[i] - gapCount] = communities[sortedKeys[i]];
  }

  return newCommunities;
};

const createGraph = (event) => {
  let { functionType, dGraphData, segments, inputs, communityAlgorithm, seed } =
    event.data;
  segments = unpackSegments(event.data.segments);
  let startTime = 0;
  let endTime = 0;

  // Track total runtime for this algorithm
  const totalStartTime = performance.now();

  if (imapNodes.length === 0 || imapEdges.length === 0) {
    // console.error("Precompute not done, doing it now..."); // Quieter log
    computeGraph(dGraphData);
  }

  startTime = performance.now();

  // Create seeded random number generator for Louvain algorithms
  const seededRandom = seedrandom(seed);

  // Detect communities
  let communities;
  switch (communityAlgorithm) {
    case "Louvain":
      communities = louvain(graph, {
        resolution: inputs.resolution,
        randomWalk: inputs.randomWalk,
        random: seededRandom,
      });
      break;
      case "Louvain-SL":
        const streamlineGraph = new Graph({ type: 'undirected' });
        const streamlineMap = new Map();
      
        // Map segments to streamlines
        segments.forEach((segment, segmentIndex) => {
          const streamlineIndex = segment.lineIDx;
          if (!streamlineMap.has(streamlineIndex)) {
            streamlineMap.set(streamlineIndex, []);
          }
          streamlineMap.get(streamlineIndex).push(segmentIndex);
        });
      
        // Add nodes to streamlineGraph first
        streamlineMap.forEach((_, streamlineIndex) => {
          streamlineGraph.addNode(streamlineIndex);
        });
      
        // Add edges between streamlines
        streamlineMap.forEach((segmentIndices, streamlineIndex) => {
          segmentIndices.forEach(segmentIndex => {
            dGraphData[segmentIndex].forEach(neighborIndex => {
              const neighborStreamlineIndex = segments[neighborIndex].lineIDx;
              if (streamlineIndex !== neighborStreamlineIndex) {
                if (!streamlineGraph.hasEdge(streamlineIndex, neighborStreamlineIndex)) {
                  streamlineGraph.addEdge(streamlineIndex, neighborStreamlineIndex);
                }
              }
            });
          });
        });
      
        // Run Louvain with seeded random number generator
        const streamlineCommunities = louvain(streamlineGraph, {
          resolution: inputs.resolution,
          randomWalk: inputs.randomWalk,
          random: seededRandom
        });
      
        // Map streamline communities back to segments
        communities = {};
        streamlineMap.forEach((segmentIndices, streamlineIndex) => {
          const communityId = streamlineCommunities[streamlineIndex];
          segmentIndices.forEach(segmentIndex => {
            communities[segmentIndex] = communityId;
          });
        });
        break;
    case "PCA":
      communities = pcaKmeansSegmentClustering(
        segments,
        inputs.dims,
        inputs.kmean,
        seed
      );
      break;
    case "PCA-SL":
      communities = pcaKmeansStreamlineClustering(
        segments,
        inputs.dims,
        inputs.kmean,
        seed
      );
      break;
    case "Infomap":
      communities = jInfomap(imapNodes, imapEdges, inputs.min);
      break;
    case "Hamming Distance":
      communities = jHamming(nodes, links, inputs.min);
      break;
    case "Label Propagation":
      communities = jLayeredLabelPropagation(
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

  console.log(`Community Detect Time: ${(endTime - startTime).toFixed(2)} ms`);
  
  // Count unique communities
  const uniqueCommunities = new Set(Object.values(communities));
  const numCommunities = uniqueCommunities.size;
  console.log(`Number of Communities: ${numCommunities}`);

  startTime = performance.now();

  Object.entries(communities).forEach(([nodeId, communityIndex]) => {
    const color = colorScale(communityIndex.toString());
    if (segments[parseInt(nodeId)]) {
      segments[parseInt(nodeId)].color = color;
      segments[parseInt(nodeId)].communityIndex = communityIndex;
    }
  });

  const communityGraph = new Graph(); // This will store the community graph
  // Process communities, creating nodes for each community and counting sizes
  Object.entries(communities).forEach(([node, community]) => {
    if (!segments[parseInt(node)]) return;
    if (!communityGraph.hasNode(community)) {
      communityGraph.addNode(community, { size: 1 });
    } else {
      communityGraph.updateNodeAttribute(community, "size", (size) => size + 1);
    }
  });

  // Now, let's prepare dGraphData for visualization
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

  // Use a set to store unique inter-community links in the format "smaller_larger" to ensure uniqueness
  const interCommunityLinksSet = new Set();

  dGraphData.forEach((edges, source) => {
    edges.forEach((target) => {
      const sourceCommunity = communities[source];
      const targetCommunity = communities[target];

      // Check if communities are different, now including community 0
      if (sourceCommunity !== targetCommunity) {
        // Ensure a consistent order for the pair to avoid duplicate entries in set
        const sortedPair = [sourceCommunity, targetCommunity].sort().join("_");
        interCommunityLinksSet.add(sortedPair);
      }
    });
  });

  // Convert the set back to an array of objects for further processing or output
  let interCommunityLinks = Array.from(interCommunityLinksSet).map((pair) => {
    const [source, target] = pair.split("_");
    return { source, target };
  });
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

  endTime = performance.now();
  // console.log(`Community and Graph Structure Time: ${(endTime - startTime).toFixed(2)} ms`);

  // Calculate Saliency
  startTime = performance.now();
  const saliencyData = calculateSaliency(segments, dGraphData);
  endTime = performance.now();
  // console.log(`Saliency Calculation Time: ${(endTime - startTime).toFixed(2)} ms`);

  // --- Calculate segmentCommunitySizeData ---
  startTime = performance.now();
  const communityMemberCounts = {};
  Object.values(communities).forEach(communityId => {
    communityMemberCounts[communityId] = (communityMemberCounts[communityId] || 0) + 1;
  });
  const segmentCommunitySizeData = segments.map(segment => ({
    globalIdx: segment.globalIdx,
    communitySize: communityMemberCounts[segment.communityIndex] || 0
  }));
  endTime = performance.now();
  // console.log(`Community Size Data Calculation Time: ${(endTime - startTime).toFixed(2)} ms`);

  // --- Calculate segmentCommunityConnectionData ---
  startTime = performance.now();
  const communityConnectionCounts = {};
  interCommunityLinks.forEach(link => {
    // Ensure link.source and link.target are treated as numbers if communityIndex is a number
    const sourceCommunityId = typeof communities[0] === 'number' ? parseInt(link.source, 10) : link.source;
    const targetCommunityId = typeof communities[0] === 'number' ? parseInt(link.target, 10) : link.target;
    communityConnectionCounts[sourceCommunityId] = (communityConnectionCounts[sourceCommunityId] || 0) + 1;
    communityConnectionCounts[targetCommunityId] = (communityConnectionCounts[targetCommunityId] || 0) + 1;
  });
  const segmentCommunityConnectionData = segments.map(segment => ({
    globalIdx: segment.globalIdx,
    communityConnections: communityConnectionCounts[segment.communityIndex] || 0
  }));
  endTime = performance.now();
  // console.log(`Community Connection Data Calculation Time: ${(endTime - startTime).toFixed(2)} ms`);
  
  // --- Calculate segmentAverageDistanceData ---
  startTime = performance.now();
  const segmentAverageDistanceData = segments.map(segment => {
    let totalDistance = 0;
    let validNeighborCount = 0;
    const sourceMidPoint = new THREE.Vector3().fromArray(segment.midPoint);
    const neighborIndices = dGraphData[segment.globalIdx] || [];

    neighborIndices.forEach(neighborIdx => {
      if (segments[neighborIdx] && segments[neighborIdx].midPoint) {
        const neighborMidPoint = new THREE.Vector3().fromArray(segments[neighborIdx].midPoint);
        totalDistance += sourceMidPoint.distanceTo(neighborMidPoint);
        validNeighborCount++;
      }
    });
    return {
      globalIdx: segment.globalIdx,
      averageDistance: validNeighborCount > 0 ? totalDistance / validNeighborCount : 0
    };
  });
  endTime = performance.now();
  // console.log(`Average Distance Data Calculation Time: ${(endTime - startTime).toFixed(2)} ms`);

  // Calculate total runtime
  const totalEndTime = performance.now();
  const totalRuntime = totalEndTime - totalStartTime;

  return {
    nodesWithCommunityMembers: nodesWithCommunityMembers,
    interCommunityLinks: interCommunityLinks,
    segments: segments, // segments now include color and communityIndex
    communities: communities,
    saliencyData: saliencyData, 
    segmentAverageDistanceData: segmentAverageDistanceData,
    segmentCommunitySizeData: segmentCommunitySizeData,
    segmentCommunityConnectionData: segmentCommunityConnectionData,
    runtimeData: {
      name: "graphcomm",
      runtime: totalRuntime
    }
  };
};

// --- Saliency Calculation Functions START ---

// Helper to get segment orientation vector
const getSegmentOrientation = (segment) => {
  if (!segment || !segment.startPoint || !segment.endPoint) {
    return new THREE.Vector3(0, 0, 0);
  }
  const start = new THREE.Vector3().fromArray(segment.startPoint);
  const end = new THREE.Vector3().fromArray(segment.endPoint);
  // Ensure there's a non-zero vector before normalizing
  const direction = new THREE.Vector3().subVectors(end, start);
  if (direction.lengthSq() === 0) { // Start and end points are the same
      return new THREE.Vector3(0,0,0);
  }
  return direction.normalize();
};

const calculateSaliency = (segments, dGraphData) => {
  if (!segments || segments.length === 0 || !dGraphData || dGraphData.length === 0) {
    return [];
  }

  const saliencyResults = new Array(segments.length);

  for (let i = 0; i < segments.length; i++) {
    const targetSegment = segments[i];
    if (!targetSegment || targetSegment.globalIdx === undefined ) { // Added check for globalIdx
      saliencyResults[i] = { globalIdx: i, saliency: 0, neighborsCount: 0 };
      continue;
    }

    const targetOrientation = getSegmentOrientation(targetSegment);
    
    const neighborIndices = dGraphData[targetSegment.globalIdx] || [];
    
    let totalAngleValue = 0; // Renamed for clarity, as it's not strictly "difference" anymore
    let validNeighborsCount = 0;

    if (neighborIndices.length > 0) {
      for (const neighborIdx of neighborIndices) {
        // Ensure neighborIdx is within bounds of segments array
        if (neighborIdx < 0 || neighborIdx >= segments.length) {
            // console.warn(`Neighbor index ${neighborIdx} out of bounds.`);
            continue;
        }
        const neighborSegment = segments[neighborIdx];
        // Ensure neighborSegment exists and is not the target segment itself
        if (neighborSegment && neighborSegment.globalIdx !== undefined && neighborSegment.globalIdx !== targetSegment.globalIdx) {
          const neighborOrientation = getSegmentOrientation(neighborSegment);
          
          if (targetOrientation.lengthSq() > 0 && neighborOrientation.lengthSq() > 0) {
            let dotProduct = targetOrientation.dot(neighborOrientation);
            
            // Clamp dotProduct to the range [-1, 1] to prevent Math.acos errors from floating point inaccuracies
            dotProduct = Math.max(-1, Math.min(1, dotProduct)); 
            
            // Calculate angle between vectors (0 to PI)
            // 0 for same direction
            // PI for opposite direction (anti-parallel)
            // PI/2 for perpendicular
            const angle = Math.acos(dotProduct); 
            
            totalAngleValue += angle;
            validNeighborsCount++;
          }
        }
      }
    }
    
    saliencyResults[i] = {
      globalIdx: targetSegment.globalIdx,
      // Saliency is now the average angle in radians (0 to PI).
      // Higher values mean greater angular difference.
      // PI (approx 3.14159) indicates, on average, neighbors are oppositely oriented.
      // 0 indicates, on average, neighbors have the same orientation.
      saliency: validNeighborsCount > 0 ? totalAngleValue / validNeighborsCount : 0,
      neighborsCount: validNeighborsCount
    };
  }
  return saliencyResults;
};
// --- Saliency Calculation Functions END ---

const handleSplitCommunity = (event) => {
  const {
    communityAlgorithm,
    dGraphData,
    graphData,
    splitInto,
    selectedSegments,
    orgCommunities,
    selectedNodes,
    inputs,
    seed,
    //segments,
  } = event.data;
  
  const segments = unpackSegments(event.data.segments);

  const communityIndex = selectedNodes[0].id;
  const X = 3;
  const orgSize = selectedNodes[0].size;

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

  let newOrgCommunities;

  if (splitInto) {
    fnodes = splitInto.nodes;
    fdata = splitInto;
    interCommunityLinks = fdata.links;
    //alert("ARASD")
  } else {
    //alert("HERE")

    fdata = indicesToFilter.map((index) => dGraphData[index]);
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

    // Create seeded random number generator for Louvain algorithms
    const seededRandom = seedrandom(seed);

    // Detect communities
    //const communities = louvain(graph);
    let communities;
    switch (communityAlgorithm) {
      case "Louvain":
        communities = louvain(graph, {
          resolution: inputs.resolution,
          randomWalk: inputs.randomWalk,
          random: seededRandom,
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
            dGraphData[segmentIndex].forEach((neighborIndex) => {
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

        // Step 2: Perform Louvain community detection on streamlineGraph with seeded random
        const streamlineCommunities = louvain(streamlineGraph, {
          resolution: inputs.resolution,
          randomWalk: inputs.randomWalk,
          random: seededRandom,
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
      case "Infomap":
        communities = jInfomap(imapNodes, imapEdges, inputs.min);
        break;
      case "Hamming Distance":
        communities = jHamming(nodes, links, inputs.min);
        break;
      case "Label Propagation":
        communities = jLayeredLabelPropagation(
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
        console.log("selectedSegments:", selectedSegments);
        selectedSegments.forEach((seg) => {
          if (communities[seg.globalIdx] !== undefined) {
            communities[seg.globalIdx] = 1;
          }
        });
        break;
    }
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
    console.log("creating fnodes");
    fnodes = communityGraph.nodes().map((node) => ({
      id: node.toString(),
      size:
        (communityGraph.getNodeAttribute(node, "size") / totalMembers) *
        orgSize,
      color: colorScale(node.toString()),
      groupID:
        communityAlgorithm !== "Selected"
          ? [...communityNode.groupID, maxCommunityIndex]
          : [...communityNode.groupID],
      groupColor: groupColorWithOpacity, //colorScale(maxCommunityIndex.toString()),
      groupSize: communityGraph.nodes().length,
    }));

    interCommunityLinks = [];

    if (communityAlgorithm !== "Selected")
      fdata.forEach((edges, source) => {
        source = indicesToFilter[source];
        edges.forEach((target) => {
          const sourceCommunity = communities[source] + maxCommunityIndex;
          const targetCommunity = communities[target] + maxCommunityIndex;

          if (
            targetCommunity &&
            sourceCommunity != communityIndex &&
            targetCommunity != communityIndex
          ) {
            if (sourceCommunity !== targetCommunity) {
              const linkExists = interCommunityLinks.some(
                (link) =>
                  (link.source === sourceCommunity &&
                    link.target === targetCommunity) ||
                  (link.source === targetCommunity &&
                    link.target === sourceCommunity)
              );

              if (!sourceCommunity || !targetCommunity)
                console.log([sourceCommunity, targetCommunity, source, target]);
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

    if (communityAlgorithm !== "Selected")
      dGraphData.forEach((edges, source) => {
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
            }
          }
        });
      });

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

    let adjustedComm = Object.keys(communities).reduce((newObj, key) => {
      let adjustedKey = parseInt(key) + maxCommunityIndex;
      let adjustedValue = communities[key] + maxCommunityIndex;
      newObj[key] = adjustedValue;
      return newObj;
    }, {});

    newOrgCommunities = { ...orgCommunities, ...adjustedComm };

    const communityMembers = {};
    Object.entries(communities).forEach(([originalNode, communityId]) => {
      if (!communityMembers[communityId]) {
        communityMembers[communityId] = [];
      }
      communityMembers[communityId].push(parseInt(originalNode, 10));
    });
    fnodes = fnodes.map((node) => ({
      ...node,
      id: (parseInt(node.id) + maxCommunityIndex).toString(),
      members: communityMembers[node.id] || [],
    }));
  }

  fnodes = nodes.concat(fnodes);
  newLinks = newLinks.concat(interCommunityLinks);

  return {
    newGraphData: {
      nodes: fnodes,
      links: newLinks,
    },
    newOrgCommunities: newOrgCommunities,
    newGroups: fnodes,
  };
};

const handleMergeCommunity = (event) => {
  const { graphData, orgCommunities, selectedNodes } = event.data;
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
  const newOrgCommunities = orgCommunities;
  // Iterate over the mergeArray
  for (let key in newOrgCommunities) {
    if (mergeIds.includes(newOrgCommunities[key].toString())) {
      newOrgCommunities[key] = newCommunityIndex;
      //console.log(key)
    }
  }

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
  links = links
    .map((link) => {
      // Update the source and target of the link if they refer to a community that was merged
      return {
        source: toMerge.includes(link.source) ? newCommunityIndex : link.source,
        target: toMerge.includes(link.target) ? newCommunityIndex : link.target,
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

  return {
    newOrgCommunities: newOrgCommunities,
    newGraphData: {
      nodes: nodes,
      links: links,
    },
    newNodes: nodes,
  };
};

self.addEventListener("message", (event) => {
  if (event.data.functionType === "preCompute")
    computeGraph(event.data.dGraphData);
  else if (event.data.functionType === "createGraph") {
    const res = createGraph(event);
    self.postMessage(res);
  } else if (event.data.functionType === "splitCommunity") {
    const res = handleSplitCommunity(event);
    self.postMessage(res);
  } else if (event.data.functionType === "mergeCommunity") {
    const res = handleMergeCommunity(event);
    self.postMessage(res);
  }
});
