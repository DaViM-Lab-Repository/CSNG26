export class Segment {
  constructor(start, end, lineIDx, globalIdx, neighbors = [], color = "#CCCCCC", communityIndex = -1) {
    this.startPoint = new Float32Array(start);
    this.endPoint = new Float32Array(end);
    this.midPoint = new Float32Array([
      (start[0] + end[0]) / 2,
      (start[1] + end[1]) / 2,
      (start[2] + end[2]) / 2
    ]);
    this.lineIDx = lineIDx;
    this.globalIdx = globalIdx;
    this.neighbors = neighbors;
    this.color = color;
    this.communityIndex = communityIndex;
  }

  // Optimized to write directly to typed array
  writeToArray(array, offset) {
    array[offset] = this.startPoint[0];
    array[offset + 1] = this.startPoint[1];
    array[offset + 2] = this.startPoint[2];
    array[offset + 3] = this.endPoint[0];
    array[offset + 4] = this.endPoint[1];
    array[offset + 5] = this.endPoint[2];
    array[offset + 6] = this.midPoint[0];
    array[offset + 7] = this.midPoint[1];
    array[offset + 8] = this.midPoint[2];
    array[offset + 9] = this.lineIDx;
    array[offset + 10] = this.globalIdx;
    array[offset + 11] = this.neighbors;
    array[offset + 12] = this.color;
    array[offset + 13] = this.communityIndex;
  }
}

export const packSegments = (segments) => {
  const startTime = performance.now();
  const totalSegments = segments.length;
  const checkInterval = Math.max(1, Math.floor(totalSegments / 5)); // Log every 20%
  let lastReportedPercent = 0;

  // Pre-allocate the full array instead of growing it
  const result = new Array(totalSegments * 14);
  
  for (let i = 0; i < totalSegments; i++) {
    const offset = i * 14;
    segments[i].writeToArray(result, offset);
    
    // Progress logging every 20%
    if (i % checkInterval === 0) {
      const currentTime = performance.now();
      const elapsedTime = currentTime - startTime;
      const percentComplete = Math.floor((i / totalSegments) * 100);
      
      if (percentComplete >= lastReportedPercent + 20) {
        const timePerPercent = elapsedTime / percentComplete;
        const remainingPercent = 100 - percentComplete;
        const estimatedRemainingTime = timePerPercent * remainingPercent;
        
        console.log(
          `Packing progress: ${percentComplete}% complete. ` +
          `ETA: ${Math.round(estimatedRemainingTime / 1000)}s remaining`
        );
        
        lastReportedPercent = percentComplete;
      }
    }
  }

  const totalTime = performance.now() - startTime;
  console.log(`Packing completed in ${Math.round(totalTime / 1000)}s`);
  
  return result;
};

export const unpackSegments = (flatSegments) => {
  const startTime = performance.now();
  const totalSegments = flatSegments.length / 14;
  const checkInterval = Math.max(1, Math.floor(totalSegments / 5)); // Log every 20%
  let lastReportedPercent = 0;
  
  // Pre-allocate the array
  const segments = new Array(totalSegments);
  
  // Create reusable arrays for points to reduce allocations
  const startPoint = new Array(3);
  const endPoint = new Array(3);
  
  for (let i = 0; i < flatSegments.length; i += 14) {
    const segmentIndex = i / 14;
    
    // Progress logging every 20%
    if (segmentIndex % checkInterval === 0) {
      const currentTime = performance.now();
      const elapsedTime = currentTime - startTime;
      const percentComplete = Math.floor((segmentIndex / totalSegments) * 100);
      
      if (percentComplete >= lastReportedPercent + 20) {
        const timePerPercent = elapsedTime / percentComplete;
        const remainingPercent = 100 - percentComplete;
        const estimatedRemainingTime = timePerPercent * remainingPercent;
        
        console.log(
          `Unpacking progress: ${percentComplete}% complete. ` +
          `ETA: ${Math.round(estimatedRemainingTime / 1000)}s remaining`
        );
        
        lastReportedPercent = percentComplete;
      }
    }
    
    // Reuse arrays instead of creating new ones
    startPoint[0] = flatSegments[i];
    startPoint[1] = flatSegments[i + 1];
    startPoint[2] = flatSegments[i + 2];
    
    endPoint[0] = flatSegments[i + 3];
    endPoint[1] = flatSegments[i + 4];
    endPoint[2] = flatSegments[i + 5];
    
    segments[segmentIndex] = new Segment(
      startPoint,
      endPoint,
      flatSegments[i + 9],   // lineIDx
      flatSegments[i + 10],  // globalIdx
      flatSegments[i + 11],  // neighbors
      flatSegments[i + 12],  // color
      flatSegments[i + 13]   // communityIndex
    );
  }
  
  const totalTime = performance.now() - startTime;
  console.log(`Unpacking completed in ${Math.round(totalTime / 1000)}s`);
  
  return segments;
};
