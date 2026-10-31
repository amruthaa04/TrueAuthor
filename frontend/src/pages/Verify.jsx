import { useState } from "react";

function Verify() {
  const [searchValue, setSearchValue] = useState("");
  const [loading, setLoading] = useState(false);

  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const handleVerify = async (e) => {
    e.preventDefault();

    if (!searchValue.trim()) {
      setError("Please enter a username or Registration ID.");
      setResult(null);
      return;
    }

    setLoading(true);
    setResult(null);
    setError("");

    const value = searchValue.trim();

    try {
      let url;

      // Registration ID
      if (
        value.toUpperCase().startsWith("TA-")
      ) {
        url =
          `http://localhost:5000/api/works/verify?registrationId=${encodeURIComponent(
            value
          )}`;
      }

      // Username
      else {
        const username = value
          .replace(/^@/, "")
          .toLowerCase();

        url =
          `http://localhost:5000/api/works/verify?username=${encodeURIComponent(
            username
          )}`;
      }

      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        setError(
          data.message ||
            "No registered work found."
        );
        return;
      }

      setResult(data);

    } catch (error) {
      console.error(
        "Verification error:",
        error
      );

      setError(
        "Unable to connect to the server."
      );

    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // FORMAT DATE
  // ============================================================

  const formatDate = (date) => {
    if (!date) return "Not available";

    return new Date(date).toLocaleString();
  };

  // ============================================================
  // WORK CARD
  // ============================================================

  const WorkCard = ({ work }) => (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">

      {/* Registration ID */}

      <div className="mb-4">

        <p className="text-gray-500 text-sm">
          Registration ID
        </p>

        <p className="text-blue-400 font-bold text-lg mt-1">
          {work.registrationId || "Not available"}
        </p>

      </div>

      {/* Title */}

      <div className="mb-4">

        <p className="text-gray-500 text-sm">
          Work Title
        </p>

        <p className="text-white font-semibold text-lg mt-1">
          {work.title}
        </p>

      </div>

      {/* File */}

      <div className="mb-4">

        <p className="text-gray-500 text-sm">
          File
        </p>

        <p className="text-gray-300 mt-1">
          {work.fileName}
        </p>

      </div>

      {/* SHA-256 */}

      <div className="mb-4">

        <p className="text-gray-500 text-sm">
          SHA-256 Digital Fingerprint
        </p>

        <p className="bg-slate-900 rounded-lg p-3 mt-2 text-xs text-blue-400 break-all">
          {work.fileHash}
        </p>

      </div>

      {/* Registration Time */}

      <div className="mb-4">

        <p className="text-gray-500 text-sm">
          Registered On
        </p>

        <p className="text-gray-300 mt-1">
          {formatDate(work.registeredAt || work.createdAt)}
        </p>

      </div>

      {/* Status */}

      <div className="mb-4">

        <p className="text-gray-500 text-sm">
          Registration Status
        </p>

        <p className="text-green-400 font-semibold mt-1">
          ✓ {work.status || "Registered"}
        </p>

      </div>

            {/* IPFS - Display as text, not a clickable link */}

      {work.ipfsCid && (
        <div className="mb-4">

          <p className="text-gray-500 text-sm">
            IPFS CID
          </p>

          <p className="block bg-slate-900 rounded-lg p-3 mt-2 text-xs text-purple-400 break-all">
            {work.ipfsCid}
          </p>

        </div>
      )}
      
      {/* Blockchain */}

      <div className="border-t border-slate-700 pt-5 mt-5">

        <h4 className="text-blue-400 font-semibold mb-4">
          ⛓️ Blockchain Verification
        </h4>

        <p className="mb-2">

          <span className="text-gray-500">
            Network:
          </span>{" "}

          {work.blockchainNetwork ||
            "Not available"}

        </p>

        <p className="mb-2">

          <span className="text-gray-500">
            Status:
          </span>{" "}

          <span className="text-green-400">
            {work.blockchainRegistered
              ? "✓ Registered"
              : "Not Registered"}
          </span>

        </p>

        {work.blockchainOwner && (
          <div className="mt-3">

            <p className="text-gray-500 text-sm mb-1">
              Blockchain Owner
            </p>

            <p className="bg-slate-900 rounded-lg p-3 text-xs text-green-400 break-all">
              {work.blockchainOwner}
            </p>

          </div>
        )}

        {work.blockchainTxHash && (
          <div className="mt-3">

            <p className="text-gray-500 text-sm mb-1">
              Transaction Hash
            </p>

            <p className="bg-slate-900 rounded-lg p-3 text-xs text-yellow-400 break-all">
              {work.blockchainTxHash}
            </p>

          </div>
        )}

      </div>

    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white">

      {/* ==================== NAVBAR ==================== */}

      <nav className="border-b border-slate-800 bg-slate-900">

        <div className="max-w-6xl mx-auto px-6 py-5 flex justify-between items-center">

          <h1 className="text-2xl font-bold text-blue-500">
            🛡️ TrueAuthor
          </h1>

          <a
            href="/"
            className="text-gray-300 hover:text-blue-500 transition"
          >
            Home
          </a>

        </div>

      </nav>

      {/* ==================== MAIN ==================== */}

      <main className="max-w-5xl mx-auto px-6 py-12">

        {/* Heading */}

        <div className="text-center mb-10">

          <div className="text-6xl mb-4">
            🔎
          </div>

          <h2 className="text-4xl font-bold">
            Verify a Work
          </h2>

          <p className="text-gray-400 mt-3 max-w-2xl mx-auto">
            Verify registered creative works using a
            creator username or Registration ID.
          </p>

          <p className="text-gray-500 text-sm mt-2">
            No account is required to verify a registered work.
          </p>

        </div>

        {/* ==================== SEARCH ==================== */}

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-lg">

          <form onSubmit={handleVerify}>

            <label className="block text-gray-300 mb-2 font-semibold">
              Username or Registration ID
            </label>

            <input
              type="text"
              value={searchValue}
              onChange={(e) =>
                setSearchValue(e.target.value)
              }
              placeholder="@username or TA-2026-123456"
              className="w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-blue-500"
            />

            <p className="text-gray-500 text-xs mt-2">
              Enter a creator username to view their
              registered works, or enter a Registration ID
              to verify one specific work.
            </p>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-6 bg-blue-600 hover:bg-blue-700
              disabled:bg-blue-900 disabled:cursor-not-allowed
              hover:scale-[1.02] active:scale-95
              transition-all duration-300
              text-white py-3 rounded-lg font-semibold"
            >
              {loading
                ? "Verifying..."
                : "Verify Work"}
            </button>

          </form>

        </div>

        {/* ==================== ERROR ==================== */}

        {error && (
          <div className="mt-8 bg-slate-900 border border-red-700 rounded-xl p-6">

            <h3 className="text-xl font-semibold text-red-400">
              ⚠️ Verification Failed
            </h3>

            <p className="text-gray-300 mt-3">
              {error}
            </p>

          </div>
        )}

        {/* ==================== USERNAME RESULT ==================== */}

        {result &&
          result.creator &&
          result.works && (

          <div className="mt-8">

            <div className="bg-slate-900 border border-green-700 rounded-xl p-6 mb-6">

              <p className="text-gray-500 text-sm">
                Creator
              </p>

              <h3 className="text-2xl font-bold text-green-400 mt-1">
                @{result.creator.username}
              </h3>

              {result.creator.fullName && (
                <p className="text-gray-400 mt-1">
                  {result.creator.fullName}
                </p>
              )}

              <p className="text-gray-500 text-sm mt-4">
                {result.works.length} registered work
                {result.works.length !== 1
                  ? "s"
                  : ""}
              </p>

            </div>

            <h3 className="text-xl font-semibold text-white mb-4">
              Registered Works
            </h3>

            {result.works.length === 0 ? (

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-gray-400">
                This creator has no registered works yet.
              </div>

            ) : (

              <div className="space-y-6">

                {result.works.map((work) => (
                  <WorkCard
                    key={work._id}
                    work={work}
                  />
                ))}

              </div>

            )}

          </div>
        )}

        {/* ==================== REGISTRATION ID RESULT ==================== */}

        {result &&
          result.work &&
          result.creator &&
          !result.works && (

          <div className="mt-8">

            <div className="bg-slate-900 border border-green-700 rounded-xl p-6 mb-6">

              <h3 className="text-xl font-semibold text-green-400">
                ✅ Work Verified Successfully
              </h3>

              <p className="text-gray-400 mt-2">
                This work is registered with TrueAuthor.
              </p>

              {result.creator.username && (
                <p className="text-gray-300 mt-4">
                  Creator:{" "}
                  <span className="text-blue-400">
                    @{result.creator.username}
                  </span>
                </p>
              )}

            </div>

            <WorkCard
              work={result.work}
            />

            {result.blockchain && (
              <div className="mt-6 bg-slate-900 border border-slate-800 rounded-xl p-6">

                <h3 className="text-lg font-semibold text-blue-400 mb-4">
                  Blockchain Record
                </h3>

                <p className="text-gray-300 mb-2">
                  Exists:{" "}
                  <span className="text-green-400">
                    {result.blockchain.exists
                      ? "Yes"
                      : "No"}
                  </span>
                </p>

                <p className="text-gray-300 mb-2">
                  IPFS CID:{" "}
                  <span className="text-purple-400 break-all">
                    {result.blockchain.ipfsCid ||
                      "Not available"}
                  </span>
                </p>

                <p className="text-gray-300 mb-2">
                  Owner:{" "}
                  <span className="text-green-400 break-all">
                    {result.blockchain.owner ||
                      "Not available"}
                  </span>
                </p>

                <p className="text-gray-300">
                  Blockchain Timestamp:{" "}
                  <span className="text-gray-400">
                    {result.blockchain.timestamp
                      ? formatDate(
                          Number(
                            result.blockchain.timestamp
                          ) * 1000
                        )
                      : "Not available"}
                  </span>
                </p>

              </div>
            )}

          </div>
        )}

        {/* ==================== INFORMATION ==================== */}

        <div className="mt-8 bg-slate-900 border border-slate-800 rounded-xl p-6">

          <h3 className="text-xl font-semibold text-blue-500 mb-3">
            🔐 What Verification Does
          </h3>

          <ul className="space-y-2 text-gray-400">

            <li>
              ✓ Confirms that a work has been registered with TrueAuthor.
            </li>

            <li>
              ✓ Displays the work's SHA-256 digital fingerprint.
            </li>

            <li>
              ✓ Shows when the work was registered.
            </li>

            <li>
              ✓ Shows the associated IPFS record.
            </li>

            <li>
              ✓ Checks the corresponding blockchain record.
            </li>

            <li>
              ✓ No TrueAuthor account is required for verification.
            </li>

          </ul>

        </div>

      </main>

    </div>
  );
}

export default Verify;