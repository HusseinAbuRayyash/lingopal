/**
 * Converts a Blob to a Base64 string.
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Decodes a base64 string to a Uint8Array.
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Decodes raw PCM audio data (from Gemini) into an AudioBuffer.
 * Assumes 24kHz sample rate, mono, as per Gemini TTS defaults.
 */
export async function decodeAudioData(
  base64String: string,
  audioContext: AudioContext,
  sampleRate: number = 24000
): Promise<AudioBuffer> {
  const audioBytes = base64ToUint8Array(base64String);
  
  // Gemini TTS returns raw PCM (16-bit signed integer).
  // We need to convert this to Float32 for the Web Audio API.
  const dataInt16 = new Int16Array(audioBytes.buffer);
  const frameCount = dataInt16.length; 
  const buffer = audioContext.createBuffer(1, frameCount, sampleRate);
  const channelData = buffer.getChannelData(0);

  for (let i = 0; i < frameCount; i++) {
    // Normalize 16-bit integer (-32768 to 32767) to float (-1.0 to 1.0)
    channelData[i] = dataInt16[i] / 32768.0;
  }

  return buffer;
}
