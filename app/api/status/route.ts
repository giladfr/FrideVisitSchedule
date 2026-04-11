import { NextResponse } from "next/server";

import { getInfrastructureStatus } from "@/lib/infrastructure-status";

export function GET() {
  const status = getInfrastructureStatus();

  return NextResponse.json({
    app: "Fride Visit Schedule",
    timestamp: new Date().toISOString(),
    ...status,
  });
}
