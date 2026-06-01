import { describe, expect, it } from "vitest";

import { upload } from "../src/middleware/upload.js";

function runFileFilter(file) {
  return new Promise((resolve) => {
    upload.fileFilter({}, file, (error, accepted) => {
      resolve({ error, accepted });
    });
  });
}

describe("upload fileFilter", () => {
  it("accepts a PDF with the matching MIME type", async () => {
    const { error, accepted } = await runFileFilter({
      originalname: "report.pdf",
      mimetype: "application/pdf"
    });

    expect(error).toBeNull();
    expect(accepted).toBe(true);
  });

  it("accepts a PNG image", async () => {
    const { error, accepted } = await runFileFilter({
      originalname: "screenshot.PNG",
      mimetype: "image/png"
    });

    expect(error).toBeNull();
    expect(accepted).toBe(true);
  });

  it("rejects a file whose extension/MIME pair does not match", async () => {
    const { error } = await runFileFilter({
      originalname: "report.pdf",
      mimetype: "text/plain"
    });

    expect(error).toBeDefined();
    expect(error.statusCode).toBe(400);
  });

  it("rejects unsupported extensions like .exe", async () => {
    const { error } = await runFileFilter({
      originalname: "payload.exe",
      mimetype: "application/octet-stream"
    });

    expect(error).toBeDefined();
    expect(error.statusCode).toBe(400);
  });
});
