import React, { createContext, useState } from "react";
export const UniversalDataContext = createContext();

export const UniversalDataProvider = ({ children }) => {
  const [segments, setSegments] = useState([]);
  const [streamLines, setStreamLines] = useState([]);
  const [coloredSegments, setColoredSegments] = useState([]);
  const [selectedSegments, setSelectedSegments] = useState([]);

  const [selectedSettingsWindow, setSelectedSettingsWindow] = useState("0");
  const [selectedRenderingWindows, setSelectedRenderingWindows] = useState(
    () => ["0"]
  );
  const [windowWidth, setWindowWidth] = useState("0px");

  return (
    <UniversalDataContext.Provider
      value={{
        segments,
        setSegments,
        streamLines,
        setStreamLines,
        coloredSegments,
        setColoredSegments,
        selectedSegments,
        setSelectedSegments,
        selectedSettingsWindow,
        setSelectedSettingsWindow,
        selectedRenderingWindows,
        setSelectedRenderingWindows,
        windowWidth,
        setWindowWidth,
      }}
    >
      {children}
    </UniversalDataContext.Provider>
  );
};
