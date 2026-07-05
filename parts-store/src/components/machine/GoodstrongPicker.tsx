"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Diamond, Eyebrow } from "@/components/ui";
import { goodstrongModels } from "@/data/goodstrong";
import { SerialLookupModal } from "./SerialLookupModal";

export function GoodstrongPicker() {
  const router = useRouter();
  const [serialOpen, setSerialOpen] = useState(false);

  return (
    <div className="gs-page">
      <section className="ps-sec">
        <div className="ps-wrap">
          <div className="ps-sechd">
            <div>
              <Eyebrow>Goodstrong sheeters</Eyebrow>
              <h1 className="jme-h2">Find parts &amp; manuals for your sheeter</h1>
            </div>
            <p>Pick your model below, or enter your serial number and we&rsquo;ll take you straight there.</p>
          </div>

          <div className="gs-actions">
            <Button size="lg" variant="gold" onClick={() => setSerialOpen(true)}>
              I know my serial number
            </Button>
          </div>

          <div className="gs-modelgrid">
            {goodstrongModels.map((m) => (
              <a key={m.id} className="jme-card gs-modelcard" href={`/parts/goodstrong/${m.id}`}>
                <div className="gs-modelcard__photo">
                  <Diamond size={48} />
                  <span>Photo on request</span>
                </div>
                <div className="jme-card__body">
                  <h3>{m.label}</h3>
                  <p className="ps-fine">View manual sections, exploded-view diagrams, and order parts.</p>
                  <Button block variant="ghost">
                    View parts &amp; manual
                  </Button>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      <SerialLookupModal
        open={serialOpen}
        onClose={() => setSerialOpen(false)}
        onResolved={(modelId) => {
          setSerialOpen(false);
          router.push(`/parts/goodstrong/${modelId}`);
        }}
      />
    </div>
  );
}
