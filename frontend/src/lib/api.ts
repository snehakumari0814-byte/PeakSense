import type { Locality } from "@/types/locality";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function fetchLocalities(): Promise<Locality[]> {
  const res = await fetch(`${API_BASE_URL}/api/localities`);
  if (!res.ok) {
    throw new ApiError("Failed to fetch localities", res.status);
  }
  return res.json();
}

export async function fetchLocality(id: string): Promise<Locality> {
  const res = await fetch(`${API_BASE_URL}/api/localities/${encodeURIComponent(id)}`);
  if (!res.ok) {
    throw new ApiError(`Failed to fetch locality '${id}'`, res.status);
  }
  return res.json();
}
