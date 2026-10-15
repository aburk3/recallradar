// Fetch NHTSA data for a curated set of makes/years into data/vehicles.json (resumable cache).
import fs from 'node:fs';
const MAKES = (process.env.MAKES || 'toyota,honda,ford,chevrolet,nissan,hyundai,kia,subaru,mazda,volkswagen,bmw,mercedes-benz,jeep,ram,gmc,dodge,tesla,lexus,audi,volvo').split(',');
const Y0 = +(process.env.Y0 || 2012), Y1 = +(process.env.Y1 || 2026);
const FILE = 'data/vehicles.json';
const db = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : {};
const get = async (u, tries = 3) => {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(u, { signal: AbortSignal.timeout(30000) }); if (r.ok) return await r.json(); } catch {}
    await new Promise(r => setTimeout(r, 1000 * (i + 1)));
  }
  return null;
};
async function pool(items, n, fn) { let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) await fn(items[i++]); })); }

const jobs = [];
for (const make of MAKES) for (let y = Y0; y <= Y1; y++) jobs.push([make, y]);
await pool(jobs, 6, async ([make, year]) => {
  const m = await get(`https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeYear/make/${make}/modelyear/${year}?format=json`);
  for (const r of m?.Results || []) {
    const key = `${make}|${r.Model_Name}|${year}`.toLowerCase();
    const old = db[key];
    if (old && Date.now() - old.fetched < 6 * 864e5) continue;
    const q = `make=${encodeURIComponent(make)}&model=${encodeURIComponent(r.Model_Name)}&modelYear=${year}`;
    const [rec, comp, rate] = await Promise.all([
      get(`https://api.nhtsa.gov/recalls/recallsByVehicle?${q}`),
      get(`https://api.nhtsa.gov/complaints/complaintsByVehicle?${q}`),
      get(`https://api.nhtsa.gov/SafetyRatings/modelyear/${year}/make/${encodeURIComponent(make)}/model/${encodeURIComponent(r.Model_Name)}`),
    ]);
    if (!rec || !comp) continue; // retry next run
    const comps = {}; let crashes = 0, fires = 0, injuries = 0, deaths = 0;
    for (const c of comp.results || []) {
      for (const k of (c.components || '').split(',')) { const t = k.trim(); if (t) comps[t] = (comps[t] || 0) + 1; }
      crashes += c.crash ? 1 : 0; fires += c.fire ? 1 : 0; injuries += c.numberOfInjuries || 0; deaths += c.numberOfDeaths || 0;
    }
    let ratings = null;
    const first = rate?.Results?.[0];
    if (first?.VehicleId) {
      const d = await get(`https://api.nhtsa.gov/SafetyRatings/VehicleId/${first.VehicleId}`);
      const x = d?.Results?.[0];
      if (x) ratings = { overall: x.OverallRating, front: x.OverallFrontCrashRating, side: x.OverallSideCrashRating, rollover: x.RolloverRating };
    }
    db[key] = {
      make, model: r.Model_Name, year, fetched: Date.now(),
      recalls: (rec.results || []).map(x => ({ id: x.NHTSACampaignNumber, date: x.ReportReceivedDate, component: x.Component, summary: x.Summary, consequence: x.Consequence, remedy: x.Remedy, parkIt: x.parkIt })),
      complaintCount: comp.count ?? (comp.results || []).length,
      topComponents: Object.entries(comps).sort((a, b) => b[1] - a[1]).slice(0, 6),
      crashes, fires, injuries, deaths, ratings,
    };
  }
  fs.writeFileSync(FILE, JSON.stringify(db));
  process.stdout.write(`${make} ${year} ok (${Object.keys(db).length})\n`);
});
fs.writeFileSync(FILE, JSON.stringify(db));
