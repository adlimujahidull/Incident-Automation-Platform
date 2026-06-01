import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";

import IncidentFilterPanel from "@/components/IncidentFilterPanel.vue";

const baseOptions = {
  statuses: ["OPEN", "ASSIGNED", "RESOLVED"],
  priorities: ["Low", "Medium", "High", "Critical"],
  categories: ["Damaged Parcel", "Late Delivery"],
  departments: ["Warehouse", "Customer Support"],
  source_types: ["MANUAL_UPLOAD", "EMAIL", "RPA"]
};

const emptyFilters = {
  query: "",
  status: [],
  priority: [],
  category: [],
  department: [],
  source_type: [],
  assignee: "",
  bucket: "",
  from: "",
  to: "",
  tags: [],
  creator: ""
};

function factory(filters = emptyFilters) {
  return mount(IncidentFilterPanel, {
    props: {
      modelValue: filters,
      options: baseOptions,
      assignees: [],
      busy: false
    }
  });
}

describe("IncidentFilterPanel", () => {
  it("emits update:modelValue when a status chip is toggled on", async () => {
    const wrapper = factory();
    const openChip = wrapper
      .findAll(".chip-toggle")
      .find((node) => node.text() === "Open");

    await openChip.trigger("click");

    const emitted = wrapper.emitted("update:modelValue");
    expect(emitted).toBeTruthy();
    expect(emitted[0][0].status).toEqual(["OPEN"]);
  });

  it("removes a chip from the selection when clicked again", async () => {
    const wrapper = factory({ ...emptyFilters, status: ["OPEN"] });
    const openChip = wrapper
      .findAll(".chip-toggle")
      .find((node) => node.text() === "Open");

    expect(openChip.classes()).toContain("is-active");

    await openChip.trigger("click");

    const emitted = wrapper.emitted("update:modelValue");
    expect(emitted[0][0].status).toEqual([]);
  });

  it("emits apply on form submit", async () => {
    const wrapper = factory();
    await wrapper.find("form").trigger("submit.prevent");

    expect(wrapper.emitted("apply")).toBeTruthy();
  });

  it("emits reset when the Reset button is clicked", async () => {
    const wrapper = factory();
    const resetButton = wrapper.findAll("button").find((button) => button.text() === "Reset");
    await resetButton.trigger("click");

    expect(wrapper.emitted("reset")).toBeTruthy();
  });
});
