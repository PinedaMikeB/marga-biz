# ✅ Firebase Config Saved!

Your Firebase configuration has been saved to:
- `firebase-config.json` (for Node.js scripts)
- `js/firebase-config.js` (for website)

---

## 🎯 Next Step: Get Service Account Key

### **Required for Image Upload Script**

1. **Go to Firebase Console:**
   https://console.firebase.google.com/project/sah-spiritual-journal/settings/serviceaccounts/adminsdk

2. **Click: "Generate new private key"**

3. **Save the file as:**
   ```
   service-account-key.json
   ```

4. **Move to this location:**
   ```
   /Volumes/Wotg Drive Mike/GitHub/marga-biz/service-account-key.json
   ```

---

## ⚠️ Update Storage Rules First!

Before running the upload script, update your Storage rules:

1. **Go to Storage Rules:**
   https://console.firebase.google.com/project/sah-spiritual-journal/storage/rules

2. **Replace with this:**

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    
    // Public website images (anyone can read)
    match /public/website/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // Public AI generated (anyone can read)
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

3. **Click: "Publish"**

---

## 🚀 Then Run Upload Script:

```bash
cd "/Volumes/Wotg Drive Mike/GitHub/marga-biz"

# Install dependencies (first time only)
npm install

# Run image uploader
node scripts/upload-images.js
```

---

## ✅ Checklist:

- [x] Firebase config saved
- [ ] Storage rules updated
- [ ] Service account key downloaded
- [ ] Service account key moved to project folder
- [ ] Ready to run upload script

---

**Once you have the service account key, you're ready to upload!** 🎉
