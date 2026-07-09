/**
 * useSortableTable — reusable hook for adding click-to-sort behaviour to any
 * table. Returns the current sort state + a sort direction indicator + a
 * comparator you can pass to Array.prototype.sort.
 *
 * Usage:
 *   const { sortKey, sortDir, toggleSort, sortedRows } = useSortableTable(
 *     rows,
 *     { initialKey: 'name', initialDir: 'asc' }
 *   );
 *
 * Then in your table header:
 *   <SortableHeader
 *     label="Player"
 *     columnKey="name"
 *     sortKey={sortKey}
 *     sortDir={sortDir}
 *     onSort={toggleSort}
 *   />
 *
 * The hook attempts to compare values numerically when both sides parse as
 * numbers, otherwise falls back to string comparison (case-insensitive).
 * For unknown / null values, sorts them last in either direction.
 */

import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";

export type SortDir = "asc" | "desc" | null;

export interface UseSortableTableOptions {
 initialKey?: string;
 initialDir?: SortDir;
}

export interface UseSortableTableResult<T> {
 sortKey: string | null;
 sortDir: SortDir;
 toggleSort: (key: string) => void;
 sortedRows: T[];
}

function compareValues(a: unknown, b: unknown): number {
 // null / undefined sorts last regardless of direction.
 if (a == null && b == null) return 0;
 if (a == null) return 1;
 if (b == null) return -1;

 // Try numeric comparison first.
 const na = typeof a === "number" ? a : Number(a);
 const nb = typeof b === "number" ? b : Number(b);
 if (!Number.isNaN(na) && !Number.isNaN(nb) && typeof a !== "boolean" && typeof b !== "boolean") {
 return na - nb;
 }

 // Fallback: case-insensitive string compare.
 const sa = String(a).toLowerCase();
 const sb = String(b).toLowerCase();
 if (sa < sb) return -1;
 if (sa > sb) return 1;
 return 0;
}

export function useSortableTable<T extends Record<string, unknown>>(
 rows: T[],
 options: UseSortableTableOptions = {},
): UseSortableTableResult<T> {
 const [sortKey, setSortKey] = useState<string | null>(options.initialKey ?? null);
 const [sortDir, setSortDir] = useState<SortDir>(options.initialDir ?? null);

 const toggleSort = (key: string) => {
 if (sortKey !== key) {
 setSortKey(key);
 setSortDir("asc");
 return;
 }
 // Same column: cycle asc → desc → null.
 if (sortDir === "asc") {
 setSortDir("desc");
 } else if (sortDir === "desc") {
 setSortKey(null);
 setSortDir(null);
 } else {
 setSortDir("asc");
 }
 };

 const sortedRows = useMemo(() => {
 if (!sortKey || !sortDir) return rows;
 const copy = [...rows];
 copy.sort((a, b) => {
 const av = a[sortKey];
 const bv = b[sortKey];
 const cmp = compareValues(av, bv);
 return sortDir === "asc" ? cmp : -cmp;
 });
 return copy;
 }, [rows, sortKey, sortDir]);

 return { sortKey, sortDir, toggleSort, sortedRows };
}

interface SortableHeaderProps {
 label: ReactNode;
 columnKey: string;
 sortKey: string | null;
 sortDir: SortDir;
 onSort: (key: string) => void;
 className?: string;
 /** Right-align numeric columns. */
 numeric?: boolean;
}

/**
 * Sortable table header cell. Renders a clickable <th> with an arrow
 * indicator. Drop into any existing <thead> — does not change the table
 * layout otherwise.
 */
export function SortableHeader({
 label,
 columnKey,
 sortKey,
 sortDir,
 onSort,
 className = "",
 numeric = false,
}: SortableHeaderProps) {
 const isActive = sortKey === columnKey && sortDir !== null;
 return (
 <th
 scope="col"
 className={`select-none ${numeric ? "text-right" : "text-left"} ${
 isActive ? "text-accent-600 dark:text-accent-400" : ""
 } ${className}`}
 >
 <button
 type="button"
 onClick={() => onSort(columnKey)}
 className={`inline-flex items-center gap-1 font-heading text-xs font-bold uppercase tracking-wider transition-colors ${
 numeric ? "flex-row-reverse" : ""
 } ${isActive ? "text-accent-600 dark:text-accent-400" : "hover:text-accent-500"}`}
 aria-sort={isActive ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
 >
 <span>{label}</span>
 {isActive && sortDir === "asc" ? (
 <ChevronUp className="h-3 w-3" />
 ) : isActive && sortDir === "desc" ? (
 <ChevronDown className="h-3 w-3" />
 ) : (
 <ChevronsUpDown className="h-3 w-3 opacity-30" />
 )}
 </button>
 </th>
 );
}
