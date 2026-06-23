// app.js

let fullData = [];
let countries = [];
let chartInstance = null;

Chart.defaults.font.family = "'Outfit', sans-serif";
Chart.defaults.color = "#94a3b8";

const chartColors = [
    '#8b5cf6', '#06b6d4', '#f43f5e', '#f59e0b', '#10b981', '#3b82f6'
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
        chart_subtitle_mobile: "Swipe to Pan • Pinch to Zoom • Double Tap to Reset",
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
        chart_subtitle_mobile: "滑动平移 • 双指缩放 • 双击还原",
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
    },
    "zh-TW": {
        title: "排期預測追蹤",
        subtitle: "基於歷史數據的優先日排期預測",
        filters: "篩選器",
        country: "出生地國家",
        table_type: "排期表類型",
        table_a: "最終裁定日 (表 A)",
        table_b: "遞交申請日 (表 B)",
        y_axis: "Y軸指標",
        y_pd: "優先日 (Priority Date)",
        y_wait: "等待時間 (年)",
        visa_categories: "簽證類別",
        chart_title: "排期走勢與預測",
        chart_subtitle: "拖拽平移 • 滾動縮放 • 雙擊還原",
        chart_subtitle_mobile: "滑動平移 • 雙指縮放 • 雙擊還原",
        faq_title: "常見問題解答 (FAQ)",
        latest_bulletin: "最新排期表",
        faq_1_q: "什麼是優先日 (Priority Date)？",
        faq_1_a: "你的“排隊號”。這是移民局收到你的移民申請（如 I-130 或 I-140/PERM）的日期。你需要等到你的優先日“排到”（Current）才能申請綠卡。",
        faq_2_q: "表A (Final Action) 和 表B (Filing) 的區別？",
        faq_2_a: "<strong>表 A</strong> 決定了你的綠卡何時能被批准和簽發。<strong>表 B</strong> 決定了你何時可以遞交 I-485 身份轉換申請（前提是當月 USCIS 宣佈啟用表 B）。",
        faq_3_q: "什麼是排期倒退 (Retrogression)？",
        faq_3_a: "有時候簽證需求量會遠超年度供應上限。當這種情況發生時，政府會將截止日期向後推（倒退）以減緩申請速度。",
        faq_4_q: "\"C\" 和 \"U\" 分別代表什麼？",
        faq_4_a: "<strong>C (Current/當前)</strong>: 表示沒有積壓，目前不需要排期，任何人都可以立刻申請。<br><strong>U (Unavailable/不可用)</strong>: 目前沒有可用的簽證名額，通常是因為年度配額已經用盡。",
        faq_5_q: "模型如何分別預測中國和印度的排期？",
        faq_5_a: "預測模型對印度應用了 100% 的經濟乘數（受宏觀科技裁員/擴招嚴重影響），但對中國大陸和全球其他地區僅產生 25% 的溢出影響。此外，模型還會根據各類別排期差（例如 EB-2 相比 EB-3 的差距）動態計算降級和升級帶來的分流加速效應。",
        countries: {
            "All Chargeability Areas": "全球 (除特定國家外)",
            "China": "中國大陸",
            "Dominican Republic": "多明尼加共和國",
            "El Salvador/Guatemala/Honduras": "薩爾瓦多/危地馬拉/洪都拉斯",
            "India": "印度",
            "Mexico": "墨西哥",
            "Philippines": "菲律賓",
            "Unknown": "未知",
            "Vietnam": "越南"
        }
    },
    es: {
        title: "Rastreador de Boletín de Visas",
        subtitle: "Predicción de Fechas de Prioridad con Datos Históricos",
        filters: "Filtros",
        country: "País de Origen",
        table_type: "Tipo de Tabla",
        table_a: "Acción Final (Tabla A)",
        table_b: "Fechas para Presentación (Tabla B)",
        y_axis: "Métrica del Eje Y",
        y_pd: "Fecha de Prioridad",
        y_wait: "Tiempo de Espera (Años)",
        visa_categories: "Categorías de Visas",
        chart_title: "Movimiento de Fecha de Prioridad",
        chart_subtitle: "Arrastra para desplazar • Desplaza para hacer zoom • Doble clic para reiniciar",
        chart_subtitle_mobile: "Desliza para desplazar • Pellizca para hacer zoom • Doble toque para reiniciar",
        faq_title: "Preguntas Frecuentes",
        latest_bulletin: "Último Boletín",
        faq_1_q: "¿Qué es una Fecha de Prioridad?",
        faq_1_a: "Tu \"lugar en la fila\". Es la fecha en que el gobierno recibió tu petición de inmigración (ej. I-130 o I-140/PERM). Debes esperar hasta que tu fecha de prioridad esté \"vigente\" (Current) para solicitar una Tarjeta Verde.",
        faq_2_q: "¿Acción Final (Tabla A) vs Presentación (Tabla B)?",
        faq_2_a: "<strong>Tabla A</strong> dicta cuándo se puede aprobar y emitir una Tarjeta Verde real. <strong>Tabla B</strong> dicta cuándo puedes enviar tu solicitud I-485 (si USCIS acepta la Tabla B ese mes).",
        faq_3_q: "¿Qué es el Retroceso?",
        faq_3_a: "A veces la demanda de visas excede el límite de suministro anual. Cuando esto sucede, el gobierno retrasa las fechas límite (retrocede) para ralentizar las solicitudes.",
        faq_4_q: "¿Qué significan \"C\" y \"U\"?",
        faq_4_a: "<strong>C (Vigente/Current)</strong>: No hay retraso. Cualquiera en esta categoría puede aplicar de inmediato.<br><strong>U (No Disponible)</strong>: No hay visas disponibles en este momento, generalmente porque se ha alcanzado el límite anual.",
        faq_5_q: "¿Cómo se predicen de manera diferente India y China?",
        faq_5_a: "El modelo de predicción aplica un multiplicador económico del 100% a India (debido al alto volumen en tecnología/H1B), pero solo un efecto de derrame del 25% para China y el Resto del Mundo. Los márgenes entre categorías (ej. EB-2 vs EB-3) también influyen dinámicamente en las velocidades de actualización/degradación.",
        countries: {
            "All Chargeability Areas": "Áreas de Carga Global",
            "China": "China",
            "Dominican Republic": "República Dominicana",
            "El Salvador/Guatemala/Honduras": "El Salvador/Guatemala/Honduras",
            "India": "India",
            "Mexico": "México",
            "Philippines": "Filipinas",
            "Unknown": "Desconocido",
            "Vietnam": "Vietnam"
        }
    },
    vi: {
        title: "Trình theo dõi Visa Bulletin",
        subtitle: "Dự đoán ngày ưu tiên với dữ liệu lịch sử",
        filters: "Bộ lọc",
        country: "Quốc gia Xuất xứ",
        table_type: "Loại Bảng",
        table_a: "Hành động Cuối cùng (Bảng A)",
        table_b: "Ngày Nộp đơn (Bảng B)",
        y_axis: "Chỉ số Trục Y",
        y_pd: "Ngày Ưu tiên",
        y_wait: "Thời gian chờ (Năm)",
        visa_categories: "Hạng mục Visa",
        chart_title: "Biến động Ngày Ưu tiên",
        chart_subtitle: "Kéo để di chuyển • Cuộn để thu phóng • Nhấp đúp để đặt lại",
        chart_subtitle_mobile: "Vuốt để di chuyển • Chụm để thu phóng • Chạm đúp để đặt lại",
        faq_title: "Câu hỏi Thường gặp",
        latest_bulletin: "Bản tin Mới nhất",
        faq_1_q: "Ngày Ưu tiên là gì?",
        faq_1_a: "\"Vị trí xếp hàng\" của bạn. Đó là ngày chính phủ nhận được đơn xin nhập cư của bạn (ví dụ: I-130 hoặc I-140/PERM). Bạn phải đợi cho đến khi ngày ưu tiên của bạn \"đáo hạn\" (Current) để xin Thẻ Xanh.",
        faq_2_q: "Hành động Cuối cùng (Bảng A) và Nộp đơn (Bảng B)?",
        faq_2_a: "<strong>Bảng A</strong> quy định thời điểm một Thẻ Xanh thực tế có thể được phê duyệt và cấp. <strong>Bảng B</strong> quy định thời điểm bạn được phép nộp đơn I-485 (nếu USCIS chấp nhận Bảng B cho tháng đó).",
        faq_3_q: "Thụt lùi (Retrogression) là gì?",
        faq_3_a: "Đôi khi nhu cầu về thị thực vượt quá giới hạn cung cấp hàng năm. Khi điều này xảy ra, chính phủ lùi lại ngày giới hạn (thụt lùi) để làm chậm quá trình nộp đơn.",
        faq_4_q: "\"C\" và \"U\" nghĩa là gì?",
        faq_4_a: "<strong>C (Hiện tại/Current)</strong>: Không có tồn đọng. Bất kỳ ai trong hạng mục này đều có thể đăng ký ngay lập tức.<br><strong>U (Không có sẵn)</strong>: Hiện tại không có thị thực nào, thường là do đã đạt đến giới hạn hàng năm.",
        faq_5_q: "Ấn Độ và Trung Quốc được dự đoán khác nhau như thế nào?",
        faq_5_a: "Mô hình dự đoán áp dụng hệ số nhân kinh tế 100% cho Ấn Độ (do số lượng lớn trong lĩnh vực công nghệ/H1B), nhưng chỉ có tác động lan tỏa 25% đối với Trung Quốc và Phần còn lại của Thế giới. Khoảng cách giữa các hạng mục (ví dụ: EB-2 so với EB-3) cũng ảnh hưởng linh hoạt đến tốc độ chuyển đổi hồ sơ.",
        countries: {
            "All Chargeability Areas": "Tất cả các khu vực",
            "China": "Trung Quốc",
            "Dominican Republic": "Cộng hòa Dominica",
            "El Salvador/Guatemala/Honduras": "El Salvador/Guatemala/Honduras",
            "India": "Ấn Độ",
            "Mexico": "Mexico",
            "Philippines": "Philippines",
            "Unknown": "Không xác định",
            "Vietnam": "Việt Nam"
        }
    },
    hi: {
        title: "वीज़ा बुलेटिन ट्रैकर",
        subtitle: "ऐतिहासिक डेटा के साथ प्राथमिकता तिथियों की भविष्यवाणी",
        filters: "फ़िल्टर",
        country: "मूल देश",
        table_type: "तालिका प्रकार",
        table_a: "अंतिम कार्रवाई (तालिका A)",
        table_b: "दाखिल करने की तिथियां (तालिका B)",
        y_axis: "Y-अक्ष मीट्रिक",
        y_pd: "प्राथमिकता तिथि (Priority Date)",
        y_wait: "प्रतीक्षा समय (वर्ष)",
        visa_categories: "वीज़ा श्रेणियां",
        chart_title: "प्राथमिकता तिथि संचलन",
        chart_subtitle: "पैन करने के लिए खींचें • ज़ूम करने के लिए स्क्रॉल करें • रीसेट करने के लिए डबल क्लिक करें",
        chart_subtitle_mobile: "पैन करने के लिए स्वाइप करें • ज़ूम करने के लिए पिंच करें • रीसेट करने के लिए डबल टैप करें",
        faq_title: "अक्सर पूछे जाने वाले प्रश्न",
        latest_bulletin: "नवीनतम बुलेटिन",
        faq_1_q: "प्राथमिकता तिथि (Priority Date) क्या है?",
        faq_1_a: "लाइन में आपका \"स्थान\"। यह वह तिथि है जब सरकार को आपकी आप्रवास याचिका (उदा., I-130 या I-140/PERM) प्राप्त हुई थी। आपको ग्रीन कार्ड के लिए आवेदन करने के लिए अपनी प्राथमिकता तिथि के \"वर्तमान\" (Current) होने तक प्रतीक्षा करनी होगी।",
        faq_2_q: "अंतिम कार्रवाई (तालिका A) बनाम दाखिल करना (तालिका B)?",
        faq_2_a: "<strong>तालिका A</strong> यह निर्धारित करती है कि वास्तविक ग्रीन कार्ड कब स्वीकृत और जारी किया जा सकता है। <strong>तालिका B</strong> यह निर्धारित करती है कि आपको अपना I-485 आवेदन कब जमा करने की अनुमति है (यदि USCIS उस महीने के लिए तालिका B स्वीकार करता है)।",
        faq_3_q: "प्रतिगमन (Retrogression) क्या है?",
        faq_3_a: "कभी-कभी वीज़ा की मांग वार्षिक आपूर्ति सीमा से अधिक हो जाती है। जब ऐसा होता है, तो सरकार आवेदनों को धीमा करने के लिए कट-ऑफ तिथियों को पीछे (प्रतिगामी) ले जाती है।",
        faq_4_q: "\"C\" और \"U\" का क्या अर्थ है?",
        faq_4_a: "<strong>C (वर्तमान/Current)</strong>: कोई बैकलॉग नहीं है। इस श्रेणी का कोई भी व्यक्ति तुरंत आवेदन कर सकता है।<br><strong>U (अनुपलब्ध)</strong>: अभी कोई वीज़ा उपलब्ध नहीं है, आमतौर पर इसलिए क्योंकि वार्षिक सीमा पूरी हो चुकी है।",
        faq_5_q: "भारत और चीन के लिए अलग-अलग भविष्यवाणी कैसे की जाती है?",
        faq_5_a: "भविष्यवाणी मॉडल भारत पर 100% आर्थिक गुणक लागू करता है (तकनीक/H1B में उच्च मात्रा के कारण), लेकिन चीन और शेष विश्व के लिए केवल 25% स्पिलओवर प्रभाव। श्रेणी प्रसार (उदा., EB-2 बनाम EB-3) भी गतिशील रूप से अपग्रेड/डाउनग्रेड गति को प्रभावित करते हैं।",
        countries: {
            "All Chargeability Areas": "शेष विश्व (Rest of World)",
            "China": "चीन",
            "Dominican Republic": "डोमिनिकन गणराज्य",
            "El Salvador/Guatemala/Honduras": "अल साल्वाडोर/ग्वाटेमाला/होंडुरास",
            "India": "भारत",
            "Mexico": "मेक्सिको",
            "Philippines": "फिलीपींस",
            "Unknown": "अज्ञात",
            "Vietnam": "वियतनाम"
        }
    }
};
let currentLang = localStorage.getItem('lang') || 'en';

