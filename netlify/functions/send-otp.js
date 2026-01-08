// Netlify Function: Send OTP via Semaphore
// Endpoint: /.netlify/functions/send-otp

const https = require('https');

// In-memory OTP storage (for production, use Redis or database)
// This works for Netlify Functions but OTPs expire when function cold starts
// For demo purposes, we'll use a simple approach

exports.handler = async (event, context) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { mobile, name } = JSON.parse(event.body);

    // Validate mobile number (Philippine format)
    if (!mobile || !/^(09|\+639)\d{9}$/.test(mobile.replace(/\s/g, ''))) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid mobile number. Use format: 09XXXXXXXXX' })
      };
    }

    // Normalize mobile number to 09XXXXXXXXX format
    let normalizedMobile = mobile.replace(/\s/g, '');
    if (normalizedMobile.startsWith('+63')) {
      normalizedMobile = '0' + normalizedMobile.slice(3);
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store OTP with expiry (5 minutes)
    const otpData = {
      otp: otp,
      mobile: normalizedMobile,
      name: name || 'Customer',
      createdAt: Date.now(),
      expiresAt: Date.now() + (5 * 60 * 1000) // 5 minutes
    };

    // Send SMS via Semaphore
    const apiKey = process.env.SEMAPHORE_API_KEY;
    
    if (!apiKey) {
      console.error('SEMAPHORE_API_KEY not configured');
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'SMS service not configured' })
      };
    }

    const message = `Your Marga Enterprises verification code is: ${otp}. Valid for 5 minutes. Do not share this code.`;
    
    const smsResult = await sendSMS(apiKey, normalizedMobile, message);

    if (smsResult.success) {
      // Return OTP hash for verification (not the actual OTP!)
      // In production, store in database. For now, we encode it.
      const otpToken = Buffer.from(JSON.stringify(otpData)).toString('base64');
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ 
          success: true, 
          message: 'OTP sent successfully',
          token: otpToken, // Frontend stores this temporarily
          expiresIn: 300 // 5 minutes in seconds
        })
      };
    } else {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to send SMS', details: smsResult.error })
      };
    }

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};

// Send SMS via Semaphore API
function sendSMS(apiKey, mobile, message) {
  return new Promise((resolve, reject) => {
    const postData = new URLSearchParams({
      apikey: apiKey,
      number: mobile,
      message: message,
      sendername: 'MARGA' // You can customize this in Semaphore dashboard
    }).toString();

    const options = {
      hostname: 'api.semaphore.co',
      port: 443,
      path: '/api/v4/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (res.statusCode === 200 && response) {
            resolve({ success: true, response });
          } else {
            resolve({ success: false, error: response });
          }
        } catch (e) {
          resolve({ success: false, error: data });
        }
      });
    });

    req.on('error', (error) => {
      resolve({ success: false, error: error.message });
    });

    req.write(postData);
    req.end();
  });
}
