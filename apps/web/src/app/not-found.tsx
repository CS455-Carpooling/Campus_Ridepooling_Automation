import Link from 'next/link';

export default function NotFound() {
  return (
    <main id="main" className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="mt-4 text-ink-muted">
        There is no page at this address. The link may be wrong, or the page may have moved.
      </p>
      <p className="mt-6">
        <Link href="/">Go to the home page</Link>
      </p>
    </main>
  );
}