const updateLanguage = () => {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (i18n[currentLang][key]) {
            if (key === 'chart_subtitle' && window.innerWidth < 768) {
                el.innerHTML = i18n[currentLang]['chart_subtitle_mobile'] || i18n[currentLang][key];
            } else {
                el.innerHTML = i18n[currentLang][key]; // Using innerHTML to support <strong> tags in FAQ
            }
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
    
    // Re-render custom selects to reflect translated text
    initCustomSelects();
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
    label.style.setProperty('--cat-color', chartColors[simplifiedCategories.indexOf(cat) % chartColors.length]);
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
  
  // Language Switcher Logic
  const langContainer = document.getElementById('langSwitcherContainer');
  const langTrigger = document.getElementById('langTrigger');
  const langOptions = document.querySelectorAll('.lang-option');
  
  // Set initial selected state
  langOptions.forEach(opt => {
      if(opt.dataset.val === currentLang) {
          opt.classList.add('selected');
      }
      
      opt.addEventListener('click', (e) => {
          e.stopPropagation();
          langOptions.forEach(o => o.classList.remove('selected'));
          opt.classList.add('selected');
          langContainer.classList.remove('open');
          
          currentLang = opt.dataset.val;
          localStorage.setItem('lang', currentLang);
          updateLanguage();
          updateChart();
      });
  });

  langTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      // Close other selects if any
      document.querySelectorAll('.custom-select-container.open').forEach(c => c.classList.remove('open'));
      langContainer.classList.toggle('open');
  });

  // Make sure clicking outside closes the lang switcher
  document.addEventListener('click', () => {
      langContainer.classList.remove('open');
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
          label: `${uiCat} (Historical)`,
          data: dataPoints,
          borderColor: color,
          backgroundColor: color,
          borderWidth: 2,
          fill: false,
          tension: 0,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointHitRadius: 10
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
                  borderWidth: 2,
                  fill: false,
                  tension: 0,
                  pointRadius: 0,
                  pointHoverRadius: 6,
                  pointHitRadius: 10,
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
                  let lastPd = null;
                  for (let i = selectedHistory.length - 1; i >= 0; i--) {
                      const histRecord = selectedHistory[i];
                      if (histRecord.category === d.category && histRecord.is_unavailable !== "1" && histRecord.is_current !== "1") {
                          lastPd = histRecord.priority_date;
                          break;
                      }
                  }
                  latestStatus[d.category] = lastPd ? `${lastPd} (U)` : (currentLang === 'en' ? "Unavailable" : "不可用 (U)");
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
  
  document.getElementById('summary-bulletin-date').style.color = '#f8fafc';
  document.getElementById('summary-bulletin-date').style.textShadow = '0 0 12px rgba(255,255,255,0.2)';
  document.getElementById('summary-eb1').style.color = chartColors[0];
  document.getElementById('summary-eb1').style.textShadow = `0 0 12px ${chartColors[0]}80`;
  document.getElementById('summary-eb2').style.color = chartColors[1];
  document.getElementById('summary-eb2').style.textShadow = `0 0 12px ${chartColors[1]}80`;
  document.getElementById('summary-eb3').style.color = chartColors[2];
  document.getElementById('summary-eb3').style.textShadow = `0 0 12px ${chartColors[2]}80`;
  
  document.getElementById('summaryPanels').style.display = 'flex';

  renderChart(datasets, yAxisMetric);
};

/**
 * Destroys existing chart and renders a new Chart.js instance.
 * @param {Array} datasets - Chart.js dataset objects
 * @param {string} yAxisMetric - Currently selected y-axis mode
 */

const externalTooltipHandler = (context) => {
    let tooltipEl = document.getElementById('mobileTooltip');
    if (!tooltipEl) return;

    if (window.innerWidth >= 768) {
        tooltipEl.style.display = 'none';
        return;
    }

    const tooltipModel = context.tooltip;

    if (tooltipModel.opacity === 0) {
        tooltipEl.style.opacity = 0;
        return;
    }

    if (tooltipModel.body) {
        const titleLines = tooltipModel.title || [];
        const bodyLines = tooltipModel.body.map(b => b.lines);

        let innerHtml = `<div style="width: 100%; font-weight: 700; color: #f8fafc; margin-bottom: 4px;">${titleLines[0]}</div>`;
        
        bodyLines.forEach((body, i) => {
            const colors = tooltipModel.labelColors[i];
            innerHtml += `<div style="display: flex; align-items: center; background: rgba(255,255,255,0.05); padding: 4px 10px; border-radius: 12px;">
                <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; background: ${colors.backgroundColor};"></span>
                <span style="white-space: nowrap;">${body}</span>
            </div>`;
        });

        tooltipEl.innerHTML = innerHtml;
        tooltipEl.style.display = 'flex';
        tooltipEl.style.opacity = 1;
    }
};

const mobileTooltipManager = {
    id: 'mobileTooltipManager',
    beforeTooltipDraw: (chart) => {
        if (window.innerWidth <= 768) {
            return false; // Prevent default tooltip rendering on mobile
        }
    }
};

const crosshairPlugin = {
    id: 'crosshair',
    afterDraw: chart => {
        if (chart.tooltip?._active && chart.tooltip._active.length) {
            const activePoint = chart.tooltip._active[0];
            const ctx = chart.ctx;
            const x = activePoint.element.x;
            const topY = chart.scales.y.top;
            const bottomY = chart.scales.y.bottom;

            ctx.save();
            ctx.beginPath();
            ctx.moveTo(x, topY);
            ctx.lineTo(x, bottomY);
            ctx.lineWidth = 1;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.setLineDash([5, 5]);
            ctx.stroke();
            ctx.restore();
        }
    }
};

const renderChart = (datasets, yAxisMetric) => {
    const isWaitTime = yAxisMetric === 'wait_time';
    const ctx = document.getElementById('pdChart').getContext('2d');
    
    chartInstance?.destroy(); // Optional chaining for safe cleanup

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: { datasets }, // Object property shorthand
        plugins: [crosshairPlugin],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            color: '#f8fafc',
            interaction: {
                mode: 'x',
                intersect: false,
            },
            scales: {
                x: {
                    type: 'time',
                    time: { unit: 'month', tooltipFormat: 'yyyy-MM-dd' },
                    title: { display: true, text: 'Bulletin Date', color: '#94a3b8' },
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    ticks: { color: '#94a3b8' }
                },
                y: {
                    type: isWaitTime ? 'linear' : 'time',
                    time: isWaitTime ? undefined : { 
                        displayFormats: {
                            month: "MM/yy",
                            quarter: "MM/yy",
                            year: "yy"
                        }
                    },
                    title: { display: window.innerWidth >= 768, text: isWaitTime ? 'Wait Time (Years)' : 'Priority Date', color: '#94a3b8' },
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    ticks: { 
                        color: '#94a3b8', 
                        maxTicksLimit: window.innerWidth <= 768 ? 6 : 10 
                    }
                }
            },
            plugins: {
                legend: {
                    labels: { 
                        color: '#cbd5e1',
                        font: { family: "'Outfit', sans-serif", size: 13, weight: 400 },
                        usePointStyle: true,
                        boxWidth: 8,
                        boxHeight: 8,
                        filter: function(item, chart) {
                            return !item.text.includes('(Projected)');
                        }
                    }
                },
                tooltip: {
                    enabled: window.innerWidth >= 768,
                    external: externalTooltipHandler,
                    backgroundColor: 'rgba(15, 23, 42, 0.85)',
                    titleColor: '#f8fafc',
                    bodyColor: '#cbd5e1',
                    titleFont: { family: "'Outfit', sans-serif", size: 14, weight: 600 },
                    bodyFont: { family: "'Outfit', sans-serif", size: 13, weight: 400 },
                    padding: 12,
                    cornerRadius: 12,
                    displayColors: true,
                    borderColor: 'rgba(255, 255, 255, 0.15)',
                    borderWidth: 1,
                    caretSize: 6,
                    caretPadding: 10,
                    boxPadding: 4,
                    filter: function(tooltipItem, index, tooltipItems) {
                        if (tooltipItem.dataset.label.includes('(Projected)') && tooltipItem.dataIndex === 0) {
                            return false;
                        }
                        
                        // Only keep the first item for each dataset to prevent duplicates when using mode: 'x'
                        const firstIndex = tooltipItems.findIndex(item => item.datasetIndex === tooltipItem.datasetIndex);
                        if (index !== firstIndex) {
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
                        title: (context) => {
                            if (context.length > 0) {
                                const d = new Date(context[0].parsed.x);
                                return d.toISOString().split('T')[0];
                            }
                            return '';
                        },
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
    
    // Re-render custom selects to reflect translated text
    initCustomSelects();
};

// Ensure chart resets zoom on double click
document.getElementById('pdChart').addEventListener('dblclick', () => {
    chartInstance?.resetZoom(); // Optional chaining
});

// Init execution
window.onload = () => {
    loadData();
    window.dispatchEvent(new Event('resize'));
};

window.addEventListener('resize', () => {
    const subtitleEl = document.querySelector('[data-i18n="chart_subtitle"]');
    if (subtitleEl && i18n[currentLang]) {
        subtitleEl.innerHTML = window.innerWidth >= 768 
            ? i18n[currentLang]['chart_subtitle'] 
            : (i18n[currentLang]['chart_subtitle_mobile'] || i18n[currentLang]['chart_subtitle']);
    }
    
    if (chartInstance) {
        const isDesktop = window.innerWidth >= 768;
        chartInstance.options.plugins.tooltip.enabled = isDesktop;
        chartInstance.options.scales.y.title.display = isDesktop;
        chartInstance.options.scales.y.ticks.maxTicksLimit = isDesktop ? 10 : 6;
        
        let tooltipEl = document.getElementById('mobileTooltip');
        if (tooltipEl && isDesktop) {
            tooltipEl.style.display = 'none';
        }
        chartInstance.update('none');
    }
});

// --- Custom Select UI ---
function initCustomSelects() {
    const selects = ['countrySelect', 'tableSelect', 'yAxisSelect'];
    selects.forEach(id => {
        const originalSelect = document.getElementById(id);
        if (!originalSelect) return;
        
        // Remove existing custom container if any
        if (originalSelect.nextElementSibling && originalSelect.nextElementSibling.classList.contains('custom-select-container')) {
            originalSelect.nextElementSibling.remove();
        }

        originalSelect.style.display = 'none';

        const container = document.createElement('div');
        container.className = 'custom-select-container';

        const trigger = document.createElement('div');
        trigger.className = 'custom-select-trigger';
        
        const triggerText = document.createElement('span');
        // Show current selected text
        const selectedOpt = originalSelect.options[originalSelect.selectedIndex];
        triggerText.textContent = selectedOpt ? selectedOpt.text : '';
        trigger.appendChild(triggerText);
        
        container.appendChild(trigger);

        const optionsDiv = document.createElement('div');
        optionsDiv.className = 'custom-select-options';

        Array.from(originalSelect.options).forEach((opt, idx) => {
            const optDiv = document.createElement('div');
            optDiv.className = 'custom-select-option' + (idx === originalSelect.selectedIndex ? ' selected' : '');
            optDiv.textContent = opt.text;
            
            optDiv.addEventListener('click', (e) => {
                e.stopPropagation();
                originalSelect.selectedIndex = idx;
                triggerText.textContent = opt.text;
                
                // Update selected styling
                Array.from(optionsDiv.children).forEach(c => c.classList.remove('selected'));
                optDiv.classList.add('selected');
                
                container.classList.remove('open');
                
                // Trigger change event to run app logic
                originalSelect.dispatchEvent(new Event('change'));
            });
            
            optionsDiv.appendChild(optDiv);
        });

        container.appendChild(optionsDiv);

        // Toggle dropdown
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            // Close other dropdowns
            document.querySelectorAll('.custom-select-container.open').forEach(c => {
                if (c !== container) c.classList.remove('open');
            });
            container.classList.toggle('open');
            
            // Scroll to selected
            if (container.classList.contains('open')) {
                const selectedEl = optionsDiv.querySelector('.selected');
                if (selectedEl) {
                    optionsDiv.scrollTop = selectedEl.offsetTop - optionsDiv.offsetTop - 4;
                }
            }
        });

        originalSelect.parentNode.insertBefore(container, originalSelect.nextSibling);
    });
}

document.addEventListener('click', () => {
    document.querySelectorAll('.custom-select-container.open').forEach(c => {
        c.classList.remove('open');
    });
});
