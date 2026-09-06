// All photography is self-hosted in /public/photos. The first four are the
// club's own shots; the rest are licensed Unsplash stand-ins downloaded into
// the repo (no runtime third-party dependency) — swap them for club photos
// when the club has equivalents. This file is the only place image URLs live.
export const PHOTOS = {
  // Real club photos
  green: {
    src: "/photos/green.jpg",
    alt: "A yellow flag flying on the green under a big blue Gisborne sky",
  },
  gazebo: {
    src: "/photos/gazebo.jpg",
    alt: "The gazebo out front of the clubhouse, golfers heading past",
  },
  golfers: {
    src: "/photos/golfers.jpg",
    alt: "Club members with their trundlers lined up on the fairway",
  },
  clubhouse: {
    src: "/photos/clubhouse.jpg",
    alt: "The Park Golf Club clubhouse on Cochrane Street",
  },

  // Stand-in stock (Unsplash, self-hosted)
  heroFairway: {
    src: "/photos/hero-dusk.jpg",
    alt: "A tree-lined fairway running toward a distant flag",
  },
  drive: {
    src: "/photos/events-hero.jpg",
    alt: "A golfer at the top of the backswing, driver in hand",
  },
  twilight: {
    src: "/photos/twilight.jpg",
    alt: "A golfer silhouetted against the last of the evening light",
  },
  openField: {
    src: "/photos/course-hero.jpg",
    alt: "A wide, flat stretch of mown fairway under big sky",
  },
};
