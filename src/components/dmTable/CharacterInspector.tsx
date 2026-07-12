"use client";

import { memo, useState } from "react";
import { BookOpen, Dices, Eye, StickyNote } from "lucide-react";
import { deriveImportantResources } from "@/lib/dmTable/party";
import type { CampaignCharacterNoteCategory, CampaignMemberSummary } from "@/types/campaign";

type InspectorTab = "overview" | "sheet" | "notes" | "history";

type Props = {
  member: CampaignMemberSummary | null;
  notes?: Array<{ id: string; title: string; body: string; category: string }>;
  history?: Array<{ id: string; summary: string; createdAt: string }>;
  onOpenSheet: (member: CampaignMemberSummary) => void;
  onRequestRoll: (member: CampaignMemberSummary) => void;
  onAddNote?: (member: CampaignMemberSummary) => void;
  onCreateNote?: (member: CampaignMemberSummary, input: { category: CampaignCharacterNoteCategory; title: string; body: string }) => Promise<boolean>;
};

export default memo(function CharacterInspector({ member, notes = [], history = [], onOpenSheet, onRequestRoll, onAddNote, onCreateNote }: Props) {
  const [tab, setTab] = useState<InspectorTab>("overview");
  const [noteDraft, setNoteDraft] = useState({ category: "general" as CampaignCharacterNoteCategory, title: "", body: "" });
  const [noteBusy, setNoteBusy] = useState(false);
  if (!member) return <aside className="dm-command-inspector"><div className="dm-command-empty"><Eye size={20}/><strong>Select a party member</strong><span>Operational detail will appear here.</span></div></aside>;
  const resources = deriveImportantResources(member);
  const tabs: Array<[InspectorTab, string]> = [["overview", "Overview"], ["sheet", "Sheet"], ["notes", "Notes"], ["history", "History"]];

  return (
    <aside className="dm-command-inspector" aria-label={`${member.characterName ?? member.userName} inspector`}>
      <header><span>Inspector</span><h3>{member.characterName ?? member.userName}</h3><small>{member.characterClass} {member.characterLevel}</small></header>
      <div className="dm-command-inspector-tabs" role="tablist">{tabs.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label}</button>)}</div>
      <div className="dm-command-inspector-body" role="tabpanel">
        {tab === "overview" ? <div className="dm-command-overview">
          <dl><div><dt>HP</dt><dd>{member.currentHp ?? "—"}/{member.maxHp ?? "—"}{member.tempHp ? ` +${member.tempHp}` : ""}</dd></div><div><dt>Armor</dt><dd>{member.ac ?? "—"}</dd></div><div><dt>Speed</dt><dd>{member.speed ?? "—"}</dd></div><div><dt>Spell DC</dt><dd>{member.spellSaveDc ?? "—"}</dd></div></dl>
          <section><h4>Passive scores</h4><p>Perception {member.passivePerception ?? "—"} · Insight {member.passiveInsight ?? "—"} · Investigation {member.passiveInvestigation ?? "—"}</p></section>
          {member.conditions.length ? <section><h4>Conditions</h4><div className="dm-command-tags">{member.conditions.map((condition) => <em key={condition}>{condition}</em>)}</div></section> : null}
          {member.concentratingOn ? <section><h4>Concentration</h4><p>{member.concentratingOn}</p></section> : null}
          {member.deathSaves ? <section><h4>Death saves</h4><p>{member.deathSaves.successes} successes · {member.deathSaves.failures} failures</p></section> : null}
          {member.spellSlots.length ? <section><h4>Spell slots</h4><p>{member.spellSlots.map((slot) => `${slot.level}: ${slot.remaining}/${slot.max}`).join(" · ")}</p></section> : null}
          {resources.length ? <section><h4>Resources</h4>{resources.map((resource) => <p key={resource.id}>{resource.label} {resource.current}/{resource.maximum}</p>)}</section> : null}
        </div> : null}
        {tab === "sheet" ? <div className="dm-command-empty"><BookOpen size={20}/><strong>Full character sheet</strong><span>Open the existing read-only sheet without duplicating character data here.</span><button type="button" className="dm-btn" onClick={() => onOpenSheet(member)}>Open full sheet</button></div> : null}
        {tab === "notes" ? <div>{notes.length ? notes.map((note) => <article key={note.id}><small>{note.category}</small><strong>{note.title}</strong><p>{note.body}</p></article>) : <div className="dm-command-empty"><StickyNote size={20}/><strong>No private notes</strong><span>Record a secret, hook, relationship, or planned beat.</span></div>}{onCreateNote ? <form className="dm-note-form" onSubmit={(event) => { event.preventDefault(); if (!noteDraft.title.trim() || !noteDraft.body.trim() || noteBusy) return; setNoteBusy(true); void onCreateNote(member, noteDraft).then((saved) => { if (saved) setNoteDraft({ category: "general", title: "", body: "" }); }).finally(() => setNoteBusy(false)); }}><select aria-label="Note category" value={noteDraft.category} onChange={(event) => setNoteDraft({ ...noteDraft, category: event.target.value as CampaignCharacterNoteCategory })}><option value="general">General</option><option value="secret">Secret</option><option value="personal-hook">Personal hook</option><option value="relationship">Relationship</option><option value="curse">Curse</option><option value="unidentified-item">Unidentified item</option><option value="planned-beat">Planned beat</option><option value="reward">Reward held</option></select><input aria-label="Note title" placeholder="Note title" maxLength={120} value={noteDraft.title} onChange={(event) => setNoteDraft({ ...noteDraft, title: event.target.value })}/><textarea aria-label="Private note" placeholder="Private DM note" maxLength={4000} value={noteDraft.body} onChange={(event) => setNoteDraft({ ...noteDraft, body: event.target.value })}/><button type="submit" className="dm-btn" disabled={noteBusy || !noteDraft.title.trim() || !noteDraft.body.trim()}>{noteBusy ? "Saving…" : "Save private note"}</button></form> : null}</div> : null}
        {tab === "history" ? <div>{history.length ? history.map((entry) => <article key={entry.id}><time>{new Date(entry.createdAt).toLocaleString()}</time><p>{entry.summary}</p></article>) : <div className="dm-command-empty"><BookOpen size={20}/><strong>No recent history</strong><span>Meaningful character events will collect here.</span></div>}</div> : null}
      </div>
      <footer><button type="button" className="dm-btn dm-btn-primary" onClick={() => onRequestRoll(member)}><Dices size={14}/> Request roll</button>{onAddNote ? <button type="button" className="dm-btn" onClick={() => onAddNote(member)}><StickyNote size={14}/> Add note</button> : null}<button type="button" className="dm-btn" onClick={() => onOpenSheet(member)}><Eye size={14}/> Full sheet</button></footer>
    </aside>
  );
});
