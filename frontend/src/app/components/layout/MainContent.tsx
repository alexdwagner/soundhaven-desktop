// ✅ No "use client" - this is now a Server Component
import PlaylistSidebar from "../playlists/PlaylistSidebar";
import TracksManager from "../tracks/TracksManager";

export default function MainContent() {
  return (
    <main className="flex flex-col p-4 mx-auto w-full">
      <div className="flex">
        <div className="w-1/4">
          <PlaylistSidebar />
        </div>
        <div className="w-3/4">
          {/* ✅ Track display logic handled in a Client Component */}
          <TracksManager />
        </div>
      </div>
    </main>
  );
}
