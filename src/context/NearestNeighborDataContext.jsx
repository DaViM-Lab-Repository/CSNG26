import React, { createContext, useState } from "react";
export const NearestNeighborDataContext = createContext();

export const NearestNeighborDataProvider = ({ children }) => {
  const [treeAlgorithm, setTreeAlgorithm] = useState("KNN");
  const [k, setK] = useState(25);
  const [r, setR] = useState(0.5);
  const [distanceMetric, setDistanceMetric] = useState("shortest");
  const [exclude, setExclude] = useState(false);
  const [progress, setProgress] = useState(0);
  const [doSort, setDoSort] = useState(false);
  const [sortType, setSortType] = useState(1);

  return (
    <NearestNeighborDataContext.Provider
      value={{
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
      }}
    >
      {children}
    </NearestNeighborDataContext.Provider>
  );
};
