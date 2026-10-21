import { NextResponse } from "next/server";
import {
  createAdminSupabaseClient,
  isFCommerceAdminRequest,
} from "@/lib/supabase/admin";
import { migrateStoreSchema } from "@/lib/supabase/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!process.env.F_COMMERCE_ADMIN_TOKEN) {
    return NextResponse.json(
      { success: false, error: "F-commerce admin is not configured." },
      { status: 503 },
    );
  }
  if (!isFCommerceAdminRequest(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await migrateStoreSchema(createAdminSupabaseClient());
    return NextResponse.json(result, {
      status: result.success ? 200 : 503,
    });
  } catch (error) {
    console.error("Store schema migration failed:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not migrate the stores schema.",
      },
      { status: 500 },
    );
  }
}
