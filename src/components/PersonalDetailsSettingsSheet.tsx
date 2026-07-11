import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, User as UserIcon, AtSign, Mail, Calendar, MapPin, Check, Loader2, ShieldCheck, Navigation } from 'lucide-react';
import { COUNTRY_CODES } from '../constants/countryCodes';
import { validateDOB, dobInputBounds } from '../lib/utils/age';

function mockCanChangeUsername(lastChanged: number): { allowed: boolean; daysLeft: number } {
  const cooldownPeriod = 14 * 24 * 60 * 60 * 1000;
  const timePassed = Date.now() - lastChanged;
  if (timePassed >= cooldownPeriod) {
    return { allowed: true, daysLeft: 0 };
  }
  const remaining = Math.ceil((cooldownPeriod - timePassed) / (24 * 60 * 60 * 1000));
  return { allowed: false, daysLeft: remaining };
}

async function mockCheckUsernameAvailable(username: string, userId: string): Promise<{ available: boolean; reason?: string }> {
  if (username.length < 3) {
    return { available: false, reason: 'Username too short' };
  }
  return { available: true };
}

async function mockSendEmailChangeOTP(email: string): Promise<void> {
  // Simulator for OTP sending
}

async function mockVerifyEmailChangeOTP(otp: string): Promise<void> {
  if (otp !== '123456') {
    throw new Error('Invalid verification code. Enter 123456 for testing.');
  }
}

async function mockUpdatePersonalDetails(userId: string, data: any): Promise<void> {
  const stored = localStorage.getItem('skrimchat_user');
  if (stored) {
    const userObj = JSON.parse(stored);
    const updated = { ...userObj, ...data };
    localStorage.setItem('skrimchat_user', JSON.stringify(updated));
    window.dispatchEvent(new Event('skrimchat_user_updated'));
  }
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
}

const USERNAME_LAST_CHANGED_KEY = 'skrimchat_username_last_changed_at';

