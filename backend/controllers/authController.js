const User = require("../models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// ==================== REGISTER ====================

const registerUser = async (req, res) => {
  try {
    const {
      fullName,
      username,
      email,
      password,
      walletAddress,
    } = req.body;

    // Check if email already exists
    const existingEmail = await User.findOne({ email });

    if (existingEmail) {
      return res.status(400).json({
        message: "Email already registered",
      });
    }

    // Check if username already exists
    const existingUsername = await User.findOne({
      username: username.toLowerCase(),
    });

    if (existingUsername) {
      return res.status(400).json({
        message: "Username already taken",
      });
    }

    const hashedPassword = await bcrypt.hash(
      password,
      10
    );

    const newUser = await User.create({
      fullName,
      username: username.toLowerCase(),
      email,
      password: hashedPassword,
      walletAddress,
    });

    res.status(201).json({
      message: "Registration Successful",

      user: {
        id: newUser._id,
        fullName: newUser.fullName,
        username: newUser.username,
        email: newUser.email,
        walletAddress: newUser.walletAddress,
      },
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
};

// ==================== LOGIN ====================

const loginUser = async (req, res) => {
  try {
    const {
      email,
      password,
    } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const isPasswordCorrect =
      await bcrypt.compare(
        password,
        user.password
      );

    if (!isPasswordCorrect) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1d",
      }
    );

    res.status(200).json({
      message: "Login Successful",

      token,

      user: {
        id: user._id,
        fullName: user.fullName,
        username: user.username,
        email: user.email,
        walletAddress: user.walletAddress,
      },
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
};

module.exports = {
  registerUser,
  loginUser,
};