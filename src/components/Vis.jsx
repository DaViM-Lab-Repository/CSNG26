import React, {useRef , useEffect}  from 'react';
import './styles1.css';
import data from './sep1.json';
import Content from './Content';
import CheckBoxControlBar from './CheckBox_ControlBar';
import {getQueryStreamlineIndex,removeZeroValuesAndEmptyObjects,findMinimums,classifyData,transformArray } from './dataProcessing/dataProcess'; 

/**
 * `Vis` component displays visual controls and data-driven content.
 * It offers controls to toggle representations and select/unselect all streamlines.
 * 
 * @component
 * @param {Object} graphData - Query streamline and its neighoring streamline data.
 * @param {Function} setSegmentsSelected - Callback to update selected segments.
 * @param {Array} segments - Array of segments data.
 *
 * @example
 * const graphData = {...};
 * const segments = [...];
 * const setSegmentsSelected = (segments) => {...};
 * 
 * return (
 *   <Vis graphData={graphData} setSegmentsSelected={setSegmentsSelected} segments={segments} />
 * )
 */
function Vis({graphData,setSegmentsSelected, segments}){
  const contentRef = useRef(null);
  const [inputData, setInputData] = React.useState([]);
  const [showDerivative, setShowDerivative] = React.useState(false);
  const [showGradient, setShowGradient] = React.useState(false);
  const [unselectAll, setunselectAll] = React.useState(false);
  // const useEffect = 
  const queryStreamlineIndex = getQueryStreamlineIndex(graphData);

  useEffect(()=>{
    console.log("Received Graph Data: ", graphData);
    console.log(getQueryStreamlineIndex(graphData));
    if(graphData)
      setInputData(transformArray(classifyData(findMinimums(removeZeroValuesAndEmptyObjects(graphData)))));
  },[graphData])

  const toggleDerivative = () => {
    setShowDerivative(prevState => !prevState);
  };

  const toggleGradient = () => {
    setShowGradient(prevState => !prevState);
  };

  const toggleUnselectAll = () => {
    const targetBoolean = !unselectAll;
    setunselectAll(targetBoolean);

    const updatedData = inputData.map(item => {
        if (item[3] !== undefined) {
            item[3] = targetBoolean;
        }
        return item;
    });

    setInputData(updatedData);
};

  return (

      <div className="container">
        
        <div className="content" id="content" ref={contentRef}>
          <CheckBoxControlBar checked={showDerivative} onChange={toggleDerivative} label="Toggle to the representation of derivative" />
          <CheckBoxControlBar checked={showGradient} onChange={toggleGradient} label="Toggle to the representation of gradient" />
          <CheckBoxControlBar checked={unselectAll} onChange={toggleUnselectAll} label="Select / Unselect All" />
          {inputData && inputData.length > 0 ? <Content inputData={inputData} setInputData={setInputData} contentRef={contentRef} showDerivative={showDerivative} showGradient={showGradient} segments={segments} setSegmentsSelected={setSegmentsSelected} queryStreamlineIndex={queryStreamlineIndex}/> : null}
        </div>

      </div>

  )

  
}

export default Vis;

