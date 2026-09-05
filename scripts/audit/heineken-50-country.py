#!/usr/bin/env python3
import csv, html, json, os, re, sys, time
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

COUNTRIES = [
    ("US","United States"),("GB","United Kingdom"),("DE","Germany"),("FR","France"),("IT","Italy"),
    ("ES","Spain"),("NL","Netherlands"),("BE","Belgium"),("PT","Portugal"),("IE","Ireland"),
    ("AT","Austria"),("CH","Switzerland"),("PL","Poland"),("CZ","Czech Republic"),("HU","Hungary"),
    ("RO","Romania"),("HR","Croatia"),("GR","Greece"),("CY","Cyprus"),("SE","Sweden"),
    ("NO","Norway"),("DK","Denmark"),("FI","Finland"),("SK","Slovakia"),("SI","Slovenia"),
    ("BG","Bulgaria"),("LT","Lithuania"),("LV","Latvia"),("EE","Estonia"),("JP","Japan"),
    ("KR","South Korea"),("SG","Singapore"),("MY","Malaysia"),("TH","Thailand"),("PH","Philippines"),
    ("ID","Indonesia"),("VN","Vietnam"),("IN","India"),("AU","Australia"),("NZ","New Zealand"),
    ("BR","Brazil"),("MX","Mexico"),("AR","Argentina"),("CL","Chile"),("CO","Colombia"),
    ("PE","Peru"),("ZA","South Africa"),("AE","United Arab Emirates"),("TR","Turkey"),("IL","Israel"),
]

PRICE_RE = re.compile(r"(?:[$€£¥₹₩₺₽₫₱₴]|R\$|S\$|A\$|NZ\$|CHF|PLN|CZK|HUF|RON|HRK|NOK|SEK|DKK|BGN|MYR|THB|IDR|VND|PHP|ZAR|AED|ILS|MXN|ARS|CLP|COP|PEN)\s?[0-9][0-9.,]*", re.I)
VOL_RE = re.compile(r"\b(?:[0-9]{1,2}\s*[x×]\s*)?(?:250|300|320|325|330|355|440|473|500|568|650)\s*m[lL]\b|\b(?:25|30|32|33|35|44|47\.3|50|56\.8|65)\s*c[lL]\b", re.I)
BAD_RE = re.compile(r"\b(?:0\.0|zero|alcohol[- ]?free|non[- ]?alcoholic|silver)\b", re.I)
GOOD_RE = re.compile(r"\bheineken\b", re.I)

def get_json(url, headers=None, timeout=20):
    req = Request(url, headers=headers or {"User-Agent":"Mozilla/5.0"})
    with urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8", "replace"))

def get_text(url, headers=None, timeout=20):
    req = Request(url, headers=headers or {"User-Agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126 Safari/537.36"})
    with urlopen(req, timeout=timeout) as r:
        return r.status, r.read().decode("utf-8", "replace")

def serpapi_country(code, name, key):
    params = {
        "engine":"google_shopping",
        "q":"Heineken Original 330ml",
        "gl":code.lower(),
        "hl":"en",
        "api_key":key,
        "num":20,
    }
    url = "https://serpapi.com/search.json?" + urlencode(params)
    try:
        data = get_json(url)
    except Exception as e:
        return {"country_code":code,"country":name,"mode":"serpapi","status":"error","error":str(e)[:200]}
    results = data.get("shopping_results") or []
    good=[]
    for x in results:
        title = str(x.get("title") or "")
        price = x.get("extracted_price") if x.get("extracted_price") is not None else x.get("price")
        source = x.get("source") or x.get("merchant") or ""
        if not GOOD_RE.search(title) or BAD_RE.search(title):
            continue
        if not VOL_RE.search(title):
            continue
        good.append({"title":title,"price":price,"source":source,"link":x.get("product_link") or x.get("link") or ""})
    return {
        "country_code":code,"country":name,"mode":"serpapi","status":"ok",
        "raw_results":len(results),"eligible_results":len(good),"offers":good[:10]
    }

def public_google_country(code, name):
    params = {"tbm":"shop","q":"Heineken Original 330ml","gl":code.lower(),"hl":"en","num":"20"}
    url = "https://www.google.com/search?" + urlencode(params)
    try:
        status, text = get_text(url)
    except HTTPError as e:
        return {"country_code":code,"country":name,"mode":"public_google","status":"http_error","http_status":e.code}
    except Exception as e:
        return {"country_code":code,"country":name,"mode":"public_google","status":"error","error":str(e)[:200]}
    low = html.unescape(re.sub(r"<[^>]+>"," ",text))
    has_heineken = bool(GOOD_RE.search(low))
    has_volume = bool(VOL_RE.search(low))
    prices = PRICE_RE.findall(low)
    blocked = any(s in low.lower() for s in ["unusual traffic","our systems have detected","before you continue to google","sorry/index"])
    return {
        "country_code":code,"country":name,"mode":"public_google","status":"ok" if not blocked else "blocked",
        "http_status":status,"has_heineken":has_heineken,"has_volume":has_volume,"price_tokens":prices[:10],
        "price_token_count":len(prices),"html_bytes":len(text.encode("utf-8")),
        "eligible_signal": bool(has_heineken and has_volume and prices and not blocked),
    }

def main():
    out = Path(sys.argv[1] if len(sys.argv)>1 else "audit-output")
    out.mkdir(parents=True, exist_ok=True)
    key = os.getenv("SERPAPI_API_KEY", "").strip()
    mode = "serpapi" if key else "public_google"
    rows=[]
    for i,(code,name) in enumerate(COUNTRIES,1):
        r = serpapi_country(code,name,key) if key else public_google_country(code,name)
        rows.append(r)
        print(f"[{i:02d}/50] {code} {r.get('status')} eligible={r.get('eligible_results',r.get('eligible_signal'))}")
        if not key:
            time.sleep(0.35)
    if key:
        success = [r for r in rows if r.get("status")=="ok" and r.get("eligible_results",0)>0]
        multi = [r for r in rows if r.get("eligible_results",0)>=2]
        merchants = sum(r.get("eligible_results",0) for r in rows)
        summary = {"mode":mode,"countries_tested":50,"countries_with_eligible_offer":len(success),"countries_with_2plus_offers":len(multi),"eligible_offers_total":merchants,"rows":rows}
    else:
        success=[r for r in rows if r.get("eligible_signal")]
        blocked=[r for r in rows if r.get("status")=="blocked"]
        summary={"mode":mode,"countries_tested":50,"countries_with_eligible_signal":len(success),"blocked_countries":len(blocked),"note":"Public Google HTML is a feasibility fallback only; it is not a production data source.","rows":rows}
    (out/"summary.json").write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding="utf-8")
    with (out/"countries.csv").open("w",encoding="utf-8",newline="") as f:
        fields=["country_code","country","mode","status","eligible_results","eligible_signal","raw_results","price_token_count","http_status"]
        w=csv.DictWriter(f,fieldnames=fields,extrasaction="ignore");w.writeheader();w.writerows(rows)
    print(json.dumps({k:v for k,v in summary.items() if k!="rows"},ensure_ascii=False,indent=2))

if __name__=="__main__": main()
