"use client";

import { memo } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import type { AuthMode } from "@/types/game";
import { BRAND_NAME } from "@/lib/brand";

export default memo(function AuthScreen(props: {
  mode: AuthMode;
  email: string;
  password: string;
  passwordConfirmation: string;
  displayName: string;
  inviteCode: string;
  resetToken: string;
  status: string;
  onModeChange: (mode: AuthMode) => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onPasswordConfirmationChange: (value: string) => void;
  onDisplayNameChange: (value: string) => void;
  onInviteCodeChange: (value: string) => void;
  onResetTokenChange: (value: string) => void;
  onResendVerification: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  const registering = props.mode === "register";
  const requestingReset = props.mode === "forgot";
  const resetting = props.mode === "reset";
  return (
    <main className="entry-screen ao-title-entry">
      <div className="ao-title-stack">
        <span className="ao-title-eyebrow">A D&amp;D character builder &amp; DM toolkit</span>
        <h1 className="ao-title-wordmark">{BRAND_NAME}</h1>
        <div className="ao-title-rule" aria-hidden="true">
          ✦
        </div>
        <form className="ao-title-form" onSubmit={props.onSubmit}>
          <input
            id="auth-email"
            name="email"
            className="ao-input"
            type="email"
            placeholder="Email"
            aria-label="Email"
            autoComplete="email"
            required
            value={props.email}
            onChange={(event) => props.onEmailChange(event.target.value)}
          />
          {!requestingReset ? (
            <input
              id={resetting ? "auth-new-password" : "auth-password"}
              name="password"
              className="ao-input"
              type="password"
              placeholder={resetting ? "New password" : "Password"}
              aria-label={resetting ? "New password" : "Password"}
              autoComplete={registering || resetting ? "new-password" : "current-password"}
              required={!requestingReset}
              value={props.password}
              onChange={(event) => props.onPasswordChange(event.target.value)}
            />
          ) : null}
          {registering ? (
            <input
              id="auth-password-confirmation"
              name="passwordConfirmation"
              className="ao-input"
              type="password"
              placeholder="Confirm password"
              aria-label="Confirm password"
              autoComplete="new-password"
              value={props.passwordConfirmation}
              required
              onChange={(event) => props.onPasswordConfirmationChange(event.target.value)}
            />
          ) : null}
          {resetting ? (
            <input
              id="auth-reset-token"
              name="resetToken"
              className="ao-input"
              type="text"
              placeholder="Reset token"
              aria-label="Reset token"
              value={props.resetToken}
              onChange={(event) => props.onResetTokenChange(event.target.value)}
            />
          ) : null}
          {registering ? (
            <>
              <input
                id="auth-display-name"
                name="displayName"
                className="ao-input"
                type="text"
                placeholder="Display name"
                aria-label="Display name"
                autoComplete="nickname"
                maxLength={80}
                value={props.displayName}
                onChange={(event) => props.onDisplayNameChange(event.target.value)}
              />
              <input
                id="auth-invite-code"
                name="inviteCode"
                className="ao-input"
                type="text"
                placeholder="Invite code (optional)"
                aria-label="Invite code (optional)"
                value={props.inviteCode}
                onChange={(event) => props.onInviteCodeChange(event.target.value)}
              />
            </>
          ) : null}
          {props.status ? (
            <span className="ao-title-status" role="status">
              {props.status}
            </span>
          ) : null}
          <button className="ao-btn ao-btn-brass ao-title-submit" type="submit">
            {registering ? "Create account" : requestingReset ? "Send reset link" : resetting ? "Set new password" : "Enter"}
          </button>
        </form>
        <nav className="ao-title-links">
          {registering ? (
            <button type="button" onClick={() => props.onModeChange("login")}>
              Back to login
            </button>
          ) : requestingReset || resetting ? (
            <button type="button" onClick={() => props.onModeChange("login")}>
              Back to login
            </button>
          ) : (
            <button type="button" onClick={() => props.onModeChange("register")}>
              Register
            </button>
          )}
          {!registering && !requestingReset && !resetting ? (
            <>
              <button type="button" onClick={props.onResendVerification}>
                Resend verification
              </button>
              <button type="button" onClick={() => props.onModeChange("forgot")}>
                Forgot password?
              </button>
            </>
          ) : null}
        </nav>
        <nav className="ao-title-legal" aria-label="Legal and support">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/legal">Licensing</Link>
          <Link href="/support">Support</Link>
        </nav>
      </div>
    </main>
  );
})
