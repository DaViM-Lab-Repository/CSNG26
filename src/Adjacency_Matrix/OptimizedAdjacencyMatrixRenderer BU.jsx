import React, { useRef, useEffect, useState, useCallback, useContext, useMemo } from 'react';
import { UniversalDataContext } from '../context/UniversalDataContext';
import { GraphCommunitiesDataContext } from '../context/GraphCommunitiesDataContext';

// Helper function to validate and remap indices
const remapIndices = (selectedNodes, dGraphData) => {
  if (!selectedNodes || selectedNodes.length === 0 || !dGraphData || dGraphData.length === 0) {
    return {
      selectedIndices: new Set(),
      indexMap: new Map(),
      reverseMap: new Map(),
      filteredDGraphData: []
    };
  }

  // Create a set of all selected indices and build mapping
  const selectedIndices = new Set();
  const indexMap = new Map(); // original -> new
  const reverseMap = new Map(); // new -> original
  let newIndex = 0;

  selectedNodes.forEach(node => {
    node.members.forEach(idx => {
      const originalIdx = parseInt(idx);
      selectedIndices.add(originalIdx);
      if (!indexMap.has(originalIdx)) {
        indexMap.set(originalIdx, newIndex);
        reverseMap.set(newIndex, originalIdx);
        newIndex++;
      }
    });
  });

  // Filter and remap the adjacency data
  const filteredDGraphData = Array(selectedIndices.size).fill().map(() => []);
  
  // Iterate through original data and map connections
  dGraphData.forEach((connections, fromIdx) => {
    if (selectedIndices.has(fromIdx)) {
      const newFromIdx = indexMap.get(fromIdx);
      
      connections.forEach(toIdx => {
        if (selectedIndices.has(toIdx)) {
          const newToIdx = indexMap.get(toIdx);
          filteredDGraphData[newFromIdx].push(newToIdx);
        }
      });
    }
  });

  return {
    selectedIndices,
    indexMap,
    reverseMap,
    filteredDGraphData
  };
};

const getStreamLineIndex = (idx, streamLineSize) => {
  return Math.floor(idx / (streamLineSize || 1));
};

export const processAdjacencyMatrix = (selectedNodes, dGraphData) => {
  const {
    selectedIndices,
    indexMap,
    reverseMap,
    filteredDGraphData
  } = remapIndices(selectedNodes, dGraphData);

  const isValid = true;
  
  if (!isValid) {
    console.warn('Invalid adjacency matrix detected after filtering');
    return {
      selectedIndices: new Set(),
      filteredDGraphData: []
    };
  }

  return {
    selectedIndices,
    indexMap,
    reverseMap,
    filteredDGraphData
  };
};

