import React from "react";
import { LucideIcon } from "lucide-react";

interface PageHeroStat {
  label: string;
  value: React.ReactNode;
  tone?: "default" | "blue" | "green" | "red" | "amber" | "purple" | "cyan";
}

interface PageHeroProps {
  badge: string;
  title: string;
  description: string;
  icon: LucideIcon;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  stats?: PageHeroStat[];
}

const statToneClass: Record<NonNullable<PageHeroStat["tone"]>, string> = {
  default: "text-slate-950 dark:text-white",
  blue: "text-blue-600 dark:text-cyan-300",
  green: "text-emerald-600 dark:text-emerald-300",
  red: "text-red-600 dark:text-red-300",
  amber: "text-amber-600 dark:text-amber-300",
  purple: "text-purple-600 dark:text-purple-300",
  cyan: "text-cyan-600 dark:text-cyan-300",
};

export function PageHero({
  badge,
  title,
  description,
  icon: Icon,
  children,
  actions,
  stats = [],
}: PageHeroProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-blue-50 via-white to-slate-100 text-slate-950 shadow-xl dark:from-slate-950 dark:via-blue-950 dark:to-slate-900 dark:text-white">
      <div className="absolute -top-20 -right-20 h-56 w-56 rounded-full bg-blue-500/20 blur-3xl dark:bg-blue-500/30" />
      <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-cyan-500/20 blur-3xl dark:bg-emerald-500/20" />

      <div className="relative p-3.5 sm:p-6 md:p-8">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start lg:gap-6">
          <div className="space-y-2.5 sm:space-y-3">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/70 px-2.5 py-1 text-xs text-slate-700 sm:gap-2 sm:px-3 sm:text-sm dark:border-white/20 dark:bg-white/10 dark:text-blue-50">
              <Icon className="h-4 w-4" />
              {badge}
            </div>

            <div>
              <h1 className="text-[1.65rem] font-bold leading-tight tracking-tight sm:text-3xl md:text-4xl">
                {title}
              </h1>

              <p className="mt-1.5 max-w-2xl text-sm leading-5 text-slate-600 sm:mt-2 sm:text-base sm:leading-6 dark:text-blue-100">
                {description}
              </p>
            </div>

            {children && (
              <div className="hidden max-w-3xl rounded-xl border border-slate-200 bg-white/75 p-4 sm:block dark:border-white/15 dark:bg-white/10">
                <div className="text-sm leading-relaxed text-slate-700 dark:text-blue-50">
                  {children}
                </div>
              </div>
            )}
          </div>

          {actions && (
            <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto lg:min-w-[220px] lg:flex-col">
              {actions}
            </div>
          )}
        </div>

        {stats.length > 0 && (
          <div className="mt-4 grid auto-cols-[minmax(132px,1fr)] grid-flow-col gap-2 overflow-x-auto pb-1 sm:auto-cols-[minmax(150px,1fr)] md:mt-6 md:grid-flow-row md:grid-cols-4 md:gap-4 md:overflow-visible md:pb-0">
            {stats.map((stat) => {
              const tone = stat.tone ?? "default";

              return (
                <div
                  key={stat.label}
                  className="min-w-0 rounded-xl border border-slate-200 bg-white/75 p-2.5 sm:p-4 dark:border-white/15 dark:bg-white/10"
                >
                  <p className="truncate text-xs text-slate-500 sm:text-sm dark:text-blue-100">
                    {stat.label}
                  </p>

                  <p
                    className={`truncate text-lg font-bold sm:text-2xl ${statToneClass[tone]}`}
                  >
                    {stat.value}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
