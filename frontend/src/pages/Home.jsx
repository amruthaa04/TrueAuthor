import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";

import {
  FaShieldAlt,
  FaCloud,
  FaCoins,
  FaCheckCircle,
} from "react-icons/fa";

function Home() {
  const navigate = useNavigate();

  // ============================================================
  // CHECK LOGIN STATUS
  // ============================================================

  const isLoggedIn = () => {
    const token = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");

    let user = null;

    try {
      user = storedUser ? JSON.parse(storedUser) : null;
    } catch (error) {
      console.error("Failed to read user:", error);
      user = null;
    }

    return Boolean(token && user);
  };



  // ============================================================
  // MARKETPLACE BUTTON
  // ============================================================

  const handleMarketplace = () => {
    navigate("/marketplace");
  };

  // ============================================================
  // PAGE
  // ============================================================

  return (
    <div className="min-h-screen bg-slate-950 text-white">

      {/* Navbar */}
      <Navbar />

      {/* ======================================================
          HERO SECTION
      ====================================================== */}

      <section className="flex flex-col items-center justify-center text-center h-[85vh] px-6">

        <h1 className="text-6xl font-bold leading-tight">
          Own Your Creativity.
        </h1>

        <h1 className="text-6xl font-bold text-blue-500 mt-2">
          Protect It Forever.
        </h1>

        <p className="mt-8 text-xl text-gray-300 max-w-3xl">
          TrueAuthor is a blockchain-powered Digital Rights Management
          platform that enables creators to securely register, verify,
          license and monetize their digital content.
        </p>

        {/* ==================================================
            BUTTONS
        ================================================== */}

        <div className="mt-10">

          {/* EXPLORE MARKETPLACE */}

          <button
            type="button"
            onClick={handleMarketplace}
            className="border border-blue-500 text-blue-400 hover:bg-blue-600 hover:text-white px-8 py-4 rounded-xl transition"
          >
            Explore Marketplace
          </button>

        </div>

      </section>

      {/* ======================================================
          FEATURES SECTION
      ====================================================== */}

      <section className="py-24 px-8 bg-slate-900">

        <h2 className="text-4xl font-bold text-center text-white">
          Core Features
        </h2>

        <p className="text-center text-gray-400 mt-4">
          Everything creators need to protect and monetize their digital
          content.
        </p>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mt-16 max-w-7xl mx-auto">

          {/* SECURE OWNERSHIP */}

          <div className="bg-slate-800 rounded-2xl p-8 hover:scale-105 transition">

            <div className="flex items-center gap-3 mb-4">

              <FaShieldAlt className="text-blue-400 text-3xl" />

              <h3 className="text-2xl font-bold text-blue-400">
                Secure Ownership
              </h3>

            </div>

            <p className="mt-4 text-gray-300">
              Register digital works securely using blockchain technology.
            </p>

          </div>

          {/* IPFS STORAGE */}

          <div className="bg-slate-800 rounded-2xl p-8 hover:scale-105 transition">

            <div className="flex items-center gap-3 mb-4">

              <FaCloud className="text-blue-400 text-3xl" />

              <h3 className="text-2xl font-bold text-blue-400">
                IPFS Storage
              </h3>

            </div>

            <p className="mt-4 text-gray-300">
              Store files safely on decentralized IPFS storage.
            </p>

          </div>

          {/* SMART ROYALTIES */}

          <div className="bg-slate-800 rounded-2xl p-8 hover:scale-105 transition">

            <div className="flex items-center gap-3 mb-4">

              <FaCoins className="text-blue-400 text-3xl" />

              <h3 className="text-2xl font-bold text-blue-400">
                Smart Royalties
              </h3>

            </div>

            <p className="mt-4 text-gray-300">
              Automatic royalty payments through smart contracts.
            </p>

          </div>

          {/* OWNERSHIP VERIFICATION */}

          <div className="bg-slate-800 rounded-2xl p-8 hover:scale-105 transition">

            <div className="flex items-center gap-3 mb-4">

              <FaCheckCircle className="text-blue-400 text-3xl" />

              <h3 className="text-2xl font-bold text-blue-400">
                Ownership Verification
              </h3>

            </div>

            <p className="mt-4 text-gray-300">
              Verify ownership instantly using blockchain records.
            </p>

          </div>

        </div>

      </section>

    </div>
  );
}

export default Home;