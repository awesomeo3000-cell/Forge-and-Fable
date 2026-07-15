# -*- coding: utf-8 -*-
import io, os

def read(path):
    with io.open(path, "r", encoding="utf-8", newline="") as f: return f.read()

def save(path, text):
    with io.open(path, "w", encoding="utf-8", newline="") as f: f.write(text)

results = []
def patch(path, old, new, label):
    text = read(path)
    if "\r\n" in text: old = old.replace("\n", "\r\n"); new = new.replace("\n", "\r\n")
    n = text.count(old)
    if n != 1:
        print(f"FAIL ({label}): found {n} occurrences, expected 1 -- NOT modified"); results.append(False); return
    save(path, text.replace(old, new)); print(f"OK   ({label})"); results.append(True)

def write_file(path, content, label):
    save(path, content); print(f"OK   ({label}: written)"); results.append(True)

ROOT = r"E:\forge-and-fable"
PANEL = os.path.join(ROOT, r"src\components\DMTablePanel.tsx")
RAIL  = os.path.join(ROOT, r"src\components\dmTable\PartyRail.tsx")
VIS   = os.path.join(ROOT, r"src\components\dmTable\CharacterStateVisuals.tsx")
ALERTS= os.path.join(ROOT, r"src\lib\dmTable\alerts.ts")
CSS   = os.path.join(ROOT, r"src\app\globals.css")

# ── 1. Ghosts are never "disconnected" (review finding DM-9 #1) ──
patch(ALERTS,
'''    const state = presence.find((item) => item.userId === member.userId)?.state ?? "disconnected";
    if (state === "disconnected") alerts.push({''',
'''    const state = presence.find((item) => item.userId === member.userId)?.state ?? "disconnected";
    // Ghosts have no presence rows; the server plays them, so they are never
    // "disconnected" (review finding DM-9 #1 — this was spamming the rail).
    if (state === "disconnected" && !member.isGhost) alerts.push({''',
"alerts: ghosts never disconnected")

# ── 2. Portraits become the focal point ──
patch(VIS,
'  const px = size === "inspector" ? 58 : 54;',
'  const px = size === "inspector" ? 84 : 76;',
"portrait sizes 76/84")

