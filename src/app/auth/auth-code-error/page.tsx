export default function AuthCodeError() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="p-8 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-red-600 mb-4">Authentication Error</h1>
        <p className="text-gray-700">
          There was an error verifying your authentication code. Please try signing in again.
        </p>
        <a href="/login" className="mt-4 inline-block text-blue-600 hover:underline">
          Back to Login
        </a>
      </div>
    </div>
  )
}
