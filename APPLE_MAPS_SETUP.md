# Apple Maps Setup Guide

Your web app has been converted from Google Maps to Apple Maps (MapKit JS). However, to use Apple Maps, you need to set up Apple Developer credentials.

## Required Steps:

### 1. Apple Developer Account
- Sign up for an Apple Developer account at [developer.apple.com](https://developer.apple.com)
- This costs $99/year

### 2. Create a MapKit JS Key
1. Go to [developer.apple.com/account/resources/authkeys/list](https://developer.apple.com/account/resources/authkeys/list)
2. Click "+" to create a new key
3. Enter a name for your key
4. Check "MapKit JS" 
5. Click Continue and Register
6. Download the `.p8` file and note your Key ID

### 3. Get Your Team ID
- Find your Team ID in your Apple Developer account settings
- It's a 10-character string like `ABC123DEFG`

### 4. Set Up Authentication
MapKit JS requires server-side JWT token generation. You have a few options:

#### Option A: Simple Node.js Server
Create a simple server to generate JWT tokens:

```javascript
const jwt = require('jsonwebtoken');
const fs = require('fs');

const privateKey = fs.readFileSync('path/to/your/AuthKey_KEYID.p8');
const keyId = 'YOUR_KEY_ID';
const teamId = 'YOUR_TEAM_ID';

const token = jwt.sign({}, privateKey, {
  algorithm: 'ES256',
  expiresIn: '180d',
  issuer: teamId,
  header: {
    alg: 'ES256',
    kid: keyId
  }
});

console.log(token);
```

#### Option B: Use a Service
Consider using services like:
- Vercel/Netlify functions
- AWS Lambda
- Or any backend that can generate JWT tokens

### 5. Update Your Code
In `script.js`, replace `"YOUR_MAPKIT_JS_TOKEN_HERE"` with your actual JWT token:

```javascript
mapkit.init({
  authorizationCallback: function(done) {
    done("YOUR_ACTUAL_JWT_TOKEN_HERE");
  }
});
```

## Temporary Testing
For initial testing, you can try using a public demo token or implement a simple token generator, but you'll need proper authentication for production use.

## Alternative: Keep Using Google Maps
If setting up Apple Developer credentials is too complex, you can:
1. Revert to the backup script: `cp script_backup.js script.js`
2. Update the HTML to use Google Maps API again
3. Get a Google Maps API key instead

The choice is yours - Apple Maps offers better integration with Apple devices, while Google Maps has broader compatibility and easier setup.