# ── 3. PartyRail: full replacement ──
write_file(RAIL, '''"use client";

import { memo, useMemo, useState } from "react";
import { AlertTriangle, Eye, HeartPulse, Wifi, WifiOff, X } from "lucide-react";
import { deriveImportantResources, memberHpState } from "@/lib/dmTable/party";
import { derivePartyAlerts } from "@/lib/dmTable/alerts";
import { CharacterPortrait, ConditionChip, ResourceChip, SpellSlotTrack } from "@/components/dmTable/CharacterStateVisuals";
import type { CampaignMemberSummary, CampaignPresence } from "@/types/campaign";

type Props = {
  members: CampaignMemberSummary[];
  dmUserId: string;
  selectedUserId: string | null;
  currentTurnUserId?: string | null;
  presence: CampaignPresence[];
  compact?: boolean;
  rehearsalBusy?: boolean;
  onSelect: (member: CampaignMemberSummary) => void;
  onOpenSheet: (member: CampaignMemberSummary) => void;
  onSeatRehearsal?: () => void;
  onClearRehearsal?: () => void;
};

export default memo(function PartyRail({ members, dmUserId, selectedUserId, currentTurnUserId, presence, compact, rehearsalBusy, onSelect, onOpenSheet, onSeatRehearsal, onClearRehearsal }: Props) {
  const players = useMemo(() => members.filter((member) => member.userId !== dmUserId && member.characterId), [members, dmUserId]);
  const concerns = players.filter((member) => ["critical", "unconscious"].includes(memberHpState(member))).length;
  const concentrating = players.filter((member) => member.concentratingOn).length;
  const alerts = useMemo(() => derivePartyAlerts(members, presence, dmUserId), [members, presence, dmUserId]);
  // Acknowledged alerts stay hidden until their underlying state changes —
  // the signature (title + detail) is the change detector.
  const [ackedAlerts, setAckedAlerts] = useState<Record<string, string>>({});
  const alertSignature = (alert: { title: string; detail?: string }) => `${alert.title}|${alert.detail ?? ""}`;
  const visibleAlerts = alerts.filter((alert) => ackedAlerts[alert.id] !== alertSignature(alert));
  const hasGhosts = players.some((member) => member.isGhost);
  const ready = players.filter((member) => member.isGhost || ["connected", "background"].includes(presence.find((item) => item.userId === member.userId)?.state ?? "disconnected")).length;

  return (
    <aside className={`dm-command-party${compact ? " is-compact" : ""}`} aria-label="Party command center">
      <header>
        <span>Party</span>
        <strong>{players.length} adventurer{players.length === 1 ? "" : "s"}</strong>
        {hasGhosts ? <em className="dm-rehearsal-mark">Rehearsal party{onClearRehearsal ? <button type="button" onClick={onClearRehearsal} disabled={rehearsalBusy} aria-label="Clear the rehearsal party"><X size={11} /></button> : null}</em> : null}
        <small>{concerns ? `${concerns} need attention` : "Party state is steady"}{concentrating ? ` · ${concentrating} concentrating` : ""}</small>
      </header>
      {visibleAlerts.length ? <section className="dm-party-alerts" aria-label="Party alerts"><h4><AlertTriangle size={13}/> Needs attention</h4>{visibleAlerts.slice(0, 4).map((alert) => <div key={alert.id} className="dm-alert-row"><button type="button" data-severity={alert.severity} onClick={() => { const member = players.find((item) => item.userId === alert.userId); if (member) onSelect(member); }}><strong>{alert.title}</strong>{alert.detail ? <small>{alert.detail}</small> : null}</button><button type="button" className="dm-alert-ack" aria-label={`Dismiss alert: ${alert.title}`} onClick={() => setAckedAlerts((current) => ({ ...current, [alert.id]: alertSignature(alert) }))}><X size={12} /></button></div>)}</section> : null}
      <div className="dm-command-party-list" role="listbox" aria-label="Party members">
        {players.map((member) => {
          const state = memberHpState(member);
          const percent = member.maxHp ? Math.max(0, Math.min(100, ((member.currentHp ?? 0) / member.maxHp) * 100)) : 0;
          const resources = deriveImportantResources(member).slice(0, 2);
          const selected = selectedUserId === member.userId;
          const current = currentTurnUserId === member.userId;
          const presenceState = member.isGhost ? "rehearsal" : presence.find((item) => item.userId === member.userId)?.state ?? "disconnected";
          const name = member.characterName ?? member.userName;
          return (
            <div key={member.userId} className={`dm-command-member is-${state}${selected ? " is-selected" : ""}${current ? " is-current" : ""}${member.isGhost ? " is-rehearsal" : ""}`}>
              {member.characterClass ? <img className="dm-class-sigil" src={`/class-icons/${member.characterClass}.svg`} alt="" aria-hidden="true" /> : null}
              <button type="button" role="option" aria-selected={selected} onClick={() => onSelect(member)}>
                <span className="dm-member-primary">
                  <CharacterPortrait member={member} />
                  <span className="dm-command-member-name">
                    <strong>{name}{member.isGhost ? <em className="dm-rehearsal-mark">rehearsal</em> : null}</strong>
                    <small>{member.characterClass ? `${member.characterClass} ${member.characterLevel ?? ""}` : "Character not loaded"} · {presenceState}</small>
                    <span className="dm-command-hp-copy">HP {member.currentHp ?? "—"} / {member.maxHp ?? "—"}{member.tempHp ? ` · +${member.tempHp} temp` : ""}</span>
                    <span className="dm-command-hp" role="progressbar" aria-label={`${name} hit points`} aria-valuemin={0} aria-valuemax={member.maxHp ?? 0} aria-valuenow={member.currentHp ?? 0}>
                      <i style={{ width: `${percent}%` }} /><b>{state === "unconscious" ? "Unconscious" : state}</b>
                    </span>
                    <span className="dm-vitals-strip" aria-label={`${name} vitals`}>
                      <span><small>AC</small><b>{member.ac ?? "—"}</b></span>
                      <span><small>PP</small><b>{member.passivePerception ?? "—"}</b></span>
                      <span><small>Speed</small><b>{member.speed ?? "—"}</b></span>
                    </span>
                  </span>
                </span>
                {!compact ? (
                  <>
                    {member.conditions.length || member.concentratingOn ? <span className="dm-command-tags">{member.conditions.slice(0, 3).map((condition) => <ConditionChip key={condition} label={condition} />)}{member.concentratingOn ? <ConditionChip label={`Concentrating · ${member.concentratingOn}`} concentration /> : null}</span> : null}
                    <SpellSlotTrack slots={member.spellSlots} compact />
                    {resources.length ? <span className="dm-command-resources">{resources.map((resource) => <ResourceChip key={resource.id} resource={resource} />)}</span> : null}
                    {member.currentHp === 0 && member.deathSaves ? <span className="dm-command-death"><HeartPulse size={12}/> Saves {member.deathSaves.successes}/3 · Fails {member.deathSaves.failures}/3</span> : null}
                  </>
                ) : null}
              </button>
              <button type="button" className="dm-command-open-sheet" onClick={() => onOpenSheet(member)} aria-label={`Open ${name} full sheet`} disabled={!member.characterJson}><Eye size={14}/></button>
            </div>
          );
        })}
        {!players.length ? <div className="dm-command-empty">
          <p>No player characters are enrolled yet.</p>
          {onSeatRehearsal ? <>
            <button type="button" className="dm-btn dm-btn-primary" onClick={onSeatRehearsal} disabled={rehearsalBusy}>{rehearsalBusy ? "Seating the party…" : "Seat a rehearsal party"}</button>
            <small>Four ghost adventurers the server plays for you — rehearse rolls, rests, conditions, and loot before the real party arrives.</small>
          </> : null}
        </div> : null}
      </div>
      <footer className="dm-party-readiness"><span>{ready === players.length && players.length ? <Wifi size={13}/> : <WifiOff size={13}/>} Session readiness</span><strong>{ready} of {players.length} ready</strong></footer>
    </aside>
  );
});
''', "PartyRail rewrite")

