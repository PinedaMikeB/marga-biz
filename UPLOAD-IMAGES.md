# 🚀 Quick Start: Upload Images to Firebase

## ✅ What You Need To Do:

### Step 1: Update Firebase Storage Rules (2 minutes)

1. Go to: https://console.firebase.google.com
2. Select: **sah-spiritual-journal**
3. Click: **Storage** → **Rules** tab
4. Replace with this:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /public/website/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /public/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

5. Click **Publish**

---

### Step 2: Get Service Account Key (1 minute)

1. Firebase Console → ⚙️ (Settings) → **Service accounts**
2. Click **Generate new private key**
3. Save file as: `service-account-key.json`
4. Move to: `/Volumes/Wotg Drive Mike/GitHub/marga-biz/service-account-key.json`

---

### Step 3: Run Upload Script (5-10 minutes)

```bash
cd "/Volumes/Wotg Drive Mike/GitHub/marga-biz"

# Install dependencies
npm install

# Run uploader
node scripts/upload-images.js
```

**What happens:**
```
🔥 Marga Image Uploader
🔧 Initializing Firebase...
✅ Firebase initialized
📁 Loading WordPress data...
✅ Loaded data for 896 pages
🔍 Extracting image URLs...
✅ Found 47 unique images
📤 Starting upload process...
📥 Downloading: Epson-WorkForce-WF-3720.jpg
✅ Uploaded: Epson-WorkForce-WF-3720.jpg (1/47)
...
📊 Upload Summary:
✅ Uploaded: 47
❌ Failed: 0
📁 Total: 47
✅ Saved URL mapping
🔄 Updating HTML with Firebase URLs...
✅ Updated 47 image URLs in index.html
🎉 All done!
```

---

### Step 4: Test Your Website

```bash
# Open the updated HTML
open index.html
```

**All images should now load from Firebase! ✅**

---

## 🆘 Troubleshooting:

### "service-account-key.json not found"
→ Complete Step 2 above

### "Permission denied"
→ Update Storage Rules (Step 1)

### "Failed to download"
→ Some old WordPress images might be 404
→ This is okay, script will continue

### Images still broken
→ Check Firebase Console → Storage
→ Verify files are in `public/website/` folder
→ Check browser console for errors

---

## ✅ After Upload Complete:

Your files will look like this in Firebase Storage:

```
gs://sah-spiritual-journal.firebasestorage.app/
└── public/
    └── website/
        ├── Epson-WorkForce-WF-3720.jpg
        ├── Banner-Marga-2-2-1024x379.png
        ├── RICOH-COPIER.jpg
        └── [all other images...]
```

And your HTML will have URLs like:
```html
<img src="https://storage.googleapis.com/sah-spiritual-journal.firebasestorage.app/public/website/Epson-WorkForce-WF-3720.jpg">
```

---

## 🎉 Ready!

Once upload completes:
1. ✅ Open index.html
2. ✅ All images load from Firebase
3. ✅ Ready to deploy to Netlify!

---

**Need help?** Check: FIREBASE-SETUP.md for detailed instructions
