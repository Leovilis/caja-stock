"use client";

import { ReactNode, useEffect } from "react";
import { X } from "lucide-react";

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = "default",
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "green" | "red" | "blue" | "amber";
  icon?: ReactNode;
}) {
  const tones = {
    default: "text-slate-900",
    green: "text-emerald-600",
    red: "text-rose-600",
    blue: "text-brand-600",
    amber: "text-amber-600",
  };
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
        {icon && <span className="text-slate-400">{icon}</span>}
      </div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${tones[tone]}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  const w = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" }[size];
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 pt-[6vh]" onMouseDown={onClose}>
      <div className={`card w-full ${w} p-0`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="py-10 text-center text-sm text-slate-400">{children}</div>;
}

export function Spinner() {
  return <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />;
}

export function Loading() {
  return (
    <div className="flex h-40 items-center justify-center">
      <Spinner />
    </div>
  );
}

export function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "green" | "red" | "amber" | "blue" }) {
  const t = {
    slate: "bg-slate-100 text-slate-700",
    green: "bg-emerald-100 text-emerald-700",
    red: "bg-rose-100 text-rose-700",
    amber: "bg-amber-100 text-amber-800",
    blue: "bg-brand-100 text-brand-700",
  }[tone];
  return <span className={`badge ${t}`}>{children}</span>;
}

/** Input numérico que acepta coma decimal */
export function NumInput({
  value,
  onChange,
  className = "input",
  ...rest
}: { value: number | string; onChange: (n: number) => void; className?: string } & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange"
>) {
  return (
    <input
      {...rest}
      type="number"
      step="any"
      inputMode="decimal"
      className={className}
      value={value === 0 && rest.placeholder ? "" : value}
      onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value.replace(",", ".")))}
      onFocus={(e) => e.target.select()}
    />
  );
}
