let currentBrush = "marker";
let hasDrawn = false;
let currentColor = "#6BB9A4";
let activeDropdown = null;
let strokes = [];
let currentStroke = [];
//make a queue of strokes
let strokeQueue = [];
// Spray brush fix variables
let sprayStartX = 0;
let sprayStartY = 0;
let hasSprayMoved = false;
let minMovementDistance = 3;

function selectMainColor(color, swatchId) {
  // Close any open dropdown first
  if (activeDropdown && activeDropdown !== swatchId) {
    document
      .getElementById("dropdown" + activeDropdown.slice(-1))
      .classList.remove("show");
  }

  currentColor = color;

  // Update selected state
  document.querySelectorAll(".main-color-swatch").forEach((swatch) => {
    swatch.classList.remove("selected");
  });
  document.getElementById(swatchId).classList.add("selected");

  // Toggle dropdown
  const dropdownId = "dropdown" + swatchId.slice(-1);
  const dropdown = document.getElementById(dropdownId);

  if (activeDropdown === swatchId) {
    dropdown.classList.remove("show");
    activeDropdown = null;
  } else {
    // Close other dropdowns
    document.querySelectorAll(".dropdown-content").forEach((dd) => {
      dd.classList.remove("show");
    });
    dropdown.classList.add("show");
    activeDropdown = swatchId;
  }
}

function selectColor(color, mainSwatchId) {
  currentColor = color;

  // Update main swatch color
  document.getElementById(mainSwatchId).style.backgroundColor = color;

  // Update selected state
  document.querySelectorAll(".main-color-swatch").forEach((swatch) => {
    swatch.classList.remove("selected");
  });
  document.getElementById(mainSwatchId).classList.add("selected");

  // Close dropdown
  const dropdownId = "dropdown" + mainSwatchId.slice(-1);
  document.getElementById(dropdownId).classList.remove("show");
  activeDropdown = null;
}

// Close dropdown when clicking outside
document.addEventListener("click", function (event) {
  if (!event.target.closest(".color-dropdown")) {
    document.querySelectorAll(".dropdown-content").forEach((dropdown) => {
      dropdown.classList.remove("show");
    });
    activeDropdown = null;
  }
});

