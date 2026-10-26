import type { Metadata } from "next";
import { ShareForm } from "@/components/ShareForm";
import { site } from "@/site.config";

export const metadata: Metadata = {
  title: "Share a memory",
  description: `Share a photo or a memory of ${site.name}.`,
};

export default function SharePage() {
  return (
    <section className="section container narrow page-top" aria-labelledby="share-title">
      <div className="page-head page-head-centered">
        <h1 id="share-title">Share a memory of {site.firstName}</h1>
        <p className="page-lede">
          A photo, a story, or just a few words. Whatever you share will appear on this site for family and friends.
        </p>
      </div>
      <div className="card">
        <ShareForm />
      </div>
    </section>
  );
}
