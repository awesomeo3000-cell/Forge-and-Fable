"use client";

import { ArrowRight, LockKeyhole, UserPlus } from "lucide-react";
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
  return (
    <main className="entry-screen">
      <section className="entry-copy">
        <div className="brand-line">
          <span className="brand-seal" aria-hidden="true">
            <img src="/Start/brand-seal.png" alt="" width={48} height={48} />
          </span>
          <span>Forge &amp; Fable</span>
        </div>
        <h1>A Clarebear D&amp;D character builder</h1>
        <p>Forge your fabled hero, roll your die, and seamlessly join campaigns at the touch of a button.</p>
      </section>

      <form className="login-card ledger-card" onSubmit={props.onSubmit}>
        <header className="login-heading">
          <span className="ledger-eyebrow">{props.mode === "login" ? "Welcome back" : "A new hand at the table"}</span>
          <h2>{props.mode === "login" ? "Open the ledger" : "Create your account"}</h2>
        </header>
        <div className="mode-switch ledger-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={props.mode === "login"}
            className={props.mode === "login" ? "active" : ""}
            onClick={() => props.onModeChange("login")}
          >
            <LockKeyhole size={15} />
            Login
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={props.mode === "register"}
            className={props.mode === "register" ? "active" : ""}
            onClick={() => props.onModeChange("register")}
          >
            <UserPlus size={15} />
            Register
          </button>
        </div>
        <label className="control-field">
          <span>Email</span>
          <input
            type="email"
            autoComplete="email"
            value={props.email}
            onChange={(event) => props.onEmailChange(event.target.value)}
          />
        </label>
        <label className="control-field">
          <span>Password</span>
          <input
            type="password"
            autoComplete={props.mode === "login" ? "current-password" : "new-password"}
            value={props.password}
            onChange={(event) => props.onPasswordChange(event.target.value)}
          />
        </label>
        {props.mode === "register" ? (
          <label className="control-field">
            <span>Invite code (optional)</span>
            <input
              type="text"
              value={props.inviteCode}
              onChange={(event) => props.onInviteCodeChange(event.target.value)}
            />
          </label>
        ) : null}
        {props.status ? <span className="auth-status">{props.status}</span> : null}
        <button className="ledger-button ledger-button-primary login-submit" type="submit">
          {props.mode === "login" ? "Open the ledger" : "Create account"}
          <ArrowRight size={16} />
        </button>
      </form>
    </main>
  );
})
