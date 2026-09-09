import { classifyHand, createGestureGate } from './gesture-science.js';

// Camera frames stay on-device. Start/stop tokens also cover late permission responses.
export function createGestureCamera({ video, onStatus, onGesture }) {
  let generation = 0;
  let stream;
  let detector;
  let timer;
  let lastVideoTime = -1;
  const gate = createGestureGate();
  function stop() {
    generation++;
    clearTimeout(timer);
    stream?.getTracks().forEach(track => track.stop());
    stream = null;
    video.pause();
    video.srcObject = null;
    detector?.close();
    detector = null;
    gate.reset();
    onGesture('none', 0);
  }
  async function start() {
    stop();
    const token = generation;
    onStatus('REQUESTING CAMERA');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('secure-context');
      const nextStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: {ideal:640}, height:{ideal:480} }, audio:false });
      if (generation !== token) { nextStream.getTracks().forEach(track=>track.stop()); return; }
      stream = nextStream;
      video.srcObject = stream;
      await video.play();
      if (generation !== token) return;
      onStatus('LOADING HAND TRACKING');
      const vision = await import('./vendor/vision/vision_bundle.mjs');
      const files = await vision.FilesetResolver.forVisionTasks(new URL('./vendor/vision/wasm', import.meta.url).href);
      if (generation !== token) return;
      const nextDetector = await vision.HandLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: new URL('./vendor/vision/hand_landmarker.task', import.meta.url).href, delegate:'CPU' },
        runningMode:'VIDEO', numHands:1, minHandDetectionConfidence:.65, minHandPresenceConfidence:.65, minTrackingConfidence:.65,
      });
      if (generation !== token) { nextDetector.close(); return; }
      detector = nextDetector;
      lastVideoTime = -1;
      let lastTime = performance.now();
      function frame() {
        if (token !== generation) return;
        const now = performance.now();
        const dt = Math.min((now - lastTime) / 1000, .15);
        lastTime = now;
        try {
          let gesture = 'none';
          if (!document.hidden && video.readyState >= 2 && video.currentTime !== lastVideoTime) {
            lastVideoTime = video.currentTime;
            const result = detector.detectForVideo(video, now);
            const raw = classifyHand(result.landmarks?.[0]);
            gesture = gate.update(raw, now);
            onStatus(gesture === 'none' ? (result.landmarks?.length ? 'HOLD A GESTURE' : 'SHOW ONE HAND') : ({palm:'HEATING',fist:'COOLING',ok:'ZOOMING IN',v:'ZOOMING OUT'})[gesture]);
          } else { gate.reset(); }
          onGesture(gesture, dt);
          timer = setTimeout(frame, 65);
        } catch (error) { fail(error, token); }
      }
      frame();
    } catch (error) { fail(error, token); }
  }
  function fail(error, token) {
    if (token !== generation) return;
    stop();
    const message = error.name === 'NotAllowedError' ? 'CAMERA ACCESS DENIED'
      : error.name === 'NotFoundError' ? 'NO CAMERA FOUND'
      : error.name === 'NotReadableError' ? 'CAMERA IS BUSY'
      : error.message === 'secure-context' ? 'OPEN THE HTTPS WEBSITE TO USE CAMERA'
      : 'HAND TRACKING UNAVAILABLE — RETRY';
    onStatus(message, true);
    console.warn('Gesture mode:', error);
  }
  return { start, stop };
}
