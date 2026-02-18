import { authSignIn } from "/firebase-config.js";

const form = document.querySelector("form");

if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = form.querySelector('input[type="email"]').value.trim();
    const password = form.querySelector('input[type="password"]').value;

    try {
      await authSignIn(email, password);
      window.location.href = "/dashboard.html";
    } catch (err) {
      alert(err.message || "Login failed");
    }
  });
}
