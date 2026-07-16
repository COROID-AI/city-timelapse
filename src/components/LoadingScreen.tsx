interface LoadingScreenProps {
  progress: number
}

export function LoadingScreen({ progress }: LoadingScreenProps) {
  return (
    <div className="absolute inset-0 bg-black flex flex-col items-center justify-center z-100">
      <div className="w-64 h-2 bg-gray-800 rounded-full overflow-hidden mb-4">
        <div 
          className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-cyan-400 text-lg font-mono">
        Loading City Scene... {progress}%
      </p>
      <div className="mt-4 text-gray-500 text-sm">
        Preparing 3D environment
      </div>
    </div>
  )
}