export const GraphCommunityWorkerInstance = new Worker(
  new URL("./GraphCommunityWorker.jsx", import.meta.url),
  { type: "module" }
);
