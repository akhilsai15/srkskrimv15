import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronLeft } from 'lucide-react';
import { PromoteHome } from '../components/promote/PromoteHome';
import { StepFormat } from '../components/promote/StepFormat';
import { StepCreative } from '../components/promote/StepCreative';
import { StepTargeting } from '../components/promote/StepTargeting';
import { StepBudget } from '../components/promote/StepBudget';
import { LaunchCeremony } from '../components/promote/LaunchCeremony';
import { CampaignDashboard } from '../components/promote/CampaignDashboard';
import { SharedPaymentModal } from '../components/SharedPaymentModal';
import { AD_DRAFT_DEFAULTS, AdDraft, USER_CONTENT, computeAdCost, SCOPE_LABELS, SCOPE_PRICE_PER_DAY, AD_GOALS } from '../lib/mock/monetizationMockData';
import { apiClient } from '../lib/apiClient';

type View = 'home' | 'create' | 'launched' | 'campaigns';

const STEP_LABELS = ['Format', 'Creative', 'Targeting', 'Budget & Pay'];

export default function PromoteScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const prefillContentId = (location.state as any)?.prefillContentId as string | undefined;
  const resubmitCampaignId = (location.state as any)?.resubmitCampaignId as string | undefined;

  const [view, setView] = useState<View>('home');
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<AdDraft>(AD_DRAFT_DEFAULTS);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [launchedCampaignId, setLaunchedCampaignId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPromoteUnavailable, setIsPromoteUnavailable] = useState(false);

  useEffect(() => {
    let active = true;
    const init = async () => {
      setLoading(true);
      setError(null);
      try {
        await apiClient.get('/promote/eligibility');
        if (active) {
          setIsPromoteUnavailable(false);
        }
      } catch (err: any) {
        console.warn("Real-time advertising eligibility checks are offline:", err);
        if (active) {
          setIsPromoteUnavailable(true);
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    init();
    return () => { active = false; };
  }, []);

  // Arrive pre-filled from "Boost this content" or "Edit & Resubmit"
  useEffect(() => {
    if (prefillContentId || resubmitCampaignId) {
      const content = USER_CONTENT.find((c) => c.id === prefillContentId);
      setDraft({
        ...AD_DRAFT_DEFAULTS,
        format: content?.type === 'reel' ? 'video' : content?.type === 'story' ? 'story' : 'post',
        creativeId: prefillContentId || null,
      });
      setView('create');
      setStep(prefillContentId ? 1 : 0);
    }
  }, [prefillContentId, resubmitCampaignId]);

  const updateDraft = (patch: Partial<AdDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const canProceed = () => {
    if (step === 0) return !!draft.format;
    if (step === 1) {
      const hasCreative = !!draft.creativeId || draft.uploadedMedia.length > 0;
      const goalMeta = AD_GOALS.find((g) => g.id === draft.goal);
      const needsDestination = goalMeta?.destinationType !== 'none';
      const hasDestination = !needsDestination || !!draft.destinationValue.trim();
      return hasCreative && hasDestination;
    }
    if (step === 2) {
      const { scope, country, state, city } = draft.targeting;
      if (scope === 'worldwide') return true; // no location needed
      if (!country) return false;
      if (scope === 'radius' || scope === 'city') return !!state && !!city;
      if (scope === 'state') return !!state;
      return true; // country scope — country alone is enough
    }
    if (step === 3) return !!draft.duration;
    return false;
  };

  const total = computeAdCost(draft.targeting.scope, draft.duration || 1);
  const gst = Math.round(total * 0.18);
  const grandTotal = total + gst;
  const selectedContent = USER_CONTENT.find((c) => c.id === draft.creativeId);
  const previewThumbnail = draft.uploadedMedia.length > 0 ? draft.uploadedMedia[0] : selectedContent?.thumbnail;

  const handleClose = () => {
    if (view === 'create') {
      setShowDiscardConfirm(true);
    } else {
      navigate('/identity');
    }
  };

  const handleLaunchSuccess = () => {
    setPaymentOpen(false);
    setLaunchedCampaignId('cmp1'); // mock: pretend the new campaign is cmp1 in the list
    setView('launched');
  };

  if (isPromoteUnavailable) {
    return (
      <div className="w-full h-full flex flex-col bg-black text-white overflow-hidden">
        <header className="px-4 pt-6 pb-4 sticky top-0 bg-[#05050A]/95 backdrop-blur-md z-40 border-b border-white/5">
          <div className="flex items-center justify-between">
            <button onClick={() => navigate('/identity')} className="w-9 h-9 flex items-center justify-center rounded-full bg-white/5 text-white/60">
              <X className="w-5 h-5" />
            </button>
            <h1 className="text-sm font-bold tracking-widest uppercase">🎯 Promote</h1>
            <div className="w-9" />
          </div>
        </header>
        <div className="flex-1 overflow-y-auto no-scrollbar p-6 flex flex-col items-center justify-center text-center bg-[#05050A]">
          <div className="bg-[#111115] border border-[#B026FF]/15 rounded-2xl p-8 max-w-sm mx-auto">
            <span className="text-4xl mb-3 block">🎯</span>
            <h3 className="text-lg font-bold text-white mb-2">Promote Workspace</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Real-time advertising eligibility validation and campaign launchers are currently offline. Promote features are coming soon!
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'campaigns') {
    return (
      <CampaignDashboard
        onBack={() => setView('home')}
        onCreateAd={() => { setDraft(AD_DRAFT_DEFAULTS); setStep(0); setView('create'); }}
        onEditResubmit={(id) => {
          setDraft({ ...AD_DRAFT_DEFAULTS, format: 'post', creativeId: 'ct2' });
          setStep(0);
          setView('create');
        }}
        justLaunchedId={launchedCampaignId}
      />
    );
  }

  if (view === 'launched') {
    return (
      <LaunchCeremony
        draft={draft}
        onViewCampaign={() => setView('campaigns')}
      />
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-black text-white overflow-hidden">
      <header className="px-4 pt-6 pb-4 sticky top-0 bg-[#05050A]/95 backdrop-blur-md z-40 border-b border-white/5">
        <div className="flex items-center justify-between mb-1">
          {view === 'create' && step > 0 ? (
            <button onClick={() => setStep(step - 1)} className="w-9 h-9 flex items-center justify-center rounded-full bg-white/5 text-white/60">
              <ChevronLeft className="w-5 h-5" />
            </button>
          ) : (
            <button onClick={handleClose} className="w-9 h-9 flex items-center justify-center rounded-full bg-white/5 text-white/60">
              <X className="w-5 h-5" />
            </button>
          )}
          <h1 className="text-sm font-bold tracking-widest uppercase">{view === 'create' ? STEP_LABELS[step] : 'Promote'}</h1>
          <div className="w-9" />
        </div>

        {view === 'create' && (
          <div className="flex gap-1.5 mt-3">
            {STEP_LABELS.map((_, i) => (
              <div key={i} className={`flex-1 h-1.5 rounded-full ${i <= step ? 'bg-neon-purple' : 'bg-white/10'}`} />
            ))}
          </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-28">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-8">
            <div className="w-8 h-8 rounded-full border-4 border-t-transparent border-[#B026FF] animate-spin mb-4" />
            <p className="text-white/60 text-sm">Loading advertising workspace...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-8">
            <p className="text-red-400 font-medium mb-3">{error}</p>
            <button onClick={() => window.location.reload()} className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-bold rounded-full text-xs">Retry</button>
          </div>
        ) : (
          <>
            {view === 'home' && (
          <PromoteHome
            onCreateAd={() => { setDraft(AD_DRAFT_DEFAULTS); setStep(0); setView('create'); }}
            onViewCampaignDashboard={() => setView('campaigns')}
          />
        )}

        {view === 'create' && (
          <div className="p-4">
            <AnimatePresence mode="wait">
              {step === 0 && (
                <motion.div key="s0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <StepFormat value={draft.format} onSelect={(format) => updateDraft({ format })} />
                </motion.div>
              )}
              {step === 1 && (
                <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <StepCreative
                    format={draft.format}
                    creativeId={draft.creativeId}
                    uploadedMedia={draft.uploadedMedia}
                    headline={draft.headline}
                    ctaText={draft.ctaText}
                    goal={draft.goal}
                    destinationValue={draft.destinationValue}
                    onSelectCreative={(id) => updateDraft({ creativeId: id })}
                    onHeadlineChange={(headline) => updateDraft({ headline })}
                    onUploadedMediaChange={(uploadedMedia) => updateDraft({ uploadedMedia })}
                    onGoalChange={(goal) => updateDraft({ goal })}
                    onDestinationChange={(destinationValue) => updateDraft({ destinationValue })}
                    onCtaChange={(ctaText) => updateDraft({ ctaText })}
                  />
                </motion.div>
              )}
              {step === 2 && (
                <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <StepTargeting
                    targeting={draft.targeting}
                    estimatedReach={draft.estimatedReach}
                    onChange={(targeting) => updateDraft({ targeting })}
                  />
                </motion.div>
              )}
              {step === 3 && (
                <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <StepBudget draft={draft} onChange={updateDraft} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
          </>
        )}
      </div>

      {view === 'create' && (
        <div className="absolute bottom-0 inset-x-0 p-4 bg-[#05050A]/95 backdrop-blur-md border-t border-white/5 pb-safe-bottom">
          {step < 3 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
              className={`w-full py-4 rounded-xl font-bold text-sm ${canProceed() ? 'bg-neon-purple text-white shadow-neon-purple' : 'bg-white/5 text-white/30'}`}
            >
              Continue
            </button>
          ) : (
            <button
              onClick={() => setPaymentOpen(true)}
              disabled={!canProceed()}
              className={`w-full py-4 rounded-xl font-bold text-sm ${canProceed() ? 'bg-neon-purple text-white shadow-neon-purple' : 'bg-white/5 text-white/30'}`}
            >
              Proceed to Pay →
            </button>
          )}
        </div>
      )}

      <AnimatePresence>
        {paymentOpen && (
          <SharedPaymentModal
            isOpen={paymentOpen}
            onClose={() => setPaymentOpen(false)}
            preview={{
              thumbnail: previewThumbnail,
              title: selectedContent?.title || draft.headline || 'Your ad',
              subtitle: draft.format ? `${draft.format.charAt(0).toUpperCase() + draft.format.slice(1)} Ad` : undefined,
              detailLines: [`${draft.duration} days`, `${SCOPE_LABELS[draft.targeting.scope]} · ₹${SCOPE_PRICE_PER_DAY[draft.targeting.scope]}/day`],
            }}
            costLines={[
              { label: `${SCOPE_LABELS[draft.targeting.scope]} · ${draft.duration} days`, value: `₹${total.toLocaleString()}` },
              { label: 'GST (18%)', value: `₹${gst.toLocaleString()}` },
              { label: 'Grand total', value: `₹${grandTotal.toLocaleString()}`, emphasis: true },
            ]}
            grandTotal={`₹${grandTotal.toLocaleString()}`}
            amount={grandTotal}
            success={{
              icon: '📣',
              headline: 'Payment successful!',
              detail: 'Your ad is being reviewed and will go live shortly.',
              primaryActionLabel: 'View My Ad',
              onPrimaryAction: handleLaunchSuccess,
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDiscardConfirm && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowDiscardConfirm(false)} className="fixed inset-0 z-[200] bg-black/70" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="fixed inset-x-6 top-1/3 z-[210] bg-[#111115] rounded-2xl border border-white/10 p-5">
              <h3 className="font-bold text-white mb-2">Discard this ad?</h3>
              <p className="text-[13px] text-gray-400 mb-5">Your progress will be lost.</p>
              <div className="flex gap-3">
                <button onClick={() => setShowDiscardConfirm(false)} className="flex-1 py-3 bg-white/5 text-white font-bold rounded-xl text-sm">Continue</button>
                <button onClick={() => { setShowDiscardConfirm(false); setView('home'); }} className="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl text-sm">Discard</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
