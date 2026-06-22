// app.js

let fullData = [];
let countries = [];
let chartInstance = null;

const chartColors = [
    '#8b5cf6', '#06b6d4', '#f43f5e', '#f59e0b', '#10b981', '#FF9100'
];

/**
 * Maps raw, granular Visa Bulletin categories to standardized UI groups.
 */
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

// Unique simplified categories to render as filter toggles
const simplifiedCategories = ["EB-1", "EB-2", "EB-3", "EB-3 Other", "EB-4", "EB-5"];

/**
 * Fetches and parses the CSV data file using PapaParse.
 */
const loadData = async () => {
  Papa.parse('data/visa_bulletin_all.csv', {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: ({ data }) => { // Destructuring the results object
      fullData = data;
      processInitialData();
    }
  });
};

/**
 * Cleans and standardizes country names due to inconsistent State Dept. formatting over the years.
 * @param {string} c - Raw country name
 * @returns {string} Normalized country name
 */
const normalizeCountry = (c) => {
    if (!c) return "Unknown";
    // Replace underscores, condense whitespace, and uppercase for robust matching
    const upperC = c.replace(/_/g, " ").replace(/\s+/g, " ").trim().toUpperCase();
    
    if (upperC.includes("ALL") || upperC.includes("CHARGEABILITY") || upperC.includes("EXCEPT") || upperC.includes("CHARGE-")) {
        return "All Chargeability Areas";
    }
    if (upperC.includes("CHINA") || upperC === "CH") return "China";
    if (upperC.includes("INDIA") || upperC === "IN") return "India";
    if (upperC.includes("MEXICO") || upperC === "ME") return "Mexico";
    if (upperC.includes("PHIL") || upperC === "PH") return "Philippines";
    if (upperC.includes("SALVADOR") || upperC.includes("GUATEMALA") || upperC.includes("HONDURAS")) {
        return "El Salvador/Guatemala/Honduras";
    }
    if (upperC.includes("VIETNAM")) return "Vietnam";
    if (upperC.includes("DOMINICAN")) return "Dominican Republic";
    
    // Capitalize first letter as a generic fallback
    return upperC.charAt(0).toUpperCase() + upperC.slice(1).toLowerCase();
};

/**
 * Initializes UI dropdowns, checkboxes, and the initial chart rendering.
 */
const processInitialData = () => {
  const countrySet = new Set();
  
  // Normalize and extract unique countries
  fullData.forEach(row => {
    row.normalized_country = normalizeCountry(row.country);
    countrySet.add(row.normalized_country);
  });

  countries = [...countrySet].sort(); // Spread syntax

  // Populate Country Dropdown
  const countrySelect = document.getElementById('countrySelect');
  countries.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    if (c === 'China') opt.selected = true; // Default selection
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
    if (cat === 'EB-2') cb.checked = true; // Default selection
    
    // Toggle active styling and trigger chart update
    cb.addEventListener('change', (e) => {
        e.target.checked ? label.classList.add('checked') : label.classList.remove('checked');
        updateChart();
    });
    
    label.append(cb, document.createTextNode(cat)); // Modern DOM appending
    catDiv.appendChild(label);
  });

  // Attach global event listeners
  ['countrySelect', 'tableSelect', 'yAxisSelect'].forEach(id => {
      document.getElementById(id).addEventListener('change', updateChart);
  });

  // Swap loader for dashboard
  document.getElementById('loader').style.display = 'none';
  document.getElementById('dashboard').style.display = 'block';

  // Sort global dataset by bulletin date ascending to ensure chronological lines
  fullData.sort((a, b) => new Date(a.bulletin_date) - new Date(b.bulletin_date));

  updateChart();
};

/**
 * Re-filters data based on user input and calls renderChart.
 */
