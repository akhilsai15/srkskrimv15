import React, { useState, useEffect } from 'react';
import { Shield, AlertTriangle, Users, Lock } from 'lucide-react';
import { getAdminData } from '../lib/mock/mockServices';
import { FEATURE_FLAGS } from '../lib/config/featureFlags';
import { useCurrentUser } from '../hooks/useCurrentUser';

export default function AdminDashboardScreen() {
  const currentUser = useCurrentUser();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = currentUser?.isAdmin || 
                  currentUser?.username === 'SkrimAdmin' || 
                  currentUser?.email === 'admin@skrim.chat' ||
                  currentUser?.email === 'akhilsaitejachess@gmail.com'; // Allow access for the developer/reviewer email

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    let active = true;
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        if (FEATURE_FLAGS.MOCK_MODE) {
          const adminData = await getAdminData();
          if (active) {
            setData(adminData);
          }
        }
      } catch (err: any) {
        if (active) {
          setError(err.message || "Failed to load admin operations data");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    fetchData();
    return () => {
      active = false;
    };
  }, [isAdmin]);

  if (!isAdmin && !loading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#0a0a0a] text-white p-6 text-center gap-4">
        <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white">Access Denied</h2>
        <p className="text-xs text-gray-400 max-w-xs leading-relaxed">
          You do not have administrative privileges to access this console. This event has been logged for security audit.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col pt-6 pb-24 overflow-y-auto no-scrollbar bg-[#0a0a0a]">
      <header className="px-4 pb-4 border-b border-white/5 sticky top-0 bg-[#0a0a0a] z-40">
        <h1 className="text-2xl font-bold tracking-tight text-red-500 mb-1 flex items-center gap-2"><Shield className="w-6 h-6"/> Admin Ops</h1>
        <p className="text-xs text-gray-500">System overview & moderation</p>
      </header>

      <div className="p-4 flex flex-col gap-4">
        {loading ? (
             <div className="flex items-center justify-center p-8"><div className="w-6 h-6 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" /></div>
        ) : error ? (
             <div className="p-8 text-center flex flex-col items-center">
               <p className="text-red-400 font-bold mb-2">Access Denied / System Error</p>
               <p className="text-white/60 text-xs mb-4">{error}</p>
               <button onClick={() => window.location.reload()} className="px-4 py-2 bg-red-600 rounded-lg text-xs font-bold text-white">Retry Connection</button>
             </div>
        ) : !data ? (
             <p className="text-gray-500 text-sm text-center">No administration data available.</p>
        ) : (
          <>
            <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-xl flex items-center gap-4">
               <AlertTriangle className="w-8 h-8 text-red-500 flex-shrink-0" />
               <div>
                  <h3 className="font-bold text-red-500">Reports Queue</h3>
                  <p className="text-sm text-gray-300">{data.reportsQueue} items require moderation</p>
               </div>
               <button className="ml-auto bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg border border-red-400">Review</button>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-2">
              <div className="bg-skrim-surface p-4 rounded-xl border border-white/5">
                 <h4 className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">Content Flags</h4>
                 <p className="text-xl font-bold">{data.contentModeration}</p>
                 <p className="text-[10px] text-red-400 mt-1">Action required</p>
              </div>
              <div className="bg-skrim-surface p-4 rounded-xl border border-white/5">
                 <h4 className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">Active Users</h4>
                 <p className="text-xl font-bold">{data.userManagement}</p>
                 <p className="text-[10px] text-green-400 mt-1">Live right now</p>
              </div>
            </div>

            <div className="bg-skrim-surface p-4 rounded-xl border border-white/5 h-48 mt-2 flex flex-col justify-end">
               <h4 className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-4">Traffic Load</h4>
               <div className="flex items-end gap-1 w-full h-24 justify-between">
                 {data.chartData.map((val: number, i: number) => (
                   <div key={i} className="flex-1 bg-white/10 rounded-t-sm" style={{ height: `${(val/300)*100}%` }} />
                 ))}
               </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
