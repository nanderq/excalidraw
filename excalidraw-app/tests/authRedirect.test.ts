import { getSafeAuthDestination } from "../auth-redirect";

describe("getSafeAuthDestination", () => {
  it("removes the one-time auth token from the callback destination", () => {
    expect(getSafeAuthDestination("/?ott=one-time-token")).toBe("/");
    expect(
      getSafeAuthDestination("/board/workspace?view=canvas&ott=one-time-token"),
    ).toBe("/board/workspace?view=canvas");
  });

  it("preserves ordinary path, query, and hash destinations", () => {
    expect(getSafeAuthDestination("/join/invite?source=email#canvas")).toBe(
      "/join/invite?source=email#canvas",
    );
  });

  it("rejects external and protocol-relative redirects", () => {
    expect(getSafeAuthDestination("https://example.com")).toBe("/");
    expect(getSafeAuthDestination("//example.com")).toBe("/");
    expect(getSafeAuthDestination(null)).toBe("/");
  });
});
