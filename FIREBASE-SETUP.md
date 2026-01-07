# 🔥 Firebase Setup Instructions

## Step 1: Update Storage Rules

1. Go to Firebase Console: https://console.firebase.google.com
2. Select project: **sah-spiritual-journal**
3. Click **Storage** in left menu
4. Click **Rules** tab
5. Replace with these rules:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    
    // Public website images (anyone can read)
    match /public/website/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // AI generated content (public read)
    match /public/ai-generated/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // Private app files (authenticated only)
    match /private/{allPaths=**} {
      allow read, write: if request.auth != null;
    }
    
    // Deny everything else
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

6. Click **Publish**

---

## Step 2: Get Firebase Config

1. In Firebase Console, click ⚙️ (Settings) → **Project settings**
2. Scroll down to "Your apps"
3. If no web app exists, click "Add app" → Web (</> icon)
4. Register app name: **marga-website**
5. Copy the `firebaseConfig` object

It looks like this:
```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "sah-spiritual-journal.firebaseapp.com",
  projectId: "sah-spiritual-journal",
  storageBucket: "sah-spiritual-journal.firebasestorage.app",
  messagingSenderId: "123...",
  appId: "1:123..."
};
```

---

## Step 3: Create Config File

Create this file with your actual config:

**File:** `/Volumes/Wotg Drive Mike/GitHub/marga-biz/firebase-config.json`

```json
{
  "apiKey": "YOUR_API_KEY_HERE",
  "authDomain": "sah-spiritual-journal.firebaseapp.com",
  "projectId": "sah-spiritual-journal",
  "storageBucket": "sah-spiritual-journal.firebasestorage.app",
  "messagingSenderId": "YOUR_SENDER_ID",
  "appId": "YOUR_APP_ID"
}
```

---

## Step 4: Generate Service Account Key (for uploader script)

1. Firebase Console → ⚙️ Settings → **Service accounts**
2. Click **Generate new private key**
3. Save as: `service-account-key.json`
4. Move to: `/Volumes/Wotg Drive Mike/GitHub/marga-biz/service-account-key.json`

⚠️ **IMPORTANT:** Add to `.gitignore` (never commit this file!)

---

## Step 5: Run Image Uploader

After completing steps above:

```bash
cd "/Volumes/Wotg Drive Mike/GitHub/marga-biz"
npm install firebase-admin
node scripts/upload-images.js
```

The script will:
1. ✅ Read all images from WordPress data
2. ✅ Download from marga.biz
3. ✅ Upload to Firebase Storage
4. ✅ Generate URL mapping file
5. ✅ Update HTML with Firebase URLs

---

## ✅ Checklist:

- [ ] Updated Storage Rules
- [ ] Got Firebase Config
- [ ] Created firebase-config.json
- [ ] Downloaded service-account-key.json
- [ ] Added service-account-key.json to .gitignore
- [ ] Ready to run uploader script

---

Let me know when you've completed these steps and I'll create the upload script!
