const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
const PORT = 3001;
const users = [{username: 'Oygul', password: 'Urolbek', token: 'good'}];

// Constants
const TELEGRAM_BOT_TOKEN = '7974694691:AAF1y-6CFKpzhiU0sDT4btgc5yy7eL_i93g'; // Replace with your bot token
const STAFF_CHAT_ID = '738443605'; // Replace with the staff chat ID

// Static Files
app.use('/files', express.static('files'));

// Middleware
const allowedOrigins = [
    'http://localhost:3000',
    'https://oyguls-food.netlify.app', // Production frontend
];

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or Postman)
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(bodyParser.json());

// File Upload Configuration
const upload = multer({
    dest: 'uploads/', // Ensure this directory exists
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (!['.jpg', '.jpeg', '.png'].includes(ext)) {
            return cb(new Error('Only images are allowed'));
        }
        cb(null, true);
    },
});

// Routes
app.post('/api/login', (req, res) => {
    if (!req.body || !req.body.username || !req.body.password) {
        return res.status(400).json({message: 'Username and password are required'});
    }

    const {username, password} = req.body;
    const user = users.find(u => u.username === username && u.password === password);

    if (user) {
        res.json({token: user.token});
    } else {
        res.status(401).json({message: 'Invalid username or password'});
    }
});

// Meals API Example
app.get('/api/meals/:type', (req, res) => {
    const {type} = req.params;
    const meals = {
        breakfast: [
            {
                id: 1,
                name: 'Блинчики с Нутеллой и клубникой',
                description: 'Блинчики с Нутеллой и свежей клубникой.',
                price: 1,
                imageUrl: '/files/breakfast1.webp'
            },
            {
                id: 2,
                name: 'Вафли Джиотто',
                description: 'Вафли с Нутеллой, клубникой и бананом.',
                price: 1,
                imageUrl: '/files/breakfast2.jpg'
            }
        ],
        lunch: [
            {
                id: 1,
                name: 'Куриная перзола (Диван)',
                description: 'Куриная перзола, приготовленная в стиле Диван.',
                price: 1,
                imageUrl: '/files/lunch1.jpeg'
            },
            {
                id: 2,
                name: 'Донер (Донерджи Хамди Уста)',
                description: 'Классический турецкий донер.',
                price: 1,
                imageUrl: '/files/lunch2.jpg'
            },
            {
                id: 3,
                name: 'Сэндвич с курицей (Сафия)',
                description: 'Сэндвич с курицей от Сафии.',
                price: 1,
                imageUrl: '/files/lunch3.jpg'
            }
        ],
        dinner: [
            {
                id: 1,
                name: 'Турецкая баклава',
                description: 'Аутентичная турецкая баклава.',
                price: 1,
                imageUrl: '/files/dinner1.jpeg'
            },
            {
                id: 2,
                name: 'Блинчики с Нутеллой и клубникой',
                description: 'Блинчики с Нутеллой и свежей клубникой.',
                price: 1,
                imageUrl: '/files/breakfast1.webp'
            }
        ]
    };


    const mealData = meals[type];
    if (mealData) {
        res.json(mealData);
    } else {
        res.status(404).json({message: 'Meal type not found'});
    }
});

// Special Order Endpoint
app.post('/api/special-order', async (req, res) => {
    try {
        const {foodName, description, link} = req.body;

        // Validate required fields
        if (!foodName || !description) {
            return res.status(400).json({message: 'Food name and description are required'});
        }

        const specialOrder = {
            foodName,
            description,
            link: link || null,
        };

        console.log('Special Order Received:', specialOrder);

        // Telegram notification message
        const telegramMessage = `
📢 *New Special Order Received*:
🍴 *Food Name*: ${foodName}
📝 *Description*: ${description}
🔗 *Link*: ${link || 'No link provided'}
        `;

        const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

        // Send plain text message to Telegram
        const response = await fetch(`${telegramUrl}/sendMessage`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                chat_id: STAFF_CHAT_ID,
                text: telegramMessage,
                parse_mode: 'Markdown',
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Failed to send Telegram message:', response.status, response.statusText, errorText);
            return res.status(500).json({message: 'Failed to notify Telegram'});
        }

        console.log('Notification sent to staff via Telegram');
        res.status(200).json({message: 'Special order submitted successfully', order: specialOrder});
    } catch (error) {
        console.error('Error handling special order:', error);
        res.status(500).json({message: 'Internal server error'});
    }
});
// Checkout Endpoint
app.post('/api/checkout', async (req, res) => {
    const {basket} = req.body;

    if (!basket || !basket.length) {
        return res.status(400).json({message: 'Basket is empty'});
    }

    // Calculate total price
    const total = basket.reduce((sum, item) => {
        return (
            sum +
            item.meals.reduce((mealSum, meal) => {
                return mealSum + (meal.price || 0) * (meal.quantity || 0);
            }, 0)
        );
    }, 0).toFixed(2);

    // Prepare order summary
    const orderSummary = basket
        .map(item => {
            const meals = item.meals.map(meal => `${meal.name} x ${meal.quantity}`).join(', ');
            return `🍴 *${item.mealType}*: ${meals}`;
        })
        .join('\n');

    const telegramMessage = `
📢 *New Checkout Order*:
${orderSummary}
💰 *Total*: $${total}
    `;

    try {
        const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                chat_id: STAFF_CHAT_ID,
                text: telegramMessage,
                parse_mode: 'Markdown',
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Failed to send Telegram message:', response.status, response.statusText, errorText);
            return res.status(500).json({message: 'Failed to notify Telegram'});
        }

        console.log('Checkout notification sent to Telegram');
        res.status(200).json({message: 'Checkout successful', total});
    } catch (error) {
        console.error('Failed to send checkout notification:', error);
        res.status(500).json({message: 'Failed to notify Telegram'});
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
