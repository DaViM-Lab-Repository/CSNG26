import React, { createContext, useState } from "react";
export const LineSegmentsDataContext = createContext();

export const LineSegmentsDataProvider = ({ children }) => {
  const [renderingMethod, setRenderingMethod] = useState("Line");
  const [radius, setRadius] = useState(0.45);
  const [lineWidth, setLineWidth] = useState(2);
  const [tubeRes, setTubeRes] = useState(20);
  const [showCaps, setShowCaps] = useState(true);
  const [opacity, setOpacity] = useState(1);
  const [cylinderHeight, setCylinderHeight] = useState(1.0);
  const [autoUpdate, setAutoUpdate] = useState(true);
  const [intensity, setIntensity] = useState(2);
  const [color, setColor] = useState("#ffff00");
  const [renderLinesWhenMoving, setRenderLinesWhenMoving] = useState(true);
  const [segmentSaliencyData, setSegmentSaliencyData] = useState([]); // To store { globalIdx, saliency }
  const [opacityConfigs, setOpacityConfigs] = useState([]); // Array of { id: string, visAttribute: string, min: number, max: number, inverted: boolean }
  const [opacityLogic, setOpacityLogic] = useState("AND"); // "AND" or "OR"
  const [forceDeselectedColor, setForceDeselectedColor] = useState(false); // New state for forcing deselected color

  const [segmentAverageDistanceData, setSegmentAverageDistanceData] = useState([]); // To store { globalIdx, averageDistance }
  const [segmentCommunitySizeData, setSegmentCommunitySizeData] = useState([]); // To store { globalIdx, communitySize }
  const [segmentCommunityConnectionData, setSegmentCommunityConnectionData] = useState([]); // To store { globalIdx, communityConnections }
  const [axisScale, setAxisScale] = useState(0); // Axis helper scale, 0 means disabled

  return (
    <LineSegmentsDataContext.Provider
      value={{
        renderingMethod,
        setRenderingMethod,
        radius,
        setRadius,
        lineWidth,
        setLineWidth,
        tubeRes,
        setTubeRes,
        showCaps,
        setShowCaps,
        opacity,
        setOpacity,
        cylinderHeight,
        setCylinderHeight,
        autoUpdate,
        setAutoUpdate,
        intensity,
        setIntensity,
        color,
        setColor,
        renderLinesWhenMoving,
        setRenderLinesWhenMoving,
        segmentSaliencyData,
        setSegmentSaliencyData,
        opacityConfigs,
        setOpacityConfigs,
        opacityLogic,
        setOpacityLogic,
        forceDeselectedColor,
        setForceDeselectedColor,
        segmentAverageDistanceData,
        setSegmentAverageDistanceData,
        segmentCommunitySizeData,
        setSegmentCommunitySizeData,
        segmentCommunityConnectionData,
        setSegmentCommunityConnectionData,
        axisScale,
        setAxisScale,
      }}
    >
      {children}
    </LineSegmentsDataContext.Provider>
  );
};
