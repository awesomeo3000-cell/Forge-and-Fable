import { BookOpen, CalendarClock, ClipboardList, Download, KeyRound, Sparkles, Swords, UserRound, Users } from "lucide-react";
import type { DashboardActionId } from "@/lib/dashboardContext";

/** One icon per action id — kept beside the context model so the grid stays
    presentation-only. */
export const ACTION_ICON: Record<DashboardActionId, typeof Swords> = {
  "create-character": Sparkles,
  "continue-character": UserRound,
  "start-campaign": Swords,
  "open-campaign": Swords,
  "join-campaign": KeyRound,
  "next-session": CalendarClock,
  "prepare-session": ClipboardList,
  "review-party": Users,
  "import-character": Download,
  "manage-campaigns": BookOpen,
};
