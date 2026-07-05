"use client";

import { useState } from "react";
import { Button, Field } from "@/components/ui";
import { matchSerialToModel } from "@/data/goodstrong";
import { catalog } from "@/data/catalog";

export function SerialLookupModal({
  open,
  onClose,
  onResolved,
}: {
  open: boolean;
  onClose: () => void;
  onResolved: (modelId: string) => void;
}) {
  const [serial, setSerial] = useState("");
  const [notFound, setNotFound] = useState(false);

  if (!open) return null;

  function submit() {
    const match = matchSerialToModel(serial);
    if (match) {
      onResolved(match.id);
    } else {
      setNotFound(true);
    }
  }

  return (
    <div className="gs-modal-overlay" role="dialog" aria-modal="true" aria-label="Serial number lookup" onClick={onClose}>
      <div className="jme-card gs-modal" onClick={(e) => e.stopPropagation()}>
        <div className="jme-card__hd">
          <h3>Find your sheeter by serial number</h3>
          <button className="gs-modal__close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="jme-card__body">
          <Field
            label="Serial number"
            hint="from the machine's ID plate"
            placeholder="e.g. 1650-xxxx"
            value={serial}
            onChange={(e) => {
              setSerial(e.target.value);
              setNotFound(false);
            }}
            autoFocus
          />
          {notFound && (
            <p className="gs-modal__note gs-modal__note--warn">
              We couldn&rsquo;t match that serial number automatically yet. Call{" "}
              <a href={`tel:${catalog.contact.phone}`}>{catalog.contact.phone}</a> or{" "}
              <a href={`mailto:${catalog.contact.email}`}>{catalog.contact.email}</a> and the parts desk will confirm
              your model.
            </p>
          )}
          <div className="ps-actions">
            <Button onClick={submit} disabled={!serial.trim()}>
              Find my machine
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
