// app.js

let fullData = [];
let countries = [];
let chartInstance = null;

const chartColors = [
    '#8b5cf6', '#06b6d4', '#f43f5e', '#f59e0b', '#10b981', '#FF9100'
];

// Simplified Category Mapping
const categoryMap = {
    "1st": "EB-1",
    "2nd": "EB-2",
    "3rd": "EB-3",
    "Other Workers": "EB-3 Other",
    "4th": "EB-4",
    "Certain Religious Workers": "EB-4",
    "5th Unreserved": "EB-5",
    "5th Rural": "EB-5",
    "5th High Unemployment": "EB-5",
    "5th Infrastructure": "EB-5",
    "5th Regional Center (I5 and R5)": "EB-5"
};

// Unique simplified categories to show in UI
const simplifiedCategories = ["EB-1", "EB-2", "EB-3", "EB-3 Other", "EB-4", "EB-5"];

async function loadData() {
  Papa.parse('data/visa_bulletin_all.csv', {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: function(results) {
      fullData = results.data;
      processInitialData();
    }
  });
}

function normalizeCountry(c) {
    if (!c) return "Unknown";
    c = c.replace(/_/g, " ").replace(/\s+/g, " ").trim().toUpperCase();
    if (c.includes("ALL") || c.includes("CHARGEABILITY") || c.includes("EXCEPT") || c.includes("CHARGE-")) return "All Chargeability Areas";
    if (c.includes("CHINA") || c === "CH") return "China";
    if (c.includes("INDIA") || c === "IN") return "India";
    if (c.includes("MEXICO") || c === "ME") return "Mexico";
    if (c.includes("PHIL") || c === "PH") return "Philippines";
    if (c.includes("SALVADOR") || c.includes("GUATEMALA") || c.includes("HONDURAS")) return "El Salvador/Guatemala/Honduras";
    if (c.includes("VIETNAM")) return "Vietnam";
    if (c.includes("DOMINICAN")) return "Dominican Republic";
    
    return c.charAt(0).toUpperCase() + c.slice(1).toLowerCase();
}

function processInitialData() {
  const countrySet = new Set();
  
  fullData.forEach(row => {
    row.normalized_country = normalizeCountry(row.country);
    countrySet.add(row.normalized_country);
  });

  countries = Array.from(countrySet).sort();

  // Populate Country Dropdown
  const countrySelect = document.getElementById('countrySelect');
  countries.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    if (c === 'China') opt.selected = true;
    countrySelect.appendChild(opt);
  });

  // Populate Category Checkboxes
  const catDiv = document.getElementById('categoryCheckboxes');
  simplifiedCategories.forEach((cat) => {
    const label = document.createElement('label');
    label.className = 'checkbox-label';
    if (cat === 'EB-2') label.classList.add('checked');
    
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = cat;
    if (cat === 'EB-2') cb.checked = true;
    
    cb.addEventListener('change', (e) => {
        if (e.target.checked) label.classList.add('checked');
        else label.classList.remove('checked');
        updateChart();
    });
    
    label.appendChild(cb);
    label.appendChild(document.createTextNode(cat));
    catDiv.appendChild(label);
  });

  document.getElementById('countrySelect').addEventListener('change', updateChart);
  document.getElementById('tableSelect').addEventListener('change', updateChart);
  document.getElementById('yAxisSelect').addEventListener('change', updateChart);

  document.getElementById('loader').style.display = 'none';
  document.getElementById('dashboard').style.display = 'block';

  // Ensure data is sorted by bulletin date ascending
  fullData.sort((a,b) => new Date(a.bulletin_date) - new Date(b.bulletin_date));

  updateChart();
}

