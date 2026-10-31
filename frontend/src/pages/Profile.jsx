import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

function Profile() {
  const [works, setWorks] = useState([]);
  const [savedIds, setSavedIds] = useState([]);
  const [loading, setLoading] = useState(true);

  const storedUser = localStorage.getItem("user");
  const user = storedUser ? JSON.parse(storedUser) : null;

  const userEmail = user?.email;

  // ============================================================
  // LOAD SAVED WORKS
  // ============================================================

  useEffect(() => {
    const savedBookmarks =
      JSON.parse(
        localStorage.getItem("trueauthorBookmarks")
      ) || [];

    setSavedIds(savedBookmarks);

    fetchWorks(savedBookmarks);
  }, []);

  // ============================================================
  // FETCH MARKETPLACE WORKS
  // ============================================================

  const fetchWorks = async (bookmarkIds) => {
    try {
      setLoading(true);

      const response = await fetch(
        "http://localhost:5000/api/works/marketplace"
      );

      const data = await response.json();

      if (response.ok) {
        const marketplaceWorks = data.works || [];

        const savedWorks = marketplaceWorks.filter(
          (work) => {
            const workId =
              work._id ||
              work.registrationId;

            return bookmarkIds.includes(workId);
          }
        );

        setWorks(savedWorks);
      }
    } catch (error) {
      console.error(
        "Failed to load saved works:",
        error
      );
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // REMOVE SAVED WORK
  // ============================================================

  const removeSavedWork = (workId) => {
    const updatedIds = savedIds.filter(
      (id) => id !== workId
    );

    setSavedIds(updatedIds);

    setWorks((currentWorks) =>
      currentWorks.filter((work) => {
        const id =
          work._id ||
          work.registrationId;

        return id !== workId;
      })
    );

    localStorage.setItem(
      "trueauthorBookmarks",
      JSON.stringify(updatedIds)
    );
  };

  // ============================================================
  // CATEGORY
  // ============================================================

  const getCategory = (fileType = "") => {
    const type = fileType.toLowerCase();

    if (type.startsWith("image/")) {
      return "Images";
    }

    if (type.startsWith("audio/")) {
      return "Audio";
    }

    if (type.startsWith("video/")) {
      return "Videos";
    }

    return "Documents";
  };

  const getCategoryIcon = (fileType = "") => {
    const category = getCategory(fileType);

    if (category === "Images") return "🖼️";
    if (category === "Audio") return "🎵";
    if (category === "Videos") return "🎬";

    return "📄";
  };

  // ============================================================
  // UI
  // ============================================================

  return (
    <div className="min-h-screen bg-slate-950 text-white">

      {/* =====================================================
          NAVBAR
      ===================================================== */}

      <nav className="bg-slate-900 border-b border-slate-800 px-8 py-4">

        <div className="max-w-7xl mx-auto flex items-center justify-between">

          <Link
            to="/"
            className="text-2xl font-bold text-blue-500"
          >
            🛡️ TrueAuthor
          </Link>

          <div className="flex items-center gap-6">

            <Link
              to="/dashboard"
              className="text-gray-300 hover:text-blue-400 transition"
            >
              Dashboard
            </Link>

            <Link
              to="/marketplace"
              className="text-gray-300 hover:text-blue-400 transition"
            >
              Marketplace
            </Link>

            <Link
              to="/profile"
              className="text-blue-400 font-semibold"
            >
              👤 Profile
            </Link>

          </div>

        </div>

      </nav>

      {/* =====================================================
          MAIN
      ===================================================== */}

      <main className="max-w-7xl mx-auto px-6 py-12">

        {/* =================================================
            PROFILE HEADER
        ================================================= */}

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 mb-10">

          <div className="flex flex-col md:flex-row md:items-center gap-6">

            {/* PROFILE ICON */}

            <div className="w-24 h-24 rounded-full bg-blue-600/20 border border-blue-500 flex items-center justify-center text-5xl">
              👤
            </div>

            {/* USER INFO */}

            <div className="flex-1">

              <h2 className="text-3xl font-bold">
                {user?.fullName || "TrueAuthor User"}
              </h2>

              <p className="text-gray-400 mt-2">
                {userEmail || "No email available"}
              </p>

              <p className="text-green-400 text-sm mt-3">
                ● Account Active
              </p>

            </div>

          </div>

          {/* PROFILE STATS */}

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-8">

            <div className="bg-slate-800 rounded-xl p-5 text-center">

              <p className="text-3xl font-bold text-blue-400">
                {savedIds.length}
              </p>

              <p className="text-gray-400 text-sm mt-1">
                Saved Works
              </p>

            </div>

            <div className="bg-slate-800 rounded-xl p-5 text-center">

              <p className="text-3xl font-bold text-purple-400">
                {works.length}
              </p>

              <p className="text-gray-400 text-sm mt-1">
                Available Saved
              </p>

            </div>

            <div className="bg-slate-800 rounded-xl p-5 text-center col-span-2 md:col-span-1">

              <p className="text-3xl">
                🛡️
              </p>

              <p className="text-gray-400 text-sm mt-1">
                TrueAuthor Member
              </p>

            </div>

          </div>

        </div>

        {/* =================================================
            SAVED WORKS
        ================================================= */}

        <div>

          <div className="flex items-center justify-between mb-6">

            <div>

              <h3 className="text-3xl font-bold">
                ❤️ Saved Works
              </h3>

              <p className="text-gray-400 mt-2">
                Works you've saved from the marketplace.
              </p>

            </div>

            <Link
              to="/marketplace"
              className="text-blue-400 hover:text-blue-300"
            >
              Browse Marketplace →
            </Link>

          </div>

          {/* LOADING */}

          {loading && (

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">

              <div className="text-4xl mb-4">
                ⏳
              </div>

              <p className="text-gray-400">
                Loading your saved works...
              </p>

            </div>

          )}

          {/* EMPTY */}

          {!loading && works.length === 0 && (

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">

              <div className="text-6xl mb-5">
                ❤️
              </div>

              <h3 className="text-2xl font-semibold">
                No saved works yet
              </h3>

              <p className="text-gray-400 mt-3">
                Save creative works from the marketplace
                and they'll appear here.
              </p>

              <Link
                to="/marketplace"
                className="inline-block mt-6 bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-semibold transition"
              >
                Explore Marketplace
              </Link>

            </div>

          )}

          {/* SAVED WORK CARDS */}

          {!loading && works.length > 0 && (

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

              {works.map((work) => {

                const workId =
                  work._id ||
                  work.registrationId;

                const category =
                  getCategory(work.fileType);

                const icon =
                  getCategoryIcon(work.fileType);

                return (

                  <div
                    key={workId}
                    className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-blue-600 transition-all"
                  >

                    {/* THUMBNAIL */}

                    <div className="h-44 bg-slate-800 flex items-center justify-center relative">

                      <div className="text-7xl">
                        {icon}
                      </div>

                      <button
                        onClick={() =>
                          removeSavedWork(workId)
                        }
                        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-slate-950/80 hover:bg-red-900 flex items-center justify-center text-xl transition"
                        title="Remove from saved works"
                      >
                        ❤️
                      </button>

                      <span className="absolute bottom-4 left-4 text-xs bg-slate-950/80 text-gray-300 px-3 py-1.5 rounded-full">
                        {category}
                      </span>

                    </div>

                    {/* CARD CONTENT */}

                    <div className="p-6">

                      <h4 className="text-xl font-semibold break-words">
                        {work.title ||
                          "Untitled Work"}
                      </h4>

                      <p className="text-gray-400 mt-2">
                        by{" "}
                        <span className="text-blue-400">
                          {work.authorName ||
                            "Unknown Author"}
                        </span>
                      </p>

                      <div className="flex items-center justify-between mt-5">

                        <span className="text-xs text-gray-500 truncate max-w-[180px]">
                          {work.fileName}
                        </span>

                        <span className="text-xs text-green-400">
                          ● Registered
                        </span>

                      </div>

                      {/* IPFS */}

                      {work.ipfsCid && (

                        <a
                          href={`https://rose-obedient-bobolink-651.mypinata.cloud/ipfs/${work.ipfsCid}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block mt-4 text-purple-400 text-sm hover:text-purple-300 underline break-all"
                        >
                          View Work on IPFS →
                        </a>

                      )}

                      {/* REMOVE */}

                      <button
                        onClick={() =>
                          removeSavedWork(workId)
                        }
                        className="w-full mt-5 bg-slate-800 hover:bg-red-900/50 border border-slate-700 hover:border-red-700 py-3 rounded-lg font-semibold transition"
                      >
                        ❤️ Remove from Saved
                      </button>

                    </div>

                  </div>

                );

              })}

            </div>

          )}

        </div>

      </main>

    </div>
  );
}

export default Profile;