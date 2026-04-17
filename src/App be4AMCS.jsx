import React, { useState, useContext, useEffect, useRef } from "react";
import "rc-dock/dist/rc-dock.css";

import "./styles/App.css";
import "allotment/dist/style.css";

import {
  Box,
  Button,
  Divider,
  Drawer,
  Typography,
  Tab,
  Tabs,
  AppBar,
  IconButton,
  Tooltip,
  styled,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import SettingsIcon from "@mui/icons-material/Settings";

import Settings from "./Settings";

import LineSegmentsRenderer from "./Line_Segments/LineSegmentsRenderer";
import GraphCommunitiesRenderer from "./Graph_Community/GraphCommunitiesRenderer";
import AdjacencyMatrixRenderer from "./Adjacency_Matrix/AdjacencyMatrixRenderer";
import { UniversalDataContext } from "./context/UniversalDataContext";
import { AdjacencyMatrixDataContext } from "./context/AdjacencyMatrixDataContext";
import { GraphCommunitiesDataContext } from "./context/GraphCommunitiesDataContext";
import { alignProperty } from "@mui/material/styles/cssUtils";

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
  const { image } = useContext(AdjacencyMatrixDataContext);
  const windowContainer = useRef();

  useEffect(() => {
    if (
      segments &&
      segments.length > 0 &&
      selectedRenderingWindows.indexOf("1") === -1
    ) {
      setSelectedRenderingWindows([...selectedRenderingWindows, "1"]);
    }
  }, [segments]);

  useEffect(() => {
    if (
      image &&
      image.length > 1 &&
      selectedRenderingWindows.indexOf("2") === -1
    ) {
      setSelectedRenderingWindows([...selectedRenderingWindows, "2"]);
    }
  }, [image]);

  useEffect(() => {
    if (
      graphData.nodes &&
      graphData.nodes.length > 0 &&
      selectedRenderingWindows.indexOf("3") === -1
    ) {
      setSelectedRenderingWindows([...selectedRenderingWindows, "3"]);
    }
  }, [graphData]);

  useEffect(() => {
    const handleResize = (entries) => {
      for (let entry of entries) {
        setWindowWidth(
          entry.contentRect.width / selectedRenderingWindows.length
        );
      }
    };

    const observer = new ResizeObserver(handleResize);

    if (windowContainer.current) {
      observer.observe(windowContainer.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [selectedRenderingWindows, setWindowWidth]);

  useEffect(() => {
    setWindowWidth(
      windowContainer.current.clientWidth / selectedRenderingWindows.length
    );
  }, [selectedRenderingWindows]);

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
              setSelectedRenderingWindows(newValue);
            }}
          >
            <ToggleButton value="0">Settings</ToggleButton>
            <ToggleButton value="1">Line Segments</ToggleButton>
            <ToggleButton value="3">Community Detection</ToggleButton>
            <ToggleButton value="2">Adjacency Matrix</ToggleButton>
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
            <Box
              sx={{
                width: `${windowWidth}px`,
                height: "100%",
                ...(selectedRenderingWindows.indexOf("0") === -1 && {
                  display: "none",
                }),
                overflow: "hidden",
              }}
            >
              <Settings />
            </Box>
            <Divider orientation="vertical" />
            <Box
              sx={{
                width: `${windowWidth}px`,
                height: "100%",
                ...(selectedRenderingWindows.indexOf("1") === -1 && {
                  display: "none",
                }),
                overflow: "hidden",
              }}
            >
              <LineSegmentsRenderer />
            </Box>
            <Divider orientation="vertical" />

            <Box
              sx={{
                width: `${windowWidth}px`,
                height: "100%",
                ...(selectedRenderingWindows.indexOf("3") === -1 && {
                  display: "none",
                }),
                overflow: "hidden",
              }}
            >
              <GraphCommunitiesRenderer />
            </Box>
            <Divider orientation="vertical" />
            <Box
              sx={{
                width: `${windowWidth}px`,
                height: "100%",
                ...(selectedRenderingWindows.indexOf("2") === -1 && {
                  display: "none",
                }),
                overflow: "hidden",
              }}
            >
              <AdjacencyMatrixRenderer />
            </Box>
          </Box>
        </Box>
      </ThemeProvider>
    </div>
  );
};

export default App;
