import fs from "fs/promises";
import path from "path";
import constants from "../constants.js";

export async function readFromCache(filePath) {
  try {
    const data = await fs.readFile(filePath, "utf-8");
    return JSON.parse(data || "{}");
  } catch (error) {
    // If file doesn't exist, return empty cache
    if (error.code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

export async function saveToCache(filePath, cache) {
  try {
    // Ensure directory exists
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });

    await fs.writeFile(filePath, JSON.stringify(cache, null, 2), "utf-8");
  } catch (error) {
    console.error(`[error] failed to save cache to ${filePath}:`, error.message);
  }
}

export function isCacheValid(entry) {
  if (!entry?.cachedAt) return false;

  const now = Date.now();
  return Boolean(now - entry.cachedAt < constants.CACHE_TTL);
}

export function deleteExpiredCache(cache) {
  if (!cache || typeof cache !== "object") return;

  const now = Date.now();

  for (const key in cache) {
    if (!cache[key]?.cachedAt || now - cache[key].cachedAt > constants.CACHE_TTL) {
      delete cache[key];
    }
  }
}
