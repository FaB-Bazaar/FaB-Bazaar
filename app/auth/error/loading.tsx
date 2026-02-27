export default function AuthErrorLoading() {
  return (
    <div className="container mx-auto py-12 px-4">
      <div className="max-w-md mx-auto">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <div className="space-y-4">
            <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-32 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-8 bg-gray-200 rounded w-1/3 mx-auto animate-pulse"></div>
          </div>
        </div>
      </div>
    </div>
  )
}
