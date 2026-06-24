# RISK REGISTER — JM Equipment Parts Store (Sandbox)

**Date:** 2026-06-23
**Legend — Severity:** Critical / High / Medium / Low
**"Block production?"** = must be resolved before any public launch.

---

## 1. Data exposure risk
| Risk | Severity | Status | Why it matters | Mitigation | Block production? |
|------|----------|--------|----------------|------------|-------------------|
| Vendor / cost / margin / bin / supplier / QuickBooks fields leaking to the public tier | **Critical** | **Mitigated** | Exposes proprietary sourcing and margin; direct competitive/financial harm | Data model (`data/types.ts`) contains no such fields; nothing internal exists in the repo to leak. Keep an allowlist discipline on any future data import. | Yes (must stay true) |
| Budgetary machine price mistaken for a firm quote | High | Partially mitigated | Pricing/fulfillment liability | Labeled "budgetary, confirmed in writing" at every price; needs legal sign-off on wording | Yes |
| Future data import re-introducing internal columns | High | Open | Re-opens the critical risk above | Add a build-time allowlist sanitizer + test before any real catalog import | Yes |

## 2. Quote / order workflow risk
| Risk | Severity | Status | Why it matters | Mitigation | Block production? |
|------|----------|--------|----------------|------------|-------------------|
| Quote API is a stub — requests go nowhere | **High** | Open (by design) | Real customer requests would be silently lost | Wire email/CRM delivery before launch; until then keep sandbox/non-indexed | Yes |
| "Send request" reads as an order | Medium | Mitigated | Customer expectation / contract | Copy states "requests a firm written quotation — not a binding order" | No |

## 3. Pricing / inventory accuracy risk
| Risk | Severity | Status | Why it matters | Mitigation | Block production? |
|------|----------|--------|----------------|------------|-------------------|
| Static demo prices/availability drift from reality | High | Open | Wrong price/stock erodes trust, creates disputes | Source pricing/stock from system of record (QuickBooks) before launch; show "as of" dating | Yes |
| Availability labels ("In Stock", "2 Wk") not live | Medium | Open | Over-promising lead time | Mark as indicative; integrate real availability later | Yes |

## 4. Customer expectation risk
| Risk | Severity | Status | Why it matters | Mitigation | Block production? |
|------|----------|--------|----------------|------------|-------------------|
| "98% same-day", "37 years" claims unverified in code | Medium | Open | Unsupported marketing claims | Confirm claims with JM before publishing; keep substantiation on file | Yes |
| Compatibility/fit implied without verification | Medium | Mitigated | Wrong-part returns, liability | No automated cross-ref shown; compatibility only where verified | No |

## 5. Freight / shipping risk
| Risk | Severity | Status | Why it matters | Mitigation | Block production? |
|------|----------|--------|----------------|------------|-------------------|
| Freight-heavy/oversized parts allowing blind checkout | High | Mitigated (no checkout) | Unexpected freight cost/liability | No checkout exists; `purchasePath: freight-quote` modeled for gating | Yes (when checkout added) |
| FOB / freight terms unclear | Medium | Partially mitigated | Cost responsibility disputes | "FOB Sturgis, MI" shown; full freight policy page needed | Yes |

## 6. Payment / PO / tax-exempt risk
| Risk | Severity | Status | Why it matters | Mitigation | Block production? |
|------|----------|--------|----------------|------------|-------------------|
| No payment processing | Low | By design | Sandbox scope | Do not add until approved | N/A |
| No PO-terms / tax-exempt / account approval gating | High | Open | B2B terms, tax compliance | Implement account approval + B2BKing-style groups before transactional launch | Yes |

## 7. SEO / indexing risk
| Risk | Severity | Status | Why it matters | Mitigation | Block production? |
|------|----------|--------|----------------|------------|-------------------|
| Sandbox indexed by search engines | Medium | **Mitigated** | Premature/incorrect content indexed | `robots: noindex/nofollow` global + per page | Yes (flip only at launch) |

## 8. Accessibility risk
| Risk | Severity | Status | Why it matters | Mitigation | Block production? |
|------|----------|--------|----------------|------------|-------------------|
| Nav "jump" anchors not keyboard-focusable; partial ARIA | Medium | Open | WCAG 2.1 AA, ADA exposure | Convert to buttons/links with href; add ARIA; contrast audit | Yes |
| Muted-on-dark contrast unverified | Medium | Open | Readability/compliance | Run contrast audit, adjust tokens if needed | Yes |

## 9. Security risk
| Risk | Severity | Status | Why it matters | Mitigation | Block production? |
|------|----------|--------|----------------|------------|-------------------|
| Transitive npm advisories | Medium | Partially mitigated | Supply-chain exposure | Next pinned to patched 14.2.35; schedule `npm audit` review; consider Next 15 LTS later | Yes |
| No security headers / CSP | Medium | Open | XSS/clickjacking hardening | Add CSP, HSTS, X-Frame-Options via Next headers before launch | Yes |
| `dangerouslySetInnerHTML` in StatBlock | Low | Mitigated | XSS if data untrusted | Only fed static, in-repo strings; never user input | No |

## 10. Legal / compliance / disclaimer risk
| Risk | Severity | Status | Why it matters | Mitigation | Block production? |
|------|----------|--------|----------------|------------|-------------------|
| No Terms / Privacy / disclaimers | High | Open | Legal exposure | Add policy pages + review before launch | Yes |
| Rush-fee schedule not disclosed pre-submit | Medium | Open | Surprise fees | Disclose rush terms before order submission (see checklist §11) | Yes (when rush added) |

## 11. Production deployment risk
| Risk | Severity | Status | Why it matters | Mitigation | Block production? |
|------|----------|--------|----------------|------------|-------------------|
| Deployed before approval | High | **Controlled** | Premature exposure | No remote deploy performed; sandbox only per instruction | Yes |
| No env/secrets management | Medium | Open | Future integrations need secure secrets | Add `.env` strategy + secret store when integrations approved | Yes |

## 12. QuickBooks / WooCommerce integration risk
| Risk | Severity | Status | Why it matters | Mitigation | Block production? |
|------|----------|--------|----------------|------------|-------------------|
| Data model may not map cleanly to Woo/QB | Medium | Partially mitigated | Rework cost later | SKU-keyed, public-only model designed to map to Woo products + QB items; write a mapping spec | No |
| Live QB/Woo connected prematurely | High | Controlled | Source-of-truth corruption | Explicitly not connected; QuickBooks Desktop Enterprise 2024 remains source of truth | Yes |

## 13. Maintainability risk
| Risk | Severity | Status | Why it matters | Mitigation | Block production? |
|------|----------|--------|----------------|------------|-------------------|
| CSS reconstructed (not original) may drift from design intent | Medium | Open | Visual fidelity / future edits | Tokenized CSS; do a visual QA pass vs mockups; keep tokens as single source | No |
| Two apps (Electron CRM + Next store) in one repo | Low | Accepted | Contributor confusion | Clear directory separation; document in README | No |
| No automated tests yet | Medium | Open | Regressions | Add unit tests for data-protection + API validation; consider Playwright | No |