const OptimizedAdjacencyMatrixRenderer = () => {
  // 1. Refs
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const lastKnownSize = useRef({ width: 0, height: 0 });
  const renderQueueRef = useRef({ id: 0, cleanup: null });
  const lastRenderState = useRef(null);

  // 2. Context
  const { segments, streamLines } = useContext(UniversalDataContext);
  const { dGraphData, selectedNodes } = useContext(GraphCommunitiesDataContext);

  // 3. State
  const [viewState, setViewState] = useState({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    isDragging: false,
    lastX: 0,
    lastY: 0
  });

  // Constants
  const BATCH_SIZE = 200;
  const BATCH_DELAY = 20;
  const MIN_CELL_SIZE = 1;
  const RESIZE_THRESHOLD = 0.1;
  const TRANSFORM_THRESHOLD = 0.01;

  // 4. Memoized values
  const filteredData = useMemo(() => {
    return processAdjacencyMatrix(selectedNodes, dGraphData);
  }, [selectedNodes, dGraphData]);

  const dimensions = useMemo(() => ({
    width: filteredData.filteredDGraphData.length || 0,
    height: filteredData.filteredDGraphData.length || 0
  }), [filteredData]);

  // 5. Callbacks
  const isSizeChangeSufficient = useCallback((newWidth, newHeight) => {
    if (lastKnownSize.current.width === 0 || lastKnownSize.current.height === 0) {
      return true;
    }

    const widthDiff = Math.abs(newWidth - lastKnownSize.current.width) / lastKnownSize.current.width;
    const heightDiff = Math.abs(newHeight - lastKnownSize.current.height) / lastKnownSize.current.height;

    return widthDiff > RESIZE_THRESHOLD || heightDiff > RESIZE_THRESHOLD;
  }, []);

  const isRenderNeeded = useCallback(() => {
    if (!lastRenderState.current) return true;
    
    const scaleDiff = Math.abs(viewState.scale - lastRenderState.current.scale);
    const offsetXDiff = Math.abs(viewState.offsetX - lastRenderState.current.offsetX);
    const offsetYDiff = Math.abs(viewState.offsetY - lastRenderState.current.offsetY);

    return (
      scaleDiff > TRANSFORM_THRESHOLD ||
      offsetXDiff > TRANSFORM_THRESHOLD ||
      offsetYDiff > TRANSFORM_THRESHOLD
    );
  }, [viewState]);

  const getVisibleArea = useCallback(() => {
    if (!canvasRef.current) return null;
    
    const canvas = canvasRef.current;
    const startX = Math.max(0, Math.floor(-viewState.offsetX / (viewState.scale * MIN_CELL_SIZE)));
    const startY = Math.max(0, Math.floor(-viewState.offsetY / (viewState.scale * MIN_CELL_SIZE)));
    const endX = Math.min(dimensions.width, Math.ceil(
      (canvas.width - viewState.offsetX) / (viewState.scale * MIN_CELL_SIZE)
    ));
    const endY = Math.min(dimensions.height, Math.ceil(
      (canvas.height - viewState.offsetY) / (viewState.scale * MIN_CELL_SIZE)
    ));

    return { startX, startY, endX, endY };
  }, [viewState, dimensions]);

  const renderBatch = useCallback((ctx, visibleArea, startBatchY, isFirstBatch = false) => {
    const endBatchY = Math.min(startBatchY + BATCH_SIZE, visibleArea.endY);
    
    if (isFirstBatch) {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }

    ctx.save();
    ctx.translate(viewState.offsetX, viewState.offsetY);
    ctx.scale(viewState.scale, viewState.scale);

    // Get streamline size
    const streamLineSize = streamLines?.[0]?.[1] - streamLines?.[0]?.[0] || 1;

    // Render streamline background pattern
    for (let i = startBatchY; i < endBatchY; i++) {
      for (let j = visibleArea.startX; j < visibleArea.endX; j++) {
        // Map matrix indices back to original indices for streamline calculation
        const originalI = filteredData.reverseMap.get(i);
        const originalJ = filteredData.reverseMap.get(j);
        
        if (originalI !== undefined && originalJ !== undefined) {
          const streamLineI = getStreamLineIndex(originalI, streamLineSize);
          const streamLineJ = getStreamLineIndex(originalJ, streamLineSize);
          
          if ((streamLineI + streamLineJ) % 2 === 0) {
            ctx.fillStyle = '#f7f7f7';
          } else {
            ctx.fillStyle = 'white';
          }
          ctx.fillRect(j * MIN_CELL_SIZE, i * MIN_CELL_SIZE, MIN_CELL_SIZE, MIN_CELL_SIZE);
        }
      }
    }

    // Render matrix entries using filtered data
    if (filteredData.filteredDGraphData.length > 0) {
      ctx.fillStyle = 'rgb(0, 122, 255)';
      for (let i = startBatchY; i < endBatchY; i++) {
        if (filteredData.filteredDGraphData[i]) {
          filteredData.filteredDGraphData[i].forEach(j => {
            if (j >= visibleArea.startX && j < visibleArea.endX) {
              ctx.fillRect(j * MIN_CELL_SIZE, i * MIN_CELL_SIZE, MIN_CELL_SIZE, MIN_CELL_SIZE);
            }
          });
        }
      }
    }

    ctx.restore();
  }, [viewState, streamLines, filteredData]);

  const render = useCallback(() => {
    if (!isRenderNeeded()) {
      return;
    }

    lastRenderState.current = {
      scale: viewState.scale,
      offsetX: viewState.offsetX,
      offsetY: viewState.offsetY
    };

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

  // Event handlers
  const handleWheel = useCallback((e) => {
    //e.preventDefault();
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
    const rect = canvasRef.current.getBoundingClientRect();
    setViewState(prev => ({
      ...prev,
      isDragging: true,
      lastX: e.clientX - rect.left,
      lastY: e.clientY - rect.top
    }));
  }, []);

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

  // Effects
  useEffect(() => {
    const resizeObserver = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      
      if (isSizeChangeSufficient(width, height)) {
        const canvas = canvasRef.current;
        if (canvas) {
          canvas.width = width;
          canvas.height = height;
          lastKnownSize.current = { width, height };
          render();
        }
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
  }, [render, isSizeChangeSufficient]);

  useEffect(() => {
    render();
  }, [render, viewState.scale, viewState.offsetX, viewState.offsetY]);

  // If no nodes are selected, render an empty container
  if (filteredData.filteredDGraphData.length === 0) {
    return (
      <div ref={containerRef} style={{ width: '100%', height: '100%', overflow: 'hidden' }} />
    );
  }

  return (
    <div 
      ref={containerRef}
      style={{ 
        width: '100%', 
        height: '100%', 
        overflow: 'hidden'
      }}
    >
      <canvas
        ref={canvasRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
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