"use strict";

const globalLinks = [...document.querySelectorAll(".section-menu a")];
const sections = [...document.querySelectorAll("main > section")];
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
}
window.addEventListener("scroll", updateGlobalNavigation, { passive: true });
window.addEventListener("resize", updateGlobalNavigation);
window.addEventListener("pageshow", updateGlobalNavigation);
updateGlobalNavigation();

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

