export async function requestCameraStream(): Promise<MediaStream> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('Camera access is not supported by this device or browser.');
  }
  return await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user' },
    audio: false
  });
}

export function releaseCameraStream(stream: MediaStream | null) {
  if (!stream) return;
  stream.getTracks().forEach((track) => {
    try {
      track.stop();
    } catch (err) {
      console.warn('Failed to stop camera track:', err);
    }
  });
}
