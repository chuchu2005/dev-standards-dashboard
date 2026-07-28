export type ParsedMessage = {
  role: string;        // "freelancer" | "client" | "unknown"
  author: string;
  content: string;
  timestamp: string | null;
};

// Matches "Author: ...", "Author — ...", or "Author - ...", optionally with a bracketed timestamp.
// Note: the char class `[[(]` accepts a square or round opening bracket for the optional timestamp
// (e.g. "Alice [10:00]:" or "Alice (10:00):"); the matching close char class `[\])]` accepts both.
const SPEAKER_RE = /^(?<author>[A-Za-z][A-Za-z0-9 .'_-]{0,60}?)\s*(?:[[(][^\])]*[\])])?\s*[:—-]\s*(?<rest>.*)$/;

function matchesDeveloper(author: string, dev: string | undefined): boolean {
  if (!dev) return false;
  const a = author.trim().toLowerCase();
  const d = dev.trim().toLowerCase();
  return a.length > 0 && (a.includes(d) || d.includes(a));
}

export function parseConversation(raw: string, developerName?: string): ParsedMessage[] {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const out: ParsedMessage[] = [];
  let cur: ParsedMessage | null = null;

  const push = () => {
    if (cur && (cur.content.trim() || cur.author.trim())) out.push(cur);
    cur = null;
  };

  for (const line of lines) {
    const m = SPEAKER_RE.exec(line);
    if (m && m.groups && m.groups.author.trim()) {
      push();
      cur = {
        role: matchesDeveloper(m.groups.author, developerName) ? "freelancer" : "client",
        author: m.groups.author.trim(),
        content: m.groups.rest ?? "",
        timestamp: null,
      };
    } else if (cur) {
      cur.content += (cur.content ? "\n" : "") + line;
    } else {
      cur = { role: "client", author: "", content: line, timestamp: null };
    }
  }
  push();
  return out;
}
