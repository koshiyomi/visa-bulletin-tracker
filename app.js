// app.js

let fullData = [];
let countries = [];
let chartInstance = null;

const chartColors = [
    '#8b5cf6', '#06b6d4', '#f43f5e', '#f59e0b', '#10b981', '#FF9100'
];

const i18n = {
    en: {
        title: "Visa Bulletin Tracker",
        subtitle: "Predicting Priority Dates with Historical Data",
        filters: "Filters",
        country: "Country of Origin",
        table_type: "Table Type",
        table_a: "Final Action (Table A)",
        table_b: "Dates for Filing (Table B)",
        y_axis: "Y-Axis Metric",
        y_pd: "Priority Date",
        y_wait: "Wait Time (Years)",
        visa_categories: "Visa Categories",
        chart_title: "Priority Date Movement",
        chart_subtitle: "Drag to Pan • Scroll to Zoom • Double Click to Reset",
        faq_title: "Frequently Asked Questions",
        latest_bulletin: "Latest Bulletin",
        faq_1_q: "What is a Priority Date?",
        faq_1_a: "Your \"place in line.\" It's the date the government received your immigration petition (e.g., I-130 or I-140/PERM). You must wait until your priority date is \"current\" to apply for a Green Card.",
        faq_2_q: "Final Action (Table A) vs Filing (Table B)?",
        faq_2_a: "<strong>Table A</strong> dictates when an actual Green Card can be approved and issued. <strong>Table B</strong> dictates when you are allowed to submit your I-485 application (if USCIS accepts Table B for that month).",
        faq_3_q: "What is Retrogression?",
        faq_3_a: "Sometimes the demand for visas exceeds the annual supply limit. When this happens, the government moves the cut-off dates backward (retrogresses) to slow down applications.",
        faq_4_q: "What do \"C\" and \"U\" mean?",
        faq_4_a: "<strong>C (Current)</strong>: There is no backlog. Anyone in this category can apply immediately.<br><strong>U (Unavailable)</strong>: No visas are available right now, usually because the annual cap has been hit.",
        faq_5_q: "How are India and China predicted differently?",
        faq_5_a: "The prediction model applies a 100% economic multiplier to India (due to high volume in tech/H1B), but only a 25% spillover effect for China and Rest of World. Category spreads (e.g., EB-2 vs EB-3) also dynamically influence upgrade/downgrade speeds.",
        countries: {
            "All Chargeability Areas": "All Chargeability Areas",
            "China": "China",
            "Dominican Republic": "Dominican Republic",
            "El Salvador/Guatemala/Honduras": "El Salvador/Guatemala/Honduras",
            "India": "India",
            "Mexico": "Mexico",
            "Philippines": "Philippines",
            "Unknown": "Unknown",
            "Vietnam": "Vietnam"
        }
    },
    zh: {
        title: "排期预测追踪",
        subtitle: "基于历史数据的优先日排期预测",
        filters: "筛选器",
        country: "出生地国家",
        table_type: "排期表类型",
        table_a: "最终裁定日 (表 A)",
        table_b: "递交申请日 (表 B)",
        y_axis: "Y轴指标",
        y_pd: "优先日 (Priority Date)",
        y_wait: "等待时间 (年)",
        visa_categories: "签证类别",
        chart_title: "排期走势与预测",
        chart_subtitle: "拖拽平移 • 滚动缩放 • 双击还原",
        faq_title: "常见问题解答 (FAQ)",
        latest_bulletin: "最新排期表",
        faq_1_q: "什么是优先日 (Priority Date)？",
        faq_1_a: "你的“排队号”。这是移民局收到你的移民申请（如 I-130 或 I-140/PERM）的日期。你需要等到你的优先日“排到”（Current）才能申请绿卡。",
        faq_2_q: "表A (Final Action) 和 表B (Filing) 的区别？",
        faq_2_a: "<strong>表 A</strong> 决定了你的绿卡何时能被批准和签发。<strong>表 B</strong> 决定了你何时可以递交 I-485 身份转换申请（前提是当月 USCIS 宣布启用表 B）。",
        faq_3_q: "什么是排期倒退 (Retrogression)？",
        faq_3_a: "有时候签证需求量会远超年度供应上限。当这种情况发生时，政府会将截止日期向后推（倒退）以减缓申请速度。",
        faq_4_q: "\"C\" 和 \"U\" 分别代表什么？",
        faq_4_a: "<strong>C (Current/当前)</strong>: 表示没有积压，目前不需要排期，任何人都可以立刻申请。<br><strong>U (Unavailable/不可用)</strong>: 目前没有可用的签证名额，通常是因为年度配额已经用尽。",
        faq_5_q: "模型如何分别预测中国和印度的排期？",
        faq_5_a: "预测模型对印度应用了 100% 的经济乘数（受宏观科技裁员/扩招严重影响），但对中国大陆和全球其他地区仅产生 25% 的溢出影响。此外，模型还会根据各类别排期差（例如 EB-2 相比 EB-3 的差距）动态计算降级和升级带来的分流加速效应。",
        countries: {
            "All Chargeability Areas": "全球 (除特定国家外)",
            "China": "中国大陆",
            "Dominican Republic": "多米尼加共和国",
            "El Salvador/Guatemala/Honduras": "萨尔瓦多/危地马拉/洪都拉斯",
            "India": "印度",
            "Mexico": "墨西哥",
            "Philippines": "菲律宾",
            "Unknown": "未知",
            "Vietnam": "越南"
        }
    }
};
let currentLang = localStorage.getItem('lang') || 'en';

