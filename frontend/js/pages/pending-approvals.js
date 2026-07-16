/**
 * Pending Approvals was merged into Borrow / Transfer / Maintenance / Disposals.
 * Keep this URL working by sending Property Managers to the dashboard pending cards.
 */
document.addEventListener('DOMContentLoaded', async () => {
  const user = await requireAuth();
  if (!user) return;

  const params = new URLSearchParams(window.location.search);
  const tab = params.get('tab');
  const links = {
    borrow: '/pages/orders.html?status=Pending',
    transfer: '/pages/transfer-requests.html?status=Pending',
    maintenance: '/pages/maintenance-requests.html?status=Pending',
    disposal: '/pages/disposal-requests.html?queue=pending'
  };

  if (tab && links[tab]) {
    window.location.replace(links[tab]);
    return;
  }

  window.location.replace('/pages/dashboard.html');
});
