/* Copy-button component for the "Many branches, one port" course.
 *
 * Include after page content:  <script src="../assets/copy.js"></script>
 * Every <pre> block gets a "Copy" button in its top-right corner that puts
 * the block's text on the clipboard. Styling lives in course.css (.copy-btn).
 */

document.addEventListener("DOMContentLoaded", function () {
  document.querySelectorAll("pre").forEach(function (pre) {
    var btn = document.createElement("button");
    btn.className = "copy-btn no-print";
    btn.type = "button";
    btn.textContent = "Copy";
    btn.addEventListener("click", function () {
      var code = pre.querySelector("code");
      var text = (code ? code.innerText : pre.innerText).trim() + "\n";
      navigator.clipboard.writeText(text).then(
        function () {
          btn.textContent = "Copied ✓";
          setTimeout(function () { btn.textContent = "Copy"; }, 1500);
        },
        function () {
          btn.textContent = "Failed — select manually";
          setTimeout(function () { btn.textContent = "Copy"; }, 2500);
        }
      );
    });
    pre.style.position = "relative";
    pre.appendChild(btn);
  });
});
