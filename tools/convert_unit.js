import { z } from "zod";
import { defineTool } from "../utils/func-tool.js";

function normalizeUnit(u) {
  if (!u || typeof u !== "string") return null;
  const s = u.trim().toLowerCase();
  if (["c", "°c", "celsius", "攝氏", "攝氏度"].includes(s)) return "celsius";
  if (["f", "°f", "fahrenheit", "華氏", "華氏度"].includes(s)) return "fahrenheit";
  if (["km", "k m", "kilometer", "kilometre", "公里"].includes(s)) return "km";
  if (["mile", "miles", "mi", "英里"].includes(s)) return "mile";
  if (["kg", "kilogram", "kilograms", "公斤"].includes(s)) return "kg";
  if (["lb", "lbs", "pound", "pounds", "磅"].includes(s)) return "lb";
  return null;
}

function roundNumber(n) {
  if (Number.isInteger(n)) return n;
  return Math.round(n * 1000000) / 1000000;
}

async function convertUnit({ value, from_unit, to_unit }) {
  const from = normalizeUnit(from_unit);
  const to = normalizeUnit(to_unit);
  if (from === null || to === null) {
    return { error: `不支援的單位：${from_unit} 或 ${to_unit}` };
  }

  // same unit -> return original
  if (from === to) {
    return { input: { value, unit: from_unit }, output: { value, unit: to_unit } };
  }

  let result;

  // Celsius <-> Fahrenheit
  if (from === "celsius" && to === "fahrenheit") {
    result = value * 9 / 5 + 32;
  } else if (from === "fahrenheit" && to === "celsius") {
    result = (value - 32) * 5 / 9;
  }

  // Kilometer <-> Mile
  else if (from === "km" && to === "mile") {
    result = value * 0.621371;
  } else if (from === "mile" && to === "km") {
    result = value / 0.621371;
  }

  // Kilogram <-> Pound
  else if (from === "kg" && to === "lb") {
    result = value * 2.20462;
  } else if (from === "lb" && to === "kg") {
    result = value / 2.20462;
  }

  else {
    return { error: `不支援的單位組合：${from_unit} -> ${to_unit}` };
  }

  return {
    input: { value, unit: from_unit },
    output: { value: roundNumber(result), unit: to_unit },
  };
}

export const convertUnitTool = defineTool({
  name: "convert_unit",
  description: "進行單位換算（攝氏↔華氏、公里↔英里、公斤↔磅）。輸入 value、from_unit、to_unit。",
  fn: convertUnit,
  parameters: z.object({
    value: z.number().describe("要換算的數字，例如 25"),
    from_unit: z.string().describe("原始單位，例如 'C'、'km'、'kg'"),
    to_unit: z.string().describe("目標單位，例如 'F'、'mile'、'lb'"),
  }),
});
