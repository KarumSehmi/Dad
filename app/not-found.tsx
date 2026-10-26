import Link from "next/link";

export default function NotFound() {
  return (
    <section className="section container narrow page-top">
      <div className="empty">
        <h1>Page not found</h1>
        <p>This page doesn&apos;t exist, or it may have been moved.</p>
        <Link href="/" className="btn btn-primary">
          Go to the home page
        </Link>
      </div>
    </section>
  );
}
