import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";

import PaginationBar from "@/components/PaginationBar.vue";

function factory(props) {
  return mount(PaginationBar, {
    props: {
      page: 2,
      pageSize: 25,
      total: 80,
      pageCount: 4,
      ...props
    }
  });
}

describe("PaginationBar", () => {
  it("renders the active range correctly", () => {
    const wrapper = factory({ page: 2, pageSize: 25, total: 80, pageCount: 4 });
    expect(wrapper.text()).toContain("26–50 of 80");
    expect(wrapper.text()).toContain("Page 2 / 4");
  });

  it("disables Previous on the first page", () => {
    const wrapper = factory({ page: 1, pageCount: 4 });
    const buttons = wrapper.findAll("button");
    const previousButton = buttons.find((button) => button.text() === "Previous");
    expect(previousButton.attributes("disabled")).toBeDefined();
  });

  it("disables Next on the last page", () => {
    const wrapper = factory({ page: 4, pageCount: 4 });
    const buttons = wrapper.findAll("button");
    const nextButton = buttons.find((button) => button.text() === "Next");
    expect(nextButton.attributes("disabled")).toBeDefined();
  });

  it("emits update:page when Next is clicked", async () => {
    const wrapper = factory({ page: 2, pageCount: 4 });
    const nextButton = wrapper.findAll("button").find((button) => button.text() === "Next");

    await nextButton.trigger("click");

    expect(wrapper.emitted("update:page")).toBeTruthy();
    expect(wrapper.emitted("update:page")[0]).toEqual([3]);
  });

  it("emits update:pageSize when the page size select changes", async () => {
    const wrapper = factory({ page: 1, pageCount: 4, pageSize: 25 });
    await wrapper.find("select").setValue(50);

    expect(wrapper.emitted("update:pageSize")).toBeTruthy();
    expect(wrapper.emitted("update:pageSize")[0]).toEqual([50]);
  });

  it("shows a friendly empty state when there are no results", () => {
    const wrapper = factory({ page: 1, total: 0, pageCount: 1 });
    expect(wrapper.text()).toContain("No results");
  });
});
