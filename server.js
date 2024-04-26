require('dotenv').config();

const express = require('express');
const axios = require('axios');
const mysql = require('mysql');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const port = 3002;

const app = express();
app.use(cookieParser());
app.use(express.urlencoded({extended: true}));
app.use(bodyParser.json());
app.use(cors());

const server = app.listen(port, '0.0.0.0', () => {
    console.log(`Server is running on port ${port}`);
})

const connection = mysql.createPool({
    host: process.env.MYSQL_HOSTNAME,
    port: process.env.MYSQL_PORT,
    user: process.env.MYSQL_USERNAME,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DB,  
});

const sessionMiddleware = session({
    secret: 'SessionSecretKey',
    resave: false,
    saveUninitialized: true,
});
app.use(sessionMiddleware);
app.use(express.json());
app.use(express.static('static'));
app.use(bodyParser.urlencoded({ extended: true }));
const isAuthenticated = (req, res, next) => {
    if (req.cookies.isAuthenticated) {
        next();
    }
    else {
        res.send('Can\'t Login');
    }
};

app.use(express.static('public'));
// Setup multer storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/Images/')
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname)
    }
});
const uploadImage = multer({storage: storage});

app.get('/', async (req, res) => {
    try {
        // await connection.query(`
        //     CREATE TABLE IF NOT EXISTS tb_users (
        //         id_table INT AUTO_INCREMENT PRIMARY KEY,
        //         id VARCHAR(10),
        //         username VARCHAR(30),
        //         password VARCHAR(30)
        //     )
        // `, (err, results) => {
        //     if (err) {
        //         console.log(err);
        //     } else {
        //         console.log('Create tb_users completed');
        //     }
        // });

        // await connection.query(`
        //     CREATE TABLE IF NOT EXISTS tb_chats (
        //         id_table INT AUTO_INCREMENT PRIMARY KEY,
        //         username VARCHAR(30),
        //         message TEXT,
        //         image_url TEXT,
        //         timestamp TIME,
        //         date DATE
        //     )
        // `, (err, results) => {
        //     if (err) {
        //         console.log(err);
        //     } else {
        //         console.log('Create tb_chats completed');
        //     }
        // });
        // await connection.query(`
        //     DROP TABLE tb_chats
        // `, (err, results) => {
        //     if (err) {
        //         console.log(err);
        //     } else {
        //         console.log('Drop tb_chats completed');
        //     }
        // });
        res.send('Server running');
        console.log('Server running');

    } catch (error) {
        console.error("Error : ", error);
        res.status(500);
    }
});

