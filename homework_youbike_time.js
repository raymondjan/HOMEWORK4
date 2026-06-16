import { input } from "@inquirer/prompts";
import { client, DEFAULT_MODEL } from "./lib/openai.js";
import { spinner } from "./utils/spinner.js";
import { toOpenAITool } from "./utils/func-tool.js";
import { currentTimeTool } from "./tools/current_time.js";
import { youbikeAreaTool } from "./tools/youbike_area.js";
import { initMessage, addMessage, getMessages } from "./db/messages.js";

const toolList = [currentTimeTool, youbikeAreaTool];
const tools = toolList.map(toOpenAITool);
const AVAILABLE_TOOLS = Object.fromEntries(toolList.map((t) => [t.name, t.fn]));

class ChatManager {
  constructor() {
    this.systemPrompt = `你是一個台北市旅遊助手。你可以幫助使用者：
1. 查詢現在的時間（使用 get_current_time 工具）
2. 查詢特定台北市行政區是否有 YouBike 站點及可租借車輛數（使用 get_youbike_by_area 工具）

當使用者詢問時間或 YouBike 相關問題時，請直接使用相應的工具查詢，然後以友善的方式回答。
請用繁體中文回答。`;
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
    await addMessage(content);
  }

  async addTool(content, tool_call_id) {
    if (tool_call_id) {
      await addMessage({ role: "tool", tool_call_id, content: JSON.stringify(content) });
    } else {
      await addMessage({ role: "tool", content: JSON.stringify(content) });
    }
  }

  async getMessagesForModel() {
    const stored = getMessages();
    const systemMsg = { role: "system", content: this.systemPrompt };
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

      // 儲存 assistant 回覆（包含 tool_calls）
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

        // 儲存 tool 回覆
        await chat.addTool(result, toolCall.id);
      }
    }

    if (chat.turns >= 5) {
      console.log("（系統）已儲存近期對話為長期記憶。");
    }
  }
} catch (err) {
  if (err.name === "ExitPromptError") {
    console.log("\n再會~");
  } else {
    throw err;
  }
}
