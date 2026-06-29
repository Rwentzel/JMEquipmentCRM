"use client";

import { Button, Diamond, Eyebrow, StatusBand, Tag, Toast } from "@/components/ui";
import { useRequestList } from "@/hooks/useRequestList";
import { useToast } from "@/hooks/useToast";
import { actionLabel } from "@/lib/utils";
import type { RfqAction, StatusBand as Band, TagTone } from "@/data/types";

export interface CompareRow {
  sku: string;
  name: string;
  family: string;
  statusBand: Band;
  tagLabel: string;
  tag: TagTone;
  action: RfqAction;
  spec1: string;
  spec2: string;
  power: string;
  apps: string;
}

/** Distinct values in a row of cells get the `diff` highlight. */
function diffFlags(values: string[]): boolean[] {
  const counts = new Map<string, number>();
  values.forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1));
  return values.map((v) => (counts.get(v) ?? 0) === 1);
}

export function CompareClient({ rows }: { rows: CompareRow[] }) {
  const { add, count } = useRequestList();
  const { message, show } = useToast();

  const attrRows: { label: string; values: string[] }[] = [
    { label: "Family", values: rows.map((r) => r.family) },
    { label: "Key spec", values: rows.map((r) => r.spec1) },
    { label: "Secondary", values: rows.map((r) => r.spec2) },
    { label: "Power / rate", values: rows.map((r) => r.power) },
    { label: "Applications", values: rows.map((r) => r.apps) },
  ];

  return (
    <div>
      <div className="cmp-top">
        <div className="cmp-top__in">
          <a className="brand" href="/">
            <Diamond size={28} />
            <span>
              <b>JM Equipment</b>
              <small>Converting Machinery Solutions</small>
            </span>
          </a>
          <div className="cmp-top__nav">
            <a href="/">Storefront</a>
            <Button size="sm" as="a" href="/#request">
              Request List{count > 0 ? ` · ${count}` : ""}
            </Button>
          </div>
        </div>
      </div>

      <div className="cmp-head">
        <div className="cmp-head__in">
          <Eyebrow>Compare the line</Eyebrow>
          <h1 className="cmp-h1">Machine comparison</h1>
          <p style={{ color: "var(--paper-dim)", maxWidth: "70ch" }}>
            Every machine is quoted individually. Pricing, freight, and lead time are confirmed in writing on your
            request — not shown online.
          </p>
          <div style={{ marginTop: 16 }}>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                rows.forEach((r) => add({ sku: r.sku, name: r.name }));
                show(`Added ${rows.length} machines to request`);
              }}
            >
              Add all {rows.length} machines to request
            </Button>
          </div>
        </div>
      </div>

      <div className="cmp-wrap">
        <div className="cmp-scroll-hint">← Scroll to compare →</div>
        <table className="cmp-table">
          <thead>
            <tr>
              <th />
              {rows.map((r) => (
                <th key={r.sku} scope="col">
                  <h3>
                    <a href={`/machine/${r.sku}`} style={{ color: "inherit" }}>{r.name}</a>
                  </h3>
                  <div className="cmp-sku">{r.sku}</div>
                  <div style={{ marginTop: 6 }}>
                    <Tag tone={r.tag}>{r.tagLabel}</Tag>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="cmp-attr">Availability</td>
              {rows.map((r) => (
                <td key={r.sku} className="cmp-val">
                  <StatusBand band={r.statusBand} />
                </td>
              ))}
            </tr>
            {attrRows.map((ar) => {
              const flags = diffFlags(ar.values);
              return (
                <tr key={ar.label}>
                  <td className="cmp-attr">{ar.label}</td>
                  {ar.values.map((v, i) => (
                    <td key={i} className={"cmp-val" + (flags[i] ? " diff" : "")}>
                      {v}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td />
              {rows.map((r) => (
                <td key={r.sku}>
                  <Button
                    size="sm"
                    block
                    onClick={() => {
                      add({ sku: r.sku, name: r.name });
                      show("Added to request");
                    }}
                  >
                    {actionLabel(r.action)}
                  </Button>
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      <div className={"ps-toastwrap" + (message ? " show" : "")} role="status" aria-live="polite">
        {message && <Toast tone="green">{message}</Toast>}
      </div>
    </div>
  );
}
