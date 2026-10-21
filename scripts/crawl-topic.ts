import { config } from "dotenv";
import { crawlTopic } from "../lib/scrapers/crawler";

config({ path: ".env.local", override: false });

const topic = process.argv[2];
if (!topic) {
  throw new Error("Usage: tsx scripts/crawl-topic.ts <topic>");
}

async function main() {
  const result = await crawlTopic(topic);
  console.log(
    `${result.topic}: crawled ${result.storesCrawled}/${result.storesFound} stores; ` +
      `scraped ${result.productsScraped}, saved ${result.productsSaved} products.`,
  );
  for (const store of result.stores) {
    console.log(
      `${store.store}: sitemap URLs=${store.sitemapUrls}, scraped=${store.scraped}, saved=${store.saved}, errors=${store.errors.length}`,
    );
    for (const error of store.errors) {
      console.error(`  ${error}`);
    }
  }

  if (result.storesFound === 0) {
    throw new Error(`No enabled crawlable stores found for topic "${result.topic}".`);
  }
  if (result.stores.some((store) => store.errors.length > 0)) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Topic crawl failed.");
  process.exitCode = 1;
});
