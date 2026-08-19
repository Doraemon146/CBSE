# Our Little Space — updated

Features:
- Separate HER/HIM Firebase authentication.
- Firebase Auth uses in-memory persistence, so the question is required again after reopening/reloading.
- Realtime Firestore messaging.
- Reply to messages by double-clicking/right-clicking a message.
- Emoji picker.
- Sticker picker.
- GIF messages via direct GIF URL; optional Tenor search is enabled by adding a Tenor API key in `chat.js`.
- Sent / delivered / seen status.
- Message timestamps.
- Realtime shared Spotify track selection.

## Firebase
1. Keep the two Firebase Authentication users already configured:
   - her@ourlittlespace.app
   - him@ourlittlespace.app
2. Deploy `firestore.rules`.
3. Enable Firestore.
4. Keep the Firebase config in `firebase-config.js`.

## Spotify
Tap `Choose` and a small music picker opens. Search/select a song from the built-in list; the selected song is stored in Firestore and both users see the same shared track. No URL pasting is required.

## GIFs
For search, create a Tenor API key and put it in:
`const TENOR_API_KEY = "";`
If you don't want an API key, paste a direct `.gif` URL into the 🔗 field.

## Phone compatibility
The site is responsive and uses `100dvh`, safe-area insets, mobile viewport settings, touch-friendly controls, and a full-width mobile chat layout. It works as a mobile web app/PWA-style site when hosted over HTTPS.
