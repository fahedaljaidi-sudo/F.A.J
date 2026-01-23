# Railway Deployment - Quick Fix Guide

## 🚨 Current Issue

Railway is serving **static HTML files** for all API routes instead of running the Express server.

**Example**: `https://faj-production-523d.up.railway.app/api/health` returns HTML instead of JSON.

---

## ✅ Solution: Railway Dashboard Configuration

Railway may be deploying from the **wrong directory**. Here's how to fix it:

### Step 1: Open Railway Project Settings

1. Go to [Railway Dashboard](https://railway.app)
2. Open your project: **faj-production-523d**
3. Click on your service
4. Click **Settings** tab

### Step 2: Configure Root Directory

Find the **Root Directory** setting and set it to:
```
backend
```

> **IMPORTANT**: Railway must run from the `backend` folder where `server.js` is located.

### Step 3: Verify Start Command

Ensure the start command is:
```
npm start
```

This runs `node database/reset-admin-now.js && node server.js` which:
- Resets admin credentials automatically
- Starts the Express server

### Step 4: Redeploy

1. Click **Deploy** or trigger a redeploy
2. Wait for deployment to complete
3. Check logs for "Server running on port" message

---

## 🧪 Testing After Fix

Once redeployed, test these endpoints:

### 1. Health Check (JSON Response)
```
https://faj-production-523d.up.railway.app/api/health
```

**Expected Response**:
```json
{
  "status": "ok",
  "message": "نظام الأمن الصناعي يعمل بشكل طبيعي",
  "timestamp": "...",
  "hint": "لتحديث المدير: ?reset=admin2026"
}
```

### 2. Emergency Admin Reset
```
https://faj-production-523d.up.railway.app/api/health?reset=admin2026
```

**Expected Response**:
```json
{
  "status": "updated",
  "message": "✅ تم تحديث معلومات المدير بنجاح!",
  "credentials": {
    "username": "admin",
    "password": "admin@123",
    "full_name": "فهد الجعيدي"
  }
}
```

### 3. Login Page (HTML Response)
```
https://faj-production-523d.up.railway.app
```

**Expected**: Login page HTML (this should work for non-API routes)

---

## 📋 Alternative: Check Railway Logs

If the above doesn't work, check Railway logs:

1. In Railway Dashboard, go to your service
2. Click **Deployments** tab
3. Click on the latest deployment
4. Check **Build Logs** and **Deploy Logs**

### Look for these messages:

**Good Signs**:
```
✓ Database initialized
✓ Admin credentials updated
Server running on port: 3000
Status: Online ✓
```

**Bad Signs**:
```
Error: Cannot find module
ENOENT: no such file or directory
Port already in use
```

---

## 🔧 Troubleshooting

### Issue: Still getting HTML for API routes

**Possible Causes**:
1. Root directory not set to `backend`
2. Build failed silently
3. Port binding issue

**Solution**:
1. Double-check root directory setting
2. Review build logs for errors
3. Try **Fresh Redeploy**:
   - Settings → Danger Zone → Remove Service
   - Create new service from GitHub
   - Set root directory to `backend` during setup

### Issue: 500 Error on API Routes

**Possible Causes**:
1. Database file permissions
2. Missing dependencies
3. Code error

**Solution**:
1. Check deploy logs for specific error
2. Verify `package.json` dependencies are installed
3. Check file paths in `server.js` are correct

### Issue: Can't Login After Deploy

**Solution**: Use emergency reset:
```
https://faj-production-523d.up.railway.app/api/health?reset=admin2026
```

---

## 📁 File Structure Reference

Railway should see this structure:
```
backend/
├── Procfile              # Railway process config
├── nixpacks.toml         # Railway build config
├── package.json          # Dependencies & scripts
├── server.js             # Main server file
├── database/
│   ├── init.js
│   ├── db.js
│   └── reset-admin-now.js
├── routes/
│   ├── auth.js
│   ├── visitors.js
│   ├── patrols.js
│   ├── reports.js
│   ├── users.js
│   ├── emergency.js     # Emergency admin reset
│   └── fix.js           # Database recreation
└── ...
```

---

## ✨ Expected Behavior

After fixing configuration:

| URL | Expected Response |
|-----|-------------------|
| `/` | HTML login page |
| `/api/health` | JSON status |
| `/api/auth/login` | JSON (POST) |
| `/api/visitors` | JSON (requires auth) |
| `/dashboard.html` | HTML dashboard |

---

## 🎯 Next Steps

1. **Fix Railway root directory**: Set to `backend`
2. **Redeploy** the service
3. **Test API health endpoint** for JSON response
4. **Reset admin credentials** using emergency endpoint
5. **Login** with `admin` / `admin@123`
6. **Deploy Vercel frontend** (already configured with new URL)

---

## 📞 Need Help?

If issues persist:
1. Share Railway deployment logs
2. Share the exact error message
3. Verify root directory is set to `backend`
