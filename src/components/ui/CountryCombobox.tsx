import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronDown } from "lucide-react";
import type { CountryFlag as CountryFlagType } from "./CountryFlag";

type NationalityOption = { code: string; name: string };

type CountryResources = {
 allNationalities: (locale?: string) => NationalityOption[];
 countryName: (countryCode: string, locale?: string) => string;
 CountryFlag: typeof CountryFlagType;
};

let cachedResources: Promise<CountryResources> | null = null;

function loadCountryResources(): Promise<CountryResources> {
 cachedResources ??= Promise.all([
 import("../../lib/countries"),
 import("./CountryFlag"),
 ]).then(([countriesModule, flagModule]) => ({
 allNationalities: countriesModule.allNationalities,
 countryName: countriesModule.countryName,
 CountryFlag: flagModule.CountryFlag,
 }));
 return cachedResources;
}

function normaliseSearch(value: string): string {
 return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

interface CountryComboboxProps {
 label: string;
 value: string;
 onChange: (code: string) => void;
 placeholder?: string;
}

export function CountryCombobox({ label, value, onChange, placeholder }: CountryComboboxProps) {
 const { t, i18n } = useTranslation();
 const locale = i18n.language;
 const ref = useRef<HTMLDivElement>(null);
 const [isOpen, setIsOpen] = useState(false);
 const [search, setSearch] = useState("");
 const [resources, setResources] = useState<CountryResources | null>(null);
 const [loading, setLoading] = useState(false);

 useEffect(() => {
 if (!isOpen) return;
 function handleClick(e: MouseEvent) {
 if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
 }
 document.addEventListener("mousedown", handleClick);
 return () => document.removeEventListener("mousedown", handleClick);
 }, [isOpen]);

 useEffect(() => {
 if (!resources && value) void ensureResources();
 }, [value, resources]);

 async function ensureResources() {
 if (resources || loading) return;
 setLoading(true);
 try {
 setResources(await loadCountryResources());
 } finally {
 setLoading(false);
 }
 }

 function open() {
 if (!resources) void ensureResources();
 setIsOpen(true);
 setSearch("");
 }

 const normSearch = normaliseSearch(search);
 const options = useMemo(() => resources?.allNationalities(locale) ?? [], [resources, locale]);
 const filtered = useMemo(
 () =>
 options.filter(
 (e) =>
 normaliseSearch(e.name).includes(normSearch) ||
 normaliseSearch(e.code).includes(normSearch),
 ),
 [options, normSearch],
 );

 const selectedLabel = value ? (resources?.countryName(value, locale) ?? value) : null;

 return (
 <div className="flex flex-col gap-1" ref={ref}>
 <label className="text-[10px] font-heading font-bold uppercase tracking-[0.18em] text-ink-dim">
 {label}
 </label>
 <div className="relative">
 <button
 type="button"
 onMouseDown={(e) => {
 e.preventDefault();
 isOpen ? setIsOpen(false) : open();
 }}
 onClick={(e) => {
 if (e.detail === 0) isOpen ? setIsOpen(false) : open();
 }}
 className="w-full rounded border border-slate-line bg-carbon-2 px-3 py-2 text-sm text-left transition focus:outline-none focus:ring-2 focus:ring-primary-400 min-h-[38px]"
 >
 {selectedLabel ? (
 <span className="flex items-center gap-2 text-ink">
 {resources && <resources.CountryFlag code={value} locale={locale} className="text-base leading-none" />}
 <span>{selectedLabel}</span>
 </span>
 ) : (
 <span className="text-ink-faint">{placeholder ?? "—"}</span>
 )}
 <ChevronDown
 className={`absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint transition-transform ${isOpen ? "rotate-180" : ""}`}
 />
 </button>

 {isOpen && (
 <div className="absolute top-full left-0 right-0 z-50 mt-1 overflow-hidden rounded border border-slate-line bg-carbon-2 ">
 {resources ? (
 <>
 <div className="border-b border-slate-line-soft p-2">
 <input
 type="text"
 autoFocus
 placeholder={t("worldEditor.searchCountries")}
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 className="w-full rounded-md border border-slate-line bg-carbon-2 px-3 py-1.5 text-sm text-ink outline-none placeholder:text-ink-faint dark:placeholder:text-ink-faint focus:border-primary-500"
 />
 </div>
 <div className="max-h-48 overflow-y-auto overscroll-contain">
 {filtered.length === 0 ? (
 <p className="px-3 py-2 text-xs text-ink-faint">
 {t("menu.noResults")}
 </p>
 ) : (
 filtered.map((entry) => (
 <button
 key={entry.code}
 type="button"
 onMouseDown={(e) => {
 e.preventDefault();
 onChange(entry.code);
 setIsOpen(false);
 }}
 className={`flex w-full items-center justify-between px-3 py-2 text-sm transition-colors ${
 value === entry.code
 ? "bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400"
 : "text-ink hover:bg-carbon-2 hover:bg-carbon-3"
 }`}
 >
 <span className="flex items-center gap-2">
 <resources.CountryFlag
 code={entry.code}
 locale={locale}
 className="text-base leading-none"
 />
 <span>{entry.name}</span>
 </span>
 {value === entry.code && (
 <Check className="h-4 w-4 flex-shrink-0 text-primary-500" />
 )}
 </button>
 ))
 )}
 </div>
 </>
 ) : (
 <div className="flex min-h-16 items-center justify-center p-3">
 <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
 </div>
 )}
 </div>
 )}
 </div>
 </div>
 );
}
