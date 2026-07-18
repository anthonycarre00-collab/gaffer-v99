import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle, Check, ChevronDown } from "lucide-react";
import type { CountryFlag } from "../ui/CountryFlag";
import type { CreateManagerFormData } from "./CreateManagerForm";

type NationalityOption = { code: string; name: string };

type CountryResources = {
 allNationalities: (locale?: string) => NationalityOption[];
 countryName: (countryCode: string, locale?: string) => string;
 CountryFlag: typeof CountryFlag;
};

interface CreateManagerNationalityFieldProps {
 nationality: CreateManagerFormData["nationality"];
 error?: string;
 locale: string;
 onChange: (value: CreateManagerFormData["nationality"]) => void;
 onClearError: () => void;
}

let countryResourcesPromise: Promise<CountryResources> | null = null;

export function resetCountryResourcesCache(): void {
 countryResourcesPromise = null;
}

function normaliseSearchText(value: string): string {
 return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

async function loadCountryResources(): Promise<CountryResources> {
 countryResourcesPromise ??= Promise.all([
 import("../../lib/countries"),
 import("../ui/CountryFlag"),
 ]).then(([countriesModule, flagModule]) => ({
 allNationalities: countriesModule.allNationalities,
 countryName: countriesModule.countryName,
 CountryFlag: flagModule.CountryFlag,
 }));

 return countryResourcesPromise;
}

export default function CreateManagerNationalityField({
 nationality,
 error,
 locale,
 onChange,
 onClearError,
}: CreateManagerNationalityFieldProps) {
 const { t } = useTranslation();
 const nationalityRef = useRef<HTMLDivElement>(null);
 const [isOpen, setIsOpen] = useState(false);
 const [searchValue, setSearchValue] = useState("");
 const [resources, setResources] = useState<CountryResources | null>(null);
 const [isLoadingResources, setIsLoadingResources] = useState(false);

 useEffect(() => {
 if (!isOpen || !nationalityRef.current) {
 return;
 }

 const nationalityElement = nationalityRef.current;

 const handleClickOutside = (event: MouseEvent) => {
 const targetNode = event.target instanceof Node ? event.target : null;
 const eventPath =
 typeof event.composedPath === "function" ? event.composedPath() : [];
 const clickedInside =
 eventPath.includes(nationalityElement) ||
 (targetNode ? nationalityElement.contains(targetNode) : false);

 if (!clickedInside) {
 setIsOpen(false);
 }
 };

 document.addEventListener("mousedown", handleClickOutside);
 return () => document.removeEventListener("mousedown", handleClickOutside);
 }, [isOpen]);

 useEffect(() => {
 if (!resources && (isOpen || nationality)) {
 void ensureCountryResources();
 }
 }, [isOpen, nationality, resources]);

 const ensureCountryResources = async () => {
 if (resources || isLoadingResources) {
 return;
 }

 setIsLoadingResources(true);

 try {
 setResources(await loadCountryResources());
 } finally {
 setIsLoadingResources(false);
 }
 };

 const normalisedSearchValue = normaliseSearchText(searchValue);
 const nationalities = useMemo(
 () => (resources ? resources.allNationalities(locale) : []),
 [locale, resources],
 );
 const filteredNationalities = useMemo(
 () =>
 nationalities.filter((entry) => {
 const normalisedName = normaliseSearchText(entry.name);
 const normalisedCode = normaliseSearchText(entry.code);

 return (
 normalisedName.includes(normalisedSearchValue) ||
 normalisedCode.includes(normalisedSearchValue)
 );
 }),
 [nationalities, normalisedSearchValue],
 );

 const selectedNationalityLabel = nationality
 ? resources?.countryName(nationality, locale) || nationality
 : null;
 const Flag = resources?.CountryFlag;
 const triggerBorderClassName = error
 ? "border-danger-400 dark:border-danger-500"
 : isOpen
 ? "border-primary-500 ring-2 ring-primary-500/20"
 : "border-slate-line";
 const triggerClassName = `w-full rounded border bg-carbon-2 p-3 text-left transition-all bg-carbon-0 ${triggerBorderClassName}`;

 const toggleDropdown = () => {
 if (!isOpen && !resources) {
 void ensureCountryResources();
 }

 setIsOpen((open) => !open);
 setSearchValue("");
 };

 return (
 <div
 id="create-manager-field-nationality"
 ref={nationalityRef}
 className={isOpen ? "relative z-50" : undefined}
 >
 <label className="mb-1.5 block text-xs font-heading font-bold uppercase tracking-wider text-ink-dim">
 {t("createManager.countryOfOrigin")}
 </label>
 <div className="relative">
 <button
 type="button"
 onMouseDown={(event) => {
 event.preventDefault();
 event.stopPropagation();
 toggleDropdown();
 }}
 onClick={(event) => {
 if (event.detail === 0) {
 toggleDropdown();
 }
 }}
 className={triggerClassName}
 >
 <span
 className={
 nationality
 ? "text-ink"
 : "text-ink-faint"
 }
 >
 {selectedNationalityLabel ? (
 <span className="flex items-center gap-2">
 {Flag ? (
 <Flag
 code={nationality}
 locale={locale}
 className="text-lg leading-none"
 />
 ) : null}
 <span>{selectedNationalityLabel}</span>
 </span>
 ) : (
 t("createManager.selectCountry")
 )}
 </span>
 <ChevronDown
 className={`absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint transition-transform ${isOpen ? "rotate-180" : ""}`}
 />
 </button>

 {isOpen ? (
 <div className="absolute bottom-full left-0 right-0 z-50 mb-1 overflow-hidden rounded border border-slate-line bg-carbon-1 border-slate-line bg-carbon-2">
 {resources ? (
 <>
 <div className="border-b border-slate-line-soft p-2 border-slate-line">
 <input
 type="text"
 autoFocus
 placeholder={t("createManager.searchNationalities")}
 value={searchValue}
 onChange={(event) => setSearchValue(event.target.value)}
 className="w-full rounded-md border border-slate-line bg-carbon-2 px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-primary-500 border-slate-line bg-carbon-1 text-ink dark:placeholder:text-ink-faint"
 />
 </div>

 <div className="max-h-[min(20rem,calc(100vh-9rem))] overflow-y-auto overscroll-contain">
 {filteredNationalities.length === 0 ? (
 <p className="px-3 py-2 text-xs text-ink-faint">
 {t("menu.noResults")}
 </p>
 ) : (
 filteredNationalities.map((entry) => (
 <button
 key={entry.code}
 type="button"
 onMouseDown={(event) => {
 event.preventDefault();
 event.stopPropagation();
 onChange(entry.code);
 onClearError();
 setIsOpen(false);
 setSearchValue("");
 }}
 className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors ${nationality === entry.code
 ? "bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-400"
 : "text-ink hover:bg-carbon-2 text-ink hover:bg-carbon-3"
 }`}
 >
 <span className="flex items-center gap-2">
 <resources.CountryFlag
 code={entry.code}
 locale={locale}
 className="text-lg leading-none"
 />
 <span>{entry.name}</span>
 </span>
 {nationality === entry.code ? (
 <Check className="h-4 w-4 text-primary-500" />
 ) : null}
 </button>
 ))
 )}
 </div>
 </>
 ) : (
 <div className="flex min-h-24 items-center justify-center p-3">
 <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
 </div>
 )}
 </div>
 ) : null}
 </div>

 {error ? (
 <p className="mt-1 flex items-center gap-1 text-xs text-danger-500">
 <AlertCircle className="h-3 w-3" />
 {error}
 </p>
 ) : null}
 </div>
 );
}