app.post('/api/register', async (req, res) => {
    const id = req.body.id;
    const username = req.body.username;
    const password = req.body.password;

    try {
        await connection.query(`
            INSERT INTO tb_users (id, username, password)
            VALUES (?, ?, ?)
        `, [id, username, password], (err, results) => {
            if (err) {
                res.send('Error Insert Users');
            } else {
                res.status(200).json({ message: 'Registration successful' });
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occur during registration' });
    }
});

app.get('/api/users', async (req, res) => {
    try {
        await connection.query(`
            SELECT * FROM tb_users
        `, (err, results) => {
            if (err) {
                console.log(err);
            } else {
                res.send(results);
            }
        })
    } catch (error) {
        console.error(error);
        res.status(500);
    }
});

app.delete('/api/delete/:id', async (req, res) => {
    const userId = req.params.id;

    try {
        await connection.query(`
            DELETE FROM tb_users WHERE id = ?
        `, [userId], (err, results) => {
            if (err) {
                res.status(500).json({ error: 'An error occured during user deletion' });

            } else {
                if (results.affectedRows > 0) {
                    res.status(200).json({ message: 'User deleted successfully' });
                } else {
                    res.status(404).json({ error: 'User not found' });
                }
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred during user deletion' });
    }
});

// _______________________LOG IN API____________________________
app.post('/users/login', async (req, res) => {
    const username = req.body.username;
    const password = req.body.password;

    try {
        // When you want to get data from connection.query , tou must always use Promise method
        const users = await new Promise((resolve, reject) => {
            connection.query(
                'SELECT * FROM tb_users WHERE username = ? AND password = ?',
                [username, password],
                (error, results) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(results);
                    }
                }
            );
        });
        console.log(`Username: ${username} Password : ${password}`);

        console.log('user length : ', users.length);

        if (users.length > 0) {
            req.session.isAuthenticated = true;
            res.status(200).json({ message: 'Login successful', authenticated: 'true'});
        } else {
            res.status(401).json({ error: 'Invalid username or password' });
        }

        

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred during user login' });
    }
});

//------------------------------CHAT API---------------------------
app.post('/api/chat/send', async (req, res) => {
    try {
        const username = req.body.username;
        const message = req.body.message;
        const image_url = req.body.image_url;
        const timestamp = new Date(req.body.timestamp);
        // Parse the date string to extract day, month, and year
        const dateParts = req.body.date.split('/');
        const year = dateParts[2];
        const month = dateParts[0];
        const day = dateParts[1];

        // Format the date string as 'YYYY-MM-DD'
        const formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        console.log('formatted Date ', formattedDate);


        try {
            await connection.query(`
                INSERT INTO tb_chats (username, message, image_url, timestamp, date)
                VALUES (?, ?, ?, ?, ?)
            `, [username, message, image_url, timestamp, formattedDate], (err, results) => {
                if (err) {
                    console.log(err);
                    res.send('Error Insert Chats');
                } else {
                    res.status(200).json({ message: 'Send message successful' });
                }
            });

            // Send to line notify
            let payload = {
                message: message,
            };
            // if (image_url) {
            //     payload.imageThumbnail = image;
            //     payload.imageFullsize = image;
            // }

            if (username === 'ou' || username === 'Ou') {
                await axios.post('https://notify-api.line.me/api/notify', payload, {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Authorization': 'Bearer 31RCU65rvR46z0BYuow0j7Y7PUDOuU3mpXiueEoWcnc',
                    },
                })
                .then((response) => {
                    console.log(response.data);
                })
                .catch((error) => {
                    console.error(error);
                });
            }

            console.log("Username: ", username);
        } catch (error) {
            console.log(error);
            console.error(error);
            res.status(500).json({ error: 'An error occur during send message' });
        }

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred during send message' });
    }
});

app.get('/api/chat/show_message', async (req, res) => {
    try {
        await connection.query(`
            SELECT id_table, username, date, timestamp, message, image_url
            FROM tb_chats
        `, (err, results) => {
            if (err) {
                console.log(err);
                res.status(500).json({ error: 'An error occurs while fetching message' });
            } else {
            
                res.json(results);
            }
        })
    } catch (error) {
        console.error(error);
        res.status(500);
    }
});

// Define the API endpoint to serve the image file
app.get('/api/chat/get-image/:imageName', (req, res) => {
    try {
        const imageName = req.params.imageName;
        let imagePath = path.join(__dirname, 'public/Images', imageName);

        // Check if the image file exists
        if (fs.existsSync(imagePath)) {
            // If the image file exists, send it as a response
            const imageData = fs.readFileSync(imagePath);
            res.contentType('image/jpeg'); // Set the appropriate content type based on the image type
            res.send(imageData);
        } else {
            // // When deploy --> image path changed
            // imagePath = path.join(__dirname, 'opt/render/project/src', imageName);
            // // If the image file does not exist, send a 404 Not Found response
            // const imageData = fs.readFileSync(imagePath);
            // res.contentType('image/jpeg'); // Set the appropriate content type based on the image type
            // res.send(imageData);
            
            // if (!fs.existsSync(imagePath)) {
            //     res.status(404).send(`Image not found, imagePath: ${imagePath}`)
            // }
            res.status(404).send(`Image not found, ImageName: ${imageName} ImagePath: ${imagePath}`);
        }
    } catch (error) {
        console.error('Error while fetching image:', error);
        res.status(500).send('Internal server error');
    }
});

app.post('/api/upload/image', uploadImage.single('image'), (req, res) => {
    if (!req.file) {
        console.log('No file uploaded');
        return res.status(400).send('No file uploaded');
    }

    //File uploaded success
    console.log('File uploaded successfully');
    res.send('File uploaded successfully');
});
