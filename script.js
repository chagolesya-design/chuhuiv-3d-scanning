"use strict";

const globalLinks = [...document.querySelectorAll(".section-menu a")];
const sections = [...document.querySelectorAll("main > section")];
const navActiveLine = document.querySelector(".nav-active-line");
function alignNavigationMarker() {
  const activeLink = globalLinks.find((link) => link.hasAttribute("aria-current"));
  if (!activeLink) return;
  const bounds = activeLink.getBoundingClientRect();
  navActiveLine.style.transform = `translateY(${bounds.top + bounds.height / 2 - 0.5}px)`;
  navActiveLine.style.visibility = "visible";
}
globalLinks.forEach((link) => {
  if (link.getAttribute("aria-disabled") === "true") {
    link.addEventListener("click", (event) => event.preventDefault());
  }
});
function updateGlobalNavigation() {
  const midpoint = window.innerHeight / 2;
  const current = sections.find((section) => {
    const bounds = section.getBoundingClientRect();
    return bounds.top <= midpoint && bounds.bottom > midpoint;
  });
  if (!current) return;
  globalLinks.forEach((link) => {
    if (link.hash === "#" + current.id) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  alignNavigationMarker();
}
window.addEventListener("scroll", updateGlobalNavigation, { passive: true });
window.addEventListener("resize", updateGlobalNavigation);
window.addEventListener("pageshow", updateGlobalNavigation);
updateGlobalNavigation();
new ResizeObserver(alignNavigationMarker).observe(document.querySelector(".section-menu"));
document.fonts.ready.then(alignNavigationMarker);

const overview = document.getElementById("background-overview");
const reader = document.getElementById("background-reader");
const readingTitle = document.getElementById("reading-title");
const readingNumber = document.getElementById("reading-number");
const readingText = document.getElementById("reading-text");
const questionButtons = [...document.querySelectorAll(".background-questions button")];
const topicButtons = [...document.querySelectorAll(".background-topic-nav button")];
const nextButton = document.getElementById("next-topic");
const scrollIndicator = document.querySelector(".reading-scroll");
const scrollThumb = scrollIndicator.querySelector("span");
let activeTopic = 0;

function updateReadingScroll() {
  const total = readingText.scrollHeight;
  const visible = readingText.clientHeight;
  const overflow = total - visible;
  scrollIndicator.hidden = reader.hidden || overflow <= 1;
  if (scrollIndicator.hidden) return;
  const thumbHeight = Math.max(16, visible * visible / total);
  scrollThumb.style.height = thumbHeight + "px";
  scrollThumb.style.top = (visible - thumbHeight) * readingText.scrollTop / overflow + "px";
}
function openTopic(index) {
  if (!Number.isInteger(index) || index < 0 || index >= questionButtons.length) return;
  activeTopic = index;
  readingNumber.textContent = String(index + 1).padStart(2, "0");
  const source = document.getElementById("background-content-" + index);
  readingTitle.textContent = source.dataset.title || questionButtons[index].querySelector("span:last-child").textContent;
  readingText.replaceChildren(source.content.cloneNode(true));
  if (!readingText.textContent.trim()) {
    // Explicit empty state until original project source texts are supplied.
    const pending = document.createElement("p");
    pending.className = "content-pending";
    pending.textContent = "Source text not yet provided.";
    readingText.append(pending);
  }
  overview.hidden = true;
  reader.hidden = false;
  readingText.scrollTop = 0;
  topicButtons.forEach((button, i) => {
    if (i === index) button.setAttribute("aria-current", "true");
    else button.removeAttribute("aria-current");
  });
  nextButton.textContent = index === questionButtons.length - 1
    ? "BACK TO QUESTIONS"
    : "NEXT " + String(index + 2).padStart(2, "0") + " →";
  readingTitle.focus({ preventScroll: true });
  updateReadingScroll();
}
document.querySelectorAll("#background [data-topic]").forEach((button) => {
  button.addEventListener("click", () => openTopic(Number(button.dataset.topic)));
});
function showAllQuestions() {
  reader.hidden = true;
  overview.hidden = false;
  topicButtons.forEach((button) => button.removeAttribute("aria-current"));
  questionButtons[activeTopic].focus({ preventScroll: true });
  updateReadingScroll();
}
document.getElementById("all-questions").addEventListener("click", showAllQuestions);
nextButton.addEventListener("click", () => {
  if (activeTopic === questionButtons.length - 1) showAllQuestions();
  else openTopic(activeTopic + 1);
});
readingText.addEventListener("scroll", updateReadingScroll, { passive: true });
window.addEventListener("resize", updateReadingScroll);
new ResizeObserver(updateReadingScroll).observe(readingText);

// One shared next-section control for PROJECT through RESULTS; TEAM has none.
const nextSections = {
  project: "background",
  background: "concept",
  concept: "research",
  research: "results",
  results: "team",
};
Object.entries(nextSections).forEach(([sectionId, nextId]) => {
  const section = document.getElementById(sectionId);
  if (!section) return;
  const target = document.getElementById(nextId);
  const control = document.createElement("button");
  control.type = "button";
  control.className = "section-scroll";
  control.disabled = !target;
  control.setAttribute("aria-label", target
    ? "Scroll to " + nextId.toUpperCase()
    : nextId.toUpperCase() + " section is not yet available");
  const label = document.createElement("span");
  label.className = "section-scroll-label";
  label.textContent = "SCROLL";
  const circle = document.createElement("span");
  circle.className = "section-scroll-circle";
  circle.setAttribute("aria-hidden", "true");
  circle.textContent = "↓";
  control.append(label, circle);
  control.addEventListener("click", () => {
    if (!target) return;
    target.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
      block: "start",
    });
  });
  section.append(control);
});

// Fit the complete text into a fixed rectangle without resizing the box or columns.
const sectionHeadlines = [...document.querySelectorAll(".section-headline")];
function fitSectionHeadline(box) {
  const text = box.querySelector(".section-headline-text");
  const bounds = box.getBoundingClientRect();
  if (!text || !bounds.width || !bounds.height) return;
  // The outer box retains the approved responsive maximum font size.
  const maximumSize = parseFloat(getComputedStyle(box).fontSize);
  const fits = (size) => {
    text.style.fontSize = size + "px";
    const measured = text.getBoundingClientRect();
    return measured.width <= bounds.width && measured.height <= bounds.height;
  };
  if (fits(maximumSize)) return;
  let low = 0;
  let high = maximumSize;
  for (let step = 0; step < 18; step++) {
    const middle = (low + high) / 2;
    if (fits(middle)) low = middle;
    else high = middle;
  }
  text.style.fontSize = low + "px";
}
let headlineFitFrame = 0;
function scheduleHeadlineFit() {
  cancelAnimationFrame(headlineFitFrame);
  headlineFitFrame = requestAnimationFrame(() => sectionHeadlines.forEach(fitSectionHeadline));
}
window.addEventListener("resize", scheduleHeadlineFit);
const headlineResizeObserver = new ResizeObserver(scheduleHeadlineFit);
sectionHeadlines.forEach((box) => headlineResizeObserver.observe(box));
const headlineTextObserver = new MutationObserver(scheduleHeadlineFit);
sectionHeadlines.forEach((box) => headlineTextObserver.observe(box, {
  childList: true, characterData: true, subtree: true,
}));
document.fonts.ready.then(scheduleHeadlineFit);
document.fonts.addEventListener("loadingdone", scheduleHeadlineFit);
scheduleHeadlineFit();
