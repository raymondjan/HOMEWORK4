import { z } from "zod";
import { defineTool } from "../utils/func-tool.js";

const YOUBIKE_API =
  "https://tcgbusfs.blob.core.windows.net/dotapp/youbike/v2/youbike_immediate.json";

async function getYoubikeByArea({ area }) {
  const res = await fetch(YOUBIKE_API);
  const data = await res.json();

  const stations = data
    .filter((s) => s.act === "1" && s.sarea.includes(area))
    .map((s) => ({
      name: s.sna.replace(/^YouBike2\.0_/, ""),
      area: s.sarea,
      address: s.ar,
      available_rent: s.available_rent_bikes,
      available_return: s.available_return_bikes,
      total: s.Quantity,
    }));

  if (stations.length === 0) {
    return {
      area,
      found: false,
      message: `在「${area}」找不到 YouBike 站點，請確認行政區名稱是否正確（如大安區、信義區、中正區等）。`,
    };
  }

  // 統計可租借車輛
  const totalAvailableRent = stations.reduce((sum, s) => sum + s.available_rent, 0);
  const totalAvailableReturn = stations.reduce((sum, s) => sum + s.available_return, 0);

  return {
    area,
    found: true,
    station_count: stations.length,
    total_available_rent: totalAvailableRent,
    total_available_return: totalAvailableReturn,
    stations: stations.slice(0, 5), // 回傳前 5 個站點
  };
}

export const youbikeAreaTool = defineTool({
  name: "get_youbike_by_area",
  description: "根據台北市行政區名稱查詢該區是否有 YouBike 站點及可租借車輛數",
  fn: getYoubikeByArea,
  parameters: z.object({
    area: z.string().describe("台北市行政區名稱，如 '大安區'、'信義區'、'中正區' 等"),
  }),
});
