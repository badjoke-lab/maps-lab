import json,re,sys,math,os

IN=os.environ.get('STRICT_IN','corona-strict-probe-results.json')
OUT=os.environ.get('CANONICAL_OUT','corona-canonical-audit.json')
d=json.load(open(IN,encoding='utf-8'))

CURRENCY={
'AE':'AED','AM':'AMD','AT':'EUR','AU':'AUD','BA':'BAM','BE':'EUR','BG':'BGN','BH':'BHD','BR':'BRL','CA':'CAD','CH':'CHF','CL':'CLP','CO':'COP','CR':'CRC','CY':'EUR','CZ':'CZK','DE':'EUR','DK':'DKK','DO':'DOP','EC':'USD','EE':'EUR','ES':'EUR','FI':'EUR','FR':'EUR','GB':'GBP','GE':'GEL','GH':'GHS','GR':'EUR','GT':'GTQ','HK':'HKD','HR':'EUR','HU':'HUF','ID':'IDR','IE':'EUR','IL':'ILS','IS':'ISK','IT':'EUR','JM':'USD','JO':'JOD','JP':'JPY','KE':'KES','KR':'KRW','KZ':'KZT','LB':'USD','LK':'LKR','LU':'EUR','LV':'EUR','MD':'MDL','MT':'EUR','MU':'MUR','MX':'MXN','MY':'MYR','NI':'NIO','NL':'EUR','NO':'NOK','NP':'USD','NZ':'NZD','PA':'USD','PE':'PEN','PH':'PHP','PL':'PLN','PT':'EUR','PY':'PYG','RO':'RON','RS':'RSD','RW':'RWF','SE':'SEK','SG':'SGD','SI':'EUR','SK':'EUR','TH':'THB','TT':'TTD','TW':'TWD','UG':'UGX','US':'USD','UY':'UYU','VN':'VND','ZA':'ZAR','ZM':'ZMW'}
PREFERRED={'MD':'winetime.md','NP':'cheers.com.np','UG':'legourmetkampala.com','TH':'wishbeer.com'}

def num(s):
    if s is None:return None
    t=re.sub(r'[^0-9,.: ]','',str(s)).strip().replace(':','.')
    t=t.replace(' ','')
    if not t:return None
    if ',' in t and '.' in t:
        if t.rfind(',')>t.rfind('.'):
            t=t.replace('.','').replace(',','.')
        else:t=t.replace(',','')
    elif t.count(',')==1:
        a,b=t.split(','); t=a+'.'+b if len(b)<=2 else a+b
    elif t.count('.')==1:
        a,b=t.split('.'); t=a+b if len(b)==3 and len(a)<=3 else t
    elif t.count(',')>1 or t.count('.')>1:t=re.sub(r'[,.]','',t)
    try:return float(t)
    except:return None

def ml(v,u):
    v=float(str(v).replace(',','.')); u=u.lower()
    return v if u in ('ml','cc') else v*10 if u=='cl' else v*1000 if u in ('l','lt','liter','litre') else None

def pack_volume(r):
    c=r['code']
    fixed={
        'AU':24*355.0,'BA':24*355.0,'CA':12*473.0,'CR':1242.0,
        'CZ':1980.0,'DO':6*355.0,'FR':6*330.0,'IE':18*330.0,
        'JM':24*355.0,'JP':24*330.0,'NL':6*330.0,'SI':6*330.0,
        'TW':24*355.0,
    }
    if c in fixed:return fixed[c]
    s=' '.join((r.get('sample') or '').split())
    if c=='NI':
        m=re.search(r'Cerveza Corona Con Envase De Vidrio\s*-\s*(\d+(?:[.,]\d+)?)\s*(ml|cl|l)\b',s,re.I)
        if m:return ml(m.group(1),m.group(2))
    vv=r.get('volume') or ''
    m=re.search(r'(?:(\d{1,3})\s*[x×*]\s*)?(\d+(?:[.,]\d+)?)\s*(ml|cl|l|lt|liter|litre|cc)\b',vv,re.I)
    if m:return int(m.group(1) or 1)*ml(m.group(2),m.group(3))
    return None

