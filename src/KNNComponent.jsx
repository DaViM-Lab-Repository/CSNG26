import React, { useState, useEffect } from "react";
import { findKNearestNeighbors } from "./Nearest_Neighbor/knnHelper";

const KNNComponent = ({ segments, k }) => {
  const [knnResults, setKnnResults] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      const results = [];
      for (const querySegment of segments) {
        const knn = await findKNearestNeighbors(querySegment, segments, k);
        results.push({ querySegment, knn });
      }
      setKnnResults(results);
    };
    fetchData();
  }, [segments, k]);

  return (
    <div>
      <h2>k-Nearest Line Segments for Each Segment:</h2>
      {knnResults.map((result, index) => (
        <div key={index}>
          <h3>Query Segment:</h3>
          <pre>{JSON.stringify(result.querySegment, null, 2)}</pre>
          <h3>k-Nearest Line Segments:</h3>
          <pre>{JSON.stringify(result.knn, null, 2)}</pre>
        </div>
      ))}
    </div>
  );
};

export default KNNComponent;
