import fs from "fs";
import { client } from "../lib/openai.js";

const MODEL = "text-embedding-3-small";

const groups = [
  [
    "我喜歡喝咖啡",
    "咖啡的香氣很迷人",
    "我每天早上都要喝一杯咖啡",
  ],
  [
    "高鐵快要進站了",
    "這部電影很好看",
    "手機快沒電了",
  ],
  [
    // 第三組：自訂測試案例
    "今天天氣很適合跑步",
    "我準備一份簡單的午餐",
    "昨晚做了一個奇怪的夢",
  ],
];

function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function norm(a) {
  return Math.sqrt(dot(a, a));
}

function cosineSimilarity(a, b) {
  return dot(a, b) / (norm(a) * norm(b));
}

async function embedMany(texts) {
  const res = await client.embeddings.create({ model: MODEL, input: texts });
  return res.data.map((d) => d.embedding);
}

async function run() {
  try {
    const results = [];

    for (let gi = 0; gi < groups.length; gi++) {
      const group = groups[gi];
      console.log(`\nGroup ${gi + 1} sentences:`);
      group.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));

      const embs = await embedMany(group);

      const sims = [];
      for (let i = 0; i < embs.length; i++) {
        for (let j = i + 1; j < embs.length; j++) {
          const sim = cosineSimilarity(embs[i], embs[j]);
          sims.push({ i: i + 1, j: j + 1, sim });
        }
      }

      sims.forEach((s) =>
        console.log(`  sim(${s.i},${s.j}) = ${s.sim.toFixed(6)}`)
      );

      results.push({ group: gi + 1, sentences: group, sims });
    }

    // 將結果存成 markdown
    let md = "# Embeddings 相似度實驗結果\n\n";
    for (const r of results) {
      md += `## 第 ${r.group} 組\n\n`;
      r.sentences.forEach((s, idx) => {
        md += `${idx + 1}. ${s}\n`;
      });
      md += `\n**兩兩相似度**\n\n`;
      r.sims.forEach((s) => {
        md += `- sim(${s.i},${s.j}) = ${s.sim.toFixed(6)}\n`;
      });
      md += `\n`;
    }

    md += `## 簡要分析\n\n`;
    md += `第 1 組句子預期相似度較高（語意相近），第 2 組句子預期相似度較低（語意不相關）。\n`;

    const outPath = "/workspaces/ai-agent-js/HOMEWORK4/embeddings_results.md";
    fs.writeFileSync(outPath, md, "utf8");
    console.log(`\n結果已寫入 ${outPath}`);
  } catch (err) {
    console.error("執行失敗：", err.message || err);
    console.error(
      "請確認已在環境變數中設定 OPENAI_API_KEY，並且網路可連到 OpenAI API。"
    );
    process.exit(1);
  }
}

run();
