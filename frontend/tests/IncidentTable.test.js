import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";

import IncidentTable from "@/components/IncidentTable.vue";

const sampleIncidents = [
  {
    id: "i_1",
    incident_code: "INC-2026-0001",
    title: "Damaged parcel reported",
    category: "Damaged Parcel",
    priority: "High",
    status: "OPEN",
    assigned_department: "Warehouse",
    assigned_to: { name: "Jane Doe", role: "REVIEWER" },
    updated_at: "2026-05-13T08:00:00Z"
  },
  {
    id: "i_2",
    incident_code: "INC-2026-0002",
    title: "Tracking missing",
    category: "Tracking Failure",
    priority: "Critical",
    status: "ASSIGNED",
    assigned_department: "Technical Support",
    assigned_to: null,
    updated_at: "2026-05-13T09:00:00Z"
  }
];

function buildRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/", component: { template: "<div />" } },
      { path: "/incidents/:id", component: { template: "<div />" } }
    ]
  });
}

function factory(props = {}) {
  return mount(IncidentTable, {
    props: {
      incidents: sampleIncidents,
      sortable: true,
      sortBy: "created_at",
      sortDir: "desc",
      showAssignee: true,
      ...props
    },
    global: {
      plugins: [buildRouter()]
    }
  });
}

describe("IncidentTable", () => {
  it("renders one row per incident", () => {
    const wrapper = factory();
    const dataRows = wrapper.findAll("tbody tr");
    expect(dataRows).toHaveLength(2);
    expect(dataRows[0].text()).toContain("INC-2026-0001");
    expect(dataRows[1].text()).toContain("INC-2026-0002");
  });

  it("shows 'Unassigned' when the assignee is null", () => {
    const wrapper = factory();
    expect(wrapper.text()).toContain("Unassigned");
  });

  it("emits sort with the next direction when a sortable header is clicked", async () => {
    const wrapper = factory({ sortBy: "priority", sortDir: "desc" });
    const priorityHeader = wrapper
      .findAll("th")
      .find((node) => node.text().includes("Priority"));

    await priorityHeader.trigger("click");

    const events = wrapper.emitted("sort");
    expect(events).toBeTruthy();
    expect(events[0][0]).toEqual({ sortBy: "priority", sortDir: "asc" });
  });

  it("renders the empty row message when no incidents are supplied", () => {
    const wrapper = factory({ incidents: [] });
    expect(wrapper.text()).toContain("No incidents match the current filters.");
  });
});
