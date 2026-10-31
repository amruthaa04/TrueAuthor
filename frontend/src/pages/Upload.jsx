
import { useState } from "react";
import {
  connectWallet,
  registerWorkWithMetaMask,
} from "../services/walletService";

const API_URL = "http://localhost:5000/api/works";

function Upload() {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");

  const [collaborators, setCollaborators] = useState([
    { identifier: "" },
  ]);

  const [loading, setLoading] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");
  const [result, setResult] = useState(null);
  const [errorResult, setErrorResult] = useState(null);
  const [invitationMessages, setInvitationMessages] = useState([]);

  const handleFileChange = (e) => {
    setFile(e.target.files?.[0] || null);
    setResult(null);
    setErrorResult(null);
  };

  const addCollaboratorField = () => {
    setCollaborators((previous) => [
      ...previous,
      { identifier: "" },
    ]);
  };

  const updateCollaborator = (index, value) => {
    setCollaborators((previous) =>
      previous.map((item, i) =>
        i === index ? { ...item, identifier: value } : item
      )
    );
  };

  const removeCollaborator = (index) => {
    setCollaborators((previous) =>
      previous.filter((_, i) => i !== index)
    );
  };

  const sendCollaboratorInvitations = async (work) => {
    const messages = [];
    const workId = work.id || work._id;

    if (!workId || !ownerEmail.trim()) {
      const message =
        "The work was registered, but its ID or owner email is missing. Invitations could not be sent.";

      setInvitationMessages([
        {
          identifier: "Collaborators",
          success: false,
          message,
        },
      ]);

      return messages;
    }

    const invitations = collaborators.filter(
      (item) => item.identifier.trim()
    );

    for (const collaborator of invitations) {
      try {
        const identifier = collaborator.identifier.trim();

        const response = await fetch(
          `${API_URL}/collaborators/add`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              workId,
              ownerEmail: ownerEmail.trim().toLowerCase(),
              email: ownerEmail.trim().toLowerCase(),
              collaboratorEmail: identifier.toLowerCase(),
              collaboratorIdentifier: identifier,
            }),
          }
        );

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            data.message ||
              data.error ||
              `Invitation failed (${response.status})`
          );
        }

        messages.push({
          identifier,
          success: true,
          message: "Invitation sent successfully.",
        });
      } catch (error) {
        messages.push({
          identifier: collaborator.identifier,
          success: false,
          message: error.message || "Could not send invitation.",
        });
      }
    }

    setInvitationMessages(messages);
    return messages;
  };

  const handleUpload = async (e) => {
    e.preventDefault();

    if (!file) {
      alert("Please select a file first.");
      return;
    }

    if (!ownerEmail.trim()) {
      alert("Please enter your registered email.");
      return;
    }

    const invitations = collaborators.filter(
      (item) => item.identifier.trim()
    );

    const identifiers = invitations.map((item) =>
      item.identifier.trim().toLowerCase()
    );

    if (new Set(identifiers).size !== identifiers.length) {
      setErrorResult({
        message: "The same collaborator has been added more than once.",
      });
      return;
    }

    setLoading(true);
    setResult(null);
    setErrorResult(null);
    setInvitationMessages([]);

    try {
      // STEP 1: Connect MetaMask
      const wallet = await connectWallet();
      setWalletAddress(wallet.address);

      // STEP 2: Prepare work
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", title.trim() || file.name);
      formData.append("ownerEmail", ownerEmail.trim());

      const prepareResponse = await fetch(`${API_URL}/prepare`, {
        method: "POST",
        body: formData,
      });

      const prepareText = await prepareResponse.text();
      let prepareData;

      try {
        prepareData = JSON.parse(prepareText);
      } catch {
        throw new Error(
          "The backend returned an unexpected response. Check that it is running on port 5000."
        );
      }

      if (!prepareResponse.ok) {
        setErrorResult({
          message:
            prepareData.error ||
            prepareData.message ||
            "Failed to prepare work.",
          similarity: prepareData.similarityScore,
          status: prepareResponse.status,
          existingWork: prepareData.existingWork || null,
        });
        return;
      }

      if (
        !prepareData.prepareId ||
        !prepareData.fileHash ||
        !prepareData.ipfsCid
      ) {
        throw new Error(
          "The backend did not return all required work preparation details."
        );
      }

      // STEP 3: Register on blockchain
      alert(
        "Your work is ready. MetaMask will open for the blockchain transaction."
      );

      const blockchainResult = await registerWorkWithMetaMask(
        prepareData.fileHash,
        prepareData.ipfsCid
      );

      if (!blockchainResult?.transactionHash) {
        throw new Error(
          "The blockchain transaction was not completed successfully."
        );
      }

      // STEP 4: Finalize registration
      const finalizeResponse = await fetch(`${API_URL}/finalize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prepareId: prepareData.prepareId,
          transactionHash: blockchainResult.transactionHash,
          walletAddress: blockchainResult.owner || wallet.address,
        }),
      });

      const finalizeText = await finalizeResponse.text();
      let finalizeData;

      try {
        finalizeData = JSON.parse(finalizeText);
      } catch {
        throw new Error(
          "The backend returned an unexpected response while finalizing registration."
        );
      }

      if (!finalizeResponse.ok) {
        setErrorResult({
          message:
            finalizeData.error ||
            finalizeData.message ||
            "The blockchain transaction succeeded, but registration could not be finalized.",
          status: finalizeResponse.status,
        });
        return;
      }

      const registeredWork = {
        ...(finalizeData.work || {}),
        id: finalizeData.work?.id || finalizeData.work?._id,
        similarityScore: finalizeData.similarityScore,
      };

      setResult(registeredWork);

      // STEP 5: Send invitations after registration succeeds
      if (invitations.length > 0) {
        if (!registeredWork.id && !registeredWork._id) {
          setInvitationMessages([
            {
              identifier: "Collaborators",
              success: false,
              message:
                "The work was registered, but its ID was missing from the response. Invitations were not sent.",
            },
          ]);
        } else {
          await sendCollaboratorInvitations(registeredWork);
        }
      }

      alert("Work registered successfully!");

      setFile(null);
      setTitle("");
      setOwnerEmail("");
      setCollaborators([{ identifier: "" }]);

      const fileInput = document.getElementById("creative-work-file");
      if (fileInput) fileInput.value = "";
    } catch (error) {
      console.error("Upload error:", error);

      setErrorResult({
        message: error.message || "Unable to complete registration.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <nav className="border-b border-slate-800 bg-slate-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <h1 className="text-2xl font-bold text-blue-500">
            🛡️ TrueAuthor
          </h1>

          <a
            href="/dashboard"
            className="text-gray-300 transition hover:text-blue-500"
          >
            Dashboard
          </a>
        </div>
      </nav>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <div className="mb-10 text-center">
          <div className="mb-4 text-6xl">📤</div>
          <h2 className="text-4xl font-bold">Upload Your Work</h2>
          <p className="mt-3 text-gray-400">
            Upload your creative work to register and protect your work.
          </p>
        </div>

        {walletAddress && (
          <div className="mb-6 rounded-xl border border-green-700 bg-slate-900 p-5">
            <p className="font-semibold text-green-400">
              🦊 MetaMask Connected
            </p>
            <p className="mt-2 break-all text-sm text-gray-400">
              Wallet:{" "}
              <span className="text-blue-400">{walletAddress}</span>
            </p>
          </div>
        )}

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-lg">
          <form onSubmit={handleUpload}>
            <div className="mb-6">
              <label className="mb-2 block font-semibold text-gray-300">
                Work Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter the title of your work"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="mb-6">
              <label className="mb-2 block font-semibold text-gray-300">
                Creator Email
              </label>
              <input
                type="email"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                placeholder="Enter your registered email"
                required
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white focus:border-blue-500 focus:outline-none"
              />
            </div>

            {/* COLLABORATORS */}
            <section className="mb-8 rounded-xl border border-slate-700 bg-slate-950/60 p-5">
              <h3 className="text-xl font-semibold text-blue-400">
                👥 Add Collaborators
              </h3>

              <p className="mb-5 mt-2 text-sm text-gray-400">
                Invite registered TrueAuthor users to collaborate on this
                work. They can accept or reject the invitation. Royalty
                arrangements can be configured later where supported.
              </p>

              {collaborators.map((collaborator, index) => (
                <div
                  key={index}
                  className="mb-4 rounded-lg border border-slate-700 p-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <label className="font-medium text-gray-300">
                      Collaborator {index + 1}
                    </label>

                    {collaborators.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeCollaborator(index)}
                        className="text-sm text-red-400 hover:text-red-300"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <input
                    type="text"
                    value={collaborator.identifier}
                    onChange={(e) =>
                      updateCollaborator(index, e.target.value)
                    }
                    placeholder="registered email"
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
              ))}

              <button
                type="button"
                onClick={addCollaboratorField}
                className="rounded-lg border border-blue-500 px-4 py-2 text-blue-400 transition hover:bg-blue-500/10"
              >
                + Add Another Collaborator
              </button>
            </section>

            <div className="mb-3">
              <label className="mb-3 block font-semibold text-gray-300">
                Select Your Creative Work
              </label>

              <div className="rounded-xl border-2 border-dashed border-slate-700 p-8 text-center transition hover:border-blue-500">
                <div className="mb-4 text-4xl">📁</div>
                <p className="mb-3 text-gray-400">
                  Choose your creative work
                </p>
                <p className="mb-5 text-sm text-gray-500">
                  Documents, images, audio and video are supported.
                </p>

                <input
                  id="creative-work-file"
                  type="file"
                  onChange={handleFileChange}
                  accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif,.mp3,.wav,.ogg,.mp4,.webm,.mov"
                  className="block w-full cursor-pointer text-sm text-gray-400 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-white hover:file:bg-blue-700"
                />
              </div>
            </div>

            {file && (
              <div className="mt-6 rounded-lg bg-slate-800 p-4">
                <p className="text-sm text-gray-400">Selected File</p>
                <p className="mt-1 font-semibold text-white">
                  📄 {file.name}
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  {(file.size / 1024).toFixed(2)} KB
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  Type: {file.type || "Unknown"}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-6 w-full rounded-lg bg-blue-600 py-3 font-semibold text-white transition-all duration-300 hover:scale-[1.01] hover:bg-blue-700 active:scale-95 disabled:cursor-not-allowed disabled:bg-blue-900"
            >
              {loading ? "Registering Work..." : "Register My Work"}
            </button>
          </form>
        </div>

        {/* INVITATION RESULTS */}
        {invitationMessages.length > 0 && (
          <div className="mt-8 rounded-xl border border-slate-700 bg-slate-900 p-6">
            <h3 className="mb-4 text-xl font-semibold text-blue-400">
              Collaborator Invitation Results
            </h3>

            <div className="space-y-3">
              {invitationMessages.map((item, index) => (
                <div
                  key={`${item.identifier}-${index}`}
                  className="rounded-lg bg-slate-800 p-4"
                >
                  <p className="break-all font-medium text-white">
                    {item.identifier}
                  </p>

                  <p
                    className={`mt-1 text-sm ${
                      item.success ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {item.message}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ERROR */}
        {errorResult && (
          <div className="mt-8 rounded-xl border border-red-700 bg-slate-900 p-6">
            <h3 className="mb-4 text-xl font-semibold text-red-400">
              ⚠️ Registration Failed
            </h3>

            <p className="text-gray-300">{errorResult.message}</p>

            {errorResult.status && (
              <p className="mt-2 text-sm text-gray-500">
                HTTP Status: {errorResult.status}
              </p>
            )}

            {errorResult.similarity !== undefined && (
              <p className="mt-4 text-2xl font-bold text-red-400">
                Similarity Score: {errorResult.similarity}%
              </p>
            )}

            {errorResult.existingWork && (
              <div className="mt-5 rounded-lg bg-slate-800 p-4">
                <p className="mb-2 text-sm text-gray-400">
                  Existing Registered Work
                </p>
                <p className="font-semibold text-white">
                  {errorResult.existingWork.title}
                </p>
              </div>
            )}
          </div>
        )}

        {/* SUCCESS */}
        {result && (
          <div className="mt-8 rounded-xl border border-green-700 bg-slate-900 p-6">
            <h3 className="mb-5 text-xl font-semibold text-green-400">
              ✅ Work Registered Successfully
            </h3>

            <div className="space-y-3 text-gray-300">
              <div className="mb-5 rounded-lg border border-blue-700 bg-blue-950/40 p-4">
                <p className="text-sm text-gray-400">Registration ID</p>
                <p className="mt-1 break-all text-2xl font-bold text-blue-400">
                  {result.registrationId || "Not available"}
                </p>
                <p className="mt-2 text-xs text-gray-500">
                  Use this ID to verify this work later.
                </p>
              </div>

              <p>
                <span className="text-gray-500">Creator: </span>
                {result.username ? `@${result.username}` : "Not available"}
              </p>

              <p>
                <span className="text-gray-500">Title: </span>
                {result.title || title || file?.name}
              </p>

              <p>
                <span className="text-gray-500">File: </span>
                {result.fileName || file?.name}
              </p>

              <p>
                <span className="text-gray-500">Type: </span>
                {result.fileType || file?.type || "Not available"}
              </p>

              <p>
                <span className="text-gray-500">Status: </span>
                <span className="text-green-400">
                  {result.status || "Registered"}
                </span>
              </p>

              {result.similarityScore !== undefined && (
                <p>
                  <span className="text-gray-500">Similarity Score: </span>
                  {result.similarityScore}%
                </p>
              )}

              <div className="mt-5">
                <p className="mb-1 text-sm text-gray-500">
                  SHA-256 Digital Fingerprint
                </p>
                <p className="break-all rounded-lg bg-slate-800 p-3 text-xs text-blue-400">
                  {result.fileHash || "Not available"}
                </p>
              </div>

              <div className="mt-5 border-t border-slate-800 pt-5">
                <p className="mb-1 text-sm text-gray-500">IPFS CID</p>

                {result.ipfsCid ? (
                  <a
                    href={`https://rose-obedient-bobolink-651.mypinata.cloud/ipfs/${result.ipfsCid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block break-all rounded-lg bg-slate-800 p-3 text-xs text-purple-400 underline hover:text-purple-300"
                  >
                    {result.ipfsCid}
                  </a>
                ) : (
                  <p className="text-sm text-gray-500">Not available</p>
                )}
              </div>

              <div className="mt-5 border-t border-slate-800 pt-5">
                <h4 className="mb-4 text-lg font-semibold text-blue-400">
                  ⛓️ Blockchain Registration
                </h4>

                <p className="mb-2">
                  <span className="text-gray-500">Network: </span>
                  {result.blockchainNetwork || "Not available"}
                </p>

                <p className="mb-2">
                  <span className="text-gray-500">Status: </span>
                  <span className="text-green-400">
                    {result.blockchainRegistered
                      ? "Registered"
                      : "Not available"}
                  </span>
                </p>

                <p className="mb-1 mt-3 text-sm text-gray-500">
                  Blockchain Owner
                </p>
                <p className="break-all rounded-lg bg-slate-800 p-3 text-xs text-green-400">
                  {result.blockchainOwner || "Not available"}
                </p>

                <p className="mb-1 mt-3 text-sm text-gray-500">
                  Transaction Hash
                </p>
                <p className="break-all rounded-lg bg-slate-800 p-3 text-xs text-yellow-400">
                  {result.blockchainTxHash || "Not available"}
                </p>

                <p className="mb-1 mt-3 text-sm text-gray-500">
                  Smart Contract
                </p>
                <p className="break-all rounded-lg bg-slate-800 p-3 text-xs text-blue-400">
                  {result.contractAddress || "Not available"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* INFORMATION */}
        <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900 p-6">
          <h3 className="mb-3 text-xl font-semibold text-blue-500">
            🔐 How TrueAuthor Protects Your Work
          </h3>

          <ul className="space-y-2 text-gray-400">
            <li>✓ Generates a SHA-256 digital fingerprint.</li>
            <li>✓ Stores creative files on IPFS using Pinata.</li>
            <li>✓ Stores work metadata in MongoDB.</li>
            <li>✓ Records work hash, IPFS CID, owner and timestamp on blockchain.</li>
            <li>✓ Uses similarity checking to flag potentially similar works.</li>
            <li>✓ Supports collaborator invitations.</li>
          </ul>
        </div>
      </main>
    </div>
  );
}

export default Upload;