import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

function SavedWorks() {
  const [works, setWorks] = useState([]);
  const [savedIds, setSavedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedWork, setSelectedWork] = useState(null);

  // ==================== LOAD SAVED IDS ====================

  useEffect(() => {
    const saved =
      JSON.parse(
        localStorage.getItem("trueauthorBookmarks")
      ) || [];

    setSavedIds(saved);
  }, []);

  // ==================== FETCH MARKETPLACE WORKS ====================

  useEffect(() => {
    const fetchWorks = async () => {
      try {
        const response = await fetch(
          "http://localhost:5000/api/works/marketplace"
        );

        const data = await response.json();

        if (response.ok) {
          setWorks(data.works || []);
        }
      } catch (error) {
        console.error(
          "Failed to fetch saved works:",
          error
        );
      } finally {
        setLoading(false);
      }
    };

    fetchWorks();
  }, []);

  // ==================== REMOVE BOOKMARK ====================

  const removeBookmark = (id) => {
  const workId = String(id);

  const updated = savedIds.filter(
    (savedId) => String(savedId) !== workId
  );

  setSavedIds(updated);

  localStorage.setItem(
    "trueauthorBookmarks",
    JSON.stringify(updated)
  );

  if (
    selectedWork &&
    String(
      selectedWork._id ||
      selectedWork.registrationId
    ) === workId
  ) {
    setSelectedWork(null);
  }
};

  // ==================== SAVED WORKS ====================

  const savedWorks = works.filter((work) => {
    const id = String(
  work._id || work.registrationId
);

return savedIds.includes(id);
  });

  // ==================== CATEGORY ====================

  const getCategory = (fileType = "") => {
    const type = fileType.toLowerCase();

    if (type.startsWith("image/")) return "Images";
    if (type.startsWith("audio/")) return "Audio";
    if (type.startsWith("video/")) return "Videos";

    return "Documents";
  };

  const getIcon = (fileType = "") => {
    const category = getCategory(fileType);

    if (category === "Images") return "🖼️";
    if (category === "Audio") return "🎵";
    if (category === "Videos") return "🎬";

    return "📄";
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">

      {/* ==================== NAVBAR ==================== */}

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
              className="text-gray-300 hover:text-blue-400"
            >
              Dashboard
            </Link>

            <Link
              to="/marketplace"
              className="text-gray-300 hover:text-blue-400"
            >
              Marketplace
            </Link>

            <Link
              to="/profile"
              className="text-blue-400 font-semibold"
            >
              👤 Account
            </Link>

          </div>

        </div>

      </nav>

      {/* ==================== MAIN ==================== */}

      <main className="max-w-7xl mx-auto px-6 py-10">

        <div className="mb-8">

          <Link
            to="/profile"
            className="text-blue-400 hover:text-blue-300 text-sm"
          >
            ← Back to Account
          </Link>

          <h2 className="text-4xl font-bold mt-5">
            🔖 Saved Works
          </h2>

          <p className="text-gray-400 mt-2">
            Creative works you've bookmarked from the marketplace.
          </p>

        </div>

        {/* ==================== LOADING ==================== */}

        {loading && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">

            <div className="text-4xl mb-4">
              ⏳
            </div>

            <p className="text-gray-400">
              Loading saved works...
            </p>

          </div>
        )}

        {/* ==================== EMPTY ==================== */}

        {!loading && savedWorks.length === 0 && (

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">

            <div className="text-6xl mb-5">
              🔖
            </div>

            <h3 className="text-2xl font-semibold">
              No saved works
            </h3>

            <p className="text-gray-400 mt-3">
              You haven't bookmarked any creative works yet.
            </p>

            <Link
              to="/marketplace"
              className="inline-block mt-6 bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-semibold"
            >
              Explore Marketplace →
            </Link>

          </div>

        )}

        {/* ==================== SAVED WORK CARDS ==================== */}

        {!loading && savedWorks.length > 0 && (

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

            {savedWorks.map((work) => {

              const workId =
                work._id ||
                work.registrationId;

              return (

                <div
                  key={workId}
                  className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-blue-600 transition"
                >

                  {/* ICON */}

                  <div className="h-44 bg-slate-800 flex items-center justify-center relative">

                    <div className="text-7xl">
                      {getIcon(work.fileType)}
                    </div>

                    <button
                      onClick={() =>
                        removeBookmark(workId)
                      }
                      className="absolute top-4 right-4 bg-red-950/80 hover:bg-red-900 text-red-400 w-10 h-10 rounded-full"
                      title="Remove bookmark"
                    >
                      ✕
                    </button>

                    <span className="absolute bottom-4 left-4 bg-slate-950/80 text-gray-300 text-xs px-3 py-1.5 rounded-full">
                      {getCategory(work.fileType)}
                    </span>

                  </div>

                  {/* DETAILS */}

                  <div className="p-6">

                    <h3 className="text-xl font-semibold break-words">
                      {work.title ||
                        "Untitled Work"}
                    </h3>

                    <p className="text-gray-400 mt-2">
                      by{" "}
                      <span className="text-blue-400">
                        {work.authorName ||
                          "Unknown Author"}
                      </span>
                    </p>

                    <p className="text-gray-500 text-xs mt-4 break-all">
                      {work.fileName}
                    </p>

                    <div className="flex items-center justify-between mt-4">

                      <span className="text-green-400 text-xs">
                        ● Registered
                      </span>

                      <span className="text-gray-500 text-xs">
                        {work.registrationId}
                      </span>

                    </div>

                    <button
                      onClick={() =>
                        setSelectedWork(work)
                      }
                      className="w-full mt-5 bg-blue-600 hover:bg-blue-700 py-3 rounded-lg font-semibold"
                    >
                      View Details →
                    </button>

                  </div>

                </div>

              );
            })}

          </div>

        )}

      </main>

      {/* ==================== DETAILS MODAL ==================== */}

      {selectedWork && (

        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => setSelectedWork(null)}
        >

          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >

            <div className="p-6 border-b border-slate-800 flex justify-between">

              <div>

                <div className="text-4xl mb-3">
                  {getIcon(selectedWork.fileType)}
                </div>

                <h3 className="text-2xl font-bold">
                  {selectedWork.title}
                </h3>

                <p className="text-gray-400 mt-1">
                  by{" "}
                  <span className="text-blue-400">
                    {selectedWork.authorName}
                  </span>
                </p>

              </div>

              <button
                onClick={() => setSelectedWork(null)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ✕
              </button>

            </div>

            <div className="p-6 space-y-5">

              <div>
                <p className="text-gray-500 text-xs">
                  Registration ID
                </p>

                <p className="bg-slate-800 rounded-lg p-3 text-sm text-blue-400 mt-1">
                  {selectedWork.registrationId}
                </p>
              </div>

              <div>
                <p className="text-gray-500 text-xs">
                  SHA-256 Digital Fingerprint
                </p>

                <p className="bg-slate-800 rounded-lg p-3 text-xs text-blue-400 break-all mt-1">
                  {selectedWork.fileHash}
                </p>
              </div>

              <div>
                <p className="text-gray-500 text-xs">
                  IPFS
                </p>

                {selectedWork.ipfsCid ? (

                  <a
                    href={`https://rose-obedient-bobolink-651.mypinata.cloud/ipfs/${selectedWork.ipfsCid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block bg-slate-800 rounded-lg p-3 text-sm text-purple-400 mt-1 underline break-all"
                  >
                    View registered work on IPFS →
                  </a>

                ) : (

                  <p className="text-gray-500 mt-1">
                    IPFS CID unavailable
                  </p>

                )}

              </div>

              <div className="border-t border-slate-800 pt-5">

                <h4 className="text-lg font-semibold text-blue-400 mb-4">
                  ⛓️ Blockchain Registration
                </h4>

                <div className="space-y-3">

                  <div>
                    <p className="text-gray-500 text-xs">
                      Network
                    </p>

                    <p className="text-gray-300 text-sm mt-1">
                      {selectedWork.blockchainNetwork ||
                        "Not available"}
                    </p>
                  </div>

                  <div>
                    <p className="text-gray-500 text-xs">
                      Owner Wallet
                    </p>

                    <p className="bg-slate-800 rounded-lg p-3 text-xs text-green-400 break-all mt-1">
                      {selectedWork.blockchainOwner ||
                        "Not available"}
                    </p>
                  </div>

                  <div>
                    <p className="text-gray-500 text-xs">
                      Transaction Hash
                    </p>

                    <p className="bg-slate-800 rounded-lg p-3 text-xs text-yellow-400 break-all mt-1">
                      {selectedWork.blockchainTxHash ||
                        "Not available"}
                    </p>
                  </div>

                  <div>
                    <p className="text-gray-500 text-xs">
                      Smart Contract
                    </p>

                    <p className="bg-slate-800 rounded-lg p-3 text-xs text-blue-400 break-all mt-1">
                      {selectedWork.contractAddress ||
                        "Not available"}
                    </p>
                  </div>

                </div>

              </div>

            </div>

            <div className="p-6 border-t border-slate-800">

              <button
                onClick={() =>
                  removeBookmark(
                    selectedWork._id ||
                    selectedWork.registrationId
                  )
                }
                className="w-full bg-red-950/40 hover:bg-red-950/70 border border-red-900 text-red-400 py-3 rounded-lg font-semibold"
              >
                🗑️ Remove from Saved Works
              </button>

            </div>

          </div>

        </div>

      )}

    </div>
  );
}

export default SavedWorks;