export function createGestureController({ THREE, video, startButton, onStatus }) {
  const state = {
    openAmount: 0.68,
    pinchAmount: 0.32,
    isOK: false,
    isV: false,
    stableGesture: "none",
    leftHand: null,
    rightHand: null,
    zoomIntent: "none",
    handReady: false
  };

  let handLandmarker = null;
  let lastVideoTime = -1;
  let smoothPinchDistance = 0.13;
  let zoomCandidate = "none";
  let zoomCandidateStart = 0;
  let lastZoomGesture = "none";

  window.addEventListener("pointermove", (event) => {
    if (state.handReady) return;
    const x = event.clientX / window.innerWidth;
    state.openAmount = THREE.MathUtils.clamp(x, 0.06, 0.98);
    state.pinchAmount = 1 - state.openAmount;
    onStatus?.("mouse fallback");
  });

  async function start() {
    try {
      startButton.textContent = "正在加载...";
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      video.srcObject = stream;
      await video.play();
      document.body.classList.add("camera-on");

      const vision = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs");
      const fileset = await vision.FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
      );

      handLandmarker = await vision.HandLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
          delegate: "GPU"
        },
        runningMode: "VIDEO",
        numHands: 2
      });

      state.handReady = true;
      startButton.style.display = "none";
      onStatus?.("hand tracking ready");
    } catch (error) {
      console.error(error);
      startButton.textContent = "摄像头不可用";
      onStatus?.("mouse fallback");
    }
  }

  startButton.addEventListener("click", start);

  function update() {
    state.zoomIntent = "none";
    state.isOK = false;
    state.isV = false;

    if (!state.handReady || !handLandmarker || video.readyState < 2) return state;
    if (video.currentTime === lastVideoTime) return state;
    lastVideoTime = video.currentTime;

    const now = performance.now();
    const result = handLandmarker.detectForVideo(video, now);
    const hands = result.landmarks || [];
    if (hands.length === 0) {
      state.stableGesture = "none";
      onStatus?.("no hand");
      return state;
    }

    state.leftHand = hands[0] || null;
    state.rightHand = hands[1] || null;

    const hand = hands[0];
    const thumb = hand[4];
    const index = hand[8];
    const pinchDistance = landmarkDistance(thumb, index);
    const zoomGesture = classifyZoomGesture(hand);

    state.isOK = zoomGesture === "OK";
    state.isV = zoomGesture === "V";

    smoothPinchDistance += (pinchDistance - smoothPinchDistance) * 0.25;

    if (zoomGesture === "none") {
      const open = THREE.MathUtils.smoothstep(smoothPinchDistance, 0.035, 0.22);
      state.openAmount = THREE.MathUtils.clamp(open, 0.06, 0.98);
      state.pinchAmount = 1 - state.openAmount;
    }

    applyStableZoomGesture(zoomGesture, now);
    state.stableGesture = zoomGesture;
    onStatus?.(statusText(state));
    return state;
  }

  function applyStableZoomGesture(gesture, now) {
    if (gesture !== zoomCandidate) {
      zoomCandidate = gesture;
      zoomCandidateStart = now;
    }

    if (gesture === "none") {
      lastZoomGesture = "none";
      return;
    }

    if (now - zoomCandidateStart < 550) return;
    if (gesture === lastZoomGesture) return;

    state.zoomIntent = gesture === "OK" ? "in" : "out";
    lastZoomGesture = gesture;
  }

  return { state, update };
}

function statusText(state) {
  if (state.isOK) return "OK: zoom in";
  if (state.isV) return "V: zoom out";
  if (state.handReady) return `open: ${state.openAmount.toFixed(2)}`;
  return "standby";
}

function landmarkDistance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = (a.z || 0) - (b.z || 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function palmScale(hand) {
  return Math.max(landmarkDistance(hand[0], hand[9]), 0.0001);
}

function fingerExtended(hand, tip, pip, mcp) {
  const wrist = hand[0];
  const tipFartherThanPip = landmarkDistance(hand[tip], wrist) > landmarkDistance(hand[pip], wrist) * 1.1;
  const tipAbovePip = hand[tip].y < hand[pip].y - 0.01;
  const pipAboveMcp = mcp == null ? true : hand[pip].y < hand[mcp].y + 0.025;
  return tipFartherThanPip && tipAbovePip && pipAboveMcp;
}

function fingerFolded(hand, tip, pip, mcp) {
  const wrist = hand[0];
  const tipClose = landmarkDistance(hand[tip], wrist) < landmarkDistance(hand[mcp], wrist) * 1.28;
  const tipBelowPip = hand[tip].y > hand[pip].y - 0.005;
  return tipClose || tipBelowPip;
}

function classifyZoomGesture(hand) {
  const s = palmScale(hand);
  const thumbIndex = landmarkDistance(hand[4], hand[8]);
  const thumbMiddle = landmarkDistance(hand[4], hand[12]);
  const indexOpen = fingerExtended(hand, 8, 6, 5);
  const middleOpen = fingerExtended(hand, 12, 10, 9);
  const ringOpen = fingerExtended(hand, 16, 14, 13);
  const pinkyOpen = fingerExtended(hand, 20, 18, 17);
  const indexFolded = fingerFolded(hand, 8, 6, 5);
  const ringFolded = fingerFolded(hand, 16, 14, 13);
  const pinkyFolded = fingerFolded(hand, 20, 18, 17);

  const okGesture =
    thumbIndex < s * 0.26 &&
    thumbMiddle > s * 0.34 &&
    indexFolded &&
    middleOpen &&
    ringOpen &&
    pinkyOpen;

  if (okGesture) return "OK";

  const vGesture =
    thumbIndex > s * 0.44 &&
    indexOpen &&
    middleOpen &&
    ringFolded &&
    pinkyFolded;

  return vGesture ? "V" : "none";
}
