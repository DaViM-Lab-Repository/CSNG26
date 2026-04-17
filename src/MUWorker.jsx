function listIndicesInRange(a, b, c, d) {
  const indices = [];

  // First, find the range limits that cover both input ranges
  const minRange = Math.min(a, c);
  const maxRange = Math.max(b, d);

  // Iterate over the combined range
  for (let i = minRange; i <= maxRange; i++) {
    // Add the index to the list if it belongs to either of the input ranges
    if ((i > a && i < b) || (i > c && i < d)) {
      indices.push(i);
    }
  }

  return indices;
}

self.addEventListener('message', (event) => {
  //console.log('Worker started:');

    const { selectMode, aboveDiagonalColumnIndexes, belowDiagonalRowIndexes, selection, segments, graph, graph2, selectColor, filter} = event.data;
    let selected = [];
    const combined = (graph2.length > 0);

    let cquery = '#0394fc';
    if (selectColor == "two")
      cquery = '#d46b63'
    
    if (!combined){
      if (selectMode == "area"){

        // Do the calculations in the worker thread
        for (let i of aboveDiagonalColumnIndexes) {
          const neighbors = graph[i];
          neighbors.forEach(n => {
            if (n > selection.y && n < selection.y + selection.height) {
              segments[n].color = '#0394fc';
            }
          });
        }
      
        for (let i of belowDiagonalRowIndexes) {
          if (i < 0 || i > segments.length - 1) {
            continue;
          }
          const neighbors = graph[i];
          neighbors.forEach(n => {
            if (n > selection.x && n < selection.x + selection.width) {
              segments[n].color = '#0394fc';
            }
          });
        }
      
        for (let aboveIdx of aboveDiagonalColumnIndexes) {
          if (segments[aboveIdx].globalIdx !== aboveIdx) {
            //console.log(aboveIdx, segments[aboveIdx].globalIdx);
          }
          segments[aboveIdx].color = cquery;
        }
        for (let belowIdx of belowDiagonalRowIndexes) {
          segments[belowIdx].color = cquery;
        }
      
        const selectedRange = listIndicesInRange(selection.x, selection.x + selection.width, selection.y, selection.y + selection.height);
        selectedRange.forEach(n => {
          selected.push(segments[n]);
        });
      }
      if (selectMode == "col"){
        const selectMap = {};
        for (let i=selection.x;i <selection.x+selection.width;i++) {
          const neighbors = graph[i];
          neighbors.forEach(n => {
            if (n > selection.y && n < selection.y + selection.height) {
              segments[n].color = '#0394fc';
              selectMap[segments[n].globalIdx]=1;
            }
          });
        }

        for (let i=selection.x;i <selection.x+selection.width;i++) {
          segments[i].color = cquery;
          selectMap[segments[i].globalIdx]=1;
        }

        for (let i in selectMap){
          selected.push(segments[i]);
        }
      }

      if (selectMode == "row"){
        const selectMap = {};
        for (let i=selection.y;i <selection.y+selection.height;i++) {
          const neighbors = graph[i];
          neighbors.forEach(n => {
            if (n > selection.x && n < selection.x + selection.width) {
              segments[n].color = '#0394fc';
              selectMap[segments[n].globalIdx]=1;
            }
          });
        }

        for (let i=selection.y;i <selection.y+selection.height;i++) {
          segments[i].color = cquery;
          selectMap[segments[i].globalIdx]=1;
        }

        for (let i in selectMap){
          selected.push(segments[i]);
        }
      }
      ///////////////////////////
    }else{
      if (selectMode == "area"){

        // Do the calculations in the worker thread
        for (let i of aboveDiagonalColumnIndexes) {
          //const neighbors = graph[i];

          const e1 = graph[i];
          const e2 = graph2[i];

          const same = e1.filter(item => e2.includes(item));
          const diff1 = e1.filter(item => !e2.includes(item));
          const diff2 = e2.filter(item => !e1.includes(item));
          
          same.forEach(n => {
            if (n > selection.y && n < selection.y + selection.height) {
              segments[n].color = 'pink';
            }
          });

          diff1.forEach(n => {
            if (n > selection.y && n < selection.y + selection.height) {
              segments[n].color = 'red';
            }
          });

          diff2.forEach(n => {
            if (n > selection.y && n < selection.y + selection.height) {
              segments[n].color = '#0394fc';
            }
          });
        }
      
        for (let i of belowDiagonalRowIndexes) {
          if (i < 0 || i > segments.length - 1) {
            continue;
          }

          const e1 = graph[i];
          const e2 = graph2[i];

          const same = e1.filter(item => e2.includes(item));
          const diff1 = e1.filter(item => !e2.includes(item));
          const diff2 = e2.filter(item => !e1.includes(item));

          same.forEach(n => {
            if (n > selection.x && n < selection.x + selection.width) {
              segments[n].color = 'pink';
            }
          });

          diff1.forEach(n => {
            if (n > selection.x && n < selection.x + selection.width) {
              segments[n].color = 'red';
            }
          });

          diff2.forEach(n => {
            if (n > selection.x && n < selection.x + selection.width) {
              segments[n].color = '#0394fc';
            }
          });
          //const neighbors = graph[i];
          // neighbors.forEach(n => {
          //   if (n > selection.x && n < selection.x + selection.width) {
          //     segments[n].color = '#0394fc';
          //   }
          // });
        }
      
        for (let aboveIdx of aboveDiagonalColumnIndexes) {
          if (segments[aboveIdx].globalIdx !== aboveIdx) {
            //console.log(aboveIdx, segments[aboveIdx].globalIdx);
          }
          segments[aboveIdx].color = cquery;
        }
        for (let belowIdx of belowDiagonalRowIndexes) {
          segments[belowIdx].color = cquery;
        }
      
        const selectedRange = listIndicesInRange(selection.x, selection.x + selection.width, selection.y, selection.y + selection.height);
        selectedRange.forEach(n => {
          selected.push(segments[n]);
        });
      }
      if (selectMode == "col"){
        const selectMap = {};
        for (let i=selection.x;i <selection.x+selection.width;i++) {
          const e1 = graph[i];
          const e2 = graph2[i];

          const same = e1.filter(item => e2.includes(item));
          const diff1 = e1.filter(item => !e2.includes(item));
          const diff2 = e2.filter(item => !e1.includes(item));

          same.forEach(n => {
            if (n > selection.y && n < selection.y + selection.height) {
              segments[n].color = 'pink';
              selectMap[segments[n].globalIdx]=1;
            }
          });

          diff1.forEach(n => {
            if (n > selection.y && n < selection.y + selection.height) {
              segments[n].color = 'red';
              selectMap[segments[n].globalIdx]=1;
            }
          });

          diff2.forEach(n => {
            if (n > selection.y && n < selection.y + selection.height) {
              segments[n].color = '#0394fc';
              selectMap[segments[n].globalIdx]=1;
            }
          });

          // const neighbors = graph[i];
          // neighbors.forEach(n => {
          //   if (n > selection.y && n < selection.y + selection.height) {
          //     segments[n].color = '#0394fc';
          //     selectMap[segments[n].globalIdx]=1;
          //   }
          // });
        }

        for (let i=selection.x;i <selection.x+selection.width;i++) {
          segments[i].color = cquery;
          selectMap[segments[i].globalIdx]=1;
        }

        for (let i in selectMap){
          selected.push(segments[i]);
        }
      }

      if (selectMode == "row"){
        const selectMap = {};
        for (let i=selection.y;i <selection.y+selection.height;i++) {
          const e1 = graph[i];
          const e2 = graph2[i];

          const same = e1.filter(item => e2.includes(item));
          const diff1 = e1.filter(item => !e2.includes(item));
          const diff2 = e2.filter(item => !e1.includes(item));

          same.forEach(n => {
            if (n > selection.x && n < selection.x + selection.width) {
              segments[n].color = 'pink';
              selectMap[segments[n].globalIdx]=1;
            }
          });

          diff1.forEach(n => {
            if (n > selection.x && n < selection.x + selection.width) {
              segments[n].color = 'red';
              selectMap[segments[n].globalIdx]=1;
            }
          });

          diff2.forEach(n => {
            if (n > selection.x && n < selection.x + selection.width) {
              segments[n].color = '#0394fc';
              selectMap[segments[n].globalIdx]=1;
            }
          });

          // const neighbors = graph[i];
          // neighbors.forEach(n => {
          //   if (n > selection.x && n < selection.x + selection.width) {
          //     segments[n].color = '#0394fc';
          //     selectMap[segments[n].globalIdx]=1;
          //   }
          // });
        }

        for (let i=selection.y;i <selection.y+selection.height;i++) {
          segments[i].color = cquery;
          selectMap[segments[i].globalIdx]=1;
        }

        for (let i in selectMap){
          selected.push(segments[i]);
        }
      }
    }
    
    if (filter){
      console.log(filter)
      selected = selected.filter(seg => filter.includes(seg.globalIdx));
    }

    //console.log(selected);
    // Send the results back to the main thread
    self.postMessage({ selected });
  });