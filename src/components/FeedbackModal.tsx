"use client";

import { memo, useState } from "react";
import type { FormEvent } from "react";
import { MessageSquare, Send, X } from "lucide-react";
import type { FeedbackCategory, FeedbackEntry, FeedbackPriority } from "@/types/game";

export type FeedbackInput = {
  category: FeedbackCategory;
  priority: FeedbackPriority;
  area: string;
  title: string;
  details: string;
  page: string;
  characterName?: string;
};

const categoryOptions: { value: FeedbackCategory; label: string }[] = [
  { value: "bug", label: "Bug" },
  { value: "idea", label: "Feature idea" },
  { value: "balance", label: "Rules/balance" },
  { value: "content", label: "Missing content" },
  { value: "ui", label: "UI polish" },
  { value: "other", label: "Other" },
];

const priorityOptions: { value: FeedbackPriority; label: string }[] = [
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "blocking", label: "Blocking" },
  { value: "low", label: "Low" },
];

function formatFeedbackTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "recently";
  }

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default memo(function FeedbackModal(props: {
  entries: FeedbackEntry[];
  currentPage: string;
  characterName?: string;
  status: string;
  busy: boolean;
  onClose: () => void;
  onSubmit: (input: FeedbackInput) => Promise<boolean>;
}) {
  const [category, setCategory] = useState<FeedbackCategory>("idea");
  const [priority, setPriority] = useState<FeedbackPriority>("medium");
  const [area, setArea] = useState("Character sheet");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const saved = await props.onSubmit({
      category,
      priority,
      area,
      title,
      details,
      page: props.currentPage,
      characterName: props.characterName,
    });

    if (saved) {
      setTitle("");
      setDetails("");
      setPriority("medium");
      setCategory("idea");
    }
  };

  return (
    <div className="modal-scrim feedback-scrim" onClick={props.onClose}>
      <section
        className="feedback-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button className="glass-icon modal-close" type="button" onClick={props.onClose} title="Close feedback">
          <X size={18} />
        </button>

        <header className="feedback-modal-hero">
          <span className="feedback-icon">
            <MessageSquare size={26} />
          </span>
          <div>
            <span className="feedback-eyebrow">Table feedback</span>
            <h2 id="feedback-title">Send a quick note</h2>
            <p>Capture bugs, missing rules, confusing flows, and nice-to-have ideas while they are fresh.</p>
          </div>
        </header>

        <div className="feedback-modal-body">
          <form className="feedback-form" onSubmit={submit}>
            <div className="feedback-two-up">
              <label className="control-field">
                <span>Category</span>
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value as FeedbackCategory)}
                >
                  {categoryOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="control-field">
                <span>Priority</span>
                <select
                  value={priority}
                  onChange={(event) => setPriority(event.target.value as FeedbackPriority)}
                >
                  {priorityOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="control-field">
              <span>Area</span>
              <input
                value={area}
                placeholder="Character builder, dice, inventory..."
                onChange={(event) => setArea(event.target.value)}
              />
            </label>

            <label className="control-field">
              <span>Short title</span>
              <input
                value={title}
                placeholder="What should we fix or add?"
                maxLength={140}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>

            <label className="control-field">
              <span>Details</span>
              <textarea
                value={details}
                placeholder="What happened, what did you expect, and anything we should know?"
                maxLength={1600}
                onChange={(event) => setDetails(event.target.value)}
              />
            </label>

            <div className="feedback-context">
              <span>{props.characterName ? `Character: ${props.characterName}` : "No character selected"}</span>
              <span>{props.currentPage}</span>
            </div>

            {props.status ? <p className="feedback-status">{props.status}</p> : null}

            <footer className="feedback-actions">
              <button className="glass-button" type="button" onClick={props.onClose}>
                Cancel
              </button>
              <button className="gold-button" type="submit" disabled={props.busy}>
                <Send size={16} />
                Submit
              </button>
            </footer>
          </form>

          <aside className="feedback-inbox" aria-label="Recent feedback">
            <span className="feedback-eyebrow">Recent</span>
            {props.entries.length === 0 ? (
              <p className="feedback-empty">No feedback has been submitted yet.</p>
            ) : (
              <div className="feedback-list">
                {props.entries.slice(0, 8).map((entry) => (
                  <article className="feedback-item" key={entry.id}>
                    <div className="feedback-item-head">
                      <strong>{entry.title}</strong>
                      <span>{entry.priority}</span>
                    </div>
                    <p>{entry.details}</p>
                    <small>
                      {entry.area} / {entry.userName} / {formatFeedbackTime(entry.createdAt)}
                    </small>
                  </article>
                ))}
              </div>
            )}
          </aside>
        </div>
      </section>
    </div>
  );
});
