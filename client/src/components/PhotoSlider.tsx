import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface Photo {
  src: string;
  alt: string;
}

interface PhotoSliderProps {
  photos: Photo[];
}

export default function PhotoSlider({ photos }: PhotoSliderProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  if (photos.length === 0) return null;

  const scrollByAmount = (direction: "prev" | "next") => {
    const el = scrollerRef.current;
    if (!el) return;
    const firstChild = el.firstElementChild as HTMLElement | null;
    const step = firstChild
      ? firstChild.getBoundingClientRect().width + 16
      : el.clientWidth * 0.8;
    el.scrollBy({
      left: direction === "next" ? step : -step,
      behavior: "smooth",
    });
  };

  return (
    <>
      <section className="w-full bg-black py-6" data-testid="photo-slider">
        <div className="relative">
          <div
            ref={scrollerRef}
            className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory px-4 md:px-12 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          >
            {photos.map((photo, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setExpandedIndex(i)}
                className="snap-start shrink-0 cursor-zoom-in group"
                aria-label={`Expand photo ${i + 1}`}
                data-testid={`button-photo-${i}`}
              >
                <div className="w-[80vw] h-[80vw] sm:w-[300px] sm:h-[300px] md:w-[320px] md:h-[320px] overflow-hidden rounded-lg bg-neutral-800">
                  <img
                    src={photo.src}
                    alt={photo.alt}
                    className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                  />
                </div>
              </button>
            ))}
          </div>

          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => scrollByAmount("prev")}
                aria-label="Scroll left"
                className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-full bg-black/70 hover:bg-black/90 text-white transition-colors shadow-lg"
                data-testid="button-prev-photo"
              >
                <ChevronLeft className="h-5 w-5 md:h-6 md:w-6" />
              </button>
              <button
                type="button"
                onClick={() => scrollByAmount("next")}
                aria-label="Scroll right"
                className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-full bg-black/70 hover:bg-black/90 text-white transition-colors shadow-lg"
                data-testid="button-next-photo"
              >
                <ChevronRight className="h-5 w-5 md:h-6 md:w-6" />
              </button>
            </>
          )}
        </div>
      </section>

      <Dialog
        open={expandedIndex !== null}
        onOpenChange={(next) => {
          if (!next) setExpandedIndex(null);
        }}
      >
        <DialogContent
          className="w-[95vw] max-w-none h-[90vh] p-0 bg-transparent border-0 shadow-none flex items-center justify-center"
          data-testid="modal-photo-expanded"
          onClick={() => setExpandedIndex(null)}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpandedIndex(null);
            }}
            aria-label="Close"
            className="absolute top-2 right-2 z-10 flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-full bg-black/70 hover:bg-black/90 text-white transition-colors shadow-lg"
            data-testid="button-close-photo"
          >
            <X className="h-5 w-5 md:h-6 md:w-6" />
          </button>
          {expandedIndex !== null && (
            <img
              src={photos[expandedIndex].src}
              alt={photos[expandedIndex].alt}
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
