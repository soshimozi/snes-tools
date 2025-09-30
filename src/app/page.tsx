import Image from "next/image";
import SNESpriteEditor from "../components/snesSpriteEditor";
import Link from "next/link";


export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white flex flex-col">
      {/* Header */}
      <header className="w-full p-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold">SNES Toolset</h1>
      </header>

      {/* Hero Section */}
      <main className="flex flex-col flex-grow items-center justify-center px-6 text-center">
        <h2 className="text-4xl md:text-5xl font-extrabold mb-4">
          Build, Edit, and Create for SNES
        </h2>
        <p className="text-lg md:text-xl text-gray-300 max-w-2xl mb-8">
          A suite of tools designed to make SNES sprite and background editing
          easy and intuitive. Start crafting your retro assets today!
        </p>

        {/* Call to Action Buttons */}
        <div className="flex flex-col md:flex-row gap-4">
          <Link
            href="/sprite/editor"
            className="px-6 py-3 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold shadow-lg transition"
          >
            Open Sprite Editor
          </Link>
          <Link
            href="/background/editor"
            className="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-lg transition"
          >
            Open Background Editor
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-6 text-center text-gray-500 text-sm">
        © {new Date().getFullYear()} SNES Toolset. All rights reserved.
      </footer>
    </div>
  );
}
