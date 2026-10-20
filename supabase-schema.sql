create extension if not exists pgcrypto;

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  country_code text not null default 'BD',
  store_type text not null default 'marketplace',
  website_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete restrict,
  url text not null,
  title text not null,
  image_url text,
  current_price numeric(12, 2),
  original_price numeric(12, 2),
  price_history jsonb not null default '[]'::jsonb,
  is_out_of_stock boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, url),
  check (current_price is null or current_price >= 0),
  check (original_price is null or original_price >= 0),
  check (jsonb_typeof(price_history) = 'array')
);

create unique index if not exists products_id_user_id_uidx
  on public.products (id, user_id);

create table if not exists public.product_prices (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null unique,
  user_id uuid not null default auth.uid(),
  current_price numeric(12, 2),
  original_price numeric(12, 2),
  currency text not null default 'BDT',
  is_out_of_stock boolean not null default false,
  checked_at timestamptz not null default now(),
  foreign key (product_id, user_id)
    references public.products (id, user_id)
    on delete cascade,
  check (current_price is null or current_price >= 0),
  check (original_price is null or original_price >= 0)
);

create table if not exists public.price_history (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null,
  user_id uuid not null default auth.uid(),
  price numeric(12, 2) not null,
  original_price numeric(12, 2),
  currency text not null default 'BDT',
  recorded_at timestamptz not null default now(),
  foreign key (product_id, user_id)
    references public.products (id, user_id)
    on delete cascade,
  check (price >= 0),
  check (original_price is null or original_price >= 0)
);

alter table public.stores enable row level security;
alter table public.products enable row level security;
alter table public.product_prices enable row level security;
alter table public.price_history enable row level security;

drop policy if exists "Stores are readable by everyone" on public.stores;
create policy "Stores are readable by everyone"
  on public.stores for select
  to anon, authenticated
  using (true);

drop policy if exists "Authenticated users can add supported stores" on public.stores;
create policy "Authenticated users can add supported stores"
  on public.stores for insert
  to authenticated
  with check (
    slug in (
      'star-tech',
      'daraz',
      'ryans',
      'pickaboo',
      'ucc',
      'gadget-and-gear',
      'amazon',
      'bestbuy'
    )
  );

drop policy if exists "Users can read their own products" on public.products;
create policy "Users can read their own products"
  on public.products for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can add their own products" on public.products;
create policy "Users can add their own products"
  on public.products for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own products" on public.products;
create policy "Users can update their own products"
  on public.products for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own products" on public.products;
create policy "Users can delete their own products"
  on public.products for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can read their own product prices" on public.product_prices;
create policy "Users can read their own product prices"
  on public.product_prices for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can add their own product prices" on public.product_prices;
create policy "Users can add their own product prices"
  on public.product_prices for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own product prices" on public.product_prices;
create policy "Users can update their own product prices"
  on public.product_prices for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can read their own price history" on public.price_history;
create policy "Users can read their own price history"
  on public.price_history for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can add their own price history" on public.price_history;
create policy "Users can add their own price history"
  on public.price_history for insert
  to authenticated
  with check (auth.uid() = user_id);

insert into public.stores (name, slug, country_code, store_type, website_url)
values
  ('Star Tech', 'star-tech', 'BD', 'retailer', 'https://www.startech.com.bd'),
  ('Daraz', 'daraz', 'BD', 'marketplace', 'https://www.daraz.com.bd'),
  ('Ryans', 'ryans', 'BD', 'retailer', 'https://www.ryans.com'),
  ('Pickaboo', 'pickaboo', 'BD', 'retailer', 'https://www.pickaboo.com'),
  ('UCC', 'ucc', 'BD', 'retailer', 'https://www.ucc.com.bd'),
  ('Gadget & Gear', 'gadget-and-gear', 'BD', 'retailer', 'https://gadgetandgear.com'),
  ('Amazon', 'amazon', 'US', 'marketplace', 'https://www.amazon.com'),
  ('BestBuy', 'bestbuy', 'US', 'retailer', 'https://www.bestbuy.com')
on conflict (slug) do update
set name = excluded.name,
    country_code = excluded.country_code,
    store_type = excluded.store_type,
    website_url = excluded.website_url;