const updateLanguage = () => {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (i18n[currentLang][key]) {
            el.innerHTML = i18n[currentLang][key]; // Using innerHTML to support <strong> tags in FAQ
        }
    });
    
    document.querySelectorAll('[data-i18n-country]').forEach(el => {
        const key = el.getAttribute('data-i18n-country');
        if (i18n[currentLang].countries && i18n[currentLang].countries[key]) {
            el.textContent = i18n[currentLang].countries[key];
        } else {
            el.textContent = key;
        }
    });
};

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

let macroFactors = null;

/**
 * Fetches and parses the CSV data file using PapaParse.
 */
const loadData = async () => {
  try {
      const macroResp = await fetch('data/macro.json');
      if (macroResp.ok) {
          macroFactors = await macroResp.json();
      }
  } catch (e) {
      console.warn("Failed to load macro factors", e);
  }

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
 * Saves UI filter state to localStorage
 */
const saveState = () => {
    const selectedCountry = document.getElementById('countrySelect').value;
    const selectedTable = document.getElementById('tableSelect').value;
    const yAxisMetric = document.getElementById('yAxisSelect').value;
    const checkboxes = document.querySelectorAll('#categoryCheckboxes input');
    const selectedCats = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
    
    localStorage.setItem('filters', JSON.stringify({
        country: selectedCountry,
        table: selectedTable,
        yAxis: yAxisMetric,
        categories: selectedCats
    }));
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

  // Load saved state or default
  const savedStateStr = localStorage.getItem('filters');
  const savedState = savedStateStr ? JSON.parse(savedStateStr) : null;

  // Populate Country Dropdown
  const countrySelect = document.getElementById('countrySelect');
  countries.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.setAttribute('data-i18n-country', c);
    opt.textContent = c;
    if (savedState?.country === c) {
        opt.selected = true;
    } else if (!savedState && c === 'China') {
        opt.selected = true; // Default
    }
    countrySelect.appendChild(opt);
  });

  // Load Table and YAxis state
  if (savedState?.table) document.getElementById('tableSelect').value = savedState.table;
  if (savedState?.yAxis) document.getElementById('yAxisSelect').value = savedState.yAxis;

  // Populate Category Checkboxes
  const catDiv = document.getElementById('categoryCheckboxes');
  const defaultCats = savedState?.categories || ['EB-2'];

  simplifiedCategories.forEach((cat) => {
    const label = document.createElement('label');
    label.className = 'checkbox-label';
    if (defaultCats.includes(cat)) label.classList.add('checked');
    
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = cat;
    if (defaultCats.includes(cat)) cb.checked = true;
    
    // Toggle active styling and trigger chart update
    cb.addEventListener('change', (e) => {
        e.target.checked ? label.classList.add('checked') : label.classList.remove('checked');
        saveState();
        updateChart();
    });
    
    label.append(cb, document.createTextNode(cat)); // Modern DOM appending
    catDiv.appendChild(label);
  });

  // Attach global event listeners
  ['countrySelect', 'tableSelect', 'yAxisSelect'].forEach(id => {
      document.getElementById(id).addEventListener('change', () => {
          saveState();
          updateChart();
      });
  });
  
  // Language Toggle Listener
  document.getElementById('langToggle').addEventListener('click', () => {
      currentLang = currentLang === 'en' ? 'zh' : 'en';
      localStorage.setItem('lang', currentLang);
      updateLanguage();
      updateChart(); // Redraw chart to update legend and tooltips
  });

  updateLanguage();

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
              let lastAvailablePd = null;
              
              history.forEach(({ is_current, is_unavailable, bulletin_date, priority_date }) => { // Destructuring
                  const bd = new Date(bulletin_date).getTime();
                  let pd;
                  
                  if (is_unavailable === "1") {
                      if (lastAvailablePd !== null) {
                          pd = lastAvailablePd;
                      } else {
                          dataPoints.push({ x: bd, y: null });
                          return;
                      }
                  } else if (is_current === "1") {
                      pd = bd; // Wait Time = 0
                  } else {
                      pd = new Date(priority_date).getTime();
                  }
                  
                  if (!Number.isNaN(pd)) {
                      lastAvailablePd = pd; // Save for future 'U' entries
                      
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
          const predictions = window.predictFutureCutoff(fullData, selectedTable, actualRawCategory, selectedCountry, 36, macroFactors);
          
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
                  pointStyle: 'circle',
                  segment: {
                      borderColor: ctx => ctx.p0DataIndex >= 12 ? color + '40' : color,
                      borderDash: ctx => [5, 5],
                  },
                  pointBorderColor: ctx => ctx.dataIndex > 12 ? color + '40' : color,
                  pointBackgroundColor: ctx => ctx.dataIndex > 12 ? color + '40' : color,
              });
          }
      }
  });

  // Update Summary Panels
  let latestDate = '';
  const latestStatus = { '1st': '--', '2nd': '--', '3rd': '--' };
  
  const selectedHistory = fullData.filter(d => 
      d.normalized_country === selectedCountry && 
      d.table_type === selectedTable
  );
  
  if (selectedHistory.length > 0) {
      latestDate = selectedHistory[selectedHistory.length - 1].bulletin_date;
      
      // Get all records for this latest bulletin date
      const latestRecords = selectedHistory.filter(d => d.bulletin_date === latestDate);
      
      latestRecords.forEach(d => {
          if (latestStatus[d.category]) {
              if (d.is_current === "1") {
                  latestStatus[d.category] = currentLang === 'en' ? "Current" : "当前 (C)";
              } else if (d.is_unavailable === "1") {
                  latestStatus[d.category] = currentLang === 'en' ? "Unavailable" : "不可用 (U)";
              } else {
                  latestStatus[d.category] = d.priority_date;
              }
          }
      });
  }
  
  document.getElementById('summary-bulletin-date').textContent = latestDate || '--';
  document.getElementById('summary-eb1').textContent = latestStatus['1st'];
  document.getElementById('summary-eb2').textContent = latestStatus['2nd'];
  document.getElementById('summary-eb3').textContent = latestStatus['3rd'];
  
  document.getElementById('summaryPanels').style.display = 'flex';

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
                    labels: { 
                        color: '#f8fafc',
                        filter: function(item, chart) {
                            return !item.text.includes('(Projected)');
                        }
                    }
                },
                tooltip: {
                    filter: function(tooltipItem) {
                        // The 0th index of any Projected dataset is the anchor point shared with the Historical dataset.
                        // We hide it so the tooltip doesn't show duplicate identical entries when hovering over the junction.
                        if (tooltipItem.dataset.label.includes('(Projected)') && tooltipItem.dataIndex === 0) {
                            return false;
                        }
                        return true;
                    },
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
                                    ? `${context.parsed.y.toFixed(2)} ${currentLang === 'en' ? 'Years' : '年'}` // Template literal
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
