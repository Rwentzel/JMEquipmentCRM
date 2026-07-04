"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="ps-error">
      <div className="ps-error__inner">
        <div className="jme-eyebrow ps-error__eyebrow">Something went wrong</div>
        <h1 className="ps-error__h1">Unexpected Error</h1>
        <p className="ps-error__p">
          We hit a problem loading this page. Try again, or call the parts desk at{" "}
          <a href="tel:(269) 659-0093" className="ps-error__tel">(269) 659-0093</a>.
        </p>
        <button onClick={reset} className="ps-error__btn">
          Try again
        </button>
      </div>
    </main>
  );
}
