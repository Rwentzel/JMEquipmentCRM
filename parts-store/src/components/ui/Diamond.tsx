/** Branded diamond mark. Falls back to a CSS-drawn lockup (no image asset required). */
export function Diamond({ size = 34 }: { size?: number }) {
  return (
    <span className="jme-mark" style={{ width: size, height: size, flexBasis: size }} aria-label="JME">
      <span>JME</span>
    </span>
  );
}
