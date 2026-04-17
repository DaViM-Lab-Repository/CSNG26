import React, { useEffect, useState } from 'react';
import { VegaLite } from 'react-vega';

const spec = {
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "description": "A simple bar chart with embedded data.",
  "data": {
    "values": [
      {"a": "A", "b": 28}, {"a": "B", "b": 55}, {"a": "C", "b": 43},
      {"a": "D", "b": 91}, {"a": "E", "b": 81}, {"a": "F", "b": 53},
      {"a": "G", "b": 19}, {"a": "H", "b": 87}, {"a": "I", "b": 52}
    ]
  },
  "mark": "bar",
  "encoding": {
    "x": {"field": "a", "type": "ordinal"},
    "y": {"field": "b", "type": "quantitative"}
  }
};

function BarChart(graphData,setSelectedSegment, segments) {
  const [inputValue, setInputValue] = useState(0);
  const [segments2,setSegments] = useState([])

  useEffect(()=>{
    setSegments(segments)
  },[segments])

  useEffect(()=>{
    console.log("Received Graph Data: ")
    console.log(graphData)
  },[graphData])


  return (
    <div>
      <input 
        value={inputValue} 
        onChange={(e) => setInputValue(e.target.value)}
      />
      <button onClick={()=>{
        
        let numbers = inputValue.split(',').map(Number);
        console.log(segments2)
        setSelectedSegment(segments.map(index => numbers[index]));
      }}>Select</button>
      <VegaLite spec={spec} />
    </div>
  );
}

export default BarChart;
