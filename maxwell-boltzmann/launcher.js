const capabilityReadout = document.querySelector("#xrCapability");

function setCapabilityMessage(message) {
  if (capabilityReadout) capabilityReadout.textContent = message;
}

async function detectWebXR() {
  const userAgent = navigator.userAgent || "";
  const looksLikeQuest = /OculusBrowser|Meta Quest/i.test(userAgent);

  if (!navigator.xr) {
    setCapabilityMessage("WebXR unavailable · desktop preview remains available");
    return;
  }

  try {
    const supported = await navigator.xr.isSessionSupported("immersive-vr");
    if (supported && looksLikeQuest) {
      setCapabilityMessage("Meta Quest detected · immersive VR available");
    } else if (supported) {
      setCapabilityMessage("immersive WebXR available in this browser");
    } else {
      setCapabilityMessage("no headset session · desktop preview remains available");
    }
  } catch {
    setCapabilityMessage("WebXR check blocked · VR page can still be previewed");
  }
}

detectWebXR();
