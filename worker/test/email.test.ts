import { describe, expect, it } from "vitest";
import { buildLicenseEmail } from "../src/email";

describe("buildLicenseEmail", () => {
  it("includes the license, download URL, and support email in text and HTML", () => {
    const email = buildLicenseEmail({
      licenseKey: "cc_live_test_123",
      downloadUrl: "https://example.com/downloads/ChaChing.dmg",
      supportEmail: "support@example.com"
    });

    expect(email.subject).toBe("Your Cha-Ching license");
    expect(email.text).toContain("cc_live_test_123");
    expect(email.text).toContain("https://example.com/downloads/ChaChing.dmg");
    expect(email.text).toContain("Drag ChaChing.app to Applications");
    expect(email.text).toContain("support@example.com");
    expect(email.html).toContain("cc_live_test_123");
    expect(email.html).toContain("https://example.com/downloads/ChaChing.dmg");
    expect(email.html).toContain("Drag <strong>ChaChing.app</strong> to Applications");
    expect(email.html).toContain("mailto:support@example.com");
    expect(email.html).not.toContain("undefined");
  });

  it("escapes dynamic HTML fields", () => {
    const email = buildLicenseEmail({
      licenseKey: "cc_live_<script>",
      downloadUrl: "https://example.com/?q=<tag>",
      supportEmail: "support+test@example.com"
    });

    expect(email.html).toContain("cc_live_&lt;script&gt;");
    expect(email.html).toContain("https://example.com/?q=&lt;tag&gt;");
    expect(email.html).not.toContain("cc_live_<script>");
  });
});
