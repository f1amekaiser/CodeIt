const {exec} = require('child_process');
const express = require('express');
const app = express();
const fs = require('fs');
const path = require('path');

app.use(express.json());
const filepath = path.join(__dirname, 'code.py');

app.post('/api/run', (req, res) => {
    const code = req.body.code;
    if(!code) {
        return res.status(400).send('No code provided');
    }

    fs.writeFileSync(filepath, code, 'utf8');
    
    exec(`python "${filepath}"`, (err, stdout, stderr) => {
        if(err) {
            return res.status(500).send(`Error: ${err.message}`);
        }
        if(stderr) {
            return res.status(500).send(`Error: ${stderr}`);
        }
        res.send(`> ${stdout}`);
    })
})

app.listen(5000, () => {
    console.log('Server is running on http://localhost:5000');
});
