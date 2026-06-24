import type { DetailStat } from "@/data/types";

/** JME StatBlock — row of big condensed numerals for ROI / impact figures. */
export function StatBlock({ stats = [] }: { stats?: DetailStat[] }) {
  return (
    <div className="jme-stats">
      {stats.map((s, i) => (
        <div className="jme-stat" key={i}>
          {s.html ? (
            <b className="jme-stat__value" dangerouslySetInnerHTML={{ __html: s.html }} />
          ) : (
            <b className="jme-stat__value">{s.value}</b>
          )}
          <span className="jme-stat__label">{s.label}</span>
        </div>
      ))}
    </div>
  );
}
