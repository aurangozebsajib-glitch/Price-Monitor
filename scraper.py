import json
import re
from typing import Any

import requests
from bs4 import BeautifulSoup


class ScrapeError(RuntimeError):
    """Raised when a product page cannot be fetched or parsed."""


USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/131.0.0.0 Safari/537.36"
)


def _product_jsonld(soup: BeautifulSoup) -> list[dict[str, Any]]:
    """Return Product objects found in JSON-LD scripts, including @graph entries."""
    products: list[dict[str, Any]] = []

    def visit(value: Any) -> None:
        if isinstance(value, list):
            for item in value:
                visit(item)
        elif isinstance(value, dict):
            product_type = value.get("@type")
            types = product_type if isinstance(product_type, list) else [product_type]
            if "Product" in types:
                products.append(value)
            for key in ("@graph", "mainEntity"):
                if key in value:
                    visit(value[key])

    for script in soup.select('script[type="application/ld+json"]'):
        try:
            visit(json.loads(script.string or script.get_text()))
        except json.JSONDecodeError:
            continue

    return products


def _jsonld_price(product: dict[str, Any]) -> str | None:
    offers = product.get("offers", [])
    if isinstance(offers, dict):
        offers = [offers]
    if not isinstance(offers, list):
        return None

    for offer in offers:
        if not isinstance(offer, dict):
            continue
        price = offer.get("price") or offer.get("lowPrice")
        if price is None:
            price_specification = offer.get("priceSpecification")
            if isinstance(price_specification, dict):
                price = price_specification.get("price")
        if price is not None:
            currency = offer.get("priceCurrency")
            currency_prefix = {"BDT": "৳", "USD": "$", "EUR": "€"}.get(currency)
            return f"{currency_prefix}{price}" if currency_prefix else str(price)

    return None


def _element_value(element: Any) -> str | None:
    value = element.get("content") or element.get("data-price")
    if value is None:
        value = element.get_text(" ", strip=True)
    value = re.sub(r"\s+", " ", value).strip()
    return value or None


def scrape_startech(url: str) -> dict[str, str]:
    """Fetch a Star Tech product page and return its title and displayed price.

    Network failures, unsuccessful HTTP responses, or pages without a product
    title/price raise ``ScrapeError`` rather than returning incomplete data.
    """
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    }

    try:
        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()
    except requests.RequestException as exc:
        raise ScrapeError(f"Could not fetch product page {url!r}: {exc}") from exc

    soup = BeautifulSoup(response.text, "html.parser")
    products = _product_jsonld(soup)

    title_element = soup.select_one("h1.product-name, h1")
    title = _element_value(title_element) if title_element else None
    if not title:
        title_meta = soup.select_one('meta[property="og:title"], meta[name="twitter:title"]')
        title = _element_value(title_meta) if title_meta else None
    if not title:
        title = next(
            (str(product["name"]).strip() for product in products if product.get("name")),
            None,
        )

    price = None
    for selector in (
        "td.product-price",
        ".price-new",
        ".product-price",
        '[itemprop="price"]',
        'meta[property="product:price:amount"]',
        ".price",
    ):
        price_element = soup.select_one(selector)
        if price_element:
            price = _element_value(price_element)
            if price:
                break
    if not price:
        for product in products:
            price = _jsonld_price(product)
            if price:
                break

    if not title or not price:
        missing = "title" if not title and not price else "price" if not price else "title"
        raise ScrapeError(f"Could not find product {missing} on {url!r}")

    return {"store": "Star Tech", "title": title, "price": price, "url": url}


if __name__ == "__main__":
    test_url = "https://www.startech.com.bd/anker-soundcore-r50i-nc"
    try:
        result = scrape_startech(test_url)
    except ScrapeError as exc:
        print(f"Scraping failed: {exc}")
    else:
        print("\n--- Scraping Result ---")
        for key, value in result.items():
            print(f"{key.title()}: {value}")
