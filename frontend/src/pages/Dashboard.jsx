
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { connectWallet } from "../services/walletService";

const API_URL = "http://localhost:5000/api";

function Dashboard() {
  const navigate = useNavigate();

  const [authChecking, setAuthChecking] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [loadingNotifications, setLoadingNotifications] = useState(true);
  const [works, setWorks] = useState([]);
  const [loadingWorks, setLoadingWorks] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const [walletAddress, setWalletAddress] = useState(
    localStorage.getItem("walletAddress") || ""
  );
  const [walletChainId, setWalletChainId] = useState(
    localStorage.getItem("walletChainId") || ""
  );
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState("");
  const [bookmarks, setBookmarks] = useState([]);
  const [invitationActionId, setInvitationActionId] = useState(null);
  const [invitationError, setInvitationError] = useState("");
  const [invitationSuccess, setInvitationSuccess] = useState("");

  const storedUser = localStorage.getItem("user");
  let user = null;

  try {
    user = storedUser ? JSON.parse(storedUser) : null;
  } catch {
    user = null;
  }

  const userEmail = user?.email?.trim().toLowerCase();

  useEffect(() => {
    if (!localStorage.getItem("token")) {
      navigate("/login", { replace: true });
      return;
    }
    setAuthChecking(false);
  }, [navigate]);

  useEffect(() => {
    try {
      setBookmarks(
        JSON.parse(localStorage.getItem("trueauthorBookmarks")) || []
      );
    } catch (error) {
      console.error("Failed to load bookmarks:", error);
      setBookmarks([]);
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!userEmail) {
      setNotifications([]);
      setLoadingNotifications(false);
      return;
    }

    try {
      setLoadingNotifications(true);
      const response = await fetch(
        `${API_URL}/notifications?email=${encodeURIComponent(userEmail)}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to load notifications.");
      }

      setNotifications(data.notifications || []);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setLoadingNotifications(false);
    }
  }, [userEmail]);

  const fetchWorks = useCallback(async () => {
    if (!userEmail) {
      setWorks([]);
      setLoadingWorks(false);
      return;
    }

    try {
      setLoadingWorks(true);
      const response = await fetch(
        `${API_URL}/works/user?email=${encodeURIComponent(userEmail)}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to load works.");
      }

      setWorks(data.works || []);
    } catch (error) {
      console.error("Failed to fetch works:", error);
    } finally {
      setLoadingWorks(false);
    }
  }, [userEmail]);

  useEffect(() => {
    if (!authChecking) {
      fetchNotifications();
      fetchWorks();
    }
  }, [authChecking, fetchNotifications, fetchWorks]);

  const markAsRead = async (id) => {
    try {
      const response = await fetch(`${API_URL}/notifications/${id}/read`, {
        method: "PATCH",
      });

      if (response.ok) {
        setNotifications((current) =>
          current.map((notification) =>
            notification._id === id
              ? { ...notification, read: true }
              : notification
          )
        );
      }
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  const respondToInvitation = async (notification, action) => {
    const workId =
      typeof notification.workId === "object"
        ? notification.workId?._id
        : notification.workId;

    if (!workId || !userEmail) {
      setInvitationError(
        "This invitation is missing its work ID or recipient email."
      );
      return;
    }

    setInvitationActionId(notification._id);
    setInvitationError("");
    setInvitationSuccess("");

    try {
      const response = await fetch(
        `${API_URL}/works/collaborators/${action}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workId,
            collaboratorEmail: userEmail,
          }),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message || `Failed to ${action} the invitation.`
        );
      }

      setInvitationSuccess(
        action === "accept"
          ? "Invitation accepted. You are now an accepted collaborator on this work."
          : "Invitation rejected."
      );

      await markAsRead(notification._id);
      await fetchNotifications();
      await fetchWorks();
    } catch (error) {
      setInvitationError(
        error.message || "Unable to respond to the invitation."
      );
    } finally {
      setInvitationActionId(null);
    }
  };

  const handleConnectWallet = async () => {
    setWalletLoading(true);
    setWalletError("");

    try {
      const wallet = await connectWallet();
      setWalletAddress(wallet.address);
      setWalletChainId(wallet.chainId);

      localStorage.setItem("walletAddress", wallet.address);
      localStorage.setItem("walletChainId", wallet.chainId);
    } catch (error) {
      console.error("MetaMask connection error:", error);
      setWalletError(error.message || "Failed to connect MetaMask.");
    } finally {
      setWalletLoading(false);
    }
  };

  const handleDisconnectWallet = () => {
    setWalletAddress("");
    setWalletChainId("");
    setWalletError("");
    localStorage.removeItem("walletAddress");
    localStorage.removeItem("walletChainId");
  };

  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts) => {
      if (!accounts || accounts.length === 0) {
        handleDisconnectWallet();
        return;
      }

      setWalletAddress(accounts[0]);
      localStorage.setItem("walletAddress", accounts[0]);
    };

    const handleChainChanged = (chainId) => {
      setWalletChainId(chainId);
      localStorage.setItem("walletChainId", chainId);
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener("chainChanged", handleChainChanged);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("walletAddress");
    localStorage.removeItem("walletChainId");
    navigate("/login", { replace: true });
  };

  const unreadCount = notifications.filter((item) => !item.read).length;
  const shortenedWallet = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : "";
  const profileInitial = user?.fullName
    ? user.fullName.charAt(0).toUpperCase()
    : "U";

  const notificationTitle = (type) => {
    const titles = {
      SIMILARITY_WARNING: "⚠️ Similarity Warning",
      UPLOAD_BLOCKED: "🚫 Upload Blocked",
      UPLOAD_APPROVED: "✅ Upload Approved",
      WORK_PURCHASED: "💰 Work Purchased",
      COLLABORATION_INVITE: "🤝 Collaboration Invitation",
      COLLABORATION_ACCEPTED: "✅ Collaboration Accepted",
      COLLABORATION_REJECTED: "❌ Collaboration Rejected",
    };

    return titles[type] || "🔔 Notification";
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <p className="text-gray-400">Checking authentication...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <nav className="border-b border-slate-800 bg-slate-900 px-8 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link to="/dashboard" className="text-2xl font-bold text-blue-500">
            🛡️ TrueAuthor
          </Link>

          <div className="flex items-center gap-6">
            <Link to="/dashboard" className="text-gray-300 hover:text-blue-400">
              Home
            </Link>
            <Link to="/marketplace" className="text-gray-300 hover:text-blue-400">
              Marketplace
            </Link>

            <div className="relative">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 hover:bg-slate-700"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 font-bold">
                  {profileInitial}
                </div>
                <div className="hidden text-left md:block">
                  <p className="text-sm font-semibold">
                    {user?.fullName || "User"}
                  </p>
                  <p className="text-xs text-gray-500">My Account</p>
                </div>
                <span className="text-sm text-gray-400">
                  {profileOpen ? "▲" : "▼"}
                </span>
              </button>

              {profileOpen && (
                <div className="absolute right-0 z-50 mt-3 w-80 overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
                  <div className="border-b border-slate-800 p-5">
                    <h3 className="truncate text-lg font-semibold">
                      {user?.fullName || "TrueAuthor User"}
                    </h3>
                    <p className="truncate text-sm text-gray-400">
                      {userEmail || "No email available"}
                    </p>
                    <span className="mt-4 inline-flex rounded-full border border-green-800 bg-green-950/40 px-3 py-1.5 text-xs text-green-400">
                      Account Active
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 p-4">
                    <div className="rounded-xl bg-slate-800 p-3">
                      <p className="text-xs text-gray-500">Registered Works</p>
                      <p className="mt-1 text-xl font-bold text-blue-400">
                        {works.length}
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-800 p-3">
                      <p className="text-xs text-gray-500">Bookmarks</p>
                      <p className="mt-1 text-xl font-bold text-purple-400">
                        {bookmarks.length}
                      </p>
                    </div>
                  </div>

                  <div className="px-4 pb-4">
                    <div className="rounded-xl bg-slate-800 p-4">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-400">🦊 Wallet</span>
                        <span className={walletAddress ? "text-xs text-green-400" : "text-xs text-gray-500"}>
                          {walletAddress ? "Connected" : "Not Connected"}
                        </span>
                      </div>
                      {walletAddress && (
                        <p className="mt-2 break-all text-xs text-blue-400">
                          {shortenedWallet}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-slate-800 p-2">
                    <button
                      onClick={() => {
                        setProfileOpen(false);
                        window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
                      }}
                      className="w-full rounded-lg px-4 py-3 text-left text-gray-300 hover:bg-slate-800"
                    >
                      👤 Account Information
                    </button>
                    <Link
                      to="/marketplace"
                      onClick={() => setProfileOpen(false)}
                      className="block rounded-lg px-4 py-3 text-gray-300 hover:bg-slate-800"
                    >
                      🔖 My Marketplace
                    </Link>
                  </div>

                  <div className="border-t border-slate-800 p-2">
                    <button
                      onClick={handleLogout}
                      className="w-full rounded-lg px-4 py-3 text-left text-red-400 hover:bg-red-950/30"
                    >
                      🚪 Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-8 py-12">
        <div className="mb-10">
          <h2 className="text-4xl font-bold">
            Welcome{user?.fullName ? `, ${user.fullName}` : ""} 👋
          </h2>
          <p className="mt-3 text-lg text-gray-400">
            Protect, verify and manage your creative work securely.
          </p>
        </div>

        <section className="mb-10 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-2xl font-semibold">🦊 Wallet Connection</h3>
              {walletAddress ? (
                <>
                  <p className="mt-2 text-green-400">● MetaMask Connected</p>
                  <p className="mt-2 text-sm text-gray-400">
                    Wallet: <span className="text-blue-400">{shortenedWallet}</span>
                  </p>
                  <p className="mt-1 text-xs text-gray-500">Chain ID: {walletChainId}</p>
                </>
              ) : (
                <p className="mt-2 text-gray-400">
                  Connect MetaMask to use blockchain-based ownership features.
                </p>
              )}
            </div>

            {walletAddress ? (
              <button
                onClick={handleDisconnectWallet}
                className="rounded-lg bg-slate-700 px-6 py-3 font-semibold hover:bg-slate-600"
              >
                Disconnect
              </button>
            ) : (
              <button
                onClick={handleConnectWallet}
                disabled={walletLoading}
                className="rounded-lg bg-orange-600 px-6 py-3 font-semibold hover:bg-orange-700 disabled:opacity-50"
              >
                {walletLoading ? "Connecting..." : "🦊 Connect MetaMask"}
              </button>
            )}
          </div>
          {walletError && <p className="mt-5 text-sm text-red-400">{walletError}</p>}
        </section>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <Link to="/upload" className="rounded-2xl border border-slate-800 bg-slate-900 p-6 transition hover:border-blue-500">
            <div className="mb-4 text-4xl">📤</div>
            <h3 className="mb-2 text-xl font-semibold">Upload Work</h3>
            <p className="text-gray-400">Register and protect your creative work.</p>
          </Link>
          <Link to="/verify" className="rounded-2xl border border-slate-800 bg-slate-900 p-6 transition hover:border-blue-500">
            <div className="mb-4 text-4xl">🔍</div>
            <h3 className="mb-2 text-xl font-semibold">Verify Work</h3>
            <p className="text-gray-400">Verify authenticity and ownership.</p>
          </Link>
          <Link to="/marketplace" className="rounded-2xl border border-slate-800 bg-slate-900 p-6 transition hover:border-blue-500">
            <div className="mb-4 text-4xl">🛒</div>
            <h3 className="mb-2 text-xl font-semibold">Marketplace</h3>
            <p className="text-gray-400">Explore registered creative works.</p>
          </Link>
        </div>

        <section className="mt-10 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-2xl font-semibold">📁 My Registered Works</h3>
            <button onClick={fetchWorks} className="text-sm text-blue-400 hover:text-blue-300">
              Refresh
            </button>
          </div>

          {loadingWorks ? (
            <p className="text-gray-400">Loading your works...</p>
          ) : works.length === 0 ? (
            <div>
              <p className="text-gray-400">You haven't registered any works yet.</p>
              <Link to="/upload" className="mt-4 inline-block text-blue-400 hover:text-blue-300">
                Upload your first work →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {works.map((work) => (
                <div key={work._id} className="rounded-xl border border-slate-700 bg-slate-800 p-5">
                  <h4 className="text-lg font-semibold">{work.title}</h4>
                  <p className="mt-2 text-sm text-gray-400">Registration ID: {work.registrationId || "Not available"}</p>
                  <p className="mt-2 text-sm text-gray-400">File: {work.fileName}</p>
                  <p className="mt-1 text-sm text-gray-400">Type: {work.fileType}</p>
                  <p className="mt-1 text-sm text-gray-400">
                    Size: {((work.fileSize || 0) / 1024).toFixed(2)} KB
                  </p>
                  <p className="mt-3 text-sm text-green-400">● {work.status}</p>
                  <p className="mt-3 break-all text-xs text-gray-500">SHA-256: {work.fileHash}</p>
                  {work.ipfsCid && (
                    <a
                      href={`https://rose-obedient-bobolink-651.mypinata.cloud/ipfs/${work.ipfsCid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 block break-all text-xs text-purple-400 underline hover:text-purple-300"
                    >
                      IPFS CID: {work.ipfsCid}
                    </a>
                  )}
                  <p className="mt-2 text-xs text-gray-500">
                    Registered: {work.createdAt ? new Date(work.createdAt).toLocaleString() : "Not available"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-10 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="text-2xl font-semibold">🔔 Notifications</h3>
              {unreadCount > 0 && (
                <span className="rounded-full bg-red-600 px-2.5 py-1 text-xs font-bold">
                  {unreadCount} New
                </span>
              )}
            </div>
            <button onClick={fetchNotifications} className="text-sm text-blue-400 hover:text-blue-300">
              Refresh
            </button>
          </div>

          {invitationSuccess && (
            <div className="mb-4 rounded-lg border border-green-700 bg-green-950/30 p-4 text-green-300">
              {invitationSuccess}
            </div>
          )}
          {invitationError && (
            <div className="mb-4 rounded-lg border border-red-700 bg-red-950/30 p-4 text-red-300">
              {invitationError}
            </div>
          )}

          {loadingNotifications ? (
            <p className="text-gray-400">Loading notifications...</p>
          ) : notifications.length === 0 ? (
            <p className="text-gray-400">No notifications yet.</p>
          ) : (
            <div className="space-y-4">
              {notifications.map((notification) => {
                const isInvitation =
                  notification.type === "COLLABORATION_INVITE";

                return (
                  <div
                    key={notification._id}
                    className={`rounded-xl border p-5 ${
                      notification.read
                        ? "border-slate-700 bg-slate-800"
                        : "border-blue-700 bg-slate-800"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="mb-2 flex items-center gap-2">
                          {!notification.read && (
                            <span className="h-2 w-2 rounded-full bg-blue-500" />
                          )}
                          <h4 className="font-semibold text-white">
                            {notificationTitle(notification.type)}
                          </h4>
                        </div>

                        <p className="text-gray-300">{notification.message}</p>

                        {Number(notification.similarityScore) > 0 && (
                          <p className="mt-3 font-semibold text-red-400">
                            Similarity Score: {notification.similarityScore}%
                          </p>
                        )}

                        <p className="mt-3 text-xs text-gray-500">
                          {notification.createdAt
                            ? new Date(notification.createdAt).toLocaleString()
                            : ""}
                        </p>

                        {isInvitation && (
                          <div className="mt-4 flex flex-wrap gap-3">
                            <button
                              type="button"
                              onClick={() => respondToInvitation(notification, "accept")}
                              disabled={invitationActionId === notification._id}
                              className="rounded-lg bg-green-600 px-4 py-2 font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {invitationActionId === notification._id
                                ? "Processing..."
                                : "Accept Invitation"}
                            </button>
                            <button
                              type="button"
                              onClick={() => respondToInvitation(notification, "reject")}
                              disabled={invitationActionId === notification._id}
                              className="rounded-lg bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </div>

                      {!notification.read && (
                        <button
                          onClick={() => markAsRead(notification._id)}
                          className="whitespace-nowrap text-sm text-blue-400 hover:text-blue-300"
                        >
                          Mark as read
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-10 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h3 className="mb-4 text-2xl font-semibold">Your Account</h3>
          <p className="text-gray-400">Logged in as {userEmail || "Unknown user"}</p>
          <p className="mt-3 text-green-400">● Authentication Active</p>
          {walletAddress && (
            <p className="mt-2 break-all text-sm text-blue-400">
              ● Wallet Connected: {walletAddress}
            </p>
          )}
        </section>
      </main>
    </div>
  );
}

export default Dashboard;
