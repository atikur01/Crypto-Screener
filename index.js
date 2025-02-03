import express from 'express';
import axios from 'axios';
import { rsi } from 'technicalindicators';

const app = express();
const BINANCE_API_URL = 'https://api.binance.us/api/v3/';

// Serve static files for CSS
app.use(express.static('public'));

// Fetch all USDT trading pairs
async function getUsdtPairs() {
    try {
        const response = await axios.get(`${BINANCE_API_URL}exchangeInfo`);
        return response.data.symbols
            .filter(symbol => symbol.quoteAsset === 'USDT')
            .map(pair => pair.symbol);
    } catch (error) {
        console.error('Error fetching USDT pairs:', error);
        return [];
    }
}

// Fetch candlestick data for a symbol
async function getCandlestickData(pair) {
    try {
        const response = await axios.get(`${BINANCE_API_URL}klines`, {
            params: { symbol: pair, interval: '1d', limit: 1500 },
        });
        return response.data.map(candle => ({
            close: parseFloat(candle[4]), // Closing price
        }));
    } catch (error) {
        console.error(`Error fetching candlestick data for ${pair}:`, error);
        return [];
    }
}

// Fetch 24-hour price change percentage
async function get24HourPriceChange(pair) {
    try {
        const response = await axios.get(`${BINANCE_API_URL}ticker/24hr`, {
            params: { symbol: pair },
        });
        return parseFloat(response.data.priceChangePercent);
    } catch (error) {
        console.error(`Error fetching 24hr price change for ${pair}:`, error);
        return 0;
    }
}

// Calculate RSI
async function calculateRSI(candlesticks) {
    const closes = candlesticks.map(c => c.close);
    return rsi({ period: 14, values: closes }) || [];
}

// Determine RSI status
function getRsiStatus(rsiValue) {
    if (rsiValue > 70) return 'Overbought';
    if (rsiValue < 30) return 'Oversold';
    return '';
}

// Home route
app.get('/', async (req, res) => {
    const usdtPairs = await getUsdtPairs();
    const data = [];

    for (const pair of usdtPairs) {
        const candlesticks = await getCandlestickData(pair);
        if (candlesticks.length < 14) continue; // Skip if insufficient data

        const rsiValues = await calculateRSI(candlesticks);
        const latestRsi = rsiValues[rsiValues.length - 1] || 50; // Default to 50 if undefined
        const rsiStatus = getRsiStatus(latestRsi);

        // Get the latest price
        const latestPrice = candlesticks[candlesticks.length - 1].close;
        const priceChange = await get24HourPriceChange(pair);

        data.push({
            symbol: pair,
            price: `$${latestPrice.toFixed(2)}`,
            priceChange: `${priceChange.toFixed(2)}%`,
            rsi: latestRsi.toFixed(2),
            rsiStatus,
        });
    }

    // Generate dynamic HTML
    let htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Binance USDT Pairs RSI</title>
        <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { text-align: center; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: center; }
            th { background-color: #f4f4f4; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            td.overbought { color: red; font-weight: bold; }
            td.oversold { color: green; font-weight: bold; }
        </style>
    </head>
    <body>
        <h1>Binance USDT Pairs RSI</h1>
        <table>
            <thead>
                <tr>
                    <th>No</th>
                    <th>Symbol</th>
                    <th>Price</th>
                    <th>24 Hour Change</th>
                    <th>RSI</th>
                    <th>RSI Status</th>
                </tr>
            </thead>
            <tbody>
    `;

    // Populate the table
    data.forEach((pair, index) => {
        htmlContent += `
            <tr>
                <td>${index + 1}</td>
                <td>${pair.symbol}</td>
                <td>${pair.price}</td>
                <td>${pair.priceChange}</td>
                <td>${pair.rsi}</td>
                <td class="${pair.rsiStatus === 'Overbought' ? 'overbought' : pair.rsiStatus === 'Oversold' ? 'oversold' : ''}">
                    ${pair.rsiStatus}
                </td>
            </tr>
        `;
    });

    htmlContent += `
            </tbody>
        </table>
    </body>
    </html>
    `;

    res.send(htmlContent);
});

// Start server
const port = 3000;
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
