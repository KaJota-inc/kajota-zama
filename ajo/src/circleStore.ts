// User-created circles are genuinely deployed on-chain (anyone can read them), but the directory
// remembers "the circles you launched" locally so they persist across reloads without a registry
// contract. Merged with the canonical CIRCLES from config.
import { CIRCLES } from "./config";

export type Circle = {
  name: string;
  theme: string;
  address: string;
  mine?: boolean; // deployed from this browser
  createdBy?: string;
};

const KEY = "ajo.circles.v1";

export function getUserCircles(): Circle[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as Circle[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function addUserCircle(c: Circle): Circle[] {
  const existing = getUserCircles();
  if (existing.some((x) => x.address.toLowerCase() === c.address.toLowerCase())) return existing;
  const next = [...existing, { ...c, mine: true }];
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

// Canonical circles first, then any this browser has launched (deduped by address).
export function allCircles(): Circle[] {
  const seen = new Set(CIRCLES.map((c) => c.address.toLowerCase()));
  const mine = getUserCircles().filter((c) => !seen.has(c.address.toLowerCase()));
  return [...CIRCLES, ...mine];
}
