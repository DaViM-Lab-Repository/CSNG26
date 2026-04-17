const knnSlope = 0.00229810266;
const knnIntercept = 160.3107009;

export default function NearestNeighborRuntime(numSegments, numNeighbors) {
  return numSegments * numNeighbors * knnSlope + knnIntercept;
}
