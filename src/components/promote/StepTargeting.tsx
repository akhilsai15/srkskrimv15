import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AdTargeting, INTERESTS, LANGUAGES, SCOPE_LABELS, SCOPE_PRICE_PER_DAY } from '../../lib/mock/monetizationMockData';
import { useCountUp } from '../../hooks/useCountUp';
import SearchableSelect from '../SearchableSelect';

interface StepTargetingProps {
  targeting: AdTargeting;
  onChange: (targeting: AdTargeting) => void;
  /** @deprecated reach is now computed live from targeting filters; kept for prop-shape stability */
  estimatedReach?: { min: number; max: number };
}

interface CountryOption {
  name: string;
  isoCode: string;
  flag: string;
}
interface StateOption {
  name: string;
  isoCode: string;
}

// Derives a plausible reach estimate from the current targeting filters.
// Narrower targeting (more interests, tighter age range, city-level location) shrinks the range.
function computeReach(targeting: AdTargeting): { min: number; max: number } {
  let base = 850000;

  if (targeting.scope === 'radius') base *= 0.012;
  else if (targeting.scope === 'city') base *= 0.05;
  else if (targeting.scope === 'state') base *= 0.22;
  else if (targeting.scope === 'worldwide') base *= 6;
  else base *= 1; // country

  const ageSpan = targeting.ageMax - targeting.ageMin;
  base *= Math.max(0.15, Math.min(1, ageSpan / 52));

  if (targeting.gender !== 'all') base *= 0.52;

  if (targeting.interests.length > 0) {
    base *= Math.max(0.18, 1 - targeting.interests.length * 0.12);
  }

  if (targeting.languages.length > 0) {
    base *= Math.max(0.25, 1 - targeting.languages.length * 0.08);
  }

  if (targeting.device !== 'all') base *= 0.55;

  const min = Math.round(base * 0.7);
  const max = Math.round(base * 1.0);
  return { min, max };
}

