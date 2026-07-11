const {
  parseSequentialTag,
  generatePropertyTagSequence,
  formatSequentialTag,
  getDatePrefix,
  formatAutoPropertyTag,
  parseAutoTagSequence,
  isAutoPropertyTagFormat,
  generateAutoPropertyTags
} = require('./utils/propertyTagGenerator');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const parsed = parseSequentialTag('2025-0001');
assert(parsed.prefix === '2025-' && parsed.startNum === 1 && parsed.padWidth === 4, 'parse legacy tag');

const tags = generatePropertyTagSequence('2025-0001', 5);
assert(tags.length === 5, 'five legacy tags');
assert(tags[0] === '2025-0001' && tags[4] === '2025-0005', 'legacy sequence');

assert(formatSequentialTag(parsed, 9) === '2025-0010', 'legacy rollover padding');

const prefix = getDatePrefix(new Date('2026-07-10T12:00:00'));
assert(prefix === '20260710', 'date prefix');

assert(formatAutoPropertyTag('20260710', 1) === '20260710-000001', 'auto tag format');
assert(parseAutoTagSequence('20260710-000033') === 33, 'parse auto sequence');
assert(isAutoPropertyTagFormat('20260710-000001'), 'auto format check');

(async () => {
  const autoTags = await generateAutoPropertyTags(2);
  assert(autoTags.length === 2, 'two auto tags');
  assert(autoTags[0].startsWith(prefix), 'first tag uses today prefix');
  assert(parseAutoTagSequence(autoTags[1]) === parseAutoTagSequence(autoTags[0]) + 1, 'sequential auto tags');
  console.log('All property tag generator tests passed.');
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
