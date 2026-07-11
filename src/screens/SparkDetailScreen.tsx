import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SparkViewer } from '../components/SparkViewer';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { getSparks } from '../lib/mock/mockServices';
import { deleteRecord } from '../lib/services/mediaStorage';
import { apiClient } from '../lib/apiClient';

/**
 * Opens a single Spark directly by ID — reached by tapping a "Spark" bubble
 * shared in Connect (DM), or any other /spark/:sparkId deep link. Builds a
 * one-item groupedSparks array so the existing SparkViewer can render it
 * without needing to be inside the Pulse feed.
 */
export default function SparkDetailScreen() {
  const { sparkId } = useParams<{ sparkId: string }>();
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const [group, setGroup] = useState<any[] | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    const fetchSpark = async () => {
      try {
        const spark = await apiClient.get<any>(`/sparks/${sparkId}`);
        if (!active) return;
        if (!spark) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        let viewedSet = new Set<string>();
        try {
          viewedSet = new Set(JSON.parse(localStorage.getItem('skrimchat_viewed_sparks') || '[]'));
        } catch {}
        setGroup([
          {
            id: spark.user?.id || spark.user?.username || 'unknown',
            userId: spark.user?.id || spark.user?.username || 'unknown',
            user: spark.user,
            isOwn: !!spark.isOwn,
            sparks: [{ ...spark, hasViewed: spark.hasViewed || viewedSet.has(spark.id) }],
            maxEnergy: spark.energy,
            hasViewed: spark.hasViewed || viewedSet.has(spark.id),
            energy: spark.energy || 'COLD',
            expiresAt: spark.expiresAt || 0,
          },
        ]);
        setLoading(false);
      } catch (err: any) {
        console.warn("Real-time spark details API is offline, using mock list fallback:", err);
        getSparks().then((all) => {
          if (!active) return;
          try {
            const spark = all.find((s: any) => s.id === sparkId);
            if (!spark) {
              setNotFound(true);
              setLoading(false);
              return;
            }
            let viewedSet = new Set<string>();
            try {
              viewedSet = new Set(JSON.parse(localStorage.getItem('skrimchat_viewed_sparks') || '[]'));
            } catch {}
            setGroup([
              {
                id: spark.user?.id || spark.user?.username || 'unknown',
                userId: spark.user?.id || spark.user?.username || 'unknown',
                user: spark.user,
                isOwn: !!spark.isOwn,
                sparks: [{ ...spark, hasViewed: spark.hasViewed || viewedSet.has(spark.id) }],
                maxEnergy: spark.energy,
                hasViewed: spark.hasViewed || viewedSet.has(spark.id),
                energy: spark.energy || 'COLD',
                expiresAt: spark.expiresAt || 0,
              },
            ]);
            setLoading(false);
          } catch (processErr: any) {
            console.error("Error setting spark details from fallback:", processErr);
            setError(processErr.message || "Failed to process Spark data.");
            setLoading(false);
          }
        }).catch((fallbackErr: any) => {
          if (!active) return;
          console.error("Failed to load fallback sparks:", fallbackErr);
          setError(fallbackErr.message || "Failed to load Spark.");
          setLoading(false);
        });
      }
    };

    fetchSpark();

    return () => { active = false; };
  }, [sparkId]);

  const handleSparkViewed = (id: string) => {
    try {
      const viewed = new Set(JSON.parse(localStorage.getItem('skrimchat_viewed_sparks') || '[]'));
      viewed.add(id);
      localStorage.setItem('skrimchat_viewed_sparks', JSON.stringify([...viewed]));
    } catch {}
  };

  if (error) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-black text-white gap-4 p-6 text-center">
        <span className="text-5xl text-red-500">⚠️</span>
        <h2 className="text-lg font-bold">Error Loading Spark</h2>
        <p className="text-sm text-gray-400 max-w-xs">{error}</p>
        <button onClick={() => navigate('/')} className="px-6 py-3 bg-neon-purple text-white font-bold rounded-xl text-sm mt-2">
          Back to Pulse
        </button>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-black text-white gap-4 p-6 text-center">
        <span className="text-5xl">⚡</span>
        <h2 className="text-lg font-bold">This Spark has expired</h2>
        <p className="text-sm text-gray-400 max-w-xs">Sparks disappear 24 hours after they're posted.</p>
        <button onClick={() => navigate('/')} className="px-6 py-3 bg-neon-purple text-white font-bold rounded-xl text-sm mt-2">
          Back to Pulse
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-black text-white gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent border-[#B026FF] animate-spin" />
        <span className="text-xs text-gray-500 font-mono tracking-wider">LOADING SPARK...</span>
      </div>
    );
  }

  if (!group) {
    return <div className="w-full h-full bg-black" />;
  }

  return (
    <SparkViewer
      groupedSparks={group}
      initialUserIndex={0}
      onClose={() => navigate(-1)}
      currentUser={currentUser}
      onSparkViewed={handleSparkViewed}
      onDelete={async (id: string) => {
        try {
          await deleteRecord('sparks', id);
        } catch (e) {
          console.error("Failed to delete spark:", e);
        }
        navigate(-1);
      }}
    />
  );
}
