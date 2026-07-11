function pageLink(page, id, extraQuery = '') {
  if (!id) return `/pages/${page}.html${extraQuery}`;
  const query = extraQuery ? `?id=${id}&${extraQuery.replace(/^\?/, '')}` : `?id=${id}`;
  return `/pages/${page}.html${query}`;
}

module.exports = {
  borrowLink: (id) => pageLink('orders', id),
  maintenanceLink: (id) => pageLink('maintenance-requests', id),
  transferLink: (id) => pageLink('transfer-requests', id),
  disposalLink: (id) => pageLink('disposal-requests', id),
  usersLink: (id) => pageLink('manage-users', id)
};
