"use client";
import { useEffect, useState } from "react";
import { BookOpen, ExternalLink, FileText } from "lucide-react";
import type { PlayerCampaignMemory } from "@/types/dmTools";

export default function CampaignMemoryPanel({campaignId}:{campaignId:string}){
  const [memory,setMemory]=useState<PlayerCampaignMemory|null>(null),[error,setError]=useState("");
  useEffect(()=>{let cancelled=false;void fetch(`/api/campaigns/${campaignId}/memory`).then(async(response)=>{const data=await response.json();if(!response.ok)throw new Error(data.error??"Could not load campaign memory.");if(!cancelled)setMemory(data);}).catch((reason)=>!cancelled&&setError(reason instanceof Error?reason.message:"Could not load campaign memory."));return()=>{cancelled=true};},[campaignId]);
  if(error)return <p className="campaign-memory-error">{error}</p>;
  if(!memory)return <p className="campaign-memory-empty">Loading campaign memory…</p>;
  return <section className="campaign-memory"><header><BookOpen size={15}/><h3>Campaign memory</h3>{memory.activeSession?<span>{memory.activeSession.title??"Active session"}</span>:null}</header><div><section><h4>Shared handouts</h4>{memory.handouts.length?memory.handouts.map((item)=><article key={item.id}><strong>{item.title}</strong>{item.description?<p>{item.description}</p>:null}{item.body?<p className="campaign-handout-text">{item.body}</p>:null}{item.assetUrl?<a href={item.assetUrl} target="_blank" rel="noreferrer"><ExternalLink size={12}/>Open {item.assetType}</a>:null}</article>):<p>No handouts have been shared yet.</p>}</section><section><h4>Journal and recaps</h4>{memory.journal.length?memory.journal.map((item)=><article key={item.id}><span><FileText size={12}/>{item.type}</span><strong>{item.title}</strong><p>{item.body}</p></article>):<p>No player-visible entries yet.</p>}</section></div></section>;
}
