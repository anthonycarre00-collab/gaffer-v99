import { Suspense, lazy, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, DatePicker, Select } from "../ui";
import { AlertCircle, ChevronRight, ChevronDown, X } from "lucide-react";
import ManagerProfileList from "./ManagerProfileList";
import type { ManagerProfile } from "./types";

const CreateManagerNationalityField = lazy(
 () => import("./CreateManagerNationalityField"),
);

export interface CreateManagerFormData {
 firstName: string;
 lastName: string;
 dob: string;
 startYear: string;
 startPhase: CareerStartPhase;
 nationality: string;
}

export type CareerStartPhase = "seasonStart" | "midSeason";

type CreateManagerField = keyof CreateManagerFormData;

interface CreateManagerFormProps {
 formData: CreateManagerFormData;
 formErrors: Partial<Record<CreateManagerField, string>>;
 dobError: string | null;
 profiles: ManagerProfile[];
 selectedProfileId?: string;
 onChange: (field: CreateManagerField, value: string) => void;
 onClearError: (field: CreateManagerField) => void;
 onClose: () => void;
 onSelectProfile: (profile: ManagerProfile) => void;
 onDeleteProfile: (id: string) => void;
 onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}

function NationalityFieldFallback({
 error,
}: {
 error?: string;
}) {
 const { t } = useTranslation();

 return (
 <div id="create-manager-field-nationality">
 <label className="mb-1.5 block text-xs font-heading font-bold uppercase tracking-wider text-ink-dim">
 {t("createManager.countryOfOrigin")}
 </label>
 <div className="relative">
 <button
 type="button"
 disabled
 className={`w-full rounded border bg-carbon-2 p-3 text-left transition-all bg-carbon-0 ${error
 ? "border-danger-400 dark:border-danger-500"
 : "border-slate-line"
 }`}
 >
 <span className="text-ink-faint">
 {t("createManager.selectCountry")}
 </span>
 </button>
 <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
 <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
 </div>
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

export default function CreateManagerForm({
 formData,
 formErrors,
 dobError,
 profiles,
 selectedProfileId,
 onChange,
 onClearError,
 onClose,
 onSelectProfile,
 onDeleteProfile,
 onSubmit,
}: CreateManagerFormProps) {
 const { t, i18n } = useTranslation();
 const [showAdvanced, setShowAdvanced] = useState(false);

 return (
 <form onSubmit={onSubmit} className="flex flex-col gap-4">
 <div className="mb-2 flex items-center justify-between">
 <h2 className="text-xl font-heading font-bold uppercase tracking-wide text-ink transition-colors text-ink">
 {t("createManager.title")}
 </h2>
 <button
 type="button"
 onClick={onClose}
 className="rounded p-1 text-ink-faint transition-colors hover:bg-carbon-2 hover:text-ink hover:bg-carbon-3 hover:text-ink"
 >
 <X className="h-5 w-5" />
 </button>
 </div>

 <div className="mb-1 flex items-center gap-2">
 <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-500 text-xs font-bold text-white">
 1
 </div>
 <div className="h-0.5 flex-1 bg-carbon-3" />
 <div className="flex h-6 w-6 items-center justify-center rounded-full bg-carbon-3 text-xs font-bold text-ink-faint bg-carbon-3 text-ink-faint">
 2
 </div>
 </div>

 <ManagerProfileList
 profiles={profiles}
 selectedProfileId={selectedProfileId}
 onSelect={onSelectProfile}
 onDelete={onDeleteProfile}
 />

 <div className="flex gap-3">
 <div className="flex-1" id="create-manager-field-firstName">
 <label className="mb-1.5 block text-xs font-heading font-bold uppercase tracking-wider text-ink-dim">
 {t("createManager.firstName")}
 </label>
 <input
 maxLength={30}
 className={`w-full rounded border bg-carbon-2 p-3 text-ink outline-none transition-all placeholder:text-ink-faint focus:ring-2 bg-carbon-0 text-ink dark:placeholder:text-ink-faint ${formErrors.firstName
 ? "border-danger-400 focus:border-danger-500 focus:ring-danger-500/20 dark:border-danger-500"
 : "border-slate-line focus:border-primary-500 focus:ring-primary-500/20 border-slate-line"
 }`}
 placeholder={t("createManager.placeholderFirst")}
 value={formData.firstName}
 onChange={(event) => {
 onChange("firstName", event.target.value);
 onClearError("firstName");
 }}
 />
 {formErrors.firstName ? (
 <p className="mt-1 flex items-center gap-1 text-xs text-danger-500">
 <AlertCircle className="h-3 w-3" />
 {formErrors.firstName}
 </p>
 ) : null}
 </div>

 <div className="flex-1" id="create-manager-field-lastName">
 <label className="mb-1.5 block text-xs font-heading font-bold uppercase tracking-wider text-ink-dim">
 {t("createManager.lastName")}
 </label>
 <input
 maxLength={30}
 className={`w-full rounded border bg-carbon-2 p-3 text-ink outline-none transition-all placeholder:text-ink-faint focus:ring-2 bg-carbon-0 text-ink dark:placeholder:text-ink-faint ${formErrors.lastName
 ? "border-danger-400 focus:border-danger-500 focus:ring-danger-500/20 dark:border-danger-500"
 : "border-slate-line focus:border-primary-500 focus:ring-primary-500/20 border-slate-line"
 }`}
 placeholder={t("createManager.placeholderLast")}
 value={formData.lastName}
 onChange={(event) => {
 onChange("lastName", event.target.value);
 onClearError("lastName");
 }}
 />
 {formErrors.lastName ? (
 <p className="mt-1 flex items-center gap-1 text-xs text-danger-500">
 <AlertCircle className="h-3 w-3" />
 {formErrors.lastName}
 </p>
 ) : null}
 </div>
 </div>

 <div id="create-manager-field-dob">
 <label className="mb-1.5 block text-xs font-heading font-bold uppercase tracking-wider text-ink-dim">
 {t("createManager.dob")}
 </label>
 <DatePicker
 value={formData.dob}
 onChange={(value) => {
 onChange("dob", value);
 onClearError("dob");
 }}
 error={Boolean(dobError)}
 />
 {dobError ? (
 <p className="mt-1 flex items-center gap-1 text-xs text-danger-500">
 <AlertCircle className="h-3 w-3 shrink-0" />
 {dobError}
 </p>
 ) : null}
 </div>

 {/* Advanced options — collapsible */}
 <div className="rounded border border-slate-line">
 <button
 type="button"
 onClick={() => setShowAdvanced(!showAdvanced)}
 className="flex w-full items-center justify-between p-3 text-left text-xs font-heading font-bold uppercase tracking-wider text-ink-faint transition-colors hover:text-ink text-ink-faint hover:text-ink"
 >
 {t("createManager.advancedOptions")}
 <ChevronDown
 className={`h-4 w-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`}
 />
 </button>
 {showAdvanced && (
 <div className="flex gap-3 border-t border-slate-line p-3 border-slate-line">
 <div className="flex-1" id="create-manager-field-startYear">
 <label
 htmlFor="create-manager-start-year"
 className="mb-1.5 block text-xs font-heading font-bold uppercase tracking-wider text-ink-dim"
 >
 {t("createManager.startYear")}
 </label>
 <input
 id="create-manager-start-year"
 aria-label={t("createManager.startYear")}
 type="text"
 pattern="[0-9]*"
 inputMode="numeric"
 className={`w-full rounded border bg-carbon-2 p-3 text-ink outline-none transition-all placeholder:text-ink-faint focus:ring-2 bg-carbon-0 text-ink dark:placeholder:text-ink-faint ${formErrors.startYear
 ? "border-danger-400 focus:border-danger-500 focus:ring-danger-500/20 dark:border-danger-500"
 : "border-slate-line focus:border-primary-500 focus:ring-primary-500/20 border-slate-line"
 }`}
 value={formData.startYear}
 onChange={(event) => {
 onChange("startYear", event.target.value);
 onClearError("startYear");
 }}
 />
 {formErrors.startYear ? (
 <p className="mt-1 flex items-center gap-1 text-xs text-danger-500">
 <AlertCircle className="h-3 w-3" />
 {formErrors.startYear}
 </p>
 ) : null}
 </div>

 <div className="flex-1" id="create-manager-field-startPhase">
 <label className="mb-1.5 block text-xs font-heading font-bold uppercase tracking-wider text-ink-dim">
 {t("createManager.startPhase")}
 </label>
 <Select
 id="create-manager-start-phase"
 aria-label={t("createManager.startPhase")}
 fullWidth
 value={formData.startPhase}
 className={formErrors.startPhase
 ? "border-danger-400 focus:border-danger-500 focus:ring-danger-500/20 dark:border-danger-500"
 : ""
 }
 onChange={(event) => {
 onChange("startPhase", event.target.value as CareerStartPhase);
 onClearError("startPhase");
 }}
 >
 <option value="seasonStart">{t("createManager.phaseSeasonStart")}</option>
 <option value="midSeason">{t("createManager.phaseMidSeason")}</option>
 </Select>
 {formErrors.startPhase ? (
 <p className="mt-1 flex items-center gap-1 text-xs text-danger-500">
 <AlertCircle className="h-3 w-3" />
 {formErrors.startPhase}
 </p>
 ) : null}
 </div>
 </div>
 )}
 </div>

 <Suspense
 fallback={<NationalityFieldFallback error={formErrors.nationality} />}
 >
 <CreateManagerNationalityField
 nationality={formData.nationality}
 error={formErrors.nationality}
 locale={i18n.language}
 onChange={(value) => onChange("nationality", value)}
 onClearError={() => onClearError("nationality")}
 />
 </Suspense>

 <Button
 type="submit"
 variant="primary"
 size="lg"
 className="mt-2 w-full"
 iconRight={<ChevronRight />}
 >
 {t("createManager.chooseWorld")}
 </Button>
 </form>
 );
}