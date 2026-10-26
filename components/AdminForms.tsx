"use client";

import { useState, useTransition, type FormEvent } from "react";
import { clearPortrait, signIn, signOut } from "@/app/actions";
import { announceAdminChange } from "@/lib/use-is-admin";

export function SignInForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get("password") ?? "");
    startTransition(async () => {
      const result = await signIn(password);
      if (result.ok) announceAdminChange();
      else setError(result.error);
    });
  }

  return (
    <form className="admin-form" onSubmit={onSubmit}>
      <div className="field">
        <label htmlFor="password">Admin password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export function SignOutButton() {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      className="btn btn-secondary"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await signOut();
          announceAdminChange();
        })
      }
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}

export function ClearPortraitButton() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  return (
    <>
      <button
        type="button"
        className="btn btn-secondary"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await clearPortrait();
            if (!result.ok) setError(result.error);
          })
        }
      >
        {pending ? "Removing…" : "Stop using the main photo"}
      </button>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
