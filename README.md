# AAYUSH Clinic Website

This is a static website built with HTML, Tailwind CSS (CDN), and Three.js.

## How to Run Locally

You can run this website using any simple HTTP server.

### Option 1: Using Python (Recommended)
If you have Python installed, open a terminal in this directory and run:

```bash
python3 -m http.server
```

Then open your browser to `http://localhost:8000`.

### Option 2: Using Node.js (npx)
If you have Node.js installed:

```bash
npx serve .
```

### Option 3: Direct Open
Since this is a static site with CDN links, you can often just double-click `index.html` to open it in your browser. However, some 3D features or texture loading might be blocked by browser security policies (CORS) when opening file:// URLs directly. Using a local server (Option 1 or 2) is verified to work best.

## Deployment

Yes, this project is 100% compatible with **GitHub Pages** and **Netlify** because it is a static site (HTML/CSS/JS) with no build step required.

### Deploy to Netlify (Drag & Drop)
1.  Log in to [Netlify Drop](https://app.netlify.com/drop).
2.  Drag your entire project folder onto the page.
3.  Your site will be live instantly.

### Deploy to GitHub Pages
1.  Upload this code to a GitHub repository.
2.  Go to **Settings** > **Pages**.
3.  Select the `main` branch and `/ (root)` folder.
4.  Click **Save**. Your site will be live at `your-username.github.io/repo-name`.
