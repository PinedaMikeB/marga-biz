// Netlify Function: Verify OTP
// Endpoint: /.netlify/functions/verify-otp

exports.handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { otp, token } = JSON.parse(event.body);

    if (!otp || !token) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'OTP and token are required' })
      };
    }

    // Decode the token to get stored OTP data
    let otpData;
    try {
      otpData = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
    } catch (e) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid token' })
      };
    }

    // Check if OTP has expired
    if (Date.now() > otpData.expiresAt) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'OTP has expired. Please request a new one.' })
      };
    }

    // Verify OTP
    if (otp.toString() === otpData.otp.toString()) {
      // OTP is valid - generate access token for pricing page
      const accessToken = Buffer.from(JSON.stringify({
        mobile: otpData.mobile,
        name: otpData.name,
        verified: true,
        verifiedAt: Date.now(),
        expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours access
      })).toString('base64');

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ 
          success: true, 
          message: 'Verification successful',
          accessToken: accessToken,
          redirectUrl: '/pricing-guide/'
        })
      };
    } else {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Invalid OTP. Please try again.' })
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
