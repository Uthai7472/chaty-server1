require('dotenv').config();

const express = require('express');
const mysql = require('mysql');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const cors = require('cors');
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

app.get('/', async (req, res) => {
    try {
        await connection.query(`
            CREATE TABLE IF NOT EXISTS tb_users (
                id_table INT AUTO_INCREMENT PRIMARY KEY,
                id VARCHAR(10),
                username VARCHAR(30),
                password VARCHAR(30)
            )
        `, (err, results) => {
            if (err) {
                console.log(err);
            } else {
                console.log('Create tb_users completed');
            }
        });

        await connection.query(`
            CREATE TABLE IF NOT EXISTS tb_chats (
                id_table INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(30),
                message TEXT,
                image_url TEXT,
                timestamp TIME,
                date DATE
            )
        `, (err, results) => {
            if (err) {
                console.log(err);
            } else {
                console.log('Create tb_chats completed');
            }
        });
        // await connection.query(`
        //     DROP TABLE tb_chats
        // `, (err, results) => {
        //     if (err) {
        //         console.log(err);
        //     } else {
        //         console.log('Drop tb_chats completed');
        //     }
        // });

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
            SELECT * FROM tb_chats
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