import { mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";

const HISTORY_DIR = ".history";

if (!existsSync(HISTORY_DIR)) {
  mkdirSync(HISTORY_DIR, { recursive: true });
}

const filename = `${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
const filepath = join(HISTORY_DIR, filename);

const adapter = new JSONFile(filepath);
const db = new Low(adapter, { messages: [] });

await db.read();

export async function initMessage(systemPrompt) {
  if (db.data.messages.length === 0) {
    db.data.messages.push({ role: "developer", content: systemPrompt });
    await db.write();
  }
}

export async function addMessage(content, role = "user") {
  // If caller passed a full message object (including role), store it as-is.
  if (content && typeof content === "object" && (content.role || content.content || content.tool_calls)) {
    // Ensure role is set on the stored object
    const entry = { ...(content.role ? {} : {}), ...content };
    if (!entry.role) entry.role = role;
    db.data.messages.push(entry);
  } else {
    db.data.messages.push({ role, content });
  }
  await db.write();
}

export function getMessages() {
  return db.data.messages;
}
