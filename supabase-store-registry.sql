-- Additive registry migration for configurable static/WooCommerce/Shopify stores.
-- Apply to Supabase before enabling registry-backed live search.
alter table public.stores
  add column if not exists type text not null default 'ecommerce',
  add column if not exists topic text not null default 'general',
  add column if not exists base_url text,
  add column if not exists website_url text,
  add column if not exists search_url_template text,
  add column if not exists product_container_selector text,
  add column if not exists product_link_selector text,
  add column if not exists pagination_selector text,
  add column if not exists title_selector text,
  add column if not exists price_selector text,
  add column if not exists image_selector text,
  add column if not exists availability_selector text,
  add column if not exists scrape_enabled text not null default 'false',
  add column if not exists crawl_priority integer not null default 100,
  add column if not exists fb_page_url text,
  add column if not exists scraper_type text,
  add column if not exists link_selector text,
  add column if not exists product_selector text,
  add column if not exists search_url_pattern text,
  add column if not exists search_path text,
  add column if not exists name_selector text,
  add column if not exists last_crawled_at timestamptz,
  add column if not exists last_crawl_status text,
  add column if not exists product_count integer;

create index if not exists stores_scraper_registry_idx
  on public.stores (crawl_priority, slug)
  where scrape_enabled = 'true';

insert into public.stores (
  name,
  slug,
  country_code,
  type,
  topic,
  base_url,
  website_url,
  search_url_template,
  product_container_selector,
  product_link_selector,
  pagination_selector,
  title_selector,
  price_selector,
  image_selector,
  availability_selector,
  scrape_enabled,
  crawl_priority
)
values
  ('Apple Gadgets', 'apple-gadgets', 'BD', 'ecommerce', 'gadgets', 'https://www.applegadgetsbd.com', 'https://www.applegadgetsbd.com', '/search?q={query}', 'a[href*="/products/"]', 'a[href*="/products/"]', null, 'h1', null, 'img', null, 'true', 10),
  ('Sumash Tech', 'sumash-tech', 'BD', 'ecommerce', 'gadgets', 'https://www.sumashtech.com', 'https://www.sumashtech.com', '/search?q={query}', 'a[href*="/products/"]', 'a[href*="/products/"]', null, 'h1', null, 'img', null, 'true', 20),
  ('Gadget Monkey', 'gadget-monkey', 'BD', 'ecommerce', 'gadgets', 'https://gadgetmonkeybd.com', 'https://gadgetmonkeybd.com', '/search?q={query}', 'a[href*="/products/"]', 'a[href*="/products/"]', null, 'h1', null, 'img', null, 'true', 30),
  ('Techland BD', 'techland-bd', 'BD', 'ecommerce', 'gadgets', 'https://www.techlandbd.com', 'https://www.techlandbd.com', '/?s={query}', '.product', 'a[href]', '.next', 'h1', '.price', 'img', '.stock', 'true', 40),
  ('Creatus', 'creatus', 'BD', 'ecommerce', 'gadgets', 'https://www.creatus.com.bd', 'https://www.creatus.com.bd', '/index.php?route=product/search&search={query}', '.product-thumb', 'a[href]', '.pagination .active + li a', 'h1', '.price', 'img', '.stock', 'true', 50),
  ('Computer Village', 'computer-village', 'BD', 'ecommerce', 'gadgets', 'https://www.computervillage.com.bd', 'https://www.computervillage.com.bd', '/index.php?route=product/search&search={query}', '.product-thumb', 'a[href]', '.pagination .active + li a', 'h1', '.price', 'img', '.stock', 'true', 60),
  ('Binary Logic', 'binary-logic', 'BD', 'ecommerce', 'gadgets', 'https://www.binarylogic.com.bd', 'https://www.binarylogic.com.bd', '/?s={query}', '.product', 'a[href]', '.next', 'h1', '.price', 'img', '.stock', 'true', 70),
  ('TechshopBD', 'techshopbd', 'BD', 'ecommerce', 'gadgets', 'https://www.techshopbd.com', 'https://www.techshopbd.com', '/search?q={query}', 'a[href*="/products/"]', 'a[href*="/products/"]', null, 'h1', null, 'img', null, 'true', 80),
  ('Gadget & Gear', 'gadget-and-gear', 'BD', 'ecommerce', 'gadgets', 'https://gadgetandgear.com', 'https://gadgetandgear.com', '/search?q={query}', 'a[href*="/products/"]', 'a[href*="/products/"]', null, 'h1', null, 'img', null, 'true', 90),
  ('Star Tech', 'star-tech', 'BD', 'ecommerce', 'gadgets', 'https://www.startech.com.bd', 'https://www.startech.com.bd', '/search?search={query}', '.p-item', 'a[href]', '.pagination .active + li a', 'h1', '.price', 'img', '.stock', 'true', 100)
on conflict (slug) do update
set name = excluded.name,
    country_code = excluded.country_code,
    type = excluded.type,
    topic = excluded.topic,
    base_url = excluded.base_url,
    website_url = excluded.website_url,
    search_url_template = excluded.search_url_template,
    product_container_selector = excluded.product_container_selector,
    product_link_selector = excluded.product_link_selector,
    pagination_selector = excluded.pagination_selector,
    title_selector = excluded.title_selector,
    price_selector = excluded.price_selector,
    image_selector = excluded.image_selector,
    availability_selector = excluded.availability_selector,
    scrape_enabled = excluded.scrape_enabled,
    crawl_priority = excluded.crawl_priority;
