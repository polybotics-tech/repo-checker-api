import fs from "fs/promises";
import constants from "../constants.js";

export async function readFromCache(filePath) {
  const data = await fs.readFile(filePath, "utf-8");
  return JSON.parse(data || "{}");
}

export async function saveToCache(filePath, cache) {
  await fs.writeFile(filePath, JSON.stringify(cache, null, 2), "utf-8");
}

export async function isCacheValid(entry) {
  if (!entry?.cachedAt) return false;

  const now = Date.now();
  return Boolean(now - entry.cachedAt < constants.CACHE_TTL);
}

export async function deleteExpiredCache(filePath) {
  if (!filePath) return;

  const cache = await readFromCache(filePath);
  const now = Date.now();

  for (const key in cache) {
    if (now - cache[key].cachedAt > constants.CACHE_TTL) {
      delete cache[key];
    }
  }

  return cache;
}