export function StepTargeting({ targeting, onChange }: StepTargetingProps) {
  const reach = computeReach(targeting);
  const minCount = useCountUp(reach.min, 300);
  const maxCount = useCountUp(reach.max, 300);

  // Full world country/state/city data comes from the `country-state-city` package
  // (250 countries, ~5k states/provinces, ~148k cities). It's loaded lazily via a
  // dynamic import so this ~8MB dataset only downloads when someone actually opens
  // the targeting step, instead of bloating the app's initial bundle.
  const cscModule = useRef<any>(null);
  const [countriesLoading, setCountriesLoading] = useState(true);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [states, setStates] = useState<StateOption[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [loadingMetadata, setLoadingMetadata] = useState(true);
  const [asyncInterests, setAsyncInterests] = useState<string[]>([]);
  const [asyncLanguages, setAsyncLanguages] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    const fetchMetadata = async () => {
      setLoadingMetadata(true);
      await new Promise((resolve) => setTimeout(resolve, 250));
      if (!cancelled) {
        setAsyncInterests(INTERESTS);
        setAsyncLanguages(LANGUAGES);
        setLoadingMetadata(false);
      }
    };
    fetchMetadata();

    import('country-state-city').then((mod) => {
      if (cancelled) return;
      cscModule.current = mod;
      const list: CountryOption[] = mod.Country.getAllCountries()
        .map((c: any) => ({ name: c.name, isoCode: c.isoCode, flag: c.flag }))
        .sort((a: CountryOption, b: CountryOption) => a.name.localeCompare(b.name));
      setCountries(list);
      setCountriesLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const currentCountryIso = useMemo(
    () => countries.find((c) => c.name === targeting.country)?.isoCode,
    [countries, targeting.country]
  );

  useEffect(() => {
    if (!cscModule.current || !currentCountryIso) {
      setStates([]);
      return;
    }
    const list: StateOption[] = cscModule.current.State.getStatesOfCountry(currentCountryIso)
      .map((s: any) => ({ name: s.name, isoCode: s.isoCode }))
      .sort((a: StateOption, b: StateOption) => a.name.localeCompare(b.name));
    setStates(list);
  }, [currentCountryIso, countriesLoading]);

  const currentStateIso = useMemo(
    () => states.find((s) => s.name === targeting.state)?.isoCode,
    [states, targeting.state]
  );

  useEffect(() => {
    if (!cscModule.current || !currentCountryIso || !currentStateIso) {
      setCities([]);
      return;
    }
    const raw: string[] = cscModule.current.City.getCitiesOfState(currentCountryIso, currentStateIso).map(
      (c: any) => c.name as string
    );
    const unique = Array.from(new Set(raw)).sort((a, b) => a.localeCompare(b));
    setCities(unique);
  }, [currentCountryIso, currentStateIso]);

  const toggleInterest = (interest: string) => {
    const has = targeting.interests.includes(interest);
    onChange({
      ...targeting,
      interests: has ? targeting.interests.filter((i) => i !== interest) : [...targeting.interests, interest],
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-lg font-bold text-white">Who should see this?</h2>

      {/* Reach scope — flat price per day, no auction */}
      <div>
        <label className="text-[11px] font-bold text-gray-400 uppercase mb-2 block">Ad reach</label>
        <div className="grid grid-cols-2 gap-2">
          {(['radius', 'city', 'state', 'country'] as const).map((s) => (
            <button
              key={s}
              onClick={() => onChange({ ...targeting, scope: s })}
              className={`flex flex-col items-start gap-0.5 px-4 py-3 rounded-xl text-left ${
                targeting.scope === s ? 'bg-neon-purple text-white' : 'bg-skrim-surface text-gray-400'
              }`}
            >
              <span className="text-xs font-bold">{SCOPE_LABELS[s]}</span>
              <span className={`text-[11px] ${targeting.scope === s ? 'text-white/80' : 'text-gray-500'}`}>₹{SCOPE_PRICE_PER_DAY[s]}/day</span>
            </button>
          ))}
        </div>
        <button
          onClick={() => onChange({ ...targeting, scope: 'worldwide' })}
          className={`w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl mt-2 ${
            targeting.scope === 'worldwide' ? 'bg-neon-purple text-white' : 'bg-skrim-surface text-gray-400'
          }`}
        >
          <span className="text-xs font-bold">🌍 {SCOPE_LABELS.worldwide} — show my ad in every country</span>
          <span className={`text-[11px] shrink-0 ${targeting.scope === 'worldwide' ? 'text-white/80' : 'text-gray-500'}`}>₹{SCOPE_PRICE_PER_DAY.worldwide}/day</span>
        </button>
        <button
          onClick={() => onChange({ ...targeting, scope: 'radius', radiusKm: 5 })}
          className="w-full text-left px-4 py-2.5 rounded-xl mt-2 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs font-bold"
        >
          ⚡ Quick boost: show only to people near me (5 km)
        </button>
      </div>

      {/* Location cascade — only needed when scope requires it; worldwide skips location entirely */}
      {targeting.scope === 'worldwide' ? (
        <p className="text-[11px] text-gray-500 -mt-2">No location needed — your ad will be shown to people in every country.</p>
      ) : (
        <div className="flex flex-col gap-3">
          <SearchableSelect
            label="Country"
            value={targeting.country}
            loading={countriesLoading}
            options={countries.map((c) => ({ value: c.name, label: `${c.flag} ${c.name}` }))}
            placeholder="Select country"
            onChange={(v) => onChange({ ...targeting, country: v, state: null, city: null })}
          />
          {targeting.scope !== 'country' && states.length > 0 && (
            <SearchableSelect
              label="State"
              value={targeting.state || ''}
              options={states.map((s) => ({ value: s.name, label: s.name }))}
              placeholder="Select state"
              emptyText="No states found"
              onChange={(v) => onChange({ ...targeting, state: v || null, city: null })}
            />
          )}
          {(targeting.scope === 'city' || targeting.scope === 'radius') && cities.length > 0 && (
            <SearchableSelect
              label={targeting.scope === 'radius' ? 'City (center point)' : 'City'}
              value={targeting.city || ''}
              options={cities.map((c) => ({ value: c, label: c }))}
              placeholder="Select city"
              emptyText="No cities found"
              onChange={(v) => onChange({ ...targeting, city: v || null })}
            />
          )}
          {targeting.scope === 'radius' && (
            <p className="text-[11px] text-gray-500">Your ad will show to people within {targeting.radiusKm} km of the selected city.</p>
          )}
        </div>
      )}

      {/* Age range */}
      <div>
        <label className="text-[11px] font-bold text-gray-400 uppercase mb-2 block">
          Age range: {targeting.ageMin} – {targeting.ageMax}
        </label>
        <div className="flex gap-3">
          <input
            type="range" min={13} max={65} value={targeting.ageMin}
            onChange={(e) => onChange({ ...targeting, ageMin: Math.min(Number(e.target.value), targeting.ageMax - 1) })}
            className="w-full accent-neon-purple"
          />
          <input
            type="range" min={13} max={65} value={targeting.ageMax}
            onChange={(e) => onChange({ ...targeting, ageMax: Math.max(Number(e.target.value), targeting.ageMin + 1) })}
            className="w-full accent-neon-purple"
          />
        </div>
      </div>

      {/* Gender */}
      <div>
        <label className="text-[11px] font-bold text-gray-400 uppercase mb-2 block">Gender</label>
        <div className="flex gap-2">
          {(['all', 'male', 'female'] as const).map((g) => (
            <button
              key={g}
              onClick={() => onChange({ ...targeting, gender: g })}
              className={`flex-1 py-2 rounded-xl text-xs font-bold capitalize ${
                targeting.gender === g ? 'bg-neon-purple text-white' : 'bg-skrim-surface text-gray-400'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* Interests */}
      <div>
        <label className="text-[11px] font-bold text-gray-400 uppercase mb-2 block">Interests</label>
        {loadingMetadata ? (
          <div className="flex items-center gap-2 py-2">
            <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-neon-purple animate-spin" />
            <span className="text-[10px] text-gray-500 font-mono">LOADING INTERESTS...</span>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {asyncInterests.map((interest) => {
              const active = targeting.interests.includes(interest);
              return (
                <button
                  key={interest}
                  id={`interest-${interest}`}
                  onClick={() => toggleInterest(interest)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    active ? 'bg-neon-purple/20 border border-neon-purple text-neon-purple shadow-[0_0_8px_rgba(176,38,255,0.4)]' : 'bg-skrim-surface border border-white/10 text-gray-400'
                  }`}
                >
                  {interest}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Language */}
      <div>
        <label className="text-[11px] font-bold text-gray-400 uppercase mb-2 block">Language</label>
        {loadingMetadata ? (
          <div className="flex items-center gap-2 py-2">
            <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-neon-blue animate-spin" />
            <span className="text-[10px] text-gray-500 font-mono">LOADING LANGUAGES...</span>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {asyncLanguages.map((lang) => {
              const active = targeting.languages.includes(lang);
              return (
                <button
                  key={lang}
                  id={`lang-${lang}`}
                  onClick={() => {
                    const has = targeting.languages.includes(lang);
                    onChange({
                      ...targeting,
                      languages: has ? targeting.languages.filter((l) => l !== lang) : [...targeting.languages, lang],
                    });
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    active ? 'bg-neon-blue/20 border border-neon-blue text-neon-blue' : 'bg-skrim-surface border border-white/10 text-gray-400'
                  }`}
                >
                  {lang}
                </button>
              );
            })}
          </div>
        )}
        <p className="text-[10px] text-gray-500 mt-1.5">Leave blank to reach people in all languages.</p>
      </div>

      {/* Device */}
      <div>
        <label className="text-[11px] font-bold text-gray-400 uppercase mb-2 block">Device</label>
        <div className="flex gap-2">
          {(['all', 'android', 'ios'] as const).map((d) => (
            <button
              key={d}
              onClick={() => onChange({ ...targeting, device: d })}
              className={`flex-1 py-2 rounded-xl text-xs font-bold capitalize ${
                targeting.device === d ? 'bg-neon-purple text-white' : 'bg-skrim-surface text-gray-400'
              }`}
            >
              {d === 'all' ? 'All Devices' : d === 'ios' ? 'iOS' : 'Android'}
            </button>
          ))}
        </div>
      </div>

      {/* Frequency cap */}
      <div>
        <label className="text-[11px] font-bold text-gray-400 uppercase mb-2 block">
          Frequency cap: max {targeting.frequencyCap}x per person / day
        </label>
        <input
          type="range" min={1} max={10} value={targeting.frequencyCap}
          onChange={(e) => onChange({ ...targeting, frequencyCap: Number(e.target.value) })}
          className="w-full accent-neon-purple"
        />
        <p className="text-[10px] text-gray-500 mt-1">Lower caps reduce ad fatigue; higher caps increase repeat impressions.</p>
      </div>

      {/* Estimated reach */}
      <div className="bg-skrim-surface rounded-2xl border border-white/5 p-4">
        <div className="flex justify-between items-center mb-1">
          <h3 className="font-bold text-white text-sm">Estimated Reach</h3>
          <span className="text-neon-blue font-bold tracking-tight text-sm">
            {Math.round(minCount).toLocaleString()} – {Math.round(maxCount).toLocaleString()}
          </span>
        </div>
        <p className="text-[10px] text-gray-500">People who may see your ad</p>
      </div>
    </div>
  );
}
