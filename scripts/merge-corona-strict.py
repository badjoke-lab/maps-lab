import json,sys

paths=sys.argv[1:]
if len(paths)<2:
    raise SystemExit('need at least two strict result files')

runs=[json.load(open(p,encoding='utf-8')) for p in paths]
results=[]
for run in runs:
    results.extend(run.get('results',[]))

all_codes=sorted({r.get('code') for r in results if r.get('code')})
passed_codes=sorted({r.get('code') for r in results if r.get('code') and r.get('ok')})
failed_codes=[c for c in all_codes if c not in passed_codes]

payload={
    'generatedAt': runs[-1].get('generatedAt'),
    'runner': runs[-1].get('runner','github-actions'),
    'attempts': len(runs),
    'totalCountries': len(all_codes),
    'passedCountries': len(passed_codes),
    'passedCodes': passed_codes,
    'failedCountries': len(failed_codes),
    'failedCodes': failed_codes,
    'threshold': 50,
    'thresholdMet': len(passed_codes)>=50,
    'results': results,
}
json.dump(payload,open('corona-strict-probe-results.json','w',encoding='utf-8'),ensure_ascii=False,indent=2)
print('MERGED STRICT PASS',len(passed_codes),'/',len(all_codes),'from',len(runs),'attempts')
print('FAILED',','.join(failed_codes))
if len(passed_codes)<50:
    sys.exit(2)
