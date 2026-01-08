# 🖥️ Local Testing Guide

## Quick Start (Choose One Method)

### Method 1: Python (Recommended - Already Installed on Mac)

```bash
cd "/Volumes/Wotg Drive Mike/GitHub/marga-biz/dist"
python3 -m http.server 8080
```

Then open: **http://localhost:8080**

To stop: Press `Ctrl + C`

---

### Method 2: Node.js http-server

```bash
cd "/Volumes/Wotg Drive Mike/GitHub/marga-biz"
npm run serve
```

This automatically opens your browser to **http://localhost:8080**

---

### Method 3: VS Code Live Server

1. Open the `dist` folder in VS Code
2. Right-click `index.html`
3. Select "Open with Live Server"

---

## 📋 Pages to Test

| Page | URL |
|------|-----|
| Homepage | http://localhost:8080/ |
| Copier Rental | http://localhost:8080/copier-rental/copier-for-rent/ |
| Printer Rental | http://localhost:8080/printer-rental/ |
| Blog Index | http://localhost:8080/blogs/ |
| Sample Blog | http://localhost:8080/blogs/benefits-of-printer-rentals/ |
| Contact | http://localhost:8080/contact/ |

---

## ✅ What to Check

1. **Homepage loads** - Hero section, content visible
2. **Navigation works** - Dropdown menus function
3. **Images load** - From Firebase Storage
4. **Internal links work** - Click through pages
5. **Blog posts display** - Content and sidebar
6. **Mobile view** - Resize browser window
7. **Footer displays** - All links present

---

## 🛑 To Stop the Server

Press `Ctrl + C` in the terminal
