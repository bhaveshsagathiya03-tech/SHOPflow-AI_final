function DashboardCard({ title, value, icon, subtitle = "Live data", color = "#4F46E5", badge }) {
  return (
    <div className="stat-card">
      <div className="stat-card-top">
        <div
          className="stat-icon-wrapper"
          style={{
            background: `${color}18`,
            color: color,
          }}
        >
          {icon}
        </div>
        {badge && <span className="stat-card-badge">{badge}</span>}
      </div>

      <div className="stat-card-body">
        <div className="stat-title">{title}</div>
        <div className="stat-value">{value}</div>
        <div className="stat-subtitle">{subtitle}</div>
      </div>
    </div>
  );
}

export default DashboardCard;