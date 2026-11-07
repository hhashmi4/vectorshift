import type { ButtonHTMLAttributes, ReactNode } from "react";

export function StatusPill({ children, tone = "neutral" }: { readonly children: ReactNode; readonly tone?: "neutral" | "positive" | "warning" | "danger" }) {
  return <span className={`status-pill ${tone}`}>{children}</span>;
}

export function IconButton({ label, children, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { readonly label: string; readonly children: ReactNode }) {
  return <button {...props} type="button" className={`icon-button ${className}`} aria-label={label} title={label}>{children}</button>;
}

export function ToolIcon({ name }: { readonly name: "explore" | "route" | "network" | "scenario" | "layers" | "panel" | "swap" | "clear" | "fit" }) {
  const path = {
    explore: <><circle cx="12" cy="12" r="8"/><path d="m15 9-2 4-4 2 2-4 4-2Z"/></>,
    route: <><circle cx="7" cy="17" r="2"/><circle cx="17" cy="7" r="2"/><path d="M8.5 15.5 15.5 8.5"/></>,
    network: <><circle cx="6" cy="7" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="13" cy="18" r="2"/><path d="m8 7 8-.7M7.3 8.5l4.4 7.8m5-8.5-2.8 8.4"/></>,
    scenario: <><path d="M12 3v18M3 12h18"/><circle cx="12" cy="12" r="8"/></>,
    layers: <><path d="m12 3 8 4-8 4-8-4 8-4Z"/><path d="m4 12 8 4 8-4M4 17l8 4 8-4"/></>,
    panel: <><rect x="3" y="4" width="18" height="16" rx="1"/><path d="M15 4v16"/></>,
    swap: <><path d="M7 7h11l-3-3M17 17H6l3 3"/></>,
    clear: <><path d="m5 5 14 14M19 5 5 19"/></>,
    fit: <><path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5"/></>,
  }[name];
  return <svg className="tool-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{path}</svg>;
}
