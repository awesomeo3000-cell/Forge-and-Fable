import { CalendarClock, ClipboardList, Compass, Download, KeyRound, Sparkles, Swords, UserRound, Users, ScrollText, DoorOpen } from "lucide-react";
import type { DashboardActionId } from "@/lib/dashboardContext";

/** One icon per action id — kept beside the context model so the grid stays
    presentation-only. */
export const ACTION_ICON: Record<DashboardActionId, typeof Swords> = {
  "create-character": Sparkles,
  "continue-character": UserRound,
  "start-campaign": Compass,
  "open-campaign": DoorOpen,
  "join-campaign": KeyRound,
  "next-session": CalendarClock,
  "prepare-session": ClipboardList,
  "review-party": Users,
  "import-character": Download,
  "manage-campaigns": ScrollText,
};
