import json,glob,os
from collections import defaultdict

series=defaultdict(list)
for path in sorted(glob.glob('data/corona/history/*.json')):
    if path.endswith('index.json'): continue
    try:
        payload=json.load(open(path,encoding='utf-8'))
    except Exception:
        continue
    date=os.path.basename(path)[:10]
    for r in payload.get('records',[]):
        if r.get('stale'): continue
        price=r.get('pricePer330Ml')
        if not isinstance(price,(int,float)) or price<=0: continue
        series[r['code']].append({
            'date':date,
            'pricePer330Ml':price,
            'currency':r.get('currency'),
            'shelfPrice':r.get('shelfPrice'),
            'packageVolumeMl':r.get('packageVolumeMl'),
            'sourceUrl':r.get('sourceUrl')
        })

out={'schemaVersion':1,'generatedAt':__import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat().replace('+00:00','Z'),'countries':dict(series)}
json.dump(out,open('data/corona/history-summary.json','w',encoding='utf-8'),ensure_ascii=False,indent=2)
print('HISTORY SUMMARY PASS',len(series),'countries',sum(map(len,series.values())),'points')
