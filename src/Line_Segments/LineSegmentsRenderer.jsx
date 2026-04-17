import React, {
  useCallback,
  useRef,
  useEffect,
  useState,
  useContext,
  useMemo,
} from "react";
import { extend, useThree, useFrame } from "@react-three/fiber";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2";
import { Line2 } from "three/examples/jsm/lines/Line2";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry";
extend({ LineSegments2, Line2, LineMaterial, LineGeometry });
import * as THREE from "three";
import { AxesHelper } from "three";
import OpacityLogicWorker from './OpacityLogicWorker.js?worker'; // Import the worker
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { TrackballControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
extend({ TrackballControls });
import gsap from "gsap";

import { UniversalDataContext } from "../context/UniversalDataContext";
import { LineSegmentsDataContext } from "../context/LineSegmentsDataContext";
import { GraphCommunitiesDataContext } from "../context/GraphCommunitiesDataContext";

import { Button, Tooltip } from "@mui/material";
import { matchIsValidColor } from "mui-color-input";
// import { POSITION_SCALE_CHANNELS } from "vega-lite/build/src/channel"; // Unused import

const DirectionalLightWithCamera = ({ intensity }) => {
  const directionalLightRef = useRef();
  const { camera } = useThree();

  useFrame(() => {
    if (directionalLightRef.current && camera) {
      directionalLightRef.current.position.copy(camera.position);
      directionalLightRef.current.rotation.copy(camera.rotation);
    }
  });

  return <directionalLight ref={directionalLightRef} intensity={intensity} />;
};

const BoundingBox = ({ segments }) => {
  const linesRef = useRef();

  useEffect(() => {
    if (!segments || segments.length === 0) return;

    const box = new THREE.Box3();
    segments.forEach((segment) => {
      const startPoint = new THREE.Vector3(...segment.startPoint);
      const endPoint = new THREE.Vector3(...segment.endPoint);
      box.expandByPoint(startPoint);
      box.expandByPoint(endPoint);
    });

    // Add padding
    box.min.subScalar(0.1);
    box.max.addScalar(0.1);

    // Create vertices for the 12 edges of the box
    const points = [];
    
    // Bottom face
    points.push(new THREE.Vector3(box.min.x, box.min.y, box.min.z));
    points.push(new THREE.Vector3(box.max.x, box.min.y, box.min.z));
    
    points.push(new THREE.Vector3(box.max.x, box.min.y, box.min.z));
    points.push(new THREE.Vector3(box.max.x, box.min.y, box.max.z));
    
    points.push(new THREE.Vector3(box.max.x, box.min.y, box.max.z));
    points.push(new THREE.Vector3(box.min.x, box.min.y, box.max.z));
    
    points.push(new THREE.Vector3(box.min.x, box.min.y, box.max.z));
    points.push(new THREE.Vector3(box.min.x, box.min.y, box.min.z));

    // Top face
    points.push(new THREE.Vector3(box.min.x, box.max.y, box.min.z));
    points.push(new THREE.Vector3(box.max.x, box.max.y, box.min.z));
    
    points.push(new THREE.Vector3(box.max.x, box.max.y, box.min.z));
    points.push(new THREE.Vector3(box.max.x, box.max.y, box.max.z));
    
    points.push(new THREE.Vector3(box.max.x, box.max.y, box.max.z));
    points.push(new THREE.Vector3(box.min.x, box.max.y, box.max.z));
    
    points.push(new THREE.Vector3(box.min.x, box.max.y, box.max.z));
    points.push(new THREE.Vector3(box.min.x, box.max.y, box.min.z));

    // Vertical edges
    points.push(new THREE.Vector3(box.min.x, box.min.y, box.min.z));
    points.push(new THREE.Vector3(box.min.x, box.max.y, box.min.z));

    points.push(new THREE.Vector3(box.max.x, box.min.y, box.min.z));
    points.push(new THREE.Vector3(box.max.x, box.max.y, box.min.z));

    points.push(new THREE.Vector3(box.max.x, box.min.y, box.max.z));
    points.push(new THREE.Vector3(box.max.x, box.max.y, box.max.z));

    points.push(new THREE.Vector3(box.min.x, box.min.y, box.max.z));
    points.push(new THREE.Vector3(box.min.x, box.max.y, box.max.z));

    // Create geometry from points
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    
    // Update or create the lines
    if (linesRef.current) {
      linesRef.current.geometry.dispose();
      linesRef.current.geometry = geometry;
    }
  }, [segments]);

  return (
    <lineSegments ref={linesRef}>
      <bufferGeometry />
      <lineBasicMaterial color="black" opacity={0.5} transparent={true} />
    </lineSegments>
  );
};

const AxisHelperComponent = ({ scale }) => {
  const axisHelperRef = useRef();
  const { scene } = useThree();

  useEffect(() => {
    if (scale > 0) {
      // Create axis helper
      const axesHelper = new AxesHelper(scale);
      axisHelperRef.current = axesHelper;
      scene.add(axesHelper);
    }

    return () => {
      // Cleanup
      if (axisHelperRef.current) {
        scene.remove(axisHelperRef.current);
        axisHelperRef.current = null;
      }
    };
  }, [scale, scene]);

  return null; // This component doesn't render JSX, it manages THREE.js objects directly
};

const LineSegmentsRendererDISABLE = () =>{
  return <></>
}

const LineSegmentsRenderer = () => {
  const { segments } = useContext(UniversalDataContext); // Removed unused setSelectedSettingsWindow, setDrawerOpen

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <ToastContainer
        position="bottom-center"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
      {segments.length === 0 ? (
        <>
          <Button
            variant="contained"
            style={{ position: "absolute", zIndex: 1, bottom: 20, right: 20 }}
            disabled
          >
            Fit Model
          </Button>
        </>
      ) : segments.length > 370000 ? (
        <>
          <div style={{ 
            position: "absolute", 
            top: "50%", 
            left: "50%", 
            transform: "translate(-50%, -50%)",
            backgroundColor: "rgba(255,0,0,0.1)",
            padding: "20px",
            borderRadius: "5px",
            textAlign: "center",
            color: "#ff0000",
            fontWeight: "bold",
            zIndex: 1
          }}>
            Cannot render: Too many segments ({segments.length.toLocaleString()})
            <br />
            Please reduce to under 200,000 segments
          </div>
          <Button
            variant="contained"
            style={{ position: "absolute", zIndex: 1, bottom: 20, right: 20 }}
            disabled
          >
            Fit Model
          </Button>
        </>
      ) : (
        <>
          <Tooltip title="Zoom in or out to see the Entire Model">
            <Button
              variant="contained"
              style={{ position: "absolute", zIndex: 1, bottom: 20, right: 20 }}
              onClick={() => window.dispatchEvent(new Event("fitModel"))}
            >
              Fit Model
            </Button>
          </Tooltip>{" "}
        </>
      )}

      <Canvas
        style={{ width: "100%", height: "100%" }}
        gl={{ preserveDrawingBuffer: true }}
        className="canvas-3d-view"
      >
        <LineSegmentsCanvas />
      </Canvas>
    </div>
  );
};

