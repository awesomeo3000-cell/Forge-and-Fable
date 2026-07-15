"use client";

import { memo } from "react";
import type { FormEvent } from "react";
import type { AuthMode } from "@/types/game";

export default memo(function AuthScreen(props: {
  mode: AuthMode;
  email: string;
  password: string;
  inviteCode: string;
  status: string;
  onModeChange: (mode: AuthMode) => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onInviteCodeChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
}) {
  const registering = props.mode === "register";
  // Working brand name — flip this one line to preview a candidate.
  const BRAND = "Keepsake";
  return (
    <main className="entry-screen ao-title-entry">
      <div className="ao-title-stack">
        <span className="ao-title-eyebrow">A D&amp;D character builder &amp; DM toolkit</span>
        <h1 className="ao-title-wordmark">{BRAND}</h1>
        <div className="ao-title-rule" aria-hidden="true">
          ✦
        </div>
        <form className="ao-title-form" onSubmit={props.onSubmit}>
          <input
            className="ao-input"
            type="email"
            placeholder="Email"
            aria-label="Email"
            autoComplete="email"
            value={props.email}
            onChange={(event) => props.onEmailChange(event.target.value)}
          />
          <input
            className="ao-input"
            type="password"
            placeholder="Password"
            aria-label="Password"
            autoComplete={registering ? "new-password" : "current-password"}
            value={props.password}
            onChange={(event) => props.onPasswordChange(event.target.value)}
          />
          {registering ? (
            <input
              className="ao-input"
              type="text"
              placeholder="Invite code (optional)"
              aria-label="Invite code (optional)"
              value={props.inviteCode}
              onChange={(event) => props.onInviteCodeChange(event.target.value)}
            />
          ) : null}
          {props.status ? (
            <span className="ao-title-status" role="status">
              {props.status}
            </span>
          ) : null}
          <button className="ao-btn ao-btn-brass ao-title-submit" type="submit">
            {registering ? "Create account" : "Enter"}
          </button>
        </form>
        <nav className="ao-title-links">
          {registering ? (
            <button type="button" onClick={() => props.onModeChange("login")}>
              Back to login
            </button>
          ) : (
            <button type="button" onClick={() => props.onModeChange("register")}>
              Register
            </button>
          )}
        </nav>
      </div>
    </main>
  );
})
