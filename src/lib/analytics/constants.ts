import type { RoleGroup } from "@/lib/analytics/types";

export const PROJECT_STATUS_RANKS: Record<string, number> = {
  Cancelled: -2,
  Stalled: -1,
  "Not Started": 0,
  "LP Outline Development": 1,
  "LP Development": 2,
  "ID Review of LP": 3,
  "LP Peer Review": 4,
  "SME Review": 5,
  "Rise Development": 6,
  "Staging - Media Development": 7,
  "In Voice Over": 8,
  "Compliance Review": 9,
  "CQO Review": 10,
  "Process Legal Review": 11,
  "Staging - Legal Review": 12,
  Testing: 13,
  "Testing Revisions": 14,
  "Ready for Loading": 15,
  "Ready to Publish": 16,
  Published: 17,
  Completed: 18,
};

export const FINALIZED_PROJECT_STATUSES = new Set(["Completed", "Published"]);

export const SAFE_COURSE_ALIASES: Record<string, string> = {
  "pre-hospital blood administration": "Prehospital Blood Administration",
  "dispatcher: stress mangement": "Dispatcher: Stress Management",
};

export const SAFE_PERSON_ALIASES: Record<string, string> = {
  "jeffrey dino": "Jeff Dino",
};

export const CATEGORY_PHASE_MAP: Record<string, string> = {
  "LP Outline Development LC": "Planning",
  "LP Development LC": "Planning",
  "ID Review of LP LC": "Review",
  "LP Peer Review LC": "Review",
  "SME Review LC": "Review",
  "CQO Review LC": "Review",
  "Compliance Review LC": "Review",
  "Process Legal Review LC": "Review",
  "Legal Review LC": "Review",
  "Rise Review LC": "Review",
  "Storyline Review LC": "Review",
  "LMS Review LC": "Review",
  "Rise Development LC": "Production",
  "Storyline Development LC": "Production",
  "LMS Development LC": "Production",
  "Media Development LC": "Production",
  "In Voice Over LC": "Production",
  "Testing LC": "QA/Release",
  "Testing Revisions LC": "QA/Release",
  "Loading LC": "QA/Release",
  "Ready to Publish LC": "QA/Release",
  "In Process LC": "Other",
};

export const OPERATIONAL_KEYWORDS = [
  "admin",
  "meeting",
  "ops",
  "operational",
  "support",
  "training support",
  "help desk",
  "documentation",
  "qa admin",
  "coordination",
  "email",
  "slack",
  "follow up",
  "follow-up",
  "internal",
  "external",
  "holiday",
  "pto",
  "vacation",
  "sick",
];

export const COURSE_LIKE_KEYWORDS = [
  "course",
  "training",
  "video",
  "module",
  "lesson",
  "readiness",
  "skills",
  "rescue",
  "firefighting",
  "dispatcher",
  "lifeline",
  "compliance",
  "introduction",
  "intro",
];

export const DEFAULT_ROLE_GROUP: RoleGroup = "Other/External";
