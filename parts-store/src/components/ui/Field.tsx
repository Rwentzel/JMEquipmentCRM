import type {
  ReactNode,
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

type BaseProps = {
  label?: string;
  hint?: string;
  id?: string;
  className?: string;
};

type FieldProps =
  | ({ as?: "input" } & BaseProps & Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "className">)
  | ({ as: "textarea" } & BaseProps &
      Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id" | "className">)
  | ({ as: "select"; options?: { value: string; label: string }[] } & BaseProps &
      Omit<SelectHTMLAttributes<HTMLSelectElement>, "id" | "className">);

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/** JME Field — labelled form control (input / select / textarea), dark by default. */
export function Field(props: FieldProps) {
  const { label, hint, id, className = "" } = props;
  const fieldId = id || (label ? `f-${slug(label)}` : undefined);

  let control: ReactNode;
  if (props.as === "select") {
    const { as: _as, label: _l, hint: _h, id: _i, className: _c, options = [], ...rest } = props;
    control = (
      <select id={fieldId} className="jme-select" {...rest}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  } else if (props.as === "textarea") {
    const { as: _as, label: _l, hint: _h, id: _i, className: _c, ...rest } = props;
    control = <textarea id={fieldId} className="jme-textarea" {...rest} />;
  } else {
    const { as: _as, label: _l, hint: _h, id: _i, className: _c, ...rest } = props;
    control = <input id={fieldId} className="jme-input" {...rest} />;
  }

  return (
    <div className={cn("jme-field", className)}>
      {label && (
        <label className="jme-field__label" htmlFor={fieldId}>
          {label}
          {hint && <span className="hint"> · {hint}</span>}
        </label>
      )}
      {control}
    </div>
  );
}
