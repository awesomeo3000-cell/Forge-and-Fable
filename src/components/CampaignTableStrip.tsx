"use client";

import { memo, useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import type { CampaignEvent, CampaignSyncPayload } from "@/types/campaign";

const SILENT_AUDIO = "data:audio/wav;base64,UklGRiwAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQgAAACAgICAgICAgIA=";

type Props = {
  campaign: CampaignSyncPayload;
  events: CampaignEvent[];
  /** For the "your turn" highlight — player combatants are keyed `player:<userId>`. */
  currentUserId?: string;
  onOpen: () => void;
  onToast: (title: string, body?: string) => void;
};

function payload(event: CampaignEvent) {
  try { const value = JSON.parse(event.payload); return value && typeof value === "object" ? value as Record<string, unknown> : {}; } catch { return {}; }
}

export default memo(function CampaignTableStrip({ campaign, events, currentUserId, onOpen, onToast }: Props) {
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const cueRef = useRef<HTMLAudioElement | null>(null);
  const processedCuesRef = useRef(new Set<string>());
  const [armed, setArmed] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [dismissed, setDismissed] = useState(false);
  const [sessionTitle, setSessionTitle] = useState("");
  const audio = campaign.audio;
  const current = campaign.initiative.data.combatants[campaign.initiative.data.turnIndex];
  const lastAnnouncement = [...events].reverse().find((event) => event.type === "announce");

  useEffect(() => {
    const savedVolume = Number(window.localStorage.getItem("forge-and-fable-table-volume"));
    if (Number.isFinite(savedVolume)) setVolume(Math.max(0, Math.min(1, savedVolume)));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => void fetch(`/api/campaigns/${campaign.campaign.id}/workspace`).then((response) => response.ok ? response.json() : null).then((data) => { if (!cancelled) setSessionTitle(data?.activeSession?.title ?? ""); }).catch(() => {});
    refresh(); const interval = window.setInterval(refresh, 10000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [campaign.campaign.id]);

  useEffect(() => {
    const element = musicRef.current;
    if (!element) return;
    element.volume = volume;
    element.muted = muted;
    if (!armed || !audio.url) { element.pause(); return; }
    if (element.src !== audio.url) {
      element.src = audio.url;
      element.loop = audio.loop;
      const resume = () => {
        if (audio.startedAt && Number.isFinite(element.duration) && element.duration > 0) {
          element.currentTime = ((Date.now() - Date.parse(audio.startedAt)) / 1000) % element.duration;
        }
        void element.play().catch(() => onToast("The DM started ‹" + (audio.title ?? "music") + "› — tap to listen."));
      };
      element.addEventListener("loadedmetadata", resume, { once: true });
      element.load();
    } else if (element.paused) {
      void element.play().catch(() => onToast("The DM started ‹" + (audio.title ?? "music") + "› — tap to listen."));
    }
  }, [armed, audio.loop, audio.startedAt, audio.title, audio.url, muted, onToast, volume]);

  useEffect(() => {
    if (!armed) return;
    const cue = cueRef.current;
    for (const event of events) {
      if (event.type !== "audio-cue" || processedCuesRef.current.has(event.id)) continue;
      processedCuesRef.current.add(event.id);
      const eventPayload = payload(event);
      if (typeof eventPayload.url === "string" && cue) { cue.src = eventPayload.url; cue.volume = volume; cue.muted = muted; void cue.play().catch(() => {}); }
    }
  }, [armed, events, muted, volume]);

  useEffect(() => () => { musicRef.current?.pause(); cueRef.current?.pause(); }, []);

  const armAudio = () => {
    const element = musicRef.current;
    if (!element) { setArmed(true); return; }
    // Start a silent clip in the click handler. This satisfies the browser's
    // user-gesture requirement before later campaign syncs select real audio.
    element.src = SILENT_AUDIO;
    element.muted = true;
    void element.play().catch(() => {}).finally(() => {
      element.pause();
      element.currentTime = 0;
      element.muted = muted;
      setArmed(true);
      onToast("Table audio joined", "Your volume stays local to this browser.");
    });
  };
  if (dismissed) return null;
  const announcement = lastAnnouncement ? payload(lastAnnouncement).message : null;
  const isMyTurn = Boolean(current && currentUserId && current.id === `player:${currentUserId}`);
  return <aside className={`campaign-table-strip${isMyTurn ? " is-your-turn" : ""}`}><audio ref={musicRef}/><audio ref={cueRef}/><span>THE TABLE{sessionTitle ? ` · ${sessionTitle}` : ""} · Round {campaign.initiative.data.round}{current ? ` · ${isMyTurn ? "YOUR TURN" : current.name}` : ""}</span>{typeof announcement === "string" ? <em>{announcement.slice(0, 90)}</em> : null}<div>{armed ? <><button type="button" onClick={() => setMuted((value) => !value)} aria-label={muted ? "Unmute table audio" : "Mute table audio"}>{muted ? <VolumeX size={15}/> : <Volume2 size={15}/>}</button><input aria-label="Table audio volume" type="range" min="0" max="1" step="0.05" value={volume} onChange={(event) => { const next = Number(event.target.value); setVolume(next); window.localStorage.setItem("forge-and-fable-table-volume", String(next)); }}/></> : <button type="button" onClick={armAudio}>Join table audio</button>}<button type="button" onClick={onOpen}>Open campaign</button><button type="button" onClick={() => setDismissed(true)} aria-label="Dismiss table strip">×</button></div></aside>;
});
