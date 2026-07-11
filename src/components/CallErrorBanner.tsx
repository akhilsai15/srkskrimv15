import React, { useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { PhoneOff } from "lucide-react";
import { useCallStore } from "../store/callStore";

/**
 * When a call fails to connect (camera/mic permission denied, no device,
 * device busy, etc.) the call screen closes immediately since there's
 * nothing to show. Without this, that looks exactly like the call button
 * "doing nothing". This banner surfaces the actual reason so the person
 * knows what happened and what to do about it.
 */
export function CallErrorBanner() {
  const callError = useCallStore((s) => s.callError);
  const clearCallError = useCallStore((s) => s.clearCallError);

  useEffect(() => {
    if (!callError) return;
    const timer = setTimeout(() => clearCallError(), 5000);
    return () => clearTimeout(timer);
  }, [callError, clearCallError]);

  return (
    <AnimatePresence>
      {callError && (
        <div className="fixed top-2 left-0 right-0 z-[10001] flex justify-center pointer-events-none px-4">
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className="pointer-events-auto cursor-pointer bg-[#0A0A0A] border border-red-500/40 rounded-2xl p-3 shadow-[0_10px_40px_rgba(0,0,0,0.8)] flex items-start gap-3 w-full max-w-[95vw] sm:max-w-md"
            onClick={clearCallError}
          >
            <div className="w-9 h-9 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
              <PhoneOff size={16} className="text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-bold text-white leading-tight">
                Call couldn't connect
              </p>
              <p className="text-[13px] text-white/70 leading-snug mt-0.5">
                {callError}
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
