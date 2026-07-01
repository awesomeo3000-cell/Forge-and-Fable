import raw from "@/data/subclasses.json";

type SubclassFeature = { level: number; name: string; description: string; source: string };

type SubclassEntry = {
  id: string; name: string; source: string; description: string;
  features?: SubclassFeature[];
};

type ClassEntry = {
  id: string; name: string; description: string;
  subclasses: SubclassEntry[];
  subclassLevel: number;
  subclassFeatureLevels: number[];
};

export const ALL_CLASSES: ClassEntry[] = raw as ClassEntry[];

const CLASS_BY_ID = new Map(ALL_CLASSES.map((c) => [c.id, c]));

export function getClassData(classId: string): ClassEntry | undefined {
  return CLASS_BY_ID.get(classId);
}

export function subclassesForClass(classId: string): SubclassEntry[] {
  return CLASS_BY_ID.get(classId)?.subclasses ?? [];
}

export function getSubclass(classId: string, subclassId: string): SubclassEntry | undefined {
  return CLASS_BY_ID.get(classId)?.subclasses.find((s) => s.id === subclassId);
}

export function subclassFeaturesForLevel(
  classId: string,
  subclassId: string,
  maxLevel: number,
): SubclassFeature[] {
  const sub = getSubclass(classId, subclassId);
  if (!sub?.features) return [];
  return sub.features.filter((f) => f.level <= maxLevel);
}

export function subclassesData() {
  return ALL_CLASSES;
}
