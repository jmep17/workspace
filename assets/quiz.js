/* Reusable quiz widget for the "Many branches, one port" course.
 *
 * Usage in a lesson:
 *   <div class="quiz" id="quiz"></div>
 *   <script src="../assets/quiz.js"></script>
 *   <script>
 *     renderQuiz(document.getElementById('quiz'), [
 *       { stem: "Question text?",
 *         options: ["A", "B", "C", "D"],   // equal word counts — no format clues
 *         answer: 2,                        // index into options
 *         explain: "Why the answer is right." },
 *     ]);
 *   </script>
 *
 * Options are shuffled on every render so position carries no information,
 * and the quiz can be retaken for retrieval practice.
 */

function renderQuiz(root, questions) {
  root.innerHTML = "";
  let answered = 0;
  let correct = 0;

  const scoreEl = document.createElement("p");
  scoreEl.className = "quiz-score";

  questions.forEach(function (q, qi) {
    const box = document.createElement("div");
    box.className = "quiz-q";

    const stem = document.createElement("p");
    stem.className = "stem";
    stem.textContent = (qi + 1) + ". " + q.stem;
    box.appendChild(stem);

    const order = q.options.map(function (_, i) { return i; });
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = order[i]; order[i] = order[j]; order[j] = t;
    }

    const buttons = [];
    order.forEach(function (optIdx) {
      const btn = document.createElement("button");
      btn.textContent = q.options[optIdx];
      btn.addEventListener("click", function () {
        buttons.forEach(function (b) { b.disabled = true; });
        const right = optIdx === q.answer;
        btn.classList.add(right ? "correct" : "incorrect");
        if (!right) {
          buttons.forEach(function (b) {
            if (b.dataset.idx == q.answer) b.classList.add("correct");
          });
        }
        const ex = document.createElement("p");
        ex.className = "explain";
        ex.textContent = q.explain;
        box.appendChild(ex);
        answered++;
        if (right) correct++;
        if (answered === questions.length) {
          scoreEl.textContent =
            "Score: " + correct + "/" + questions.length +
            (correct === questions.length
              ? " — solid. Come back in a few days and retake it from memory."
              : " — reread the section above, then reload the page and retry.");
        }
      });
      btn.dataset.idx = optIdx;
      buttons.push(btn);
      box.appendChild(btn);
    });

    root.appendChild(box);
  });

  root.appendChild(scoreEl);
}
