import React from 'react';
import * as vega from 'vega';
import ScatterPlotSpec from './vega_specification/ScatterPlot.json';
import { useEffect,} from 'react';

/**
 * `ScatterPlot` is a component that uses the Vega library to render a single streamline in scatter plot.
 * It takes in data, scales, dimensions, and extreme values to visualize the scatter plot with specified settings.
 * 
 * @component
 * @param {Array} inputData - Array of data points to visualize in the scatter plot.
 * @param {string} xscale - The scale for the x-axis.
 * @param {string} yscale - The scale for the y-axis.
 * @param {Object} size - The dimensions of the scatter plot with `width` and `height` properties.
 * @param {Array} extremeValues - Array of extreme values to define the scale of the chart. Expected format: [minX, maxX, minY, maxY].
 */
function ScatterPlot(props) {
  
  const viewRef = React.useRef(null);

  let data = props.inputData;
  const spec = ScatterPlotSpec;

    useEffect(() => {
      console.log("scatterplot component gets call");
      if (viewRef.current) {
        const view = new vega.View(vega.parse(spec), {
          renderer: "canvas",
          container: viewRef.current,
          hover: true,
        }).insert("Data", data);
        view.signal('xAxis',props.xscale);
        view.signal('yAxis',props.yscale);
        view.signal("width",props.size.width);
        view.signal('height',120);
        view.signal("minX",props.extremeValues[0]);  /* "ExtremeValues" store scale of the chart */
        view.signal("maxX",props.extremeValues[1]);
        view.signal("minY",props.extremeValues[2]);
        view.signal("maxY",props.extremeValues[3]);
        view.signal("graphSize",[120,props.size.width-80]);
        view.signal("classification","c");
        view.run();
        view.addSignalListener('highlightColorArray', function(name, value) {
          // const hexColor = ensureHex(value.stroke);
          if(!(Object.keys(value[0]).length === 0 && value[0].constructor === Object)){
            const selected = [];
            for(let segment of props.segments){
              if(segment.lineIDx == value[0].c){
                segment.color = value[1].stroke;
                selected.push(segment);
              }
              if(segment.lineIDx == props.queryStreamlineIndex){
                segment.color = "red";
                selected.push(segment);
              }
            }
            props.setSegmentsSelected(selected);
          }else{
            props.setSegmentsSelected([]);
          }
        });
      }
    }, [props.size.width, props.size.height,props.xscale, props.yscale, data, spec]);

  return (
    <div ref={viewRef}></div>
  );
}

export default ScatterPlot;
