"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <section className="section container narrow page-top">
      <div className="empty">
        <h1>Something went wrong</h1>
        <p>This page couldn&apos;t be loaded just now. Please try again in a moment.</p>
        <button type="button" className="btn btn-primary" onClick={reset}>
          Try again
        </button>
      </div>
    </section>
  );
}
