import type { CampaignHandout, CampaignJournalEntry, CampaignSession, CreatureLibraryRecord, EncounterRun, SavedEncounter, SessionSummary } from "@/types/dmTools";

async function api<T>(url:string,init?:RequestInit):Promise<T>{const response=await fetch(url,{...init,headers:{"Content-Type":"application/json",...(init?.headers??{})}});const data=await response.json().catch(()=>({})) as T&{error?:string};if(!response.ok)throw new Error(data.error??"Request failed.");return data;}
const body=(value:unknown)=>JSON.stringify(value);

export const dmToolsApi={
  listCreatures:(campaignId:string,search="")=>api<{creatures:CreatureLibraryRecord[];total:number}>(`/api/creatures?campaignId=${encodeURIComponent(campaignId)}&search=${encodeURIComponent(search)}&limit=100`),
  createCreature:(campaignId:string,creature:unknown)=>api<{creature:CreatureLibraryRecord}>("/api/creatures",{method:"POST",body:body({campaignId,creature})}),
  updateCreature:(id:string,creature:unknown)=>api<{creature:CreatureLibraryRecord}>(`/api/creatures/${id}`,{method:"PATCH",body:body(creature)}),
  archiveCreature:(id:string)=>api<{ok:true}>(`/api/creatures/${id}`,{method:"DELETE"}),
  duplicateCreature:(id:string,campaignId:string)=>api<{creature:CreatureLibraryRecord}>(`/api/creatures/${id}/duplicate`,{method:"POST",body:body({campaignId})}),
  listEncounters:(campaignId:string)=>api<{encounters:SavedEncounter[]}>(`/api/encounters?campaignId=${encodeURIComponent(campaignId)}`),
  createEncounter:(campaignId:string,encounter:unknown)=>api<{encounter:SavedEncounter}>("/api/encounters",{method:"POST",body:body({campaignId,encounter})}),
  updateEncounter:(id:string,encounter:unknown)=>api<{encounter:SavedEncounter}>(`/api/encounters/${id}`,{method:"PATCH",body:body(encounter)}),
  deleteEncounter:(id:string)=>api<{ok:true}>(`/api/encounters/${id}`,{method:"DELETE"}),
  duplicateEncounter:(id:string)=>api<{encounter:SavedEncounter}>(`/api/encounters/${id}/duplicate`,{method:"POST",body:"{}"}),
  startEncounter:(id:string)=>api<{run:EncounterRun}>(`/api/encounters/${id}/start`,{method:"POST",body:"{}"}),
  generateEncounter:(input:unknown)=>api<{encounter:SavedEncounter}>("/api/encounters/generate",{method:"POST",body:body(input)}),
  listHandouts:(campaignId:string)=>api<{handouts:CampaignHandout[]}>(`/api/campaigns/${campaignId}/handouts`),
  createHandout:(campaignId:string,input:unknown)=>api<{handout:CampaignHandout}>(`/api/campaigns/${campaignId}/handouts`,{method:"POST",body:body(input)}),
  updateHandout:(campaignId:string,id:string,input:unknown)=>api<{handout:CampaignHandout}>(`/api/campaigns/${campaignId}/handouts/${id}`,{method:"PATCH",body:body(input)}),
  archiveHandout:(campaignId:string,id:string)=>api<{ok:true}>(`/api/campaigns/${campaignId}/handouts/${id}`,{method:"DELETE"}),
  shareHandout:(campaignId:string,id:string)=>api<{handout:CampaignHandout}>(`/api/campaigns/${campaignId}/handouts/${id}/share`,{method:"POST",body:"{}"}),
  listJournal:(campaignId:string)=>api<{entries:CampaignJournalEntry[]}>(`/api/campaigns/${campaignId}/journal`),
  createJournal:(campaignId:string,input:unknown)=>api<{entry:CampaignJournalEntry}>(`/api/campaigns/${campaignId}/journal`,{method:"POST",body:body(input)}),
  updateJournal:(campaignId:string,id:string,input:unknown)=>api<{entry:CampaignJournalEntry}>(`/api/campaigns/${campaignId}/journal/${id}`,{method:"PATCH",body:body(input)}),
  listSessions:(campaignId:string)=>api<{sessions:CampaignSession[]}>(`/api/campaigns/${campaignId}/sessions`),
  startSession:(campaignId:string,input:unknown)=>api<{session:CampaignSession}>(`/api/campaigns/${campaignId}/sessions`,{method:"POST",body:body(input)}),
  endSession:(campaignId:string,id:string)=>api<{session:CampaignSession}>(`/api/campaigns/${campaignId}/sessions/${id}`,{method:"PATCH",body:body({action:"end"})}),
  saveSummary:(campaignId:string,id:string,summary:SessionSummary)=>api<{summary:SessionSummary}>(`/api/campaigns/${campaignId}/sessions/${id}/summary`,{method:"PUT",body:body(summary)}),
  publishSummary:(campaignId:string,id:string)=>api<{entry:CampaignJournalEntry}>(`/api/campaigns/${campaignId}/sessions/${id}/summary`,{method:"POST",body:"{}"}),
  pin:(campaignId:string,sessionId:string,input:unknown)=>api<{pin:unknown}>(`/api/campaigns/${campaignId}/sessions/${sessionId}/pins`,{method:"POST",body:body(input)}),
  workspace:(campaignId:string)=>api<{activeSession:CampaignSession|null;activeEncounter:EncounterRun|null}>(`/api/campaigns/${campaignId}/workspace`),
  updateRun:(campaignId:string,runId:string,input:unknown)=>api<{ok:true;reminders?:EncounterRun["reminders"]}>(`/api/campaigns/${campaignId}/encounter-runs/${runId}`,{method:"PATCH",body:body(input)}),
};
