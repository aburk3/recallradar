// Static generator: data/vehicles.json -> site/
import fs from 'node:fs';
import path from 'node:path';
const SITE = (process.env.SITE_URL || 'https://aburk3.github.io/recallradar').replace(/\/$/, '');
const BASE = new URL(SITE).pathname.replace(/\/$/, '');
const db = JSON.parse(fs.readFileSync('data/vehicles.json', 'utf8'));
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const title = s => s.replace(/\b\w/g, c => c.toUpperCase());
const names = { 'mercedes-benz': 'Mercedes-Benz', bmw: 'BMW', gmc: 'GMC', ram: 'RAM' };
const mk = m => names[m] || title(m);
const today = new Date().toISOString().slice(0, 10);

const CSS = `body{font:16px/1.55 system-ui,sans-serif;max-width:860px;margin:0 auto;padding:16px;color:#1a1a1a}a{color:#0b5cad}header{border-bottom:1px solid #ddd;margin-bottom:20px}header a{font-weight:700;text-decoration:none;font-size:20px}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #eee;padding:6px 8px;text-align:left}.stat{display:inline-block;margin:0 18px 10px 0}.stat b{font-size:26px;display:block}.warn{background:#fff4e5;border-left:4px solid #e08a00;padding:8px 12px}footer{margin-top:40px;color:#666;font-size:13px;border-top:1px solid #ddd;padding-top:12px}`;
const page = ({ url, t, desc, body, noindex, crumbs = [] }) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(t)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${SITE}${url}">${noindex ? '<meta name="robots" content="noindex,follow">' : ''}<style>${CSS}</style>${crumbs.length ? `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [['Home', '/'], ...crumbs].map(([n, u], i) => ({ '@type': 'ListItem', position: i + 1, name: n, item: SITE + u })) })}</script>` : ''}</head><body><header><a href="${BASE}/">RecallRadar</a></header><main>${crumbs.length ? `<nav><small>${[['Home', '/'], ...crumbs].map(([n, u]) => `<a href="${BASE}${u}">${esc(n)}</a>`).join(' › ')}</small></nav>` : ''}${body}</main><footer>Data: U.S. NHTSA public APIs (recalls, owner complaints, safety ratings), refreshed regularly. Complaints are unverified owner reports. Not affiliated with NHTSA or any manufacturer. Last built ${today}.</footer></body></html>`;
const out = (url, html) => { const f = path.join('site', url, 'index.html'); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, html); };

const vehicles = Object.values(db);
const byMake = {};
for (const v of vehicles) ((byMake[v.make] ??= {})[v.model] ??= []).push(v);
const sitemaps = { site: [`${SITE}/`] };
const stars = n => (n && n !== 'Not Rated' ? `${n} / 5` : 'Not rated');

