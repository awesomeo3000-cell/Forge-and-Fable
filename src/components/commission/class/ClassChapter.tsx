"use client";

import { useState } from "react";
import type { CharacterSettings, DraftCharacter, HeroClass } from "@/types/game";
import { classDescriptor } from "@/lib/ledgerCopy";
import ClassCatalog from "./ClassCatalog";
import ClassFeature from "./ClassFeature";
import ClassMechanics from "./ClassMechanics";
import ClassCommissionDetails, { type ClassHpSummary, type ClassSkillSummary } from "./ClassCommissionDetails";
import { classCardDescription } from "./classPresentation";

/**
 * Chapter III workspace (Orrery Path redesign): scalable class catalog on
 * the left, selected-class feature + mechanics + required decisions on the
 * right. CreatorPanel remains the state owner — the draft, all selection
 * handlers, and the completion rules arrive as props. The only local state
 * here is ephemeral presentation state: the search query and which class is
 * being previewed in the workspace.
 *
 * Preview vs confirmed: clicking a catalog card previews the class; the
 * feature card's primary action commits it to the draft (via onSelectClass,
 * which clears class-dependent choices exactly as before). The draft's
 * classId stays authoritative for Continue validation throughout.
 */
export default function ClassChapter(props: {
  classes: HeroClass[];
  draft: DraftCharacter;
  hp: ClassHpSummary;
  skills: ClassSkillSummary;
  onSelectClass: (classId: string) => void;
  onInspectClass: (classId: string) => void;
  onChangeLevel: (level: number) => void;
  onChangeHitPointType: (type: CharacterSettings["hitPointType"]) => void;
  onRollStartingHp: () => void;
  onToggleSkill: (skillId: string) => void;
  onToggleTool: (tool: string, options: string[], count: number) => void;
}) {
  const [previewedClassId, setPreviewedClassId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const confirmedClassId = props.draft.classId;
  const displayedClass =
    props.classes.find((entry) => entry.id === (previewedClassId ?? confirmedClassId)) ?? null;

  const needle = query.trim().toLowerCase();
  const filteredClasses = needle
    ? props.classes.filter((entry) =>
        [entry.name, classCardDescription(entry), classDescriptor(entry.id), entry.summary]
          .join(" ")
          .toLowerCase()
          .includes(needle),
      )
    : props.classes;

  return (
    <div className="ao-class-chapter">
      <div className="ao-class-workspace">
        <ClassCatalog
          classes={filteredClasses}
          totalCount={props.classes.length}
          query={query}
          onQueryChange={setQuery}
          selectedClassId={confirmedClassId || null}
          previewedClassId={displayedClass?.id ?? null}
          onPreview={setPreviewedClassId}
        />
        <div className="ao-class-detail">
          {displayedClass ? (
            <>
              <ClassFeature
                heroClass={displayedClass}
                confirmed={displayedClass.id === confirmedClassId}
                onConfirm={() => {
                  props.onSelectClass(displayedClass.id);
                  setPreviewedClassId(null);
                }}
                onInspect={() => props.onInspectClass(displayedClass.id)}
              />
              <ClassMechanics heroClass={displayedClass} />
              {displayedClass.id === confirmedClassId ? (
                <ClassCommissionDetails
                  heroClass={displayedClass}
                  draft={props.draft}
                  hp={props.hp}
                  skills={props.skills}
                  onChangeLevel={props.onChangeLevel}
                  onChangeHitPointType={props.onChangeHitPointType}
                  onRollStartingHp={props.onRollStartingHp}
                  onToggleSkill={props.onToggleSkill}
                  onToggleTool={props.onToggleTool}
                />
              ) : (
                <p className="ao-class-detail-note">
                  {`You are previewing the ${displayedClass.name.toLowerCase()}. Select ${displayedClass.name} to configure its starting options.`}
                </p>
              )}
            </>
          ) : (
            <div className="ao-class-empty">
              <strong>Choose your calling</strong>
              <p>Every legend begins with a calling. Pick a class from the catalog to preview it here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
