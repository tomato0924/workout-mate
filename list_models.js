const fs = require('fs');
const path = require('path');
const https = require('https');

const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const match = envContent.match(/GEMINI_API_KEY=(.+)/);

if (!match) {
    console.error('GEMINI_API_KEY not found in .env.local');
    process.exit(1);
}

const apiKey = match[1].trim();

const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            if (json.models) {
                console.log('Available Models:');
                json.models.forEach(model => console.log(model.name));
            } else {
                console.log('Error or no models found:', json);
            }
        } catch (e) {
            console.error('Error parsing JSON:', e);
            console.log('Raw response:', data);
        }
    });
}).on('error', (e) => {
    console.error('Request error:', e);
});
