import type { Metadata } from "next";
import { ShareForm } from "@/components/ShareForm";
import { videosEnabled } from "@/lib/video";
import { site } from "@/site.config";

export const metadata: Metadata = {
  title: "Share a happy memory",
  description: `Share a photo or a memory of ${site.name}.`,
};

export default function SharePage() {
  return (
    <section className="section container narrow page-top" aria-labelledby="share-title">
      <div className="page-head page-head-centered">
        <h1 id="share-title">Share a happy memory of {site.firstName}</h1>
        <p className="page-lede">
          A photo, {videosEnabled && "a video, "}a funny story, or the moment you&apos;ll always smile about. Whatever you
          share will appear here for family and friends.
        </p>
      </div>
      <div className="card">
        <ShareForm />
      </div>
    </section>
  );
}
