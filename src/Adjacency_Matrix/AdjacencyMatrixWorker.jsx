const fillBlackPixels = (canvases, pixelList, tileSize) => {
  const samec = "rgb(227, 227, 227)";
  pixelList.forEach((pixel) => {
    const x = pixel[0];
    const y = pixel[1];
    let color = pixel[2];
    if (color === 0) color = "red";
    else if (color === 1) color = samec;
    else color = "blue";

    const row = Math.floor(y / tileSize);
    const col = Math.floor(x / tileSize);
    const canvas = canvases[row][col];
    const context = canvas.getContext("2d");
    context.fillStyle = color;
    context.fillRect(x % tileSize, y % tileSize, 1, 1);
  });
};

const createWhiteImage = (width, height, tileSize, canvases) => {
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const canvas = canvases[i][j];
      canvas.width = tileSize;
      canvas.height = tileSize;
      const context = canvas.getContext("2d");
      context.fillStyle = "white";
      context.fillRect(0, 0, tileSize, tileSize);
    }
  }

  return canvases;
};

function drawRectangle(canvases, x, y, width, height, color, tileSize) {
  const startX = Math.floor(x / tileSize);
  const startY = Math.floor(y / tileSize);
  const endX = Math.floor((x + width - 1) / tileSize);
  const endY = Math.floor((y + height - 1) / tileSize);

  for (let i = startY; i <= endY; i++) {
    for (let j = startX; j <= endX; j++) {
      if (!canvases[i]) continue;
      const canvas = canvases[i][j];
      if (!canvas) continue;
      const ctx = canvas.getContext("2d");

      const localX = j === startX ? x % tileSize : 0;
      const localY = i === startY ? y % tileSize : 0;
      const localWidth =
        j === endX ? (x + width) % tileSize || tileSize : tileSize - localX;
      const localHeight =
        i === endY ? (y + height) % tileSize || tileSize : tileSize - localY;

      ctx.fillStyle = color;
      ctx.fillRect(localX, localY, localWidth, localHeight);
    }
  }
}

const setPixels = (segments, dGraphData, streamLines, canvases) => {
  const tileSize = 1000;
  const cols = Math.ceil(segments.length / tileSize);
  const newPixels = [];
  const canvas = createWhiteImage(
    segments.length,
    segments.length,
    tileSize,
    canvases
  );
  let rects = [];
  for (let i = 0; i < streamLines.length; i++) {
    for (let j = 0; j < streamLines.length; j++) {
      let sl1 = streamLines[i];
      let sl2 = streamLines[j];
      if ((i + j) % 2 === 0) {
        rects.push([sl1[0], sl2[0], sl1[1] - sl1[0], sl2[1] - sl2[0]]);
        drawRectangle(
          canvas,
          sl1[0],
          sl2[0],
          sl1[1] - sl1[0],
          sl2[1] - sl2[0],
          "#f7f7f7",
          tileSize
        );
      } else {
        drawRectangle(
          canvas,
          sl1[0],
          sl2[0],
          sl1[1] - sl1[0],
          sl2[1] - sl2[0],
          "white",
          tileSize
        );
        //0
      }
    }
  }

  for (let i = 0; i < segments.length; i++) {
    dGraphData[i].forEach((idx) => {
      newPixels.push([i, idx, 1]);
    });
  }

  fillBlackPixels(canvas, newPixels, tileSize);

  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < cols; j++) {
      const cv = canvas[i][j];
      const imageX = j * tileSize;
      const imageY = i * tileSize;
      canvas[i][j] = {
        width: tileSize,
        height: tileSize,
        x: imageX,
        y: imageY,
        url: cv.toDataURL(),
      };

      cv.width = 0;
      cv.height = 0;
    }
  }

  return canvas;
};

self.addEventListener("message", (event) => {
  console.log(event.data);
  if (event.data.functionType === "createCanvas")
    return self.postMessage({
      canvas: setPixels(
        event.data.segments,
        event.data.dGraphData,
        event.data.streamLines,
        event.data.canvases
      ),
      type: "final",
    });
});