# ── 4. DMTablePanel: rehearsal control out of the header ──
patch(PANEL,
'''          <div className={`dm-rehearsal-control${rehearsalActive ? " is-active" : ""}`}>
            <span>{rehearsalActive ? "Rehearsal party seated" : "Test the table"}</span>
            {rehearsalActive ? <button type="button" className="dm-btn" onClick={() => void clearRehearsal()} disabled={rehearsalBusy}>Clear rehearsal</button> : <button type="button" className="dm-btn" onClick={() => void seatRehearsal()} disabled={rehearsalBusy}>Seat 4 ghosts</button>}
          </div>
          <button type="button" className={`dm-btn${compactRail ? " is-active" : ""}`}''',
'''          <button type="button" className={`dm-btn${compactRail ? " is-active" : ""}`}''',
"header: rehearsal control removed")

patch(PANEL,
'''          compact={compactRail}
          onSelect={(member) => setSelectedUserId(member.userId)}''',
'''          compact={compactRail}
          rehearsalBusy={rehearsalBusy}
          onSeatRehearsal={rehearsalActive ? undefined : () => void seatRehearsal()}
          onClearRehearsal={rehearsalActive ? () => void clearRehearsal() : undefined}
          onSelect={(member) => setSelectedUserId(member.userId)}''',
"PartyRail rehearsal props")

