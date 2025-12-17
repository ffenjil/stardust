<div align="center">

# stardust

**A Discord-themed portfolio with real-time Spotify integration**

[Live Demo](https://ffenjil.site) · [Report Bug](https://github.com/ffenjil/stardust/issues) · [Request Feature](https://github.com/ffenjil/stardust/issues)

---

*"We are all just code and starstuff."*

</div>

<br>

## About

Stardust is a personal portfolio website inspired by Discord's profile card design. It features a beautiful glassmorphism UI, an animated space background with floating planets and shooting stars, and real-time integration with Discord and Spotify via the Lanyard API.

<br>

## Features

- **Discord-Style UI** - Glassmorphism card with familiar Discord aesthetics
- **Real-Time Spotify Status** - Shows what you're currently listening to with album art and progress bar
- **Live Discord Presence** - Displays your online/idle/dnd/offline status
- **Animated Space Background** - Twinkling stars, floating planets (Saturn, Mars, Jupiter, Neptune), and occasional shooting stars
- **Responsive Design** - Looks great on desktop and mobile
- **Background Music** - Ambient soundtrack at low volume
- **Social Links** - Quick access to all your profiles

<br>

## Tech Stack

| Frontend | APIs | Styling |
|----------|------|---------|
| HTML5 | Lanyard WebSocket | CSS3 Glassmorphism |
| Vanilla JS | Discord Presence | CSS Variables |
| Canvas API | Spotify Integration | Font Awesome 6 |

<br>

## Quick Start

1. **Clone the repo**
   ```bash
   git clone https://github.com/ffenjil/stardust.git
   cd stardust
   ```

2. **Update your Discord User ID** in `assets/js/script.js`
   ```javascript
   const DISCORD_USER_ID = 'YOUR_DISCORD_USER_ID_HERE';
   ```

3. **Join the Lanyard Discord** - Your account must be in the [Lanyard Discord server](https://discord.gg/lanyard) for the API to track your presence.

4. **Run locally**
   ```bash
   python -m http.server 8080
   ```
   Then open `http://localhost:8080`

<br>

## Customization

| File | What to customize |
|------|-------------------|
| `index.html` | Name, bio, roles, social links |
| `assets/css/style.css` | Colors, fonts, card styling |
| `assets/js/script.js` | Discord ID, animation settings |
| `assets/images/icon.png` | Your profile picture |
| `assets/audio/bgm.mp3` | Background music track |

<br>

## Project Structure

```
stardust/
├── index.html              # Main HTML structure
├── assets/
│   ├── css/
│   │   └── style.css       # All styling
│   ├── js/
│   │   └── script.js       # Animations + Lanyard API
│   ├── images/
│   │   └── icon.png        # Profile picture
│   └── audio/
│       └── bgm.mp3         # Background music
└── README.md
```

<br>

## Deployment

Works on any static hosting:

- **GitHub Pages** - Enable in repo settings
- **Vercel** - Import and deploy
- **Netlify** - Drag and drop
- **VPS** - Apache/Nginx with your domain

<br>

## Credits

- [Lanyard API](https://github.com/Phineas/lanyard) - Real-time Discord presence
- [Font Awesome](https://fontawesome.com) - Icons
- [Unsplash](https://unsplash.com) - Banner image

<br>

---

<div align="center">

Made with mass and mass-energy by [Jil](https://github.com/ffenjil)

</div>
