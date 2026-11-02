let fade;
remember.onReminder((event) => {
  if (!event) return;
  document.getElementById("pin-icon").innerHTML = icon(event.category);
  document.getElementById("pin-title").textContent = event.title;
  fade?.cancel();
  fade = document
    .getElementById("pin")
    .animate([{ opacity: 1 }, { opacity: 0.85, offset: 0.7 }, { opacity: 0 }], {
      duration: event.pinSeconds * 1000,
      easing: "linear",
      fill: "forwards",
    });
});
document.getElementById("pin-close").onclick = () => remember.closePin();