patch(PANEL,
'''    {label:"Open party capabilities",run:()=>setWorkspaceMode("scene")},''',
'''    {label:"Open party capabilities",run:()=>setWorkspaceMode("scene")},
    {label:rehearsalActive?"Clear the rehearsal party":"Seat a rehearsal party",run:()=>{if(rehearsalActive)void clearRehearsal();else void seatRehearsal();},disabled:rehearsalBusy},''',
"palette: rehearsal command")

# ── 5. Request cards get a lifecycle ──
patch(PANEL,
'''  const [recordFilter, setRecordFilter] = useState<"all" | "rolls" | "table">("all");''',
'''  const [recordFilter, setRecordFilter] = useState<"all" | "rolls" | "table">("all");
  // Request cards have a lifecycle: open cards stay, completed cards linger
  // two minutes (long enough to read the result), dismiss always available.
  const [dismissedRequests, setDismissedRequests] = useState<string[]>([]);''',
"dismissed-requests state")

patch(PANEL,
'''          {campaign.requests.length ? <section className="dm-request-center" aria-label="Recent player requests">
            {campaign.requests.slice(0, 4).map((request) => {''',
'''          {(() => { const liveRequests = campaign.requests.filter((request) => !dismissedRequests.includes(request.id) && (request.status === "open" || !request.resolvedAt || clockNow - Date.parse(request.resolvedAt) < 120_000)).slice(0, 4); return liveRequests.length ? <section className="dm-request-center" aria-label="Recent player requests">
            {liveRequests.map((request) => {''',
"request center: live filter")

patch(PANEL,
'''              </article>;
            })}
          </section> : null}''',
'''              </article>;
            })}
          </section> : null; })()}''',
"request center: close IIFE")

patch(PANEL,
'''                <header><strong>{title}</strong><span>{responses.length}/{request.targetUserIds.length} responded</span></header>''',
'''                <header><strong>{title}</strong><span>{responses.length}/{request.targetUserIds.length} responded</span><button type="button" className="dm-request-dismiss" aria-label="Dismiss this request card" onClick={() => setDismissedRequests((current) => [...current, request.id])}><X size={12} /></button></header>''',
"request card: dismiss button")

# ── 6. Merge duplicate reminder surfaces (band block goes; checklist gains snooze/record) ──
band_marker = '<div className="dm-upcoming">'
text = read(PANEL)
start = text.find(band_marker)
if start == -1:
    print("FAIL (dm-upcoming removal): marker not found"); results.append(False)
else:
    line_start = text.rfind("\n", 0, start) + 1
    line_end = text.find("\n", start) + 1
    save(PANEL, text[:line_start] + text[line_end:])
    print("OK   (dm-upcoming removed)"); results.append(True)

patch(PANEL,
'''.map(({ item, phase }) => <label key={`${phase}-${item.id}`}><input type="checkbox" checked={item.completed} onChange={() => void dmToolsApi.updateRun(campaign.campaign.id, activeEncounter.id, { reminders: activeEncounter.reminders.map((row) => row.id === item.id ? { ...row, completed: true } : row) }).then(() => refreshWorkspace())}/><span><small>{phase}</small>{item.label}</span></label>)}</section> : null}''',
'''.map(({ item, phase }) => <div key={`${phase}-${item.id}`}><label><input type="checkbox" checked={item.completed} onChange={() => void dmToolsApi.updateRun(campaign.campaign.id, activeEncounter.id, { reminders: activeEncounter.reminders.map((row) => row.id === item.id ? { ...row, completed: true } : row) }).then(() => refreshWorkspace())}/><span><small>{phase}</small>{item.label}</span></label><button type="button" className="dm-icon-btn" onClick={() => void dmToolsApi.updateRun(campaign.campaign.id, activeEncounter.id, { reminders: activeEncounter.reminders.map((row) => row.id === item.id ? { ...row, snoozedUntilRound: campaign.initiative.data.round + 1 } : row) }).then(() => refreshWorkspace())}>Snooze</button>{activeSession ? <button type="button" className="dm-icon-btn" onClick={() => void dmToolsApi.pin(campaign.campaign.id, activeSession.id, { note: item.label })}>Record</button> : null}</div>)}</section> : null}''',
"turn checklist: snooze/record rows")

