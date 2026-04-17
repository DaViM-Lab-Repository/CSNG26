import React, { createContext, useState } from "react";
export const GraphCommunitiesDataContext = createContext();

export const GraphCommunitiesDataProvider = ({ children }) => {
  const [dGraphData, setDGraphData] = useState([]);
  const [isEmpty, setIsEmpty] = useState(true);
  const [use3D, setUse3D] = useState(false);
  const [multiSelect, setMultiSelect] = useState(false);
  const [nodeScale, setNodeScale] = useState(1);
  const [selectedNodes, setSelectedNodes] = useState([]);
  const [communityAlgorithm, setCommunityAlgorithm] = useState("Louvain");
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [allGroups, setAllGroups] = useState([]);
  const [undoState, setUndoState] = useState(false);
  const [orgCommunities, setOrgCommunities] = useState({
    nodes: [],
    links: [],
  });
  const [seed, setSeed] = useState(1);
  const [opacityMode, setOpacityMode] = useState("highlight-selected");
  const [opacityTransferFunction, setOpacityTransferFunction] = useState([
    { target: 0, alpha: 0.3 },
    { target: 1, alpha: 1.0 }
  ]);
  const [inputs, setInputs] = useState({
    resolution: 1,
    randomWalk: false,
    min: 0.01,
    gamma: 0.1,
    max: 10,
    dims: 5,
    kmean: 8,
  });

  return (
    <GraphCommunitiesDataContext.Provider
      value={{
        dGraphData,
        setDGraphData,
        isEmpty,
        setIsEmpty,
        use3D,
        setUse3D,
        multiSelect,
        setMultiSelect,
        nodeScale,
        setNodeScale,
        selectedNodes,
        setSelectedNodes,
        communityAlgorithm,
        setCommunityAlgorithm,
        graphData,
        setGraphData,
        allGroups,
        setAllGroups,
        undoState,
        setUndoState,
        orgCommunities,
        setOrgCommunities,
        seed,
        setSeed,
        inputs,
        setInputs,
        opacityMode,
        setOpacityMode,
        opacityTransferFunction,
        setOpacityTransferFunction,
      }}
    >
      {children}
    </GraphCommunitiesDataContext.Provider>
  );
};
