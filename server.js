const express = require("express");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const session = require("express-session");
const sqlite3 = require("sqlite3").verbose();
const app = express();

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(session({ secret: "secretkey", resave: false, saveUninitialized: true }));

// Database
const db = new sqlite3.Database("./database.db");
db.run(`CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE,
  email TEXT UNIQUE,
  password TEXT
)`);
db.run(`CREATE TABLE IF NOT EXISTS messages(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  message TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// Home page
app.get("/", (req, res) => res.sendFile(__dirname + "/public/index.html"));

// Register
app.post("/register", async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) return res.send("Fill all fields!");
  const hash = await bcrypt.hash(password, 10);
  db.run("INSERT INTO users (username,email,password) VALUES (?,?,?)",
    [username,email,hash],
    function(err){
      if(err) return res.send("Username or email already taken!");
      req.session.userId = this.lastID;
      res.redirect(`/user`);
    });
});

// Login
app.post("/login", (req, res) => {
  const { email, password } = req.body;
  db.get("SELECT * FROM users WHERE email=?", [email], async (err, row) => {
    if(!row) return res.send("Invalid email or password");
    const match = await bcrypt.compare(password, row.password);
    if(match){
      req.session.userId = row.id;
      res.redirect(`/user`);
    } else res.send("Invalid email or password");
  });
});

// User dashboard
app.get("/user", (req,res) => {
  if(!req.session.userId) return res.redirect("/");
  db.get("SELECT * FROM users WHERE id=?", [req.session.userId], (err,user) => {
    db.all("SELECT * FROM messages WHERE user_id=?", [user.id], (err,msgs) => {
      let html = `<h2>Welcome, ${user.username}</h2>`;
      html += `<p>Share your link: <b>https://yourapp.onrender.com/message/${user.username}</b></p>`;
      html += "<h3>Messages:</h3>";
      msgs.forEach(m => html += `<p>${m.message} (${m.timestamp})</p>`);
      html += `<p><a href='/'>Logout</a></p>`;
      res.send(html);
    });
  });
});

// Message page for friends
app.get("/message/:username", (req,res) => {
  const username = req.params.username;
  db.get("SELECT * FROM users WHERE username=?", [username], (err,user) => {
    if(!user) return res.send("User not found!");
    res.send(`
      <h2>Send anonymous message to ${username}</h2>
      <form method="POST" action="/message/${username}">
        <textarea name="message" placeholder="Type your message" required></textarea><br>
        <button type="submit">Send</button>
      </form>
    `);
  });
});

// Receive message
app.post("/message/:username", (req,res) => {
  const username = req.params.username;
  const msg = req.body.message;
  db.get("SELECT * FROM users WHERE username=?", [username], (err,user) => {
    if(!user) return res.send("User not found!");
    db.run("INSERT INTO messages (user_id,message) VALUES (?,?)", [user.id,msg], () => {
      res.send(`<p>Message sent!</p><p><a href='/message/${username}'>Back</a></p>`);
    });
  });
});

// Start server
const listener = app.listen(process.env.PORT || 3000, () => console.log("App running..."));