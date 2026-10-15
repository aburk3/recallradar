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
const page = ({ url, t, desc, body, noindex, ld }) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(t)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${SITE}${url}">${noindex ? '<meta name="robots" content="noindex,follow">' : ''}<style>${CSS}</style>${ld ? `<script type="application/ld+json">${JSON.stringify(ld)}</script>` : ''}</head><body><header><a href="${BASE}/">RecallRadar</a></header><main>${body}</main><footer>Data: U.S. NHTSA public APIs (recalls, owner complaints, safety ratings), refreshed regularly. Complaints are unverified owner reports. Not affiliated with NHTSA or any manufacturer. Last built ${today}.</footer></body></html>`;
const out = (url, html) => { const f = path.join('site', url, 'index.html'); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, html); };

const vehicles = Object.values(db);
const byMake = {};
for (const v of vehicles) ((byMake[v.make] ??= {})[v.model] ??= []).push(v);
const sitemap = [`${SITE}/`];
const stars = n => (n && n !== 'Not Rated' ? `${n} / 5` : 'Not rated');

fs.rmSync('site', { recursive: true, force: true });
let count = 0;
for (const [make, models] of Object.entries(byMake)) {
  for (const [model, list] of Object.entries(models)) {
    list.sort((a, b) => b.year - a.year);
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
      out(url, page({ url, t: `${name} Recalls, Problems & Safety Ratings`, desc: `${name}: ${v.recalls.length} recalls, ${v.complaintCount} owner complaints, crash ratings and most common problems from NHTSA data.`, body, noindex: !worthIndexing }));
      if (worthIndexing) sitemap.push(SITE + url);
      count++;
    }
  }
  const url = `/${slug(make)}/`;
  const rows = Object.entries(models).map(([m, l]) => `<tr><td>${esc(m)}</td><td>${l.map(x => `<a href="${BASE}/${slug(make)}/${slug(m)}/${x.year}/">${x.year}</a>`).join(' ')}</td></tr>`).join('');
  out(url, page({ url, t: `${mk(make)} Recalls by Model & Year`, desc: `Browse NHTSA recalls and complaints for every ${mk(make)} model and year.`, body: `<h1>${esc(mk(make))} recalls by model and year</h1><table>${rows}</table>` }));
  sitemap.push(SITE + url);
}
const home = Object.keys(byMake).map(m => `<li><a href="${BASE}/${slug(m)}/">${esc(mk(m))}</a></li>`).join('');
out('/', page({ url: '/', t: 'RecallRadar — Vehicle Recalls, Complaints & Safety Ratings', desc: 'Look up NHTSA recalls, owner complaints and crash ratings for any make, model and year.', body: `<h1>Vehicle recalls, complaints &amp; safety ratings</h1><p>Plain-English summaries built from official NHTSA data. Pick a make:</p><ul>${home}</ul>` }));
fs.writeFileSync('site/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemap.map(u => `<url><loc>${u}</loc></url>`).join('')}</urlset>`);
fs.writeFileSync('site/robots.txt', `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);
fs.writeFileSync('site/.nojekyll', '');
console.log(`built ${count} vehicle pages, ${sitemap.length} in sitemap`);
