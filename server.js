// Complete production server code
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
    res.send('Welcome to the Production Server!');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});