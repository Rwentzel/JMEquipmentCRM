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
  error?: string;
  id?: string;
  className?: string;
};

type FieldProps =
  | ({ as?: "input" } & BaseProps & Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "className">)
  | ({ as: "textarea" } & BaseProps &
      Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id" | "className">)
  | ({ as: "select"; options?: { value: string; label: string }[] } & BaseProps &
      Omit<SelectHTMLAttributes<HTMLSelectElement>, "id" | "className">);

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export function Field(props: FieldProps) {
  const { label, hint, error, id, className } = props;
  const fieldId = id || (label ? `f-${slug(label)}` : undefined);
  const errId = error && fieldId ? `${fieldId}-err` : undefined;

  const aria: Record<string, string | boolean> = {};
  if (errId) aria["aria-describedby"] = errId;
  if (error) aria["aria-invalid"] = true;

  let control: ReactNode;

  if (props.as === "select") {
    const { as: _, label: _l, hint: _h, error: _e, id: _id, className: _c, options = [], ...rest } = props;
    control = (
      <select id={fieldId} className="jme-select" {...rest} {...aria}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    );
  } else if (props.as === "textarea") {
    const { as: _, label: _l, hint: _h, error: _e, id: _id, className: _c, ...rest } = props;
    control = <textarea id={fieldId} className="jme-textarea" {...rest} {...aria} />;
  } else {
    const { as: _, label: _l, hint: _h, error: _e, id: _id, className: _c, ...rest } = props;
    control = <input id={fieldId} className="jme-input" {...rest} {...aria} />;
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
      {error && (
        <span id={errId} className="ps-field-err" role="alert">{error}</span>
      )}
    </div>
  );
}
