import {
  automationResults,
  incidentCategories,
  incidentDepartments,
  incidentPriorities,
  incidentStatuses,
  sourceTypes,
  userRoles
} from "../constants/incident.constants.js";
import { permissions, rolePermissions } from "../constants/authorization.constants.js";

export const metaController = {
  getIncidentOptions(_request, response) {
    response.json({
      categories: incidentCategories,
      priorities: incidentPriorities,
      statuses: incidentStatuses,
      departments: incidentDepartments,
      source_types: sourceTypes,
      automation_results: automationResults,
      user_roles: userRoles,
      permissions,
      role_permissions: rolePermissions
    });
  }
};
