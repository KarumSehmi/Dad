import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { ClearPortraitButton, SignInForm, SignOutButton } from "@/components/AdminForms";
import { isAdmin } from "@/lib/admin";
import { getSettings } from "@/lib/data";
import { adminConfigured } from "@/lib/security";

export const metadata: Metadata = {
  title: "Family admin",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <section className="section container narrow page-top" aria-labelledby="admin-title">
      <div className="page-head page-head-centered">
        <h1 id="admin-title">Family admin</h1>
        <p className="page-lede">For the family members looking after this site.</p>
      </div>
      <div className="card">
        <Suspense fallback={<p className="muted">Loading…</p>}>
          <AdminPanel />
        </Suspense>
      </div>
    </section>
  );
}

async function AdminPanel() {
  const signedIn = await isAdmin();

  if (!adminConfigured()) {
    return (
      <p>
        Admin access isn&apos;t set up yet. Add an environment variable called <code>ADMIN_PASSWORD</code> to the
        project in Vercel, then redeploy.
      </p>
    );
  }
  if (!signedIn) return <SignInForm />;

  const { portrait } = await getSettings();
  return (
    <div className="admin-panel">
      <p>
        <strong>You&apos;re signed in on this device.</strong> While signed in, you&apos;ll see extra buttons around
        the site:
      </p>
      <ul>
        <li>
          <strong>Delete memory</strong> under each memory on the <Link href="/">home page</Link>.
        </li>
        <li>
          <strong>Delete</strong> and <strong>Use as main photo</strong> when you open any photo.
        </li>
      </ul>

      <h2>Main photo</h2>
      {portrait ? (
        <div className="admin-portrait">
          <Image src={portrait.url} alt="" width={96} height={120} style={{ backgroundColor: portrait.color }} />
          <ClearPortraitButton />
        </div>
      ) : (
        <p className="muted">
          No main photo chosen yet. Open any photo and press <strong>Use as main photo</strong> to show it at the top of
          the home page.
        </p>
      )}

      <div className="admin-signout">
        <SignOutButton />
      </div>
    </div>
  );
}