fs.rmSync('site', { recursive: true, force: true });
let count = 0;
for (const [make, models] of Object.entries(byMake)) {
  for (const [model, list] of Object.entries(models)) {
    list.sort((a, b) => b.year - a.year);
    {
      const url = `/${slug(make)}/${slug(model)}/`;
      const ys = [...list].sort((a, b) => a.year - b.year);
      const score = v => v.recalls.length * 3 + v.complaintCount / 50 + v.fires + v.deaths * 5; // rough "trouble" index
      const worst = [...ys].sort((a, b) => score(b) - score(a)).slice(0, 3);
      const best = [...ys].filter(v => v.complaintCount >= 10 || v.recalls.length).sort((a, b) => score(a) - score(b)).slice(0, 3);
      const link = v => `<a href="${BASE}/${slug(make)}/${slug(model)}/${v.year}/">${v.year}</a>`;
      const rows = ys.map(v => `<tr><td>${link(v)}</td><td>${v.recalls.length}</td><td>${v.complaintCount}</td><td>${v.fires}</td><td>${v.injuries}</td><td>${stars(v.ratings?.overall)}</td></tr>`).join('');
      const name = `${mk(make)} ${model}`;
      const body = `<h1>${esc(name)} Recalls &amp; Problems by Model Year</h1>
<p>Compared across ${ys.length} model year${ys.length === 1 ? '' : 's'} (${ys[0].year}–${ys.at(-1).year}) using NHTSA data. ${ys.length > 1 ? `Years with the most recalls and complaints: ${worst.map(link).join(', ')}.${best.length ? ` Fewest reported problems: ${best.map(link).join(', ')}.` : ''}` : ''}</p>
<table><tr><th>Year</th><th>Recalls</th><th>Complaints</th><th>Fires</th><th>Injuries</th><th>Crash rating</th></tr>${rows}</table>
<p><small>Newer model years have had less time to collect complaints, so compare older years with care.</small></p>`;
      out(url, page({ url, t: `${name} Problems & Recalls by Year: Best and Worst Years`, desc: `Which ${name} years have the most recalls and complaints? Year-by-year NHTSA comparison for ${ys[0].year}–${ys.at(-1).year}.`, body, crumbs: [[mk(make), `/${slug(make)}/`], [model, url]] }));
      if (ys.length > 1 && ys.some(v => v.recalls.length || v.complaintCount >= 10)) (sitemaps[make] ??= []).push(SITE + url);
    }
    for (const v of list) {
      const url = `/${slug(make)}/${slug(model)}/${v.year}/`;
      const name = `${v.year} ${mk(make)} ${v.model}`;
      const worthIndexing = v.recalls.length > 0 || v.complaintCount >= 10;
      const sibs = list.filter(x => x !== v).map(x => `<a href="${BASE}/${slug(make)}/${slug(model)}/${x.year}/">${x.year}</a>`).join(' · ');
      const comps = v.topComponents.map(([c, n]) => `<tr><td>${esc(title(c.toLowerCase()))}</td><td>${n}</td></tr>`).join('');
      const recs = v.recalls.map(r => `<h3>${esc(r.id)} — ${esc(title((r.component || '').toLowerCase()))}</h3><p><small>Reported ${esc(r.date)}${r.parkIt ? ' · <b>Manufacturer advises: do not drive</b>' : ''}</small></p><p>${esc(r.summary)}</p>${r.consequence ? `<p><b>Risk:</b> ${esc(r.consequence)}</p>` : ''}${r.remedy ? `<p><b>Fix:</b> ${esc(r.remedy)}</p>` : ''}`).join('');
      const R = v.ratings;
      const body = `<h1>${esc(name)} Recalls, Complaints &amp; Safety Ratings</h1>
<p>The ${esc(name)} has <b>${v.recalls.length}</b> NHTSA safety recall${v.recalls.length === 1 ? '' : 's'} and <b>${v.complaintCount}</b> owner complaint${v.complaintCount === 1 ? '' : 's'} on file${v.topComponents[0] ? `, most often about ${esc(v.topComponents[0][0].toLowerCase())}` : ''}.</p>
<div><span class="stat"><b>${v.recalls.length}</b>recalls</span><span class="stat"><b>${v.complaintCount}</b>complaints</span><span class="stat"><b>${v.crashes}</b>crashes reported</span><span class="stat"><b>${v.fires}</b>fires reported</span><span class="stat"><b>${v.injuries}</b>injuries</span><span class="stat"><b>${v.deaths}</b>deaths</span></div>
${R ? `<h2>NHTSA crash test ratings</h2><table><tr><th>Overall</th><th>Front</th><th>Side</th><th>Rollover</th></tr><tr><td>${stars(R.overall)}</td><td>${stars(R.front)}</td><td>${stars(R.side)}</td><td>${stars(R.rollover)}</td></tr></table>` : ''}
${comps ? `<h2>Most-complained-about systems</h2><table><tr><th>Component</th><th>Complaints</th></tr>${comps}</table>` : ''}
<h2>Safety recalls</h2>${recs || '<p>No NHTSA recalls on file for this model year.</p>'}
<div class="warn"><b>Check your own car:</b> recalls apply to specific VINs. Enter your VIN at <a href="https://www.nhtsa.gov/recalls" rel="nofollow noopener">nhtsa.gov/recalls</a> — it is free.</div>
<h2>Other ${esc(mk(make))} ${esc(v.model)} years</h2><p>${sibs || 'None'}</p><p><a href="${BASE}/${slug(make)}/">All ${esc(mk(make))} models</a></p>`;
      out(url, page({ url, t: `${name} Recalls, Problems & Safety Ratings`, desc: `${name}: ${v.recalls.length} recalls, ${v.complaintCount} owner complaints, crash ratings and most common problems from NHTSA data.`, body, noindex: !worthIndexing, crumbs: [[mk(make), `/${slug(make)}/`], [v.model, `/${slug(make)}/${slug(model)}/`], [String(v.year), url]] }));
      if (worthIndexing) (sitemaps[make] ??= []).push(SITE + url);
      count++;
    }
  }
  const url = `/${slug(make)}/`;
  const rows = Object.entries(models).map(([m, l]) => `<tr><td><a href="${BASE}/${slug(make)}/${slug(m)}/">${esc(m)}</a></td><td>${l.map(x => `<a href="${BASE}/${slug(make)}/${slug(m)}/${x.year}/">${x.year}</a>`).join(' ')}</td></tr>`).join('');
  out(url, page({ url, t: `${mk(make)} Recalls by Model & Year`, desc: `Browse NHTSA recalls and complaints for every ${mk(make)} model and year.`, body: `<h1>${esc(mk(make))} recalls by model and year</h1><table>${rows}</table>`, crumbs: [[mk(make), url]] }));
  (sitemaps[make] ??= []).push(SITE + url);
}
const home = Object.keys(byMake).map(m => `<li><a href="${BASE}/${slug(m)}/">${esc(mk(m))}</a></li>`).join('');
out('/', page({ url: '/', t: 'RecallRadar — Vehicle Recalls, Complaints & Safety Ratings', desc: 'Look up NHTSA recalls, owner complaints and crash ratings for any make, model and year.', body: `<h1>Vehicle recalls, complaints &amp; safety ratings</h1><p>Plain-English summaries built from official NHTSA data. Pick a make:</p><input id="q" placeholder="Search a make or model, e.g. camry" style="width:100%;padding:10px;font-size:16px"><ul id="r"></ul><ul id="m">${home}</ul><script>const I=${JSON.stringify(Object.entries(byMake).flatMap(([mk_, ms]) => Object.keys(ms).map(m => [`${mk(mk_)} ${m}`, `${BASE}/${slug(mk_)}/${slug(m)}/`])))};q.oninput=()=>{const t=q.value.toLowerCase().trim();m.hidden=!!t;r.innerHTML=t?I.filter(x=>x[0].toLowerCase().includes(t)).slice(0,30).map(x=>'<li><a href="'+x[1]+'">'+x[0]+'</a></li>').join(''):''}</script>` }));
const xml = (tag, items) => `<?xml version="1.0" encoding="UTF-8"?><${tag} xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items}</${tag}>`;
for (const [m, urls] of Object.entries(sitemaps)) fs.writeFileSync(`site/sitemap-${slug(m)}.xml`, xml('urlset', urls.map(u => `<url><loc>${u}</loc></url>`).join('')));
fs.writeFileSync('site/sitemap.xml', xml('sitemapindex', Object.keys(sitemaps).map(m => `<sitemap><loc>${SITE}/sitemap-${slug(m)}.xml</loc></sitemap>`).join('')));
fs.writeFileSync('site/robots.txt', `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);
fs.writeFileSync('site/.nojekyll', '');
console.log(`built ${count} vehicle pages, ${Object.values(sitemaps).flat().length} in sitemaps`);
