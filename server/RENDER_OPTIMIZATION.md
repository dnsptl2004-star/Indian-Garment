# Render Free Tier Optimization Guide

## Current Optimizations

Your backend already has the following optimizations in place to handle cold starts:

1. ✅ **Health Endpoint** - `/health` endpoint available for uptime monitoring
2. ✅ **Database Connection Caching** - Reuses DB connections across requests
3. ✅ **In-Memory Caching** - User data and tokens cached (5-10 min TTL)
4. ✅ **Cache Middleware** - Static responses cached (products: 5 min)
5. ✅ **Keep-Alive Ping** - MongoDB ping every 5 minutes
6. ✅ **Optimized bcrypt** - Cost factor of 4 for faster cold starts
7. ✅ **Query Optimization** - Hints, timeouts, and lean queries

## Critical: Set Up External Uptime Monitoring

To prevent cold starts on Render's free tier, you MUST set up external uptime monitoring to ping your `/health` endpoint every 10-14 minutes.

### Free Uptime Monitoring Services

Choose one of these free services:

#### 1. **UptimeRobot** (Recommended)
- Go to https://uptimerobot.com/
- Create a free account
- Add a new monitor:
  - Monitor Type: HTTP(s)
  - URL: `https://indian-garment-1.onrender.com/health`
  - Monitoring Interval: 5 minutes (or 10 minutes)
  - Alert Contacts: Your email
- Save and activate

#### 2. **Better Uptime**
- Go to https://betteruptime.com/
- Create a free account
- Add a new monitor:
  - Type: HTTP
  - URL: `https://indian-garment-1.onrender.com/health`
  - Check every: 60 seconds (or 5 minutes)
- Save and enable

#### 3. **Pingdom** (Free tier limited)
- Go to https://www.pingdom.com/
- Create a free account
- Add a new uptime check:
  - URL: `https://indian-garment-1.onrender.com/health`
  - Check interval: 5 minutes
- Save

#### 4. **StatusCake** (Free tier available)
- Go to https://www.statuscake.com/
- Create a free account
- Add a new test:
  - Test Type: HTTP
  - Website URL: `https://indian-garment-1.onrender.com/health`
  - Check Rate: Every 5 minutes
- Save

## Why This Matters

Render's free tier spins down your service after 15 minutes of inactivity. Without external pings:
- First request after idle: 30-60 seconds cold start
- Subsequent requests: Fast (until next idle period)

With uptime monitoring every 5-10 minutes:
- Service stays warm: ~1-2 second response times
- No cold starts for users

## Verification

After setting up uptime monitoring:

1. Wait 15-20 minutes for the monitor to start pinging
2. Test login: Should be fast (1-3 seconds)
3. Check your uptime monitor dashboard - should show successful pings
4. If you see "down" alerts, check the `/health` endpoint is accessible

## Additional Tips

- **Monitor during peak hours**: Ensure pings happen during your users' active hours
- **Backup monitors**: Consider setting up 2-3 different uptime services for redundancy
- **Check logs**: Monitor Render logs to see when cold starts happen
- **Database**: Your MongoDB ping every 5 minutes helps keep DB connection alive

## Health Endpoint

Your health endpoint is already configured at:
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

This is a lightweight endpoint that doesn't require authentication or database queries, making it perfect for keep-alive pings.
