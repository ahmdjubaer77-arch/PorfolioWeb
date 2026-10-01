const passwordInput = document.querySelector("#login-password");
const passwordToggle = document.querySelector("[data-password-toggle]");

passwordToggle.addEventListener("click", () => {
    const showPassword = passwordInput.type === "password";
    passwordInput.type = showPassword ? "text" : "password";
    passwordToggle.textContent = showPassword ? "Hide" : "Show";
    passwordToggle.setAttribute("aria-pressed", String(showPassword));
});
