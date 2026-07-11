export async function requestMicrophoneStream(): Promise<MediaStream> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('Microphone access is not supported by this device or browser.');
  }
  return await navigator.mediaDevices.getUserMedia({ audio: true });
}

export function releaseMicrophoneStream(stream: MediaStream | null) {
  if (!stream) return;
  stream.getTracks().forEach((track) => {
    try {
      track.stop();
    } catch (err) {
      console.warn('Failed to stop microphone track:', err);
    }
  });
}
