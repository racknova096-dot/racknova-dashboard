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

      <div className="relative p-6 md:p-8">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-sm border border-slate-200 text-slate-700 dark:bg-white/10 dark:border-white/20 dark:text-blue-50">
              <Icon className="h-4 w-4" />
              {badge}
            </div>

            <div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                {title}
              </h1>

              <p className="text-slate-600 mt-2 max-w-2xl dark:text-blue-100">
                {description}
              </p>
            </div>

            {children && (
              <div className="rounded-xl bg-white/75 border border-slate-200 p-4 max-w-3xl dark:bg-white/10 dark:border-white/15">
                <div className="text-sm leading-relaxed text-slate-700 dark:text-blue-50">
                  {children}
                </div>
              </div>
            )}
          </div>

          {actions && (
            <div className="flex flex-col sm:flex-row lg:flex-col gap-2 min-w-[220px]">
              {actions}
            </div>
          )}
        </div>

        {stats.length > 0 && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            {stats.map((stat) => {
              const tone = stat.tone ?? "default";

              return (
                <div
                  key={stat.label}
                  className="rounded-xl bg-white/75 border border-slate-200 p-4 dark:bg-white/10 dark:border-white/15"
                >
                  <p className="text-sm text-slate-500 dark:text-blue-100">
                    {stat.label}
                  </p>

                  <p
                    className={`text-2xl font-bold truncate ${statToneClass[tone]}`}
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
