"use client";

import { Badge, Button, Diamond, Eyebrow, Tag, Toast } from "@/components/ui";
import { useRequestList } from "@/hooks/useRequestList";
import { useToast } from "@/hooks/useToast";
import { usd } from "@/lib/utils";
import type { TagTone } from "@/data/types";

export interface CompareRow {
  sku: string;
  name: string;
  family: string;
  leadTime: string;
  basePrice: number | null;
  tagLabel: string;
  tag: TagTone;
  spec1Label: string;
  spec1: string;
  spec2Label: string;
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

  const attrRows: { label: string; values: string[]; mono?: boolean }[] = [
    { label: "Family", values: rows.map((r) => r.family) },
    { label: "Availability", values: rows.map((r) => r.leadTime) },
    {
      label: "Budgetary base",
      values: rows.map((r) => (r.basePrice == null ? "Quote" : usd(r.basePrice))),
      mono: true,
    },
    { label: "Key spec", values: rows.map((r) => `${r.spec1}`), mono: true },
    { label: "Secondary", values: rows.map((r) => `${r.spec2}`), mono: true },
    { label: "Power / rate", values: rows.map((r) => r.power), mono: true },
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
            Budgetary base prices are indicative only and exclude options, freight, and tax. Every machine is quoted
            individually and confirmed in writing.
          </p>
        </div>
      </div>

      <div className="cmp-wrap">
        <table className="cmp-table">
          <thead>
            <tr>
              <th />
              {rows.map((r) => (
                <th key={r.sku}>
                  <h3>{r.name}</h3>
                  <div className="cmp-sku">{r.sku}</div>
                  <div style={{ marginTop: 6 }}>
                    <Tag tone={r.tag}>{r.tagLabel}</Tag>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {attrRows.map((ar) => {
              const flags = diffFlags(ar.values);
              return (
                <tr key={ar.label}>
                  <td className="cmp-attr">{ar.label}</td>
                  {ar.values.map((v, i) => (
                    <td key={i} className={"cmp-val" + (ar.mono ? "" : "") + (flags[i] ? " diff" : "")}>
                      {ar.label === "Availability" ? <Badge status="default">{v}</Badge> : v}
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
                      add({ sku: r.sku, name: r.name, price: null });
                      show("Added to request");
                    }}
                  >
                    Add to request
                  </Button>
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      <div className={"ps-toastwrap" + (message ? " show" : "")}>
        {message && <Toast tone="green">{message}</Toast>}
      </div>
    </div>
  );
}
