import { apiClient } from "./api";

export const uploadService = {
  async listStaged(params = {}) {
    const { data } = await apiClient.get("/uploads", {
      params
    });

    return data.items;
  },

  async uploadEvidence(payload) {
    const formData = new FormData();

    formData.append("file", payload.file);

    if (payload.incident_id) {
      formData.append("incident_id", payload.incident_id);
    }

    if (payload.source_type) {
      formData.append("source_type", payload.source_type);
    }

    if (payload.source_label) {
      formData.append("source_label", payload.source_label);
    }

    if (payload.intake_reference) {
      formData.append("intake_reference", payload.intake_reference);
    }

    if (payload.notes) {
      formData.append("notes", payload.notes);
    }

    const { data } = await apiClient.post("/uploads", formData, {
      headers: {
        "Content-Type": "multipart/form-data"
      }
    });

    return data;
  },

  async fetchAttachmentBlob(id) {
    const { data } = await apiClient.get(`/uploads/${id}/download`, {
      responseType: "blob"
    });

    return data;
  },

  async extractAttachment(id) {
    const { data } = await apiClient.post(`/uploads/${id}/extract`);
    return data;
  }
};
