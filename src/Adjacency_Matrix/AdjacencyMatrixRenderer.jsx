import React, {
  useState,
  useRef,
  useEffect,
  useContext,
  useCallback,
} from "react";
import { Stage, Layer, Rect, Image } from "react-konva";
import Konva from "konva";
// import { lineSegmentDistance } from "../Nearest_Neighbor/knnHelper"; // Not used
import { UniversalDataContext } from "../context/UniversalDataContext";
import { GraphCommunitiesDataContext } from "../context/GraphCommunitiesDataContext";
import { AdjacencyMatrixDataContext } from "../context/AdjacencyMatrixDataContext";

const AdjacencyMatrixRenderer = () => {
  const [dimensions, setDimensions] = useState({
    width: 0,
    height: 0,
  });
  const layerRef = useRef();
  const divRef = useRef();
  const { segments, streamLines } = useContext(UniversalDataContext);
  // Add graphData to context destructuring
  const { dGraphData, graphData } = useContext(GraphCommunitiesDataContext); 
  const { grid, setGrid, image, setImage, createWhiteImage, snap } = useContext(
    AdjacencyMatrixDataContext
  );

  const Base64Image = ({ base64URL, ...props }) => {
    const [image, setImage] = useState(null);

    useEffect(() => {
      const img = new window.Image();
      img.src = base64URL;
      img.onload = () => {
        setImage(img);
      };
    }, [base64URL]);

    return <Image imageSmoothingEnabled={false} image={image} {...props} />;
  };

  useEffect(() => {
    const resizeObserver = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
    });

    if (divRef.current) {
      resizeObserver.observe(divRef.current);
    }

    return () => {
      if (divRef.current) {
        resizeObserver.unobserve(divRef.current);
      }
    };
  }, []);

  // Moved fillBlackPixels definition here to use graphData from closure
  const fillBlackPixels = useCallback((canvases, pixelList, tileSize) => {
    const segmentToCommunityColorMap = {};
    if (graphData && graphData.nodes) {
      graphData.nodes.forEach(communityNode => {
        if (communityNode.members && communityNode.color) {
          communityNode.members.forEach(segmentGlobalIdx => {
            segmentToCommunityColorMap[segmentGlobalIdx] = communityNode.color;
          });
        }
      });
    }

    const defaultInteractionColor = "rgb(200, 200, 200)"; // A bit lighter than pure black for default

    pixelList.forEach((pixel) => {
      const x = pixel[0]; // source segment index
      const y = pixel[1]; // target segment index
      let cellColorValue = pixel[2]; 

      let finalColor;

      if (cellColorValue === 1) { // Adjacency exists
        const sourceCommunityColor = segmentToCommunityColorMap[x];
        if (sourceCommunityColor) {
          finalColor = sourceCommunityColor;
        } else {
          finalColor = defaultInteractionColor; 
        }
      } else if (cellColorValue === 0) { 
        finalColor = "red"; // Placeholder for other types of interactions if any
      } else { 
        finalColor = "blue"; // Placeholder
      }

      const row = Math.floor(y / tileSize); 
      const col = Math.floor(x / tileSize); 
      
      if (canvases[row] && canvases[row][col]) {
        const canvas = canvases[row][col];
        const context = canvas.getContext("2d");
        context.fillStyle = finalColor;
        context.fillRect(x % tileSize, y % tileSize, 1, 1);
      }
    });
  }, [graphData]);


  const setPixelsLocal = useCallback((currentDGraphData) => {
    if (!segments || segments.length === 0 || !currentDGraphData || currentDGraphData.length === 0) {
      //setImage([]); // Consider clearing image if appropriate
      return;
    }
    const tileSize = 1000;
    const numSegments = segments.length; // Use a consistent variable for segment length
    const cols = Math.ceil(numSegments / tileSize);
    const rows = Math.ceil(numSegments / tileSize); // Assuming square matrix for segments
    const newPixels = [];
    const canvasTiles = createWhiteImage(numSegments, numSegments, tileSize);

    if (streamLines && streamLines.length > 0) {
      for (let i = 0; i < streamLines.length; i++) {
        for (let j = 0; j < streamLines.length; j++) {
          let sl1 = streamLines[i];
          let sl2 = streamLines[j];
          if ((i + j) % 2 === 0) {
            drawRectangle(
              canvasTiles,
              sl1[0], sl2[0],
              sl1[1] - sl1[0], sl2[1] - sl2[0],
              "#f7f7f7", tileSize
            );
          } else {
            drawRectangle(
              canvasTiles,
              sl1[0], sl2[0],
              sl1[1] - sl1[0], sl2[1] - sl2[0],
              "white", tileSize
            );
          }
        }
      }
    }

    for (let i = 0; i < numSegments; i++) {
      if (currentDGraphData[i]) {
        currentDGraphData[i].forEach((idx) => {
          newPixels.push([i, idx, 1]); // Mark as type 1 for standard adjacency
        });
      }
    }

    fillBlackPixels(canvasTiles, newPixels, tileSize);

    const finalImageTiles = [];
    for (let i = 0; i < rows; i++) {
      finalImageTiles[i] = [];
      for (let j = 0; j < cols; j++) {
        if (canvasTiles[i] && canvasTiles[i][j]) {
          const cv = canvasTiles[i][j];
          const imageX = j * tileSize;
          const imageY = i * tileSize;
          finalImageTiles[i][j] = {
            width: tileSize,
            height: tileSize,
            x: imageX,
            y: imageY,
            url: cv.toDataURL(),
          };
          cv.width = 0; 
          cv.height = 0;
        } else {
          // Handle cases where a tile might not exist, though createWhiteImage should initialize them
           finalImageTiles[i][j] = null; 
        }
      }
    }
    setImage(finalImageTiles);
  }, [segments, streamLines, createWhiteImage, setImage, graphData, fillBlackPixels]);


  useEffect(() => {
    const handleSetPixelsEvent = () => {
      if (dGraphData && dGraphData.length > 0 && segments && segments.length > 0) {
        setPixelsLocal(dGraphData);
      }
    };
    window.addEventListener("setPixels", handleSetPixelsEvent);
    return () => window.removeEventListener("setPixels", handleSetPixelsEvent);
  }, [dGraphData, segments, setPixelsLocal]);

  // Effect to re-render if graphData (e.g., colors) changes, assuming dGraphData is present
  useEffect(() => {
    if (dGraphData && dGraphData.length > 0 && segments && segments.length > 0) {
      console.log("AdjacencyMatrixRenderer: graphData or other critical data changed, re-rendering pixels.");
      setPixelsLocal(dGraphData);
    }
  }, [graphData, dGraphData, segments, setPixelsLocal]);


  useEffect(() => {
    updateView();
  }, [image, dimensions]); // Added dimensions as updateView uses it.

  // renderCanvasGrid is called by updateView, which is in a useEffect dependent on `image`.
  // It does not need to be a useCallback unless it itself is a dependency of another hook.
  function renderCanvasGrid(canvases, tileSize, visibleArea) {
    const images = [];
    let ex = 0;
    let lasturl = "";
    for (let i = 0; i < canvases.length; i++) {
      for (let j = 0; j < canvases[i].length; j++) {
        const canvas = canvases[i][j];
        if (!canvas || canvas.width == 0 || canvas.height == 0) continue;
        let pass = true;

        if (visibleArea) {
          // Calculate the image position
          const imageX = j * tileSize;
          const imageY = i * tileSize;

          // Check if the image is within the visible area
          pass =
            imageX + canvas.width >= visibleArea.x &&
            imageX <= visibleArea.x + visibleArea.width &&
            imageY + canvas.height >= visibleArea.y &&
            imageY <= visibleArea.y + visibleArea.height;
        }
        if (!pass) {
          ex++;
          continue;
        }
        //console.log(canvas);
        //if (canvas.url == lasturl)
        //  console.log("same");
        lasturl = canvas.url;
        //console.log(`${i}-${j}`)
        images.push(
          <Base64Image
            key={`${i}-${j}`}
            base64URL={canvas.url}
            x={j * tileSize}
            y={i * tileSize}
            onload={handleLoad}
          />
        );
      }
    }
    console.log("excluded: ", ex);
    //console.log(canvases,images.length,images)
    //return images;
    setGrid(images);
  }

  const handleLoad = (image) => {
    // Disable image smoothing
    console.log("called");
    image.imageSmoothingEnabled(false);
  };

  function drawRectangle(canvases, x, y, width, height, color, tileSize) {
    const startX = Math.floor(x / tileSize);
    const startY = Math.floor(y / tileSize);
    const endX = Math.floor((x + width - 1) / tileSize);
    const endY = Math.floor((y + height - 1) / tileSize);

    for (let i = startY; i <= endY; i++) {
      for (let j = startX; j <= endX; j++) {
        if (!canvases[i]) continue;
        const canvas = canvases[i][j];
        if (!canvas) continue;
        const ctx = canvas.getContext("2d");

        const localX = j === startX ? x % tileSize : 0;
        const localY = i === startY ? y % tileSize : 0;
        const localWidth =
          j === endX ? (x + width) % tileSize || tileSize : tileSize - localX;
        const localHeight =
          i === endY ? (y + height) % tileSize || tileSize : tileSize - localY;

        ctx.fillStyle = color;
        ctx.fillRect(localX, localY, localWidth, localHeight);
      }
    }
  }

  const updateView = () => {
    let visibleArea = false;
    const layer = layerRef.current;
    if (layer)
      visibleArea = {
        x: -layer.x() / layer.scaleX(),
        y: -layer.y() / layer.scaleY(),
        width: dimensions.width / layer.scaleX(),
        height: dimensions.height / layer.scaleY(),
      };
    renderCanvasGrid(image, 1000, visibleArea);
  };

  const handleWheel = (e) => {
    const SCALE_BY = 1.05;
    e.evt.preventDefault();

    const layer = layerRef.current;
    const oldScale = layer.scaleX();

    const pointer = layer.getStage().getPointerPosition();

    const mousePointTo = {
      x: (pointer.x - layer.x()) / oldScale,
      y: (pointer.y - layer.y()) / oldScale,
    };

    const newScale =
      e.evt.deltaY > 0 ? oldScale / SCALE_BY : oldScale * SCALE_BY;

    layer.scale({ x: newScale, y: newScale });

    const newPosition = {
      x: -(mousePointTo.x * newScale - pointer.x),
      y: -(mousePointTo.y * newScale - pointer.y),
    };

    layer.position(newPosition);
    layer.batchDraw();
  };

  const MemoizedRect = React.memo(({ selection }) => (
    <Rect
      x={selection.x}
      y={selection.y}
      width={selection.width}
      height={selection.height}
      fill="rgba(0, 0, 255, 0.5)"
      listening={false}
    />
  ));

  return (
    <div ref={divRef} style={{ width: "100%", height: "100%" }}>
      <Stage
        style={{
          backgroundColor: "white",
        }}
        width={dimensions.width}
        height={dimensions.height}
        imageSmoothingEnabled={false}
      >
        <Layer
          ref={layerRef}
          onWheel={handleWheel}
          // onMouseDown={handleMouseDown}
          // onMouseMove={handleMouseMove}
          // onMouseUp={handleMouseUp}
          imageSmoothingEnabled={false}
        >
          {grid}
          {/* <MemoizedRect selection2={selection2} /> */}
        </Layer>
      </Stage>
    </div>
  );
};

export default AdjacencyMatrixRenderer;
