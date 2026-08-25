"use client";

import { useEffect, useMemo, useState } from "react";
import { calculateWage, durationMinutes, snapDateToInterval, timeOptions } from "@/lib/calculator";

type Theme = "device" | "light" | "dark";
type TimeFormat = "device" | "12" | "24";
type Interval = 5 | 10 | 15 | 30 | 60;

type StoredState = {
  rate: string;
  start: string;
  end: string;
  currency: string;
  timeFormat: TimeFormat;
  interval: Interval;
  theme: Theme;
};

const STORAGE_KEY = "wage-calculator:v1";
const DEFAULT_STATE: StoredState = {
  rate: "",
  start: "",
  end: "",
  currency: "",
  timeFormat: "device",
  interval: 15,
  theme: "device",
};

const CURRENCIES = ["ILS", "USD", "EUR", "GBP", "CAD", "AUD", "JPY", "CHF"];

function deviceCurrency() {
  const locale = navigator.language;
  const region = new Intl.Locale(locale).region;
  const byRegion: Record<string, string> = {
    IL: "ILS", US: "USD", GB: "GBP", CA: "CAD", AU: "AUD", JP: "JPY", CH: "CHF",
    AT: "EUR", BE: "EUR", CY: "EUR", DE: "EUR", EE: "EUR", ES: "EUR", FI: "EUR",
    FR: "EUR", GR: "EUR", HR: "EUR", IE: "EUR", IT: "EUR", LT: "EUR", LU: "EUR",
    LV: "EUR", MT: "EUR", NL: "EUR", PT: "EUR", SI: "EUR", SK: "EUR",
  };
  return (region && byRegion[region]) || "USD";
}

function usesTwelveHourClock() {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric" }).resolvedOptions().hour12;
}

