export default function Loading() {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="w-full h-[400px] bg-gray-200 animate-pulse rounded-xl mb-8" />
        <div className="h-8 bg-gray-200 animate-pulse rounded w-1/2 mb-4" />
        <div className="flex gap-2 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-6 w-16 bg-gray-200 animate-pulse rounded-full" />
          ))}
        </div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-4 bg-gray-200 animate-pulse rounded w-full" />
          ))}
        </div>
      </div>
    );
  }