# ── 7. CSS: legibility + artifact pass ──
css_block = '''

/* -- DM-10 / Round Three stage one: legibility, artifacts, lifecycles -- */
/* Numbers are the loudest thing after names. */
.dm-vitals-strip { display:flex; gap:14px; margin-top:5px; }
.dm-vitals-strip>span { display:inline-flex; align-items:baseline; gap:4px; }
.dm-vitals-strip small { color:var(--dm-muted,#6b5f4e); font-family:var(--font-label); font-size:9px; letter-spacing:.08em; text-transform:uppercase; }
.dm-vitals-strip b { color:var(--dm-ink,#2a2018); font-size:13.5px; font-weight:600; font-variant-numeric:tabular-nums; }
.dm-combatant-ac,.dm-combatant-hp { color:var(--dm-ink,#2a2018); }
.dm-combatant-ac { font-size:12px; font-weight:600; font-variant-numeric:tabular-nums; }
.dm-combatant-hp input { color:var(--dm-ink,#2a2018); font-weight:600; }

/* Portraits are the focal point of the rail and the inspector. */
.dm-character-portrait.is-rail { width:76px; height:76px; font-size:20px; }
.dm-character-portrait.is-inspector { width:84px; height:84px; font-size:22px; }
.dm-member-primary { grid-template-columns:80px minmax(0,1fr); }
@media (max-width:800px) { .dm-member-primary { grid-template-columns:64px minmax(0,1fr); } .dm-character-portrait.is-rail { width:60px; height:60px; } }

/* Fantasy through artifacts, not palette: class sigils, accent placement,
   a slightly more present parchment. Color stays semantic. */
.dm-table::before { opacity:.05; }
.dm-command-member { position:relative; overflow:hidden; }
.dm-class-sigil { position:absolute; right:-12px; bottom:-12px; width:86px; height:86px; opacity:.07; pointer-events:none; }
.dm-command-member.is-selected .dm-class-sigil { opacity:.11; }
.dm-workspace-modes button.is-active { box-shadow:inset 0 -2px 0 var(--dm-accent,#8c2f22); }
.dm-combatant.is-current { border-left:3px solid var(--dm-accent,#8c2f22); background:color-mix(in srgb,var(--dm-accent,#8c2f22) 7%,transparent); }

/* Alert + request lifecycles. */
.dm-alert-row { display:flex; align-items:stretch; gap:2px; }
.dm-alert-row>button:first-child { flex:1 1 auto; }
.dm-party-alerts .dm-alert-ack { flex:0 0 auto; border:0; border-left:0; background:transparent; color:var(--dm-muted,#6b5f4e); cursor:pointer; }
.dm-party-alerts .dm-alert-ack:hover { color:var(--dm-ink,#2a2018); }
.dm-request-card header .dm-request-dismiss { border:0; background:transparent; color:var(--dm-muted,#6b5f4e); cursor:pointer; padding:0 0 0 4px; }
.dm-request-card header .dm-request-dismiss:hover { color:var(--dm-ink,#2a2018); }
.dm-request-card[data-status="completed"] { opacity:.78; }

/* Rehearsal controls live in the rail now, not the header. */
.dm-command-party .dm-command-empty { display:grid; gap:10px; justify-items:start; padding:16px 14px; }
.dm-command-party .dm-command-empty p { margin:0; }
.dm-command-party .dm-command-empty small { color:var(--dm-muted,#6b5f4e); line-height:1.5; }
.dm-rehearsal-mark button { border:0; background:transparent; color:inherit; cursor:pointer; padding:0 0 0 4px; vertical-align:middle; }
'''
save(CSS, read(CSS) + css_block)
print("OK   (CSS appended)"); results.append(True)

print()
print("All good." if all(results) else "SOME STEPS FAILED - tell Fable which ones before building.")