"use client";

import { useEffect, useMemo, useState } from "react";
import { calculateWage, durationMinutes, snapDateToInterval, timeOptions } from "@/lib/calculator";

type Theme = "device" | "light" | "dark";
type TimeFormat = "device" | "12" | "24";
type Interval = 5 | 10 | 15 | 30 | 60;
type Employee = { id: string; name: string; rate: string; balance: string };

type StoredState = {
  rate: string;
  start: string;
  end: string;
  currency: string;
  timeFormat: TimeFormat;
  interval: Interval;
  theme: Theme;
  employees: Employee[];
  selectedEmployeeId: string;
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
  employees: [],
  selectedEmployeeId: "",
};

const CURRENCIES = ["ILS", "USD", "EUR", "GBP", "CAD", "AUD", "JPY", "CHF"];

function roundAmount(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

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
  const [employeeEditor, setEmployeeEditor] = useState<Employee | "new" | null>(null);

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
  const selectedEmployee = state.employees.find((employee) => employee.id === state.selectedEmployeeId);
  const activeRate = selectedEmployee?.rate ?? state.rate;
  const rate = Number(activeRate);
  const balance = selectedEmployee ? Number(selectedEmployee.balance) || 0 : 0;
  const hasDurationError = Boolean(state.start && state.end && minutes === null);
  const wage = minutes !== null && activeRate !== "" && Number.isFinite(rate) && rate >= 0 ? calculateWage(rate, minutes) : null;
  const total = wage === null ? null : wage + balance;
  const decimals = currency === "ILS" ? 0 : 2;
  // SSR and the browser's first render must use the same locale. Once mounted,
  // re-render with the actual device locale.
  const money = new Intl.NumberFormat(ready ? undefined : "en-US", {
    style: "currency", currency, minimumFractionDigits: decimals, maximumFractionDigits: decimals,
  });
  const is12Hour = state.timeFormat === "12" || (state.timeFormat === "device" && ready && usesTwelveHourClock());
  const durationText = minutes !== null ? `${Math.floor(minutes / 60)} hr ${minutes % 60} min` : "Set a start and end time";
  const wageDetails = selectedEmployee && wage !== null && total !== null
    ? `${durationText} · ${money.format(wage)} + ${money.format(balance)} = ${money.format(total)}`
    : durationText;

  function update<K extends keyof StoredState>(key: K, value: StoredState[K]) {
    setState((current) => ({ ...current, [key]: value }));
  }

  function setNow(key: "start" | "end") {
    update(key, snapDateToInterval(new Date(), state.interval));
  }

  function clearTimes() {
    setState((current) => ({ ...current, start: "", end: "" }));
  }

  function updateEmployee(id: string, changes: Partial<Employee>) {
    setState((current) => ({
      ...current,
      employees: current.employees.map((employee) => employee.id === id ? { ...employee, ...changes } : employee),
    }));
  }

  function addWageToBalance() {
    if (!selectedEmployee || wage === null) return;
    setState((current) => ({
      ...current,
      start: "",
      end: "",
      employees: current.employees.map((employee) => employee.id === selectedEmployee.id
        ? { ...employee, balance: String(roundAmount(balance + wage, decimals)) }
        : employee),
    }));
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
        <div className={`wage ${total === null || hasDurationError ? "muted" : ""}`}>
          {total !== null && !hasDurationError ? money.format(total) : money.format(0)}
        </div>
        <p className={`duration ${hasDurationError ? "error" : ""}`}>
          {hasDurationError
            ? "Shift must be 12 hours or less"
            : wageDetails}
        </p>
      </section>

      <section className="controls" aria-label="Wage details">
        <div className="employee-row">
          <label>
            <span className="field-label">Employee</span>
            <select value={state.selectedEmployeeId} onChange={(event) => update("selectedEmployeeId", event.target.value)}>
              <option value="">None (manual rate)</option>
              {state.employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
            </select>
          </label>
          {selectedEmployee
            ? <button className="text-button" onClick={() => setEmployeeEditor(selectedEmployee)}>Edit</button>
            : <button className="text-button" onClick={() => setEmployeeEditor("new")}>Add employee</button>}
        </div>

        <label className="rate-row">
          <span>Hourly rate</span>
          <span className="rate-input-wrap">
            <span>{money.formatToParts(0).find((part) => part.type === "currency")?.value}</span>
            <input
              value={activeRate}
              onChange={(event) => {
                const value = event.target.value.replace(currency === "ILS" ? /\D/g : /[^\d.]/g, "");
                if (selectedEmployee) updateEmployee(selectedEmployee.id, { rate: value }); else update("rate", value);
              }}
              inputMode={currency === "ILS" ? "numeric" : "decimal"}
              placeholder="0"
              aria-label={`Hourly rate in ${currency}`}
            />
          </span>
        </label>

        {selectedEmployee && (
          <label className="balance-row">
            <span>Balance</span>
            <span className="balance-input-wrap">
              <span>{money.formatToParts(0).find((part) => part.type === "currency")?.value}</span>
              <BalanceInput
                value={selectedEmployee.balance}
                decimals={decimals}
                onChange={(value) => updateEmployee(selectedEmployee.id, { balance: value })}
                ariaLabel={`Balance for ${selectedEmployee.name} in ${currency}`}
              />
            </span>
          </label>
        )}

        <TimeRow label="Start time" value={state.start} displayValue={displayTime(state.start)} options={options} onChange={(value) => update("start", value)} onNow={() => setNow("start")} />
        <TimeRow label="End time" value={state.end} displayValue={displayTime(state.end)} options={options} onChange={(value) => update("end", value)} onNow={() => setNow("end")} />
      </section>

      <button className="clear-button" onClick={clearTimes} disabled={!state.start && !state.end}>Clear times</button>
      {selectedEmployee && (
        <button className="balance-button" onClick={addWageToBalance} disabled={wage === null || hasDurationError || wage === 0}>
          Add wage to balance &amp; clear times
        </button>
      )}

      {employeeEditor && (
        <EmployeeSheet
          employee={employeeEditor === "new" ? null : employeeEditor}
          decimals={decimals}
          onClose={() => setEmployeeEditor(null)}
          onSave={(values) => {
            if (employeeEditor === "new") {
              const employee = { ...values, id: crypto.randomUUID() };
              setState((current) => ({ ...current, employees: [...current.employees, employee], selectedEmployeeId: employee.id }));
            } else {
              updateEmployee(employeeEditor.id, values);
            }
            setEmployeeEditor(null);
          }}
          onDelete={employeeEditor === "new" ? undefined : () => {
            if (!window.confirm(`Delete ${employeeEditor.name}?`)) return;
            setState((current) => ({ ...current, employees: current.employees.filter((item) => item.id !== employeeEditor.id), selectedEmployeeId: "" }));
            setEmployeeEditor(null);
          }}
        />
      )}

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

function BalanceInput({ value, decimals, onChange, ariaLabel }: {
  value: string;
  decimals: number;
  onChange: (value: string) => void;
  ariaLabel: string;
}) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);
  const rounded = roundAmount(Number(value) || 0, decimals).toFixed(decimals);

  return (
    <input
      value={editing ? draft : rounded}
      onFocus={() => { setDraft(value); setEditing(true); }}
      onChange={(event) => setDraft(event.target.value.replace(/[^\d.-]/g, ""))}
      onBlur={() => {
        onChange(String(roundAmount(Number(draft) || 0, decimals)));
        setEditing(false);
      }}
      inputMode="decimal"
      aria-label={ariaLabel}
    />
  );
}

function EmployeeSheet({ employee, decimals, onClose, onSave, onDelete }: {
  employee: Employee | null;
  decimals: number;
  onClose: () => void;
  onSave: (employee: Omit<Employee, "id">) => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(employee?.name ?? "");
  const [rate, setRate] = useState(employee?.rate ?? "");
  const [balance, setBalance] = useState(employee ? roundAmount(Number(employee.balance) || 0, decimals).toFixed(decimals) : "0");
  const canSave = name.trim() !== "" && rate !== "" && Number.isFinite(Number(rate)) && Number(rate) >= 0;

  return (
    <div className="sheet-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="settings-sheet" role="dialog" aria-modal="true" aria-labelledby="employee-title">
        <div className="sheet-handle" />
        <div className="sheet-header">
          <h2 id="employee-title">{employee ? "Edit employee" : "Add employee"}</h2>
          <button className="done-button" onClick={onClose}>Cancel</button>
        </div>
        <label className="editor-field"><span>Name</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label className="editor-field"><span>Hourly wage</span><input inputMode="decimal" value={rate} onChange={(event) => setRate(event.target.value.replace(/[^\d.]/g, ""))} /></label>
        <label className="editor-field"><span>Balance</span><input inputMode="decimal" value={balance} onChange={(event) => setBalance(event.target.value.replace(/[^\d.-]/g, ""))} /></label>
        <button className="primary-button" disabled={!canSave} onClick={() => onSave({ name: name.trim(), rate, balance: String(roundAmount(Number(balance) || 0, decimals)) })}>Save</button>
        {onDelete && <button className="delete-button" onClick={onDelete}>Delete employee</button>}
      </section>
    </div>
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
