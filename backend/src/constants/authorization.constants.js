export const permissions = {
  view_dashboard: "view_dashboard",
  view_incidents: "view_incidents",
  create_incidents: "create_incidents",
  edit_incidents: "edit_incidents",
  assign_incidents: "assign_incidents",
  comment_incidents: "comment_incidents",
  transition_incidents: "transition_incidents",
  upload_attachments: "upload_attachments",
  run_ai_analysis: "run_ai_analysis",
  apply_ai_suggestions: "apply_ai_suggestions",
  view_automation_logs: "view_automation_logs",
  create_automation_logs: "create_automation_logs",
  view_users: "view_users",
  view_settings: "view_settings",
  view_meta: "view_meta",
  delete_incidents: "delete_incidents"
};

export const rolePermissions = {
  ADMIN: [
    permissions.view_dashboard,
    permissions.view_incidents,
    permissions.create_incidents,
    permissions.edit_incidents,
    permissions.assign_incidents,
    permissions.comment_incidents,
    permissions.transition_incidents,
    permissions.upload_attachments,
    permissions.run_ai_analysis,
    permissions.apply_ai_suggestions,
    permissions.view_automation_logs,
    permissions.create_automation_logs,
    permissions.view_users,
    permissions.view_settings,
    permissions.view_meta,
    permissions.delete_incidents
  ],
  REVIEWER: [
    permissions.view_dashboard,
    permissions.view_incidents,
    permissions.create_incidents,
    permissions.edit_incidents,
    permissions.assign_incidents,
    permissions.comment_incidents,
    permissions.transition_incidents,
    permissions.upload_attachments,
    permissions.run_ai_analysis,
    permissions.apply_ai_suggestions,
    permissions.view_automation_logs,
    permissions.view_meta
  ],
  SUPPORT_STAFF: [
    permissions.view_dashboard,
    permissions.view_incidents,
    permissions.create_incidents,
    permissions.comment_incidents,
    permissions.upload_attachments,
    permissions.run_ai_analysis,
    permissions.view_meta
  ]
};

export function getRolePermissions(role) {
  return rolePermissions[role] ?? [];
}

export function hasPermission(role, permission) {
  return getRolePermissions(role).includes(permission);
}
