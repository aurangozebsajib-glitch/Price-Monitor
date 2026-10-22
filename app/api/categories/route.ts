import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category") || searchParams.get("topic") || "gadgets";
  const limit = Number(searchParams.get("limit") || "40");
  const offset = Number(searchParams.get("offset") || "0");

  const supabase = createClient();
  const { data, error, count } = await supabase
    .from("products")
    .select("*", { count: "exact" })
    .ilike("title", `%${category}%`)
    .range(offset, offset + limit - 1)
    .order("current_price", { ascending: true });

  if (error) {
    // Fallback to all products if category filter yields nothing or column mismatch
    const { data: allData, error: allError, count: allCount } = await supabase
      .from("products")
      .select("*", { count: "exact" })
      .range(offset, offset + limit - 1)
      .order("current_price", { ascending: true });

    if (allError) {
      return NextResponse.json({ success: false, error: allError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      category,
      products: allData || [],
      count: allCount || 0,
    });
  }

  return NextResponse.json({
    success: true,
    category,
    products: data || [],
    count: count || 0,
  });
}
