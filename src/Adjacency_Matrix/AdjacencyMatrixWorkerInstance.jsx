export const AdjacencyMatrixWorkerInstance = new Worker(
  new URL("./AdjacencyMatrixWorker.jsx", import.meta.url),
  { type: "module" }
);