function updateChart() {
  const selectedCountry = document.getElementById('countrySelect').value;
  const selectedTable = document.getElementById('tableSelect').value;
  const yAxisMetric = document.getElementById('yAxisSelect').value;
  
  const checkboxes = document.querySelectorAll('#categoryCheckboxes input:checked');
  const selectedCats = Array.from(checkboxes).map(cb => cb.value);

  const datasets = [];
  
  selectedCats.forEach((uiCat, idx) => {
      // Find all raw categories that map to this uiCat
      const rawCategories = Object.keys(categoryMap).filter(k => categoryMap[k] === uiCat);
      
      let dataPoints = [];
      let actualRawCategory = rawCategories[0];

      for (let rawCat of rawCategories) {
          const history = fullData.filter(d => d.normalized_country === selectedCountry && d.category === rawCat && d.table_type === selectedTable);
          if (history.length > 0) {
              actualRawCategory = rawCat;
              history.forEach(row => {
                  if (row.is_current === "1" || row.is_unavailable === "1") return;
                  const bd = new Date(row.bulletin_date).getTime();
                  const pd = new Date(row.priority_date).getTime();
                  if (!isNaN(pd)) {
                      let yVal = pd;
                      if (yAxisMetric === 'wait_time') {
                          yVal = (bd - pd) / (1000 * 60 * 60 * 24 * 365.25);
                      }
                      dataPoints.push({
                          x: bd,
                          y: yVal
                      });
                  }
              });
              break; // Found one that has data, stop looking
          }
      }

      datasets.push({
          label: `${uiCat} (Historical)`,
          data: dataPoints,
          borderColor: chartColors[idx % chartColors.length],
          backgroundColor: chartColors[idx % chartColors.length],
          fill: false,
          tension: 0.2,
          pointRadius: 2,
          pointHoverRadius: 5
      });

      // Get predictions
      if (window.predictFutureCutoff) {
          const predictions = window.predictFutureCutoff(fullData, selectedTable, actualRawCategory, selectedCountry, 12);
          if (predictions && predictions.length > 0) {
              const projPoints = [];
              if (dataPoints.length > 0) projPoints.push(dataPoints[dataPoints.length - 1]);
              
              predictions.forEach(p => {
                  const p_bd = new Date(p.bulletin_date).getTime();
                  const p_pd = p.priority_date;
                  let yVal = p_pd;
                  if (yAxisMetric === 'wait_time') {
                      yVal = (p_bd - p_pd) / (1000 * 60 * 60 * 24 * 365.25);
                  }
                  projPoints.push({
                      x: p_bd,
                      y: yVal
                  });
              });

              datasets.push({
                  label: `${uiCat} (Projected)`,
                  data: projPoints,
                  borderColor: chartColors[idx % chartColors.length],
                  backgroundColor: 'transparent',
                  borderDash: [5, 5],
                  fill: false,
                  tension: 0.2,
                  pointRadius: 3,
                  pointStyle: 'circle'
              });
          }
      }
  });

  renderChart(datasets, yAxisMetric);
}

function renderChart(datasets, yAxisMetric) {
    const isWaitTime = yAxisMetric === 'wait_time';
    const ctx = document.getElementById('pdChart').getContext('2d');
    
    if (chartInstance) {
        chartInstance.destroy();
    }

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: { datasets: datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            color: '#f8fafc',
            interaction: {
                mode: 'index',
                intersect: false,
            },
            scales: {
                x: {
                    type: 'time',
                    time: { unit: 'month' },
                    title: { display: true, text: 'Bulletin Date', color: '#94a3b8' },
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    ticks: { color: '#94a3b8' }
                },
                y: {
                    type: isWaitTime ? 'linear' : 'time',
                    time: isWaitTime ? undefined : { unit: 'month' },
                    title: { display: true, text: isWaitTime ? 'Wait Time (Years)' : 'Priority Date', color: '#94a3b8' },
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    ticks: { color: '#94a3b8' }
                }
            },
            plugins: {
                legend: {
                    labels: { color: '#f8fafc' }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleColor: '#fff',
                    bodyColor: '#cbd5e1',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.y !== null) {
                                if (isWaitTime) {
                                    label += context.parsed.y.toFixed(2) + ' Years';
                                } else {
                                    label += new Date(context.parsed.y).toISOString().split('T')[0];
                                }
                            }
                            return label;
                        }
                    }
                },
                zoom: {
                    pan: {
                        enabled: true,
                        mode: 'x', // Allow pan without shift key, just drag
                    },
                    zoom: {
                        wheel: {
                            enabled: true,
                            speed: 0.1
                        },
                        pinch: {
                            enabled: true
                        },
                        mode: 'x'
                    }
                }
            }
        }
    });
}

// Ensure chart resets zoom on double click
document.getElementById('pdChart').addEventListener('dblclick', () => {
    if (chartInstance) chartInstance.resetZoom();
});

// Init
window.onload = loadData;
