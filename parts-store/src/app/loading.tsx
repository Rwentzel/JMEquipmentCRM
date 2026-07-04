export default function Loading() {
  return (
    <main className="ps-skeleton" aria-busy="true" aria-label="Loading">
      <div className="ps-skeleton__bar" />
      <div className="ps-skeleton__hero">
        <div>
          <div className="ps-skeleton__line ps-skeleton__eyebrow" />
          <div className="ps-skeleton__line ps-skeleton__heading" />
          <div className="ps-skeleton__line ps-skeleton__text ps-skeleton__text--short" />
          <div className="ps-skeleton__line ps-skeleton__text ps-skeleton__text--wide" />
          <div className="ps-skeleton__ctas">
            <div className="ps-skeleton__line ps-skeleton__btn ps-skeleton__btn--primary" />
            <div className="ps-skeleton__line ps-skeleton__btn ps-skeleton__btn--secondary" />
          </div>
        </div>
        <div className="ps-skeleton__img" />
      </div>
      <div className="ps-skeleton__grid">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="ps-skeleton__card" />
        ))}
      </div>
    </main>
  );
}
