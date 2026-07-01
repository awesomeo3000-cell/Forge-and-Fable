"use client";

import { ArrowRight, LockKeyhole, Sparkles, UserPlus, Vault } from "lucide-react";
import { memo } from "react";
import type { FormEvent } from "react";
import type { AuthMode } from "@/types/game";

export default memo(function AuthScreen(props: {
  mode: AuthMode;
  name: string;
  email: string;
  password: string;
  status: string;
  onModeChange: (mode: AuthMode) => void;
  onNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <main className="entry-screen">
      <section className="entry-copy">
        <div className="brand-line">
          <span className="brand-glyph">
            <Sparkles size={21} />
          </span>
          <span>Forge & Fable</span>
        </div>
        <h1>A Clarebear D&D character builder</h1>
        <p>Forge your fabled hero, roll your die, and seamlessly join campaigns at the touch of a button.</p>
      </section>

      <form className="login-card" onSubmit={props.onSubmit}>
        <div className="login-heading">
          <span>{props.mode === "login" ? "Welcome back" : "Create your account"}</span>
          <h2>{props.mode === "login" ? "Open Forge" : "Create account"}</h2>
        </div>
        <div className="mode-switch">
          <button
            type="button"
            className={props.mode === "login" ? "active" : ""}
            onClick={() => props.onModeChange("login")}
          >
            <LockKeyhole size={16} />
            Login
          </button>
          <button
            type="button"
            className={props.mode === "register" ? "active" : ""}
            onClick={() => props.onModeChange("register")}
          >
            <UserPlus size={16} />
            Register
          </button>
        </div>
        <label className="control-field">
          <span>Name</span>
          <input value={props.name} onChange={(event) => props.onNameChange(event.target.value)} />
        </label>
        <label className="control-field">
          <span>Email</span>
          <input
            type="email"
            value={props.email}
            onChange={(event) => props.onEmailChange(event.target.value)}
          />
        </label>
        <label className="control-field">
          <span>Password</span>
          <input
            type="password"
            value={props.password}
            onChange={(event) => props.onPasswordChange(event.target.value)}
          />
        </label>
        {props.status ? <span className="auth-status">{props.status}</span> : null}
        <button className="gold-button" type="submit">
          <Vault size={18} />
          {props.mode === "login" ? "Enter Studio" : "Create account"}
          <ArrowRight size={18} />
        </button>
      </form>
    </main>
  );
})
