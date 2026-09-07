import json
import os
import sys
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "data" / "corona-production-countries.json"
AUDIT = ROOT / os.environ.get("CANONICAL_IN", "corona-canonical-audit.json")
STRICT = ROOT / os.environ.get("STRICT_IN", "corona-strict-probe-results.json")
OUT_DIR = ROOT / "data" / "corona"
CURRENT = OUT_DIR / "current.json"
HEALTH = OUT_DIR / "source-health.json"


def load(path, default=None):
    if not path.exists():
        return default
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def dump(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    with tmp.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2, sort_keys=False)
        f.write("\n")
    tmp.replace(path)


def parse_time(value):
    if not value:
        return None
    value = value.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


manifest = load(MANIFEST)
audit = load(AUDIT)
strict = load(STRICT, {"results": []})
if not manifest or not audit:
    print("missing manifest or canonical audit", file=sys.stderr)
    sys.exit(2)

core = manifest["core"]
spare = manifest["spare"]
allowed = core + spare
minimum = int(manifest.get("minimumFreshCountries", 50))
if len(core) != 50 or len(set(allowed)) != len(allowed):
    print("invalid production country manifest", file=sys.stderr)
    sys.exit(2)

fresh_by_code = {r["code"]: r for r in audit.get("records", []) if r.get("code") in allowed}
fresh_codes = [c for c in allowed if c in fresh_by_code]
core_fresh = [c for c in core if c in fresh_by_code]
spare_fresh = [c for c in spare if c in fresh_by_code]

# Fail closed: candidate data never replaces the last-known-good production dataset
# unless at least 50 distinct production countries are fresh in this run.
if len(fresh_codes) < minimum:
    print(f"PRODUCTION GATE FAIL fresh={len(fresh_codes)} minimum={minimum}")
    sys.exit(2)

generated_at = audit.get("generatedAt") or datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
day = generated_at[:10]
previous = load(CURRENT, {"records": []})
previous_by_code = {r["code"]: r for r in previous.get("records", [])}

fresh_records = []
for code in allowed:
    raw = fresh_by_code.get(code)
    if not raw:
        continue
    rec = {
        "code": code,
        "country": raw.get("country"),
        "role": "core" if code in core else "spare",
        "product": manifest.get("product", "Corona Extra"),
        "currency": raw.get("currency"),
        "shelfPrice": raw.get("shelfPrice"),
        "packageVolumeMl": raw.get("packageVolumeMl"),
        "pricePerLiter": raw.get("pricePerLiter"),
        "pricePer330Ml": round(float(raw["pricePerLiter"]) * 0.33, 4),
        "sourceUrl": raw.get("url"),
        "sourceMode": raw.get("sourceMode"),
        "httpStatus": raw.get("httpStatus"),
        "observedPriceText": raw.get("observedPriceText"),
        "observedVolumeText": raw.get("observedVolumeText"),
        "stale": False,
        "lastFreshAt": generated_at,
    }
    fresh_records.append(rec)

# Preserve a missing country's previous value for display continuity, but mark it
# stale. Stale records never count toward the >=50 fresh production gate and are
# never written into the daily price-history snapshot as a new observation.
current_records = list(fresh_records)
for code in allowed:
    if code in fresh_by_code:
        continue
    old = previous_by_code.get(code)
    if not old:
        continue
    rec = deepcopy(old)
    rec["stale"] = True
    rec["staleSince"] = generated_at
    current_records.append(rec)

current_records.sort(key=lambda r: (0 if r["role"] == "core" else 1, r["code"]))
fresh_records.sort(key=lambda r: (0 if r["role"] == "core" else 1, r["code"]))

current_payload = {
    "schemaVersion": 1,
    "product": manifest.get("product", "Corona Extra"),
    "generatedAt": generated_at,
    "minimumFreshCountries": minimum,
    "freshCountryCount": len(fresh_codes),
    "coreFreshCount": len(core_fresh),
    "spareFreshCount": len(spare_fresh),
    "displayCountryCount": len(current_records),
    "productionGate": "pass",
    "records": current_records,
}

history_payload = {
    "schemaVersion": 1,
    "product": manifest.get("product", "Corona Extra"),
    "date": day,
    "generatedAt": generated_at,
    "freshCountryCount": len(fresh_records),
    "records": fresh_records,
}

strict_results = strict.get("results", [])
failures = {}
for row in strict_results:
    code = row.get("code")
    if code not in allowed or row.get("ok"):
        continue
    failures.setdefault(code, []).append(row.get("reason") or "probe-failed")

health_records = []
for code in allowed:
    if code in fresh_by_code:
        raw = fresh_by_code[code]
        health_records.append({
            "code": code,
            "role": "core" if code in core else "spare",
            "fresh": True,
            "sourceUrl": raw.get("url"),
            "sourceMode": raw.get("sourceMode"),
            "httpStatus": raw.get("httpStatus"),
            "lastSuccessAt": generated_at,
            "failureReasons": [],
        })
    else:
        old = previous_by_code.get(code, {})
        health_records.append({
            "code": code,
            "role": "core" if code in core else "spare",
            "fresh": False,
            "sourceUrl": old.get("sourceUrl"),
            "lastSuccessAt": old.get("lastFreshAt"),
            "failureReasons": failures.get(code, ["not-canonicalized"]),
        })

health_payload = {
    "schemaVersion": 1,
    "generatedAt": generated_at,
    "freshCountryCount": len(fresh_codes),
    "minimumFreshCountries": minimum,
    "productionGate": "pass",
    "records": health_records,
}

dump(CURRENT, current_payload)
dump(OUT_DIR / "history" / f"{day}.json", history_payload)
dump(HEALTH, health_payload)

print(
    f"PRODUCTION PUBLISH PASS fresh={len(fresh_codes)} core={len(core_fresh)} "
    f"spare={len(spare_fresh)} display={len(current_records)}"
)
