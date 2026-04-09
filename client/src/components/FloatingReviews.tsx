import { Star } from "lucide-react";
import { SiFacebook, SiGoogle } from "react-icons/si";

const badges = [
  {
    icon: SiFacebook,
    iconColor: "#1877F2",
    iconBg: "#e7f0fd",
    label: "Facebook Reviews",
    count: 80,
    rating: 5,
  },
  {
    icon: SiGoogle,
    iconColor: "#EA4335",
    iconBg: "#fef2f2",
    label: "Google Reviews",
    count: 49,
    rating: 5,
  },
];

export default function FloatingReviews() {
  return (
    <div className="fixed left-3 bottom-24 z-50 flex flex-col gap-2 pointer-events-none">
      {badges.map(({ icon: Icon, iconColor, iconBg, label, count, rating }) => (
        <div
          key={label}
          className="pointer-events-auto flex items-center gap-2.5 bg-white rounded-xl px-3 py-2.5 shadow-lg border border-gray-100"
          style={{ minWidth: 0 }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: iconBg }}
          >
            <Icon style={{ color: iconColor, fontSize: 18 }} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1 mb-0.5">
              {[...Array(rating)].map((_, i) => (
                <Star key={i} className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              ))}
            </div>
            <p className="text-xs font-bold text-gray-800 leading-none">
              {count} Reviews
            </p>
            <p className="text-[10px] text-gray-400 leading-none mt-0.5">{label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
