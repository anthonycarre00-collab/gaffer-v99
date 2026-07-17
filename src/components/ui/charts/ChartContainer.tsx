import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

interface ChartContainerProps {
 children?: ReactNode;
 height?: number;
 isEmpty?: boolean;
 className?: string;
}

export function ChartContainer({
 children,
 height = 220,
 isEmpty = false,
 className = "",
}: ChartContainerProps) {
 const { t } = useTranslation();

 if (isEmpty) {
 return (
 <div
 className={`flex items-center justify-center rounded bg-carbon-2 ${className}`}
 style={{ height }}
 >
 <p className="text-xs text-ink-faint font-heading uppercase tracking-wider">
 {t("common.noChartData")}
 </p>
 </div>
 );
 }

 return (
 <div className={`w-full ${className}`} style={{ height }}>
 {children}
 </div>
 );
}
