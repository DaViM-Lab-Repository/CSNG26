import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { UniversalDataProvider } from "./context/UniversalDataContext";
import { LineSegmentsDataProvider } from "./context/LineSegmentsDataContext";
import { GraphCommunitiesDataProvider } from "./context/GraphCommunitiesDataContext";
import { NearestNeighborDataProvider } from "./context/NearestNeighborDataContext";
import { AdjacencyMatrixDataProvider } from "./context/AdjacencyMatrixDataContext";

const container = document.getElementById("root");
const root = createRoot(container);

root.render(
  <UniversalDataProvider>
    <LineSegmentsDataProvider>
      <GraphCommunitiesDataProvider>
        <NearestNeighborDataProvider>
          <AdjacencyMatrixDataProvider>
            <App />
          </AdjacencyMatrixDataProvider>
        </NearestNeighborDataProvider>
      </GraphCommunitiesDataProvider>
    </LineSegmentsDataProvider>
  </UniversalDataProvider>
);
