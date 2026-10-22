import { WebSocket } from "ws";
(globalThis as any).WebSocket = WebSocket;

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

async function main() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data, error } = await sb.from("stores").select("*").limit(50);
  if (error) {
    console.error(error);
    process.exit(1);
  }
  for (const s of data) {
    console.log(
      JSON.stringify({
        id: s.id,
        name: s.name,
        slug: s.slug,
        type: s.type,
        topic: s.topic,
        base_url: s.base_url,
        search_url_template: s.search_url_template,
        scrape_enabled: s.scrape_enabled,
        product_container_selector: s.product_container_selector,
        product_link_selector: s.product_link_selector,
        pagination_selector: s.pagination_selector,
        title_selector: s.title_selector,
        price_selector: s.price_selector,
        image_selector: s.image_selector,
        availability_selector: s.availability_selector,
      })
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});