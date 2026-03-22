require('dotenv').config();
const pkey = process.env.FIREBASE_PRIVATE_KEY;
console.log("Type:", typeof pkey);
console.log("Length:", pkey ? pkey.length : 'undefined');
console.log("Has quotes at ends:", pkey && pkey.startsWith('"') && pkey.endsWith('"'));
console.log("Has actual newlines:", pkey && pkey.includes('\n'));
console.log("Has escaped newlines:", pkey && pkey.includes('\\n'));
