import { useTranslation } from "react-i18next";
import { formatDate } from "../../lib/helpers";
import { Play, Clock, Trash2, X, Loader2 } from "lucide-react";

interface SaveEntry {
 id: string;
 name: string;
 manager_name: string;
 team_name: string;
 db_filename: string;
 checksum: string;
 created_at: string;
 last_played_at: string;
}

interface SavesListProps {
 saves: SaveEntry[];
 isLoading: boolean;
 loadingSaveId?: string | null;
 confirmDeleteId: string | null;
 onLoad: (saveId: string) => void;
 onDelete: (saveId: string) => void;
 onConfirmDelete: (saveId: string | null) => void;
 onClose: () => void;
}

export default function SavesList({ saves, isLoading, loadingSaveId, confirmDeleteId, onLoad, onDelete, onConfirmDelete, onClose }: SavesListProps) {
 const { t, i18n } = useTranslation();

 return (
 <div className="flex flex-col gap-4">
 <div className="flex justify-between items-center mb-2">
 <h2 className="text-xl font-heading font-bold uppercase tracking-wide text-ink transition-colors">
 {t('menu.loadGame')}
 </h2>
 <button 
 type="button" 
 onClick={onClose}
 className="text-ink-faint hover:text-ink transition-colors p-1 rounded hover:bg-carbon-2 hover:bg-carbon-3"
 >
 <X className="w-5 h-5" />
 </button>
 </div>
 
 <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto pr-1">
 {isLoading ? (
 <div className="flex flex-col items-center gap-3 py-8 text-ink-dim"><Loader2 className="w-8 h-8 animate-spin text-primary-500" /><span className="text-sm font-heading uppercase tracking-wider">{t('menu.loadingSaves')}</span></div>
 ) : saves.length === 0 ? (
 <div className="text-ink-dim text-center py-8">{t('menu.noSaves')}</div>
 ) : (
 saves.map(save => (
 <div key={save.id} className="group relative flex flex-col gap-2 w-full p-4 bg-carbon-2 hover:bg-primary-50 hover:bg-carbon-3 text-left rounded transition-all duration-200 border border-slate-line hover:border-primary-400 dark:hover:border-primary-500 shadow-sm">
 {confirmDeleteId === save.id ? (
 <div className="flex flex-col gap-2">
 <p className="text-sm text-ink-dim">{t('menu.deleteConfirm', { name: save.name })}</p>
 <div className="flex gap-2">
 <button
 onClick={() => onDelete(save.id)}
 className="flex-1 py-2 bg-danger-500 hover:bg-danger-600 text-ink text-sm font-heading font-bold uppercase tracking-wider rounded transition-colors"
 >
 {t('menu.delete')}
 </button>
 <button
 onClick={() => onConfirmDelete(null)}
 className="flex-1 py-2 bg-carbon-3 hover:bg-carbon-3 dark:hover:bg-navy-500 text-ink-dim text-sm font-heading font-bold uppercase tracking-wider rounded transition-colors"
 >
 {t('menu.cancel')}
 </button>
 </div>
 </div>
 ) : (
 <div className="flex items-center gap-3 w-full">
 <button
 onClick={() => onLoad(save.id)}
 className="flex flex-col gap-2 flex-1 text-left min-w-0"
 >
 <div className="flex justify-between items-center w-full">
 <span className="font-heading font-bold text-ink text-lg uppercase tracking-wide truncate">{save.name}</span>
 {loadingSaveId === save.id ? <Loader2 className="w-4 h-4 text-primary-500 animate-spin flex-shrink-0" /> : <Play className="w-4 h-4 text-primary-500 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0" />}
 </div>
 <div className="flex justify-between items-center w-full text-sm text-ink-dim">
 <span>{save.team_name.trim() || t('managersWorld.unemployed')}</span>
 <div className="flex items-center gap-1">
 <Clock className="w-3 h-3" />
 <span>{formatDate(save.last_played_at, i18n.language)}</span>
 </div>
 </div>
 </button>
 <button
 onClick={(e) => { e.stopPropagation(); onConfirmDelete(save.id); }}
 className="p-1.5 rounded text-ink-faint hover:text-danger-500 dark:hover:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-500/10 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
 title={t('menu.deleteSave')}
 >
 <Trash2 className="w-4 h-4" />
 </button>
 </div>
 )}
 </div>
 ))
 )}
 </div>
 </div>
 );
}
