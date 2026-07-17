import type { JSX } from "react";
import { useTranslation } from "react-i18next";

import {
 CORE_POSITIONS,
 translatePositionAbbreviation,
} from "../squad/SquadTab.helpers";
import { Card, Select } from "../ui";

interface TacticsFiltersProps {
 onClear: () => void;
 onPlayerSearchChange: (value: string) => void;
 onPositionFilterChange: (value: string) => void;
 playerSearch: string;
 positionFilter: string;
}

function getClearButtonClassName(isEnabled: boolean): string {
 if (isEnabled) {
 return "rounded bg-carbon-2 px-3 py-2 text-xs font-heading font-bold uppercase tracking-wider text-ink-dim transition-all hover:bg-carbon-3 text-ink-dim hover:bg-carbon-3";
 }

 return "cursor-not-allowed rounded bg-carbon-2 px-3 py-2 text-xs font-heading font-bold uppercase tracking-wider text-ink-faint transition-all bg-carbon-2";
}

export default function TacticsFilters({
 onClear,
 onPlayerSearchChange,
 onPositionFilterChange,
 playerSearch,
 positionFilter,
}: TacticsFiltersProps): JSX.Element {
 const { t } = useTranslation();
 const canClear = playerSearch.trim().length > 0 || positionFilter !== "All";

 return (
 <Card>
 <div className="flex flex-col gap-2 p-3">
 <input
 type="text"
 value={playerSearch}
 onChange={(event) => onPlayerSearchChange(event.target.value)}
 placeholder={t("squad.filterPlayers")}
 className="w-full rounded border border-slate-line bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-primary-500/30 border-slate-line bg-carbon-1 text-ink"
 />
 <div className="flex gap-2">
 <Select
 value={positionFilter}
 onChange={(event) => onPositionFilterChange(event.target.value)}
 fullWidth
 >
 <option value="All">{t("common.all")}</option>
 {CORE_POSITIONS.map((position) => (
 <option key={position} value={position}>
 {translatePositionAbbreviation(t, position)}
 </option>
 ))}
 </Select>
 <button
 type="button"
 onClick={onClear}
 disabled={!canClear}
 className={getClearButtonClassName(canClear)}
 >
 {t("common.clear")}
 </button>
 </div>
 </div>
 </Card>
 );
}
