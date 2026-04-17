import React, { useRef, useEffect, useState, useCallback, useContext } from 'react';
import { UniversalDataContext } from '../context/UniversalDataContext';
import { GraphCommunitiesDataContext } from '../context/GraphCommunitiesDataContext';

// Helper function to get matrix coordinates from screen coordinates
const getMatrixCoordinates = (screenX, screenY, viewState, cellSize) => {
  const matrixX = Math.floor((screenX - viewState.offsetX) / (viewState.scale * cellSize));
  const matrixY = Math.floor((screenY - viewState.offsetY) / (viewState.scale * cellSize));
  return { matrixX, matrixY };
};

// Helper function to get all segments from two streamlines
const getSegmentsBetweenStreamlines = (streamLineI, streamLineJ, segments, streamLines) => {
  if (!streamLines || streamLines.length === 0) return [];
  
  const startI = streamLines[streamLineI]?.[0] ?? 0;
  const endI = streamLines[streamLineI]?.[1] ?? 0;
  const startJ = streamLines[streamLineJ]?.[0] ?? 0;
  const endJ = streamLines[streamLineJ]?.[1] ?? 0;
  
  const selectedSegments = [];
  // Add all segments from first streamline
  for (let i = startI; i < endI; i++) {
    segments[i].color='blue';
    selectedSegments.push(segments[i]);
  }
  // Add all segments from second streamline
  for (let j = startJ; j < endJ; j++) {
    segments[j].color='blue';
    selectedSegments.push(segments[j]);
  }
  console.log(selectedSegments)
  return selectedSegments;
};

