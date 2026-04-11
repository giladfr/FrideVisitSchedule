import { NextResponse } from "next/server";

import { getInfrastructureStatus } from "@/lib/infrastructure-status";

export async function GET() {
  const status = await getInfrastructureStatus();

  return NextResponse.json({
    app: "Fride Visit Schedule",
    timestamp: new Date().toISOString(),
    ...status,
  });
}
