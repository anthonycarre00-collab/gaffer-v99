import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Trash2 } from "lucide-react";
import type { ManagerProfile } from "./types";

interface ManagerProfileListProps {
 profiles: ManagerProfile[];
 selectedProfileId?: string;
 onSelect: (profile: ManagerProfile) => void;
 onDelete: (id: string) => void;
}

export default function ManagerProfileList({ profiles, selectedProfileId, onSelect, onDelete }: ManagerProfileListProps) {
 const { t } = useTranslation();
 const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

 if (profiles.length === 0) {
 return null;
 }

 return (
 <div className="flex flex-col gap-2 max-h-[13.5rem] overflow-y-auto pr-0.5">
 {profiles.map((profile) => {
 const isSelected = profile.id === selectedProfileId;
 return (
 <div
 key={profile.id}
 className={`group relative flex items-center w-full rounded border transition-all duration-200 ${isSelected
 ? "bg-primary-50 dark:bg-primary-500/10 border-primary-400 dark:border-primary-500 ring-1 ring-primary-400/30"
 : "bg-carbon-2 border-slate-line hover:border-primary-400 dark:hover:border-primary-500 hover:bg-primary-50 hover:bg-carbon-3"
 }`}
 >
 <button
 type="button"
 onClick={() => { setConfirmDeleteId(null); onSelect(profile); }}
 className="flex-1 flex items-center gap-2.5 px-3 py-2.5 text-left min-w-0"
 >
 <div className="flex-1 flex items-center justify-between min-w-0">
 <span className={`font-heading font-bold text-sm uppercase tracking-wide truncate ${isSelected ? "text-primary-600 dark:text-primary-400" : "text-ink"}`}>
 {profile.first_name} {profile.last_name}
 </span>
 <span className="text-xs text-ink-faint ml-2 shrink-0">
 {profile.nationality} &middot; {profile.date_of_birth}
 </span>
 </div>
 <div className={`w-4 h-4 rounded-full bg-primary-500 flex items-center justify-center shrink-0 ${isSelected ? "visible" : "invisible"}`}>
 <div className="w-1.5 h-1.5 rounded-full bg-carbon-1" />
 </div>
 </button>

 <button
 type="button"
 aria-label={t("menu.delete")}
 onClick={() => setConfirmDeleteId(profile.id)}
 className="p-1.5 mr-2 rounded text-ink-faint hover:text-danger-500 dark:hover:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-500/10 transition-all shrink-0"
 >
 <Trash2 className="w-3.5 h-3.5" />
 </button>

 {confirmDeleteId === profile.id && (
 <div className={`absolute inset-0 flex items-center justify-end gap-1.5 px-3 rounded ${isSelected ? "bg-primary-50 dark:bg-primary-500/10" : "bg-carbon-2"}`}>
 <button
 type="button"
 onClick={() => { onDelete(profile.id); setConfirmDeleteId(null); }}
 className="px-2.5 py-1 bg-danger-500 hover:bg-danger-600 text-ink text-xs font-heading font-bold uppercase tracking-wider rounded transition-colors"
 >
 {t("menu.delete")}
 </button>
 <button
 type="button"
 onClick={() => setConfirmDeleteId(null)}
 className="px-2.5 py-1 bg-carbon-3 hover:bg-carbon-3 bg-carbon-1 dark:hover:bg-navy-900 text-ink-dim text-xs font-heading font-bold uppercase tracking-wider rounded transition-colors"
 >
 {t("menu.cancel")}
 </button>
 </div>
 )}
 </div>
 );
 })}
 </div>
 );
}
