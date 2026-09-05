#!/usr/bin/env python3
import argparse
import csv
import json
import re
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal, InvalidOperation
from pathlib import Path

BEER_TAG = "en:beers"
UNIT_FACTORS = {
    "ml": Decimal("1"),
    "milliliter": Decimal("1"),
    "milliliters": Decimal("1"),
    "millilitre": Decimal("1"),
    "millilitres": Decimal("1"),
    "cl": Decimal("10"),
    "dl": Decimal("100"),
    "l": Decimal("1000"),
    "liter": Decimal("1000"),
    "liters": Decimal("1000"),
    "litre": Decimal("1000"),
    "litres": Decimal("1000"),
}
MULTIPACK_A = re.compile(r"(?i)(\d+(?:[.,]\d+)?)\s*[x×*]\s*(\d+(?:[.,]\d+)?)\s*(ml|cl|dl|l)\b")
MULTIPACK_B = re.compile(r"(?i)(\d+(?:[.,]\d+)?)\s*(ml|cl|dl|l)\s*[x×*]\s*(\d+(?:[.,]\d+)?)\b")
SINGLE_VOL = re.compile(r"(?i)(\d+(?:[.,]\d+)?)\s*(ml|cl|dl|l)\b")


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("csv_path")
    p.add_argument("output_dir")
    p.add_argument("--edition-date", required=True, help="YYYY-MM-DD")
    return p.parse_args()


def parse_tags(value):
    if not value:
        return []
    try:
        parsed = json.loads(value)
        return parsed if isinstance(parsed, list) else []
    except Exception:
        return []


def parse_date(value):
    try:
        return date.fromisoformat(value)
    except Exception:
        return None


def dec(value):
    try:
        return Decimal(str(value).replace(",", "."))
    except (InvalidOperation, ValueError):
        return None


def to_ml(amount, unit):
    q = dec(amount)
    if q is None:
        return None
    f = UNIT_FACTORS.get((unit or "").strip().lower())
    if f is None:
        return None
    ml = q * f
    return float(ml) if ml > 0 else None


def normalized_volume_ml(quantity, unit):
    if quantity in (None, "") or not unit:
        return None
    return to_ml(quantity, unit)


def quantity_text_volume_ml(text):
    if not text:
        return None
    s = str(text).strip()
    m = MULTIPACK_A.search(s)
    if m:
        count = dec(m.group(1))
        per = to_ml(m.group(2), m.group(3))
        if count is not None and per is not None and count > 0:
            return float(count) * per
    m = MULTIPACK_B.search(s)
    if m:
        per = to_ml(m.group(1), m.group(2))
        count = dec(m.group(3))
        if count is not None and per is not None and count > 0:
            return per * float(count)
    m = SINGLE_VOL.search(s)
    if m:
        return to_ml(m.group(1), m.group(2))
    return None


def best_volume_ml(row):
    ml = normalized_volume_ml(row.get("product_quantity"), row.get("product_quantity_unit"))
    if ml is not None:
        return ml, "normalized"
    ml = quantity_text_volume_ml(row.get("quantity"))
    if ml is not None:
        return ml, "quantity_text"
    return None, None


def pct(n, d):
    return round(n * 100 / d, 1) if d else 0.0


