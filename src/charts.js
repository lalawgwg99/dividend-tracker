const FONT = "'Inter', 'Noto Sans TC', sans-serif";

const defaults = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
};

const tickStyle = {
  color: '#9a9690',
  font: { family: FONT, size: 11 },
};

export function createMonthChart(ctx) {
  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels: [],
      datasets: [{
        label: '每月配息',
        data: [],
        backgroundColor: '#0c6e3c',
        hoverBackgroundColor: '#0f9050',
        borderRadius: 3,
        borderSkipped: false,
      }]
    },
    options: {
      ...defaults,
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: '#ede9e0', drawTicks: false },
          border: { display: false },
          ticks: { ...tickStyle, padding: 8 }
        },
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: { ...tickStyle }
        }
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
        backgroundColor: ['#c8a060', '#0c6e3c'],
        hoverBackgroundColor: ['#b08040', '#0f9050'],
        borderRadius: 3,
        borderSkipped: false,
      }]
    },
    options: {
      ...defaults,
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: '#ede9e0', drawTicks: false },
          border: { display: false },
          ticks: { ...tickStyle, padding: 8 }
        },
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: { ...tickStyle }
        }
      }
    }
  });
}
