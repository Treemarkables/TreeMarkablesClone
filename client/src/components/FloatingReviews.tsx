import { Star } from "lucide-react";
import { SiFacebook } from "react-icons/si";

function Stars({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-0.5 mb-0.5">
      {[...Array(count)].map((_, i) => (
        <Star key={i} className="h-3 w-3 fill-yellow-400 text-yellow-400" />
      ))}
    </div>
  );
}

function GoogleG() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-label="Google">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

export default function FloatingReviews() {
  return (
    <div className="absolute left-3 bottom-3 sm:left-4 sm:bottom-4 z-20 flex flex-col gap-2 pointer-events-none origin-bottom-left scale-50">

      {/* Facebook */}
      <div className="pointer-events-auto flex items-center gap-2.5 bg-white rounded-xl px-3 py-2.5 shadow-lg border border-gray-100">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#e7f0fd" }}>
          <SiFacebook style={{ color: "#1877F2", fontSize: 18 }} />
        </div>
        <div>
          <Stars count={5} />
          <p className="text-xs font-bold text-gray-800 leading-none">80 Reviews</p>
          <p className="text-[10px] text-gray-400 leading-none mt-0.5">Facebook Reviews</p>
        </div>
      </div>

      {/* Google */}
      <div className="pointer-events-auto flex items-center gap-2.5 bg-white rounded-xl px-3 py-2.5 shadow-lg border border-gray-100">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#f8f9fa" }}>
          <GoogleG />
        </div>
        <div>
          <Stars count={5} />
          <p className="text-xs font-bold text-gray-800 leading-none">49 Reviews</p>
          <p className="text-[10px] text-gray-400 leading-none mt-0.5">Google Reviews</p>
        </div>
      </div>

    </div>
  );
}
