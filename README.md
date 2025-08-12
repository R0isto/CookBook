# Cookbook PWA Final

## What changed
- Uses IndexedDB to store recipes (images stored as compressed data URLs) for more reliable storage than localStorage.
- Image compression/resizing on upload to keep storage use reasonable and avoid crashes.
- Add/delete/edit recipes. Delete has confirmation.
- Search and sort features on the home screen.
- Export/Import JSON backup and full export from menu.
- Side menu with slide animation and overlay.
- Service worker for offline shell caching; PWA manifest for standalone home-screen install.
- Auto-save draft while adding a recipe to protect against accidental closures.

## Deploy (GitHub Pages)
1. Create a new GitHub repository (e.g., `cookbook-app`).
2. Upload the files from this project to the repository root (include `icons/`).
3. In repository **Settings → Pages**, set branch to `main` and folder to `/ (root)` and save.
4. Visit `https://<username>.github.io/<repo>/` on iPhone Safari → Share → Add to Home Screen.

## Notes & tips
- On iPhone, the file input opens the photo library; you can choose images from your gallery. The app will compress/resize them before saving.
- IndexedDB has much higher storage limits than localStorage; while not infinite, it's suitable for many recipes with compressed images.
- Use Export regularly as a backup; Import restores recipes.
- If you want cloud sync across devices, we can add optional Dropbox/Google Drive integration or GitHub Gist backup (requires auth).
