import React, { useRef, useState, useEffect, useContext } from "react";
import { ForceGraph2D } from "react-force-graph";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass";
import convexHull from "convex-hull";
import { UniversalDataContext } from "../context/UniversalDataContext";
import { GraphCommunitiesDataContext } from "../context/GraphCommunitiesDataContext";
import GraphCommunitiesButtons from "./GraphCommunitiesButtons";
import {
  Box,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  Typography,
} from "@mui/material";
import HelpIcon from "@mui/icons-material/Help";

const calculateDistance = (segment) => {
  const dx = segment.x2 - segment.x1;
  const dy = segment.y2 - segment.y1;
  const dz = segment.z2 - segment.z1;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
};

const calculateCurvature = (segment) => {
  const dx = segment.x2 - segment.x1;
  const dy = segment.y2 - segment.y1;
  const dz = segment.z2 - segment.z1;
  
  const xyLength = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(Math.abs(dz), xyLength);
  return angle / (Math.PI / 2);
};

const interpolateOpacity = (value, transferFunction) => {
  // Sort transfer function points by target value
  const sortedPoints = [...transferFunction].sort((a, b) => a.target - b.target);
  
  // Find the two points to interpolate between
  let p1 = sortedPoints[0];
  let p2 = sortedPoints[sortedPoints.length - 1];
  
  for (let i = 0; i < sortedPoints.length - 1; i++) {
    if (value >= sortedPoints[i].target && value <= sortedPoints[i + 1].target) {
      p1 = sortedPoints[i];
      p2 = sortedPoints[i + 1];
      break;
    }
  }
  
  // Linear interpolation
  const t = (value - p1.target) / (p2.target - p1.target);
  return p1.alpha + t * (p2.alpha - p1.alpha);
};

