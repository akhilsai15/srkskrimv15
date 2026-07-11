import { useState, useEffect } from 'react';
import { Message } from '../types';
import { apiClient } from '../lib/apiClient';

export const useChatEnergy = (messages: Message[]) => {
  const [energy, setEnergy] = useState<number>(0); // 0 = calm, 100 = max energy

  useEffect(() => {
    const fetchEnergy = async () => {
      try {
        const res = await apiClient.post<{ energy: number }>('/skrimchat-engagement/energy', {
          messageCount: messages.length,
          recentCount: messages.filter((m: Message) => {
            const timestamp = parseInt(m.id);
            return !isNaN(timestamp) && timestamp > Date.now() - 120000;
          }).length
        });
        setEnergy(res.energy);
      } catch (err) {
        console.warn("Failed to fetch chat energy via apiClient, using local fallback.", err);
        // Fallback local formula:
        const twoMinsAgo = Date.now() - 120000;
        const recentCount = messages.filter((m: Message) => {
          const timestamp = parseInt(m.id);
          return !isNaN(timestamp) && timestamp > twoMinsAgo;
        }).length;
        const newEnergy = Math.min(recentCount * 5, 100);
        setEnergy(prev => (newEnergy > prev ? newEnergy : prev));
      }
    };

    fetchEnergy();
  }, [messages]);

  useEffect(() => {
    // Decay over time:
    const decay = setInterval(() => {
      setEnergy(e => Math.max(e - 1, 0));
    }, 3000);

    return () => clearInterval(decay);
  }, []);

  return energy;
};

// Also export energy level helper
export const getEnergyLevel = (energy: number) => {
   if (energy <= 10) return 0;
   if (energy <= 30) return 1;
   if (energy <= 50) return 2;
   if (energy <= 75) return 3;
   return 4;
};