const LineSegmentsCanvas = () => {
  const { segments, selectedSegments, setSelectedSegments, coloredSegments } =
    useContext(UniversalDataContext);
  const {
    renderingMethod,
    segmentSaliencyData,
    segmentAverageDistanceData,
    segmentCommunitySizeData,
    segmentCommunityConnectionData,
    // visualizationAttribute, // REMOVED
    opacityConfigs,
    opacityLogic, // Added
    forceDeselectedColor, // Added for new feature
    radius,
    lineWidth,
    tubeRes,
    autoUpdate,
    intensity,
    opacity,
    showCaps,
    cylinderHeight,
    color, // This is the default color for deselected segments if forced
    renderLinesWhenMoving,
    axisScale,
  } = useContext(LineSegmentsDataContext);
  const { graphData, selectedCommunities, communityData } = useContext(GraphCommunitiesDataContext); // Added selectedCommunities, communityData
  const { camera, gl, raycaster, scene } = useThree();

  const workerRef = useRef(null);
  const [segmentAlphas, setSegmentAlphas] = useState(null);
  const toastIdRef = useRef(null); // For managing the loading toast
  const [opacityWorkerPayload, setOpacityWorkerPayload] = useState(null);

  const attributeDataSources = useMemo(() => ({ // Memoize attributeDataSources
    saliency: segmentSaliencyData,
    averageDistance: segmentAverageDistanceData,
    communitySize: segmentCommunitySizeData,
    communityConnections: segmentCommunityConnectionData,
  }), [segmentSaliencyData, segmentAverageDistanceData, segmentCommunitySizeData, segmentCommunityConnectionData]);

  // const getAlphaForSegment = useCallback((segmentGlobalIdx, baseOpacity) => {
  //   if (!opacityConfigs || opacityConfigs.length === 0) {
  //     return baseOpacity; // No configs, so all segments pass (full base opacity)
  //   }

  //   let overallPass = opacityLogic === "AND"; // Initial state depends on logic

  //   for (const config of opacityConfigs) {
  //     const { visAttribute: currentVisAttributeForConfig, min: percentMin, max: percentMax, inverted } = config;

  //     if (!currentVisAttributeForConfig || currentVisAttributeForConfig === "") {
  //       if (opacityLogic === "AND") {
  //         // For AND, an empty/inactive config doesn't cause failure, it's just skipped.
  //         continue;
  //       } else { // For OR
  //         // For OR, an empty/inactive config doesn't contribute to a "pass".
  //         continue;
  //       }
  //     }

  //     const attributeData = attributeDataSources[currentVisAttributeForConfig];
  //     const attributeKey = currentVisAttributeForConfig;

  //     let passesThisSpecificConfig = false; // Assume fail for this specific config initially

  //     if (attributeData && attributeData.length > 0) {
  //       const allNumericValues = attributeData
  //         .map(item => item[attributeKey])
  //         .filter(val => typeof val === 'number' && !isNaN(val));

  //       if (allNumericValues.length > 0) {
  //         let dataMinAttributeValue;
  //         let dataMaxAttributeValue;

  //         if (currentVisAttributeForConfig === "saliency") {
  //           dataMinAttributeValue = 0;
  //           dataMaxAttributeValue = Math.PI / 2;
  //         } else {
  //           dataMinAttributeValue = Math.min(...allNumericValues);
  //           dataMaxAttributeValue = Math.max(...allNumericValues);
  //         }

  //         const segmentEntry = attributeData.find(item => item.globalIdx === segmentGlobalIdx);

  //         if (segmentEntry && typeof segmentEntry[attributeKey] === 'number' && !isNaN(segmentEntry[attributeKey])) {
  //           let currentSegmentValue = segmentEntry[attributeKey];
  //           if (currentVisAttributeForConfig === "saliency") {
  //             currentSegmentValue = (Math.PI / 2) - currentSegmentValue; // Transform saliency
  //           }

  //           const actualPercentMin = Math.min(percentMin, percentMax);
  //           const actualPercentMax = Math.max(percentMin, percentMax);

  //           let segmentValuePercent;
  //           const valueRange = dataMaxAttributeValue - dataMinAttributeValue;

  //           if (valueRange === 0) {
  //             // If all values are the same, check if the config range includes this single value.
  //             // A common approach is to consider it 50% if min=0, max=100, or check if min/max covers the value.
  //             // For simplicity, if range is 0, it passes if user range is 0-100 or inverted.
  //             segmentValuePercent = (actualPercentMin <= 0 && actualPercentMax >= 100) ? 50 : (actualPercentMin > 50 ? 0 : 100);
  //           } else {
  //             segmentValuePercent = ((currentSegmentValue - dataMinAttributeValue) / valueRange) * 100;
  //           }
  //           segmentValuePercent = Math.max(0, Math.min(100, segmentValuePercent)); // Clamp

  //           const isInUserRange = segmentValuePercent >= actualPercentMin && segmentValuePercent <= actualPercentMax;
  //           passesThisSpecificConfig = inverted ? !isInUserRange : isInUserRange;
  //         }
  //       }
  //     }
  //     // If attributeData is missing or segmentEntry is missing, passesThisSpecificConfig remains false.

  //     if (opacityLogic === "AND") {
  //       if (!passesThisSpecificConfig) {
  //         overallPass = false; // One fails, all fail for AND
  //         break;
  //       }
  //     } else { // OR logic
  //       if (passesThisSpecificConfig) {
  //         overallPass = true; // One passes, all pass for OR
  //         break;
  //       }
  //     }
  //   } // End of for...of loop

  //   if (overallPass) {
  //     return baseOpacity;
  //   } else {
  //     return Math.max(0.01, baseOpacity * 0.1); // Significantly reduced opacity
  //   }

  // }, [
  //   opacityConfigs,
  //   opacityLogic, // Added
  //   segmentSaliencyData,
  //   segmentAverageDistanceData,
  //   segmentCommunitySizeData,
  //   segmentCommunityConnectionData,
  //   opacity // baseOpacity is derived from this
  // ]);

  // Initialize worker and set up message handling
  useEffect(() => {
    workerRef.current = new OpacityLogicWorker();
    workerRef.current.onmessage = (event) => {
      if (event.data.alphaValues) {
        setSegmentAlphas(new Float32Array(event.data.alphaValues));
        if (toastIdRef.current) {
          toast.update(toastIdRef.current, {
            render: "Opacity calculation complete!", type: "success", isLoading: false, autoClose: 3000,
          });
          toastIdRef.current = null;
        }
      } else if (event.data.error) {
        if (toastIdRef.current) {
          toast.update(toastIdRef.current, {
            render: `Error: ${event.data.error}`, type: "error", isLoading: false, autoClose: 5000,
          });
          toastIdRef.current = null;
        } else {
          toast.error(`Opacity calculation error: ${event.data.error}`);
        }
      }
    };
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  // Function to prepare payload for the opacity worker
  const prepareWorkerPayload = useCallback(() => {
    if (!segments || segments.length === 0 || !opacityConfigs || opacityConfigs.length === 0) return null;
    
    const numSegments = segments.length;
    const transformedAttributeData = {};
    const attributeKeys = ["saliency", "averageDistance", "communitySize", "communityConnections"];
    
    attributeKeys.forEach(key => {
      const sourceData = attributeDataSources[key];
      const flatArray = new Float32Array(numSegments);
      flatArray.fill(0); // Default for missing data or segments without this attribute
      if (sourceData && sourceData.length > 0) {
        sourceData.forEach(item => {
          if (item.globalIdx !== undefined && item.globalIdx < numSegments) {
            let value = item[key];
            if (key === "saliency" && typeof value === 'number' && !isNaN(value)) {
              value = (Math.PI / 2) - value; // Transform saliency
            }
            flatArray[item.globalIdx] = (typeof value === 'number' && !isNaN(value)) ? value : 0;
          }
        });
      }
      transformedAttributeData[key] = flatArray;
    });

    return {
      opacityConfigs,
      baseOpacity: opacity,
      segmentAttributeData: transformedAttributeData,
      numSegments,
      opacityLogic,
    };
  }, [segments, opacityConfigs, opacity, opacityLogic, attributeDataSources]);

  // Effect to trigger worker if autoUpdate is true and relevant data changes
  useEffect(() => {
    if (autoUpdate) {
      const payload = prepareWorkerPayload();
      if (payload) {
        // Check if payload is meaningfully different from current to avoid redundant calls (optional optimization)
        // For simplicity, we'll set it. Deep comparison could be added if needed.
        setOpacityWorkerPayload(payload);
      } else if (segments && segments.length > 0 && (!opacityConfigs || opacityConfigs.length === 0)) {
        // If we have segments but no opacity configs, clear segmentAlphas to use base opacity
        setSegmentAlphas(null);
        setOpacityWorkerPayload(null);
      }
    }
  }, [autoUpdate, prepareWorkerPayload, segments, opacityConfigs]); // prepareWorkerPayload changes if its dependencies change

  // Effect to send data to the worker when opacityWorkerPayload is set
  useEffect(() => {
    if (workerRef.current && opacityWorkerPayload) {
      if (toastIdRef.current) {
        toast.dismiss(toastIdRef.current);
      }
      toastIdRef.current = toast.loading("Calculating segment opacities...");

      const transferableObjects = Object.values(opacityWorkerPayload.segmentAttributeData)
        .map(arr => arr.buffer).filter(buffer => buffer instanceof ArrayBuffer);
      
      workerRef.current.postMessage(opacityWorkerPayload, transferableObjects);

    } else if (segments && segments.length === 0 && workerRef.current) { // Handle clearing segments
      setSegmentAlphas(null);
      setOpacityWorkerPayload(null); // Clear payload
      if (toastIdRef.current) { // Dismiss any pending toast
          toast.dismiss(toastIdRef.current);
          toastIdRef.current = null;
      }
      // Optionally tell worker to clear/reset if it maintains internal state
      // workerRef.current.postMessage({ command: 'reset' }); 
    }
  }, [opacityWorkerPayload, segments]); // segments dependency for the clearing case

  const controls = useThree((state) => state.controls);
  const meshesRef = useRef([]);
  const backgroundLinesRef = useRef([]);
  const [prevMousePos, setPrevMousePos] = useState(new THREE.Vector2(0, 0));
  const [leftMouseButtonDown, setLeftMouseButtonDown] = useState(false);
  const [rightMouseButtonDown, setRightMouseButtonDown] = useState(false);
  const [wheelMoving, setWheelMoving] = useState(false);
  const wheelStopTime = 200;
  const wheelTimeoutRef = useRef(null);

  const handleMouseUp = useCallback(
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.button === 0) setLeftMouseButtonDown(false);
      if (event.button === 2) setRightMouseButtonDown(false);
      if (event.button !== 2) return;
      if (coloredSegments && coloredSegments.length > 0) return;

      const rect = gl.domElement.getBoundingClientRect();

      const currMousePos = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );

      if (currMousePos.distanceTo(prevMousePos) > 0.01) return;

      raycaster.setFromCamera(currMousePos, camera);
      const intersects = raycaster.intersectObjects(meshesRef.current, true);

      if (intersects.length > 0) {
        const intersection = intersects[0];
        const intersectionPoint = intersection.point;

        let minDistance = Infinity;
        let closestSegment = null;

        if (segments && segments.length > 0) {
          segments.forEach((segment) => {
            const startPoint = new THREE.Vector3(...segment.startPoint);
            const endPoint = new THREE.Vector3(...segment.endPoint);

            const centerPoint = new THREE.Vector3()
              .addVectors(startPoint, endPoint)
              .multiplyScalar(0.5);

            const distance = centerPoint.distanceTo(intersectionPoint);
            if (distance < minDistance) {
              minDistance = distance;
              closestSegment = segment;
            }
          });
        }

        if (
          selectedSegments.length > 0 &&
          closestSegment.lineIDx === selectedSegments[0].lineIDx
        )
          setSelectedSegments([]);
        else {
          const newSelectedSegments = [];
          segments.forEach((segment) => {
            if (segment.lineIDx === closestSegment.lineIDx) {
              newSelectedSegments.push(segment);
            }
          });
          setSelectedSegments(newSelectedSegments);
        }
      }
    },
    [
      camera,
      raycaster,
      gl.domElement,
      selectedSegments,
      setSelectedSegments,
      segments,
      coloredSegments,
      prevMousePos,
    ]
  );

  const handleMouseDown = useCallback(
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.button === 0) setLeftMouseButtonDown(true);
      if (event.button === 2) setRightMouseButtonDown(true);
      if (event.button !== 2) return;
      const rect = gl.domElement.getBoundingClientRect();
      setPrevMousePos(
        new THREE.Vector2(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          -((event.clientY - rect.top) / rect.height) * 2 + 1
        )
      );
    },
    [
      camera,
      raycaster,
      gl.domElement,
      selectedSegments,
      setSelectedSegments,
      segments,
      coloredSegments,
    ]
  );

  const handleWheel = useCallback(
    (event) => {
      event.preventDefault();

      setWheelMoving(true);

      if (wheelTimeoutRef.current) clearTimeout(wheelTimeoutRef.current);

      wheelTimeoutRef.current = setTimeout(() => {
        setWheelMoving(false);
      }, wheelStopTime);
    },
    [camera, wheelStopTime]
  );

  useEffect(() => {
    if (renderLinesWhenMoving) {
      meshesRef.current.forEach((mesh) => {
        mesh.visible = !(
          leftMouseButtonDown ||
          rightMouseButtonDown ||
          wheelMoving
        );
      });
      backgroundLinesRef.current.forEach((mesh) => {
        mesh.visible =
          leftMouseButtonDown || rightMouseButtonDown || wheelMoving;
      });
    } else {
      meshesRef.current.forEach((mesh) => {
        mesh.visible = true;
      });
      backgroundLinesRef.current.forEach((mesh) => {
        scene.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
      });
      backgroundLinesRef.current = [];
    }
  }, [
    renderLinesWhenMoving,
    leftMouseButtonDown,
    rightMouseButtonDown,
    wheelMoving,
  ]);

  useEffect(() => {
    gl.domElement.addEventListener("mousedown", handleMouseDown);
    gl.domElement.addEventListener("mouseup", handleMouseUp);
    gl.domElement.addEventListener("wheel", handleWheel);
    return () => {
      gl.domElement.removeEventListener("mousedown", handleMouseDown);
      gl.domElement.removeEventListener("mouseup", handleMouseUp);
      gl.domElement.removeEventListener("wheel", handleWheel); // Fixed: was addEventListener
      if (wheelTimeoutRef.current) clearTimeout(wheelTimeoutRef.current);
    };
  }, [gl.domElement, handleMouseDown, handleMouseUp, handleWheel]);

  const fitModelToView = useCallback(() => {
    if (!segments || segments.length === 0) return;

    const box = new THREE.Box3();
    segments.forEach((segment) => {
      const startPoint = new THREE.Vector3(...segment.startPoint);
      const endPoint = new THREE.Vector3(...segment.endPoint);
      box.expandByPoint(startPoint);
      box.expandByPoint(endPoint);
    });

    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);

    const maxDim = Math.max(size.x, size.y, size.z);
    const fitHeightDistance =
      maxDim / (2 * Math.atan((Math.PI * camera.fov) / 360));
    const fitWidthDistance = fitHeightDistance / camera.aspect;
    const distance = Math.max(fitHeightDistance, fitWidthDistance);

    const direction = new THREE.Vector3()
      .subVectors(camera.position, center)
      .normalize();

    const newPosition = direction.multiplyScalar(distance).add(center);

    gsap.to(camera.position, {
      x: newPosition.x,
      y: newPosition.y,
      z: newPosition.z,
      duration: 0.75,
      ease: "power2.inOut",
      onUpdate: () => {
        camera.lookAt(center);
        camera.updateProjectionMatrix();
      },
    });

    if (controls) {
      gsap.to(controls.target, {
        x: center.x,
        y: center.y,
        z: center.z,
        duration: 1.5,
        ease: "power2.inOut",
        onUpdate: () => {
          controls.update();
        },
      });
    }
  }, [camera, controls, segments]);

  const render = useCallback((background = false) => { // Wrap render in useCallback
    if (!matchIsValidColor(color)) return;

    if (background) {
      if (backgroundLinesRef.current) {
        backgroundLinesRef.current.forEach((mesh) => {
          scene.remove(mesh);
          mesh.geometry.dispose();
          mesh.material.dispose();
        });
      }
      backgroundLinesRef.current = [];
    } else {
      if (meshesRef.current) {
        meshesRef.current.forEach((mesh) => {
          scene.remove(mesh);
          mesh.geometry.dispose();
          mesh.material.dispose();
        });
      }
      meshesRef.current = [];
    }


    // ... (rest of render function logic remains the same) ...
    // The 'color' variable from LineSegmentsDataContext is the default color.
    // When rendering "other" segments (the second call in each pair),
    // we pass `null` as the fixedColorOverride if `forceDeselectedColor` is false,
    // allowing them to use their community color. If `forceDeselectedColor` is true,
    // the renderX functions will apply the default 'color'.
    // The primary selected segments (first call in each pair) always use their own color.

    if (background) {
      // For background rendering, always use lines regardless of rendering method
      if (graphData.nodes.length > 0 && selectedSegments.length > 0) {
        renderLines(selectedSegments, -1, null, background); // Selected segments use their own color
        renderLines(segments, opacity / 10, null, background); // Other segments logic handled in renderLines
      } else if (graphData.nodes.length > 0) {
        renderLines(coloredSegments, -1, null, background); 
        if (forceDeselectedColor && communityData && communityData.length > (coloredSegments.length / (segments.length / communityData.length))) { 
            const nonSelectedCommunitySegments = segments.filter(seg => !coloredSegments.find(cs => cs.globalIdx === seg.globalIdx));
            renderLines(nonSelectedCommunitySegments, opacity / 10, null, background);
        }
      } else if (segments.length > 0) { 
        renderLines(segments, -1, null, background); 
      }
    } else if (renderingMethod === "Line") {
      // For line rendering, only use renderLines - no caps or other geometry
      if (graphData.nodes.length > 0 && selectedSegments.length > 0) {
        renderLines(selectedSegments, -1, null, false); // Selected segments use their own color
        renderLines(segments, opacity / 10, null, false); // Other segments logic handled in renderLines
      } else if (graphData.nodes.length > 0) {
        renderLines(coloredSegments, -1, null, false); 
        if (forceDeselectedColor && communityData && communityData.length > (coloredSegments.length / (segments.length / communityData.length))) { 
            const nonSelectedCommunitySegments = segments.filter(seg => !coloredSegments.find(cs => cs.globalIdx === seg.globalIdx));
            renderLines(nonSelectedCommunitySegments, opacity / 10, null, false);
        }
      } else if (segments.length > 0) { 
        renderLines(segments, -1, null, false); 
      }
    } else if (renderingMethod === "Tube") {
      if (graphData.nodes.length > 0 && selectedSegments.length > 0) {
        renderTubes(selectedSegments); 
        renderTubes(segments, opacity / 10, null); 
      } else if (graphData.nodes.length > 0) {
        renderTubes(coloredSegments);
         if (forceDeselectedColor && communityData && communityData.length > (coloredSegments.length / (segments.length / communityData.length))) {
            const nonSelectedCommunitySegments = segments.filter(seg => !coloredSegments.find(cs => cs.globalIdx === seg.globalIdx));
            renderTubes(nonSelectedCommunitySegments, opacity / 10, null);
        }
      } else if (segments.length > 0) {
        renderTubes(segments, -1, null);
      }
    } else if (renderingMethod === "Cylinder") {
      if (graphData.nodes.length > 0 && selectedSegments.length > 0) {
        renderCylinders(selectedSegments); 
        renderCylinders(segments, opacity / 10, null); 
      } else if (graphData.nodes.length > 0) {
        renderCylinders(coloredSegments);
        if (forceDeselectedColor && communityData && communityData.length > (coloredSegments.length / (segments.length / communityData.length))) {
            const nonSelectedCommunitySegments = segments.filter(seg => !coloredSegments.find(cs => cs.globalIdx === seg.globalIdx));
            renderCylinders(nonSelectedCommunitySegments, opacity / 10, null);
        }
      } else if (segments.length > 0) {
        renderCylinders(segments, -1, null);
      }
    }
  }, [
    scene, color, meshesRef, backgroundLinesRef, // Core rendering elements
    renderingMethod, graphData, selectedSegments, segments, coloredSegments, // Data sources
    opacity, forceDeselectedColor, communityData, // Styling and conditional logic
    segmentAlphas, axisScale, // Crucial for opacity and axis helper logic
    radius, lineWidth, tubeRes, showCaps, cylinderHeight // Geometry parameters for tubes/cylinders/lines
  ]);

  useEffect(() => {
    const handleFitModel = () => fitModelToView();
    window.addEventListener("fitModel", handleFitModel);
    return () => window.removeEventListener("fitModel", handleFitModel);
  }, [fitModelToView]);

  useEffect(() => {
    const handleRenderEvent = () => {
      // This is for manual render via the "render" event
      const payload = prepareWorkerPayload();
      if (payload) {
        setOpacityWorkerPayload(payload);
      }
      // The actual render() call will be triggered by segmentAlphas update
    };
    window.addEventListener("render", handleRenderEvent);
    return () => window.removeEventListener("render", handleRenderEvent);
  }, [prepareWorkerPayload]); // Ensure handleRenderEvent uses the latest prepareWorkerPayload

  useEffect(() => {
    fitModelToView();
  }, [segments, fitModelToView]); // fitModelToView is a dependency

  // Effect for autoUpdate based on visual parameter changes (not opacity data)
  useEffect(() => {
    if (autoUpdate) {
      // This render uses existing segmentAlphas. Opacity data changes are handled by prepareWorkerPayload.
      render();
      if (renderLinesWhenMoving) {
        render(true); // For background lines
      }
    }
  }, [
    autoUpdate, render, renderLinesWhenMoving, // Core dependencies
    // Visual parameters that should trigger re-render if autoUpdate is on,
    // but DO NOT require opacity recalculation by themselves.
    radius, lineWidth, tubeRes, intensity, opacity, // opacity is baseOpacity, also used directly
    showCaps, cylinderHeight, color, // renderingMethod is part of render's deps
  ]);

  // Effect to render when segmentAlphas (from worker) are updated
  useEffect(() => {
    if (segmentAlphas || (segments && segments.length === 0)) { // Render if alphas exist or if segments were cleared
      render();
      if (renderLinesWhenMoving) {
        render(true);
      }
    }
  }, [segmentAlphas, render, renderLinesWhenMoving, segments]); // segments for the clearing case

  // Effect for re-rendering when selection/data changes that don't involve opacity logic directly
  // but require a visual update with current opacities.
  useEffect(() => {
    render();
    if (renderLinesWhenMoving) {
      render(true);
    }
  }, [segments, selectedSegments, coloredSegments, graphData, forceDeselectedColor, render, renderLinesWhenMoving]);


  const renderTubes = (data, o = -1, fixedColorOverride = null) => {
    if (!data || data.length === 0) return; // Added check for empty data
    if (data.length > 370000) {
      console.warn("Cannot render: Too many segments (>300k). Please reduce the number of segments.");
      return;
    }
    const groupedSegments = [];
    let currGroup = [];
    for (let i = 0; i < data.length; i++) {
      const segment = data[i];
      if (i > 0 && (segment.lineIDx !== data[i - 1].lineIDx || (segment.color && segment.color !== data[i - 1].color))) {
        groupedSegments.push(currGroup);
        currGroup = [segment];
      } else {
        currGroup.push(segment);
      }
    }
    groupedSegments.push(currGroup);

    groupedSegments.forEach((group) => {
      if (group.length === 0) return;
      const points = [];
      group.forEach((segment, index) => {
        if (index === 0) points.push(new THREE.Vector3(...segment.startPoint));
        points.push(new THREE.Vector3(...segment.endPoint));
      });

      if (points.length < 2) return; // CatmullRomCurve3 needs at least 2 points

      const curve = new THREE.CatmullRomCurve3(points);
      const tubeGeometry = new THREE.TubeGeometry(curve, Math.max(1, points.length * 5), radius, tubeRes, false); // Segments based on points length
      const baseTubeOpacity = o === -1 ? opacity : o;
      const representativeSegmentGlobalIdx = group[0]?.globalIdx;
      // const tubeAlpha = representativeSegmentGlobalIdx !== undefined 
      //   ? getAlphaForSegment(representativeSegmentGlobalIdx, baseTubeOpacity)
      //   : baseTubeOpacity;
      const tubeAlpha = (segmentAlphas && representativeSegmentGlobalIdx !== undefined && representativeSegmentGlobalIdx < segmentAlphas.length)
        ? segmentAlphas[representativeSegmentGlobalIdx]
        : baseTubeOpacity;
      
      let segmentOriginalColor = group[0].color;
      let finalColorToUse = fixedColorOverride ? fixedColorOverride : segmentOriginalColor;

      if (forceDeselectedColor) {
        let meetsForceColorCondition = false;
        // Condition 1: Part of a "dimmed" render pass (e.g. not an explicitly selected streamline/community)
        if (o !== -1) {
          meetsForceColorCondition = true;
        }
        // Condition 2: Filtered by opacity rules (alpha reduced below its potential max for this pass)
        // This applies to any segment, even within an "selected" batch (o === -1), if its individual opacity is reduced.
        if (tubeAlpha < baseTubeOpacity && baseTubeOpacity > 0.001) { // Compare with its own pass's base opacity, avoid division by zero or tiny floats
          meetsForceColorCondition = true;
        }
        
        if (meetsForceColorCondition) {
          finalColorToUse = color; // 'color' from LineSegmentsDataContext (the default color)
        }
      }

      const material = new THREE.MeshPhongMaterial({
        transparent: true,
        opacity: tubeAlpha,
        color: finalColorToUse,
      });
      const tubeMesh = new THREE.Mesh(tubeGeometry, material);
      scene.add(tubeMesh);
      meshesRef.current.push(tubeMesh);
    });

    if (showCaps) {
      data.forEach((segment, i) => {
        // Cap logic (uses getAlphaForSegment per cap)
        const startPoint = new THREE.Vector3(...segment.startPoint);
        const endPoint = new THREE.Vector3(...segment.endPoint);
        const direction = new THREE.Vector3().subVectors(endPoint, startPoint);
        const axis = new THREE.Vector3(0, 1, 0).cross(direction).normalize();
        const angle = Math.acos(new THREE.Vector3(0, 1, 0).dot(direction.normalize()));
        const quaternion = new THREE.Quaternion().setFromAxisAngle(axis, angle);

        if (i === 0 || segment.lineIDx !== data[i - 1].lineIDx || (segment.color && data[i-1].color && segment.color !== data[i - 1].color) ) {
          let capOriginalColor = segment.color;
          let capFinalColor = fixedColorOverride ? fixedColorOverride : capOriginalColor; // Start with original or override

          // Apply forceDeselectedColor logic for caps
          const capBaseOpacity = o === -1 ? opacity : o;
          const capActualAlpha = (segmentAlphas && segment.globalIdx !== undefined && segment.globalIdx < segmentAlphas.length)
                                ? segmentAlphas[segment.globalIdx]
                                : capBaseOpacity;

          if (forceDeselectedColor) {
            let capMeetsForceColorCondition = false;
            if (o !== -1) { // Part of "other" segments pass
              capMeetsForceColorCondition = true;
            }
            if (capActualAlpha < capBaseOpacity && capBaseOpacity > 0.001) { // Individually faded by opacity rules
              capMeetsForceColorCondition = true;
            }
            if (capMeetsForceColorCondition) {
              capFinalColor = color;
            }
          }
          const startCap = new THREE.Mesh(
            new THREE.CircleGeometry(radius, tubeRes),
            new THREE.MeshStandardMaterial({
              color: capFinalColor,
              opacity: (segmentAlphas && segment.globalIdx !== undefined && segment.globalIdx < segmentAlphas.length)
                ? segmentAlphas[segment.globalIdx]
                : (o === -1 ? opacity : o),
              transparent: true, side: THREE.DoubleSide
            })
          );
          startCap.position.copy(startPoint);
          startCap.rotation.setFromQuaternion(quaternion);
          startCap.rotateX(Math.PI / 2);
          scene.add(startCap);
          meshesRef.current.push(startCap);
        }
        if (i === data.length - 1 || segment.lineIDx !== data[i + 1].lineIDx || (segment.color && data[i+1].color && segment.color !== data[i + 1].color)) {
          let capOriginalColor = segment.color;
          let capFinalColor = fixedColorOverride ? fixedColorOverride : capOriginalColor; // Start with original or override
          
          // Apply forceDeselectedColor logic for caps (same as startCap)
          const capBaseOpacity = o === -1 ? opacity : o;
          const capActualAlpha = (segmentAlphas && segment.globalIdx !== undefined && segment.globalIdx < segmentAlphas.length)
                                ? segmentAlphas[segment.globalIdx]
                                : capBaseOpacity;

          if (forceDeselectedColor) {
            let capMeetsForceColorCondition = false;
            if (o !== -1) {
              capMeetsForceColorCondition = true;
            }
            if (capActualAlpha < capBaseOpacity && capBaseOpacity > 0.001) {
              capMeetsForceColorCondition = true;
            }
            if (capMeetsForceColorCondition) {
              capFinalColor = color;
            }
          }
          const endCap = new THREE.Mesh(
            new THREE.CircleGeometry(radius, tubeRes),
            new THREE.MeshStandardMaterial({
              color: capFinalColor,
              opacity: (segmentAlphas && segment.globalIdx !== undefined && segment.globalIdx < segmentAlphas.length)
                ? segmentAlphas[segment.globalIdx]
                : (o === -1 ? opacity : o),
              transparent: true, side: THREE.DoubleSide
            })
          );
          endCap.position.copy(endPoint);
          endCap.rotation.setFromQuaternion(quaternion);
          endCap.rotateX(-Math.PI / 2);
          scene.add(endCap);
          meshesRef.current.push(endCap);
        }
      });
    }
  };

  const renderCylinders = (data, o = -1, fixedColorOverride = null) => {
    if (!data || data.length === 0) return; // Added check for empty data
    if (data.length > 370000) {
      console.warn("Cannot render: Too many segments (>300k). Please reduce the number of segments.");
      return;
    }
    const material = new THREE.MeshPhongMaterial({
      transparent: true,
      // For InstancedMesh, individual alpha is tricky. We apply getAlphaForSegment to the overall opacity.
      // This means all instances in this batch will share an opacity derived from the first segment's properties if not overridden.
      // Or, more simply, use the passed opacity 'o' or global 'opacity'.
      // For true per-instance alpha based on attributes with InstancedMesh, custom shaders are usually needed.
      // Here, we'll apply a single alpha to the whole InstancedMesh.
      // If segmentAlphas is available, use the alpha of the first segment. Otherwise, fallback.
      opacity: (segmentAlphas && data.length > 0 && data[0].globalIdx !== undefined && data[0].globalIdx < segmentAlphas.length)
        ? segmentAlphas[data[0].globalIdx]
        : (o === -1 ? opacity : o),
    });

    const tubeGeometry = new THREE.CylinderGeometry(radius, radius, 1, tubeRes, 1, false); // Height is 1, scaled per instance
    const tubeMesh = new THREE.InstancedMesh(tubeGeometry, material, data.length);
    const dummy = new THREE.Object3D();

    data.forEach((segment, i) => {
      const startPoint = new THREE.Vector3(...segment.startPoint);
      const endPoint = new THREE.Vector3(...segment.endPoint);
      const midPoint = new THREE.Vector3().addVectors(startPoint, endPoint).multiplyScalar(0.5);
      const direction = new THREE.Vector3().subVectors(endPoint, startPoint);
      const length = direction.length();
      direction.normalize();

      dummy.position.copy(midPoint);
      dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
      dummy.scale.set(1, length, 1);
      dummy.updateMatrix();
      tubeMesh.setMatrixAt(i, dummy.matrix);
      
      let segmentInstanceOriginalColor = segment.color;
      let finalInstanceColor = fixedColorOverride ? fixedColorOverride : segmentInstanceOriginalColor;

      // For InstancedMesh, color is per-instance. Alpha is per-mesh.
      // The color logic should apply per instance.
      // The alpha for the whole InstancedMesh is set once using data[0].
      // This means if forceDeselectedColor is true due to alpha of data[0], all instances get default color.
      // This is a limitation of InstancedMesh without custom shaders for per-instance alpha driving color.
      // However, the `o !== -1` check can still apply per instance for color.

      const instanceBaseOpacity = o === -1 ? opacity : o; // Base opacity for this instance's context
      // Alpha for this specific instance (if we could apply it per instance for color decision)
      const instanceActualAlpha = (segmentAlphas && segment.globalIdx !== undefined && segment.globalIdx < segmentAlphas.length)
                                  ? segmentAlphas[segment.globalIdx]
                                  : instanceBaseOpacity;

      if (forceDeselectedColor) {
        let meetsForceColorCondition = false;
        if (o !== -1) { // Part of "other" segments pass
          meetsForceColorCondition = true;
        }
        // If this specific instance is faded by opacity rules
        if (instanceActualAlpha < instanceBaseOpacity && instanceBaseOpacity > 0.001) {
          meetsForceColorCondition = true;
        }
        if (meetsForceColorCondition) {
          finalInstanceColor = color;
        }
      }
      tubeMesh.setColorAt(i, new THREE.Color(finalInstanceColor));
    });

    tubeMesh.instanceMatrix.needsUpdate = true;
    if (tubeMesh.instanceColor) tubeMesh.instanceColor.needsUpdate = true;
    scene.add(tubeMesh);
    meshesRef.current.push(tubeMesh);

    if (showCaps) {
      data.forEach((segment) => {
          let capOriginalColor = segment.color;
          let capFinalColor = fixedColorOverride ? fixedColorOverride : capOriginalColor;

          const capBaseOpacity = o === -1 ? opacity : o;
          const capActualAlpha = (segmentAlphas && segment.globalIdx !== undefined && segment.globalIdx < segmentAlphas.length)
                                ? segmentAlphas[segment.globalIdx]
                                : capBaseOpacity;
          
          if (forceDeselectedColor) {
            let capMeetsForceColorCondition = false;
            if (o !== -1) { // Part of "other" segments pass
              capMeetsForceColorCondition = true;
            }
            if (capActualAlpha < capBaseOpacity && capBaseOpacity > 0.001) { // Individually faded
              capMeetsForceColorCondition = true;
            }
            if (capMeetsForceColorCondition) {
              capFinalColor = color;
            }
          }
          const capMaterial = new THREE.MeshStandardMaterial({
              color: capFinalColor,
              opacity: (segmentAlphas && segment.globalIdx !== undefined && segment.globalIdx < segmentAlphas.length)
                ? segmentAlphas[segment.globalIdx]
                : (o === -1 ? opacity : o),
              transparent: true,
              side: THREE.DoubleSide
          });
          const capGeometry = new THREE.CircleGeometry(radius, tubeRes);

          const startPoint = new THREE.Vector3(...segment.startPoint);
          const endPoint = new THREE.Vector3(...segment.endPoint);
          const direction = new THREE.Vector3().subVectors(endPoint, startPoint).normalize();
          const capQuaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);


          const startCap = new THREE.Mesh(capGeometry, capMaterial);
          startCap.position.copy(startPoint);
          startCap.quaternion.copy(capQuaternion);
          scene.add(startCap);
          meshesRef.current.push(startCap);

          const endCap = new THREE.Mesh(capGeometry, capMaterial);
          endCap.position.copy(endPoint);
          endCap.quaternion.copy(capQuaternion);
          scene.add(endCap);
          meshesRef.current.push(endCap);
      });
    }
  };

  const renderLines = (data, o = -1, fixedColorOverride = null, background = false) => {
    if (!data || data.length === 0) return; // Added check for empty data
    if (data.length > 370000) {
      console.warn("Cannot render: Too many segments (>300k). Please reduce the number of segments.");
      return;
    }
    const groupedSegments = [];
    let currGroup = [];
    for (let i = 0; i < data.length; i++) {
      const segment = data[i];
      if (i > 0 && (segment.lineIDx !== data[i - 1].lineIDx || (segment.color && segment.color !== data[i - 1].color))) {
        groupedSegments.push(currGroup);
        currGroup = [segment];
      } else {
        currGroup.push(segment);
      }
    }
    if (currGroup.length > 0) groupedSegments.push(currGroup);

    groupedSegments.forEach((group) => {
      if (group.length === 0) return;
      const points = [];
      group.forEach((segment, index) => {
        if (index === 0) points.push(new THREE.Vector3(...segment.startPoint));
        points.push(new THREE.Vector3(...segment.endPoint));
      });

      if (points.length < 2) return;

      const baseLineOpacity = o === -1 ? opacity : o/5;
      const representativeSegmentGlobalIdx = group[0]?.globalIdx;
      const lineAlpha = (segmentAlphas && representativeSegmentGlobalIdx !== undefined && representativeSegmentGlobalIdx < segmentAlphas.length)
        ? segmentAlphas[representativeSegmentGlobalIdx]
        : baseLineOpacity;

      let segmentOriginalColor = group[0].color;
      let finalColorToUse = fixedColorOverride ? fixedColorOverride : segmentOriginalColor;

      if (forceDeselectedColor) {
        let meetsForceColorCondition = false;
        if (o !== -1) { // Part of "other" segments pass
          meetsForceColorCondition = true;
        }
        if (lineAlpha < baseLineOpacity && baseLineOpacity > 0.001) { 
          meetsForceColorCondition = true;
        }
        if (meetsForceColorCondition) {
          finalColorToUse = color;
        }
      }
      //HARDCODED
      if (baseLineOpacity != 1)
        finalColorToUse = fixedColorOverride;

      // Always use Line2/LineMaterial for proper line rendering
      // Adjust settings to minimize artifacts while maintaining line continuity
      const lineGeometry = new LineGeometry();
      const positions = [];
      points.forEach(point => {
        positions.push(point.x, point.y, point.z);
      });
      lineGeometry.setPositions(positions);

      const material = new LineMaterial({
        color: new THREE.Color(finalColorToUse),
        transparent: true,
        opacity: lineAlpha,
        linewidth: Math.max(lineWidth, 0.5), // Ensure minimum line width to avoid artifacts
        alphaToCoverage: false, // Disable to reduce artifacts
        dashed: false,
        vertexColors: false,
      });
      
      // Set resolution for LineMaterial
      material.resolution.set(gl.domElement.width, gl.domElement.height);
      
      // Optimize transparency settings to reduce artifacts
      material.depthTest = true;
      material.depthWrite = lineAlpha >= 0.99; // Only write depth for fully opaque lines
      material.blending = THREE.NormalBlending;

      const line = new Line2(lineGeometry, material);
      scene.add(line);
      if (background) backgroundLinesRef.current.push(line);
      else meshesRef.current.push(line);
    });
  };

  return (
    <>
      <ambientLight intensity={0.5} />
      <DirectionalLightWithCamera intensity={intensity} />
      <BoundingBox segments={segments} />
      {axisScale > 0 && <AxisHelperComponent scale={axisScale} />}
      <TrackballControls makeDefault />
    </>
  );
};

export default LineSegmentsRenderer;
