
import http from 'http';

function checkUrl(path) {
    const options = {
        hostname: 'localhost',
        port: 5173,
        path: path,
        method: 'GET'
    };

    console.log(`\nChecking ${path}...`);

    const req = http.request(options, (res) => {
        console.log(`STATUS: ${res.statusCode}`);
        console.log(`Type: ${res.headers['content-type']}`);

        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
            if (res.statusCode !== 200) {
                console.error('FAIL: Status not 200');
            } else if (res.headers['content-type']?.includes('text/plain')) {
                console.error('FAIL: MIME type is text/plain');
                console.log('Body preview:', data.substring(0, 200));
            } else if (data.includes('<!DOCTYPE html>')) {
                console.error('FAIL: Returned HTML (likely fallback index.html) instead of Code');
            } else {
                console.log('SUCCESS: content looks like code.');
            }
        });
    });

    req.on('error', (e) => console.error(`Req Error: ${e.message}`));
    req.end();
}

// Check background (we know this works mostly)
checkUrl('/src/background/index.ts');

// Check popup script as referenced in html
checkUrl('/src/popup/index.tsx');
