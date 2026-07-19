export function LoadingScreen() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/80 z-50">
      <div className="flex flex-col items-center justify-center text-white">
        <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-lg font-medium">Loading City Scene...</p>
        <p className="text-sm text-gray-400 mt-2">Preparing time period assets</p>
      </div>
    </div>
  )
}