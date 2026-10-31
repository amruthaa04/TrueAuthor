import { useState } from "react";
import {
  Link,
  useNavigate,
  useLocation,
} from "react-router-dom";
import axios from "axios";

function Login() {
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const navigate = useNavigate();
  const location = useLocation();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      console.log("Login submitted:", formData);

      const response = await axios.post(
        "http://localhost:5000/api/auth/login",
        formData
      );

      console.log("Backend response:", response.data);

      // Save JWT token
      if (response.data.token) {
        localStorage.setItem("token", response.data.token);
      }

      // Save logged-in user details
      if (response.data.user) {
        localStorage.setItem(
          "user",
          JSON.stringify(response.data.user)
        );
      }

      alert(response.data.message || "Login Successful!");

      // If user came from another page, return there
      const returnTo =
        location.state?.from || "/dashboard";

      navigate(returnTo);

    } catch (error) {
      console.error("Login error:", error);

      alert(
        error.response?.data?.message || "Login Failed"
      );
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">

      <div className="w-full max-w-md bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-lg">

        {/* Logo / Heading */}
        <div className="text-center mb-8">

          <div className="text-5xl mb-3">
            🛡️
          </div>

          <h1 className="text-3xl font-bold text-blue-500">
            TrueAuthor
          </h1>

          <p className="text-gray-400 mt-2">
            Sign in to continue protecting your creative work.
          </p>

        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Email */}
          <div>

            <label className="block text-gray-300 mb-2">
              Email
            </label>

            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Enter your email"
              required
              className="w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-blue-500"
            />

          </div>

          {/* Password */}
          <div>

            <div className="flex justify-between items-center mb-2">

              <label className="block text-gray-300">
                Password
              </label>

              <a
                href="#"
                className="text-sm text-blue-500 hover:underline"
              >
                Forgot Password?
              </a>

            </div>

            <div className="relative">

              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter your password"
                required
                className="w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-blue-500 pr-12"
              />

              <button
                type="button"
                onClick={() =>
                  setShowPassword(!showPassword)
                }
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                {showPassword ? "🙈" : "👁️"}
              </button>

            </div>

          </div>

          {/* Login Button */}
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 hover:scale-[1.02] active:scale-95 transition-all duration-300 text-white py-3 rounded-lg font-semibold"
          >
            Login
          </button>

        </form>

        {/* Register */}
        <p className="text-center text-gray-400 mt-6">

          Don't have an account?{" "}

          <Link
            to="/register"
            state={{
              from: location.state?.from || "/dashboard"
            }}
            className="text-blue-500 hover:underline"
          >
            Register
          </Link>

        </p>

      </div>

    </div>
  );
}

export default Login;