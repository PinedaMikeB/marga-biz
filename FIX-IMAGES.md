# 🔧 Fix Image URLs - Quick Guide

The uploader didn't properly update the HTML. Let's fix it manually!

## 🎯 Simple 4-Step Process:

### **Open this file:**
```
fix-images.html
```

### **Step 1: Get Firebase Images**
- Click "Get Firebase Images"
- Wait ~10 seconds
- You'll see all 422 uploaded images

### **Step 2: Load Your HTML**
- Click "Choose File"
- Select your current `index.html`

### **Step 3: Fix URLs**
- Click "Fix Image URLs"
- It will replace all `/images/` paths with Firebase URLs

### **Step 4: Download**
- Click "Download Fixed HTML"
- You'll get: `index-fixed.html`

### **Step 5: Replace**
```bash
# Delete old index.html
# Rename index-fixed.html to index.html
```

---

## 🚀 Or Run Server First:

```bash
cd "/Volumes/Wotg Drive Mike/GitHub/marga-biz"
npx http-server -p 8080 -o fix-images.html
```

Then follow the 4 steps above!

---

## ✅ After Fixing:

Open `index.html` and all images will load from Firebase! 🔥

---

**Open `fix-images.html` now!**
