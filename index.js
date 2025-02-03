
import express from 'express';
import axios from 'axios';
import { rsi } from 'technicalindicators';

const app = express();
const BINANCE_API_URL = 'https://api.binance.us/api/v3/';
const port = 5000;

// Temporary storage arrays
let temp1 = [];
let temp2 = [];

// Serve static files
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
            close: parseFloat(candle[4]),
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

// Fetch and update temp1 data
async function updateData() {
    console.log('Updating data...');
    const usdtPairs = await getUsdtPairs();
    const newData = [];

    for (const pair of usdtPairs) {
        const candlesticks = await getCandlestickData(pair);
        if (candlesticks.length < 14) continue;

        const rsiValues = await calculateRSI(candlesticks);
        const latestRsi = rsiValues[rsiValues.length - 1] || 50;
        const rsiStatus = getRsiStatus(latestRsi);

        const latestPrice = candlesticks[candlesticks.length - 1].close;
        const priceChange = await get24HourPriceChange(pair);

        newData.push({
            symbol: pair,
            price: `$${latestPrice.toFixed(2)}`,
            priceChange: `${priceChange.toFixed(2)}%`,
            rsi: latestRsi.toFixed(2),
            rsiStatus,
        });
    }
    temp1 = null;
    temp1 = newData;
    temp2 = null;
    temp2 = [...temp1];
    console.log('Data updated.');
}

// Schedule data updates every 5 minute
setInterval(updateData, 5 * 60000);

// Home route - Serve data from temp2
app.get('/', (req, res) => {
    let htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Crypto Screener</title>
        <!-- Bootstrap CSS -->
        <link href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css" rel="stylesheet">
        <!-- DataTables CSS -->
        <link href="https://cdn.datatables.net/1.10.21/css/dataTables.bootstrap4.min.css" rel="stylesheet">
    </head>
    <body>
        <div class="container mt-4">
            <h1 class="text-center">All USDT Pairs RSI of binance.us</h1>
            <table id="rsiTable" class="table table-striped table-bordered" style="width:100%">
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

    temp2.forEach((pair, index) => {
        htmlContent += `
            <tr>
                <td>${index + 1}</td>
                <td>${pair.symbol}</td>
                <td>${pair.price}</td>
                <td>${pair.priceChange}</td>
                <td>${pair.rsi}</td>
                <td class="${pair.rsiStatus === 'Overbought' ? 'text-danger font-weight-bold' : pair.rsiStatus === 'Oversold' ? 'text-success font-weight-bold' : ''}">
                    ${pair.rsiStatus}
                </td>
            </tr>
        `;
    });

    htmlContent += `
                </tbody>
            </table>
        </div>

        <!-- jQuery and Bootstrap JS -->
        <script src="https://code.jquery.com/jquery-3.5.1.min.js"></script>
        <script src="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/js/bootstrap.min.js"></script>
        <!-- DataTables JS -->
        <script src="https://cdn.datatables.net/1.10.21/js/jquery.dataTables.min.js"></script>
        <script src="https://cdn.datatables.net/1.10.21/js/dataTables.bootstrap4.min.js"></script>
        <script>
            $(document).ready(function() {
                $('#rsiTable').DataTable({
                    "paging": true,  // Enable pagination for large datasets
                    "searching": true, // Enable searching
                    "lengthChange": false, // Disable length change (optional)
                });
            });
        </script>
    </body>
    </html>
    `;

    res.send(htmlContent);
});


// Start server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
    updateData(); // Initial data fetch on startup
});