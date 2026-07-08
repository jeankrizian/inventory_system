async function initSettingsPage() {
  const user = await initLayout('settings');
  if (!user) return;

  document.getElementById('pageContent').innerHTML = `
    <div class="page-header">
      <h1>Settings</h1>
      <p>Account and system settings</p>
    </div>
    <div class="content-card">
      <h3 style="font-size:16px;margin-bottom:20px;">Profile Information</h3>
      <div style="display:flex;align-items:center;gap:20px;margin-bottom:24px;">
        <div class="profile-avatar" style="width:64px;height:64px;font-size:22px;">${getInitials(user.full_name)}</div>
        <div>
          <h4 style="font-size:16px;">${user.full_name}</h4>
          <p style="color:var(--text-secondary);font-size:13px;">${user.email}</p>
          <span class="badge badge-available" style="margin-top:4px;">${user.role_name || user.role}</span>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Username</label><input type="text" class="form-control-custom" value="${user.username}" disabled></div>
        <div class="form-group"><label>Email</label><input type="email" class="form-control-custom" value="${user.email}" disabled></div>
      </div>
    </div>
  `;
}

document.addEventListener('DOMContentLoaded', initSettingsPage);
