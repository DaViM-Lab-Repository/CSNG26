import React, { createContext, useContext } from "react";
import { GraphCommunitiesDataContext } from "./GraphCommunitiesDataContext";
import { UniversalDataContext } from "./UniversalDataContext";
import { NearestNeighborDataContext } from "./NearestNeighborDataContext";
import { LineSegmentsDataContext } from "./LineSegmentsDataContext"; // Added import
import { SYSTEM_PROMPT } from "./systemPrompt";

export const LLMContext = createContext();

export const LLMProvider = ({ children }) => {
  const {
    graphData,
    communityAlgorithm,
    dGraphData,
    setInputs,
    inputs,
    setCommunityAlgorithm
  } = useContext(GraphCommunitiesDataContext);

  const { segments, streamLines } = useContext(UniversalDataContext);

  const {
    treeAlgorithm,
    k,
    r,
    distanceMetric,
    setTreeAlgorithm,
    setK,
    setR,
    setDistanceMetric,
    setExclude,
    setSortType,
    setDoSort
  } = useContext(NearestNeighborDataContext);

  const { setRenderingMethod, setRadius: setLineSegmentRadius } = useContext(LineSegmentsDataContext); // Added access to LineSegmentsDataContext

  const [sendCommunityResultsToLLM, setSendCommunityResultsToLLM] = React.useState(false);

  const generateCommunitySummary = (currentGraphData = graphData, currentAlgorithm = communityAlgorithm) => {
    if (!currentGraphData?.nodes?.length) {
      return "No community detection results available.";
    }

    const communitySizes = currentGraphData.nodes.map(node => node.members.length);
    const totalCommunities = currentGraphData.nodes.length;
    const avgSize = communitySizes.reduce((a, b) => a + b, 0) / totalCommunities;
    const minSize = Math.min(...communitySizes);
    const maxSize = Math.max(...communitySizes);

    return `\n\nCurrent Community Detection Results:
Algorithm: ${currentAlgorithm}
Number of Communities: ${totalCommunities}
Average Community Size: ${avgSize.toFixed(2)}
Minimum Community Size: ${minSize}
Maximum Community Size: ${maxSize}`;
  };

  const generateSegmentSummary = () => {
    if (!segments?.length && !streamLines?.length) {
      return "No segment data available.";
    }

    return `\n\nCurrent Segment Data:
Number of Segments: ${segments.length}
Number of Streamlines: ${streamLines.length}`;
  };

  const generateNeighborhoodSummary = () => {
    const graphSize = dGraphData?.length || 0;
    const paramValue = treeAlgorithm === "KNN" ? `K=${k}` : `Radius=${r}`;

    return `\n\nCurrent Neighborhood Graph Settings:
Algorithm: ${treeAlgorithm}
${paramValue}
Distance Metric: ${distanceMetric}
Graph Size: ${graphSize} nodes
Average Neighbors per Node: ${graphSize > 0 ? (treeAlgorithm === "KNN" ? k : "Variable (radius-based)") : "N/A"}`;
  };

  // Clean message by removing any previously appended data
  const cleanMessage = (message) => {
    return message.replace(/\n\nCurrent (Community Detection Results|Segment Data|Neighborhood Graph Settings):[\s\S]*$/, '');
  };

  // New function to adjust neighborhood parameters
  const adjustNeighborhoodParams = (params) => {
    const {
      algorithm,
      kValue,
      radius,
      metric,
      excludeOption,
      doSortOption,
      sortTypeOption
    } = params;

    if (algorithm && ["KNN", "RBN"].includes(algorithm)) {
      setTreeAlgorithm(algorithm);
    }
    
    if (kValue !== undefined && kValue >= 1) {
      setK(Math.floor(kValue));
    }
    
    if (radius !== undefined && radius >= 0 && radius <= 1) {
      setR(radius);
    }
    
    if (metric && ["shortest", "longest", "hausdorff"].includes(metric)) {
      setDistanceMetric(metric);
    }
    
    if (excludeOption !== undefined) {
      setExclude(Boolean(excludeOption));
    }
    
    if (doSortOption !== undefined) {
      setDoSort(Boolean(doSortOption));
    }
    
    if (sortTypeOption !== undefined && [1, 2].includes(sortTypeOption)) {
      setSortType(sortTypeOption);
    }
  };

  // New function to adjust community parameters
  const adjustCommunityParams = (params) => {
    console.log('Adjusting community parameters with:', params);
    
    const {
      algorithm,
      resolution,
      randomWalk,
      min,
      gamma,
      maxIter,
      dims,
      kmean,
      runDetection,
      sendCommunityResultsToLLM: shouldSendResults
    } = params;

    // Create a promise that resolves when all state updates are complete
    const updatePromises = [];

    if (algorithm && ["Louvain", "Louvain-SL", "PCA K-Means", "Infomap", "Label Propagation"].includes(algorithm)) {
      console.log(`Setting algorithm to: ${algorithm}`);
      updatePromises.push(new Promise(resolve => {
        setCommunityAlgorithm(algorithm);
        resolve();
      }));
    }

    const newInputs = { ...inputs };
    console.log('Current inputs:', inputs);
    
    if (resolution !== undefined && resolution > 0) {
      console.log(`Updating resolution: ${resolution}`);
      newInputs.resolution = resolution;
    }
    
    if (randomWalk !== undefined) {
      console.log(`Updating randomWalk: ${randomWalk}`);
      newInputs.randomWalk = Boolean(randomWalk);
    }
    
    if (min !== undefined && min >= 0) {
      console.log(`Updating min: ${min}`);
      newInputs.min = min;
    }
    
    if (gamma !== undefined && gamma >= 0 && gamma <= 1) {
      console.log(`Updating gamma: ${gamma}`);
      newInputs.gamma = gamma;
    }
    
    if (maxIter !== undefined && maxIter >= 1) {
      console.log(`Updating maxIter: ${Math.floor(maxIter)}`);
      newInputs.max = Math.floor(maxIter);
    }
    
    if (dims !== undefined && dims >= 1) {
      console.log(`Updating dims: ${Math.floor(dims)}`);
      newInputs.dims = Math.floor(dims);
    }
    
    if (kmean !== undefined && kmean >= 1) {
      console.log(`Updating kmean: ${Math.floor(kmean)}`);
      newInputs.kmean = Math.floor(kmean);
    }

    updatePromises.push(new Promise(resolve => {
      setInputs(newInputs);
      resolve();
    }));

    if (shouldSendResults !== undefined) {
      console.log(`Updating sendCommunityResultsToLLM: ${shouldSendResults}`);
      updatePromises.push(new Promise(resolve => {
        setSendCommunityResultsToLLM(Boolean(shouldSendResults));
        resolve();
      }));
    }

    console.log('New inputs after updates:', newInputs);

    // Return an object with both the runDetection flag and the promises
    return {
      runDetection: Boolean(runDetection),
      updatePromises
    };
  };

  // New function to adjust rendering parameters
  const adjustRenderParams = (params) => {
    console.log('Adjusting rendering parameters with:', params);
    const { renderType, radius } = params;

    if (renderType) {
      // Map to the values used in LineSegmentSettings ("Line", "Tube")
      const mappedRenderType = renderType.toLowerCase() === "line" ? "Line" : renderType.toLowerCase() === "tube" ? "Tube" : null;
      if (mappedRenderType && ["Line", "Tube"].includes(mappedRenderType)) {
        console.log(`Setting renderType to: ${mappedRenderType}`);
        setRenderingMethod(mappedRenderType);
      } else {
        console.warn(`Invalid renderType received: ${renderType}. Expected "line" or "tube".`);
      }
    }

    if (radius !== undefined && radius >= 0.1) {
      console.log(`Setting radius to: ${radius}`);
      setLineSegmentRadius(radius);
    } else if (radius !== undefined) {
      console.warn(`Invalid radius received: ${radius}. Expected number >= 0.1.`);
    }
  };

  return (
    <LLMContext.Provider value={{
      generateCommunitySummary,
      generateSegmentSummary,
      generateNeighborhoodSummary,
      cleanMessage,
      adjustNeighborhoodParams,
      adjustCommunityParams,
      adjustRenderParams, // Added new function
      systemPrompt: SYSTEM_PROMPT,
      sendCommunityResultsToLLM,
      setSendCommunityResultsToLLM
    }}>
      {children}
    </LLMContext.Provider>
  );
};
