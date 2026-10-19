export function configurePreview(base, full, availableNames) {
  const config = structuredClone(base);
  const available = new Set(availableNames);
  const keep = names => names.filter(name => available.has(name));
  const animations = structuredClone(full.animations);
  for (const key of ['idle', 'turn', 'drag', 'clicks']) animations[key] = keep(animations[key]);
  if (!animations.idle.length) animations.idle = [...base.animations.idle];
  if (!animations.clicks.length) animations.clicks = [...base.animations.clicks];
  animations.moves.actions = animations.moves.actions.filter(action => available.has(action.name));
  animations.categories = animations.categories.map(category => ({ ...category, actions: keep(category.actions) }))
    .filter(category => category.actions.length);

  // Event pool positions encode status/balance tiers. Never remove missing slots
  // and shift their meaning; enable a pool only when all its videos are ready.
  // Keep the separate basic balance fallback out of the formal idle pool so the
  // upstream renderer can advance from idle into its normal random action chain.
  animations.events = structuredClone(base.animations.events);
  for (const [key, pool] of Object.entries(full.animations.events)) {
    if (pool.flat().every(name => available.has(name))) animations.events[key] = structuredClone(pool);
  }
  config.animations = animations;
  config.animationWeights = { ...full.animationWeights,
    turn: animations.turn.length ? full.animationWeights.turn : 0,
    move: animations.moves.actions.length ? full.animationWeights.move : 0 };
  if (!animations.categories.length) {
    config.animationWeights.idle = 100 - config.animationWeights.turn - config.animationWeights.move;
  }
  if (animations.turn.length || animations.moves.actions.length) config.pets[0].fixedEnabled = full.pets[0].fixedEnabled;
  if (available.size) config.pets[0].name = 'GPT 白龙娘 · Q版动作预览';
  return config;
}
