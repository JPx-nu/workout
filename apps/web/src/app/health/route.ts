import { NextResponse } from "next/server";

export function GET() {
	// Azure App Service Health Check uses this route in deployed environments.
	return NextResponse.json(
		{
			status: "ok",
			service: "web",
			timestamp: new Date().toISOString(),
		},
		{
			headers: {
				"Cache-Control": "no-store",
			},
		},
	);
}
