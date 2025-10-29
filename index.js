const { initialiseDB } = require("./db/db.connect");
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("./models/user.model");

const app = express();

const corsOptions = {
  origin: "*",
  credentials: true,
  optionSuccessStatus: 200,
};

app.use(cors(corsOptions));

app.use(express.json());

initialiseDB();

app.get("/", (req, res) => res.send("FSP1_Assignment"));

// Middleware for verifying JWT.

const verifyJWT = (req, res, next) => {
  const token = req.headers["authorization"];
  if (!token) {
    return res.status(401).json({ message: "No Token provided" });
  }
  try {
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decodedToken;
    next();
  } catch (err) {
    return res.status(402).json({ message: "Invalid Token" });
  }
};

//  Function to create a new user.
async function createUser(name, email, hashedPassword) {
  try {
    const user = new User({ name, email, password: hashedPassword });
    const savedUser = await user.save();
    return savedUser;
  } catch (err) {
    console.log(err);
    throw err;
  }
}

// API route for signup

app.post("/auth/signup", async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const existingEmail = await User.findOne({ email });

    if (existingEmail) {
      res.status(409).json({ message: "Email already exists" });
      return;
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const newUser = await createUser(name, email, hashedPassword);

    res.status(201).json({ message: "User created successfully", newUser });
  } catch (err) {
    res.status(500).json({ error: "Failed to create user" });
  }
});

// API route for login

app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ error: "Invalid Credentials" });
    }

    const isPasswordValid = bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(404).json({ error: "Invalid Credentials" });
    }

    const token = jwt.sign(
      { name: user.name, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );
    return res.status(200).json({ message: "Login Success", token });
  } catch (err) {
    res.status(500).json({ error: "Failed to login" });
  }
});

app.get("/admin/api/data", verifyJWT, (req, res) => {
  res.json({ message: "Protected route accessible" });
});


app.listen(4000, () => console.log("Server is running on 4000"));
