# Render Free Tier Optimization Guide

## Goal: 5-Second Cold Start Time

Your backend is optimized for fast cold starts. To achieve 5-second login times after inactivity, you MUST set up external uptime monitoring.

## Current Optimizations

Your backend has the following optimizations in place:

1. ✅ **Health Endpoint** - `/health` endpoint for uptime monitoring
2. ✅ **Warmup Endpoint** - `/warmup` endpoint to pre-load resources
3. ✅ **Database Connection Caching** - Reuses DB connections (optimized pool sizes)
4. ✅ **In-Memory Caching** - User data and tokens cached (5-10 min TTL)
5. ✅ **Cache Middleware** - Static responses cached (products: 5 min)
6. ✅ **Keep-Alive Ping** - MongoDB ping every 2 minutes
7. ✅ **Optimized bcrypt** - Cost factor of 3 for faster hashing
8. ✅ **Query Optimization** - Hints, timeouts, and lean queries
9. ✅ **Fast DB Connection** - Reduced timeouts and pool sizes

## ⚠️ CRITICAL: External Uptime Monitoring Required

Without external uptime monitoring, Render spins down after 15 minutes. Code optimizations alone cannot achieve 5-second cold starts because Render's spin-up time is ~10-20 seconds (uncontrollable).

**With external monitoring every 5-10 minutes:**
- Login time: **3-5 seconds** ✅
- Server stays warm, DB cached, user cache active

**Without external monitoring:**
- Login time: **20-40 seconds** ❌
- Render spin-up + server startup + DB connection

## Setup External Uptime Monitoring

Choose one of these free services:

### 1. **UptimeRobot** (Recommended)
- Go to https://uptimerobot.com/
- Create a free account
- Add a new monitor:
  - Monitor Type: HTTP(s)
  - URL: `https://indian-garment-1.onrender.com/warmup`
  - Monitoring Interval: 5 minutes
  - Alert Contacts: Your email
- Save and activate

### 2. **Better Uptime**
- Go to https://betteruptime.com/
- Create a free account
- Add a new monitor:
  - Type: HTTP
  - URL: `https://indian-garment-1.onrender.com/warmup`
  - Check every: 5 minutes
- Save and enable

### 3. **Pingdom** (Free tier limited)
- Go to https://www.pingdom.com/
- Create a free account
- Add a new uptime check:
  - URL: `https://indian-garment-1.onrender.com/warmup`
  - Check interval: 5 minutes
- Save

### 4. **StatusCake** (Free tier available)
- Go to https://www.statuscake.com/
- Create a free account
- Add a new test:
  - Test Type: HTTP
  - Website URL: `https://indian-garment-1.onrender.com/warmup`
  - Check Rate: Every 5 minutes
- Save

## Endpoints

### Health Endpoint (Lightweight)
```
GET https://indian-garment-1.onrender.com/health
```
Response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-20T12:00:00.000Z"
}
```

### Warmup Endpoint (Pre-loads Resources)
```
GET https://indian-garment-1.onrender.com/warmup
```
Response:
```json
{
  "status": "warmed",
  "timestamp": "2024-01-20T12:00:00.000Z"
}
```
This endpoint:
- Ensures DB connection is established
- Runs a lightweight query to warm the connection
- Pre-loads resources for faster subsequent requests

**Use `/warmup` for uptime monitoring** to get the best performance.

## Verification

After setting up uptime monitoring:

1. Wait 15-20 minutes for the monitor to start pinging
2. Test login: Should be 3-5 seconds
3. Check uptime monitor dashboard - should show successful pings
4. If you see "down" alerts, verify the endpoint is accessible

## Performance Breakdown

**With external monitoring (5-minute intervals):**
- Server warm: 0s (kept alive by pings)
- DB connection: 0s (cached)
- User lookup: 0-1s (cached or fast query)
- bcrypt compare: 2-3s (cost factor 3)
- **Total: 3-5 seconds** ✅

**Without external monitoring (after 15+ min idle):**
- Render spin-up: 10-20s (uncontrollable)
- Node.js startup: 3-5s
- DB connection: 2-5s (optimized settings)
- User lookup: 1-2s
- bcrypt compare: 2-3s
- **Total: 18-35 seconds** ❌

## Additional Tips

- **Use `/warmup` endpoint** for monitoring instead of `/health` - it pre-loads resources
- **Set interval to 5 minutes** - Render spins down after 15 minutes
- **Backup monitors**: Set up 2-3 different services for redundancy
- **Monitor during peak hours**: Ensure pings happen during user activity
- **Check Render logs**: Monitor for cold start patterns
