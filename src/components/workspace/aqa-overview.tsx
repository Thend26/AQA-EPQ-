import type { DailyRecordObservationDraft } from "@/lib/domain/types";

const dimensions = [
  ["AO1 Manage", "ao1Note"],
  ["AO2 Use resources", "ao2Note"],
  ["AO3 Develop and realise", "ao3Note"],
  ["AO4 Review", "ao4Note"],
] as const;

export function AqaOverview({
  record,
}: {
  record?: DailyRecordObservationDraft | null;
}) {
  return (
    <section
      aria-labelledby="aqa-overview-title"
      className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm"
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
            AQA EPQ
          </p>
          <h2 id="aqa-overview-title" className="text-lg font-semibold">
            AO1–AO4 观察概览
          </h2>
        </div>
        <p className="max-w-52 text-right text-xs text-stone-500">
          仅汇总当日备注完整状态，不作为正式评定。
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {dimensions.map(([label, key]) => {
          const note = record?.[key]?.trim() ?? "";
          return (
            <article
              key={key}
              className="min-w-0 rounded-xl bg-stone-50 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-medium text-emerald-950">{label}</h3>
                <span
                  className={
                    note
                      ? "rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800"
                      : "rounded-full bg-orange-100 px-2 py-1 text-xs font-medium text-orange-800"
                  }
                >
                  {note ? "已记录" : "待补充"}
                </span>
              </div>
              <p className="mt-2 break-words text-sm text-stone-600">
                {note || "尚无当日观察备注"}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
