import type { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "ghost" | "gold";
type Size = "sm" | "md" | "lg";

type CommonProps = {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
  children?: ReactNode;
  className?: string;
};

type ButtonProps = CommonProps & {
  as?: "button";
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "disabled" | "children" | "className">;

type AnchorProps = CommonProps & {
  as: "a";
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "children" | "className">;

/**
 * JME Button — condensed, uppercase, machined corners.
 * Primary = brand red. Ghost for secondary. Gold for "consult/override".
 */
export function Button(props: ButtonProps | AnchorProps) {
  const {
    variant = "primary",
    size = "md",
    block = false,
    disabled = false,
    icon = null,
    iconRight = null,
    children,
    className = "",
    ...rest
  } = props;

  const cls = cn(
    "jme-btn",
    variant === "ghost" && "jme-btn--ghost",
    variant === "gold" && "jme-btn--gold",
    size === "sm" && "jme-btn--sm",
    size === "lg" && "jme-btn--lg",
    block && "jme-btn--block",
    className,
  );

  if (props.as === "a") {
    const { as: _as, ...anchorRest } = rest as AnchorHTMLAttributes<HTMLAnchorElement> & {
      as?: string;
    };
    return (
      <a
        className={cls}
        aria-disabled={disabled || undefined}
        role="button"
        tabIndex={0}
        {...anchorRest}
      >
        {icon}
        {children}
        {iconRight}
      </a>
    );
  }

  const { as: _as, ...buttonRest } = rest as ButtonHTMLAttributes<HTMLButtonElement> & {
    as?: string;
  };
  return (
    <button className={cls} disabled={disabled} {...buttonRest}>
      {icon}
      {children}
      {iconRight}
    </button>
  );
}
