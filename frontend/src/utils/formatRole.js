const ROLE_LABELS = {
  ADMIN: "Administrator",
  REVIEWER: "Reviewer",
  SUPPORT_STAFF: "Support Staff"
};

export function formatRole(role) {
  if (!role) return "";
  return ROLE_LABELS[role] ?? role;
}
