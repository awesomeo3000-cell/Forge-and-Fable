export type CantripChoiceLike = {
  choiceId: string;
  count?: number;
};

export type CantripSelectionGroup = {
  id: string;
  label: string;
  count: number;
  sourceClass: string;
  allowedSpellIds?: string[];
};

function classLabel(classId: string): string {
  return classId.charAt(0).toUpperCase() + classId.slice(1);
}

function choiceCount(choice: CantripChoiceLike): number {
  return choice.count ?? Number(choice.choiceId.match(/choose-(\d+)/)?.[1] ?? 1);
}

function choiceGroup(choice: CantripChoiceLike, classId: string): CantripSelectionGroup {
  const { choiceId } = choice;
  const count = choiceCount(choice);
  if (choiceId === "choose-light-cantrip") {
    return {
      id: choiceId,
      label: "Light cantrip",
      count,
      sourceClass: classId,
      allowedSpellIds: ["light"],
    };
  }

  const sourceClass = choiceId.includes("wizard-cantrip")
    ? "wizard"
    : choiceId.includes("druid-cantrip")
      ? "druid"
      : classId;
  const sourceLabel = classLabel(sourceClass);
  const label = choiceId.includes("bonus-")
    ? `Bonus ${sourceLabel} cantrip${count === 1 ? "" : "s"}`
    : `${sourceLabel} cantrips`;

  return { id: choiceId, label, count, sourceClass };
}

/**
 * Build the independent cantrip pools that a level-up or creation step must
 * satisfy. Class packets expose the normal class gain through spellChanges,
 * while subclasses and racial features expose explicit cantrip choices.
 */
export function buildCantripSelectionGroups(input: {
  classId: string;
  classCantripGain: number;
  choices?: CantripChoiceLike[];
  includeHighElfCantrip?: boolean;
}): CantripSelectionGroup[] {
  const cantripChoices = (input.choices ?? []).filter((choice) => choice.choiceId.includes("cantrip"));
  const groups: CantripSelectionGroup[] = [];
  const baseChoice = cantripChoices.find((choice) => /^choose-\d+-cantrips?$/.test(choice.choiceId));

  if (baseChoice) {
    groups.push({
      id: baseChoice.choiceId,
      label: `${classLabel(input.classId)} cantrips`,
      count: choiceCount(baseChoice),
      sourceClass: input.classId,
    });
  } else if (input.classCantripGain > 0) {
    groups.push({
      id: `${input.classId}-class-cantrips`,
      label: `${classLabel(input.classId)} cantrips`,
      count: input.classCantripGain,
      sourceClass: input.classId,
    });
  }

  for (const choice of cantripChoices) {
    if (choice === baseChoice) continue;
    groups.push(choiceGroup(choice, input.classId));
  }

  if (input.includeHighElfCantrip) {
    groups.push({
      id: "high-elf-cantrip",
      label: "High Elf wizard cantrip",
      count: 1,
      sourceClass: "wizard",
    });
  }

  return groups.filter((group) => group.count > 0);
}