def main():
    args = parse_args()
    csv_path = Path(args.csv_path)
    out = Path(args.output_dir)
    out.mkdir(parents=True, exist_ok=True)

    edition_date = date.fromisoformat(args.edition_date)
    cutoff_365 = edition_date - timedelta(days=364)
    cutoff_180 = edition_date - timedelta(days=179)
    cutoff_30 = edition_date - timedelta(days=29)

    countries = defaultdict(lambda: {
        "country": "", "n_all": 0, "n_365d": 0, "n_180d": 0, "n_30d": 0,
        "volume_all": 0, "volume_365d": 0, "normalized_volume_all": 0,
        "text_volume_all": 0, "retailer_all": 0, "city_all": 0,
        "products_all": set(), "products_365d": set(), "cities_all": set(),
        "cities_365d": set(), "retailers_all": set(), "brands_all": set(),
        "currencies_all": set(), "latest": None,
    })

    source_rows = beer_rows = beer_365 = beer_180 = beer_30 = 0
    volume_all = volume_365 = normalized_volume_all = text_volume_all = 0
    retailer_all = city_all = no_country = 0
    distinct_products, distinct_cities, distinct_retailers, distinct_countries = set(), set(), set(), set()
    oldest = newest = None

    with csv_path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        required = {
            "source_price_id", "product_code", "categories_tags", "quantity",
            "product_quantity", "product_quantity_unit", "observed_date",
            "retailer_name", "city", "country", "country_code", "brands", "currency",
        }
        missing = required - set(reader.fieldnames or [])
        if missing:
            raise SystemExit(f"Missing fields: {sorted(missing)}")

        for row in reader:
            source_rows += 1
            if BEER_TAG not in parse_tags(row.get("categories_tags")):
                continue

            beer_rows += 1
            d = parse_date(row.get("observed_date", ""))
            if d:
                oldest = d if oldest is None or d < oldest else oldest
                newest = d if newest is None or d > newest else newest

            code = (row.get("product_code") or "").strip()
            cc = (row.get("country_code") or "").strip().upper()
            country = (row.get("country") or "").strip()
            city = (row.get("city") or "").strip()
            retailer = (row.get("retailer_name") or "").strip()
            brand = (row.get("brands") or "").strip()
            currency = (row.get("currency") or "").strip().upper()
            ml, ml_source = best_volume_ml(row)

            if code:
                distinct_products.add(code)
            if ml is not None:
                volume_all += 1
                if ml_source == "normalized":
                    normalized_volume_all += 1
                elif ml_source == "quantity_text":
                    text_volume_all += 1
            if retailer:
                retailer_all += 1
            if city:
                city_all += 1
            if cc and city:
                distinct_cities.add((cc, city))
            if cc and retailer:
                distinct_retailers.add((cc, city, retailer))

            if d and cutoff_365 <= d <= edition_date:
                beer_365 += 1
                if ml is not None:
                    volume_365 += 1
            if d and cutoff_180 <= d <= edition_date:
                beer_180 += 1
            if d and cutoff_30 <= d <= edition_date:
                beer_30 += 1

            if not cc:
                no_country += 1
                continue

            distinct_countries.add(cc)
            c = countries[cc]
            c["country"] = country or c["country"]
            c["n_all"] += 1
            if code:
                c["products_all"].add(code)
            if city:
                c["city_all"] += 1
                c["cities_all"].add(city)
            if retailer:
                c["retailer_all"] += 1
                c["retailers_all"].add(retailer)
            if brand:
                c["brands_all"].add(brand)
            if currency:
                c["currencies_all"].add(currency)
            if ml is not None:
                c["volume_all"] += 1
                if ml_source == "normalized":
                    c["normalized_volume_all"] += 1
                elif ml_source == "quantity_text":
                    c["text_volume_all"] += 1
            if d and (c["latest"] is None or d > c["latest"]):
                c["latest"] = d

            if d and cutoff_365 <= d <= edition_date:
                c["n_365d"] += 1
                if code:
                    c["products_365d"].add(code)
                if city:
                    c["cities_365d"].add(city)
                if ml is not None:
                    c["volume_365d"] += 1
            if d and cutoff_180 <= d <= edition_date:
                c["n_180d"] += 1
            if d and cutoff_30 <= d <= edition_date:
                c["n_30d"] += 1

    rows = []
    for cc, c in countries.items():
        r = {
            "country_code": cc, "country": c["country"], "n_all": c["n_all"],
            "n_365d": c["n_365d"], "n_180d": c["n_180d"], "n_30d": c["n_30d"],
            "distinct_products_all": len(c["products_all"]),
            "distinct_products_365d": len(c["products_365d"]),
            "distinct_cities_all": len(c["cities_all"]),
            "distinct_cities_365d": len(c["cities_365d"]),
            "distinct_retailers_all": len(c["retailers_all"]),
            "distinct_brands_all": len(c["brands_all"]),
            "currencies": ";".join(sorted(c["currencies_all"])),
            "volume_known_all": c["volume_all"], "volume_known_365d": c["volume_365d"],
            "volume_from_normalized_all": c["normalized_volume_all"],
            "volume_from_quantity_text_all": c["text_volume_all"],
            "volume_coverage_all_pct": pct(c["volume_all"], c["n_all"]),
            "volume_coverage_365d_pct": pct(c["volume_365d"], c["n_365d"]),
            "retailer_coverage_all_pct": pct(c["retailer_all"], c["n_all"]),
            "city_coverage_all_pct": pct(c["city_all"], c["n_all"]),
            "latest_observation": c["latest"].isoformat() if c["latest"] else "",
        }
        r["eligible_n5"] = r["n_365d"] >= 5 and r["distinct_products_365d"] >= 2 and r["volume_known_365d"] >= 5
        r["eligible_n10"] = r["n_365d"] >= 10 and r["distinct_products_365d"] >= 3 and r["volume_known_365d"] >= 10
        r["eligible_n20"] = r["n_365d"] >= 20 and r["distinct_products_365d"] >= 3 and r["volume_known_365d"] >= 20
        rows.append(r)

    rows.sort(key=lambda x: (-x["n_365d"], -x["n_all"], x["country_code"]))

    summary = {
        "edition_date": edition_date.isoformat(),
        "cutoffs": {"30d": cutoff_30.isoformat(), "180d": cutoff_180.isoformat(), "365d": cutoff_365.isoformat()},
        "source_rows": source_rows,
        "beer_observations_all": beer_rows, "beer_observations_365d": beer_365,
        "beer_observations_180d": beer_180, "beer_observations_30d": beer_30,
        "oldest_beer_observation": oldest.isoformat() if oldest else None,
        "newest_beer_observation": newest.isoformat() if newest else None,
        "distinct_beer_products_all": len(distinct_products),
        "countries_with_any_beer_observation": len(distinct_countries),
        "countries_with_365d_beer_observation": sum(1 for r in rows if r["n_365d"] > 0),
        "distinct_cities_all": len(distinct_cities), "distinct_retailers_all": len(distinct_retailers),
        "observations_missing_country": no_country,
        "volume_known_all": volume_all, "volume_coverage_all_pct": pct(volume_all, beer_rows),
        "volume_from_normalized_all": normalized_volume_all,
        "volume_from_quantity_text_all": text_volume_all,
        "volume_known_365d": volume_365, "volume_coverage_365d_pct": pct(volume_365, beer_365),
        "retailer_coverage_all_pct": pct(retailer_all, beer_rows), "city_coverage_all_pct": pct(city_all, beer_rows),
        "country_map_eligible_n5": sum(1 for r in rows if r["eligible_n5"]),
        "country_map_eligible_n10": sum(1 for r in rows if r["eligible_n10"]),
        "country_map_eligible_n20": sum(1 for r in rows if r["eligible_n20"]),
        "top_countries_by_365d_observations": rows[:30],
    }

    (out / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    if rows:
        with (out / "countries.csv").open("w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
            writer.writeheader()
            writer.writerows(rows)
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
