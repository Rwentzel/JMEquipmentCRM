"use client";

/**
 * Remembers the references of requests sent from THIS browser so a returning
 * customer can reorder in one click. Stores reference, date, and line count
 * only — never contact details — and stays entirely on the customer's device.
 */

const KEY = "jme_recent_requests_v1";
const MAX = 5;

export interface RecentRequest {
  ref: string;
  at: string;
  n: number;
}

export function readRecent(): RecentRequest[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(parsed) ? (parsed as RecentRequest[]).filter((r) => typeof r.ref === "string") : [];
  } catch {
    return [];
  }
}

export function rememberRequest(ref: string, n: number): void {
  try {
    const next = [{ ref, at: new Date().toISOString(), n }, ...readRecent().filter((r) => r.ref !== ref)].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // private mode / storage disabled — the confirmation still shows the reference
  }
}
