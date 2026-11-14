// Which provider to use for each module, from the URL and the readiness flags. Pure.
function listParam(v) {
  if (v == null) return [];
  if (v === '' || v === '1' || v === 'true' || v === 'all') return ['render', 'world', 'art', 'ui', 'physics'];
  return String(v).split(',').map((s) => s.trim()).filter(Boolean);
}

export function planProviders(search, ready) {
  const q = new URLSearchParams(search || '');
  const forceStub = listParam(q.has('stub') ? q.get('stub') : null);
  const forceReal = listParam(q.has('real') ? q.get('real') : null);
  const plan = {};
  for (const key of ['render', 'world', 'art', 'ui', 'physics']) {
    if (forceStub.includes(key)) plan[key] = 'stub';
    else if (forceReal.includes(key)) plan[key] = 'real';
    else plan[key] = ready[key] ? 'real' : 'stub';
  }
  return plan;
}

