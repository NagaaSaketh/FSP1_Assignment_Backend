const mongoose = require("mongoose");
require("dotenv").config();

const mongoURI = process.env.MONGO;

const initialiseDB = async () => {
  await mongoose.connect(mongoURI)
    .then(() => console.log("Database connected successfully"))
    .catch((err) => console.log("Error connecting to database",err));
};

module.exports = {initialiseDB}