function setBrush(brushType) {
  currentBrush = brushType;

  // Update active button
  document.querySelectorAll(".brush-btn").forEach((btn) => {
    btn.classList.remove("active");
  });
  document.querySelector(`.brush-btn.${brushType}`).classList.add("active");
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

function clearCanvas() {
  hasDrawn = false;
  document.getElementById("canvasWrapper").classList.remove("drawing");
  clear();
  background("#fbf8f3");
  //clear the strokes
  strokes = [];
  currentStroke = [];
}

function saveCanvas() {
  const now = new Date();
  const timestamp =
    now.getFullYear() +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0") +
    "_" +
    String(now.getHours()).padStart(2, "0") +
    String(now.getMinutes()).padStart(2, "0") +
    String(now.getSeconds()).padStart(2, "0");

  const filename = `drawing_${timestamp}`;
  save(filename + ".png");
}

function extractStrokes() {
  console.log("Extracting strokes...", strokes);
  // Convert strokes to the expected format
  let processedStrokes = [];

  for (let stroke of strokes) {
    if (stroke.points && stroke.points.length > 0) {
      // Extract x and y coordinates from points
      let xCoords = stroke.points.map((point) => point.x);
      let yCoords = stroke.points.map((point) => point.y);

      processedStrokes.push({
        brush: stroke.brush,
        color: stroke.color,
        stroke: {
          x: xCoords,
          y: yCoords,
        },
      });
    }
  }

  const strokeData = {
    strokes: processedStrokes,
    metadata: {
      totalStrokes: processedStrokes.length,
      canvasSize: { width: width, height: height },
      timestamp: new Date().toISOString(),
    },
  };

  saveJSON(strokeData, "strokes.json");
  console.log("Strokes saved:", strokeData);
}

function setup() {
  let canvas = createCanvas(850, 500);
  canvas.parent("p5-canvas");
  background("#fbf8f3");
  strokeCap(ROUND);

  // Set initial brush to marker
  setBrush("marker");
}

function mousePressed() {
  // Start a new stroke when mouse is pressed
  if (mouseX > 0 && mouseX < width && mouseY > 0 && mouseY < height) {
    currentStroke = [];
    currentStroke.push({
      x: mouseX,
      y: mouseY,
      color: currentColor,
      brush: currentBrush,
    });
    strokeQueue.push({
      x: mouseX,
      y: mouseY,
      color: currentColor,
      brush: currentBrush,
    });
    // Reset spray tracking when mouse is pressed
    if (currentBrush === "spray") {
      sprayStartX = mouseX;
      sprayStartY = mouseY;
      hasSprayMoved = false;
    }

    if (!hasDrawn) {
      hasDrawn = true;
      document.getElementById("canvasWrapper").classList.add("drawing");
    }
  }
}

function mouseDragged() {
  // Continue the current stroke when mouse is dragged
  if (mouseX > 0 && mouseX < width && mouseY > 0 && mouseY < height) {
    currentStroke.push({
      x: mouseX,
      y: mouseY,
      color: currentColor,
      brush: currentBrush,
    });
    strokeQueue.push({
      x: mouseX,
      y: mouseY,
      color: currentColor,
      brush: currentBrush,
    });
    // execute a stroke from the queue if exists
    if (strokeQueue.length > 1) {
      executeStroke();
    }
  }
}

function mouseReleased() {
  // Finalize the stroke when mouse is released
  if (currentStroke.length > 0) {
    strokes.push({
      brush: currentBrush,
      color: currentColor,
      points: currentStroke,
    });
    console.log("Stroke completed:", strokes[strokes.length - 1]);
  }
  if (strokeQueue.length > 1) executeStroke();
  currentStroke = [];
  strokeQueue = [];
}

function executeStroke() {
  // Need at least 2 points to draw a stroke
  if (strokeQueue.length < 2) {
    return;
  }

  // Get start and end points from front of queue
  const startPoint = strokeQueue.shift(); // Remove and get first point
  const endPoint = strokeQueue[0]; // Get second point (now first)

  // Get brush parameters
  const best_params = {
    fountain: [28, 70],
    marker: [8, 20],
    spray: [20, 50],
    wiggle: [8, 20],
    crayon: [8, 20],
  };
  const step_length = best_params[startPoint.brush][0];
  const step_duration = best_params[startPoint.brush][1];

  // Calculate distance between points
  const distance = Math.sqrt(
    Math.pow(endPoint.x - startPoint.x, 2) +
      Math.pow(endPoint.y - startPoint.y, 2)
  );

  // Calculate steps needed
  const steps_per_segment = Math.max(1, Math.floor(distance / step_length));

  // Execute continuous stroke with interpolation
  for (let s = 0; s <= steps_per_segment; s++) {
    const t = s / steps_per_segment;
    const interpX = lerp(startPoint.x, endPoint.x, t);
    const interpY = lerp(startPoint.y, endPoint.y, t);
    pmouseX = s === 0 ? startPoint.x : mouseX;
    pmouseY = s === 0 ? startPoint.y : mouseY;
    mouseX = interpX;
    mouseY = interpY;

    // Call brush function if there is movement
    if (mouseX !== pmouseX || mouseY !== pmouseY) {
      switch (startPoint.brush) {
        case "marker":
          marker();
          break;
        case "crayon":
          crayon();
          break;
        case "wiggle":
          wiggle();
          break;
        case "spray":
          spray();
          break;
        case "fountain":
          fountain();
          break;
      }
    }
  }
}

function draw() {
  // The draw function is now mainly for continuous drawing effects if needed
  // Most drawing logic has been moved to mouseDragged()
}

function marker() {
  const color = hexToRgb(currentColor);
  fill(color.r, color.g, color.b, 40);
  noStroke();
  circle(mouseX, mouseY, 50);
}

function crayon() {
  const color = hexToRgb(currentColor);
  const baseColor = [color.r, color.g, color.b];

  fill(baseColor[0], baseColor[1], baseColor[2], 200);
  noStroke();

  const distance = dist(mouseX, mouseY, pmouseX, pmouseY);
  const steps = Math.max(1, Math.floor(distance / 3));

  for (let i = 0; i <= steps; i++) {
    const x = lerp(pmouseX, mouseX, i / steps);
    const y = lerp(pmouseY, mouseY, i / steps);

    circle(x, y, 12);

    for (let j = 0; j < 8; j++) {
      const textureX = x + random(-10, 10);
      const textureY = y + random(-10, 10);
      fill(baseColor[0], baseColor[1], baseColor[2], 100);
      circle(textureX, textureY, 6);
    }

    for (let k = 0; k < 4; k++) {
      const textureX2 = x + random(-15, 15);
      const textureY2 = y + random(-15, 15);
      fill(baseColor[0], baseColor[1], baseColor[2], 50);
      circle(textureX2, textureY2, 3);
    }
  }
}

let wiggle_flip = 0;
function wiggle() {
  const color = hexToRgb(currentColor);
  stroke(color.r, color.g, color.b, 255);
  strokeWeight(3);
  noFill();

  const distance = dist(mouseX, mouseY, pmouseX, pmouseY);
  const midX = (mouseX + pmouseX) / 2;
  const midY = (mouseY + pmouseY) / 2;

  const angle = Math.atan2(mouseY - pmouseY, mouseX - pmouseX);
  const flip = wiggle_flip * PI;
  wiggle_flip = 1 - wiggle_flip;

  arc(midX, midY, distance, distance, angle + flip, angle + PI + flip);
}

function spray() {
  // Check if mouse has moved enough to start spraying
  if (!hasSprayMoved) {
    let distance = dist(mouseX, mouseY, sprayStartX, sprayStartY);
    if (distance < minMovementDistance) {
      return; // Don't spray until mouse has moved enough
    }
    hasSprayMoved = true;
  }

  // Only spray when mouse is moving, not when held stationary
  if (mouseX === pmouseX && mouseY === pmouseY) {
    return;
  }

  // Spray is always black
  stroke(0, 0, 0, 255);
  strokeWeight(1);

  const speed = abs(mouseX - pmouseX) + abs(mouseY - pmouseY);
  const minRadius = 8;
  const sprayDensity = Math.min(20, Math.max(5, speed * 2)); // Density based on movement speed
  const r = speed + minRadius;
  const rSquared = r * r;

  // Only spray along the movement path, not repeatedly at same position
  const distance = dist(mouseX, mouseY, pmouseX, pmouseY);
  const lerps = Math.max(1, Math.floor(distance / 3)); // Fewer interpolation points

  for (let i = 0; i < lerps; i++) {
    const lerpX = lerp(pmouseX, mouseX, i / lerps);
    const lerpY = lerp(pmouseY, mouseY, i / lerps);

    for (let j = 0; j < sprayDensity; j++) {
      const randX = random(-r, r);
      const randY = random(-1, 1) * sqrt(rSquared - randX * randX);
      point(lerpX + randX, lerpY + randY);
    }
  }
}

function fountain() {
  // Fountain is always black
  stroke(0, 0, 0, 255);
  strokeWeight(1);
  const width = 4;
  const lerps = 12;

  for (let i = 0; i < lerps; i++) {
    const x = lerp(mouseX, pmouseX, i / lerps);
    const y = lerp(mouseY, pmouseY, i / lerps);
    line(x - width, y - width, x + width, y + width);
  }
}

function windowResized() {
  const container = document.querySelector(".canvas-wrapper");
  const containerWidth = container.offsetWidth - 50;
  const containerHeight = Math.min(500, window.innerHeight * 0.6);

  resizeCanvas(Math.min(850, containerWidth), containerHeight);
  background("#fbf8f3");
}
