import { Calendar, Heart, Check, ArrowRight, Phone } from 'lucide-react';

export default function HedgeTrimmingSection() {
  return (
    <section className="bg-white py-12 px-8">
      <div className="max-w-5xl mx-auto">

        {/* Section header */}
        <div className="text-center mb-10">
          <div className="inline-block text-[11px] font-semibold tracking-widest text-green-700 bg-green-50 px-3 py-1 rounded-full mb-3">
            HEDGE CARE GUIDE
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-gray-900 mb-2">
            When to trim your hedges
          </h2>
          <p className="text-[15px] text-gray-600 max-w-xl mx-auto leading-relaxed">
            Right time, right cut. Here's how we approach hedge trimming on the East Coast.
          </p>
        </div>

        {/* Two-card grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">

          {/* CARD 1: Optimal Timing */}
          <div className="relative bg-white border border-gray-200 rounded-2xl p-6 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-green-600"></div>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Optimal timing schedule</h3>
            </div>

            <p className="text-sm text-gray-600 leading-relaxed mb-5">
              Most hedges thrive on two trims a year — late spring and early autumn. This rhythm fits Gisborne's growing seasons and keeps plants strong without stress.
            </p>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-green-50 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span>🌱</span>
                  <span className="text-xs font-semibold text-green-700">SPRING</span>
                </div>
                <div className="text-[13px] font-semibold text-gray-900 mb-0.5">Sep – Nov</div>
                <div className="text-xs text-gray-600 leading-tight">Encourages dense new growth</div>
              </div>
              <div className="bg-orange-50 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span>🍂</span>
                  <span className="text-xs font-semibold text-orange-700">AUTUMN</span>
                </div>
                <div className="text-[13px] font-semibold text-gray-900 mb-0.5">Mar – May</div>
                <div className="text-xs text-gray-600 leading-tight">Tidies shape before winter</div>
              </div>
            </div>
          </div>

          {/* CARD 2: Flowering Hedges */}
          <div className="relative bg-white border border-gray-200 rounded-2xl p-6 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-pink-500"></div>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-pink-50 flex items-center justify-center">
                <Heart className="w-5 h-5 text-pink-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Flowering hedges</h3>
            </div>

            <p className="text-sm text-gray-600 leading-relaxed mb-5">
              Flowering hedges play by different rules. Trim too early and you cut off next season's blooms. Wait until just after they finish flowering and you'll get the best of both — healthy structure and a full display next year.
            </p>

            <div className="bg-pink-50 rounded-xl p-3 flex gap-2.5 items-start">
              <div className="flex-shrink-0 w-[22px] h-[22px] rounded-full bg-pink-500 text-white flex items-center justify-center text-xs font-semibold">
                !
              </div>
              <div>
                <div className="text-[13px] font-semibold text-pink-900 mb-0.5">Golden rule</div>
                <div className="text-xs text-gray-600 leading-tight">
                  Always trim <em>after</em> flowering, never before
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* CTA Section */}
        <div className="relative bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-9 text-center overflow-hidden">
          <div className="absolute -top-5 -right-5 opacity-[0.08] text-[140px] leading-none select-none">🌳</div>

          <div className="relative">
            <h3 className="text-2xl font-semibold tracking-tight text-gray-900 mb-2">
              Ready for professional hedge care?
            </h3>
            <p className="text-sm text-gray-600 max-w-md mx-auto leading-relaxed mb-5">
              From a quick tidy-up to a full reshape — we've got the gear and the experience. Free quotes across Gisborne and surrounds.
            </p>

            <div className="flex gap-2.5 justify-center flex-wrap">
              <button className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-5 py-3 text-sm font-semibold inline-flex items-center gap-2 shadow-sm transition-colors">
                Get free quote
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button className="bg-white hover:bg-gray-50 text-gray-900 border border-gray-200 rounded-xl px-5 py-3 text-sm font-semibold inline-flex items-center gap-2 transition-colors">
                <Phone className="w-3.5 h-3.5" />
                Call today
              </button>
            </div>

            <div className="mt-5 pt-4 border-t border-green-200 flex justify-center gap-6 flex-wrap text-xs text-gray-600">
              <span className="inline-flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-green-600" strokeWidth={3} />
                Free quotes
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-green-600" strokeWidth={3} />
                Fully insured
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-green-600" strokeWidth={3} />
                Qualified arborists
              </span>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
