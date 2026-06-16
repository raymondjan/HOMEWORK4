import { input } from "@inquirer/prompts";
import { client, DEFAULT_MODEL } from "./lib/openai.js";
import { spinner } from "./utils/spinner.js";
import { toOpenAITool } from "./utils/func-tool.js";
import * as allTools from "./tools/index.js";
import { initMessage, addMessage, getMessages } from "./db/messages.js";

const toolList = Object.values(allTools);
const tools = toolList.map(toOpenAITool);
const AVAILABLE_TOOLS = Object.fromEntries(toolList.map((t) => [t.name, t.fn]));

class ChatManager {
  constructor() {
    this.systemPrompt = `你是一個有幫助的助手。請用繁體中文回答使用者的問題。當使用者詢問天氣、時間、單位換算等相關問題時，請使用可用的工具來獲取準確資訊並提供回應。`;
    this.turns = 0;
  }

  async init() {
    await initMessage(this.systemPrompt);
  }

  async addUser(content) {
    this.turns += 1;
    await addMessage(content, "user");
  }

  async addAssistant(content) {
    await addMessage(content, "assistant");
  }

  async addTool(content, tool_call_id = null) {
    if (tool_call_id) {
      await addMessage({ role: "tool", tool_call_id, content: JSON.stringify(content) });
    } else {
      await addMessage({ role: "tool", content: JSON.stringify(content) });
    }
  }

  async getMessagesForModel() {
    const stored = getMessages();
    // Build messages array: ensure system prompt first (role: system)
    const systemMsg = { role: "system", content: this.systemPrompt };
    // Filter out any developer placeholders in stored messages
    const filtered = stored.filter((m) => m.role !== "developer");
    return [systemMsg, ...filtered];
  }
}

const chat = new ChatManager();

try {
  await chat.init();

  while (true) {
    const userQuestion = (await input({ message: "請輸入你的問題（輸入 exit 離開）：" })).trim();

    if (userQuestion === "") continue;
    if (userQuestion.toLowerCase() === "exit") {
      console.log("再會~");
      break;
    }

    await chat.addUser(userQuestion);

    while (true) {
      const spin = spinner("思考中...").start();

      const messages = await chat.getMessagesForModel();

      const response = await client.chat.completions.create({
        model: DEFAULT_MODEL,
        messages,
        tools,
        tool_choice: "auto",
      });

      spin.stop();

      const message = response.choices[0].message;

      // 儲存 assistant 回覆（包含 tool_calls），必須先儲存才能接續儲存 role:tool 的回覆
      await chat.addAssistant(message);

      // 如果沒有 tool 呼叫，直接印出回覆並跳出內層
      if (!message.tool_calls || message.tool_calls.length === 0) {
        console.log(message.content);
        break;
      }

      // 處理 tool 呼叫
      for (const toolCall of message.tool_calls) {
        const fnName = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments);
        console.log(`\n[呼叫 tool] ${fnName}(${JSON.stringify(args)})`);

        const fn = AVAILABLE_TOOLS[fnName];
        const result = await fn(args);

        // 儲存 tool 回覆（會以 role:tool 儲存，並帶上 tool_call id）
        await chat.addTool(result, toolCall.id);
      }
    }

    // 小提示：若已達 5 輪以上，顯示記憶已保存
    if (chat.turns >= 5) {
      console.log("（系統）已儲存近期對話為長期記憶，可在後續對話中被參考。");
    }
  }
} catch (err) {
  if (err.name === "ExitPromptError") {
    console.log("\n再會~");
  } else {
    throw err;
  }
}
