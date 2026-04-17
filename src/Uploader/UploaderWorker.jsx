import { GPU } from "gpu.js";
const gpu = new GPU();

const computePairwiseDistances = (segments, streamlines) => {
  const points = segments.map((segment) => segment.midPoint);
  const kernelBody = `
let totalDistance = 0.0;
let count = 0.0;
const x = this.thread.x;
const y = this.thread.y;

for (let i = streamlines[x][0]; i < streamlines[x][1]; i++) {
  for (let j = streamlines[y][0]; j < streamlines[y][1]; j++) {
    totalDistance += Math.sqrt(
      Math.pow(points[i][0] - points[j][0], 2) +
      Math.pow(points[i][1] - points[j][1], 2) +
      Math.pow(points[i][2] - points[j][2], 2)
    );
    count += 1.0;
  }
}

return count > 0.0 ? totalDistance / count : 0.0;`;

  const kernelFunction = new Function("points", "streamlines", kernelBody);

  const kernel = gpu
    .createKernel(kernelFunction)
    .setOutput([streamlines.length, streamlines.length]);

  return kernel(points, streamlines);
};

const rearrangeStreamlinesKNN = (
  streamlines,
  distances,
  flag,
  k,
  memorySize = 10
) => {
  // Compute KNN distances
  let knnDistances = streamlines.map((_, idx) => {
    let dists = distances[idx].map((d, i) => ({ index: i, distance: d }));
    dists.sort((a, b) => a.distance - b.distance);
    return dists.slice(1, k + 1).reduce((sum, d) => sum + d.distance, 0);
  });

  // Pair streamlines with their KNN distances
  let pairedStreamlines = streamlines.map((s, idx) => ({
    streamline: s,
    distanceSum: knnDistances[idx],
  }));

  if (flag) {
    // Sort by ascending order for flag = true
    pairedStreamlines.sort((a, b) => a.distanceSum - b.distanceSum);
  } else {
    let remainingStreamlines = new Set(streamlines.map((_, idx) => idx));
    let arrangedStreamlines = [];
    let recentSelections = []; // Memory of recent selections

    // Start with a randomly selected streamline for more variety
    let currentIdx =
      Array.from(remainingStreamlines)[
        Math.floor(Math.random() * remainingStreamlines.size)
      ];
    arrangedStreamlines.push(streamlines[currentIdx]);
    recentSelections.push(currentIdx);
    remainingStreamlines.delete(currentIdx);

    while (remainingStreamlines.size > 0) {
      let candidates = [];

      remainingStreamlines.forEach((idx) => {
        if (!recentSelections.includes(idx)) {
          candidates.push({
            index: idx,
            distance: distances[currentIdx][idx],
          });
        }
      });

      candidates.sort((a, b) => b.distance - a.distance);

      let selectIndex = Math.min(
        candidates.length - 1,
        Math.floor(Math.random() * Math.min(memorySize, candidates.length))
      );
      let selected = candidates[selectIndex];

      arrangedStreamlines.push(streamlines[selected.index]);
      currentIdx = selected.index;
      recentSelections.push(currentIdx);
      if (recentSelections.length > memorySize) {
        recentSelections.shift();
      }
      remainingStreamlines.delete(currentIdx);
    }

    return arrangedStreamlines;
  }

  return pairedStreamlines.map((p) => p.streamline);
};

self.addEventListener("message", (e) => {
  const { file, skipLines, skipSegments } = e.data;

  let startTime, endTime;

  startTime = performance.now();

  const reader = new FileReader();
  let segments = [];
  reader.readAsText(file);
  reader.onload = (event) => {
    let globalIdx = 0,
      lineIDx = 0;
    const text = event.target.result;
    const streamlines = [];
    let endIDx = 0;
    let lineSkipCount = 0;
    let lastProgress = 0;

    let linesArray = text.trim().split("\n");

    let totalLines = linesArray.length;
    linesArray = linesArray.map((line, i) => {
      lineSkipCount++;
      if (lineSkipCount > 1 && lineSkipCount % skipLines === 0) {
        return [];
      }
      const coords = line.trim().split(" ").map(parseFloat);
      const streamline = [endIDx];
      const points = [];
      let ss = 1;
      if (skipSegments > 1) ss = skipSegments;
      for (let i = 0; i < coords.length; i += 4 * ss) {
        let start = [coords[i], coords[i + 1], coords[i + 2]];
        let end = [
          coords[i + 4 * ss],
          coords[i + 4 * ss + 1],
          coords[i + 4 * ss + 2],
        ];
        let midpoint = [
          (start[0] + end[0]) / 2,
          (start[1] + end[1]) / 2,
          (start[2] + end[2]) / 2,
        ];
        if (
          !(
            start.every((num) => !isNaN(num)) && end.every((num) => !isNaN(num))
          )
        )
          continue;

        segments.push({
          startPoint: start,
          endPoint: end,
          midPoint: midpoint,
          lineIDx: lineIDx,
          globalIdx: globalIdx,
          neighbors: [],
        });
        points.push(start);
        points.push(end);

        globalIdx++;
        endIDx = globalIdx;
      }
      streamline.push(endIDx);
      streamlines.push(streamline);
      endIDx++;
      lineIDx++;

      const progress = Math.floor((i / totalLines) * 100);
      if (progress % 10 === 0 && progress !== lastProgress) {
        lastProgress = progress;
        self.postMessage({
          type: "progress",
          progress: progress,
        });
      }

      return [points];
    });

    linesArray = linesArray.filter((l) => l.length > 0);

    endTime = performance.now();
    console.log(
      "Data Processing Time:",
      (endTime - startTime).toFixed(2),
      "ms"
    );

    self.postMessage({
      type: "finished",
      segments: segments,
      streamlines: streamlines,
      linesArray: linesArray,
    });
  };
});
