import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Shield,
  Globe,
  CheckCircle,
  AlertTriangle,
  Lock,
  Info,
  BookOpen,
  X,
  RefreshCw,
  Server,
  MapPin
} from "lucide-react";
import {
  termsAgreementService,
  DynamicTermsContent,
  GeolocationData
} from "../lib/services/TermsAgreementService";

interface TermsAgreementModalProps {
  forceShow?: boolean;
  onClose?: () => void;
}

export default function TermsAgreementModal({ forceShow = false, onClose }: TermsAgreementModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [canClose, setCanClose] = useState(false);
  const [activeTab, setActiveTab] = useState<"global" | "publishing" | "privacy" | "jurisdictions">("global");
  const [activeJurisdiction, setActiveJurisdiction] = useState<"us" | "eu" | "in" | "latam" | "can_aus">("us");

  // Dynamic content states
  const [terms, setTerms] = useState<DynamicTermsContent | null>(null);
  const [geoData, setGeoData] = useState<GeolocationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Agreement Checklist States
  const [agreedAge, setAgreedAge] = useState(false);
  const [agreedCopyright, setAgreedCopyright] = useState(false);
  const [agreedGlobalTerms, setAgreedGlobalTerms] = useState(false);

  // Scroll to bottom simulation check
  const [scrolledToBottom, setScrolledToBottom] = useState(false);

  const fetchDynamicTerms = async () => {
    setLoading(true);
    setError(null);
    try {
      const geo = await termsAgreementService.getUserLocation();
      const generated = await termsAgreementService.generateLocalizedTerms();
      setGeoData(geo);
      setTerms(generated);

      // Pre-select jurisdiction tab matches user location
      if (generated.jurisdictionCode === "us_ccpa") {
        setActiveJurisdiction("us");
      } else if (generated.jurisdictionCode === "eu_gdpr") {
        setActiveJurisdiction("eu");
      } else if (generated.jurisdictionCode === "in_dpdp") {
        setActiveJurisdiction("in");
      } else if (generated.jurisdictionCode === "br_lgpd") {
        setActiveJurisdiction("latam");
      } else if (generated.jurisdictionCode === "ca_pipeda" || generated.jurisdictionCode === "au_privacy") {
        setActiveJurisdiction("can_aus");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load real-time global terms.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const alreadyAccepted = localStorage.getItem("skrimchat_accepted_terms_v1");
      if (!alreadyAccepted || forceShow) {
        setIsOpen(true);
      }
      if (alreadyAccepted) {
        setCanClose(true);
      }

      fetchDynamicTerms();

      // Add custom event listener for manual reviews
      const handleShowLegal = () => {
        if (alreadyAccepted) {
          setAgreedAge(true);
          setAgreedCopyright(true);
          setAgreedGlobalTerms(true);
          setCanClose(true);
        }
        setIsOpen(true);
      };

      window.addEventListener("skrimchat_show_legal", handleShowLegal);
      return () => {
        window.removeEventListener("skrimchat_show_legal", handleShowLegal);
      };
    }
  }, [forceShow]);

  const handleAccept = () => {
    if (agreedAge && agreedCopyright && agreedGlobalTerms && geoData && terms) {
      if (typeof window !== "undefined") {
        const agreementPayload = {
          accepted: true,
          timestamp: Date.now(),
          version: "1.1.0_global_dynamic",
          jurisdiction: terms.jurisdictionCode,
          regulation: terms.primaryRegulation,
          userIP: geoData.ip,
          countryCode: geoData.countryCode,
          stamp: terms.dynamicStamp,
          platform: navigator.userAgent
        };
        localStorage.setItem("skrimchat_accepted_terms_v1", JSON.stringify(agreementPayload));
        setCanClose(true);
        // Dispatch event so other screens can update if needed
        window.dispatchEvent(new Event("skrimchat_terms_accepted"));
      }
      setIsOpen(false);
      if (onClose) onClose();
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 40) {
      setScrolledToBottom(true);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 overflow-y-auto">
        {/* Dark Backdrop with heavy blur */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/90 backdrop-blur-md"
          onClick={() => {
            // Prevent close on click if it's forced
            if (forceShow && onClose) {
              setIsOpen(false);
              onClose();
            }
          }}
        />

        {/* Content Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", duration: 0.5, bounce: 0.15 }}
          className="relative w-full max-w-4xl bg-[#09090D] border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] z-10"
        >
          {/* Header */}
          <div className="px-6 py-5 border-b border-white/5 bg-gradient-to-r from-[#B026FF]/10 via-transparent to-[#00F0FF]/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-[#B026FF] to-[#00F0FF] flex items-center justify-center text-white shrink-0 shadow-lg shadow-[#B026FF]/20">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <span>Dynamic Legal Agreement</span>
                  <span className="text-[10px] bg-[#00F0FF]/10 text-[#00F0FF] border border-[#00F0FF]/20 px-2 py-0.5 rounded-full font-mono">
                    v1.1.0 Real-time
                  </span>
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Dynamic terms computed on user location for global cross-border compliance.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 self-start md:self-auto">
              {geoData && (
                <div className="flex items-center gap-1.5 bg-[#00F0FF]/10 border border-[#00F0FF]/20 px-2.5 py-1 rounded-lg">
                  <Globe className="w-3.5 h-3.5 text-[#00F0FF] animate-pulse" />
                  <span className="text-[10px] font-mono font-bold text-gray-300 uppercase tracking-widest">
                    {geoData.countryCode} ({geoData.ip})
                  </span>
                </div>
              )}
              {canClose && (
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 text-gray-400 hover:text-white transition-all active:scale-95 cursor-pointer"
                  title="Close and Return"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* User Geolocation Banner */}
          {geoData && terms && (
            <div className="px-6 py-2.5 bg-white/[0.02] border-b border-white/5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-gray-400 font-mono">
              <span className="flex items-center gap-1 text-white/70">
                <MapPin className="w-3 h-3 text-[#B026FF]" />
                <span>Detected: {geoData.city}, {geoData.countryName}</span>
              </span>
              <span className="hidden sm:inline text-white/20">|</span>
              <span className="flex items-center gap-1 text-white/70">
                <Server className="w-3 h-3 text-[#00F0FF]" />
                <span>Regulatory Scheme: {terms.primaryRegulation}</span>
              </span>
              <span className="hidden md:inline text-white/20">|</span>
              <span className="ml-auto text-gray-500">{terms.dynamicStamp}</span>
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div className="flex-1 flex flex-col items-center justify-center py-20 space-y-4">
              <RefreshCw className="w-8 h-8 text-[#00F0FF] animate-spin" />
              <p className="text-xs text-gray-400 font-mono">Compiling real-time regional guidelines and laws...</p>
            </div>
          )}

          {/* Error State */}
          {!loading && error && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
              <AlertTriangle className="w-10 h-10 text-red-500" />
              <h3 className="text-sm font-bold text-white">Legal Fetch Failure</h3>
              <p className="text-xs text-gray-400 max-w-md">{error}</p>
              <button
                onClick={fetchDynamicTerms}
                className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-white hover:bg-white/10"
              >
                Retry Real-Time Fetch
              </button>
            </div>
          )}

          {/* Main content */}
          {!loading && !error && terms && (
            <>
              {/* Navigation Tabs */}
              <div className="px-6 border-b border-white/5 flex gap-1 overflow-x-auto no-scrollbar bg-white/[0.01]">
                <button
                  onClick={() => setActiveTab("global")}
                  className={`px-4 py-3.5 text-xs font-bold transition-all relative shrink-0 ${
                    activeTab === "global" ? "text-white" : "text-gray-400 hover:text-white"
                  }`}
                >
                  <span>1. General Terms</span>
                  {activeTab === "global" && (
                    <motion.div layoutId="legal_tab_line" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#B026FF]" />
                  )}
                </button>
                <button
                  onClick={() => setActiveTab("publishing")}
                  className={`px-4 py-3.5 text-xs font-bold transition-all relative shrink-0 ${
                    activeTab === "publishing" ? "text-white" : "text-gray-400 hover:text-white"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-[#B026FF]" />
                    2. Publishing & Copyright
                  </span>
                  {activeTab === "publishing" && (
                    <motion.div layoutId="legal_tab_line" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#B026FF]" />
                  )}
                </button>
                <button
                  onClick={() => setActiveTab("privacy")}
                  className={`px-4 py-3.5 text-xs font-bold transition-all relative shrink-0 ${
                    activeTab === "privacy" ? "text-white" : "text-gray-400 hover:text-white"
                  }`}
                >
                  <span>3. Data Privacy</span>
                  {activeTab === "privacy" && (
                    <motion.div layoutId="legal_tab_line" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#B026FF]" />
                  )}
                </button>
                <button
                  onClick={() => setActiveTab("jurisdictions")}
                  className={`px-4 py-3.5 text-xs font-bold transition-all relative shrink-0 ${
                    activeTab === "jurisdictions" ? "text-white" : "text-gray-400 hover:text-white"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00F0FF] animate-ping" />
                    4. Regional Addenda
                  </span>
                  {activeTab === "jurisdictions" && (
                    <motion.div layoutId="legal_tab_line" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#B026FF]" />
                  )}
                </button>
              </div>

              {/* Interactive Consent Scrollable Area */}
              <div
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-6 space-y-6 text-gray-300 text-xs leading-relaxed max-h-[45vh]"
              >
                {activeTab === "global" && (
                  <div className="space-y-4">
                    <div className="p-3.5 bg-[#B026FF]/5 border border-[#B026FF]/15 rounded-xl flex items-start gap-3">
                      <Info className="w-4 h-4 text-[#B026FF] shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[11px] text-[#D8B4FE] font-bold">Dynamic Jurisdictional Binding</p>
                        <p className="text-[10px] text-gray-400 mt-1">
                          {terms.introduction}
                        </p>
                      </div>
                    </div>

                    {terms.generalTerms.map((section, idx) => (
                      <div key={idx} className="space-y-2">
                        <h3 className="text-white font-bold text-sm">{section.title}</h3>
                        <p className="text-gray-300">{section.body}</p>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === "publishing" && (
                  <div className="space-y-4">
                    <div className="p-3.5 bg-yellow-500/5 border border-yellow-500/15 rounded-xl flex items-start gap-3">
                      <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[11px] text-yellow-200/90 font-bold">Digital Copyright Standards Compliance</p>
                        <p className="text-[10px] text-gray-400 mt-1">
                          Digital Millennium Copyright Act (DMCA) and equivalent international directives are rigorously active on this node.
                        </p>
                      </div>
                    </div>

                    {terms.copyrightPolicy.map((section, idx) => (
                      <div key={idx} className="space-y-2">
                        <h3 className="text-white font-bold text-sm">{section.title}</h3>
                        <p className="text-gray-300">{section.body}</p>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === "privacy" && (
                  <div className="space-y-4">
                    <div className="p-3.5 bg-[#00F0FF]/5 border border-[#00F0FF]/15 rounded-xl flex items-start gap-3">
                      <Shield className="w-4 h-4 text-[#00F0FF] shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[11px] text-[#A5F3FC] font-bold">Privacy by Design Architecture</p>
                        <p className="text-[10px] text-gray-400 mt-1">
                          Absolute security is reinforced via advanced data minimization and storage boundaries in accordance with modern local policies.
                        </p>
                      </div>
                    </div>

                    {terms.privacyPolicy.map((section, idx) => (
                      <div key={idx} className="space-y-2">
                        <h3 className="text-white font-bold text-sm">{section.title}</h3>
                        <p className="text-gray-300">{section.body}</p>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === "jurisdictions" && (
                  <div className="space-y-5">
                    {/* Visual indicator highlighting user's specific region */}
                    <div className="p-3.5 bg-gradient-to-r from-[#B026FF]/10 via-[#00F0FF]/5 to-transparent border border-white/10 rounded-xl">
                      <h4 className="text-white font-bold text-xs flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#B026FF] animate-pulse" />
                        <span>Governing Regional Law: {terms.jurisdictionLabel}</span>
                      </h4>
                      <p className="text-[11px] text-gray-300 mt-2 leading-relaxed">
                        {terms.regionalAddendum.body}
                      </p>
                    </div>

                    <div className="h-px bg-white/5 my-4" />
                    <p className="text-[10px] text-gray-400 font-mono">
                      Review other sovereign regional legal addenda for cross-border comparisons:
                    </p>

                    <div className="flex flex-wrap gap-1.5 p-1 bg-white/5 rounded-xl border border-white/5">
                      <button
                        onClick={() => setActiveJurisdiction("us")}
                        className={`flex-1 py-1.5 px-2 text-[10px] font-bold rounded-lg transition-all ${
                          activeJurisdiction === "us" ? "bg-[#B026FF]/20 text-white border border-[#B026FF]/30" : "text-gray-400 hover:text-white"
                        }`}
                      >
                        US (CCPA/COPPA)
                      </button>
                      <button
                        onClick={() => setActiveJurisdiction("eu")}
                        className={`flex-1 py-1.5 px-2 text-[10px] font-bold rounded-lg transition-all ${
                          activeJurisdiction === "eu" ? "bg-[#B026FF]/20 text-white border border-[#B026FF]/30" : "text-gray-400 hover:text-white"
                        }`}
                      >
                        EU / UK (GDPR)
                      </button>
                      <button
                        onClick={() => setActiveJurisdiction("in")}
                        className={`flex-1 py-1.5 px-2 text-[10px] font-bold rounded-lg transition-all ${
                          activeJurisdiction === "in" ? "bg-[#B026FF]/20 text-white border border-[#B026FF]/30" : "text-gray-400 hover:text-white"
                        }`}
                      >
                        India (DPDP)
                      </button>
                      <button
                        onClick={() => setActiveJurisdiction("latam")}
                        className={`flex-1 py-1.5 px-2 text-[10px] font-bold rounded-lg transition-all ${
                          activeJurisdiction === "latam" ? "bg-[#B026FF]/20 text-white border border-[#B026FF]/30" : "text-gray-400 hover:text-white"
                        }`}
                      >
                        Brazil (LGPD)
                      </button>
                      <button
                        onClick={() => setActiveJurisdiction("can_aus")}
                        className={`flex-1 py-1.5 px-2 text-[10px] font-bold rounded-lg transition-all ${
                          activeJurisdiction === "can_aus" ? "bg-[#B026FF]/20 text-white border border-[#B026FF]/30" : "text-gray-400 hover:text-white"
                        }`}
                      >
                        Canada & Aus
                      </button>
                    </div>

                    <AnimatePresence mode="wait">
                      {activeJurisdiction === "us" && (
                        <motion.div
                          key="us"
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                          className="space-y-3 bg-white/[0.02] p-4 rounded-xl border border-white/5"
                        >
                          <h4 className="text-white font-bold text-xs flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[#00F0FF]" />
                            United States - CCPA & COPPA Addendum
                          </h4>
                          <p>
                            <strong>California Consumer Privacy Act (CCPA):</strong> California residents have the right to request access to categories
                            of personal information collected, request deletion of said info, and opt-out of information sales. We explicitly state
                            that we do not sell, rent, or transfer your reading data or metadata to any marketing network.
                          </p>
                          <p>
                            <strong>Children's Online Privacy Protection Act (COPPA):</strong> The application is not directed at children under the age of 13.
                            If you are under 13, you are strictly prohibited from submitting personal data or credentials.
                          </p>
                        </motion.div>
                      )}

                      {activeJurisdiction === "eu" && (
                        <motion.div
                          key="eu"
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                          className="space-y-3 bg-white/[0.02] p-4 rounded-xl border border-white/5"
                        >
                          <h4 className="text-white font-bold text-xs flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[#B026FF]" />
                            European Union & United Kingdom - GDPR & DSA Compliance
                          </h4>
                          <p>
                            <strong>General Data Protection Regulation (GDPR):</strong> For EU/EEA and UK residents, we act as both data controller
                            and data processor for account registrations. Our legal basis for processing is the performance of a contract (facilitating your e-reader sandbox).
                            You hold the right to restriction, right to be forgotten (erasure), and right to data portability.
                          </p>
                          <p>
                            <strong>Digital Services Act (DSA):</strong> We maintain transparent reporting mechanisms for illegal materials,
                            and ensure that our moderation structures respect due process and users' right of defense.
                          </p>
                        </motion.div>
                      )}

                      {activeJurisdiction === "in" && (
                        <motion.div
                          key="in"
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                          className="space-y-3 bg-white/[0.02] p-4 rounded-xl border border-white/5"
                        >
                          <h4 className="text-white font-bold text-xs flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[#00F0FF]" />
                            India - Digital Personal Data Protection (DPDP) Act
                          </h4>
                          <p>
                            In accordance with India's <strong>DPDP Act, 2023</strong>, we obtain unequivocal, specific, unconditional, and clear consent
                            before storing user credentials or session bookmarks. You have the right to appoint a consent manager, retract your consent easily,
                            and request grievance redressal. We store all metadata in securely provisioned nodes aligned with regional sovereignty requirements.
                          </p>
                        </motion.div>
                      )}

                      {activeJurisdiction === "latam" && (
                        <motion.div
                          key="latam"
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                          className="space-y-3 bg-white/[0.02] p-4 rounded-xl border border-white/5"
                        >
                          <h4 className="text-white font-bold text-xs flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-yellow-500" />
                            Brazil - Lei Geral de Proteção de Dados (LGPD) Compliance
                          </h4>
                          <p>
                            Under Brazil's <strong>LGPD (Lei nº 13.709/2018)</strong>, we assure Brazilian citizens of full transparency in local data processing.
                            You are granted the right to confirmation of data processing, corrections of incomplete/outdated databases, and anonymization
                            of unnecessary data. In compliance with LGPD, data subjects can exercise rights directly via their account dashboard settings.
                          </p>
                        </motion.div>
                      )}

                      {activeJurisdiction === "can_aus" && (
                        <motion.div
                          key="can_aus"
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                          className="space-y-3 bg-white/[0.02] p-4 rounded-xl border border-white/5"
                        >
                          <h4 className="text-white font-bold text-xs flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500" />
                            Canada (PIPEDA) & Australia (Privacy Act 1988) Addenda
                          </h4>
                          <p>
                            <strong>Canada (PIPEDA):</strong> We adhere strictly to the Personal Information Protection and Electronic Documents Act.
                            Consent is explicitly documented, and security measures (such as transport layer SSL/TLS encryption and sandboxing) are upheld.
                          </p>
                          <p>
                            <strong>Australia (APPs):</strong> In alignment with the Australian Privacy Principles (Privacy Act 1988),
                            we take proactive precautions against unauthorized data access, destruction, or disclosure.
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              {/* Checklist & Acceptance Section */}
              <div className="p-6 border-t border-white/5 bg-black/60 space-y-4">
                <div className="space-y-2.5">
                  <label className="flex items-start gap-3 cursor-pointer group text-[11px] select-none text-gray-400 hover:text-white transition-colors">
                    <input
                      type="checkbox"
                      checked={agreedAge}
                      onChange={(e) => setAgreedAge(e.target.checked)}
                      className="mt-0.5 rounded border-white/20 bg-black text-[#B026FF] focus:ring-[#B026FF] focus:ring-offset-black cursor-pointer"
                    />
                    <span className="leading-normal">
                      I represent and warrant that <span className="text-white font-bold">I am at least 13 years of age</span> (or the minimum legal age of consent in my respective country/state).
                    </span>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer group text-[11px] select-none text-gray-400 hover:text-white transition-colors">
                    <input
                      type="checkbox"
                      checked={agreedCopyright}
                      onChange={(e) => setAgreedCopyright(e.target.checked)}
                      className="mt-0.5 rounded border-white/20 bg-black text-[#B026FF] focus:ring-[#B026FF] focus:ring-offset-black cursor-pointer"
                    />
                    <span className="leading-normal">
                      I represent that any publication or content I upload to my workspace sandbox <span className="text-white font-bold">does not infringe upon copyright regulations</span> and complies with DMCA/Fair Use standards.
                    </span>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer group text-[11px] select-none text-gray-400 hover:text-white transition-colors">
                    <input
                      type="checkbox"
                      checked={agreedGlobalTerms}
                      onChange={(e) => setAgreedGlobalTerms(e.target.checked)}
                      className="mt-0.5 rounded border-white/20 bg-black text-[#B026FF] focus:ring-[#B026FF] focus:ring-offset-black cursor-pointer"
                    />
                    <span className="leading-normal">
                      I have read and unconditionally <span className="text-white font-bold">agree to the Global Terms of Service</span>, Privacy Consent Policy, Cookies storage, and regional legal addenda outlined above.
                    </span>
                  </label>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                  <div className="text-[10px] text-gray-500 font-mono text-center sm:text-left leading-normal flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 shrink-0 text-green-500" />
                    <span>Agreement is verified and locally stamped: <span className="text-gray-400 font-bold">{terms.dynamicStamp}</span></span>
                  </div>

                  <button
                    disabled={!(agreedAge && agreedCopyright && agreedGlobalTerms)}
                    onClick={handleAccept}
                    className={`w-full sm:w-auto sm:ml-auto px-6 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 select-none shadow-lg shrink-0 ${
                      agreedAge && agreedCopyright && agreedGlobalTerms
                        ? "bg-gradient-to-r from-[#B026FF] to-[#00F0FF] text-white cursor-pointer hover:opacity-90 active:scale-95 shadow-[#B026FF]/20"
                        : "bg-white/5 border border-white/5 text-gray-500 cursor-not-allowed"
                    }`}
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Accept & Continue</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
