import React, { useState, useContext, useEffect, useRef } from "react";
import "rc-dock/dist/rc-dock.css";
import "./styles/App.css";
import "allotment/dist/style.css";

import {
  Box,
  AppBar,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  Divider,
} from "@mui/material";
import { createTheme, ThemeProvider } from "@mui/material/styles";

import Settings from "./Settings";
import LineSegmentsRenderer from "./Line_Segments/LineSegmentsRenderer";
import GraphCommunitiesRenderer from "./Graph_Community/GraphCommunitiesRenderer";
import OptimizedAdjacencyMatrixRenderer from "./Adjacency_Matrix/OptimizedAdjacencyMatrixRenderer";
import { UniversalDataContext } from "./context/UniversalDataContext";
import { GraphCommunitiesDataContext } from "./context/GraphCommunitiesDataContext";
import { LLMProvider } from "./context/LLMContext";
import ChatBox from "./components/ChatBox";

const universalTheme = createTheme({
  components: {
    MuiTooltip: {
      defaultProps: {
        followCursor: true,
        enterDelay: 500,
      },
    },
    MuiIconButton: {
      defaultProps: {
        color: "primary",
      },
    },
  },
});

const App = () => {
  const {
    segments,
    selectedRenderingWindows,
    setSelectedRenderingWindows,
    windowWidth,
    setWindowWidth,
  } = useContext(UniversalDataContext);
  const { graphData } = useContext(GraphCommunitiesDataContext);
  const windowContainer = useRef();

  // Handle automatic window selection based on data availability
  useEffect(() => {
    let newWindows = [...selectedRenderingWindows];
    
    // Add Line Segments window if segments data is available
    if (segments?.length > 0 && !newWindows.includes("1")) {
      newWindows.push("1");
    }
    
    // Add Graph Communities window if graph data is available
    if (graphData?.nodes?.length > 0 && !newWindows.includes("3")) {
      newWindows.push("3");
    }
    
    // Add Adjacency Matrix window if segments data is available
    // (since matrix is derived from segments)
    if (segments?.length > 0 && !newWindows.includes("2")) {
      newWindows.push("2");
    }

    if (newWindows.length !== selectedRenderingWindows.length) {
      setSelectedRenderingWindows(newWindows);
    }
  }, [segments, graphData, selectedRenderingWindows]);

  // Handle window resizing
  useEffect(() => {
    const handleResize = (entries) => {
      for (let entry of entries) {
        const activeWindows = selectedRenderingWindows.length || 1;
        setWindowWidth(entry.contentRect.width / activeWindows);
      }
    };

    const observer = new ResizeObserver(handleResize);

    if (windowContainer.current) {
      observer.observe(windowContainer.current);
    }

    return () => observer.disconnect();
  }, [selectedRenderingWindows, setWindowWidth]);

  // Update window width when selected windows change
  useEffect(() => {
    if (windowContainer.current) {
      const activeWindows = selectedRenderingWindows.length || 1;
      setWindowWidth(windowContainer.current.clientWidth / activeWindows);
    }
  }, [selectedRenderingWindows]);

  const renderWindow = (id, component) => (
    <Box
      sx={{
        width: `${windowWidth}px`,
        height: "100%",
        ...(selectedRenderingWindows.indexOf(id) === -1 && {
          display: "none",
        }),
        overflow: "hidden",
      }}
    >
      {component}
    </Box>
  );

  return (
    <div
      className="App"
      style={{
        display: "flex",
        height: "100vh",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <ThemeProvider theme={universalTheme}>
        <LLMProvider>
          <AppBar
            sx={{
              position: "static",
              height: "75px",
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              paddingLeft: "20px",
              gap: "20px",
            }}
          >
            <Typography variant="h6" noWrap>
              Curve Segment Neighborhood-Based Vector Field Exploration
            </Typography>
            <ToggleButtonGroup
              value={selectedRenderingWindows}
              onChange={(e, newValue) => {
                if (newValue?.length > 0) {  // Prevent deselecting all windows
                  setSelectedRenderingWindows(newValue);
                }
              }}
            >
              <ToggleButton value="0">Settings</ToggleButton>
              <ToggleButton value="1">Line Segments</ToggleButton>
              <ToggleButton value="2">Community Detection</ToggleButton>
              <ToggleButton value="3">Adjacency Matrix</ToggleButton>
            </ToggleButtonGroup>
          </AppBar>

          <Box
            ref={windowContainer}
            sx={{
              width: "100%",
              flexGrow: 1,
              display: "flex",
              border: "1px solid black",
            }}
          >
            <Box sx={{ height: "100%", flexGrow: 1, display: "flex" }}>
              {renderWindow("0", <Settings />)}
              <Divider orientation="vertical" />
              {renderWindow("1", <LineSegmentsRenderer />)}
              <Divider orientation="vertical" />
              {renderWindow("2", <GraphCommunitiesRenderer />)}
              <Divider orientation="vertical" />
              {renderWindow("3", <OptimizedAdjacencyMatrixRenderer />)}
            </Box>
          </Box>
          <ChatBox />
        </LLMProvider>
      </ThemeProvider>
    </div>
  );
};

export default App;
