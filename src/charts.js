export function createMonthChart(ctx) {
  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels: [],
      datasets: [{
        label: '每月配息',
        data: [],
        backgroundColor: '#2563eb',
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, grid: { color: '#e2e8f0' } },
        x: { grid: { display: false } }
      }
    }
  });
}

export function createYearChart(ctx) {
  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels: [],
      datasets: [{
        label: '年度總配息',
        data: [],
        backgroundColor: ['#0ea5e9', '#22c55e']
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } }
    }
  });
}
