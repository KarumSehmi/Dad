"use client";

import { useState } from "react";
import { site } from "@/site.config";

/**
 * Opens the phone's share sheet (WhatsApp, Messages, email...) with a link to
 * the site, or copies the link where sharing isn't available.
 */
export function InviteButton() {
  const [copied, setCopied] = useState(false);

  async function invite() {
    const url = window.location.origin;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Celebrating ${site.name}`,
          text: `A page where family and friends are sharing photos and memories of ${site.firstName}.`,
          url,
        });
      } catch {
        // Closing the share sheet counts as an error; nothing to do.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copy this link to send it:", url);
    }
  }

  return (
    <button type="button" className="btn btn-secondary" onClick={invite}>
      {copied ? "Link copied" : "Send the link to someone"}
    </button>
  );
}
