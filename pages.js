// The list of pages. The order doesn't affect navigation: Next always picks a random page
// (except when replaying history after going Back), so kids never step through it in order.
// Each page lives in its own folder named by its integer id: pages/<id>/index.html
// IDs are permanent (never reuse one); reorder this list freely.
// `areas` tags what each page teaches; see CURRICULUM.md for the list of areas.
// To add a page: ./new-page.sh "Title"   (copies _template/ and appends here)
//
// Video pages: { id: 6, title: "Bubbles", video: "bubbles.mp4" } plays pages/6/bubbles.mp4
// full-screen with sound the moment the kid lands on it (no index.html needed).
// Optional: fit: "cover" (fill the screen, cropping edges), loop: true.
// Add one with: ./new-page.sh "Bubbles" ~/Movies/bubbles.mp4
window.PAGES = [
  { id: 1, title: "Falling Numbers", areas: ["math"] },
  { id: 2, title: "Sand Drawing", areas: ["art"] },
  { id: 3, title: "Shape Sides", areas: ["math"] },
  { id: 4, title: "Letter Tracing", areas: ["letters"] },
  { id: 5, title: "Sound It Out", areas: ["letters"] },
  { id: 6, title: "Piano", areas: ["music"] },
  { id: 7, title: "Math Box", areas: ["math"] },
  { id: 8, title: "Powers of Ten", areas: ["math", "science"] },
  { id: 10, title: "Memory Match", areas: ["thinking"] },
  { id: 11, title: "Bus Stop", video: "bus.mp4", areas: ["community"] },
  { id: 12, title: "The Cork Puppet Sings the ABCs", video: "img-1650.mp4", areas: ["letters", "music"] },
  { id: 13, title: "Flip Book Dance", video: "flip-book-dance.mp4", areas: ["art"] },
];
