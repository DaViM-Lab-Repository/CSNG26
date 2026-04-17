import React from 'react';
import * as vega from 'vega';
import ScatterPlotSpec from './vega_specification/ScatterPlot_overview.json';
import ScatterPlotSpec_Gradient from './vega_specification/Scatterplot_overview_gradient.json';
import { useEffect,} from 'react';

/**
 * `ScatterPlot_overview` is a component that renders an overview(multiple streamlines) scatter plot using the Vega library.
 * The component can either use a regular or gradient specification based on the `showGradient` prop.
 * It accepts data, scales, dimensions, extreme values, and other properties to tailor the visualization.
 *
 * @component
 * @param {Array} inputData - The array of data points to be visualized.
 * @param {string} xscale - Scale for the x-axis.
 * @param {string} yscale - Scale for the y-axis.
 * @param {Object} size - Object specifying the width and height of the scatter plot.
 * @param {Array} extremeValues - An array of extreme values defining the scale of the chart. Expected format: [minX, maxX, minY, maxY].
 * @param {boolean} showGradient - Flag indicating whether to use the gradient specification or the regular one.
 * @param {Array} segments - The array of segments.
 * @param {number} queryStreamlineIndex - The index for the streamline query.
 * @param {function} setSegmentsSelected - A function to set selected segments.
 */
function ScatterPlot_overview(props) {
  
  const viewRef = React.useRef(null);

  let data = props.inputData;
  if(data.length === 0) {      //if data is empty, To avoid renders black page, I chooses to render empty chart.
    data = [{"x":0, "y":0, "c":0}]
  }

  const spec = props.showGradient ? ScatterPlotSpec_Gradient : ScatterPlotSpec;
  function ensureHex(color) {
    if (color.startsWith('#')) return color;
    const result = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(color);
    if (result) {
      const r = parseInt(result[1]);
      const g = parseInt(result[2]);
      const b = parseInt(result[3]);
      return '#' + 
      (((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1).toUpperCase());

    }
    return color;
  }
    useEffect(() => {
      console.log("scatterplot overview component gets call",data);
      if (viewRef.current) {
        const view = new vega.View(vega.parse(spec), {
          renderer: "canvas",
          container: viewRef.current,
          hover: true,
        }).insert("Data", data);
        view.signal('xAxis',props.xscale);
        view.signal('yAxis',props.yscale);
        view.signal("width",props.size.width);
        view.signal('height',360);
        view.signal("minX",props.extremeValues[0]); /* "ExtremeValues" store scale of the chart */
        view.signal("maxX",props.extremeValues[1]);
        view.signal("minY",props.extremeValues[2]);
        view.signal("maxY",props.extremeValues[3]);
        view.signal("graphSize",[360,props.size.width-100]);
        view.signal("classification", props.showGradient ? "avg" : "c");
        view.run();
        // view.addSignalListener('highlight', function(name, value) {
        //   const selected = [];
        //   for(let segment of props.segments){
        //     if(segment.lineIDx == value.c){
        //       console.log("segment--->");
        //       segment.color = "black";
        //       selected.push(segment);
        //       //set segment color
        //     }
        //     if(segment.lineIDx == props.queryStreamlineIndex){
        //       segment.color = "red";
        //       selected.push(segment);
        //     }
        //     //copy paste, check if lindIDx is the same as the query streamlineID
        //   }
        //   props.setSegmentsSelected(selected);
        //   console.log(value.c);
        // });
        // view.addSignalListener('colorID', function(name, value) {
        //   const hexColor = ensureHex(value.stroke);
        //   console.log(name, hexColor);
        // });
        view.addSignalListener('highlightColorArray', function(name, value) {
          // const hexColor = ensureHex(value.stroke);
          if(!(Object.keys(value[0]).length === 0 && value[0].constructor === Object)){
            const selected = [];
            for(let segment of props.segments){
              if(segment.lineIDx == value[0].c){
                segment.color = ensureHex(value[1].stroke);
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

export default ScatterPlot_overview;
