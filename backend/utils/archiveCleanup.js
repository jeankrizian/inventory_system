const { purgeExpiredRecords } = require('./archiveService');

const DAY_MS = 24 * 60 * 60 * 1000;

async function runArchiveCleanup() {
  try {
    const count = await purgeExpiredRecords();
    if (count > 0) {
      console.log(`Archive cleanup: permanently removed ${count} expired record(s).`);
    }
  } catch (err) {
    console.error('Archive cleanup error:', err.message);
  }
}

function startArchiveCleanupScheduler() {
  runArchiveCleanup();
  setInterval(runArchiveCleanup, DAY_MS);
}

module.exports = { runArchiveCleanup, startArchiveCleanupScheduler };
