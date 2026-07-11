function formatNotificationTimestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function buildAssetNotificationMessage({
  action,
  itemName = null,
  propertyTag = null,
  detail = ''
}) {
  const parts = [`Action: ${action}`];
  if (itemName) parts.push(`Item: ${itemName}`);
  if (propertyTag) parts.push(`Property Tag: ${propertyTag}`);
  parts.push(`Time: ${formatNotificationTimestamp()}`);
  if (detail) parts.push(detail);
  return parts.join(' | ');
}

function buildGovernanceNotificationMessage({ action, subject, detail = '' }) {
  const parts = [`Action: ${action}`, `Subject: ${subject}`, `Time: ${formatNotificationTimestamp()}`];
  if (detail) parts.push(detail);
  return parts.join(' | ');
}

function assetTagSuffix(item) {
  return item?.property_tag ? ` Property Tag: ${item.property_tag}.` : '';
}

function assetTagMessage(item, prefix = '') {
  const suffix = assetTagSuffix(item);
  if (!suffix) return prefix;
  return `${prefix}${suffix}`;
}

module.exports = {
  formatNotificationTimestamp,
  buildAssetNotificationMessage,
  buildGovernanceNotificationMessage,
  assetTagSuffix,
  assetTagMessage
};
