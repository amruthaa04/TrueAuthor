import { Link } from "react-router-dom";
function Navbar() {
  return (
    <nav className="bg-slate-950 border-b border-slate-800">
      <div className="max-w-7xl mx-auto flex justify-between items-center px-8 py-5">

        <h1 className="text-3xl font-bold text-blue-500">
          TrueAuthor
        </h1>

        <div className="flex gap-8 text-white">

          <Link to="/" className="hover:text-blue-400">
            Home
          </Link>

          <Link  to="/marketplace" className="hover:text-blue-400">
            Marketplace
          </Link>

          <Link to="/verify" className="hover:text-blue-400">
            Verify
          </Link>

          <Link to="/login" className="hover:text-blue-400">
            Login
          </Link>

          <Link
           to="/register"
           className="bg-blue-600 px-4 py-2 rounded-lg hover:bg-blue-700"
          >
           Register
          </Link>

        </div>

      </div>
    </nav>
  );
}

export default Navbar;