const GraphCommunitiesRenderer = () => {
  const {
    dGraphData,
    setDGraphData,
    graphData,
    setGraphData,
    isEmpty,
    setIsEmpty,
    use3D,
    nodeScale,
    communityAlgorithm,
    multiSelect,
    allGroups,
    selectedNodes,
    setSelectedNodes,
    opacityMode,
    opacityTransferFunction,
  } = useContext(GraphCommunitiesDataContext);

  const {
    segments,
    setColoredSegments,
    coloredSegments,
    setSelectedSegments,
    windowWidth,
  } = useContext(UniversalDataContext);
  const windowRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [helpOpen, setHelpOpen] = useState(false);
  const fgRef = useRef();

  useEffect(() => {
    setDGraphData([]);
    setSelectedSegments([]);
    setIsEmpty(true);
    setSelectedNodes([]);
    setGraphData({ nodes: [], links: [] });
    setColoredSegments([]);
  }, [segments]);

  useEffect(() => {
    setSelectedSegments([]);
    setSelectedNodes([]);
    setGraphData({ nodes: [], links: [] });
    setColoredSegments([]);
  }, [dGraphData]);

  useEffect(() => {
    setSelectedSegments([]);
    setSelectedNodes([]);
  }, [graphData, allGroups]);

  useEffect(() => {
    const updateDimensions = () => {
      if (windowRef.current) {
        const { offsetWidth, offsetHeight } = windowRef.current;
        setDimensions({ width: offsetWidth, height: offsetHeight });
      }
    };

    const resizeObserver = new ResizeObserver(updateDimensions);
    if (windowRef.current) resizeObserver.observe(windowRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    if (!isEmpty && fgRef.current) {
      const linkForce = fgRef.current.d3Force("link");
      if (linkForce) {
        linkForce.distance((link) => {
          if (
            link.source.groupID.length > 0 &&
            link.source.groupID[0] == link.target.groupID[0]
          ) {
            return -15;
          }
          return 30;
        });
      }
      
      if (use3D && fgRef.current.postProcessingComposer) {
        const bloomPass = new UnrealBloomPass();
        bloomPass.strength = 1;
        bloomPass.radius = 1;
        bloomPass.threshold = 0;
        fgRef.current.postProcessingComposer().addPass(bloomPass);
      }
    }
  }, [isEmpty, use3D, graphData]);

  const calculateNodeOpacity = (node) => {
    if (opacityMode === "highlight-selected") {
      const baseAlpha = selectedNodes?.length === 0 ? 1 : 0.4;
      return selectedNodes?.some(selectedNode => selectedNode.id === node.id) ? 1 : baseAlpha;
    } else if (opacityMode === "connection-count") {
      const connectionCount = graphData.links.filter(link => 
        link.source.id === node.id || link.target.id === node.id
      ).length;
      
      const maxConnections = Math.max(...graphData.nodes.map(n => 
        graphData.links.filter(link => link.source.id === n.id || link.target.id === n.id).length
      ));
      
      const normalizedValue = connectionCount / maxConnections;
      return opacityMode === "transfer-function" 
        ? interpolateOpacity(normalizedValue, opacityTransferFunction)
        : 0.3 + (0.7 * normalizedValue);
    } else if (opacityMode === "avg-distance") {
      const distances = node.members.map(idx => calculateDistance(segments[idx]));
      const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
      
      const maxAvgDistance = Math.max(...graphData.nodes.map(n => {
        const nodeDistances = n.members.map(idx => calculateDistance(segments[idx]));
        return nodeDistances.reduce((a, b) => a + b, 0) / nodeDistances.length;
      }));
      
      const normalizedValue = avgDistance / maxAvgDistance;
      return opacityMode === "transfer-function" 
        ? interpolateOpacity(normalizedValue, opacityTransferFunction)
        : 0.3 + (0.7 * normalizedValue);
    } else if (opacityMode === "avg-curvature") {
      const curvatures = node.members.map(idx => calculateCurvature(segments[idx]));
      const avgCurvature = curvatures.reduce((a, b) => a + b, 0) / curvatures.length;
      
      const maxAvgCurvature = Math.max(...graphData.nodes.map(n => {
        const nodeCurvatures = n.members.map(idx => calculateCurvature(segments[idx]));
        return nodeCurvatures.reduce((a, b) => a + b, 0) / nodeCurvatures.length;
      }));
      
      const normalizedValue = avgCurvature / maxAvgCurvature;
      return opacityMode === "transfer-function" 
        ? interpolateOpacity(normalizedValue, opacityTransferFunction)
        : 0.3 + (0.7 * normalizedValue);
    } else if (opacityMode === "transfer-function") {
      // Use connection count as the default metric for transfer function
      const connectionCount = graphData.links.filter(link => 
        link.source.id === node.id || link.target.id === node.id
      ).length;
      
      const maxConnections = Math.max(...graphData.nodes.map(n => 
        graphData.links.filter(link => link.source.id === n.id || link.target.id === n.id).length
      ));
      
      const normalizedValue = connectionCount / maxConnections;
      return interpolateOpacity(normalizedValue, opacityTransferFunction);
    }
    return 1;
  };

  useEffect(() => {
    const newColoredSegments = [...segments];
    graphData.nodes.forEach((node) => {
      const opacity = calculateNodeOpacity(node);
      node.members.forEach((idx) => {
        if (newColoredSegments[idx]) {
          const hexColor = node.color;
          const r = parseInt(hexColor.slice(1, 3), 16);
          const g = parseInt(hexColor.slice(3, 5), 16);
          const b = parseInt(hexColor.slice(5, 7), 16);
          newColoredSegments[idx].color = `rgba(${r}, ${g}, ${b}, ${opacity})`;
        }
      });
    });
    setColoredSegments(newColoredSegments);
  }, [graphData, opacityMode, selectedNodes, opacityTransferFunction]);

  const handleNodeClick = (node, event) => {
    if (event.button === 2) {
      event.preventDefault();
      let newColor;
      if (event.ctrlKey) {
        newColor = promptForColor();
      } else {
        newColor = getRandomColor();
      }

      node.color = newColor;

      const updatedSegments = coloredSegments.map((seg) =>
        node.members.includes(seg.globalIdx) ? { ...seg, color: newColor } : seg
      );

      setColoredSegments(updatedSegments);
    } else {
      if (multiSelect) {
        setSelectedNodes((prevSelectedNodes) => {
          const isNodeAlreadySelected = prevSelectedNodes.find(
            (selectedNode) => selectedNode.id === node.id
          );
          let newState = [];
          if (!isNodeAlreadySelected) {
            newState = [...prevSelectedNodes, node];
          } else {
            newState = prevSelectedNodes.filter(
              (selectedNode) => selectedNode.id !== node.id
            );
          }
          let selected = [];
          newState.forEach((node) => {
            node.members.forEach((idx) => {
              selected.push(coloredSegments[parseInt(idx)]);
            });
          });
          setSelectedSegments(selected);
          return newState;
        });
      } else {
        if (selectedNodes[0] == node) {
          setSelectedNodes([]);
          setSelectedSegments([]);
        } else {
          let selected = [];
          node.members.forEach((idx) => {
            let seg = structuredClone(coloredSegments[parseInt(idx)]);
            if (!seg) console.log(`segment idx not found! ${idx}`);
            seg.color = node.color;
            selected.push(seg);
          });
          setSelectedSegments(selected);
          setSelectedNodes([node]);
        }
      }
    }
  };

  const calculateCentroid = (pts) => {
    let firstPoint = pts[0],
      lastPoint = pts[pts.length - 1];
    if (firstPoint[0] !== lastPoint[0] || firstPoint[1] !== lastPoint[1])
      pts.push(firstPoint);
    let twiceArea = 0,
      x = 0,
      y = 0,
      nPts = pts.length,
      p1,
      p2,
      f;

    for (let i = 0, j = nPts - 1; i < nPts; j = i++) {
      p1 = pts[i];
      p2 = pts[j];
      f = p1[0] * p2[1] - p2[0] * p1[1];
      twiceArea += f;
      x += (p1[0] + p2[0]) * f;
      y += (p1[1] + p2[1]) * f;
    }
    f = twiceArea * 3;
    return [x / f, y / f];
  };

  const drawHullOnCanvas = (points, ctx, color, stretchFactor = 1.5) => {
    points = JSON.parse(JSON.stringify(points));
    if (points.length < 3 || !points[0]) return;
    let hullIndices = convexHull(points);

    let hull = hullIndices.map((edge) => {
      return points[edge[0]];
    });

    const centroid = calculateCentroid(hull);

    const expandedHull = hull.map((point) => {
      const vector = [point[0] - centroid[0], point[1] - centroid[1]];
      return [
        centroid[0] + vector[0] * stretchFactor,
        centroid[1] + vector[1] * stretchFactor,
      ];
    });

    hull = expandedHull;
    hull.push(hull[0]);

    ctx.beginPath();
    for (let i = 0; i < hull.length; i++) {
      const startPt = hull[i];
      const endPt = hull[(i + 1) % hull.length];
      const midPt = [(startPt[0] + endPt[0]) / 2, (startPt[1] + endPt[1]) / 2];

      if (i === 0) {
        ctx.moveTo(midPt[0], midPt[1]);
      } else {
        const prevMidPt = [
          (hull[i - 1][0] + startPt[0]) / 2,
          (hull[i - 1][1] + startPt[1]) / 2,
        ];
        ctx.quadraticCurveTo(startPt[0], startPt[1], midPt[0], midPt[1]);
      }
    }

    const lastMidPt = [
      (hull[hull.length - 1][0] + hull[0][0]) / 2,
      (hull[hull.length - 1][1] + hull[0][1]) / 2,
    ];
    ctx.quadraticCurveTo(hull[0][0], hull[0][1], lastMidPt[0], lastMidPt[1]);

    ctx.closePath();

    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = "rgba(0, 0, 0, 0.7)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.fill();

    ctx.setLineDash([]);

    return centroid;
  };

  const handleNodeCanvasObject = (node, ctx, globalScale) => {
    const label = node.id.toString();
    const fontSize = 12 / globalScale;
    let size = Math.log(node.size + 1) / nodeScale;
  
    if (node.groupID.length > 0 && node.x) {
      node.groupID.forEach((groupID) => {
        if (!window.tempt) window.tempt = {};
        if (!window.tempt[groupID]) window.tempt[groupID] = [];
        window.tempt[groupID].push([node.x, node.y]);
  
        if (window.tempt[groupID].length == allGroups[groupID]) {
          const centroid = drawHullOnCanvas(
            window.tempt[groupID],
            ctx,
            node.groupColor
          );
          window.tempt[groupID] = false;
  
          if (centroid) {
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
            ctx.font = `${fontSize}px Sans-Serif`;
            ctx.fillText((groupID - 1).toString(), centroid[0], centroid[1]);
          }
        }
      });
    }
  
    const hexColor = node.color;
    const alpha = calculateNodeOpacity(node);
  
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
  
    var x = node.x;
    var y = node.y;
  
    if (x === undefined || y === undefined || !size) {
      return;
    }
  
    ctx.fillStyle = "rgba(200, 200, 200, 0.7)";
    ctx.beginPath();
    ctx.arc(x + 1, y + 1, size, 0, 2 * Math.PI, false);
    ctx.fill();
  
    var gradient = ctx.createRadialGradient(x, y, 0, x, y, size);
    gradient.addColorStop(0, `rgba(${r * 3}, ${g * 3}, ${b * 3}, ${alpha})`);
    gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, ${alpha})`);
  
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, 2 * Math.PI, false);
    ctx.fill();
  
    let strokeColor = `rgba(1, 1, 1, ${alpha})`;
    if (node.groupColor) {
      strokeColor = node.groupColor;
    }
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 0.4;
    ctx.stroke();
  
    if (size > 5 / globalScale) {
      let fontSize = Math.round(12 / globalScale + size / globalScale);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const isSelected = selectedNodes?.some(selectedNode => selectedNode.id === node.id);
      ctx.fillStyle = isSelected ? "black" : "#808080";
      ctx.font = `${isSelected ? 'bold' : 'normal'} ${fontSize}px Sans-Serif`;
      ctx.fillText(label, x, y);
  }
  };

  const linkVisibility = (link) => communityAlgorithm !== "PCA";

  const getRandomColor = () => {
    const letters = "0123456789ABCDEF";
    let color = "#";
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  };

  return (
    <div
      style={{ position: "relative", width: "100%", height: "100%" }}
      ref={windowRef}
    >
      <Box
        sx={{
          position: "absolute",
          left: 10,
          top: 10,
          zIndex: 1000,
        }}
      >
        <GraphCommunitiesButtons />
      </Box>
      <Box sx={{ position: "absolute", right: 10, top: 10, zIndex: 1000 }}>
        <IconButton
          onClick={() => setHelpOpen(true)}
          size="small"
          color="primary"
        >
          <HelpIcon />
        </IconButton>
      </Box>
      <Dialog open={helpOpen} onClose={() => setHelpOpen(false)}>
        <DialogTitle>Communities Detection</DialogTitle>
        <Box sx={{ p: 3, display: "flex", flexDirection: "column", gap: 3 }}>
          <Typography>
            Left Click: Select a Node or Select An Additional Node with
            Multi-Select Enabled
          </Typography>
          <Typography>Right Click: Change Node Color</Typography>
          <Typography>
            Multi Select: Toggle the Selection of Multiple Nodes to Allow for
            Merging
          </Typography>
          <Typography>
            Undo: Undo to the Previous State of the Graph Communities
          </Typography>
          <Typography>
            Split: Split the Selected Node (Must only have One Node Selected)
          </Typography>
          <Typography>
            Merge: Merge the Selected Nodes (Must only have More than One Node
            Selected)
          </Typography>
        </Box>
      </Dialog>
      <Box
        sx={{
          position: "absolute",
          right: 20,
          bottom: 20,
          zIndex: 1000,
          display: "flex",
          gap: 2,
        }}
      >
        <Button
          variant="contained"
          onClick={() => {
            if (fgRef.current) fgRef.current.zoomToFit(400, 100);
          }}
          disabled={isEmpty}
        >
          Fit Model
        </Button>
      </Box>
      {!use3D && !isEmpty && graphData.nodes.length <= 100 ? (
        <ForceGraph2D
          width={windowWidth}
          height={dimensions.height}
          linkVisibility={linkVisibility}
          graphData={graphData}
          nodeLabel="id"
          ref={fgRef}
          onNodeClick={handleNodeClick}
          onNodeRightClick={handleNodeClick}
          nodeCanvasObject={handleNodeCanvasObject}
          linkDirectionalArrowLength={2.5}
          linkDirectionalArrowRelPos={0.6}
          linkDirectionalArrowColor={"black"}
          linkCurvature={0.25}
          linkOpacity={1}
          linkColor={"black"}
          linkWidth={4}
          d3Force="charge"
          d3ReheatSimulation={true}
          d3ForceConfig={{
            charge: {
              strength: -220,
              distanceMax: 300,
            },
          }}
        />
      ) : !use3D && !isEmpty ? (
        <Box 
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100%',
            width: '100%'
          }}
        >
          <Typography variant="h6">
            Too many communities to visualize (max: 100, current: {graphData.nodes.length}).
            Please adjust parameters to reduce the number of communities.
          </Typography>
        </Box>
      ) : null}
    </div>
  );
};

export default GraphCommunitiesRenderer;