export default function WageCalculator() {
  const [state, setState] = useState<StoredState>(DEFAULT_STATE);
  const [ready, setReady] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) setState({ ...DEFAULT_STATE, ...JSON.parse(stored) });
      } catch { /* Continue with safe defaults. */ }
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    document.documentElement.dataset.theme = state.theme;
  }, [ready, state]);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js");
  }, []);

  const currency = state.currency || (ready ? deviceCurrency() : "USD");
  const options = useMemo(() => timeOptions(state.interval), [state.interval]);
  const minutes = state.start && state.end ? durationMinutes(state.start, state.end) : null;
  const rate = Number(state.rate);
  const hasDurationError = Boolean(state.start && state.end && minutes === null);
  const wage = minutes !== null && Number.isFinite(rate) && rate >= 0 ? calculateWage(rate, minutes) : null;
  const decimals = currency === "ILS" ? 0 : 2;
  // SSR and the browser's first render must use the same locale. Once mounted,
  // re-render with the actual device locale.
  const money = new Intl.NumberFormat(ready ? undefined : "en-US", {
    style: "currency", currency, minimumFractionDigits: decimals, maximumFractionDigits: decimals,
  });
  const is12Hour = state.timeFormat === "12" || (state.timeFormat === "device" && ready && usesTwelveHourClock());

  function update<K extends keyof StoredState>(key: K, value: StoredState[K]) {
    setState((current) => ({ ...current, [key]: value }));
  }

  function setNow(key: "start" | "end") {
    update(key, snapDateToInterval(new Date(), state.interval));
  }

  function clearTimes() {
    setState((current) => ({ ...current, start: "", end: "" }));
  }

  function displayTime(value: string) {
    if (!value || !is12Hour) return value;
    const [hour, minute] = value.split(":").map(Number);
    return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", hour12: true })
      .format(new Date(2000, 0, 1, hour, minute));
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Hourly pay</p>
          <h1>Wage Calculator</h1>
        </div>
        <button className="icon-button" onClick={() => setSettingsOpen(true)} aria-label="Open preferences">
          <span aria-hidden="true">•••</span>
        </button>
      </header>

      <section className="hero" aria-live="polite">
        <p className="hero-label">Wage</p>
        <div className={`wage ${wage === null || hasDurationError ? "muted" : ""}`}>
          {wage !== null && !hasDurationError ? money.format(wage) : money.format(0)}
        </div>
        <p className={`duration ${hasDurationError ? "error" : ""}`}>
          {hasDurationError
            ? "Shift must be 12 hours or less"
            : minutes !== null
              ? `${Math.floor(minutes / 60)} hr ${minutes % 60} min`
              : "Set a start and end time"}
        </p>
      </section>

      <section className="controls" aria-label="Wage details">
        <label className="rate-row">
          <span>Hourly rate</span>
          <span className="rate-input-wrap">
            <span>{money.formatToParts(0).find((part) => part.type === "currency")?.value}</span>
            <input
              value={state.rate}
              onChange={(event) => update("rate", event.target.value.replace(currency === "ILS" ? /\D/g : /[^\d.]/g, ""))}
              inputMode={currency === "ILS" ? "numeric" : "decimal"}
              placeholder="0"
              aria-label={`Hourly rate in ${currency}`}
            />
          </span>
        </label>

        <TimeRow label="Start time" value={state.start} displayValue={displayTime(state.start)} options={options} onChange={(value) => update("start", value)} onNow={() => setNow("start")} />
        <TimeRow label="End time" value={state.end} displayValue={displayTime(state.end)} options={options} onChange={(value) => update("end", value)} onNow={() => setNow("end")} />
      </section>

      <button className="clear-button" onClick={clearTimes} disabled={!state.start && !state.end}>Clear times</button>

      {settingsOpen && (
        <div className="sheet-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setSettingsOpen(false)}>
          <section className="settings-sheet" role="dialog" aria-modal="true" aria-labelledby="settings-title">
            <div className="sheet-handle" />
            <div className="sheet-header">
              <h2 id="settings-title">Preferences</h2>
              <button className="done-button" onClick={() => setSettingsOpen(false)}>Done</button>
            </div>
            <SettingSelect label="Currency" value={state.currency} onChange={(value) => update("currency", value)}>
              <option value="">Device ({ready ? deviceCurrency() : "…"})</option>
              {CURRENCIES.map((item) => <option key={item} value={item}>{item}</option>)}
            </SettingSelect>
            <SettingSelect label="Time format" value={state.timeFormat} onChange={(value) => update("timeFormat", value as TimeFormat)}>
              <option value="device">Device</option><option value="12">12-hour</option><option value="24">24-hour</option>
            </SettingSelect>
            <SettingSelect label="Time interval" value={String(state.interval)} onChange={(value) => update("interval", Number(value) as Interval)}>
              {[5, 10, 15, 30, 60].map((item) => <option key={item} value={item}>{item} minutes</option>)}
            </SettingSelect>
            <SettingSelect label="Theme" value={state.theme} onChange={(value) => update("theme", value as Theme)}>
              <option value="device">Device</option><option value="light">Light</option><option value="dark">Dark</option>
            </SettingSelect>
            <p className="privacy-note">Everything stays on this device and works offline.</p>
          </section>
        </div>
      )}
    </main>
  );
}

function TimeRow({ label, value, displayValue, options, onChange, onNow }: {
  label: string; value: string; displayValue: string; options: string[]; onChange: (value: string) => void; onNow: () => void;
}) {
  return (
    <div className="time-row">
      <div><span className="field-label">{label}</span><span className={`time-display ${!value ? "empty" : ""}`}>{value ? displayValue : "—:—"}</span></div>
      <div className="time-actions">
        <label className="select-time"><span className="sr-only">Edit {label.toLowerCase()}</span><select value={value} onChange={(event) => onChange(event.target.value)}><option value="">Set time</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select><span aria-hidden="true">Edit</span></label>
        <button className="now-button" onClick={onNow}>Now</button>
      </div>
    </div>
  );
}

function SettingSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return <label className="setting-row"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{children}</select></label>;
}
