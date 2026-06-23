import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        await page.goto("http://localhost:8000")
        await page.wait_for_timeout(2000)
        
        result = await page.evaluate('''async () => {
            try {
                const response = await fetch("data/visa_bulletin_all.csv");
                const text = await response.text();
                
                const macroResp = await fetch('data/macro.json');
                let macroFactors = null;
                if (macroResp.ok) {
                    macroFactors = await macroResp.json();
                }

                const lines = text.trim().split("\\n");
                const headers = lines[0].split(",");
                const fullData = lines.slice(1).map(line => {
                    const vals = line.split(",");
                    const obj = {};
                    headers.forEach((h, i) => obj[h] = vals[i]);
                    // Map country
                    if (obj.country === "CHINA - mainland born") obj.normalized_country = "China";
                    else if (obj.country === "INDIA") obj.normalized_country = "India";
                    else if (obj.country === "All_Chargeability_Areas") obj.normalized_country = "ROW";
                    else obj.normalized_country = obj.country;
                    return obj;
                });
                
                fullData.sort((a, b) => new Date(a.bulletin_date) - new Date(b.bulletin_date));
                
                const res = {};
                for (const cat of ['1st', '2nd', '3rd']) {
                    const preds = window.predictFutureCutoff(fullData, 'Final_Action', cat, 'India', 36, macroFactors);
                    if (preds.length > 0) {
                        res[cat] = [
                            preds[11] ? new Date(preds[11].priority_date).toISOString().split('T')[0] : null,
                            preds[23] ? new Date(preds[23].priority_date).toISOString().split('T')[0] : null,
                            preds[35] ? new Date(preds[35].priority_date).toISOString().split('T')[0] : null
                        ];
                    } else {
                        res[cat] = "Empty";
                    }
                }
                return JSON.stringify(res, null, 2);
            } catch (e) {
                return "Error: " + e.message;
            }
        }''')
        print(result)
        
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