const updateChart = () => {
  const selectedCountry = document.getElementById('countrySelect').value;
  const selectedTable = document.getElementById('tableSelect').value;
  const yAxisMetric = document.getElementById('yAxisSelect').value;
  
  // Query selected categories
  const checkboxes = document.querySelectorAll('#categoryCheckboxes input:checked');
  const selectedCats = Array.from(checkboxes).map(cb => cb.value);

  const datasets = [];
  
  selectedCats.forEach((uiCat, idx) => {
      // Find all raw category strings that belong to this UI group
      const rawCategories = Object.keys(categoryMap).filter(k => categoryMap[k] === uiCat);
      
      const dataPoints = [];
      let actualRawCategory = rawCategories[0]; // Fallback

      // Extract the relevant historical data for the first raw category that actually contains records
      for (const rawCat of rawCategories) {
          const history = fullData.filter(d => 
              d.normalized_country === selectedCountry && 
              d.category === rawCat && 
              d.table_type === selectedTable
          );
          
          if (history.length > 0) {
              actualRawCategory = rawCat; // Save the matched category for the prediction engine
              
              history.forEach(({ is_current, is_unavailable, bulletin_date, priority_date }) => { // Destructuring
                  if (is_current === "1" || is_unavailable === "1") return;
                  
                  const bd = new Date(bulletin_date).getTime();
                  const pd = new Date(priority_date).getTime();
                  
                  if (!Number.isNaN(pd)) {
                      // Calculate wait time in years or use absolute priority date
                      const yVal = yAxisMetric === 'wait_time' 
                        ? (bd - pd) / (1000 * 60 * 60 * 24 * 365.25)
                        : pd;
                        
                      dataPoints.push({ x: bd, y: yVal }); // Object property shorthand
                  }
              });
              break; // Stop looking after finding valid data for this UI category group
          }
      }

      const color = chartColors[idx % chartColors.length];

      datasets.push({
          label: `${uiCat} (Historical)`, // Template literals
          data: dataPoints,
          borderColor: color,
          backgroundColor: color,
          fill: false,
          tension: 0.2,
          pointRadius: 2,
          pointHoverRadius: 5
      });

      // Integrate predictive projections
      if (window.predictFutureCutoff) {
          const predictions = window.predictFutureCutoff(fullData, selectedTable, actualRawCategory, selectedCountry, 12);
          
          if (predictions?.length > 0) { // Optional chaining
              const projPoints = [];
              
              // Anchor the projection to the last known historical point
              if (dataPoints.length > 0) {
                  projPoints.push(dataPoints.at(-1)); // Modern array access
              }
              
              predictions.forEach(({ bulletin_date, priority_date }) => { // Destructuring in loop
                  const p_bd = new Date(bulletin_date).getTime();
                  const yVal = yAxisMetric === 'wait_time'
                      ? (p_bd - priority_date) / (1000 * 60 * 60 * 24 * 365.25)
                      : priority_date;
                      
                  projPoints.push({ x: p_bd, y: yVal });
              });

              datasets.push({
                  label: `${uiCat} (Projected)`,
                  data: projPoints,
                  borderColor: color,
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
};

/**
 * Destroys existing chart and renders a new Chart.js instance.
 * @param {Array} datasets - Chart.js dataset objects
 * @param {string} yAxisMetric - Currently selected y-axis mode
 */
const renderChart = (datasets, yAxisMetric) => {
    const isWaitTime = yAxisMetric === 'wait_time';
    const ctx = document.getElementById('pdChart').getContext('2d');
    
    chartInstance?.destroy(); // Optional chaining for safe cleanup

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: { datasets }, // Object property shorthand
        options: {
            responsive: true,
            maintainAspectRatio: false,
            color: '#f8fafc',
            interaction: {
                mode: 'nearest',
                axis: 'x',
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
                        label: (context) => { // Arrow function
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            
                            if (context.parsed.y !== null) {
                                label += isWaitTime 
                                    ? `${context.parsed.y.toFixed(2)} Years` // Template literal
                                    : new Date(context.parsed.y).toISOString().split('T')[0];
                            }
                            return label;
                        }
                    }
                },
                zoom: {
                    pan: {
                        enabled: true,
                        mode: 'x',
                    },
                    zoom: {
                        wheel: { enabled: true, speed: 0.1 },
                        pinch: { enabled: true },
                        mode: 'x'
                    }
                }
            }
        }
    });
};

// Ensure chart resets zoom on double click
document.getElementById('pdChart').addEventListener('dblclick', () => {
    chartInstance?.resetZoom(); // Optional chaining
});

// Init execution
window.onload = loadData;