export function PersonalDetailsSettingsSheet({ isOpen, onClose, onBack }: Props) {
  const [user, setUser] = useState<any>(null);

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [dob, setDob] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');

  const [usernameStatus, setUsernameStatus] = useState<{ checking: boolean; available: boolean | null; reason?: string }>({ checking: false, available: null });
  const [usernameCooldown, setUsernameCooldown] = useState<{ allowed: boolean; daysLeft: number }>({ allowed: true, daysLeft: 0 });

  const [emailStep, setEmailStep] = useState<'idle' | 'awaiting-otp'>('idle');
  const [emailOtp, setEmailOtp] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const [emailVerifiedForSave, setEmailVerifiedForSave] = useState(true);

  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    try {
      const stored = localStorage.getItem('skrimchat_user');
      const parsed = stored ? JSON.parse(stored) : null;
      setUser(parsed);
      setName(parsed?.displayName || parsed?.fullName || '');
      setUsername((parsed?.username || '').replace(/^@/, ''));
      setEmail(parsed?.email || '');
      setDob(parsed?.dateOfBirth || '');
      const loc = (parsed?.location || '') as string;
      const [c, ...rest] = loc.split(',').map((s: string) => s.trim()).filter(Boolean).reverse();
      setCountry(c || '');
      setCity(rest.reverse().join(', ') || '');
      setError('');
      setSuccess('');
      setEmailStep('idle');
      setEmailVerifiedForSave(true);

      const lastChanged = Number(localStorage.getItem(USERNAME_LAST_CHANGED_KEY) || 0);
      setUsernameCooldown(mockCanChangeUsername(lastChanged));
    } catch {}
  }, [isOpen]);

  const dobBounds = useMemo(() => dobInputBounds(), []);
  const existingIsMinor = user?.isMinor === true;

  const handleUsernameChange = async (val: string) => {
    const clean = val.replace(/@/g, '');
    setUsername(clean);
    setUsernameStatus({ checking: false, available: null });
    if (!user) return;
    if (clean === (user.username || '').replace(/^@/, '')) return; // unchanged
    if (clean.length < 3) return;
    setUsernameStatus({ checking: true, available: null });
    const result = await mockCheckUsernameAvailable(clean, user.id);
    setUsernameStatus({ checking: false, available: result.available, reason: (result as any).reason });
  };

  const handleSendEmailOTP = async () => {
    setError('');
    try {
      await mockSendEmailChangeOTP(email);
      setPendingEmail(email);
      setEmailStep('awaiting-otp');
      setEmailVerifiedForSave(false);
    } catch (err: any) {
      setError(err.message || 'Could not send verification code');
    }
  };

  const handleVerifyEmailOTP = async () => {
    setError('');
    try {
      await mockVerifyEmailChangeOTP(emailOtp);
      setEmailVerifiedForSave(true);
      setEmailStep('idle');
      setSuccess('Email verified ✓');
    } catch (err: any) {
      setError(err.message || 'Invalid code');
    }
  };

  const handleDetectLocation = () => {
    setError('');
    if (!navigator.geolocation) {
      setError('Location services are not available on this device');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`);
          const data = await res.json();
          if (data?.countryName) setCountry(data.countryName);
          if (data?.city || data?.locality) setCity(data.city || data.locality);
        } catch {
          setError('Could not resolve your address from GPS coordinates');
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        setError('Permission denied — please allow location access, or enter it manually');
      },
      { timeout: 10000 }
    );
  };

  const handleSave = async () => {
    setError('');
    setSuccess('');

    if (!name || name.trim().length < 2) { setError('Full name must be at least 2 characters'); return; }

    const cleanUsername = username.replace(/^@/, '');
    const usernameChanged = user && cleanUsername !== (user.username || '').replace(/^@/, '');
    if (usernameChanged) {
      if (!usernameCooldown.allowed) {
        setError(`You can change your username again in ${usernameCooldown.daysLeft} day(s)`);
        return;
      }
      if (usernameStatus.available === false) {
        setError(usernameStatus.reason || 'That username is not available');
        return;
      }
    }

    const emailChanged = email !== (user?.email || '');
    if (emailChanged && !emailVerifiedForSave) {
      setError('Please verify your new email before saving');
      return;
    }

    const dobCheck = validateDOB(dob);
    if (!dobCheck.valid) { setError(dobCheck.error || 'Please enter a valid date of birth'); return; }

    setSaving(true);
    try {
      const location = [city.trim(), country.trim()].filter(Boolean).join(', ');
      await mockUpdatePersonalDetails(user.id, {
        name: name.trim(),
        username: '@' + cleanUsername,
        email,
        dateOfBirth: dob,
        location,
      });
      if (usernameChanged) {
        localStorage.setItem(USERNAME_LAST_CHANGED_KEY, String(Date.now()));
      }
      setSuccess('Personal details updated ✓');
      setTimeout(() => setSuccess(''), 2500);
    } catch (err: any) {
      setError(err.message || 'Could not save changes');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-[200] backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 max-h-[85vh] bg-[#141414] rounded-t-3xl z-[201] flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.5)] border-t border-white/10 overflow-hidden"
          >
            <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto my-4 shrink-0" />
            <div className="px-6 flex items-center gap-3 pb-4 shrink-0 border-b border-white/5">
              {onBack && (
                <button onClick={onBack} className="p-2 -ml-2 hover:bg-white/10 rounded-full transition-colors text-white/70">
                  <X className="w-5 h-5" />
                </button>
              )}
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <UserIcon className="w-5 h-5 text-[#B026FF]" /> Personal Details
              </h2>
              {!onBack && (
                <button onClick={onClose} className="ml-auto p-2 hover:bg-white/10 rounded-full transition-colors text-white/70">
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            <div className="p-5 flex flex-col gap-5 overflow-y-auto pb-12">
              {error && (
                <div className="bg-[rgba(255,39,39,0.1)] border border-[rgba(255,39,39,0.3)] rounded-2xl py-3 px-4 flex items-start gap-2">
                  <span className="text-sm leading-none mt-0.5">⚠️</span>
                  <span className="text-sm text-[#FF6B6B] leading-tight">{error}</span>
                </div>
              )}
              {success && (
                <div className="bg-[rgba(29,185,84,0.1)] border border-[rgba(29,185,84,0.3)] rounded-2xl py-3 px-4 flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#1DB954]" />
                  <span className="text-sm text-[#1DB954] font-medium">{success}</span>
                </div>
              )}

              {/* Name */}
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <UserIcon className="w-3.5 h-3.5" /> Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#B026FF] transition-colors"
                />
              </div>

              {/* Username */}
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <AtSign className="w-3.5 h-3.5" /> Username
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">@</span>
                  <input
                    type="text"
                    value={username}
                    onChange={e => handleUsernameChange(e.target.value)}
                    disabled={!usernameCooldown.allowed}
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-9 py-3 text-white focus:outline-none focus:border-[#B026FF] transition-colors disabled:opacity-50"
                  />
                  {usernameStatus.checking && <Loader2 className="w-4 h-4 text-gray-400 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />}
                  {!usernameStatus.checking && usernameStatus.available === true && <Check className="w-4 h-4 text-[#1DB954] absolute right-3 top-1/2 -translate-y-1/2" />}
                </div>
                {!usernameCooldown.allowed && (
                  <p className="text-xs text-gray-500 mt-1.5">You can change your username again in {usernameCooldown.daysLeft} day(s)</p>
                )}
                {usernameStatus.available === false && (
                  <p className="text-xs text-red-400 mt-1.5">{usernameStatus.reason}</p>
                )}
              </div>

              {/* Email */}
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" /> Email
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setEmailVerifiedForSave(e.target.value === (user?.email || '')); setEmailStep('idle'); }}
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#B026FF] transition-colors"
                  />
                  {user && email !== user.email && emailStep === 'idle' && (
                    <button type="button" onClick={handleSendEmailOTP} className="px-3 rounded-xl bg-[#B026FF]/20 text-[#B026FF] text-xs font-bold whitespace-nowrap hover:bg-[#B026FF]/30 transition">
                      Verify
                    </button>
                  )}
                </div>
                {emailStep === 'awaiting-otp' && (
                  <div className="mt-2 flex gap-2">
                    <input
                      type="text"
                      maxLength={6}
                      value={emailOtp}
                      onChange={e => setEmailOtp(e.target.value.replace(/\D/g, ''))}
                      placeholder="6-digit code"
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#B026FF] transition-colors"
                    />
                    <button type="button" onClick={handleVerifyEmailOTP} className="px-3 rounded-xl bg-[#1DB954]/20 text-[#1DB954] text-xs font-bold whitespace-nowrap hover:bg-[#1DB954]/30 transition">
                      Confirm
                    </button>
                  </div>
                )}
                {emailStep === 'awaiting-otp' && (
                  <p className="text-xs text-gray-500 mt-1.5">Enter the code sent to {pendingEmail} to confirm the change.</p>
                )}
              </div>

              {/* Date of Birth */}
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> Date of Birth
                </label>
                <input
                  type="date"
                  value={dob}
                  onChange={e => setDob(e.target.value)}
                  min={dobBounds.min}
                  max={dobBounds.max}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#B026FF] transition-colors [color-scheme:dark]"
                />
                <div className="flex items-center gap-1.5 mt-1.5 text-xs text-gray-500">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Private — only visible to you, never shown on your public profile.</span>
                </div>
                {existingIsMinor && (
                  <p className="text-xs text-amber-400/90 mt-1.5">This account is registered as a minor (under 18) — some features may be limited.</p>
                )}
              </div>

              {/* Location */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" /> Location
                  </label>
                  <button
                    type="button"
                    onClick={handleDetectLocation}
                    disabled={locating}
                    className="text-xs font-bold text-[#00F0FF] hover:text-white transition flex items-center gap-1 disabled:opacity-50"
                  >
                    {locating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5" />}
                    {locating ? 'Detecting…' : 'Use my location'}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={country}
                    onChange={e => setCountry(e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:border-[#B026FF] transition-colors"
                  >
                    <option value="" className="bg-[#141414]">Country</option>
                    {COUNTRY_CODES.map(c => (
                      <option key={c.iso2} value={c.name} className="bg-[#141414]">{c.name}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    placeholder="City"
                    className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#B026FF] transition-colors"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1.5">Private by default. Only used to personalize your experience.</p>
              </div>

              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full h-[52px] mt-2 bg-gradient-to-r from-[#B026FF] to-[#FF2D87] text-white font-bold rounded-2xl shadow-[0_0_25px_rgba(255,45,135,0.4)] flex items-center justify-center gap-2 transition-transform active:scale-95 text-sm uppercase tracking-wider disabled:opacity-50 disabled:active:scale-100"
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
