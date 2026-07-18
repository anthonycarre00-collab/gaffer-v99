import { CheckCircle2, Circle, Lightbulb } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Card, CardBody, CardHeader, ProgressBar } from "../ui";

export interface HomeOnboardingStep {
 id: string;
 done: boolean;
 label: string;
 description: string;
 tab: string;
 icon: React.ReactNode;
}

interface HomeOnboardingChecklistCardProps {
 completedSteps: number;
 totalSteps: number;
 steps: HomeOnboardingStep[];
 onNavigate?: (tab: string) => void;
}

export default function HomeOnboardingChecklistCard({
 completedSteps,
 totalSteps,
 steps,
 onNavigate,
}: HomeOnboardingChecklistCardProps) {
 const { t } = useTranslation();

 return (
 <Card accent="accent">
 <CardHeader>
 <div className="flex items-center gap-2">
 <Lightbulb className="w-4 h-4 text-accent-500" />
 {t("onboarding.title")}
 </div>
 </CardHeader>
 <CardBody>
 <p className="text-xs text-ink-dim mb-3">
 {t("onboarding.description")}
 </p>
 <div className="flex items-center gap-2 mb-4">
 <ProgressBar
 value={Math.round((completedSteps / totalSteps) * 100)}
 variant="accent"
 size="sm"
 />
 <span className="text-xs font-heading font-bold text-ink-dim flex-shrink-0">
 {completedSteps}/{totalSteps}
 </span>
 </div>
 <div className="flex flex-col gap-2">
 {steps.map((step) => (
 <button
 key={step.id}
 onClick={() => onNavigate?.(step.tab)}
 className={`flex items-center gap-3 p-3 rounded text-left transition-all ${
 step.done
 ? "bg-primary-50 dark:bg-primary-500/5 opacity-70"
 : "bg-carbon-2/50 hover:bg-carbon-2 hover:bg-carbon-3"
 }`}
 >
 <div
 className={`flex-shrink-0 ${step.done ? "text-primary-500" : "text-ink-faint"}`}
 >
 {step.done ? (
 <CheckCircle2 className="w-5 h-5" />
 ) : (
 <Circle className="w-5 h-5" />
 )}
 </div>
 <div
 className={`flex-shrink-0 ${step.done ? "text-primary-500" : "text-ink-dim"}`}
 >
 {step.icon}
 </div>
 <div className="min-w-0 flex-1">
 <p
 className={`text-sm font-heading font-bold ${step.done ? "text-ink-faint line-through" : "text-ink"}`}
 >
 {step.label}
 </p>
 <p className="text-xs text-ink-faint mt-0.5">
 {step.description}
 </p>
 </div>
 </button>
 ))}
 </div>
 </CardBody>
 </Card>
 );
}