const OptimizedAdjacencyMatrixRenderer = () => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const lastKnownSize = useRef({ width: 0, height: 0 });
  const renderQueueRef = useRef({ id: 0, cleanup: null });
  const { segments, streamLines, setSelectedSegments } = useContext(UniversalDataContext);
  const { dGraphData } = useContext(GraphCommunitiesDataContext);
  
  const [viewState, setViewState] = useState({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    isDragging: false,
    lastX: 0,
    lastY: 0
  });

  // Track the last render state to prevent unnecessary renders
  const lastRenderState = useRef({
    scale: viewState.scale,
    offsetX: viewState.offsetX,
    offsetY: viewState.offsetY
  });

  const dimensions = React.useMemo(() => ({
    width: segments.length,
    height: segments.length
  }), [segments.length]);

  const BATCH_SIZE = 200;
  const BATCH_DELAY = 20;
  const BASE_CELL_SIZE = 1;
  const RESIZE_THRESHOLD = 0.1;

  // Calculate cell size based on zoom level
  const getCellSize = useCallback((scale) => {
    // Use a continuous scaling function instead of discrete steps
    // This provides smoother transitions and better high-zoom handling
    return BASE_CELL_SIZE * Math.min(1 + (scale - 1) * 0.3, 3);
  }, []);
  // Add a threshold for pan/zoom changes to prevent minor floating point differences triggering renders
  const TRANSFORM_THRESHOLD = 0.1;

  const isSizeChangeSufficient = useCallback((newWidth, newHeight) => {
    if (lastKnownSize.current.width === 0 || lastKnownSize.current.height === 0) {
      return true;
    }

    const widthDiff = Math.abs(newWidth - lastKnownSize.current.width) / lastKnownSize.current.width;
    const heightDiff = Math.abs(newHeight - lastKnownSize.current.height) / lastKnownSize.current.height;

    return widthDiff > RESIZE_THRESHOLD || heightDiff > RESIZE_THRESHOLD;
  }, [RESIZE_THRESHOLD]);

  // Add function to check if rendering is needed based on transform changes
  const isRenderNeeded = useCallback(() => {
    const scaleDiff = Math.abs(viewState.scale - lastRenderState.current.scale);
    const offsetXDiff = Math.abs(viewState.offsetX - lastRenderState.current.offsetX);
    const offsetYDiff = Math.abs(viewState.offsetY - lastRenderState.current.offsetY);

    return (
      scaleDiff > TRANSFORM_THRESHOLD ||
      offsetXDiff > TRANSFORM_THRESHOLD ||
      offsetYDiff > TRANSFORM_THRESHOLD
    );
  }, [viewState, TRANSFORM_THRESHOLD]);

  const getVisibleArea = useCallback(() => {
    if (!canvasRef.current) return null;
    
    const canvas = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    const cellSize = getCellSize(viewState.scale);
    
    // Use logical (CSS) dimensions for calculations
    const logicalWidth = canvas.width / dpr;
    const logicalHeight = canvas.height / dpr;
    
    const startX = Math.max(0, Math.floor(-viewState.offsetX / (viewState.scale * cellSize)));
    const startY = Math.max(0, Math.floor(-viewState.offsetY / (viewState.scale * cellSize)));
    const endX = Math.min(dimensions.width, Math.ceil(
      (logicalWidth - viewState.offsetX) / (viewState.scale * cellSize)
    ));
    const endY = Math.min(dimensions.height, Math.ceil(
      (logicalHeight - viewState.offsetY) / (viewState.scale * cellSize)
    ));

    return { startX, startY, endX, endY };
  }, [viewState, dimensions]);

  const renderBatch = useCallback((ctx, visibleArea, startBatchY, isFirstBatch = false) => {
    const endBatchY = Math.min(startBatchY + BATCH_SIZE, visibleArea.endY);
    
    if (isFirstBatch) {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }

    // Calculate shared rendering parameters
    const cellSize = getCellSize(viewState.scale);
    const scaledSize = Math.ceil(cellSize * viewState.scale);
    const streamLineSize = streamLines?.[0]?.[1] - streamLines?.[0]?.[0] || 1;
    
    // Helper function to transform coordinates
    const transformCoords = (x, y) => ({
      x: Math.round(x * cellSize * viewState.scale + viewState.offsetX),
      y: Math.round(y * cellSize * viewState.scale + viewState.offsetY)
    });
    
    // Render streamline background pattern with pixel-aligned coordinates
    for (let i = startBatchY; i < endBatchY; i++) {
      for (let j = visibleArea.startX; j < visibleArea.endX; j++) {
        const streamLineI = Math.floor(i / streamLineSize);
        const streamLineJ = Math.floor(j / streamLineSize);
        
        const { x, y } = transformCoords(j, i);
        
        if ((streamLineI + streamLineJ) % 2 === 0) {
          ctx.fillStyle = '#f7f7f7';
        } else {
          ctx.fillStyle = 'white';
        }
        ctx.fillRect(x, y, scaledSize, scaledSize);
      }
    }

    // Render matrix entries in blue with pixel-perfect alignment
    ctx.fillStyle = 'rgb(0, 122, 255)';
    
    // Reuse the same coordinate transformation for matrix entries
    for (let i = startBatchY; i < endBatchY; i++) {
      if (dGraphData[i]) {
        dGraphData[i].forEach(j => {
          if (j >= visibleArea.startX && j < visibleArea.endX) {
            const { x, y } = transformCoords(j, i);
            ctx.fillRect(x, y, scaledSize, scaledSize);
          }
        });
      }
    }
  }, [viewState, streamLines, dGraphData]);

  const render = useCallback(() => {
    // Skip render if transforms haven't changed enough
    if (!isRenderNeeded()) {
      return;
    }

    // Update last render state
    lastRenderState.current = {
      scale: viewState.scale,
      offsetX: viewState.offsetX,
      offsetY: viewState.offsetY
    };

    // Cancel any existing render operation
    if (renderQueueRef.current.cleanup) {
      renderQueueRef.current.cleanup();
      renderQueueRef.current.cleanup = null;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const visibleArea = getVisibleArea();
    if (!visibleArea) return;

    const ctx = canvas.getContext('2d');
    let currentBatchY = visibleArea.startY;
    const timeouts = new Set();
    const currentRenderID = ++renderQueueRef.current.id;

    const cleanup = () => {
      timeouts.forEach(timeout => clearTimeout(timeout));
      timeouts.clear();
    };

    renderQueueRef.current.cleanup = cleanup;

    const renderNextBatch = () => {
      if (currentRenderID !== renderQueueRef.current.id) {
        cleanup();
        return;
      }

      if (currentBatchY < visibleArea.endY) {
        renderBatch(ctx, visibleArea, currentBatchY, currentBatchY === visibleArea.startY);
        currentBatchY += BATCH_SIZE;
        
        const timeout = setTimeout(() => {
          timeouts.delete(timeout);
          requestAnimationFrame(renderNextBatch);
        }, BATCH_DELAY);

        timeouts.add(timeout);
      } else {
        renderQueueRef.current.cleanup = null;
      }
    };

    renderNextBatch();
    
    return cleanup;
  }, [getVisibleArea, renderBatch, isRenderNeeded]);

  // Handle device pixel ratio for crisp rendering
  const setupCanvas = useCallback((width, height) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const ctx = canvas.getContext('2d');
    
    // Set canvas size accounting for device pixel ratio
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    // Scale all drawing operations by the device pixel ratio
    ctx.scale(dpr, dpr);

    lastKnownSize.current = { width, height };
  }, []);

  useEffect(() => {
    const resizeObserver = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      
      if (isSizeChangeSufficient(width, height)) {
        setupCanvas(width, height);
        render();
      }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      if (renderQueueRef.current.cleanup) {
        renderQueueRef.current.cleanup();
      }
    };
  }, [render, isSizeChangeSufficient, setupCanvas]);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const scaleChange = e.deltaY > 0 ? 0.9 : 1.1;
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    setViewState(prev => {
      const newScale = prev.scale * scaleChange;
      const scaleDiff = newScale - prev.scale;
      
      return {
        ...prev,
        scale: newScale,
        offsetX: prev.offsetX - (mouseX * scaleDiff),
        offsetY: prev.offsetY - (mouseY * scaleDiff)
      };
    });
  }, []);

  const handleMouseDown = useCallback((e) => {
    // Handle right click
    if (e.button === 2) {
      e.preventDefault();
      const rect = canvasRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      const cellSize = getCellSize(viewState.scale);
      const { matrixX, matrixY } = getMatrixCoordinates(mouseX, mouseY, viewState, cellSize);
      
      // Get streamline indices
      const streamLineSize = streamLines?.[0]?.[1] - streamLines?.[0]?.[0] || 1;
      const streamLineI = Math.floor(matrixY / streamLineSize);
      const streamLineJ = Math.floor(matrixX / streamLineSize);
      
      // Set selected segments between these streamlines
      const selectedSegments = getSegmentsBetweenStreamlines(streamLineI, streamLineJ, segments, streamLines);
      setSelectedSegments(selectedSegments);
      return;
    }
    
    // Handle regular click (dragging)
    const rect = canvasRef.current.getBoundingClientRect();
    setViewState(prev => ({
      ...prev,
      isDragging: true,
      lastX: e.clientX - rect.left,
      lastY: e.clientY - rect.top
    }));
  }, [viewState.scale, streamLines, segments, setSelectedSegments, getCellSize]);

  const handleMouseMove = useCallback((e) => {
    if (!viewState.isDragging) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    setViewState(prev => ({
      ...prev,
      offsetX: prev.offsetX + (mouseX - prev.lastX),
      offsetY: prev.offsetY + (mouseY - prev.lastY),
      lastX: mouseX,
      lastY: mouseY
    }));
  }, [viewState.isDragging]);

  const handleMouseUp = useCallback(() => {
    setViewState(prev => ({
      ...prev,
      isDragging: false
    }));
  }, []);

  // Only trigger render when transform-related view state changes
  useEffect(() => {
    render();
  }, [render, viewState.scale, viewState.offsetX, viewState.offsetY]);

  return (
    <div 
      ref={containerRef}
      style={{ width: '100%', height: '100%', overflow: 'hidden' }}
    >
      <canvas
        ref={canvasRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onContextMenu={(e) => e.preventDefault()}
      style={{ 
        width: '100%',
        height: '100%',
        cursor: viewState.isDragging ? 'grabbing' : 'grab'
      }}
    />
    </div>
  );
};

export default OptimizedAdjacencyMatrixRenderer;
