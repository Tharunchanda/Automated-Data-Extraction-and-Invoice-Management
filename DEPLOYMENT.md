# Deployment Guide

## 🚀 Backend Deployment (Render)

### Option 1: Using Render Dashboard (Recommended)

1. **Create a Render account** at https://render.com

2. **Create a new Web Service**:
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select the `Backend` directory (or configure root directory as `./Backend`)

3. **Configure the service**:
   - **Name**: `invoice-management-backend` (or your preferred name)
   - **Environment**: `Node`
   - **Region**: Choose closest to your users
   - **Branch**: `main`
   - **Build Command**: `npm install`
   - **Start Command**: `node index.js`
   - **Plan**: Free (or paid for better performance)

4. **Add Environment Variables**:
   - Go to "Environment" tab
   - Add the following variables:
     ```
     GEMINI_API_KEY=your-actual-gemini-api-key
     FRONTEND_URL=https://your-app.vercel.app
     PORT=4000
     NODE_ENV=production
     ```

5. **Deploy**: Click "Create Web Service"

6. **Copy your backend URL**: After deployment, copy the URL (e.g., `https://invoice-management-backend.onrender.com`)

### Option 2: Using render.yaml

1. Push the `render.yaml` file to your repository
2. In Render dashboard, create a new "Blueprint"
3. Connect your repository and Render will auto-configure

---

## 🌐 Frontend Deployment (Vercel)

### Steps:

1. **Install Vercel CLI** (optional):
   ```powershell
   npm install -g vercel
   ```

2. **Using Vercel Dashboard** (Recommended):
   - Go to https://vercel.com
   - Click "Add New Project"
   - Import your GitHub repository
   - Vercel will auto-detect Vite

3. **Configure the project**:
   - **Framework Preset**: Vite
   - **Root Directory**: `Frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

4. **Add Environment Variable**:
   - Go to "Settings" → "Environment Variables"
   - Add:
     ```
     VITE_API_URL=https://your-backend.onrender.com/api
     ```
   - Replace with your actual Render backend URL

5. **Deploy**: Click "Deploy"

6. **Update Backend CORS**:
   - Copy your Vercel deployment URL (e.g., `https://your-app.vercel.app`)
   - Go back to Render
   - Update the `FRONTEND_URL` environment variable with your Vercel URL
   - Redeploy the backend

---

## 🔄 Post-Deployment Steps

1. **Test the connection**:
   - Visit your Vercel frontend URL
   - Upload a test invoice
   - Verify data extraction works

2. **Update CORS if needed**:
   - If you get CORS errors, ensure `FRONTEND_URL` in Render matches your Vercel URL exactly
   - Include the protocol (`https://`)
   - Don't include trailing slash

3. **Monitor logs**:
   - **Render**: Check "Logs" tab for backend errors
   - **Vercel**: Check "Deployments" → "Runtime Logs" for frontend errors

---

## 📝 Quick Reference

### Backend Environment Variables (Render)
```bash
GEMINI_API_KEY=your-actual-key
FRONTEND_URL=https://your-app.vercel.app
PORT=4000
NODE_ENV=production
```

### Frontend Environment Variables (Vercel)
```bash
VITE_API_URL=https://your-backend.onrender.com/api
```

---

## 🛠 Troubleshooting

### CORS Errors
- Ensure `FRONTEND_URL` in backend matches your Vercel URL
- Redeploy backend after changing environment variables

### API Connection Failed
- Verify `VITE_API_URL` is set correctly in Vercel
- Check if backend is running (visit backend URL in browser)
- Ensure `/api` is included in the URL

### Build Failures
- **Backend**: Check Node.js version (should be 18+)
- **Frontend**: Ensure all dependencies are in `package.json`
- Check build logs for specific errors

---

## 🔐 Security Notes

1. **Never commit `.env` files** - They're already in `.gitignore`
2. **Keep API keys secure** - Only add them in dashboard environment variables
3. **Use HTTPS** - Both Render and Vercel provide free SSL
4. **Restrict CORS** - Set specific frontend URL instead of `*`

---

## 💡 Tips

- **Free tier limits**: Render free tier sleeps after 15 minutes of inactivity
- **Custom domains**: Both Render and Vercel support custom domains
- **Automatic deploys**: Enable auto-deploy on git push in both platforms
- **Preview deployments**: Vercel creates preview URLs for each PR

---

## 📞 Support

If you encounter issues:
1. Check Render logs: Dashboard → Your Service → Logs
2. Check Vercel logs: Dashboard → Your Project → Deployments → Runtime Logs
3. Verify environment variables are set correctly
4. Test backend API directly using Postman or curl

---

Happy Deploying! 🎉