def price(r):
    s=' '.join((r.get('sample') or '').split())
    c=r['code']; url=r['url']
    if c=='BR' and 'carrefour' in url:
        m=re.search(r'Corona Extra.{0,300}?R\$\s*([0-9.,]+).{0,60}?R\$\s*([0-9.,]+)',s,re.I)
        if m:return num(m.group(2))
    if c=='CZ' and 'rohlik' in url:
        m=re.search(r'/l\s+(\d{1,4})\s+(\d{2})\s*CZK\b',s,re.I)
        if m:return float(m.group(1)+'.'+m.group(2))
    if c=='FR' and 'monoprix' in url:
        m=re.search(r'\(\s*[0-9.,]+\s*€\s*/\s*litre\s*\)\s*([0-9]+[.,][0-9]{2})\s*€',s,re.I)
        if m:return num(m.group(1))
    if c=='GE' and 'kompas.ge' in url:
        m=re.search(r'Corona Extra Beer.{0,450}?from\s+([0-9]+[.,][0-9]{2})\s*₾',s,re.I)
        if m:return num(m.group(1))
    if c=='IE' and 'carryout' in url:
        m=re.search(r'€\s*([0-9.]+)\s+€\s*([0-9.]+)\s*\(€[^)]*/Litre\)',s,re.I)
        if m:return num(m.group(2))
    if c=='JP' and 'costco' in url:
        m=re.search(r'¥\s*([\d,]+)\s+1本当り\s+¥\s*[\d,]+\s+コロナ エキストラ',s)
        if m:return num(m.group(1))
    if c=='LK' and 'ceylonspirits' in url:
        m=re.search(r'Corona Extra 330ml Bottle\s+LKR\s*([\d,]+\.\d{2})\s*(?:&ndash;|–|-)',s,re.I)
        if m:return num(m.group(1))
    if c=='MY' and 'jayagrocer' in url:
        m=re.search(r'Corona Extra Beer 355ml\s+RM\s*([0-9.]+)\s+RM\s*([0-9.]+)',s,re.I)
        if m:return num(m.group(1))
    if c=='MD' and 'winetime.md' in url:
        m=re.search(r'Bere Corona Extra sticla 0\.355 L.{0,80}?(\d+[.,]\d{2})\s*lei',s,re.I)
        if m:return num(m.group(1))
    if c=='IS':
        m=re.search(r'Corona Extra[^0-9]{0,80}330 ml[^0-9]{0,30}(\d[\d.,]*)\s+Price per liter',s,re.I)
        if m:return num(m.group(1))
    if c=='HR':
        m=re.search(r'Corona Extra Svijetlo pivo 0,33 l.{0,80}?(\d)\s+(\d{2})\s*€/kom',s,re.I)
        if m:return float(m.group(1)+'.'+m.group(2))
    if c=='JO':
        m=re.search(r'Regular price\s+([0-9]+\.[0-9]{3})\s+JD',s,re.I)
        if m:return float(m.group(1))
    return r.get('numericPrice') or num(r.get('price'))

by={}
for r in d['results']:
    if r.get('ok'):by.setdefault(r['code'],[]).append(r)
selected={}
for code,rs in by.items():
    pref=PREFERRED.get(code)
    if pref:
        hit=[r for r in rs if pref in r.get('url','')]
        if hit:rs=hit
    selected[code]=rs[0]

out=[]; rejected=[]
for code in sorted(selected):
    r=selected[code]; p=price(r); v=pack_volume(r)
    reason=[]
    if p is None or not math.isfinite(p) or p<=0:reason.append('invalid-price')
    if v is None or not math.isfinite(v) or v<=0:reason.append('invalid-volume')
    if code not in CURRENCY:reason.append('unknown-currency')
    if reason:
        rejected.append({'code':code,'country':r.get('country'),'url':r.get('url'),'reason':reason,'price':r.get('price'),'volume':r.get('volume'),'sample':r.get('sample')})
        continue
    out.append({'code':code,'country':r.get('country'),'url':r.get('url'),'currency':CURRENCY[code],'shelfPrice':round(p,4),'packageVolumeMl':round(v,2),'pricePerLiter':round(p/(v/1000),4),'sourceMode':r.get('mode'),'httpStatus':r.get('status'),'observedPriceText':r.get('price'),'observedVolumeText':r.get('volume')})

payload={'generatedAt':d.get('generatedAt'),'strictPassedCountries':d.get('passedCountries'),'canonicalPassedCountries':len(out),'threshold':50,'thresholdMet':len(out)>=50,'records':out,'rejected':rejected}
json.dump(payload,open(OUT,'w',encoding='utf-8'),ensure_ascii=False,indent=2)
print('CANONICAL PASS',len(out),'/',d.get('totalCountries'))
for x in rejected:print('REJECT',x['code'],','.join(x['reason']),x['price'],x['volume'])
if len(out)<50:sys.exit(2)
