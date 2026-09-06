// CLUB photos (in /public/photos) are the club's own shots. The remaining
// Unsplash entries are verified stand-in stock for slots the club hasn't
// photographed yet (dusk hero, twilight silhouette) — swap when they have
// something better. This file is the only place image URLs live.
const u = (id: string, w = 1600) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

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

  // Stand-in stock (Unsplash)
  heroFairway: {
    src: u("photo-1636646220328-61d531af9f31", 2000),
    alt: "A tree-lined fairway running toward a distant flag",
  },
  drive: {
    src: u("photo-1535131749006-b7f58c99034b"),
    alt: "A golfer at the top of the backswing, driver in hand",
  },
  twilight: {
    src: u("photo-1505794718076-13e166c01a33"),
    alt: "A golfer silhouetted against the last of the evening light",
  },
  openField: {
    src: u("photo-1538628166020-9c7589dc6913", 2000),
    alt: "A wide, flat stretch of mown fairway under big sky",
  },
};
