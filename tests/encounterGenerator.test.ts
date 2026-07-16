import { describe,expect,it } from "vitest";
import { BUILT_IN_CREATURES } from "@/lib/builtInCreatures";
import { approximateHealth,calculateEncounterBudget,encounterSafetyWarnings,generateEncounter,reminderMatches } from "@/lib/encounterGenerator";
import type { EncounterPartyProfile } from "@/types/dmTools";

const party:EncounterPartyProfile={memberCount:4,levels:[3,3,3,3],averageLevel:3,averageArmorClass:15,totalMaxHp:100,averageMaxHp:25,healingCapacity:"medium",rangedCapacity:"low",controlCapacity:"low",areaDamageCapacity:"low",hasFlight:false,hasDarkvision:true,knownDamageTypes:[],commonResistances:[],sourceCharacterIds:["a","b","c","d"]};

describe("encounter preparation rules",()=>{
  it("uses documented 2014 thresholds",()=>expect(calculateEncounterBudget(party,"medium")).toMatchObject({target:600,minimum:480,maximum:720}));
  it("is deterministic for the same seed and filters",()=>{const input={seed:"fixed",campaignId:"c",difficulty:"medium" as const,environment:"forest"};const a=generateEncounter(input,party,BUILT_IN_CREATURES,"dm"),b=generateEncounter(input,party,BUILT_IN_CREATURES,"dm");expect(a.combatants.map(({name,quantity})=>({name,quantity}))).toEqual(b.combatants.map(({name,quantity})=>({name,quantity})));expect(a.objective).toBe(b.objective);});
  it("warns about flight and large hits",()=>{const warnings=encounterSafetyWarnings(party,[{creature:BUILT_IN_CREATURES.find((item)=>item.id==="air-elemental")!,quantity:2}]);expect(warnings.map((item)=>item.code)).toEqual(expect.arrayContaining(["one-hit","flying","area-damage"]));});
  it("matches bounded reminder triggers",()=>{const round={id:"r",label:"Wave",trigger:{type:"round-start" as const,round:3},repeat:false,completed:false};expect(reminderMatches(round,{type:"round-start",round:3})).toBe(true);expect(reminderMatches(round,{type:"round-start",round:2})).toBe(false);expect(reminderMatches({...round,snoozedUntilRound:4},{type:"round-start",round:3})).toBe(false);expect(reminderMatches({id:"t",label:"After goblin",trigger:{type:"turn-end",combatantId:"goblin"},repeat:false,completed:false},{type:"turn-end",round:3,combatantId:"goblin"})).toBe(true);});
  it("centralizes approximate health labels",()=>{expect(approximateHealth(10,10)).toBe("Unhurt");expect(approximateHealth(5,10)).toBe("Bloodied");expect(approximateHealth(0,10)).toBe("Defeated");});
});
