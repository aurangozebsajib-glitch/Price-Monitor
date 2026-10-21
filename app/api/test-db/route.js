import { createClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const database = "pricepulse";

  try {
    const supabase = createClient();
    const { data, error, count } = await supabase
      .from("stores")
      .select("*", { count: "exact" });

    if (error) {
      throw error;
    }

    return Response.json({
      success: true,
      db: "supabase",
      database,
      storesCount: count,
      stores: data,
    });
  } catch (error) {
    console.error("Supabase test route failed:", error?.message || "Unknown error");
    if (error && typeof error === "object" && error.code === "PGRST205") {
      return Response.json(
        {
          success: false,
          db: "supabase",
          database,
          storesCount: null,
          error: "Run supabase-schema.sql in SQL Editor",
          code: "TABLE_MISSING",
        },
        { status: 503 },
      );
    }

    const message =
      error && typeof error === "object" && "message" in error &&
      typeof error.message === "string"
        ? error.message
        : "Could not query Supabase.";
    return Response.json(
      {
        success: false,
        db: "supabase",
        database,
        storesCount: null,
        error: message,
      },
      { status: 500 },
    );
  }
}
