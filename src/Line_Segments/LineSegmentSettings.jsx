import React, { useContext } from "react";
import { Box, Button, IconButton, Typography, Tooltip } from "@mui/material";
import AddIcon from '@mui/icons-material/Add';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import {
  CustomNumberInput,
  CustomCheckBox,
  CustomSelect,
  CustomColorInput,
} from "../components/CustomComponents";
import { LineSegmentsDataContext } from "../context/LineSegmentsDataContext";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";

const LineSegmentSettings = React.memo(() => {
  const {
    renderingMethod,
    setRenderingMethod,
    radius,
    setRadius,
    lineWidth,
    setLineWidth,
    tubeRes,
    setTubeRes,
    autoUpdate,
    setAutoUpdate,
    intensity,
    setIntensity,
    opacity,
    setOpacity,
    showCaps,
    setShowCaps,
    cylinderHeight,
    setCylinderHeight,
    color,
    setColor,
    renderLinesWhenMoving,
    setRenderLinesWhenMoving,
    // visualizationAttribute, // REMOVED
    // setVisualizationAttribute, // REMOVED
    opacityConfigs,
    setOpacityConfigs,
    opacityLogic,
    setOpacityLogic,
    forceDeselectedColor,
    setForceDeselectedColor,
    axisScale,
    setAxisScale,
  } = useContext(LineSegmentsDataContext);

  const addOpacityConfig = () => {
    setOpacityConfigs((prevConfigs) => [
      ...prevConfigs,
      { id: `config-${Date.now()}`, visAttribute: "saliency", min: 0, max: 10, inverted: false }, // ADDED visAttribute
    ]);
  };

  const updateOpacityConfig = (id, field, value) => {
    setOpacityConfigs((prevConfigs) =>
      prevConfigs.map((config) =>
        config.id === id ? { ...config, [field]: value } : config
      )
    );
  };

  const removeOpacityConfig = (id) => {
    setOpacityConfigs((prevConfigs) =>
      prevConfigs.filter((config) => config.id !== id)
    );
  };

  return (
    <Box sx={{ p: 3, display: "flex", flexDirection: "column", gap: 2, overflowY: "auto", maxHeight: "calc(100vh - 160px)" }}> {/* Adjusted 160px for typical header/padding */}
      <CustomSelect
        label="Rendering Method"
        value={renderingMethod}
        onChange={setRenderingMethod}
        options={[
          { value: "Tube", label: "Tube" },
          { value: "Cylinder", label: "Cylinder" },
          { value: "Line", label: "Line" },
        ]}
        tooltip="Controls the rendering method of the segments (Cylinder is typically faster)"
      />
      <CustomNumberInput
        label="Intensity"
        value={intensity}
        onChange={setIntensity}
        tooltip="Controls the light intensity in the scene"
      />
      <CustomNumberInput
        label="Axis Scale"
        value={axisScale}
        onChange={setAxisScale}
        min={0}
        max={10}
        step={0.1}
        tooltip="Controls the scale of the axis helper. Set to 0 to disable axis helper."
      />
      {renderingMethod === "Line" && (
        <CustomNumberInput
          label="Line Width"
          value={lineWidth}
          onChange={setLineWidth}
          min={0.1}
          max={20}
          step={0.1}
          tooltip="Controls the width of the line segments when using Line rendering method"
        />
      )}
      {renderingMethod !== "Line" && (
        <CustomNumberInput
          label="Tube Radius"
          value={radius}
          onChange={setRadius}
          step={0.05}
          tooltip="Controls the radius of the segments (likely need to modify depending on your model)"
        />
      )}
      {renderingMethod !== "Line" && (
        <CustomNumberInput
          label="Tube Resolution"
          value={tubeRes}
          onChange={setTubeRes}
          tooltip="Controls the resolution of the segments"
        />
      )}
      <CustomNumberInput
        label="Opacity"
        value={opacity}
        onChange={setOpacity}
        step={0.05}
        tooltip="Controls the opacity of the segments"
      />

      <CustomCheckBox
        label="Force Default Color for Deselected"
        checked={forceDeselectedColor}
        onChange={setForceDeselectedColor}
        tooltip="If checked, segments not meeting opacity criteria or not selected will use the default color instead of their community color."
      />

      {/* Opacity Configurations */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #ccc', p: 1, borderRadius: '4px' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: "bold" }}>
          Conditional Opacity by Attribute
        </Typography>
        <Tooltip title="Add Opacity Threshold Range">
          <IconButton onClick={addOpacityConfig} color="primary">
            <AddIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {opacityConfigs && opacityConfigs.length > 0 && (
        <CustomSelect
          label="Combine Thresholds Using"
          value={opacityLogic}
          onChange={setOpacityLogic}
          options={[
            { value: "AND", label: "AND (All conditions must be met)" },
            { value: "OR", label: "OR (Any condition can be met)" },
          ]}
          tooltip="Determines how multiple threshold ranges are combined"
        />
      )}

      {opacityConfigs.map((config, index) => (
        <Box key={config.id} sx={{ border: '1px solid #eee', p: 2, borderRadius: '4px', display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: "bold" }}>
              Threshold Range {index + 1}
            </Typography>
            <Tooltip title={`Remove Range ${index + 1}`}>
              <IconButton
                onClick={() => removeOpacityConfig(config.id)}
                color="error"
                size="small"
              >
                <RemoveCircleOutlineIcon />
              </IconButton>
            </Tooltip>
          </Box>
          <CustomSelect
            label={`Attribute`}
            value={config.visAttribute}
            onChange={(value) => updateOpacityConfig(config.id, "visAttribute", value)}
            options={[
              { value: "saliency", label: "Saliency" },
              { value: "averageDistance", label: "Average Distance" },
              { value: "communitySize", label: "Community Size" },
              { value: "communityConnections", label: "Community Connections" },
              // Add more attributes here in the future
            ]}
            tooltip="Selects the attribute for this specific threshold range"
          />
          <CustomNumberInput
            label={`Min (%)`}
            value={config.min}
            onChange={(value) => updateOpacityConfig(config.id, "min", value)}
            min={0}
            max={100}
            step={1}
            tooltip="Minimum percentage for this threshold range"
          />
          <CustomNumberInput
            label={`Max (%)`}
            value={config.max}
            onChange={(value) => updateOpacityConfig(config.id, "max", value)}
            min={0}
            max={100}
            step={1}
            tooltip="Maximum percentage for this threshold range"
          />
          <CustomCheckBox
            label={`Invert Range`}
            checked={config.inverted}
            onChange={(value) => updateOpacityConfig(config.id, "inverted", value)}
            tooltip="Invert the logic for this range (segments outside this range will be shown, segments inside will be semi-transparent)"
          />
        </Box>
      ))}
      {/* End Opacity Configurations */}

      <CustomColorInput
        label="Color"
        value={color}
        onChange={setColor}
        tooltip="Controls the color of the segments"
      />
      {renderingMethod === "Cylinder" && (
        <CustomNumberInput
          label="Cylinder Height"
          value={cylinderHeight}
          onChange={setCylinderHeight}
          step={0.05}
          tooltip="Controls the height of each cylinder (likely need to modify depending on your model)"
        />
      )}
      {renderingMethod !== "Line" && (
        <CustomCheckBox
          label="Show Caps"
          checked={showCaps}
          onChange={setShowCaps}
          tooltip="Hide or show the caps of each segment"
        />
      )}
      <CustomCheckBox
        label="Auto Update"
        checked={autoUpdate}
        onChange={setAutoUpdate}
        tooltip="If on, the segments automatically render when the settings change"
      />
      {renderingMethod !== "Line" && (
        <CustomCheckBox
          label="Render Lines when Moving"
          checked={renderLinesWhenMoving}
          onChange={setRenderLinesWhenMoving}
          tooltip="If on, lines will render when the camera is moving"
        />
      )}
      <Button
        component="label"
        variant="contained"
        tabIndex={-1}
        startIcon={<PlayArrowIcon />}
        fullWidth
        sx={{ flexGrow: 1 }}
        onClick={() => window.dispatchEvent(new Event("render"))}
      >
        Render
      </Button>
    </Box>
  );
});

export default LineSegmentSettings;
