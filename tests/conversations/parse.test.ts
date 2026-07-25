// tests/conversations/parse.test.ts
import { describe, it, expect } from "vitest";
import { parseConversation } from "@/lib/conversations/parse";

describe("parseConversation", () => {
  it("splits speaker turns", () => {
    const msgs = parseConversation("Alice: hello\nBob: hi there");
    expect(msgs).toHaveLength(2);
    expect(msgs[0]).toMatchObject({ author: "Alice", content: "hello" });
    expect(msgs[1]).toMatchObject({ author: "Bob", content: "hi there" });
  });

  it("tags the freelancer when author matches developerName", () => {
    const msgs = parseConversation("Alice: hi\nBob: sure", "Bob");
    expect(msgs.find((m) => m.author === "Bob")?.role).toBe("freelancer");
    expect(msgs.find((m) => m.author === "Alice")?.role).toBe("client");
  });

  it("collects multi-line content into one message", () => {
    const msgs = parseConversation("Alice: line one\nstill alice\nBob: ok");
    expect(msgs).toHaveLength(2);
    expect(msgs[0].content).toBe("line one\nstill alice");
  });

  it("returns a single message when no speakers are detected", () => {
    const msgs = parseConversation("just a blob of text\nwith two lines");
    expect(msgs).toHaveLength(1);
    expect(msgs[0].content).toContain("blob of text");
  });

  it("ignores a bracketed timestamp in the speaker line", () => {
    const msgs = parseConversation("Alice (10:00): hello");
    expect(msgs[0]).toMatchObject({ author: "Alice", content: "hello" });
  });
});
