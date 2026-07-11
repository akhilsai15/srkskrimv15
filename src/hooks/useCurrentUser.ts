import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { apiClient } from '../lib/apiClient';

export const useCurrentUser = () => {
  const authUser = useAuthStore((state) => state.user);
  const [dbUser, setDbUser] = useState<any>(null);

  useEffect(() => {
    if (!authUser) {
      setDbUser(null);
      return;
    }

    const fetchUser = async () => {
      try {
        const data = await apiClient.get<any>('/skrimchat-users');
        setDbUser(data);
      } catch (err) {
        console.warn("TODO: Real backend GET /skrimchat-users not ready. Using authStore user.", err);
      }
    };

    fetchUser();
  }, [authUser]);

  if (!authUser) return null;
  return {
    ...authUser,
    ...dbUser,
    username: dbUser?.username || authUser.username || '',
    email: dbUser?.email || authUser.email || '',
  };
};

