import { apiClient } from '../apiClient';

// NOTE: superseded by the real WebRTC call engine — see
// src/lib/e2e/calling/callEngine.ts and src/store/callStore.ts.
// Kept only for reference / any legacy callers.
export const mockStartVideoCall = async (userId: string) => {
  console.log(`[MOCK CALL] Starting video call to ${userId}`);
  try {
    return await apiClient.post<{ success: boolean; roomId: string }>('/calls/start', { userId, type: 'video' });
  } catch (err) {
    console.warn("TODO: Real backend POST /calls/start not ready. Returning stub.", err);
    return { success: true, roomId: `room_video_${userId}_${Date.now()}` };
  }
};

export const mockStartAudioCall = async (userId: string) => {
  console.log(`[MOCK CALL] Starting audio call to ${userId}`);
  try {
    return await apiClient.post<{ success: boolean; roomId: string }>('/calls/start', { userId, type: 'audio' });
  } catch (err) {
    console.warn("TODO: Real backend POST /calls/start not ready. Returning stub.", err);
    return { success: true, roomId: `room_audio_${userId}_${Date.now()}` };
  }
};

export const mockEndCall = async () => {
  console.log(`[MOCK CALL] Ended call`);
  try {
    return await apiClient.post<{ success: boolean }>('/calls/end', {});
  } catch (err) {
    console.warn("TODO: Real backend POST /calls/end not ready. Returning stub.", err);
    return { success: true };
  }
};

export const mockIncomingCall = async () => {
  console.log(`[MOCK CALL] Simulating incoming call...`);
  try {
    return await apiClient.get<{ caller: string; type: string }>('/calls/incoming');
  } catch (err) {
    console.warn("TODO: Real backend GET /calls/incoming not ready. Returning stub.", err);
    return { caller: "Alex Parker", type: "video" };
  }
};

