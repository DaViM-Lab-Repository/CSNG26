import React, {
  useCallback,
  useRef,
  useEffect,
  useState,
  useContext,
} from "react";
import { extend, useThree, useFrame } from "@react-three/fiber";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2";
extend({ LineSegments2 });
import * as THREE from "three";
import { TrackballControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
extend({ TrackballControls });
import gsap from "gsap";

import { UniversalDataContext } from "../context/UniversalDataContext";
import { LineSegmentsDataContext } from "../context/LineSegmentsDataContext";
import { GraphCommunitiesDataContext } from "../context/GraphCommunitiesDataContext";

import { Button, Tooltip } from "@mui/material";
import { matchIsValidColor } from "mui-color-input";
import { POSITION_SCALE_CHANNELS } from "vega-lite/build/src/channel";

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

const LineSegmentsRenderer = () => {
  const { segments, setSelectedSettingsWindow, setDrawerOpen } =
    useContext(UniversalDataContext);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
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

      <Canvas style={{ width: "100%", height: "100%" }}>
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
    radius,
    tubeRes,
    autoUpdate,
    intensity,
    opacity,
    showCaps,
    cylinderHeight,
    color,
    renderLinesWhenMoving,
  } = useContext(LineSegmentsDataContext);
  const { graphData } = useContext(GraphCommunitiesDataContext);
  const { camera, gl, raycaster, scene } = useThree();
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
      gl.domElement.addEventListener("wheel", handleWheel);
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

  const render = (background = false) => {
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

    if (background || renderingMethod === "Line") {
      if (graphData.nodes.length > 0 && selectedSegments.length > 0) {
        renderLines(selectedSegments, -1, null, background);
        renderLines(segments, opacity / 10, color, background);
      } else if (graphData.nodes.length > 0) {
        renderLines(coloredSegments, -1, null, background);
      } else if (segments.length > 0) {
        renderLines(segments, -1, color, background);
      }
    } else if (renderingMethod === "Tube") {
      if (graphData.nodes.length > 0 && selectedSegments.length > 0) {
        renderTubes(selectedSegments);
        renderTubes(segments, opacity / 10, color);
      } else if (graphData.nodes.length > 0) {
        renderTubes(coloredSegments);
      } else if (segments.length > 0) {
        renderTubes(segments, -1, color);
      }
    } else if (renderingMethod === "Cylinder") {
      if (graphData.nodes.length > 0 && selectedSegments.length > 0) {
        renderCylinders(selectedSegments);
        renderCylinders(segments, opacity / 10, color);
      } else if (graphData.nodes.length > 0) {
        renderCylinders(coloredSegments);
      } else if (segments.length > 0) {
        renderCylinders(segments, -1, color);
      }
    }
  };

  // Listen for the 'fitModel' event to trigger fitModelToView
  useEffect(() => {
    const handleFitModel = () => fitModelToView();

    window.addEventListener("fitModel", handleFitModel);
    return () => window.removeEventListener("fitModel", handleFitModel);
  }, [fitModelToView]);

  useEffect(() => {
    const handleRender = () => {
      render();
      if (renderLinesWhenMoving) render(true);
    };

    window.addEventListener("render", handleRender);
    return () => window.removeEventListener("render", handleRender);
  }, [render]);

  useEffect(() => {
    fitModelToView();
  }, [segments]);

  useEffect(() => {
    if (autoUpdate) {
      render();
      if (renderLinesWhenMoving) {
        render(true);
      }
    }
  }, [
    radius,
    tubeRes,
    autoUpdate,
    intensity,
    opacity,
    showCaps,
    cylinderHeight,
    scene,
    renderingMethod,
    color,
    renderLinesWhenMoving,
  ]);

  useEffect(() => {
    render();
    if (renderLinesWhenMoving) {
      render(true);
    }
  }, [segments, selectedSegments, coloredSegments, graphData]);

  const renderTubes = (data, o = -1, tubeColor = null) => {
    const groupedSegments = [];
    let currGroup = [];

    for (let i = 0; i < data.length; i++) {
      const segment = data[i];
      if (
        i > 0 &&
        (segment.lineIDx !== data[i - 1].lineIDx ||
          (segment.color && segment.color !== data[i - 1].color))
      ) {
        groupedSegments.push(currGroup);
        currGroup = [segment];
      } else {
        currGroup.push(segment);
      }
    }

    groupedSegments.push(currGroup);

    groupedSegments.forEach((group) => {
      const points = [];

      group.forEach((segment, index) => {
        if (index === 0) points.push(new THREE.Vector3(...segment.startPoint));
        points.push(new THREE.Vector3(...segment.endPoint));
      });

      if (points.length < 1) return;

      const curve = new THREE.CatmullRomCurve3(points);
      const tubeGeometry = new THREE.TubeGeometry(
        curve,
        100,
        radius,
        tubeRes,
        false
      );
      const material = new THREE.MeshPhongMaterial({
        transparent: true,
        opacity: o === -1 ? opacity : o,
        color: tubeColor ? tubeColor : group[0].color,
      });
      const tubeMesh = new THREE.Mesh(tubeGeometry, material);

      scene.add(tubeMesh);
      meshesRef.current.push(tubeMesh);
    });

    if (showCaps) {
      data.forEach((segment, i) => {
        const startPoint = new THREE.Vector3(...segment.startPoint);
        const endPoint = new THREE.Vector3(...segment.endPoint);

        const direction = new THREE.Vector3().subVectors(endPoint, startPoint);

        // Axis and angle for the cylinder orientation
        const axis = new THREE.Vector3(0, 1, 0).cross(direction).normalize();
        const angle = Math.acos(
          new THREE.Vector3(0, 1, 0).dot(direction.normalize())
        );

        // Set cylinder mesh position and orientation
        const quaternion = new THREE.Quaternion().setFromAxisAngle(axis, angle);

        if (
          i === 0 ||
          segment.lineIDx !== data[i - 1].lineIDx ||
          segment.color !== data[i - 1].color
        ) {
          const startCap = new THREE.Mesh(
            new THREE.CircleGeometry(radius, tubeRes), // Adjust radius and segments as needed
            new THREE.MeshStandardMaterial({
              color: tubeColor ? tubeColor : segment.color,
              opacity: o === -1 ? opacity : o,
              transparent: true,
            }) // Adjust material properties
          );
          startCap.position.copy(startPoint);
          startCap.rotation.setFromQuaternion(quaternion);
          startCap.rotateX(Math.PI / 2); // Rotate to face the cylinder direction
          scene.add(startCap);
          meshesRef.current.push(startCap); // Add to scene or group
        }

        if (
          i === data.length - 1 ||
          segment.lineIDx !== data[i + 1].lineIDx ||
          segment.color !== data[i + 1].color
        ) {
          const endCap = new THREE.Mesh(
            new THREE.CircleGeometry(radius, tubeRes), // Adjust radius and segments as needed
            new THREE.MeshStandardMaterial({
              color: tubeColor ? tubeColor : segment.color,
              opacity: o === -1 ? opacity : o,
              transparent: true,
              side: THREE.DoubleSide,
            }) // Adjust material properties
          );
          endCap.position.copy(endPoint);
          endCap.rotation.setFromQuaternion(quaternion);
          endCap.rotateX(-Math.PI / 2); // Rotate to face the cylinder direction
          scene.add(endCap);
          meshesRef.current.push(endCap); // Add to scene or group
        }
      });
    }
  };

  const renderCylinders = (data, o = -1, tubeColor = null) => {
    const material = new THREE.MeshPhongMaterial({
      transparent: true,
      opacity: o === -1 ? opacity : o,
    });

    const tubeGeometry = new THREE.CylinderGeometry(
      radius,
      radius,
      cylinderHeight,
      tubeRes,
      1,
      true
    );

    const tubeMesh = new THREE.InstancedMesh(
      tubeGeometry,
      material,
      data.length
    );

    const dummy = new THREE.Object3D();

    data.forEach((segment, i) => {
      const startPoint = new THREE.Vector3(...segment.startPoint);
      const endPoint = new THREE.Vector3(...segment.endPoint);

      const direction = new THREE.Vector3().subVectors(endPoint, startPoint);

      // Axis and angle for the cylinder orientation
      const axis = new THREE.Vector3(0, 1, 0).cross(direction).normalize();
      const angle = Math.acos(
        new THREE.Vector3(0, 1, 0).dot(direction.normalize())
      );

      // Set cylinder mesh position and orientation
      dummy.position.set(...segment.midPoint);
      const quaternion = new THREE.Quaternion().setFromAxisAngle(axis, angle);
      dummy.setRotationFromQuaternion(quaternion);

      const distance = new THREE.Vector3()
        .subVectors(startPoint, endPoint)
        .length();
      dummy.scale.set(1, distance, 1);
      dummy.updateMatrix();
      tubeMesh.setMatrixAt(i, dummy.matrix);

      // Update the color of the cylinder
      tubeMesh.setColorAt(
        i,
        new THREE.Color(tubeColor ? tubeColor : segment.color)
      );
    });

    tubeMesh.instanceMatrix.needsUpdate = true;
    tubeMesh.instanceColor.needsUpdate = true;
    scene.add(tubeMesh);
    meshesRef.current.push(tubeMesh);

    if (showCaps) {
      data.forEach((segment, i) => {
        const startPoint = new THREE.Vector3(...segment.startPoint);
        const endPoint = new THREE.Vector3(...segment.endPoint);

        const direction = new THREE.Vector3().subVectors(endPoint, startPoint);

        // Axis and angle for the cylinder orientation
        const axis = new THREE.Vector3(0, 1, 0).cross(direction).normalize();
        const angle = Math.acos(
          new THREE.Vector3(0, 1, 0).dot(direction.normalize())
        );

        // Set cylinder mesh position and orientation
        const quaternion = new THREE.Quaternion().setFromAxisAngle(axis, angle);

        if (i === 0 || segment.lineIDx !== data[i - 1].lineIDx) {
          const startCap = new THREE.Mesh(
            new THREE.CircleGeometry(radius, tubeRes), // Adjust radius and segments as needed
            new THREE.MeshStandardMaterial({
              color: tubeColor ? tubeColor : segment.color,
              opacity: o === -1 ? opacity : o,
              transparent: true,
              side: THREE.DoubleSide,
            }) // Adjust material properties
          );
          startCap.position.copy(startPoint);
          startCap.rotation.setFromQuaternion(quaternion);
          startCap.rotateX(Math.PI / 2); // Rotate to face the cylinder direction
          scene.add(startCap);
          meshesRef.current.push(startCap); // Add to scene or group
        }

        if (i === data.length - 1 || segment.lineIDx !== data[i + 1].lineIDx) {
          const endCap = new THREE.Mesh(
            new THREE.CircleGeometry(radius, tubeRes), // Adjust radius and segments as needed
            new THREE.MeshStandardMaterial({
              color: tubeColor ? tubeColor : segment.color,
              opacity: o === -1 ? opacity : o,
              transparent: true,
              side: THREE.DoubleSide,
            }) // Adjust material properties
          );
          endCap.position.copy(endPoint);
          endCap.rotation.setFromQuaternion(quaternion);
          endCap.rotateX(-Math.PI / 2); // Rotate to face the cylinder direction
          scene.add(endCap);
          meshesRef.current.push(endCap); // Add to scene or group
        }
      });
    }
  };

  const renderLines = (data, o = -1, lineColor = null, background = false) => {
    const groupedSegments = [];
    let currGroup = [];

    for (let i = 0; i < data.length; i++) {
      const segment = data[i];
      if (
        i > 0 &&
        (segment.lineIDx !== data[i - 1].lineIDx ||
          (segment.color && segment.color !== data[i - 1].color))
      ) {
        groupedSegments.push(currGroup);
        currGroup = [segment];
      } else {
        currGroup.push(segment);
      }
    }

    groupedSegments.push(currGroup);

    groupedSegments.forEach((group) => {
      const points = [];

      group.forEach((segment, index) => {
        if (index === 0) points.push(new THREE.Vector3(...segment.startPoint));
        points.push(new THREE.Vector3(...segment.endPoint));
      });

      if (points.length < 2) return;

      const geometry = new THREE.BufferGeometry().setFromPoints(points);

      const material = new THREE.LineBasicMaterial({
        color: lineColor ? lineColor : group[0].color,
        transparent: true,
        opacity: o === -1 ? opacity : o,
      });

      const line = new THREE.Line(geometry, material);
      scene.add(line);
      if (background) backgroundLinesRef.current.push(line);
      else meshesRef.current.push(line);
    });
  };

  return (
    <>
      <ambientLight intensity={0.5} />
      <DirectionalLightWithCamera intensity={intensity} />
      <TrackballControls makeDefault />
    </>
  );
};

export default LineSegmentsRenderer;
